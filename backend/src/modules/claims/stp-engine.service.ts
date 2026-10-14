import { Injectable, Logger } from '@nestjs/common';
import {
  addCop,
  ColombianPeso,
  copToNumber,
  formatCop,
  multiplyCop,
  toCop,
} from '../../common/types/money';
import { PolicyEntity } from '../policies/policies.types';
import {
  ClinicalRecordData,
  DianInvoiceData,
  IncidentType,
  SlaCategory,
  StpEvaluationResult,
  StpTierPolicyCategory,
} from './claims.types';

@Injectable()
export class StpEngineService {
  private readonly logger = new Logger(StpEngineService.name);

  // Umbral máximo estricto para liquidación inmediata STP de bajo riesgo
  public static readonly STP_LOW_RISK_CAP: ColombianPeso = toCop(200000);

  // Límites STP por categoría de póliza (en Pesos Colombianos)
  public static readonly STP_LIMIT_BASE_ACCIDENT: ColombianPeso = toCop(300000);
  public static readonly STP_LIMIT_MEDIUM_ILLNESS: ColombianPeso = toCop(600000);
  public static readonly STP_LIMIT_TOTAL_COMPREHENSIVE: ColombianPeso = toCop(1200000);

  // Umbral mínimo de confianza de extracción OCR para facturas de la DIAN
  public static readonly MIN_OCR_CONFIDENCE = 0.90;

  // Umbral máximo de tolerancia para score de riesgo de fraude
  public static readonly MAX_FRAUD_RISK_TOLERANCE = 0.50;

  /**
   * Resuelve el código de cobertura contractual según el tipo de incidente radicado.
   */
  public resolveCoverageCodeForIncident(incidentType: IncidentType): string {
    switch (incidentType) {
      case 'ACCIDENT':
        return 'ACCIDENT_EMERGENCY';
      case 'COMMON_ILLNESS':
        return 'COMMON_ILLNESSES';
      case 'EMERGENCY_CONSULTATION':
        return 'EMERGENCY_CONSULTATIONS';
      case 'CIVIL_LIABILITY':
        return 'CIVIL_LIABILITY_1801';
      default:
        return 'ACCIDENT_EMERGENCY';
    }
  }

  /**
   * Calcula el multiplicador de riesgo actuarial personalizado para la mascota:
   * 1. Factor de Edad:
   *    - Cachorros y Adultos Jóvenes (<= 72 meses / 6 años): 1.00
   *    - Adultos Maduros (73 a 96 meses / 6 a 8 años): 0.95
   *    - Seniors Iniciales (97 a 120 meses / 8 a 10 años): 0.85
   *    - Seniors Geriátricos (> 120 meses / > 10 años): 0.75
   * 2. Factor de Deducible:
   *    - Deducible 20%: 1.10 (menor riesgo moral por mayor copago asumido)
   *    - Deducible 15%: 1.00 (estándar)
   *    - Deducible 10%: 0.90 (menor copago, mayor prudencia STP)
   *    - Sin deducible o 0%: 1.00
   * 3. Factor Fenotipo / Raza:
   *    - Criollos / Mestizos: 1.05 (vigor híbrido)
   *    - Braquicéfalos: 0.90
   *    - Otras razas: 1.00
   */
  public calculatePetRiskMultiplier(policy: PolicyEntity): number {
    if (!policy || !policy.petData) {
      return 1.0;
    }

    const { ageInMonths, breedCode } = policy.petData;

    // Factor edad
    let ageFactor = 1.0;
    if (ageInMonths !== undefined && ageInMonths !== null) {
      if (ageInMonths > 120) {
        ageFactor = 0.75;
      } else if (ageInMonths > 96) {
        ageFactor = 0.85;
      } else if (ageInMonths > 72) {
        ageFactor = 0.95;
      } else {
        ageFactor = 1.0;
      }
    }

    // Factor deducible (extraído de las coberturas de la póliza)
    let deductibleFactor = 1.0;
    const sampleCoverage = policy.coverages?.[0];
    const deductiblePct = sampleCoverage?.deductiblePercentage;
    if (deductiblePct === 0.2) {
      deductibleFactor = 1.1;
    } else if (deductiblePct === 0.1) {
      deductibleFactor = 0.9;
    } else {
      deductibleFactor = 1.0;
    }

    // Factor raza
    let breedFactor = 1.0;
    if (breedCode) {
      const codeUpper = breedCode.toUpperCase();
      if (codeUpper.includes('MIXED') || codeUpper.includes('CRIOLLO')) {
        breedFactor = 1.05;
      } else if (
        codeUpper.includes('BULLDOG') ||
        codeUpper.includes('PUG') ||
        codeUpper.includes('PERSIAN')
      ) {
        breedFactor = 0.9;
      }
    }

    return Number((ageFactor * deductibleFactor * breedFactor).toFixed(4));
  }

