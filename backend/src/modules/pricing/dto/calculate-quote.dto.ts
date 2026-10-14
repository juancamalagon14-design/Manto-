import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AddonKey,
  City,
  Gender,
  DeductibleOption,
  PricingCalculationInput,
  SizeCategory,
  Species,
} from '../pricing.types';

export const VALID_SPECIES: Species[] = ['CANINE', 'FELINE'];
export const VALID_GENDERS: Gender[] = ['MALE', 'FEMALE'];

export const VALID_SIZE_CATEGORIES: SizeCategory[] = [
  'TOY',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'GIANT',
];

export const VALID_CITIES: City[] = ['BOGOTA', 'MEDELLIN', 'CALI', 'OTHER'];

export const VALID_DEDUCTIBLES: DeductibleOption[] = [0.1, 0.15, 0.2];

export const VALID_ADDON_KEYS: AddonKey[] = [
  'COMMON_ILLNESSES',
  'PRESCRIPTION_DRUGS',
  'PREVENTIVE_WELLNESS',
  'CIVIL_LIABILITY_1801',
  'FUNERAL_ASSISTANCE',
  'TELEMEDICINE',
  'OWNER_HOSPITALIZATION_STAY',
];

export const EDAD_MIN_MESES = 2;
export const EDAD_MAX_MESES = 144;

/**
 * Entrada de tarifación.
 *
 * Un solo nombre por dato. Este DTO tenía además siete campos alias
 * (`breed`, `size`, `ageMonths`, `age`, `sterilized`, `deductible`, `addons`)
 * validados con `@ValidateIf(o => o.otro === undefined)`, lo que abría un
 * bypass completo de validación: enviando el campo canónico Y su alias a la
 * vez, las dos condiciones daban falso y **ninguno de los dos se validaba**.
 *
 * Con `{"deductiblePercentage": 0, "deductible": 0}` el motor respondía 200 y
 * congelaba un copago del 0% cobrado al precio del 15%. Con
 * `{"sizeCategory": "NANO", "size": "MEDIUM"}` se llegaba a un factor NaN.
 *
 * Los alias existían "por compatibilidad" y no tenían ningún cliente: el
 * frontend siempre usó los nombres canónicos. Al eliminarlos, y con
 * `forbidNonWhitelisted: true` activo en `main.ts`, cualquier cliente que
 * mande un alias recibe un 400 explícito en vez de saltarse la validación.
 */
