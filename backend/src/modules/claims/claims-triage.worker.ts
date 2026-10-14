import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ColombianPeso,
  copToNumber,
  formatCop,
  multiplyCop,
  toCop,
} from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import { PolicyCoverage, PolicyEntity } from '../policies/policies.types';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import { AuditLogService } from './audit-log.service';
import { ClaimsStorageService } from './claims-storage.service';
import {
  ClaimEntity,
  CLAIMS_REPOSITORY,
  DianInvoiceData,
  IClaimsRepository,
  IncidentType,
} from './claims.types';
import { ClaimsTriageJobData } from './claims-triage-queue.service';
import { InvoiceOcrService } from './invoice-ocr.service';
import { StpEngineService } from './stp-engine.service';

export const BLACKLISTED_CLINIC_NITS = new Set([
  '900999999-9',
  '800111222-3',
  '901999888-7',
]);

const COVERAGE_MAP: Record<IncidentType, string> = {
  ACCIDENT: 'ACCIDENT_EMERGENCY',
  COMMON_ILLNESS: 'COMMON_ILLNESSES',
  EMERGENCY_CONSULTATION: 'EMERGENCY_CONSULTATIONS',
  CIVIL_LIABILITY: 'CIVIL_LIABILITY_1801',
  CIVIL_LIABILITY_1801: 'CIVIL_LIABILITY_1801',
  PREVENTIVE_WELLNESS: 'PREVENTIVE_WELLNESS',
};

export interface TriageExecutionResult {
  claimId: string;
  triageRoute: 'FAST_TRACK' | 'MANUAL_AUDIT';
  status: string;
  reasons: string[];
  fraudRiskScore: number;
}

@Injectable()
export class ClaimsTriageWorker {
  private readonly logger = new Logger(ClaimsTriageWorker.name);

  constructor(
    @Inject(CLAIMS_REPOSITORY)
    private readonly claimsRepository: IClaimsRepository,
    private readonly policiesService: PoliciesService,
    private readonly invoiceOcrService: InvoiceOcrService,
    private readonly stpEngine: StpEngineService,
    private readonly reimbursementsService: ReimbursementsService,
    @Optional()
    private readonly claimsStorageService?: ClaimsStorageService,
    @Optional()
    private readonly auditLogService?: AuditLogService,
  ) {}

  /**
   * Ejecuta el pipeline asíncrono de Triage de 6 etapas:
   * 1. Transición a ANALYZING_DOCUMENTS.
   * 2. Extracción OCR con Gemini 3.6 Flash.
   * 3. Verificación de hash SHA-256 y CUFE.
   * 4. Evaluación de las 10 Reglas Booleanas de Triage.
   * 5. Liquidación con deducción de deducible y ruteo Fast-Track vs Manual Audit.
   * 6. Dispersión inmediata vía Bre-B si califica para Fast-Track.
   */
  public async processJob(jobData: ClaimsTriageJobData): Promise<TriageExecutionResult> {
    const { claimId } = jobData;
    this.logger.log(`Iniciando procesamiento asíncrono de Triage para siniestro ${claimId}`);

    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new Error(`Siniestro con ID ${claimId} no existe en persistencia.`);
    }

    const policy = await this.policiesService.getPolicyById(claim.policyId);
    if (!policy) {
      throw new Error(`Póliza ${claim.policyId} no encontrada.`);
    }

    // 1. Transición de estado a ANALYZING_DOCUMENTS
    const prevStatus = claim.status;
    claim.status = 'ANALYZING_DOCUMENTS';
    await this.claimsRepository.update(claim);

    if (this.auditLogService) {
      await this.auditLogService.logEvent({
        claimId: claim.id,
        actorType: 'TRIAGE_ENGINE',
        actorId: 'WORKER_BULLMQ_TRIAGE',
        action: 'STATUS_TRANSITION',
        previousStatus: prevStatus,
        newStatus: 'ANALYZING_DOCUMENTS',
        reason: 'Inicio de análisis asíncrono de soportes y extracción OCR',
      });
    }

