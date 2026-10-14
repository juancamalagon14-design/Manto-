import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import {
  BASE_PREMIUM_COP,
  MULTI_PET_DISCOUNT,
  RCE_LEY_1801_LIMIT_COP,
  RCE_LEY_1801_SMLMV,
  SMLMV_COP,
  STERILIZATION_DISCOUNT,
} from './pricing.constants';
import { PricingCalculationInput } from './pricing.types';

/**
 * Pruebas del motor actuarial.
 *
 * El repositorio no tenía ninguna prueba: `npx jest` reportaba "0 matches"
 * sobre 53 archivos. Se movió `STERILIZATION_DISCOUNT` a 0, se introdujo
 * `GENDER_FACTORS` y se añadió `MULTI_PET_DISCOUNT` sin una sola prueba que
 * fijara el resultado esperado de un caso, y así pasaron sin que nada los
 * detuviera un bypass completo de validación, un copago que no correspondía a
 * la prima cobrada y un amparo legal 13 salarios por debajo del mínimo.
 *
 * Cada prueba de aquí corresponde a un defecto real encontrado y corregido.
 */
describe('PricingService — motor actuarial', () => {
  let service: PricingService;

  /** Caso de referencia: criollo mediano, 3 años, Bogotá, macho, deducible 15%. */
  const caso = (parcial: Partial<PricingCalculationInput> = {}): PricingCalculationInput => ({
    species: 'CANINE',
    breedCode: 'MIXED_BREED_DOG',
    sizeCategory: 'MEDIUM',
    ageInMonths: 36,
    city: 'BOGOTA',
    gender: 'MALE',
    isSterilized: false,
    deductiblePercentage: 0.15,
    selectedAddonKeys: [],
    billingFrequency: 'MONTHLY',
    ...parcial,
  });

  beforeEach(() => {
    service = new PricingService();
  });

  describe('Ley 1801 de 2016 — RCE obligatoria', () => {
    it('el valor asegurado son 50 SMLMV vigentes, no una cifra escrita a mano', () => {
      // El amparo estaba fijo en $65.000.000, que son 50 SMLMV de 2024.
      // Con el SMLMV de 2026 eso equivale a 37,1 salarios: incumplimiento del
      // mínimo legal mientras la descripción seguía diciendo "50 SMLMV".
      expect(Number(RCE_LEY_1801_LIMIT_COP)).toBe(Number(SMLMV_COP) * RCE_LEY_1801_SMLMV);
      expect(Number(RCE_LEY_1801_LIMIT_COP) / Number(SMLMV_COP)).toBe(50);
    });

    it('se anexa sola en una raza de manejo especial, aunque no se pida', () => {
      const r = service.calculateQuote(
        caso({ breedCode: 'ROTTWEILER', sizeCategory: 'LARGE', selectedAddonKeys: [] }),
      );
      expect(r.mandatoryCivilLiabilityAttached).toBe(true);
      expect(r.activeAddons.map((a) => a.key)).toContain('CIVIL_LIABILITY_1801');
    });

    it('no se cobra dos veces si el cliente además la selecciona', () => {
      const r = service.calculateQuote(
        caso({
          breedCode: 'ROTTWEILER',
          sizeCategory: 'LARGE',
          selectedAddonKeys: ['CIVIL_LIABILITY_1801', 'CIVIL_LIABILITY_1801'],
        }),
      );
      const rce = r.activeAddons.filter((a) => a.key === 'CIVIL_LIABILITY_1801');
      expect(rce).toHaveLength(1);
    });

    it('no se anexa en una raza que no es de manejo especial', () => {
      const r = service.calculateQuote(caso());
      expect(r.mandatoryCivilLiabilityAttached).toBe(false);
    });

    it('el amparo obligatorio se emite sin copago', () => {
      const r = service.calculateQuote(caso({ breedCode: 'ROTTWEILER', sizeCategory: 'LARGE' }));
      const rce = r.activeAddons.find((a) => a.key === 'CIVIL_LIABILITY_1801');
      // Cobrar copago sobre el mínimo legal lo reduciría de hecho.
      expect(rce?.copayApplies).toBe(false);
    });
  });

  describe('Copago emitido vs. deducible cobrado', () => {
    it.each([0.1, 0.15, 0.2] as const)(
      'con deducible %s los amparos base se emiten con ese mismo copago',
      (deducible) => {
        // Estaba fijo en 0.15 en el catálogo: quien contrataba el 20% pagaba
        // 12% menos de prima y recibía un contrato con copago del 15%, y quien
        // contrataba el 10% pagaba 15% más por el mismo contrato.
        const r = service.calculateQuote(caso({ deductiblePercentage: deducible }));
        expect(r.effectiveDeductiblePercentage).toBe(deducible);
        for (const cobertura of r.guaranteedBaselineCoverages) {
          expect(cobertura.copayDeductiblePercentage).toBe(deducible);
        }
      },
    );

    it('el deducible más bajo cuesta más que el más alto', () => {
      const bajo = service.calculateQuote(caso({ deductiblePercentage: 0.1 }));
      const alto = service.calculateQuote(caso({ deductiblePercentage: 0.2 }));
      expect(Number(bajo.baseMonthlyPremiumCop)).toBeGreaterThan(
        Number(alto.baseMonthlyPremiumCop),
      );
    });
  });

  describe('Tamaño declarado vs. típico de la raza', () => {
    it('sin tamaño declarado usa el típico de la raza', () => {
      const r = service.calculateQuote(
        caso({ breedCode: 'BULLMASTIFF', sizeCategory: undefined }),
      );
      expect(r.effectiveSizeCategory).toBe('GIANT');
    });

    it('rechaza declarar TOY un Bullmastiff', () => {
      // Esta declaración bajaba la prima un 22% y el tamaño falso quedaba
      // congelado en el snapshot como si fuera un dato verificado.
      expect(() =>
        service.calculateQuote(caso({ breedCode: 'BULLMASTIFF', sizeCategory: 'TOY' })),
      ).toThrow(BadRequestException);
    });

    it('acepta una categoría de diferencia, que es variación real', () => {
      const r = service.calculateQuote(
        caso({ breedCode: 'BULLMASTIFF', sizeCategory: 'LARGE' }),
      );
      expect(r.effectiveSizeCategory).toBe('LARGE');
    });

    it('un tamaño inventado se rechaza en vez de producir un factor NaN', () => {
      expect(() =>
        service.calculateQuote(caso({ sizeCategory: 'NANO' as never })),
      ).toThrow(BadRequestException);
    });
  });

  describe('Descuentos', () => {
    it('desde dos mascotas aplica el 5%', () => {
      const una = service.calculateQuote(caso({ petsInPolicy: 1 }));
      const dos = service.calculateQuote(caso({ petsInPolicy: 2 }));
      expect(dos.multiPetDiscountApplied).toBe(true);
      expect(una.multiPetDiscountApplied).toBe(false);
      expect(Number(dos.baseMonthlyPremiumCop)).toBe(
        Math.round(Number(una.baseMonthlyPremiumCop) * (1 - MULTI_PET_DISCOUNT)),
      );
    });

    it('sin petsInPolicy se asume una sola mascota y no hay descuento', () => {
      const r = service.calculateQuote(caso());
      expect(r.multiPetDiscountApplied).toBe(false);
      expect(r.appliedFactors.multiPetDiscount).toBe(0);
    });

    it('la esterilización ya no descuenta, pero el dato sigue viajando', () => {
      const sin = service.calculateQuote(caso({ isSterilized: false }));
      const con = service.calculateQuote(caso({ isSterilized: true }));
      expect(STERILIZATION_DISCOUNT).toBe(0);
      expect(Number(con.baseMonthlyPremiumCop)).toBe(Number(sin.baseMonthlyPremiumCop));
      expect(con.sterilizationDiscountApplied).toBe(false);
    });

    it('los descuentos se aplican de forma multiplicativa, no aditiva', () => {
      // (1 − d₁) × (1 − d₂). Con dos descuentos del 5% el total es 9,75%, no 10%.
      const r = service.calculateQuote(caso({ petsInPolicy: 3, isSterilized: true }));
      const esperado =
        (1 - STERILIZATION_DISCOUNT) * (1 - MULTI_PET_DISCOUNT);
      expect(r.appliedFactors.sterilizationDiscount).toBe(STERILIZATION_DISCOUNT);
      expect(r.appliedFactors.multiPetDiscount).toBe(MULTI_PET_DISCOUNT);
      expect(esperado).toBeCloseTo(0.95, 10);
    });
  });

  describe('Sexo como factor de tarifa', () => {
    it('es obligatorio: sin sexo se lanza, no se asume 1.0', () => {
      expect(() => service.calculateQuote(caso({ gender: undefined as never }))).toThrow(
        BadRequestException,
      );
    });

    it('el macho paga más que la hembra, con el mismo resto de variables', () => {
      const macho = service.calculateQuote(caso({ gender: 'MALE' }));
      const hembra = service.calculateQuote(caso({ gender: 'FEMALE' }));
      expect(Number(macho.baseMonthlyPremiumCop)).toBeGreaterThan(
        Number(hembra.baseMonthlyPremiumCop),
      );
      expect(hembra.appliedFactors.genderFactor).toBe(1.0);
    });
  });

  describe('Congruencia y aritmética', () => {
    it('rechaza una raza que no existe en el registro', () => {
      expect(() => service.calculateQuote(caso({ breedCode: 'PITBULL' }))).toThrow(
        BadRequestException,
      );
    });

    it('rechaza un pitbull declarado como felino', () => {
      expect(() =>
        service.calculateQuote(
          caso({ species: 'FELINE', breedCode: 'AMERICAN_PIT_BULL_TERRIER' }),
        ),
      ).toThrow(BadRequestException);
    });

    it('base + opcionales es exactamente igual al total', () => {
      const r = service.calculateQuote(
        caso({
          breedCode: 'ROTTWEILER',
          sizeCategory: 'LARGE',
          selectedAddonKeys: ['COMMON_ILLNESSES', 'PRESCRIPTION_DRUGS'],
        }),
      );
      const suma = r.activeAddons.reduce(
        (t, a) => t + Number(a.monthlyPremiumCop),
        Number(r.baseMonthlyPremiumCop),
      );
      expect(suma).toBe(Number(r.totalMonthlyPremiumCop));
      expect(Number(r.selectedAddonsTotalMonthlyCop)).toBe(
        suma - Number(r.baseMonthlyPremiumCop),
      );
    });

    it('la prima anual paga once meses y el descuento es exactamente uno', () => {
      const r = service.calculateQuote(caso());
      expect(Number(r.totalAnnualPremiumCop)).toBe(Number(r.totalMonthlyPremiumCop) * 11);
      expect(Number(r.annualDiscountCop)).toBe(Number(r.totalMonthlyPremiumCop));
    });

    it('todas las primas son pesos enteros', () => {
      const r = service.calculateQuote(caso({ deductiblePercentage: 0.1, petsInPolicy: 3 }));
      for (const valor of [
        r.baseMonthlyPremiumCop,
        r.totalMonthlyPremiumCop,
        r.totalAnnualPremiumCop,
        r.annualDiscountCop,
      ]) {
        expect(typeof valor).toBe('bigint');
      }
    });

    it('la prima crece con la edad dentro del rango asegurable', () => {
      const cachorro = service.calculateQuote(caso({ ageInMonths: 12 }));
      const senior = service.calculateQuote(caso({ ageInMonths: 144 }));
      expect(Number(senior.baseMonthlyPremiumCop)).toBeGreaterThan(
        Number(cachorro.baseMonthlyPremiumCop),
      );
    });

    it('Bogotá es más caro que "otras ciudades"', () => {
      const bogota = service.calculateQuote(caso({ city: 'BOGOTA' }));
      const otra = service.calculateQuote(caso({ city: 'OTHER' }));
      expect(Number(bogota.baseMonthlyPremiumCop)).toBeGreaterThan(
        Number(otra.baseMonthlyPremiumCop),
      );
    });

    it('la base nominal declarada es la que entra en la fórmula', () => {
      const r = service.calculateQuote(caso());
      expect(Number(r.appliedFactors.basePremiumCop)).toBe(Number(BASE_PREMIUM_COP));
    });
  });

  describe('Catálogos servidos al frontend', () => {
    it('el catálogo de razas no expone el factor actuarial', () => {
      const razas = service.getBreedCatalog();
      expect(razas.length).toBeGreaterThan(0);
      for (const raza of razas) {
        expect(raza).not.toHaveProperty('factor');
        const expectedKeys = raza.isSpecialHandling
          ? ['code', 'isSpecialHandling', 'name', 'specialHandlingCoverage', 'species', 'typicalSize'].sort()
          : ['code', 'isSpecialHandling', 'name', 'species', 'typicalSize'].sort();
        expect(Object.keys(raza).sort()).toEqual(expectedKeys);
      }
    });

    it('el catálogo de opcionales trae los topes reales', () => {
      const opcionales = service.getAddonCatalog();
      const medicamentos = opcionales.find((a) => a.key === 'PRESCRIPTION_DRUGS');
      // La interfaz mostraba $1.500.000 cuando la póliza otorga $600.000.
      expect(Number(medicamentos?.annualLimitCop)).toBe(600000);
    });

    it('ningún amparo accesorio se activa antes que el principal del que depende', () => {
      const opcionales = service.getAddonCatalog();
      const enfermedad = opcionales.find((a) => a.key === 'COMMON_ILLNESSES');
      const medicamentos = opcionales.find((a) => a.key === 'PRESCRIPTION_DRUGS');
      // Con 15 días contra 30 quedaba abierta una ventana de antiselección:
      // se reembolsaba la medicación de una patología aún no cubierta.
      expect(medicamentos!.waitingPeriodDays).toBeGreaterThanOrEqual(
        enfermedad!.waitingPeriodDays,
      );
    });

    it('telemedicina se declara sin tope en vez de publicar el centinela 99.999.999', () => {
      const tele = service.getAddonCatalog().find((a) => a.key === 'TELEMEDICINE');
      expect(tele?.hasNoAnnualLimit).toBe(true);
      expect(Number(tele?.annualLimitCop)).not.toBe(99999999);
    });
  });
});
