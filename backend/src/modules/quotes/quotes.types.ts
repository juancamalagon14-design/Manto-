import { EligibilityResult } from '../eligibility/eligibility.types';
import {
  AddonKey,
  City,
  DeductibleOption,
  PricingCalculationResult,
  SizeCategory,
  Gender,
  Species,
} from '../pricing/pricing.types';

export type QuoteStatus = 'DRAFT' | 'OFFERED' | 'BOUND' | 'EXPIRED' | 'REJECTED';

export interface QuotePetData {
  name: string;
  species: Species;
  breedCode: string;
  /**
   * Tamaño con el que se tarifó, ya validado contra el típico de la raza — no
   * el que declaró el cliente. Queda sin valor solo cuando la raza no existe
   * en el registro y no se declaró tamaño, caso en el que la cotización se
   * rechaza por elegibilidad y no hay nada que congelar.
   */
  sizeCategory?: SizeCategory;
  ageInMonths: number;
  city: City;
  /** Sexo. Entra como factor de tarifa, por eso queda en el snapshot. */
  gender: Gender;
  isSterilized: boolean;
  /**
   * Mascotas declaradas bajo el mismo titular. Es el insumo del descuento por
   * múltiples mascotas: sin él, el snapshot registra que hubo un 5% de
   * descuento pero no sobre qué declaración, y la prima deja de ser
   * reproducible ante la Superintendencia.
   */
  petsInPolicy?: number;
}

export interface QuoteCustomer {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface QuoteSnapshot {
  id: string; // UUID v4
  quoteNumber: string; // ej. QTE-2026-XXXXX o QTE-YYYYMMDD-XXXX
  status: QuoteStatus;
  petData: QuotePetData;
  selectedDeductiblePercentage: DeductibleOption;
  selectedAddonKeys: AddonKey[];
  billingFrequency: 'MONTHLY' | 'ANNUAL';
  customer: QuoteCustomer;
  pricingResult?: PricingCalculationResult | null;
  eligibilityResult: EligibilityResult;
  productVersion: string; // PET_STANDARD_v2
  rulesVersion: string; // PET_RULES_v2.0.0
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601, exactamente createdAt + 15 días
  boundAt?: string; // ISO 8601
  rejectionReasons?: string[];
}

export interface IQuotesRepository {
  save(quote: QuoteSnapshot): Promise<QuoteSnapshot>;
  findById(id: string): Promise<QuoteSnapshot | null>;
  findByQuoteNumber(quoteNumber: string): Promise<QuoteSnapshot | null>;
  update(quote: QuoteSnapshot): Promise<QuoteSnapshot>;
}

export const QUOTES_REPOSITORY = 'IQuotesRepository';