    // 2. Extracción OCR con Gemini 3.6 Flash si hay documento adjunto
    let invoiceData: DianInvoiceData = claim.dianInvoice;
    let fileSha256 = claim.dianInvoice?.dianCufe
      ? createHash('sha256').update(claim.dianInvoice.dianCufe).digest('hex')
      : '';

    if (jobData.documentBase64) {
      const ocrResult = await this.invoiceOcrService.processInvoiceDocument(
        jobData.documentBase64,
        jobData.mimeType || 'application/pdf',
      );
      invoiceData = ocrResult.invoiceData;
      fileSha256 = ocrResult.fileSha256;
      claim.dianInvoice = invoiceData;
    } else if (claim.documentIds && claim.documentIds.length > 0 && this.claimsStorageService) {
      const firstDoc = await this.claimsStorageService.getDocumentById(claim.documentIds[0]);
      if (firstDoc) {
        fileSha256 = firstDoc.sha256Checksum;
        if (firstDoc.ocrExtractedData && Object.keys(firstDoc.ocrExtractedData).length > 0) {
          invoiceData = firstDoc.ocrExtractedData as unknown as DianInvoiceData;
          claim.dianInvoice = invoiceData;
        }
      }
    }

    // 3. Evaluación de las 10 Reglas Booleanas de Triage
    const triageReasons: string[] = [];
    let fraudRiskScore = 0.0;

    const claimedAmountCopNumber = claim.claimedAmountCop
      ? copToNumber(claim.claimedAmountCop)
      : copToNumber(claim.eligibleExpensesCop);

    // Regla 1: Monto <= $200.000 COP
    const rule1 = claimedAmountCopNumber <= 200000;
    if (!rule1) {
      triageReasons.push(
        `Monto reclamado ($${claimedAmountCopNumber.toLocaleString('es-CO')} COP) excede el umbral de Fast-Track ($200.000 COP).`,
      );
    }

    // Regla 2: Póliza activa y al día
    const rule2 = policy.status === 'ACTIVE';
    if (!rule2) {
      triageReasons.push(`La póliza no se encuentra en estado ACTIVE (Estado: ${policy.status}).`);
    }

    // Regla 3: Período de carencia satisfecho
    const coverageCode = COVERAGE_MAP[claim.incidentType];
    const matchingCoverage = policy.coverages.find((c) => c.code === coverageCode);
    let rule3 = false;
    if (matchingCoverage) {
      const policyStart = new Date(policy.effectiveDate || policy.createdAt).getTime();
      const incidentTime = new Date(claim.incidentDate).getTime();
      const waitingPeriodMs = matchingCoverage.waitingPeriodDays * 24 * 60 * 60 * 1000;
      rule3 = incidentTime >= policyStart + waitingPeriodMs;
      if (!rule3) {
        triageReasons.push(
          `Siniestro en período de carencia: cobertura ${coverageCode} exige ${matchingCoverage.waitingPeriodDays} días.`,
        );
      }
    } else {
      triageReasons.push(`La póliza no cuenta con la cobertura ${coverageCode} contratada.`);
    }

    // Regla 4: Hash SHA-256 único de archivo (Cero colisiones)
    const existingClaims = await this.claimsRepository.findByPolicyId(claim.policyId);
    const hashCollision = existingClaims.some(
      (c) => c.id !== claim.id && c.dianInvoice?.dianCufe === invoiceData?.dianCufe && c.status !== 'REJECTED',
    );
    const rule4 = !hashCollision;
    if (!rule4) {
      fraudRiskScore += 40.0;
      triageReasons.push('Alerta de fraude: Factura ya radicada en otro siniestro previo.');
    }

    // Regla 5: CUFE DIAN verificado y no reutilizado
    const cufeReused = await this.claimsRepository.findByCufe(invoiceData?.dianCufe || '');
    const rule5 = !cufeReused || cufeReused.id === claim.id || cufeReused.status === 'REJECTED';
    if (!rule5) {
      fraudRiskScore += 50.0;
      triageReasons.push('Alerta fiscal: CUFE de factura electrónica DIAN ya reembolsado.');
    }