  /**
   * Determina la categoría actuarial de la póliza (conservado por retrocompatibilidad).
   * En Manto 2.0 cada póliza es individual y a la medida.
   */
  public determineTierCategory(policy: PolicyEntity): StpTierPolicyCategory {
    if (!policy || !policy.coverages || policy.coverages.length === 0) {
      return 'BASE_ACCIDENT';
    }

    const baseCodes = new Set([
      'ACCIDENT_EMERGENCY',
      'EMERGENCY_CONSULTATIONS',
      'DIAGNOSTIC_IMAGING_LABS',
    ]);

    const addons = policy.coverages.filter((c) => !baseCodes.has(c.code));

    // Si tiene 2 o más add-ons (ej. COMMON_ILLNESSES + PRESCRIPTION_DRUGS), tiene cobertura extendida
    if (addons.length >= 2 || policy.coverages.length >= 5) {
      return 'TOTAL_COMPREHENSIVE';
    }

    // Si tiene cobertura de enfermedades comunes contratada
    const hasCommonIllness = policy.coverages.some(
      (c) =>
        c.code === 'COMMON_ILLNESSES' ||
        c.code.toLowerCase().includes('illness') ||
        c.name.toLowerCase().includes('enfermedad'),
    );

    if (hasCommonIllness) {
      return 'MEDIUM_ILLNESS';
    }

    return 'BASE_ACCIDENT';
  }

  /**
   * Obtiene el límite monetario STP asociado a una categoría (conservado por retrocompatibilidad).
   */
  public getTierLimit(category: StpTierPolicyCategory): ColombianPeso {
    switch (category) {
      case 'TOTAL_COMPREHENSIVE':
        return StpEngineService.STP_LIMIT_TOTAL_COMPREHENSIVE;
      case 'MEDIUM_ILLNESS':
        return StpEngineService.STP_LIMIT_MEDIUM_ILLNESS;
      case 'BASE_ACCIDENT':
      default:
        return StpEngineService.STP_LIMIT_BASE_ACCIDENT;
    }
  }

