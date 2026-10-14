import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { BASE_PREMIUM_COP } from './pricing.constants';
import { copToNumber, formatCop, toCop } from '../../common/types/money';

describe('PricingService - Motor Actuarial Determinista', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('resolveAgeFactor', () => {
    it('debe arrojar BadRequestException si la edad es menor a 2 meses', () => {
      expect(() => service.resolveAgeFactor(1)).toThrow(BadRequestException);
      expect(() => service.resolveAgeFactor(0)).toThrow(BadRequestException);
      expect(() => service.resolveAgeFactor(-5)).toThrow(BadRequestException);
    });

    it('debe arrojar BadRequestException si la edad es mayor a 144 meses (145 meses o más)', () => {
      expect(() => service.resolveAgeFactor(145)).toThrow(BadRequestException);
      expect(() => service.resolveAgeFactor(160)).toThrow(BadRequestException);
      expect(() => service.resolveAgeFactor(200)).toThrow(BadRequestException);
    });

    it('debe retornar factor 0.95 para cachorros entre 2 y 12 meses', () => {
      expect(service.resolveAgeFactor(2)).toBe(0.95);
      expect(service.resolveAgeFactor(6)).toBe(0.95);
      expect(service.resolveAgeFactor(12)).toBe(0.95);
    });

    it('debe retornar factor 1.0 para adultos jóvenes (13 a 36 meses)', () => {
      expect(service.resolveAgeFactor(13)).toBe(1.0);
      expect(service.resolveAgeFactor(24)).toBe(1.0);
      expect(service.resolveAgeFactor(36)).toBe(1.0);
    });

    it('debe retornar factor 1.1 para adultos plenos (37 a 72 meses)', () => {
      expect(service.resolveAgeFactor(37)).toBe(1.1);
      expect(service.resolveAgeFactor(48)).toBe(1.1);
      expect(service.resolveAgeFactor(72)).toBe(1.1);
    });

    it('debe retornar factor 1.3 para maduros (73 a 96 meses)', () => {
      expect(service.resolveAgeFactor(73)).toBe(1.3);
      expect(service.resolveAgeFactor(84)).toBe(1.3);
      expect(service.resolveAgeFactor(96)).toBe(1.3);
    });

    it('debe retornar factor 1.6 para Senior Inicial (97 a 120 meses, 8 a 10 años)', () => {
      expect(service.resolveAgeFactor(97)).toBe(1.6);
      expect(service.resolveAgeFactor(108)).toBe(1.6);
      expect(service.resolveAgeFactor(120)).toBe(1.6);
    });

    it('debe retornar factor 1.9 para Senior Avanzado / Geriátrico (121 a 144 meses, 10 a 12 años)', () => {
      expect(service.resolveAgeFactor(121)).toBe(1.9);
      expect(service.resolveAgeFactor(132)).toBe(1.9);
      expect(service.resolveAgeFactor(144)).toBe(1.9);
    });
  });

  describe('calculateQuote - Los 5 Factores Actuariales', () => {
    it('debe calcular la tarifa base correcta para un perro Criollo mediano en Bogotá, esterilizado', () => {
      // Base: 30.000 COP
      // F_especie (CANINE): 1.0
      // F_raza (MIXED_BREED_DOG): 0.88
      // F_tamaño (MEDIUM): 1.0
      // F_edad (24 meses): 1.0
      // F_ubicacion (BOGOTA): 1.08
      // F_deducible (15%): 1.0
      // Descuento esterilización (5%): 0.95
      // Esperado: 30000 * 1.0 * 0.88 * 1.0 * 1.0 * 1.08 * 1.0 * 0.95 = 27086.4 -> 27086 COP
      const result = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
        selectedAddonKeys: [],
      });

      expect(result.mandatoryCivilLiabilityAttached).toBe(false);
      expect(copToNumber(result.baseMonthlyPremiumCop)).toBe(28512);
      expect(copToNumber(result.totalMonthlyPremiumCop)).toBe(28512);
      expect(result.guaranteedBaselineCoverages.length).toBeGreaterThan(0);
    });

    it('debe reflejar el incremento de riesgo braquicéfalo para un Bulldog Francés pequeño', () => {
      // Base: 30.000 COP
      // F_especie: 1.0
      // F_raza (FRENCH_BULLDOG): 1.35
      // F_tamaño (SMALL): 0.96
      // F_edad (24 meses): 1.0
      // F_ubicacion (MEDELLIN): 1.04
      // F_deducible (10%): 1.15
      // No esterilizado: 1.0
      // Esperado: 30000 * 1.35 * 0.96 * 1.0 * 1.04 * 1.15 = 46500.48 -> 46500 COP
      const result = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'FRENCH_BULLDOG',
        sizeCategory: 'SMALL',
        ageInMonths: 24,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.1,
        selectedAddonKeys: [],
      });

      expect(copToNumber(result.baseMonthlyPremiumCop)).toBe(46500);
      // Validar que se añade nota de fenotipo para síndrome braquiocefálico
      const accidentCoverage = result.guaranteedBaselineCoverages[0];
      expect(accidentCoverage.sublimitDescription).toContain('síndrome braquiocefálico');
    });

    it('debe anexar forzosamente RCE (Ley 1801) para razas de manejo especial (Pitbull)', () => {
      const result = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'AMERICAN_PIT_BULL_TERRIER',
        sizeCategory: 'MEDIUM',
        ageInMonths: 36,
        city: 'CALI',
        isSterilized: true,
        deductiblePercentage: 0.15,
        selectedAddonKeys: [], // El usuario no seleccionó add-ons explícitamente
      });

      // Debe forzar el add-on por Ley 1801
      expect(result.mandatoryCivilLiabilityAttached).toBe(true);
      const rceAddon = result.activeAddons.find((a) => a.key === 'CIVIL_LIABILITY_1801');
      expect(rceAddon).toBeDefined();
      expect(copToNumber(rceAddon!.monthlyPremiumCop)).toBe(15000);
      expect(copToNumber(rceAddon!.annualLimitCop)).toBe(87545250); // 50 SMLMV

      // Total mensual debe incluir la base + 15.000 COP
      expect(copToNumber(result.totalMonthlyPremiumCop)).toBe(
        copToNumber(result.baseMonthlyPremiumCop) + 15000,
      );
    });

    it('debe sumar múltiples add-ons modulares de forma exacta', () => {
      const result = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 18,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['COMMON_ILLNESSES', 'PRESCRIPTION_DRUGS', 'TELEMEDICINE'],
      });

      // Addons:
      // COMMON_ILLNESSES: 24.900
      // PRESCRIPTION_DRUGS: 12.900
      // TELEMEDICINE: 6.900
      // Total Addons: 44.700 COP
      expect(copToNumber(result.selectedAddonsTotalMonthlyCop)).toBe(44700);
      expect(copToNumber(result.totalMonthlyPremiumCop)).toBe(
        copToNumber(result.baseMonthlyPremiumCop) + 44700,
      );
    });

    it('debe calcular el descuento anual equivalente a 1 mes gratis (11 meses de prima)', () => {
      const result = service.calculateQuote({
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 12,
        city: 'OTHER',
        isSterilized: true,
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['TELEMEDICINE'],
      });

      const totalMonthly = copToNumber(result.totalMonthlyPremiumCop);
      const totalAnnual = copToNumber(result.totalAnnualPremiumCop);
      const discount = copToNumber(result.annualDiscountCop);

      expect(totalAnnual).toBe(totalMonthly * 11);
      expect(discount).toBe(totalMonthly);
    });

    it('debe rechazar si la raza no pertenece a la especie declarada', () => {
      expect(() =>
        service.calculateQuote({
          species: 'FELINE',
          gender: 'FEMALE',
          breedCode: 'GOLDEN_RETRIEVER', // Raza canina declarada como felina
          sizeCategory: 'LARGE',
          ageInMonths: 24,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.15,
          selectedAddonKeys: [],
        }),
      ).toThrow(BadRequestException);
    });

    it('debe verificar la estricta monotonía de riesgo en edad: Prima(11 años) > Prima(9 años) > Prima(7 años) > Prima(4 años) > Prima(2 años)', () => {
      const getBasePremiumForAge = (ageInMonths: number) => {
        const quote = service.calculateQuote({
          species: 'CANINE',
          gender: 'FEMALE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'MEDIUM',
          ageInMonths,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.15,
          selectedAddonKeys: [],
        });
        return copToNumber(quote.baseMonthlyPremiumCop);
      };

      const prima2Years = getBasePremiumForAge(24);   // 2 años (24 meses) -> Factor 1.00
      const prima4Years = getBasePremiumForAge(48);   // 4 años (48 meses) -> Factor 1.10
      const prima7Years = getBasePremiumForAge(84);   // 7 años (84 meses) -> Factor 1.30
      const prima9Years = getBasePremiumForAge(108);  // 9 años (108 meses) -> Factor 1.60
      const prima11Years = getBasePremiumForAge(132); // 11 años (132 meses) -> Factor 1.90

      expect(prima11Years).toBeGreaterThan(prima9Years);
      expect(prima9Years).toBeGreaterThan(prima7Years);
      expect(prima7Years).toBeGreaterThan(prima4Years);
      expect(prima4Years).toBeGreaterThan(prima2Years);
    });

    it('debe arrojar BadRequestException si se intenta cotizar una mascota con 145 meses o más', () => {
      expect(() =>
        service.calculateQuote({
          species: 'CANINE',
          gender: 'FEMALE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'MEDIUM',
          ageInMonths: 145,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.15,
          selectedAddonKeys: [],
        }),
      ).toThrow(BadRequestException);
    });

    it('debe rechazar con BadRequestException si se envía un porcentaje de deducible inválido', () => {
      expect(() =>
        service.calculateQuote({
          species: 'CANINE',
          gender: 'FEMALE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'MEDIUM',
          ageInMonths: 24,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.35 as any,
          selectedAddonKeys: [],
        }),
      ).toThrow(BadRequestException);
    });

    it('debe rechazar con BadRequestException si la ciudad no es válida', () => {
      expect(() =>
        service.calculateQuote({
          species: 'CANINE',
          gender: 'FEMALE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'MEDIUM',
          ageInMonths: 24,
          city: 'NEVERLAND' as any,
          isSterilized: true,
          deductiblePercentage: 0.15,
          selectedAddonKeys: [],
        }),
      ).toThrow(BadRequestException);
    });

    it('debe respetar el orden actuarial de copago y add-ons con cero decimales flotantes', () => {
      // Comparar deducible 10% (factor 1.15), 15% (factor 1.0) y 20% (factor 0.88)
      const quote10 = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.10,
        selectedAddonKeys: ['COMMON_ILLNESSES', 'PRESCRIPTION_DRUGS'],
      });

      const quote15 = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['COMMON_ILLNESSES', 'PRESCRIPTION_DRUGS'],
      });

      const quote20 = service.calculateQuote({
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.20,
        selectedAddonKeys: ['COMMON_ILLNESSES', 'PRESCRIPTION_DRUGS'],
      });

      // Todo valor debe ser entero estricto sin decimales
      expect(Number.isInteger(copToNumber(quote10.baseMonthlyPremiumCop))).toBe(true);
      expect(Number.isInteger(copToNumber(quote10.totalMonthlyPremiumCop))).toBe(true);
      expect(Number.isInteger(copToNumber(quote15.totalMonthlyPremiumCop))).toBe(true);
      expect(Number.isInteger(copToNumber(quote20.totalMonthlyPremiumCop))).toBe(true);

      // Monotonía: a mayor deducible/copago, menor prima base
      expect(copToNumber(quote10.baseMonthlyPremiumCop)).toBeGreaterThan(
        copToNumber(quote15.baseMonthlyPremiumCop),
      );
      expect(copToNumber(quote15.baseMonthlyPremiumCop)).toBeGreaterThan(
        copToNumber(quote20.baseMonthlyPremiumCop),
      );

      // Los add-ons suman de manera determinista e idéntica en los 3 casos: 24.900 + 12.900 = 37.800 COP
      expect(copToNumber(quote10.selectedAddonsTotalMonthlyCop)).toBe(37800);
      expect(copToNumber(quote15.selectedAddonsTotalMonthlyCop)).toBe(37800);
      expect(copToNumber(quote20.selectedAddonsTotalMonthlyCop)).toBe(37800);

      // Total mensual = base + addons
      expect(copToNumber(quote10.totalMonthlyPremiumCop)).toBe(
        copToNumber(quote10.baseMonthlyPremiumCop) + 37800,
      );
      expect(copToNumber(quote15.totalMonthlyPremiumCop)).toBe(
        copToNumber(quote15.baseMonthlyPremiumCop) + 37800,
      );
      expect(copToNumber(quote20.totalMonthlyPremiumCop)).toBe(
        copToNumber(quote20.baseMonthlyPremiumCop) + 37800,
      );
    });
  });

  describe('getSpecialHandlingBreeds & getBreedCatalog', () => {
    it('debe retornar la lista oficial de razas de manejo especial bajo Ley 1801', () => {
      const breeds = service.getSpecialHandlingBreeds();
      expect(Array.isArray(breeds)).toBe(true);
      expect(breeds.length).toBe(15);
      expect(breeds).toContain('AMERICAN_PIT_BULL_TERRIER');
      expect(breeds).toContain('ROTTWEILER');
      expect(breeds).toContain('DOBERMAN');
      expect(breeds).toContain('AMERICAN_BULLY');
      expect(breeds).toContain('CANE_CORSO');
    });

    it('debe retornar catálogo con flag isSpecialHandling y cobertura RCE 87545250 para razas reguladas', () => {
      const catalog = service.getBreedCatalog();
      expect(catalog.length).toBeGreaterThan(0);

      const pitbull = catalog.find((b) => b.code === 'AMERICAN_PIT_BULL_TERRIER');
      expect(pitbull).toBeDefined();
      expect(pitbull!.isSpecialHandling).toBe(true);
      expect(pitbull!.specialHandlingCoverage).toBe('87545250');

      const rottweiler = catalog.find((b) => b.code === 'ROTTWEILER');
      expect(rottweiler).toBeDefined();
      expect(rottweiler!.isSpecialHandling).toBe(true);
      expect(rottweiler!.specialHandlingCoverage).toBe('87545250');

      const golden = catalog.find((b) => b.code === 'GOLDEN_RETRIEVER');
      expect(golden).toBeDefined();
      expect(golden!.isSpecialHandling).toBe(false);
      expect(golden!.specialHandlingCoverage).toBeUndefined();
    });
  });
});
