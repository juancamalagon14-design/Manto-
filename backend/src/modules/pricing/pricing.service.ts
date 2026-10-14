import { Injectable, BadRequestException } from '@nestjs/common';
import {
  addCop,
  ColombianPeso,
  multiplyCop,
  toCop,
} from '../../common/types/money';
import {
  ADDONS_CATALOG,
  BreedActuarialProfile,
  BASE_PREMIUM_COP,
  BASELINE_COVERAGES_CATALOG,
  BREED_REGISTRY,
  CITY_FACTORS,
  DEDUCTIBLE_FACTORS,
  GENDER_FACTORS,
  MULTI_PET_DISCOUNT,
  MULTI_PET_DISCOUNT_THRESHOLD,
  RCE_LEY_1801_LIMIT_COP,
  SIZE_FACTORS,
  SPECIAL_HANDLING_BREED_CODES,
  SPECIES_FACTORS,
  STERILIZATION_DISCOUNT,
} from './pricing.constants';
import {
  AddonKey,
  BreedCatalogEntry,
  AddonOption,
  MinimumBaselineCoverage,
  PricingCalculationInput,
  PricingCalculationResult,
  SizeCategory,
} from './pricing.types';

/**
 * Escala de tamaño ordenada. Se usa para medir cuán lejos está el tamaño que
 * declara el cliente del típico de la raza.
 */
const ESCALA_TAMANO: SizeCategory[] = ['TOY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'];

/** Cuántas categorías de distancia se aceptan respecto al típico de una raza pura. */
const TOLERANCIA_TAMANO = 1;

/**
 * Razas sin tamaño típico fiable: el tamaño lo declara el tomador y se acepta
 * completo. Un criollo colombiano va de un chandoso de 4 kilos a un mestizo de
 * mastín; exigirle ±1 categoría respecto a MEDIUM rechazaba declaraciones
 * honestas en los dos extremos.
 */
const RAZAS_SIN_TAMANO_TIPICO = new Set(['MIXED_BREED_DOG', 'MIXED_BREED_CAT']);

@Injectable()
export class PricingService {
  /**
   * Resuelve el factor actuarial de edad en meses.
   * Regla de suscripción: Ingreso admitido entre 2 meses (8 semanas) y 144 meses (12 años).
   */
  public resolveAgeFactor(ageInMonths: number): number {
    if (ageInMonths < 2 || ageInMonths > 144) {
      throw new BadRequestException(
        `Edad fuera del rango asegurable (2 a 144 meses). Recibido: ${ageInMonths} meses.`,
      );
    }
    if (ageInMonths <= 12) {
      return 0.95; // Cachorros con menor siniestralidad crónica (2 a 12 meses)
    }
    if (ageInMonths <= 36) {
      return 1.0; // Adultos jóvenes (13 a 36 meses)
    }
    if (ageInMonths <= 72) {
      return 1.1; // Adultos plenos (37 a 72 meses)
    }
    if (ageInMonths <= 96) {
      return 1.3; // Adultos maduros (73 a 96 meses, 6 a 8 años)
    }
    if (ageInMonths <= 120) {
      return 1.6; // Senior Inicial (97 a 120 meses, 8 a 10 años)
    }
    return 1.9; // Senior Avanzado / Geriátrico (121 a 144 meses, 10 a 12 años)
  }