  /**
   * Calcula el límite STP dinámico y personalizado para la mascota y la cobertura invocada.
   * Sin planes rígidos: la capacidad STP se calibra en tiempo real a partir del perfil biológico de la mascota,
   * su deducible y las coberturas contratadas a la medida.
   */
  public calculatePersonalizedStpLimit(
    policy: PolicyEntity,
    incidentType: IncidentType,
  ): {
    coverageCode: string;
    personalizedStpLimitCop: ColombianPeso;
    baseCoverageLimitCop: ColombianPeso;
    petRiskMultiplier: number;
    hasCoverage: boolean;
  } {
    const targetCode = this.resolveCoverageCodeForIncident(incidentType);
    const coverage = policy?.coverages?.find(
      (c) => c.code === targetCode || c.code.includes(targetCode.split('_')[0]),
    );

    if (!coverage) {
      return {
        coverageCode: targetCode,
        personalizedStpLimitCop: toCop(0),
        baseCoverageLimitCop: toCop(0),
        petRiskMultiplier: 1.0,
        hasCoverage: false,
      };
    }

    const baseCodes = new Set([
      'ACCIDENT_EMERGENCY',
      'EMERGENCY_CONSULTATIONS',
      'DIAGNOSTIC_IMAGING_LABS',
    ]);
    const addons = (policy.coverages || []).filter((c) => !baseCodes.has(c.code));

    // Los tres topes salen de las constantes de la clase, no de literales.
    // Estaban escritos dos veces —aquí en línea y arriba como constantes— y
    // `resolveStpLimit` usaba unas y este método las otras: mover un tope en
    // un sitio dejaba el otro camino liquidando con la cifra vieja.
    const BASE = StpEngineService.STP_LIMIT_BASE_ACCIDENT;
    const MEDIA = StpEngineService.STP_LIMIT_MEDIUM_ILLNESS;
    const TOTAL = StpEngineService.STP_LIMIT_TOTAL_COMPREHENSIVE;

    let baseLimit: ColombianPeso = BASE;
    if (incidentType === 'COMMON_ILLNESS') {
      baseLimit = MEDIA;
    } else if (incidentType === 'CIVIL_LIABILITY') {
      baseLimit = TOTAL;
    } else if (incidentType === 'ACCIDENT') {
      baseLimit =
        addons.length >= 2 || (policy.coverages?.length ?? 0) >= 5 ? TOTAL : BASE;
    } else if (incidentType === 'EMERGENCY_CONSULTATION') {
      baseLimit = BASE;
    }

    const multiplier = this.calculatePetRiskMultiplier(policy);
    // multiplyCop en vez de Math.round sobre un número: es dinero.
    const calculatedLimit = Number(multiplyCop(baseLimit, multiplier));
    const maxPermitted = Number(coverage.annualLimitCop || calculatedLimit);
    const finalLimitCop = toCop(Math.min(calculatedLimit, maxPermitted));

    return {
      coverageCode: coverage.code,
      personalizedStpLimitCop: finalLimitCop,
      baseCoverageLimitCop: baseLimit,
      petRiskMultiplier: multiplier,
      hasCoverage: true,
    };
  }

