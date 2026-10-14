import { ColombianPeso } from '../../common/types/money';
import { QuotePetData } from '../quotes/quotes.types';

export type PolicyStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'PENDING_RENEWAL'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface PolicyCustomer {
  fullName: string;
  email: string;
  phone?: string;
  nationalId?: string;
}

export interface PolicyCoverage {
  code: string;
  name: string;
  description: string;
  annualLimitCop: ColombianPeso;
  /**
   * true cuando el amparo no tiene tope monetario porque es un servicio
   * (telemedicina). Sin este campo, el amparo se emitía con `annualLimitCop: 0`
   * y ese cero entraba al hash del certificado de Ley 527: la interfaz decía
   * "sin tope" y el contrato firmado decía cero.
   */
  hasNoAnnualLimit?: boolean;
  waitingPeriodDays: number;
  deductiblePercentage?: number;
  isMandatory?: boolean;
}

export interface PolicyEntity {
  id: string; // UUID v4
  policyNumber?: string; // Formato formal al activar: MTO-PET-YYYY-XXXXXX
  quoteId: string;
  quoteNumber: string;
  status: PolicyStatus;
  customer: PolicyCustomer;
  petData: QuotePetData;
  coverages: PolicyCoverage[];
  monthlyPremiumCop: ColombianPeso;
  annualPremiumCop: ColombianPeso;
  billingFrequency: 'MONTHLY' | 'ANNUAL';
  effectiveDate?: string; // ISO 8601
  expirationDate?: string; // ISO 8601 (+ 1 año exacto a las 23:59:59)
  policyCertificateHash?: string; // Hash SHA-256 para firma digital Ley 527 de 1999
  rulesVersion: string; // PET_RULES_v2.0.0
  autoRenewalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  cancellationReason?: string;
  cancelledAt?: string;
  gracePeriodEndsAt?: string; // Fecha fin de período de gracia (30 días Ley 527 / Código de Comercio)
  lastPaymentTransactionId?: string;
}

export interface PolicyDigitalCertificate {
  policyNumber: string;
  certificateHash: string;
  legalFramework: string;
  insuredPet: QuotePetData;
  policyholder: PolicyCustomer;
  effectiveDate: string;
  expirationDate: string;
  billingFrequency: 'MONTHLY' | 'ANNUAL';
  premiumCop: ColombianPeso;
  coverages: PolicyCoverage[];
  issuedAt: string;
}

export interface IPoliciesRepository {
  save(policy: PolicyEntity): Promise<PolicyEntity>;
  findById(id: string): Promise<PolicyEntity | null>;
  findByPolicyNumber(policyNumber: string): Promise<PolicyEntity | null>;
  findByQuoteId(quoteId: string): Promise<PolicyEntity | null>;
  update(policy: PolicyEntity): Promise<PolicyEntity>;
  findAll(): Promise<PolicyEntity[]>;
}

export const POLICIES_REPOSITORY = 'IPoliciesRepository';
