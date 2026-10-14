export interface TimelineMilestone {
  stepKey: 'SUBMITTED' | 'ANALYSIS' | 'DECISION' | 'PAYMENT';
  label: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  completedAt?: string;
}

export interface ClinicalSummaryDto {
  symptomsOnsetDate?: string;
  presumptiveDiagnosis?: string;
  symptomsStartDate?: string;
  diagnosis?: string;
  preExistingSignsDetected?: boolean;
  waitingPeriodCompliant?: boolean;
  microchipMatch?: boolean | null;
}

export class LiveClaimStatusDto {
  claimId!: string;
  claimNumber!: string;
  policyNumber!: string;
  petName!: string;
  incidentType!: string;
  incidentDate!: string;

  status!: string; // 'SUBMITTED' | 'ANALYZING_DOCUMENTS' | 'FAST_TRACK_APPROVED' | 'MANUAL_AUDIT_REQUIRED' | 'PAID' | etc.
  triageRoute?: 'FAST_TRACK' | 'MANUAL_AUDIT';

  // Resumen Financiero en COP
  claimedAmountCop!: number;
  approvedAmountCop!: number;
  deductibleCop!: number;
  netPayableAmountCop!: number;

  // Estado de Dispersión
  payout?: {
    channel: string;
    accountMasked: string;
    status: string;
    settledAt?: string;
    trackingCode?: string;
    financialInstitution?: string;
  };

  // Línea de Tiempo para UI (LiveClaimTracker)
  timeline!: TimelineMilestone[];

  slaCategory?: string;
  slaResolutionEstimatedTime?: string;
  clinicalSummary?: ClinicalSummaryDto;

  requiresActionFromUser!: boolean;
  userActionMessage?: string;
  updatedAt!: string;
}
