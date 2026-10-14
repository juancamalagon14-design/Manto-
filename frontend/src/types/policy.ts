import {
  AddonKey,
  City,
  DeductibleOption,
  PricingCalculationResult,
  SizeCategory,
  Species,
} from './pricing';

/**
 * Cotización formal tal como la devuelve POST /v1/quotes.
 *
 * Este tipo describía una forma plana (`totalMonthlyPremiumCop` en la raíz,
 * `status: 'DRAFT' | 'BOUND' | ...`) que el backend nunca ha respondido. Por
 * eso el frontend no podía ver que una cotización venía `REJECTED`: el campo
 * no existía en el tipo. `POST /v1/quotes` responde **201 con
 * `status: 'REJECTED'` y `pricingResult: null`** cuando la mascota no es
 * elegible, así que quien no mire `status` arrastra al cliente al checkout con
 * una cotización que no tiene precio.
 */
export interface QuoteSnapshot {
  id: string;
  quoteNumber: string;
  status: 'DRAFT' | 'OFFERED' | 'BOUND' | 'EXPIRED' | 'REJECTED';
  petData: {
    name: string;
    species: Species;
    breedCode: string;
    sizeCategory?: SizeCategory;
    ageInMonths: number;
    city: City;
    gender: 'MALE' | 'FEMALE';
    isSterilized: boolean;
    petsInPolicy?: number;
  };
  selectedDeductiblePercentage: DeductibleOption;
  selectedAddonKeys: AddonKey[];
  billingFrequency: 'MONTHLY' | 'ANNUAL';
  /** null cuando la cotización fue rechazada por elegibilidad. */
  pricingResult?: PricingCalculationResult | null;
  eligibilityResult: {
    isEligible: boolean;
    rejectionReasons: string[];
  };
  createdAt: string;
  expiresAt: string;
  rejectionReasons?: string[];
}


export interface PolicyCustomer {
  fullName: string;
  email: string;
  phone?: string;
  nationalId?: string;
}

export interface CheckoutPolicyDto {
  quoteId: string;
  customer: PolicyCustomer;
  paymentMethodType?: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PSE' | 'CASH';
  billingFrequency?: 'MONTHLY' | 'ANNUAL';
  autoRenewalEnabled?: boolean;
}

/**
 * Lo que devuelve POST /v1/policies/checkout.
 *
 * Este tipo mentía: declaraba `policyNumber: string`, `startDate` y `endDate`
 * como si el checkout emitiera la póliza. No lo hace. Deja la póliza en
 * `PENDING_PAYMENT` **sin** número, sin vigencia y sin hash de certificado;
 * esos tres campos los escribe `activatePolicy` cuando el pago se confirma.
 *
 * La pantalla anunciaba "¡Póliza Emitida con Éxito!" y "cobertura activa
 * inmediata" sobre esta respuesta, con la caja del número de contrato vacía y
 * el botón de pagar debajo. Afirmarle al consumidor que su mascota está
 * amparada antes de que pague no es un detalle de copia: es una manifestación
 * de cobertura inexistente.
 */
export interface CheckoutResult {
  policy: {
    id: string;
    /** Solo existe cuando la póliza se activa tras el pago. */
    policyNumber?: string;
    status: 'DRAFT' | 'PENDING_PAYMENT' | 'ACTIVE' | 'PENDING_RENEWAL' | 'EXPIRED' | 'CANCELLED';
    monthlyPremiumCop: number;
    annualPremiumCop: number;
    billingFrequency: 'MONTHLY' | 'ANNUAL';
    /** Solo existe cuando la póliza se activa tras el pago. */
    effectiveDate?: string;
    /** Solo existe cuando la póliza se activa tras el pago. */
    expirationDate?: string;
    quoteNumber: string;
  };
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}