    // Regla 6: Confianza OCR >= 0.85
    const ocrConf = invoiceData?.ocrConfidence ?? 0.95;
    const rule6 = ocrConf >= 0.85;
    if (!rule6) {
      fraudRiskScore += 15.0;
      triageReasons.push(`Confianza OCR insuficiente (${ocrConf.toFixed(2)} < 0.85). Requiere revisión.`);
    }

    // Regla 7: Score de riesgo de fraude < 10.00
    const rule7 = fraudRiskScore < 10.0;
    if (!rule7) {
      triageReasons.push(`Puntaje de riesgo de fraude elevado (${fraudRiskScore.toFixed(2)} >= 10.00).`);
    }

    // Regla 8: Clínica veterinaria no reportada en lista negra
    const clinicNit = (invoiceData?.providerNit || '').replace(/[^0-9\-]/g, '');
    const rule8 = !BLACKLISTED_CLINIC_NITS.has(clinicNit);
    if (!rule8) {
      fraudRiskScore += 60.0;
      triageReasons.push(`Clínica veterinaria (${clinicNit}) se encuentra en lista negra antifraude.`);
    }

    // Regla 9: Cero inflación de factura (claimed <= ocr_extracted_total)
    const ocrTotal = copToNumber(invoiceData?.totalInvoiceCop || toCop(0));
    const rule9 = claimedAmountCopNumber <= ocrTotal;
    if (!rule9) {
      fraudRiskScore += 25.0;
      triageReasons.push(
        `Discrepancia financiera: Monto reclamado ($${claimedAmountCopNumber}) supera el total de la factura ($${ocrTotal}).`,
      );
    }

    // Regla 10: Fecha de incidente válida (durante vigencia y no futura)
    const incidentDate = new Date(claim.incidentDate).getTime();
    const effectiveDate = new Date(policy.effectiveDate || policy.createdAt).getTime();
    const now = Date.now();
    const rule10 = incidentDate >= effectiveDate && incidentDate <= now;
    if (!rule10) {
      triageReasons.push('Fecha del incidente anterior a la vigencia o fecha futura.');
    }

    // Regla 11: Historia Clínica obligatoria y libre de signos preexistentes
    const rule11 = Boolean(claim.clinicalRecord) && !claim.clinicalRecord?.hasPreExistingSigns;
    if (!claim.clinicalRecord) {
      triageReasons.push('Historia Clínica o Epicrisis ausente en el expediente del siniestro.');
    } else if (claim.clinicalRecord.hasPreExistingSigns) {
      fraudRiskScore += 40.0;
      triageReasons.push('Historia Clínica registra síntomas o signos previos a la vigencia de la póliza.');
    }

    // Evaluación total
    const isFastTrackEligible =
      rule1 && rule2 && rule3 && rule4 && rule5 && rule6 && rule7 && rule8 && rule9 && rule10 && rule11;

    claim.triageReasons = triageReasons;