export class CalculateQuoteDto {
  /**
   * Especie. Acepta las formas coloquiales del cliente ('perro', 'dog') y las
   * normaliza, pero el valor resultante se valida siempre.
   */
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      if (upper === 'DOG' || upper === 'PERRO') return 'CANINE';
      if (upper === 'CAT' || upper === 'GATO') return 'FELINE';
      return upper;
    }
    return value;
  })
  @IsNotEmpty({ message: 'La especie es obligatoria (CANINE o FELINE)' })
  @IsIn(VALID_SPECIES, { message: 'La especie debe ser CANINE o FELINE' })
  species: Species;

  /** Sexo. Obligatorio: entra como factor de tarifa. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsNotEmpty({ message: 'El sexo de la mascota es obligatorio (MALE o FEMALE)' })
  @IsIn(VALID_GENDERS, { message: 'El sexo debe ser MALE o FEMALE' })
  gender: Gender;

  /**
   * Cuántas mascotas se aseguran bajo el mismo titular en esta operación.
   * Desde 2 aplica el descuento por múltiples mascotas. Por defecto 1.
   *
   * Es declaración del tomador. Al emitir la póliza debe verificarse contra
   * las pólizas efectivamente vinculadas; mientras es cotización, se acepta.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad de mascotas debe ser un número entero' })
  @Min(1, { message: 'Debe asegurarse al menos una mascota' })
  @Max(10, { message: 'Máximo 10 mascotas por operación' })
  petsInPolicy?: number;

  /** Código actuarial de la raza, tal como lo sirve GET /v1/pricing/breeds. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsNotEmpty({ message: 'El código de raza es obligatorio' })
  @IsString({ message: 'El código de raza debe ser una cadena de texto' })
  breedCode: string;

  /**
   * Categoría de tamaño. Opcional: si no llega, el motor toma el
   * `typicalSize` de la raza. Si llega, el motor la acepta solo a una
   * categoría de distancia del típico de la raza — declarar TOY un Bullmastiff
   * abarataba la prima un 22%.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(VALID_SIZE_CATEGORIES, {
    message: 'La categoría de tamaño debe ser TOY, SMALL, MEDIUM, LARGE o GIANT',
  })
  sizeCategory?: SizeCategory;

  /** Edad en meses. Rango de nuevo ingreso: 2 a 144. */
  @Type(() => Number)
  @IsNotEmpty({ message: 'La edad en meses es obligatoria' })
  @IsInt({ message: 'La edad en meses debe ser un número entero' })
  @Min(EDAD_MIN_MESES, { message: 'La edad mínima asegurable es de 2 meses' })
  @Max(EDAD_MAX_MESES, {
    message: 'La edad máxima asegurable para nuevo ingreso es de 144 meses (12 años)',
  })
  ageInMonths: number;

  /**
   * Ciudad tarifaria.
   *
   * La normalización solo quita tildes y mayúsculas. Antes terminaba en
   * `return 'OTHER'`, así que cualquier texto libre no reconocido
   * ("Bogotá D.C.", "Suba", "Bogota, Cundinamarca") caía en el factor **más
   * barato** del catálogo: −12% sobre la ciudad más costosa de la cartera.
   * Ahora el valor no reconocido pasa tal cual y `@IsIn` lo rechaza.
   */
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    return value;
  })
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @IsIn(VALID_CITIES, {
    message: 'La ciudad debe ser BOGOTA, MEDELLIN, CALI u OTHER',
  })
  city: City;

  /**
   * Esterilización. Se captura como dato de la póliza; hoy no descuenta
   * (ver `STERILIZATION_DISCOUNT` en pricing.constants.ts).
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'isSterilized debe ser un valor booleano' })
  isSterilized?: boolean;

  /**
   * Deducible contratado. Acepta decimal (0.10) o porcentual entero (10).
   * Obligatorio y validado siempre: es el dato que fija tanto el factor de
   * prima como el copago que se emite en cada amparo.
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    return num > 1 ? Number((num / 100).toFixed(2)) : num;
  })
  @IsNotEmpty({ message: 'El deducible es obligatorio (0.10, 0.15 o 0.20)' })
  @IsIn(VALID_DEDUCTIBLES, {
    message: 'El deducible debe ser 0.10 (10%), 0.15 (15%) o 0.20 (20%)',
  })
  deductiblePercentage: DeductibleOption;

  /** Coberturas opcionales elegidas. La RCE de Ley 1801 la anexa el motor. */
  @IsOptional()
  @IsArray({ message: 'selectedAddonKeys debe ser un arreglo de claves de add-ons' })
  @IsIn(VALID_ADDON_KEYS, {
    each: true,
    message: 'Uno o más add-ons seleccionados no son válidos',
  })
  selectedAddonKeys?: AddonKey[] = [];

  /** Frecuencia de cobro. Anual incluye un mes de descuento. */
  @IsOptional()
  @IsIn(['MONTHLY', 'ANNUAL'], {
    message: 'La frecuencia de facturación debe ser MONTHLY o ANNUAL',
  })
  billingFrequency?: 'MONTHLY' | 'ANNUAL' = 'MONTHLY';

  public toPricingCalculationInput(): PricingCalculationInput {
    return {
      species: this.species,
      gender: this.gender,
      petsInPolicy: this.petsInPolicy,
      breedCode: this.breedCode,
      sizeCategory: this.sizeCategory,
      ageInMonths: this.ageInMonths,
      city: this.city,
      isSterilized: this.isSterilized === true,
      deductiblePercentage: this.deductiblePercentage,
      selectedAddonKeys: this.selectedAddonKeys ?? [],
      billingFrequency: this.billingFrequency ?? 'MONTHLY',
    };
  }
}
