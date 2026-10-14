import { ColombianPeso } from '../../common/types/money';

export type Species = 'CANINE' | 'FELINE';

/** Sexo biológico de la mascota. En la interfaz se dice "niño" / "niña". */
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

/**
 * Entrada del catálogo de razas expuesta al frontend.
 * Deliberadamente sin `factor`: la calibración actuarial no sale del servidor.
 */
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
  annualLimitCop: ColombianPeso;
  copayDeductiblePercentage: number;
  waitingPeriodDays: number;
  sublimitDescription?: string;
  isMandatoryByLaw?: boolean;
}

export interface AddonOption {
  key: AddonKey;
  name: string;
  description: string;
  monthlyPremiumCop: ColombianPeso;
  annualLimitCop: ColombianPeso;
  /**
   * true cuando el amparo no tiene tope monetario porque es un servicio y no
   * un reembolso (telemedicina). La interfaz debe decir "sin tope" en vez de
   * mostrar `annualLimitCop`.
   */
  hasNoAnnualLimit?: boolean;
  waitingPeriodDays: number;
  isMandatoryByLaw: boolean;
  /**
   * Si el amparo se liquida con copago del asegurado.
   *
   * Los amparos de reembolso (enfermedad, medicamentos) sí lo llevan, y es el
   * deducible contratado. Los de servicio o asistencia (telemedicina,
   * exequial, guardería) y el de RCE obligatoria no: cobrar copago sobre el
   * amparo que exige la Ley 1801 reduciría de hecho el mínimo legal.
   *
   * Existe porque las coberturas de add-on se emitían en la póliza SIN campo
   * de deducible, y `ClaimsService` liquidaba con un `?? 0.15` inventado.
   */
  copayApplies: boolean;
}

export interface PricingCalculationInput {
  species: Species;
  breedCode: string;
  /**
   * Opcional. Si no llega, el motor toma el `typicalSize` de la raza. Si
   * llega, se acepta a lo sumo una categoría de distancia del típico.
   */
  sizeCategory?: SizeCategory;
  ageInMonths: number;
  city: City;
  /** Sexo. Obligatorio: o macho o hembra, no hay valor neutro. */
  gender: Gender;
  /** Se captura como dato de la póliza. Hoy no descuenta (ver STERILIZATION_DISCOUNT). */
  isSterilized: boolean;
  deductiblePercentage: DeductibleOption;
  selectedAddonKeys: AddonKey[];
  billingFrequency?: 'MONTHLY' | 'ANNUAL';
  /**
   * Cuántas mascotas se aseguran bajo el mismo titular en esta operación.
   * Desde 2 aplica MULTI_PET_DISCOUNT. Por defecto 1.
   */
  petsInPolicy?: number;
}

export interface PricingCalculationResult {
  baseMonthlyPremiumCop: ColombianPeso;
  selectedAddonsTotalMonthlyCop: ColombianPeso;
  totalMonthlyPremiumCop: ColombianPeso;
  totalAnnualPremiumCop: ColombianPeso;
  annualDiscountCop: ColombianPeso;
  effectiveDeductiblePercentage: number;
  /** Categoría de tamaño con la que se tarifó, después de validarla contra la raza. */
  effectiveSizeCategory: SizeCategory;
  sterilizationDiscountApplied: boolean;
  multiPetDiscountApplied: boolean;
  mandatoryCivilLiabilityAttached: boolean;
  guaranteedBaselineCoverages: MinimumBaselineCoverage[];
  activeAddons: AddonOption[];
  appliedFactors: {
    basePremiumCop: ColombianPeso;
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