  /**
   * Catálogo de razas asegurables para la interfaz.
   *
   * Devuelve solo lo que el frontend necesita para dejar elegir: código, nombre,
   * especie, tamaño típico, si es de manejo especial y cobertura de RCE bajo Ley 1801.
   * NO expone `factor`, que es información actuarial interna y no tiene por qué viajar al navegador.
   */
  public getBreedCatalog(): BreedCatalogEntry[] {
    const razas: BreedActuarialProfile[] = Object.values(BREED_REGISTRY);
    return razas
      .map((b) => ({
        code: b.code,
        name: b.name,
        species: b.species,
        typicalSize: b.typicalSize,
        isSpecialHandling: b.isSpecialHandling,
        ...(b.isSpecialHandling
          ? { specialHandlingCoverage: String(RCE_LEY_1801_LIMIT_COP) }
          : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /**
   * Retorna la lista oficial de códigos de razas de manejo especial bajo Ley 1801 de 2016
   * (Art. 127 y ss. del Código Nacional de Seguridad y Convivencia Ciudadana).
   */
  public getSpecialHandlingBreeds(): string[] {
    return [...SPECIAL_HANDLING_BREED_CODES];
  }

  /**
   * Catálogo de coberturas opcionales, con los topes y carencias que realmente se emiten.
   */
  public getAddonCatalog(): AddonOption[] {
    return Object.values(ADDONS_CATALOG);
  }

  /**
   * Calcula la tarifa base y la cotización total personalizada con add-ons.
   */
  public calculateQuote(input: PricingCalculationInput): PricingCalculationResult {
    // 1. Validar y recuperar perfil de raza
    const breed = BREED_REGISTRY[input.breedCode];
    if (!breed) {
      throw new BadRequestException(`Código de raza no reconocido: ${input.breedCode}`);
    }

    if (breed.species !== input.species) {
      throw new BadRequestException(
        `La raza ${breed.name} no corresponde a la especie ${input.species}.`,
      );
    }

    // 2. Factores actuariales con validación defensiva en frontera
    const speciesFactor = SPECIES_FACTORS[input.species];
    if (speciesFactor === undefined) {
      throw new BadRequestException(
        `Especie no válida: ${input.species}. Debe ser CANINE o FELINE.`,
      );
    }
    const breedFactor = breed.factor;
    const effectiveSizeCategory = this.resolveSizeCategory(input.sizeCategory, breed);
    const sizeFactor = SIZE_FACTORS[effectiveSizeCategory];
    const genderFactor = GENDER_FACTORS[input.gender];
    if (genderFactor === undefined) {
      throw new BadRequestException(
        `Sexo no reconocido: ${input.gender}. Debe ser MALE o FEMALE.`,
      );
    }
    const ageFactor = this.resolveAgeFactor(input.ageInMonths);
    const locationFactor = CITY_FACTORS[input.city];
    if (locationFactor === undefined) {
      throw new BadRequestException(
        `Ciudad no válida: ${input.city}. Debe ser BOGOTA, MEDELLIN, CALI u OTHER.`,
      );
    }
    const deductibleFactor = DEDUCTIBLE_FACTORS[input.deductiblePercentage];
    if (deductibleFactor === undefined) {
      throw new BadRequestException(
        `Porcentaje de deducible / copago no válido: ${input.deductiblePercentage}. Debe ser 0.10, 0.15 o 0.20.`,
      );
    }
    const sterilizationDiscount = input.isSterilized ? STERILIZATION_DISCOUNT : 0.0;

    // Descuento por dos o más mascotas del mismo titular.
    const petsInPolicy = input.petsInPolicy ?? 1;
    const multiPetDiscountApplied = petsInPolicy >= MULTI_PET_DISCOUNT_THRESHOLD;
    const multiPetDiscount = multiPetDiscountApplied ? MULTI_PET_DISCOUNT : 0.0;

    // 3. Fórmula Actuarial Determinista:
    // TarifaBase = BaseNominal * F_especie * F_raza * F_tamaño * F_edad * F_ubicacion * F_deducible * (1 - D_esterilizado)
    const combinedFactor =
      speciesFactor *
      breedFactor *
      sizeFactor *
      genderFactor *
      ageFactor *
      locationFactor *
      deductibleFactor *
      (1 - sterilizationDiscount) *
      (1 - multiPetDiscount);

    const baseMonthlyPremiumCop = multiplyCop(BASE_PREMIUM_COP, combinedFactor);

    // 4. Gestión de Add-ons y Ley 1801 (Manejo Especial Canino)
    const activeAddonKeys = new Set<AddonKey>(input.selectedAddonKeys || []);
    let mandatoryCivilLiabilityAttached = false;

    if (breed.isSpecialHandling) {
      // Obligatorio por Ley 1801 de 2016 (50 SMLMV)
      activeAddonKeys.add('CIVIL_LIABILITY_1801');
      mandatoryCivilLiabilityAttached = true;
    }

    const activeAddons: AddonOption[] = Array.from(activeAddonKeys).map((key) => {
      const addon = ADDONS_CATALOG[key];
      if (!addon) {
        throw new BadRequestException(`Add-on no reconocido: ${key}`);
      }
      return addon;
    });

    const selectedAddonsTotalMonthlyCop = addCop(
      ...activeAddons.map((addon) => addon.monthlyPremiumCop),
    );

    // 5. Total mensual y anual
    const totalMonthlyPremiumCop = addCop(baseMonthlyPremiumCop, selectedAddonsTotalMonthlyCop);

    // Frecuencia anual: 1 mes de descuento (paga 11 meses en lugar de 12)
    const totalAnnualWithoutDiscount = multiplyCop(totalMonthlyPremiumCop, 12);
    const totalAnnualPremiumCop = multiplyCop(totalMonthlyPremiumCop, 11);
    const annualDiscountCop = (totalAnnualWithoutDiscount - totalAnnualPremiumCop) as ColombianPeso;

    // 6. Configuración de Coberturas Mínimas Garantizadas con sublímites específicos
    // El copago que se emite en cada amparo ES el deducible contratado. Estaba
    // fijo en 0.15 en el catálogo, así que quien contrataba el tramo del 20%
    // pagaba 12% menos de prima y recibía un contrato con copago del 15%
    // (pérdida para la aseguradora), y quien contrataba el 10% pagaba 15% más
    // y recibía el mismo contrato del 15% (perjuicio al cliente).
    const guaranteedBaselineCoverages: MinimumBaselineCoverage[] = BASELINE_COVERAGES_CATALOG.map(
      (coverage) => ({
        ...coverage,
        copayDeductiblePercentage: input.deductiblePercentage,
        sublimitDescription: breed.fenotipoSublimitNote,
      }),
    );

    return {
      baseMonthlyPremiumCop,
      selectedAddonsTotalMonthlyCop,
      totalMonthlyPremiumCop,
      totalAnnualPremiumCop,
      annualDiscountCop,
      effectiveDeductiblePercentage: input.deductiblePercentage,
      effectiveSizeCategory,
      sterilizationDiscountApplied: input.isSterilized && STERILIZATION_DISCOUNT > 0,
      multiPetDiscountApplied,
      mandatoryCivilLiabilityAttached,
      guaranteedBaselineCoverages,
      activeAddons,
      appliedFactors: {
        basePremiumCop: BASE_PREMIUM_COP,
        speciesFactor,
        breedFactor,
        sizeFactor,
        genderFactor,
        ageFactor,
        locationFactor,
        deductibleFactor,
        sterilizationDiscount,
        multiPetDiscount,
      },
    };
  }

  /**
   * Versión pública de `resolveSizeCategory`, para que quien arma el snapshot
   * guarde el tamaño con el que realmente se tarifó y no el que declaró el
   * cliente. Devuelve undefined si la raza no existe en el registro y no se
   * declaró nada: en ese caso la cotización se rechaza por elegibilidad y no
   * hay ningún tamaño que inventar.
   */
  public resolveEffectiveSizeCategory(
    breedCode: string,
    declarada?: SizeCategory,
  ): SizeCategory | undefined {
    const breed = BREED_REGISTRY[breedCode];
    if (!breed) return declarada;
    return this.resolveSizeCategory(declarada, breed);
  }

  /**
   * Resuelve la categoría de tamaño con la que se va a tarifar.
   *
   * `sizeCategory` llegaba del cliente sin comparar nunca contra el registro
   * actuarial, aunque `BREED_REGISTRY` ya trae `typicalSize`. Declarar TOY un
   * Bullmastiff (típico GIANT) bajaba la prima un 22% y ese tamaño quedaba
   * congelado en el snapshot como si fuera un dato verificado.
   *
   * No se ignora lo que declara el cliente, porque hay variación real dentro
   * de una misma raza y los mestizos no tienen tamaño típico fiable. Se acepta
   * a una categoría de distancia y se rechaza más allá.
   */
  private resolveSizeCategory(
    declarada: SizeCategory | undefined,
    breed: BreedActuarialProfile,
  ): SizeCategory {
    if (!declarada) return breed.typicalSize;
    if (declarada === breed.typicalSize) return declarada;

    const iDeclarada = ESCALA_TAMANO.indexOf(declarada);
    const iTipica = ESCALA_TAMANO.indexOf(breed.typicalSize);
    if (iDeclarada < 0) {
      throw new BadRequestException(`Categoría de tamaño no reconocida: ${declarada}`);
    }

    // En un mestizo el tamaño no se puede contrastar contra nada.
    if (RAZAS_SIN_TAMANO_TIPICO.has(breed.code)) return declarada;

    const distancia = Math.abs(iDeclarada - iTipica);
    if (distancia > TOLERANCIA_TAMANO) {
      throw new BadRequestException(
        `El tamaño declarado (${declarada}) está demasiado lejos del típico de un ${breed.name} ` +
          `(${breed.typicalSize}). Se admite a lo sumo una categoría de diferencia.`,
      );
    }
    return declarada;
  }

}