  /**
   * Evalúa la elegibilidad STP (Straight-Through Processing) de un siniestro radicado.
   * Si no califica para liquidación y dispersión automática, enruta a HUMAN_REVIEW
   * con las causales explícitas detalladas.
   */
  public evaluateStp(params: {
    claimData: {
      incidentType: IncidentType;
      incidentDate?: string;
      eligibleExpensesCop: ColombianPeso;
      netReimbursementCop: ColombianPeso;
      dianInvoice: DianInvoiceData;
      clinicalRecord?: ClinicalRecordData;
    };
    policy: PolicyEntity;
    isCufeDuplicate: boolean;
  }): StpEvaluationResult {
    const { claimData, policy, isCufeDuplicate } = params;
    const { dianInvoice, netReimbursementCop, eligibleExpensesCop, clinicalRecord } = claimData;

    const personalizedStp = this.calculatePersonalizedStpLimit(policy, claimData.incidentType);
    const tierCategory = this.determineTierCategory(policy);
    const tierLimitCop = personalizedStp.personalizedStpLimitCop;
    const rejectionReasons: string[] = [];
    let fraudRiskScore = 0.0;

    let preExistingAlert = false;
    let waitingPeriodAlert = false;
    let microchipAlert = false;
    const symptomsOnsetDate =
      clinicalRecord?.symptomsOnsetDate || claimData.incidentDate || new Date().toISOString();

    // Regla 0: Verificación de Cobertura Activa Contratada
    if (!personalizedStp.hasCoverage) {
      rejectionReasons.push(
        `La póliza no cuenta con la cobertura activa (${personalizedStp.coverageCode}) contratada para siniestros de tipo ${claimData.incidentType}.`,
      );
      fraudRiskScore += 0.50;
    }

    // Regla 1: Control de Fraude - Verificación de no duplicidad del CUFE DIAN
    if (isCufeDuplicate) {
      rejectionReasons.push(
        'Alerta de Fraude: El código CUFE de la factura electrónica ya fue registrado y liquidado en un siniestro anterior.',
      );
      fraudRiskScore += 0.85;
    }

    // Regla 2: Calidad de Documentación - Umbral de Confianza OCR (< 0.90)
    if (dianInvoice.ocrConfidence < StpEngineService.MIN_OCR_CONFIDENCE) {
      rejectionReasons.push(
        `Confianza OCR insuficiente (${(dianInvoice.ocrConfidence * 100).toFixed(1)}% < ${(StpEngineService.MIN_OCR_CONFIDENCE * 100).toFixed(1)}%). Requiere auditoría visual de soporte fiscal.`,
      );
      fraudRiskScore += 0.25;
    }

    // Regla 3: Verificación de Historia Clínica / Epicrisis Obligatoria y Cruce IA
    if (!clinicalRecord) {
      rejectionReasons.push(
        'Falta documento obligatorio: La historia clínica / epicrisis médica veterinaria es requerida para todo trámite de reclamación.',
      );
      fraudRiskScore += 0.35;
    } else {
      // 3.1 Preexistencias declaradas en la historia clínica
      if (clinicalRecord.hasPreExistingSigns) {
        preExistingAlert = true;
        rejectionReasons.push(
          `Alerta de Preexistencia detectada en Historia Clínica: ${clinicalRecord.preExistingNotes || 'Se registran signos o patologías previas a la vigencia.'}`,
        );
        fraudRiskScore += 0.60;
      }

      // 3.2 Fecha de inicio de síntomas anterior a vigencia de póliza
      const effectiveDate = new Date(policy.effectiveDate || policy.createdAt);
      const symptomsDate = new Date(clinicalRecord.symptomsOnsetDate);
      if (!isNaN(symptomsDate.getTime()) && symptomsDate.getTime() < effectiveDate.getTime()) {
        preExistingAlert = true;
        rejectionReasons.push(
          `Alerta de Preexistencia: La fecha de inicio de síntomas (${clinicalRecord.symptomsOnsetDate.split('T')[0]}) es anterior a la vigencia de la póliza (${effectiveDate.toISOString().split('T')[0]}).`,
        );
        fraudRiskScore += 0.70;
      }

      // 3.3 Fecha de síntomas dentro del periodo de carencia
      const matchingCoverage = policy?.coverages?.find(
        (c) => c.code === personalizedStp.coverageCode,
      );
      if (matchingCoverage && matchingCoverage.waitingPeriodDays > 0 && !isNaN(symptomsDate.getTime())) {
        const daysFromEffective = Math.floor(
          (symptomsDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysFromEffective < matchingCoverage.waitingPeriodDays) {
          waitingPeriodAlert = true;
          rejectionReasons.push(
            `Carencia no superada: Los síntomas iniciaron a los ${daysFromEffective} días (período de carencia: ${matchingCoverage.waitingPeriodDays} días para ${matchingCoverage.name}).`,
          );
          fraudRiskScore += 0.45;
        }
      }

      // 3.4 Microchip discrepante
      if (
        clinicalRecord.microchipNumber &&
        (policy.petData as any)?.microchipNumber &&
        clinicalRecord.microchipNumber !== (policy.petData as any).microchipNumber
      ) {
        microchipAlert = true;
        rejectionReasons.push(
          `Alerta de Identidad: El microchip en historia clínica (${clinicalRecord.microchipNumber}) no coincide con el asegurado (${(policy.petData as any).microchipNumber}).`,
        );
        fraudRiskScore += 0.80;
      }
    }

    // Regla 4: Umbral Máximo de Bajo Riesgo ($200.000 COP) para Liquidación Instantánea Fast-Track
    if (netReimbursementCop <= 0n) {
      rejectionReasons.push(
        'El monto neto a indemnizar es $0 COP tras deducible y límites de cobertura. No es susceptible de liquidación automática STP.',
      );
    } else if (netReimbursementCop > StpEngineService.STP_LOW_RISK_CAP) {
      rejectionReasons.push(
        `Monto neto a liquidar (${formatCop(netReimbursementCop)}) excede el umbral Fast-Track de bajo riesgo (${formatCop(StpEngineService.STP_LOW_RISK_CAP)}). Enrutado a autenticación y auditoría pericial humana (SLA < 24h).`,
      );
    } else if (netReimbursementCop > tierLimitCop) {
      rejectionReasons.push(
        `Monto neto a liquidar (${formatCop(netReimbursementCop)}) excede el límite de aprobación STP para la categoría ${tierCategory} (${formatCop(tierLimitCop)}). Enrutado a mesa médica.`,
      );
    }

    // Regla 5: Consistencia Aritmética de Facturación DIAN
    if (dianInvoice.items && dianInvoice.items.length > 0) {
      const itemsSum = addCop(...dianInvoice.items.map((item) => item.amountCop));
      const diferencia =
        itemsSum > dianInvoice.totalInvoiceCop
          ? itemsSum - dianInvoice.totalInvoiceCop
          : dianInvoice.totalInvoiceCop - itemsSum;
      if (diferencia > 1n) {
        rejectionReasons.push(
          `Discrepancia contable: La suma de ítems analizados (${formatCop(itemsSum)}) no coincide con el total de la factura (${formatCop(dianInvoice.totalInvoiceCop)}).`,
        );
        fraudRiskScore += 0.40;
      }
    }

    // Regla 6: Coherencia de Gastos Elegibles vs Total Factura
    if (eligibleExpensesCop > dianInvoice.totalInvoiceCop) {
      rejectionReasons.push(
        `Inconsistencia: Los gastos elegibles declarados (${formatCop(eligibleExpensesCop)}) superan el valor bruto total facturado (${formatCop(dianInvoice.totalInvoiceCop)}).`,
      );
      fraudRiskScore += 0.50;
    }

    // Regla 7: Umbral Máximo de Riesgo de Fraude
    if (fraudRiskScore >= StpEngineService.MAX_FRAUD_RISK_TOLERANCE) {
      rejectionReasons.push(
        `Puntaje de riesgo de fraude (${fraudRiskScore.toFixed(2)}) supera el umbral de tolerancia para liquidación automática STP (${StpEngineService.MAX_FRAUD_RISK_TOLERANCE}).`,
      );
    }

    const eligibleForStp = rejectionReasons.length === 0;

    // Cálculo dinámico de SLA de resolución
    let slaCategory: SlaCategory;
    let slaResolutionEstimatedTime: string;

    if (eligibleForStp) {
      slaCategory = 'FAST_TRACK_MINUTES';
      slaResolutionEstimatedTime = '3 a 5 minutos (Bre-B Inmediato)';
    } else if (fraudRiskScore >= 0.50 || preExistingAlert || isCufeDuplicate) {
      slaCategory = 'SPECIALIZED_REVIEW_48H';
      slaResolutionEstimatedTime = '24 a 48 horas hábiles (Auditoría Médica Especializada)';
    } else {
      slaCategory = 'EXPEDITED_AUDIT_24H';
      slaResolutionEstimatedTime = 'Menor a 24 horas hábiles (Auditoría Clínica Express)';
    }

    this.logger.log(
      `[StpEngine] Evaluación personalizada para mascota ${policy?.petData?.name || 'Mascota'} (Siniestro: ${claimData.incidentType}, Cobertura: ${personalizedStp.coverageCode}): ${eligibleForStp ? 'APROBADO_STP' : 'HUMAN_REVIEW'} (Tope Bajo Riesgo: ${formatCop(StpEngineService.STP_LOW_RISK_CAP)}, Reembolso: ${formatCop(netReimbursementCop)}, SLA: ${slaResolutionEstimatedTime}, Score Fraude: ${fraudRiskScore.toFixed(2)})`,
    );

    return {
      eligibleForStp,
      coverageCode: personalizedStp.coverageCode,
      personalizedStpLimitCop: tierLimitCop,
      tierCategory,
      tierLimitCop,
      petRiskMultiplier: personalizedStp.petRiskMultiplier,
      rejectionReasons,
      fraudRiskScore: Math.min(1.0, fraudRiskScore),
      clinicalRecordValidation: {
        symptomsOnsetDate,
        preExistingAlert,
        waitingPeriodAlert,
        microchipAlert,
      },
      slaCategory,
      slaResolutionEstimatedTime,
    };
  }
}
