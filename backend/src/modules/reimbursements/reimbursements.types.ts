import { ColombianPeso } from '../../common/types/money';

/**
 * Tipos de llaves identificadoras en el Sistema de Pagos Inmediatos (SPI / Bre-B)
 * operado por el Banco de la República de Colombia.
 */
export type BreBKeyType = 'PHONE_NUMBER' | 'NATIONAL_ID' | 'EMAIL' | 'ALPHANUMERIC';

export interface BreBKey {
  type: BreBKeyType;
  value: string;
}

/**
 * Estados del ciclo de vida de una dispersión inmediata Bre-B.
 */
export type DisbursementStatus = 'PENDING' | 'SETTLED_INSTANTLY' | 'FAILED' | 'RETRYING';

/**
 * Registro transaccional de dispersión de reembolso vía Bre-B.
 */
export interface DisbursementTransaction {
  id: string; // UUID v4
  claimId: string;
  policyId: string;
  amountCop: ColombianPeso;
  key: BreBKey;
  financialInstitution: string; // ej. 'Bancolombia', 'Davivienda', 'Nequi', 'Daviplata'
  breBTrackingCode: string; // ej. 'BREB-2026-XXXX'
  disbursedAt: string; // ISO 8601
  status: DisbursementStatus;
  errorMessage?: string;
  createdAt?: string;
}

export interface BreBDisbursementResult {
  trackingCode: string;
  financialInstitution: string;
  settledAt: string;
}

export interface BreBKeyResolution {
  valid: boolean;
  financialInstitution?: string;
  ownerNameMasked?: string;
  reason?: string;
}

/**
 * Contrato de integración para el adaptador Bre-B (SPI Banco de la República).
 */
export interface IBreBAdapter {
  disburse(params: {
    claimId: string;
    policyId: string;
    amountCop: ColombianPeso;
    key: BreBKey;
  }): Promise<BreBDisbursementResult>;
  resolveKey(key: BreBKey): Promise<BreBKeyResolution>;
  validateKeySyntax(key: BreBKey): { valid: boolean; error?: string };
  isUsingMock(): boolean;
}

export const BRE_B_ADAPTER = 'IBreBAdapter';

/**
 * Repositorio para transacciones de dispersión y auditoría de fondos.
 */
export interface IReimbursementsRepository {
  save(transaction: DisbursementTransaction): Promise<DisbursementTransaction>;
  findById(id: string): Promise<DisbursementTransaction | null>;
  findByClaimId(claimId: string): Promise<DisbursementTransaction | null>;
  findByPolicyId(policyId: string): Promise<DisbursementTransaction[]>;
  findByTrackingCode(trackingCode: string): Promise<DisbursementTransaction | null>;
  findAll(): Promise<DisbursementTransaction[]>;
  clear?(): void;
}

export const REIMBURSEMENTS_REPOSITORY = 'IReimbursementsRepository';
