/**
 * Contratos de Tipos de Frontend para el Módulo de Siniestros (Claims)
 * Arquitectura v1.1.0 - Radicación, Triage y Seguimiento en Vivo
 */

/**
 * Tipo nominal para Pesos Colombianos (COP) enteros en Frontend.
 * Representa valores monetarios estrictamente enteros sin centavos ni fracciones flotantes.
 */
export type ColombianPeso = number;

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

export type PayoutChannel =
  | 'NEQUI'
  | 'DAVIPLATA'
  | 'BRE_B'
  | 'BANK_TRANSFER_ACH';

export type BreBKeyType =
  | 'PHONE_NUMBER'
  | 'NATIONAL_ID'
  | 'EMAIL'
  | 'ALPHANUMERIC';

export interface BreBKey {
  type: BreBKeyType;
  value: string;
}

export interface DianInvoiceItem {
  description: string;
  amountCop: ColombianPeso;
  isCovered: boolean;
  category: string;
}

export interface DianInvoice {
  invoiceNumber: string;
  providerNit: string;
  providerName: string;
  dianCufe: string;
  issueDate: string;
  items: DianInvoiceItem[];
  totalInvoiceCop: ColombianPeso;
  ocrConfidence: number;
}

export interface GeneratePresignedUrlRequest {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType: ClaimDocumentType;
  sha256Checksum: string;
}

export interface PresignedUrlResponse {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
}

export type SlaCategory =
  | 'FAST_TRACK_MINUTES'
  | 'EXPEDITED_AUDIT_24H'
  | 'SPECIALIZED_REVIEW_48H';

export interface ClinicalRecordData {
  documentId?: string;
  documentType?: ClaimDocumentType;
  symptomsOnsetDate: string; // Fecha de inicio de los síntomas (ISO 8601) - Canónico Backend
  presumptiveDiagnosis: string; // Diagnóstico presuntivo o motivo de consulta - Canónico Backend
  veterinarianName?: string; // Nombre del veterinario tratante - Canónico Backend
  veterinarianLicense?: string; // Matrícula o tarjeta profesional - Canónico Backend
  microchipNumber?: string; // Número de microchip identificado - Canónico Backend
  hasPreExistingSigns?: boolean; // Señales de preexistencias detectadas - Canónico Backend
  preExistingNotes?: string; // Notas de preexistencias
  clinicalSummary?: string; // Resumen clínico
  ocrConfidence?: number; // Confianza de extracción OCR (0.0 a 1.0)
  // Alias de compatibilidad
  symptomsStartDate?: string;
  confirmedDiagnosis?: string;
  attendingVetName?: string;
  attendingVetProfessionalCard?: string;
  extractedMicrochip?: string;
  preExistingSignsDetected?: boolean;
  petMicrochipMatch?: boolean | null;
  rawTextExcerpt?: string;
}

export interface SubmitClaimRequest {
  policyId: string;
  incidentType: IncidentType;
  incidentDate: string;
  description: string;
  eligibleExpensesCop: ColombianPeso;
  claimedAmountCop?: ColombianPeso;
  dianInvoice: DianInvoice;
  clinicalRecord: ClinicalRecordData; // Obligatorio para cualquier trámite
  breBKey: BreBKey;
  documentIds?: string[];
  vetClinicNit?: string;
  vetClinicName?: string;
  payoutChannel?: PayoutChannel;
  payoutAccountIdentifier?: string;
  accountHolderNationalId?: string;
  bankCode?: string;
  accountType?: 'SAVINGS' | 'CHECKING' | 'WALLET' | 'BRE_B_KEY';
}

export interface SubmitClaimResponse {
  claimId: string;
  claimNumber: string;
  status: string;
  estimatedDecisionHours: number;
  timelineInitialStep: {
    status: string;
    label: string;
    timestamp: string;
    isCompleted: boolean;
  };
}

