import { ColombianPeso } from '../../common/types/money';
import { BreBKey } from '../reimbursements/reimbursements.types';

/**
 * Estados del ciclo de vida de un siniestro en Manto 2.0.
 */
export type ClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ANALYZING_DOCUMENTS'
  | 'FAST_TRACK_APPROVED'
  | 'MANUAL_AUDIT_REQUIRED'
  | 'STP_APPROVED'
  | 'HUMAN_REVIEW'
  | 'APPROVED_BY_ADJUSTER'
  | 'REJECTED'
  | 'INFO_REQUESTED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'DISPUTED';

/**
 * Tipos de incidentes asegurables según el portafolio actuarial.
 */
export type IncidentType =
  | 'ACCIDENT'
  | 'COMMON_ILLNESS'
  | 'EMERGENCY_CONSULTATION'
  | 'CIVIL_LIABILITY'
  | 'CIVIL_LIABILITY_1801'
  | 'PREVENTIVE_WELLNESS';

export type ClaimDocumentType =
  | 'DIAN_INVOICE'
  | 'MEDICAL_HISTORY_EPICRISIS'
  | 'LAB_RESULTS'
  | 'PRESCRIPTION'
  | 'INCIDENT_PHOTO'
  | 'INCIDENT_PHOTOGRAPH'
  | 'DAMAGE_EVIDENCE'
  | 'OTHER';

export interface ClaimDocumentEntity {
  id: string;
  claimId?: string;
  userId: string;
  sessionId?: string;
  documentType: ClaimDocumentType;
  s3Bucket: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  uploadStatus: 'PENDING' | 'UPLOADED' | 'REJECTED';
  ocrStatus: 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'FAILED';
  ocrConfidence?: number;
  ocrExtractedData?: Record<string, unknown>;
  createdAt: string;
}

export type AuditActorType =
  | 'POLICYHOLDER'
  | 'SYSTEM_AI'
  | 'TRIAGE_ENGINE'
  | 'VET_ADJUSTER'
  | 'FINANCE_OPERATOR'
  | 'ADMIN';

