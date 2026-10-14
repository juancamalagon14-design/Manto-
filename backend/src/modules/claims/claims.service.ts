import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  addCop,
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
import { ClaimsDraftService } from './claims-draft.service';
import { ClaimsStorageService } from './claims-storage.service';
import {
  ClaimEntity,
  CLAIMS_REPOSITORY,
  ClinicalRecordData,
  DianInvoiceData,
  IClaimsRepository,
  IncidentType,
} from './claims.types';
import { AdjudicateClaimDto } from './dto/adjudicate-claim.dto';
import { LiveClaimStatusDto, TimelineMilestone } from './dto/live-claim-status.dto';
import { DianInvoiceDto, SubmitClaimDto } from './dto/submit-claim.dto';
import { StpEngineService } from './stp-engine.service';

/**
 * Convierte la factura que llega por JSON al documento del dominio.
 *
 * Quien rechaza los decimales es `@IsInt` en la DTO; `toCop` redondea, así que
 * aquí lo que se garantiza es que nada con decimales llegue entero al `jsonb`:
 * el expediente del reembolso guarda un solo valor por importe.
 */
function facturaDianDesdeDto(dto: DianInvoiceDto): DianInvoiceData {
  return {
    invoiceNumber: dto.invoiceNumber,
    providerNit: dto.providerNit,
    providerName: dto.providerName,
    dianCufe: dto.dianCufe,
    issueDate: dto.issueDate,
    items: dto.items.map((i) => ({
      description: i.description,
      amountCop: toCop(i.amountCop),
      isCovered: i.isCovered,
      category: i.category,
    })),
    totalInvoiceCop: toCop(dto.totalInvoiceCop),
    ocrConfidence: dto.ocrConfidence,
  };
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    @Inject(CLAIMS_REPOSITORY)
    private readonly claimsRepository: IClaimsRepository,
    private readonly policiesService: PoliciesService,
    private readonly reimbursementsService: ReimbursementsService,
    private readonly stpEngine: StpEngineService,
    @Optional()
    private readonly claimsStorageService?: ClaimsStorageService,
    @Optional()
    private readonly auditLogService?: AuditLogService,
    @Optional()
    private readonly claimsDraftService?: ClaimsDraftService,
  ) {}

  /**
   * Genera el número formal de siniestro bajo el estándar: CLM-YYYY-XXXXXX.
   */
  public generateClaimNumber(): string {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CLM-${year}-${randomHex}`;
  }

  /**
   * Encuentra la cobertura aplicable para el tipo de incidente dentro de la póliza.
   */
  private findMatchingCoverage(
    policy: PolicyEntity,
    incidentType: IncidentType,
  ): PolicyCoverage | undefined {
    if (!policy.coverages || policy.coverages.length === 0) {
      return undefined;
    }

    switch (incidentType) {
      case 'ACCIDENT':
        return policy.coverages.find(
          (c) =>
            c.code === 'ACCIDENT_EMERGENCY' ||
            c.code.includes('ACCIDENT') ||
            c.code.includes('TRAUMA'),
        );

      case 'COMMON_ILLNESS':
        return policy.coverages.find(
          (c) =>
            c.code === 'COMMON_ILLNESSES' ||
            c.code.includes('ILLNESS') ||
            c.name.toLowerCase().includes('enfermedad'),
        );

      case 'EMERGENCY_CONSULTATION':
        return (
          policy.coverages.find(
            (c) =>
              c.code === 'EMERGENCY_CONSULTATIONS' ||
              c.code.includes('CONSULTATION') ||
              c.name.toLowerCase().includes('consulta'),
          ) ||
          policy.coverages.find(
            (c) => c.code === 'ACCIDENT_EMERGENCY' || c.code.includes('ACCIDENT'),
          )
        );

      case 'CIVIL_LIABILITY':
        return policy.coverages.find(
          (c) =>
            c.code === 'CIVIL_LIABILITY_1801' ||
            c.code.includes('LIABILITY') ||
            c.name.toLowerCase().includes('responsabilidad'),
        );

      case 'PREVENTIVE_WELLNESS':
        return policy.coverages.find(
          (c) =>
            c.code === 'PREVENTIVE_WELLNESS' ||
            c.code.includes('WELLNESS') ||
            c.name.toLowerCase().includes('bienestar') ||
            c.name.toLowerCase().includes('vacuna'),
        );

      default:
        return undefined;
    }
  }

  /**
   * Radicación y procesamiento determinístico de siniestros:
   * 1. Valida que la póliza exista y esté en estado ACTIVE.
   * 2. Valida que el incidente no esté en período de carencia.
   * 3. Verifica no duplicidad del código CUFE de la DIAN.
   * 4. Calcula determinísticamente el reembolso: eligibleExpenses - deductible, topado al saldo remanente.
   * 5. Evalúa con StpEngineService (límites escalonados y reglas de fraude).
   * 6. Si califica para STP: marca STP_APPROVED, asigna PAID, e invoca inmediatamente ReimbursementsService.disburseClaimViaBreB().
   * 7. Si no califica para STP: marca HUMAN_REVIEW con causales explícitas para el ajustador médico.
   */
  public async submitClaim(dto: SubmitClaimDto): Promise<ClaimEntity> {
    // 0. Validación de consistencia de entrada financiera
    if (!dto.eligibleExpensesCop || dto.eligibleExpensesCop <= 0) {
      throw new BadRequestException(
        'Los gastos elegibles declarados deben ser estrictamente positivos (mayores a 0 COP).',
      );
    }

    if (!dto.dianInvoice || !dto.dianInvoice.totalInvoiceCop || dto.dianInvoice.totalInvoiceCop <= 0) {
      throw new BadRequestException(
        'El total bruto de la factura electrónica DIAN debe ser estrictamente mayor a 0 COP.',
      );
    }

    // 1. Validar existencia y vigencia activa de la póliza
    const policy = await this.policiesService.getPolicyById(dto.policyId);
    if (!policy) {
      throw new NotFoundException(`La póliza con ID ${dto.policyId} no fue encontrada.`);
    }

    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException(
        `La póliza ${policy.policyNumber || policy.id} no se encuentra activa (estado actual: ${policy.status}). Solo pólizas en estado ACTIVE pueden radicar siniestros.`,
      );
    }

    // 2. Validar que la póliza tenga cobertura contratada y no se encuentre en período de carencia
    const coverage = this.findMatchingCoverage(policy, dto.incidentType);
    if (!coverage) {
      throw new BadRequestException(
        `La póliza no cuenta con cobertura contratada para el tipo de incidente: ${dto.incidentType}.`,
      );
    }

    const effectiveDate = new Date(policy.effectiveDate || policy.createdAt);
    const incidentDate = new Date(dto.incidentDate);

    if (incidentDate.getTime() > Date.now()) {
      throw new BadRequestException(
        `La fecha del incidente (${dto.incidentDate}) no puede ser una fecha futura.`,
      );
    }

    if (incidentDate.getTime() < effectiveDate.getTime()) {
      throw new BadRequestException(
        `La fecha del incidente (${dto.incidentDate}) es anterior a la fecha de inicio de vigencia de la póliza (${effectiveDate.toISOString()}).`,
      );
    }

    const diffDays = Math.floor(
      (incidentDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < coverage.waitingPeriodDays) {
      throw new BadRequestException(
        `El siniestro ocurrió dentro del período de carencia (${coverage.waitingPeriodDays} días requeridos) para la cobertura '${coverage.name}'. Días transcurridos: ${diffDays}.`,
      );
    }

    // 3. Verificar duplicidad del código CUFE de la DIAN en siniestros históricos
    const existingClaimByCufe = await this.claimsRepository.findByCufe(dto.dianInvoice.dianCufe);
    const isCufeDuplicate = !!existingClaimByCufe;

    // 4. Cálculo actuarial determinístico del reembolso
    const eligibleExpensesCop = toCop(dto.eligibleExpensesCop);

    /**
     * La factura cruza a `ColombianPeso` aquí y no más adelante.
     *
     * La DTO recibe números porque eso es lo que llega por JSON; la entidad que
     * se persiste lleva `ColombianPeso`. Si la conversión no ocurre en la
     * frontera, el `jsonb` termina guardando números con decimales mientras la
     * columna guarda el redondeo, y el expediente del reembolso queda con el
     * mismo importe escrito de dos maneras.
     */
    const dianInvoice = facturaDianDesdeDto(dto.dianInvoice);

    // Una cobertura emitida sin deducible declarado es un defecto de emisión,
    // no un caso que se rellene. El `?? 0.15` que había aquí liquidaba dinero
    // real sobre un copago supuesto — la misma familia de defecto que el
    // `city || 'BOGOTA'` que se eliminó del módulo de IA.
    if (coverage.deductiblePercentage === undefined || coverage.deductiblePercentage === null) {
      throw new UnprocessableEntityException(
        `La cobertura '${coverage.name}' de la póliza ${policy.policyNumber} se emitió sin ` +
          `porcentaje de deducible. No se liquida sobre un copago supuesto: corrija la emisión.`,
      );
    }
    const deductiblePercentage = coverage.deductiblePercentage;
    const deductibleCop = multiplyCop(eligibleExpensesCop, deductiblePercentage);

    const grossReimbursementCop =
      eligibleExpensesCop > deductibleCop
        ? ((eligibleExpensesCop - deductibleCop) as ColombianPeso)
        : toCop(0);

    // Calcular saldo remanente anual de la cobertura para la póliza
    const existingPolicyClaims = await this.claimsRepository.findByPolicyId(policy.id);
    const alreadyLiquidatedCop = existingPolicyClaims
      .filter((c) => {
        if (!['PAID', 'STP_APPROVED', 'APPROVED_BY_ADJUSTER'].includes(c.status)) {
          return false;
        }
        const claimCoverage = this.findMatchingCoverage(policy, c.incidentType);
        return claimCoverage && claimCoverage.code === coverage.code;
      })
      .reduce((acc, c) => addCop(acc, c.netReimbursementCop), toCop(0));

    const remainingLimitCop =
      coverage.annualLimitCop > alreadyLiquidatedCop
        ? ((coverage.annualLimitCop - alreadyLiquidatedCop) as ColombianPeso)
        : toCop(0);

    const netReimbursementCop =
      grossReimbursementCop > remainingLimitCop
        ? remainingLimitCop
        : grossReimbursementCop;

    // Procesar Historia Clínica / Epicrisis obligatoria
    if (!dto.clinicalRecord) {
      throw new BadRequestException(
        'La Historia Clínica o Epicrisis es obligatoria para cualquier trámite de reembolso. Debe adjuntarse el soporte médico veterinario.',
      );
    }

    const clinicalRecord: ClinicalRecordData = {
      symptomsOnsetDate: dto.clinicalRecord.symptomsOnsetDate || dto.clinicalRecord.symptomsStartDate || dto.incidentDate,
      presumptiveDiagnosis: dto.clinicalRecord.presumptiveDiagnosis || dto.clinicalRecord.confirmedDiagnosis || dto.description,
      microchipNumber: dto.clinicalRecord.microchipNumber || dto.clinicalRecord.extractedMicrochip,
      veterinarianName: dto.clinicalRecord.veterinarianName || dto.clinicalRecord.attendingVetName,
      veterinarianLicense: dto.clinicalRecord.veterinarianLicense,
      hasPreExistingSigns: dto.clinicalRecord.hasPreExistingSigns ?? false,
      preExistingNotes: dto.clinicalRecord.preExistingNotes,
      clinicalSummary: dto.clinicalRecord.clinicalSummary,
      ocrConfidence: dto.clinicalRecord.ocrConfidence ?? 0.95,
    };

    // 5. Evaluación con StpEngineService (Tope bajo riesgo $200k COP + Cruce IA Historia Clínica)
    const stpEvaluation = this.stpEngine.evaluateStp({
      claimData: {
        incidentType: dto.incidentType,
        incidentDate: dto.incidentDate,
        eligibleExpensesCop,
        netReimbursementCop,
        dianInvoice,
        clinicalRecord,
      },
      policy,
      isCufeDuplicate,
    });

    // 6 & 7. Construcción y adjudicación del siniestro
    const claimId = uuidv4();
    const claimNumber = this.generateClaimNumber();
    const submittedAt = new Date().toISOString();

    const claim: ClaimEntity = {
      id: claimId,
      claimNumber,
      policyId: policy.id,
      policyNumber: policy.policyNumber || 'MTO-PENDING',
      incidentType: dto.incidentType,
      incidentDate: dto.incidentDate,
      description: dto.description,
      dianInvoice,
      clinicalRecord,
      breBKey: dto.breBKey,
      eligibleExpensesCop,
      deductibleCop,
      netReimbursementCop,
      status: 'SUBMITTED',
      stpEvaluation,
      slaCategory: stpEvaluation.slaCategory,
      slaResolutionEstimatedTime: stpEvaluation.slaResolutionEstimatedTime,
      submittedAt,
    };

    if (stpEvaluation.eligibleForStp && netReimbursementCop > 0n) {
      claim.status = 'STP_APPROVED';

      // Dispersión inmediata vía Bre-B (Banco de la República)
      try {
        const disbursement = await this.reimbursementsService.disburseClaimViaBreB(
          claim.id,
          claim.policyId,
          claim.netReimbursementCop,
          claim.breBKey,
        );

        claim.status = 'PAID';
        claim.disbursementId = disbursement.id;
        claim.disbursementTrackingCode = disbursement.breBTrackingCode;
        claim.financialInstitution = disbursement.financialInstitution;
        claim.adjudicatedAt = new Date().toISOString();
        claim.adjudicatedBy = 'STP_ENGINE_AUTOMATED';

        this.logger.log(
          `Siniestro ${claim.claimNumber} liquidado y dispersado inmediatamente vía Bre-B (${claim.disbursementTrackingCode}). Monto: ${formatCop(claim.netReimbursementCop)}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Error en dispersión Bre-B para siniestro STP ${claim.claimNumber}: ${err.message}`,
        );
        claim.status = 'HUMAN_REVIEW';
        claim.rejectionReason = `Fallo en dispersión Bre-B: ${err.message}`;
      }
    } else {
      claim.status = 'HUMAN_REVIEW';
      claim.rejectionReason =
        stpEvaluation.rejectionReasons.length > 0
          ? stpEvaluation.rejectionReasons.join('; ')
          : 'Reembolso neto liquidado en $0 COP tras deducible y límites.';
    }

    if (dto.documentIds && dto.documentIds.length > 0) {
      claim.documentIds = dto.documentIds;
      if (this.claimsStorageService) {
        await this.claimsStorageService.linkDocumentsToClaim(
          dto.documentIds,
          claim.id,
          policy.customer.fullName || 'POLICYHOLDER',
        );
      }
    }

    if (this.auditLogService) {
      await this.auditLogService.logEvent({
        claimId: claim.id,
        actorType: 'POLICYHOLDER',
        actorId: policy.customer.email || policy.id,
        action: 'CLAIM_SUBMITTED',
        newStatus: claim.status,
        reason: 'Radicación de siniestro por el asegurado',
        metadata: {
          claimNumber: claim.claimNumber,
          incidentType: claim.incidentType,
          eligibleExpensesCop: copToNumber(claim.eligibleExpensesCop),
          netReimbursementCop: copToNumber(claim.netReimbursementCop),
        },
      });
    }

    const savedClaim = await this.claimsRepository.save(claim);

    // Si existía un borrador activo para esta póliza / radicación, se elimina automáticamente
    if (this.claimsDraftService) {
      try {
        await this.claimsDraftService.deleteDraft(dto.policyId);
      } catch {
        // Limpieza de borrador no bloquea la radicación exitosa
      }
    }

    return savedClaim;
  }

  /**
   * Consulta los detalles de un siniestro por su UUID identificador.
   */
  public async getClaimById(id: string): Promise<ClaimEntity> {
    const claim = await this.claimsRepository.findById(id);
    if (!claim) {
      throw new NotFoundException(`Siniestro con ID ${id} no encontrado.`);
    }
    return claim;
  }

  /**
   * Consulta el listado general de siniestros.
   */
  public async listClaims(): Promise<ClaimEntity[]> {
    return await this.claimsRepository.findAll();
  }

  /**
   * Adjudicación manual por ajustador médico para siniestros en HUMAN_REVIEW:
   * - Permite aprobar y opcionalmente ajustar el monto liquidado.
   * - Al aprobar, dispara inmediatamente el pago instantáneo vía Bre-B.
   * - Permite rechazar justificadamente el siniestro.
   */
  public async adjudicateClaimByHuman(
    id: string,
    dto: AdjudicateClaimDto,
  ): Promise<ClaimEntity> {
    const claim = await this.getClaimById(id);

    if (claim.status !== 'HUMAN_REVIEW' && claim.status !== 'MANUAL_AUDIT_REQUIRED') {
      throw new BadRequestException(
        `Solo es posible adjudicar siniestros en estado HUMAN_REVIEW o MANUAL_AUDIT_REQUIRED. Estado actual del siniestro: ${claim.status}.`,
      );
    }

    const adjudicatedAt = new Date().toISOString();
    const adjudicatedBy = dto.adjusterId || 'HUMAN_ADJUSTER';

    if (dto.decision === 'APPROVED') {
      if (dto.approvedAmountCop !== undefined) {
        if (dto.approvedAmountCop <= 0) {
          throw new BadRequestException(
            'El monto indemnizable aprobado por el ajustador debe ser estrictamente mayor a 0 COP.',
          );
        }
        claim.netReimbursementCop = toCop(dto.approvedAmountCop);
      }

      claim.status = 'APPROVED_BY_ADJUSTER';
      claim.adjudicatedAt = adjudicatedAt;
      claim.adjudicatedBy = adjudicatedBy;
      claim.auditNotes = dto.adjusterNotes;

      // Disparar pago inmediato Bre-B tras la aprobación médica
      const disbursement = await this.reimbursementsService.disburseClaimViaBreB(
        claim.id,
        claim.policyId,
        claim.netReimbursementCop,
        claim.breBKey,
      );

      claim.status = 'PAID';
      claim.disbursementId = disbursement.id;
      claim.disbursementTrackingCode = disbursement.breBTrackingCode;
      claim.financialInstitution = disbursement.financialInstitution;

      this.logger.log(
        `Siniestro ${claim.claimNumber} aprobado por ajustador ${adjudicatedBy} y pagado vía Bre-B (${claim.disbursementTrackingCode}). Monto: ${formatCop(claim.netReimbursementCop)}`,
      );
    } else {
      claim.status = 'REJECTED';
      claim.rejectionReason = dto.rejectionReason || 'Siniestro rechazado por el ajustador médico.';
      claim.adjudicatedAt = adjudicatedAt;
      claim.adjudicatedBy = adjudicatedBy;
      claim.auditNotes = dto.adjusterNotes;

      this.logger.log(
        `Siniestro ${claim.claimNumber} rechazado por ajustador ${adjudicatedBy}. Motivo: ${claim.rejectionReason}`,
      );
    }

    return await this.claimsRepository.update(claim);
  }

  /**
   * Consulta el estatus en vivo y genera la línea de tiempo dinámica (LiveClaimTracker)
   * con los 4 hitos transaccionales: Radicación, Triage, Decisión y Pago.
   */
  public async getClaimLiveStatus(id: string): Promise<LiveClaimStatusDto> {
    const claim = await this.getClaimById(id);
    const policy = await this.policiesService.getPolicyById(claim.policyId);

    const isAnalyzing = [
      'ANALYZING_DOCUMENTS',
      'FAST_TRACK_APPROVED',
      'STP_APPROVED',
      'MANUAL_AUDIT_REQUIRED',
      'HUMAN_REVIEW',
      'APPROVED_BY_ADJUSTER',
      'PAID',
      'REJECTED',
    ].includes(claim.status);

    const isDecided = [
      'FAST_TRACK_APPROVED',
      'STP_APPROVED',
      'APPROVED_BY_ADJUSTER',
      'PAID',
      'REJECTED',
    ].includes(claim.status);

    const isPaid = claim.status === 'PAID';
    const isRejected = claim.status === 'REJECTED';

    const timeline: TimelineMilestone[] = [
      {
        stepKey: 'SUBMITTED',
        label: 'Radicación Recibida',
        description: `Siniestro radicado el ${new Date(claim.submittedAt).toLocaleDateString('es-CO')}. Factura DIAN e Historia Clínica validadas.`,
        status: 'COMPLETED',
        completedAt: claim.submittedAt,
      },
      {
        stepKey: 'ANALYSIS',
        label: 'Triage, OCR & Cruce Clínico IA',
        description:
          claim.status === 'SUBMITTED'
            ? 'En cola de procesamiento asíncrono y verificación de soportes.'
            : claim.clinicalRecord?.hasPreExistingSigns
              ? 'Alerta clínica detectada en anamnesis. Remitido a perito veterinario.'
              : 'Extracción OCR, diagnóstico y cruce de carencias completados por IA.',
        status: isAnalyzing ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isAnalyzing ? claim.submittedAt : undefined,
      },
      {
        stepKey: 'DECISION',
        label: isRejected ? 'Siniestro Denegado' : 'Resolución y Liquidación',
        description: isRejected
          ? claim.rejectionReason || 'No cumple con las condiciones contractuales.'
          : isDecided
            ? `Aprobado por ${claim.adjudicatedBy || 'STP Automatizado'}. Monto neto: COP $${copToNumber(claim.netReimbursementCop).toLocaleString('es-CO')}. (${claim.slaResolutionEstimatedTime || 'SLA Express'}).`
            : `En evaluación médica por auditor humano. SLA estimado: ${claim.slaResolutionEstimatedTime || 'Menor a 24 horas'}.`,
        status: isRejected ? 'FAILED' : isDecided ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: claim.adjudicatedAt,
      },
      {
        stepKey: 'PAYMENT',
        label: isPaid ? 'Desembolso Realizado' : 'Dispersión de Fondos',
        description: isPaid
          ? `Transferencia exitosa vía ${claim.financialInstitution || 'Bre-B'}. Código: ${claim.disbursementTrackingCode || 'N/A'}.`
          : isRejected
            ? 'No aplica dispersión debido al rechazo del siniestro.'
            : 'Pendiente de dispersión bancaria.',
        status: isPaid ? 'COMPLETED' : isRejected ? 'FAILED' : 'PENDING',
        completedAt: isPaid ? claim.adjudicatedAt : undefined,
      },
    ];

    const claimed = claim.claimedAmountCop
      ? copToNumber(claim.claimedAmountCop)
      : copToNumber(claim.eligibleExpensesCop);
    const approved = claim.approvedAmountCop
      ? copToNumber(claim.approvedAmountCop)
      : copToNumber(claim.eligibleExpensesCop);
    const deductible = copToNumber(claim.deductibleCop);
    const netPayable = copToNumber(claim.netReimbursementCop);

    return {
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      policyNumber: claim.policyNumber,
      petName: policy?.petData.name || 'Mascota Asegurada',
      incidentType: claim.incidentType,
      incidentDate: claim.incidentDate,
      status: claim.status,
      triageRoute: claim.triageRoute,
      claimedAmountCop: claimed,
      approvedAmountCop: approved,
      deductibleCop: deductible,
      netPayableAmountCop: netPayable,
      payout: claim.disbursementTrackingCode
        ? {
            channel: 'BRE_B',
            accountMasked: claim.breBKey?.value ? `****${claim.breBKey.value.slice(-4)}` : 'Cuenta registrada',
            status: isPaid ? 'SETTLED' : 'PROCESSING',
            settledAt: claim.adjudicatedAt,
            trackingCode: claim.disbursementTrackingCode,
            financialInstitution: claim.financialInstitution,
          }
        : undefined,
      timeline,
      slaCategory: claim.slaCategory,
      slaResolutionEstimatedTime: claim.slaResolutionEstimatedTime,
      clinicalSummary: claim.clinicalRecord
        ? {
            symptomsOnsetDate: claim.clinicalRecord.symptomsOnsetDate,
            presumptiveDiagnosis: claim.clinicalRecord.presumptiveDiagnosis,
            symptomsStartDate: claim.clinicalRecord.symptomsOnsetDate,
            diagnosis: claim.clinicalRecord.presumptiveDiagnosis,
            preExistingSignsDetected: claim.clinicalRecord.hasPreExistingSigns,
            waitingPeriodCompliant: !claim.triageReasons?.some((r) => r.toLowerCase().includes('carencia')),
            microchipMatch: !claim.triageReasons?.some((r) => r.toLowerCase().includes('microchip')),
          }
        : undefined,
      requiresActionFromUser: claim.status === 'INFO_REQUESTED' || claim.status === 'DISPUTED',
      userActionMessage:
        claim.status === 'INFO_REQUESTED'
          ? 'El auditor veterinario solicita documentos adicionales para continuar.'
          : undefined,
      updatedAt: claim.adjudicatedAt || claim.submittedAt,
    };
  }
}