export interface TimelineMilestone {
  stepKey: 'SUBMITTED' | 'ANALYSIS' | 'DECISION' | 'PAYMENT';
  label: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  completedAt?: string;
}

export interface LiveClaimStatus {
  claimId: string;
  claimNumber: string;
  policyNumber: string;
  petName: string;
  incidentType: string;
  incidentDate: string;
  status: string;
  triageRoute?: 'FAST_TRACK' | 'MANUAL_AUDIT';
  slaCategory?: SlaCategory;
  slaResolutionEstimatedTime?: string;
  clinicalSummary?: {
    symptomsOnsetDate?: string;
    presumptiveDiagnosis?: string;
    symptomsStartDate?: string;
    diagnosis?: string;
    preExistingSignsDetected?: boolean;
    waitingPeriodCompliant?: boolean;
    microchipMatch?: boolean | null;
  };
  claimedAmountCop: ColombianPeso;
  approvedAmountCop: ColombianPeso;
  deductibleCop: ColombianPeso;
  netPayableAmountCop: ColombianPeso;
  payout?: {
    channel: string;
    accountMasked: string;
    status: string;
    settledAt?: string;
  };
  timeline: TimelineMilestone[];
  requiresActionFromUser: boolean;
  userActionMessage?: string;
  updatedAt: string;
}

export interface AdjudicateClaimRequest {
  decision: 'APPROVED' | 'REJECTED';
  approvedAmountCop?: ColombianPeso;
  adjusterNotes?: string;
  adjusterId?: string;
  rejectionReason?: string;
}

export interface StpEvaluationData {
  eligibleForStp: boolean;
  fraudRiskScore: number;
  rejectionReasons: string[];
  tierLimitCop?: ColombianPeso;
  coverageCode?: string;
}

export interface ClaimEntityData {
  id: string;
  claimNumber: string;
  policyId: string;
  policyNumber: string;
  petName?: string;
  incidentType: IncidentType;
  incidentDate: string;
  description: string;
  dianInvoice: DianInvoice;
  clinicalRecord?: ClinicalRecordData;
  slaCategory?: SlaCategory;
  slaResolutionEstimatedTime?: string;
  breBKey: BreBKey;
  eligibleExpensesCop: ColombianPeso;
  deductibleCop: ColombianPeso;
  netReimbursementCop: ColombianPeso;
  status: string;
  triageRoute?: 'FAST_TRACK' | 'MANUAL_AUDIT';
  triageReasons?: string[];
  stpEvaluation?: StpEvaluationData;
  claimedAmountCop?: ColombianPeso;
  approvedAmountCop?: ColombianPeso;
  disbursementId?: string;
  disbursementTrackingCode?: string;
  submittedAt: string;
  adjudicatedAt?: string;
  adjudicatedBy?: string;
  rejectionReason?: string;
  auditNotes?: string;
}

export interface ClaimDraftFormData {
  incidentType: IncidentType;
  incidentDate: string;
  description: string;
  claimedAmount: number;
  invoiceNumber?: string;
  providerNit?: string;
  providerName?: string;
  dianCufe?: string;
  uploadedDocId?: string | null;
  uploadedFileName?: string | null;
  fileSha256?: string;
  uploadedClinicalDocId?: string | null;
  uploadedClinicalFileName?: string | null;
  clinicalSha256?: string;
  symptomsStartDate?: string;
  confirmedDiagnosis?: string;
  attendingVetName?: string;
  petMicrochip?: string;
  payoutChannel: PayoutChannel;
  breBType: BreBKeyType;
  breBValue: string;
  habeasDataConsent: boolean;
}

export interface SaveClaimDraftDto {
  userId?: string;
  policyId: string;
  currentStep: number;
  formData: ClaimDraftFormData;
  savedAtTimestamp: number;
}

export interface ClaimDraftResponse {
  success: boolean;
  message?: string;
  draft?: SaveClaimDraftDto;
  expiresInSeconds?: number;
}