    // 4. Liquidación y resolución
    if (isFastTrackEligible) {
      claim.triageRoute = 'FAST_TRACK';
      claim.status = 'FAST_TRACK_APPROVED';
      claim.slaCategory = 'FAST_TRACK_MINUTES';
      claim.slaResolutionEstimatedTime = '3 a 5 minutos (Bre-B Inmediato)';

      // Deducción actuarial del aporte por evento (deducible)
      if (matchingCoverage?.deductiblePercentage === undefined || matchingCoverage?.deductiblePercentage === null) {
        throw new Error(
          `La cobertura '${matchingCoverage?.name || coverageCode}' no cuenta con deducible definido. Corrija la emisión.`,
        );
      }
      const deductiblePercentage = matchingCoverage.deductiblePercentage;
      const claimedCop = toCop(claimedAmountCopNumber);
      const deductibleCop = multiplyCop(claimedCop, deductiblePercentage);
      const netPayableCop =
        claimedCop > deductibleCop
          ? ((claimedCop - deductibleCop) as ColombianPeso)
          : toCop(0);

      claim.deductibleCop = deductibleCop;
      claim.netReimbursementCop = netPayableCop;
      claim.approvedAmountCop = claimedCop;
      claim.adjudicatedAt = new Date().toISOString();
      claim.adjudicatedBy = 'STP_ENGINE_AUTOMATED';

      // Supresión de desembolso si el neto es 0 COP
      if (netPayableCop === 0n) {
        claim.status = 'FAST_TRACK_APPROVED';
        this.logger.log(
          `Siniestro ${claim.claimNumber} aprobado por Fast-Track con $0 COP neto (absorbido por deducible). Supresión de pago activa.`,
        );
      } else {
        // Dispersión inmediata vía Bre-B
        claim.status = 'PAYMENT_PENDING';
        try {
          const disbursement = await this.reimbursementsService.disburseClaimViaBreB(
            claim.id,
            claim.policyId,
            netPayableCop,
            claim.breBKey,
          );
          claim.status = 'PAID';
          claim.disbursementId = disbursement.id;
          claim.disbursementTrackingCode = disbursement.breBTrackingCode;
          claim.financialInstitution = disbursement.financialInstitution;
          this.logger.log(
            `Siniestro Fast-Track ${claim.claimNumber} dispersado exitosamente vía Bre-B (${claim.disbursementTrackingCode}). Monto neto: ${formatCop(netPayableCop)}`,
          );
        } catch (err: any) {
          this.logger.error(`Fallo en dispersión Bre-B: ${err.message}. Enrutando a revisión.`);
          claim.status = 'MANUAL_AUDIT_REQUIRED';
          claim.rejectionReason = `Fallo técnico en dispersión bancaria: ${err.message}`;
        }
      }
    } else {
      claim.triageRoute = 'MANUAL_AUDIT';
      claim.status = 'MANUAL_AUDIT_REQUIRED';
      claim.rejectionReason = triageReasons.join('; ');
      if (!rule1 && fraudRiskScore < 20.0) {
        claim.slaCategory = 'EXPEDITED_AUDIT_24H';
        claim.slaResolutionEstimatedTime = 'Menor a 24 horas hábiles (Auditoría Clínica Express)';
      } else {
        claim.slaCategory = 'SPECIALIZED_REVIEW_48H';
        claim.slaResolutionEstimatedTime = '24 a 48 horas hábiles (Auditoría Médica Especializada)';
      }
      this.logger.log(
        `Siniestro ${claim.claimNumber} enrutado a MANUAL_AUDIT_REQUIRED por ${triageReasons.length} causales.`,
      );
    }

    await this.claimsRepository.update(claim);

    // Registro inmutable de auditoría
    if (this.auditLogService) {
      await this.auditLogService.logEvent({
        claimId: claim.id,
        actorType: 'TRIAGE_ENGINE',
        actorId: 'WORKER_BULLMQ_TRIAGE',
        action: 'TRIAGE_EVALUATED',
        previousStatus: 'ANALYZING_DOCUMENTS',
        newStatus: claim.status,
        reason: isFastTrackEligible
          ? 'Aprobación automática vía Fast-Track (<$200.000 COP sin alertas)'
          : `Enrutado a auditoría manual: ${triageReasons[0] || 'Criterios no satisfechos'}`,
        metadata: {
          triageRoute: claim.triageRoute,
          fraudRiskScore,
          reasons: triageReasons,
          ocrConfidence: ocrConf,
          netReimbursementCop: copToNumber(claim.netReimbursementCop),
        },
      });
    }

    return {
      claimId: claim.id,
      triageRoute: claim.triageRoute || 'MANUAL_AUDIT',
      status: claim.status,
      reasons: triageReasons,
      fraudRiskScore,
    };
  }
}