export interface ClaimAuditLogEntity {
  id: string;
  claimId: string;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  previousStatus?: ClaimStatus;
  newStatus?: ClaimStatus;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export type PayoutChannel = 'NEQUI' | 'DAVIPLATA' | 'BRE_B' | 'BANK_TRANSFER_ACH';
export type PayoutStatus = 'SCHEDULED' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';

export interface PayoutRecordEntity {
  id: string;
  claimId: string;
  policyId: string;
  userId: string;
  amountCop: ColombianPeso;
  channel: PayoutChannel;
  accountIdentifierEncrypted: string;
  accountIdentifierMasked: string;
  accountHolderNationalId: string;
  bankCode?: string;
  accountType?: 'SAVINGS' | 'CHECKING' | 'WALLET' | 'BRE_B_KEY';
  providerTransactionId?: string;
  idempotencyKey: string;
  status: PayoutStatus;
  settledAt?: string;
  failureCode?: string;
  failureReason?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Identificador de categoría o perfil para evaluación STP (100% personalizada en Manto 2.0).
 */
export type StpTierPolicyCategory =
  | 'BASE_ACCIDENT'
  | 'MEDIUM_ILLNESS'
  | 'TOTAL_COMPREHENSIVE'
  | 'CUSTOM_TAILORED'
  | string;

/**
 * Detalle de ítem de factura electrónica DIAN analizado vía OCR.
 */
export interface DianInvoiceItem {
  description: string;
  /**
   * `ColombianPeso`, no `number`.
   *
   * Estos dos campos eran `number` y eso abría un agujero real: la DTO admitía
   * `400000.50`, se escribía con decimales en el `jsonb` de la factura, y la
   * columna `eligible_expenses_cop` guardaba el valor redondeado — el mismo
   * importe almacenado de dos formas distintas, en la fila que sustenta un
   * reembolso. `CLAUDE.md` es explícito: el dinero en COP es siempre
   * `ColombianPeso`, nunca `number` suelto ni aritmética flotante.
   */
  amountCop: ColombianPeso;
  isCovered: boolean;
  category: string;
}

/**
 * Metadatos de factura electrónica con validación previa de la DIAN.
 */
export interface DianInvoiceData {
  invoiceNumber: string;
  providerNit: string;
  providerName: string;
  dianCufe: string; // Código Único de Factura Electrónica (SHA-384 / hex)
  issueDate: string; // ISO 8601
  items: DianInvoiceItem[];
  totalInvoiceCop: ColombianPeso;
  ocrConfidence: number; // Índice de confianza OCR entre 0.00 y 1.00
}

/**
 * Metadatos estructurados extraídos de la Historia Clínica / Epicrisis por IA (Gemini).
 * Requisito OBLIGATORIO para cualquier trámite de reclamación en Manto 2.0.
 */
export interface ClinicalRecordData {
  documentId?: string;
  symptomsOnsetDate: string; // Fecha de inicio de los síntomas (ISO 8601)
  presumptiveDiagnosis: string;
  microchipNumber?: string;
  veterinarianName?: string;
  veterinarianLicense?: string;
  hasPreExistingSigns: boolean;
  preExistingNotes?: string;
  clinicalSummary?: string;
  ocrConfidence: number; // Índice de confianza entre 0.00 y 1.00
}

/**
 * Categorías de SLA de resolución dinámica y diferencial.
 */
export type SlaCategory = 'FAST_TRACK_MINUTES' | 'EXPEDITED_AUDIT_24H' | 'SPECIALIZED_REVIEW_48H';

/**
 * Resultado estructurado del motor STP (Straight-Through Processing) personalizado por mascota.
 */
export interface StpEvaluationResult {
  eligibleForStp: boolean;
  coverageCode?: string;
  personalizedStpLimitCop?: ColombianPeso;
  tierLimitCop: ColombianPeso; // Compatible hacia atrás con personalizedStpLimitCop
  tierCategory?: StpTierPolicyCategory;
  petRiskMultiplier?: number;
  rejectionReasons: string[];
  fraudRiskScore: number; // 0.00 (riesgo nulo) a 1.00 (fraude crítico)
  clinicalRecordValidation?: {
    symptomsOnsetDate: string;
    preExistingAlert: boolean;
    waitingPeriodAlert: boolean;
    microchipAlert: boolean;
  };
  slaCategory?: SlaCategory;
  slaResolutionEstimatedTime?: string;
}

/**
 * Entidad principal de Siniestro (Claim).
 */
export interface ClaimEntity {
  id: string; // UUID v4 o UUIDv7
  claimNumber: string; // Formato formal: CLM-YYYY-XXXXXX
  policyId: string;
  policyNumber: string;
  userId?: string;
  incidentType: IncidentType;
  incidentDate: string; // ISO 8601
  description: string;
  dianInvoice: DianInvoiceData;
  clinicalRecord?: ClinicalRecordData; // OBLIGATORIO: Historia clínica analizada por IA
  breBKey: BreBKey;
  eligibleExpensesCop: ColombianPeso;
  deductibleCop: ColombianPeso;
  netReimbursementCop: ColombianPeso;
  status: ClaimStatus;
  stpEvaluation: StpEvaluationResult;
  triageRoute?: 'FAST_TRACK' | 'MANUAL_AUDIT';
  triageReasons?: string[];
  claimedAmountCop?: ColombianPeso;
  approvedAmountCop?: ColombianPeso;
  netPayableAmountCop?: ColombianPeso;
  copayCop?: ColombianPeso;
  documentIds?: string[];
  documents?: ClaimDocumentEntity[];
  auditLogs?: ClaimAuditLogEntity[];
  payoutRecord?: PayoutRecordEntity;
  disbursementId?: string;
  disbursementTrackingCode?: string;
  financialInstitution?: string;
  slaCategory?: SlaCategory;
  slaResolutionEstimatedTime?: string;
  submittedAt: string; // ISO 8601
  adjudicatedAt?: string; // ISO 8601
  adjudicatedBy?: string; // 'STP_ENGINE_AUTOMATED' | identificador del ajustador
  rejectionReason?: string;
  auditNotes?: string;
}

/**
 * Contrato de persistencia para el módulo de Siniestros.
 */
export interface IClaimsRepository {
  save(claim: ClaimEntity): Promise<ClaimEntity>;
  findById(id: string): Promise<ClaimEntity | null>;
  findByClaimNumber(claimNumber: string): Promise<ClaimEntity | null>;
  findByPolicyId(policyId: string): Promise<ClaimEntity[]>;
  findByCufe(cufe: string): Promise<ClaimEntity | null>;
  update(claim: ClaimEntity): Promise<ClaimEntity>;
  findAll(): Promise<ClaimEntity[]>;
  clear?(): void;
}

export const CLAIMS_REPOSITORY = 'IClaimsRepository';
