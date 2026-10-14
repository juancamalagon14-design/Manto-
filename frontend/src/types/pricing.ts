export type Species = 'CANINE' | 'FELINE';

/** Sexo biológico. En la interfaz se dice "niño" / "niña". */
export type Gender = 'MALE' | 'FEMALE';

export type SizeCategory = 'TOY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';

export type DeductibleOption = 0.10 | 0.15 | 0.20;

export type City = 'BOGOTA' | 'MEDELLIN' | 'CALI' | 'OTHER';

export type AddonKey =
  | 'COMMON_ILLNESSES'
  | 'PRESCRIPTION_DRUGS'
  | 'PREVENTIVE_WELLNESS'
  | 'CIVIL_LIABILITY_1801'
  | 'FUNERAL_ASSISTANCE'
  | 'TELEMEDICINE'
  | 'OWNER_HOSPITALIZATION_STAY';

export type BillingFrequency = 'MONTHLY' | 'ANNUAL';

/** Raza tal como la sirve el backend. Sin factor actuarial: eso no sale del servidor. */
export interface BreedCatalogEntry {
  code: string;
  name: string;
  species: Species;
  typicalSize: SizeCategory;
  isSpecialHandling: boolean;
  specialHandlingCoverage?: string;
}

export interface MinimumBaselineCoverage {
  code: string;
  name: string;
  description: string;
  annualLimitCop: number;
  copayDeductiblePercentage: number;
  waitingPeriodDays: number;
  sublimitDescription?: string;
  isMandatoryByLaw?: boolean;
}

export interface AddonOption {
  key: AddonKey;
  name: string;
  description: string;
  monthlyPremiumCop: number;
  annualLimitCop: number;
  /** true cuando el amparo es un servicio sin tope monetario (telemedicina). */
  hasNoAnnualLimit?: boolean;
  waitingPeriodDays: number;
  isMandatoryByLaw: boolean;
  /** Si el amparo se liquida con copago del asegurado. */
  copayApplies: boolean;
}

export interface PricingCalculationInput {
  species: Species;
  breedCode: string;
  /** Opcional: si no va, el motor usa el típico de la raza. */
  sizeCategory?: SizeCategory;
  ageInMonths: number;
  city: City;
  /** Obligatorio: o macho o hembra. */
  gender: Gender;
  isSterilized: boolean;
  deductiblePercentage: DeductibleOption;
  selectedAddonKeys: AddonKey[];
  billingFrequency?: BillingFrequency;
  /** Desde 2 aplica el descuento por múltiples mascotas. */
  petsInPolicy?: number;
}

export interface PricingCalculationResult {
  baseMonthlyPremiumCop: number;
  selectedAddonsTotalMonthlyCop: number;
  totalMonthlyPremiumCop: number;
  totalAnnualPremiumCop: number;
  annualDiscountCop: number;
  effectiveDeductiblePercentage: number;
  /** Tamaño con el que el motor tarifó, ya validado contra la raza. */
  effectiveSizeCategory: SizeCategory;
  sterilizationDiscountApplied: boolean;
  multiPetDiscountApplied: boolean;
  mandatoryCivilLiabilityAttached: boolean;
  guaranteedBaselineCoverages: MinimumBaselineCoverage[];
  activeAddons: AddonOption[];
  appliedFactors: {
    basePremiumCop: number;
    speciesFactor: number;
    breedFactor: number;
    sizeFactor: number;
    genderFactor: number;
    ageFactor: number;
    locationFactor: number;
    deductibleFactor: number;
    sterilizationDiscount: number;
    multiPetDiscount: number;
  };
}
