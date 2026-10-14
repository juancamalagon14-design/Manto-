import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { SPECIAL_HANDLING_BREED_CODES } from '../pricing/pricing.constants';
import { PricingModule } from '../pricing/pricing.module';
import { toCop } from '../../common/types/money';
import { BindQuoteDto } from './dto/bind-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuotesController } from './quotes.controller';
import { InMemoryQuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';
import { QUOTES_REPOSITORY, QuoteSnapshot } from './quotes.types';

describe('QuotesModule - Auditoría y Pruebas Adversarias de Seguridad', () => {
  let service: QuotesService;
  let controller: QuotesController;
  let repository: InMemoryQuotesRepository;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EligibilityModule, PricingModule],
      controllers: [QuotesController],
      providers: [
        QuotesService,
        {
          provide: QUOTES_REPOSITORY,
          useClass: InMemoryQuotesRepository,
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
    controller = module.get<QuotesController>(QuotesController);
    repository = module.get<InMemoryQuotesRepository>(QUOTES_REPOSITORY);

    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  afterEach(() => {
    repository.clear();
    jest.useRealTimers();
  });

  // =========================================================================
  // VECTOR 1: EVASIÓN DE LEY 1801 (RCE OBLIGATORIA 50 SMLMV EN MANEJO ESPECIAL)
  // =========================================================================
  describe('Vector 1: Evasión de Ley 1801 (RCE 50 SMLMV Obligatoria)', () => {
    it('debe forzar forzosamente la RCE (50 SMLMV) en todas y cada una de las 15 razas de manejo especial', async () => {
      expect(SPECIAL_HANDLING_BREED_CODES).toHaveLength(15);

      for (const breedCode of SPECIAL_HANDLING_BREED_CODES) {
        // Intento adversario: omitir add-ons enviando selectedAddonKeys vacío
        const dto = plainToInstance(CreateQuoteDto, {
          petName: `Canino-${breedCode}`,
          species: 'CANINE',
          gender: 'MALE',
          breedCode,
          sizeCategory: 'LARGE',
          ageInMonths: 24,
          city: 'BOGOTA',
          isSterilized: false,
          deductiblePercentage: 0.15,
          selectedAddonKeys: [], // Omitido explícitamente por el usuario
        });

        const quote = await service.createQuote(dto);

        expect(quote.status).toBe('OFFERED');
        expect(quote.eligibilityResult.isEligible).toBe(true);
        expect(quote.eligibilityResult.isSpecialHandlingBreed).toBe(true);

        // Validar que el resultado de tarificación forzó RCE por mandato legal
        expect(quote.pricingResult).toBeDefined();
        expect(quote.pricingResult?.mandatoryCivilLiabilityAttached).toBe(true);

        const rceAddon = quote.pricingResult?.activeAddons.find(
          (addon) => addon.key === 'CIVIL_LIABILITY_1801',
        );
        expect(rceAddon).toBeDefined();
        expect(rceAddon?.isMandatoryByLaw).toBe(true);
        // Validar límite de 50 SMLMV (mínimo 65,000,000 COP)
        expect(rceAddon?.annualLimitCop).toBeGreaterThanOrEqual(65_000_000);

        // Validar que el snapshot refleja la inclusión forzosa en selectedAddonKeys
        expect(quote.selectedAddonKeys).toContain('CIVIL_LIABILITY_1801');
      }
    });

    it('debe forzar RCE cuando el usuario selecciona otros add-ons pero intenta omitir CIVIL_LIABILITY_1801', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Tyson',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'AMERICAN_PIT_BULL_TERRIER',
        sizeCategory: 'MEDIUM',
        ageInMonths: 30,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.1,
        selectedAddonKeys: ['PRESCRIPTION_DRUGS', 'FUNERAL_ASSISTANCE'], // Intento de evasión
      });

      const quote = await service.createQuote(dto);

      expect(quote.pricingResult?.mandatoryCivilLiabilityAttached).toBe(true);
      const activeKeys = quote.pricingResult?.activeAddons.map((a) => a.key);
      expect(activeKeys).toContain('PRESCRIPTION_DRUGS');
      expect(activeKeys).toContain('FUNERAL_ASSISTANCE');
      expect(activeKeys).toContain('CIVIL_LIABILITY_1801');

      // Validar costo mensual total: incluye la prima del add-on RCE (15,000 COP)
      const rceCost = quote.pricingResult?.activeAddons.find(
        (a) => a.key === 'CIVIL_LIABILITY_1801',
      )?.monthlyPremiumCop;
      expect(rceCost).toBe(toCop(15000));
    });

    it('debe ser idempotente y no cobrar doble si el usuario ya había incluido CIVIL_LIABILITY_1801', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Thor',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'ROTTWEILER',
        sizeCategory: 'LARGE',
        ageInMonths: 20,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.2,
        selectedAddonKeys: ['CIVIL_LIABILITY_1801'],
      });

      const quote = await service.createQuote(dto);

      const rceOccurrences = quote.pricingResult?.activeAddons.filter(
        (a) => a.key === 'CIVIL_LIABILITY_1801',
      );
      expect(rceOccurrences).toHaveLength(1);
    });

    it('debe rechazar cotización por incongruencia biológica si se intenta registrar una raza de manejo especial como FELINE', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Gato Falso',
        species: 'FELINE',
        breedCode: 'AMERICAN_PIT_BULL_TERRIER', // Raza canina declarada como felino
        sizeCategory: 'MEDIUM',
        ageInMonths: 15,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);

      expect(quote.status).toBe('REJECTED');
      expect(quote.pricingResult).toBeNull();
      expect(quote.rejectionReasons?.some((r) => r.includes('Incongruencia biológica'))).toBe(true);

      // Una cotización rechazada por evasión biológica NO puede ser vinculada
      await expect(
        service.bindQuote(quote.id, { paymentMethodType: 'WOMPI_TOKENIZED_CARD' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no debe forzar RCE obligatoria para razas convencionales no sujetas a Ley 1801', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Lucas',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
        selectedAddonKeys: [],
      });

      const quote = await service.createQuote(dto);

      expect(quote.status).toBe('OFFERED');
      expect(quote.eligibilityResult.isSpecialHandlingBreed).toBe(false);
      expect(quote.pricingResult?.mandatoryCivilLiabilityAttached).toBe(false);
      expect(quote.selectedAddonKeys).not.toContain('CIVIL_LIABILITY_1801');
    });
  });

  // =========================================================================
  // VECTOR 2: MANIPULACIÓN TEMPORAL Y LÍMITES DE VIGENCIA (15 DÍAS)
  // =========================================================================
  describe('Vector 2: Manipulación Temporal y Límites de Vigencia (15 Días Exactos)', () => {
    const fixedBaseTime = new Date('2026-09-01T12:00:00.000Z').getTime();

    it('debe permitir vinculación exitosa a 14 días, 23 horas, 59 minutos y 59 segundos (1 segundo antes del límite)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(fixedBaseTime);

      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Bruno',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'LABRADOR_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 18,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);
      expect(quote.status).toBe('OFFERED');

      // Avanzar el reloj a 14 días + 23h + 59m + 59s (+ 1,295,999,000 ms)
      const justBeforeExpiry = fixedBaseTime + 15 * 24 * 60 * 60 * 1000 - 1000;
      jest.setSystemTime(justBeforeExpiry);

      // getQuoteById debe seguir reportando OFFERED
      const fetchedQuote = await service.getQuoteById(quote.id);
      expect(fetchedQuote.status).toBe('OFFERED');

      // bindQuote debe permitirse exitosamente
      const boundQuote = await service.bindQuote(quote.id, {
        paymentMethodType: 'PSE',
      });
      expect(boundQuote.status).toBe('BOUND');
      expect(boundQuote.boundAt).toBeDefined();
    });

    it('debe rechazar vinculación dinámicamente a los 15 días + 1 segundo (expirado)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(fixedBaseTime);

      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Simba',
        species: 'FELINE',
        gender: 'MALE',
        breedCode: 'PERSIAN',
        sizeCategory: 'SMALL',
        ageInMonths: 24,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.2,
      });

      const quote = await service.createQuote(dto);
      expect(quote.status).toBe('OFFERED');

      // Avanzar el reloj a 15 días + 1 segundo (+ 1,296,001,000 ms)
      const justAfterExpiry = fixedBaseTime + 15 * 24 * 60 * 60 * 1000 + 1000;
      jest.setSystemTime(justAfterExpiry);

      // getQuoteById debe transicionar y persistir como EXPIRED
      const expiredGet = await service.getQuoteById(quote.id);
      expect(expiredGet.status).toBe('EXPIRED');

      // Intento de vinculación debe ser rechazado con BadRequestException
      await expect(
        service.bindQuote(quote.id, { paymentMethodType: 'PSE' }),
      ).rejects.toThrow(BadRequestException);

      // Verificar persistencia de estado EXPIRED en repositorio
      const persisted = await repository.findById(quote.id);
      expect(persisted?.status).toBe('EXPIRED');
    });

    it('debe rechazar vinculación inmediatamente si se intenta en el milisegundo exacto posterior al vencimiento', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(fixedBaseTime);

      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Maya',
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'BEAGLE',
        sizeCategory: 'MEDIUM',
        ageInMonths: 12,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.1,
      });

      const quote = await service.createQuote(dto);

      // Avanzar exactamente 15 días + 1 milisegundo
      const exactPlusOneMs = fixedBaseTime + 15 * 24 * 60 * 60 * 1000 + 1;
      jest.setSystemTime(exactPlusOneMs);

      await expect(
        service.bindQuote(quote.id, { paymentMethodType: 'WOMPI_TOKENIZED_CARD' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe ignorar cualquier intento del cliente de adulterar createdAt o expiresAt en el payload', async () => {
      // Inyección de parámetros temporales en el request
      const maliciousPayload = {
        petName: 'HackerPet',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
        createdAt: '2020-01-01T00:00:00.000Z',
        expiresAt: '2099-12-31T23:59:59.999Z', // Intento de validez eterna
      };

      // ValidationPipe con whitelist y forbidNonWhitelisted debe rechazar campos no definidos en el DTO
      await expect(
        validationPipe.transform(maliciousPayload, {
          type: 'body',
          metatype: CreateQuoteDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // VECTOR 3: CONDICIONES DE CARRERA Y DOBLE VINCULACIÓN (CONCURRENCY MUTEX)
  // =========================================================================
  describe('Vector 3: Condiciones de Carrera y Doble Vinculación Concurrente', () => {
    it('debe permitir exactamente 1 vinculación y rechazar con ConflictException la solicitud concurrente simultánea', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Rocky Concurrente',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'BOXER',
        sizeCategory: 'LARGE',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);
      expect(quote.status).toBe('OFFERED');

      const bindDto1 = plainToInstance(BindQuoteDto, {
        paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        cardToken: 'tok_card_user_A',
      });

      const bindDto2 = plainToInstance(BindQuoteDto, {
        paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        cardToken: 'tok_card_user_B',
      });

      // Ejecutar dos vinculaciones concurrentes en el mismo tick de eventos
      const results = await Promise.allSettled([
        service.bindQuote(quote.id, bindDto1),
        service.bindQuote(quote.id, bindDto2),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactamente una debió ganar la carrera
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // La rechazada debió fallar por Conflicto (409 Conflict)
      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(ConflictException);

      // Validar que el estado final persistido en el repositorio es estrictamente BOUND
      const persisted = await repository.findById(quote.id);
      expect(persisted?.status).toBe('BOUND');
      expect(persisted?.boundAt).toBeDefined();
    });

    it('debe resistir una ráfaga concurrente de 10 peticiones de vinculación simultáneas', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Zeus Burst Test',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'SIBERIAN_HUSKY',
        sizeCategory: 'LARGE',
        ageInMonths: 36,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.1,
      });

      const quote = await service.createQuote(dto);

      // Lanzar 10 solicitudes idénticas en paralelo
      const burstAttempts = Array.from({ length: 10 }, (_, i) =>
        service.bindQuote(quote.id, {
          paymentMethodType: 'WOMPI_TOKENIZED_CARD',
          cardToken: `tok_burst_${i}`,
        }),
      );

      const results = await Promise.allSettled(burstAttempts);

      const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
      const rejectedCount = results.filter((r) => r.status === 'rejected').length;

      expect(fulfilledCount).toBe(1);
      expect(rejectedCount).toBe(9);

      // Todas las rechazadas deben ser de tipo ConflictException
      for (const res of results) {
        if (res.status === 'rejected') {
          expect(res.reason).toBeInstanceOf(ConflictException);
        }
      }

      const finalQuote = await repository.findById(quote.id);
      expect(finalQuote?.status).toBe('BOUND');
    });

    it('debe rechazar vinculaciones subsecuentes una vez la cotización se encuentra en estado BOUND', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Kira',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'SIAMESE',
        sizeCategory: 'SMALL',
        ageInMonths: 18,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);

      // Primera vinculación exitosa
      await service.bindQuote(quote.id, { paymentMethodType: 'PSE' });

      // Segundo intento posterior secuencial
      await expect(
        service.bindQuote(quote.id, { paymentMethodType: 'NEQUI' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // VECTOR 4: VALIDACIÓN DE ENTRADAS ADVERSARIAS Y ROBUSTEZ DE DTOS
  // =========================================================================
  describe('Vector 4: Validación de Entradas Adversarias y Robustez de DTOs', () => {
    it('debe rechazar payloads con inyección de campos no permitidos (Mass Assignment / Whitelist)', async () => {
      const maliciousPayload = {
        petName: 'Bobby',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
        role: 'ADMIN', // Intento de escalada
        status: 'BOUND', // Intento de forzar estado
        discountOverride: 0.99, // Intento de manipulación de prima
        freeCoverage: true,
      };

      await expect(
        validationPipe.transform(maliciousPayload, {
          type: 'body',
          metatype: CreateQuoteDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar edades no enteras (decimales / floats)', async () => {
      const floatAgePayload = {
        petName: 'Decimal Dog',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 12.5, // Edad no entera
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      };

      const dto = plainToInstance(CreateQuoteDto, floatAgePayload);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const ageError = errors.find((e) => e.property === 'ageInMonths');
      expect(ageError?.constraints?.isInt).toBeDefined();
    });

    it('debe rechazar edades negativas o cero', async () => {
      const negativeAgePayload = {
        petName: 'Negative Dog',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: -5,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      };

      const dto = plainToInstance(CreateQuoteDto, negativeAgePayload);
      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'ageInMonths')).toBe(true);
    });

    it('debe rechazar edades fuera del rango legal asegurable (menores a 2 o mayores a 144 meses)', async () => {
      const tooYoungDto = plainToInstance(CreateQuoteDto, {
        petName: 'Newborn',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'SMALL',
        ageInMonths: 1, // Límite inferior violado
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      });

      const errorsYoung = await validate(tooYoungDto);
      expect(errorsYoung.some((e) => e.property === 'ageInMonths')).toBe(true);

      const tooOldDto = plainToInstance(CreateQuoteDto, {
        petName: 'Old Dog',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'SMALL',
        ageInMonths: 145, // Límite superior violado (> 144 meses)
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      });

      const errorsOld = await validate(tooOldDto);
      expect(errorsOld.some((e) => e.property === 'ageInMonths')).toBe(true);
    });

    it('debe admitir mascotas senior de 97, 108, 120 y 144 meses (hasta 12 años)', async () => {
      for (const seniorAge of [97, 108, 120, 144]) {
        const seniorDto = plainToInstance(CreateQuoteDto, {
          petName: 'Senior Dog',
          species: 'CANINE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'SMALL',
          ageInMonths: seniorAge,
          city: 'BOGOTA',
          deductiblePercentage: 0.15,
        });

        const errors = await validate(seniorDto);
        expect(errors.some((e) => e.property === 'ageInMonths')).toBe(false);
      }
    });

    it('debe rechazar especies no válidas (ej. reptiles, roedores o aves)', async () => {
      const invalidSpeciesPayload = {
        petName: 'Reptile',
        species: 'REPTILE',
        breedCode: 'IGUANA',
        sizeCategory: 'SMALL',
        ageInMonths: 12,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      };

      const dto = plainToInstance(CreateQuoteDto, invalidSpeciesPayload);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'species')).toBe(true);
    });

    it('debe rechazar deducibles no permitidos actuarialmente', async () => {
      const invalidDeductiblePayload = {
        petName: 'Can',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        deductiblePercentage: 0.5, // 50% no existe (solo 0.10, 0.15, 0.20)
      };

      const dto = plainToInstance(CreateQuoteDto, invalidDeductiblePayload);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'deductiblePercentage')).toBe(true);
    });

    it('debe rechazar add-ons desconocidos o no catalogados', async () => {
      const invalidAddonPayload = {
        petName: 'Can',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['UNAUTHORIZED_DISCOUNT', 'UNLIMITED_COV'],
      };

      const dto = plainToInstance(CreateQuoteDto, invalidAddonPayload);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'selectedAddonKeys')).toBe(true);
    });

    it('debe rechazar nombres en blanco o compuestos exclusivamente por espacios en blanco', async () => {
      const whitespaceDto = plainToInstance(CreateQuoteDto, {
        petName: '    ',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      });

      const errors = await validate(whitespaceDto);
      expect(errors.some((e) => e.property === 'petName')).toBe(true);
    });

    it('debe almacenar de forma segura strings con cargas útiles de SQLi o XSS sin ejecución ni corrupción', async () => {
      const sqliPayload = {
        petName: "Robert'); DROP TABLE quotes;--",
        species: 'CANINE' as const,
        gender: 'MALE' as const,
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE' as const,
        ageInMonths: 24,
        city: 'BOGOTA' as const,
        isSterilized: true,
        deductiblePercentage: 0.15 as const,
        customerName: "<script>alert('XSS')</script>",
        customerEmail: 'security@example.com',
      };

      const dto = plainToInstance(CreateQuoteDto, sqliPayload);
      const quote = await service.createQuote(dto);

      expect(quote.status).toBe('OFFERED');
      // Las cadenas se conservan literalmente como datos inmutables
      expect(quote.petData.name).toBe("Robert'); DROP TABLE quotes;--");
      expect(quote.customer.fullName).toBe("<script>alert('XSS')</script>");

      // Comprobar persistencia segura
      const retrieved = await service.getQuoteById(quote.id);
      expect(retrieved.petData.name).toBe("Robert'); DROP TABLE quotes;--");
    });

    it('debe rechazar campos adicionales maliciosos en BindQuoteDto', async () => {
      const maliciousBindPayload = {
        paymentMethodType: 'PSE',
        role: 'ADMIN',
        boundAt: '2020-01-01T00:00:00.000Z',
        overridePrice: 0,
      };

      await expect(
        validationPipe.transform(maliciousBindPayload, {
          type: 'body',
          metatype: BindQuoteDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // VECTOR 5: INTEGRIDAD DE SNAPSHOT E INMUTABILIDAD DEL REPOSITORIO
  // =========================================================================
  describe('Vector 5: Integridad de Snapshot e Inmutabilidad en Repositorio', () => {
    it('mutar el objeto retornado por createQuote NO debe afectar el registro persistido en el repositorio', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Original Pet',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'FRENCH_BULLDOG',
        sizeCategory: 'SMALL',
        ageInMonths: 24,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);
      const originalPremium = quote.pricingResult?.totalMonthlyPremiumCop;

      // Intento de manipulación en memoria del cliente / llamador
      quote.status = 'BOUND';
      quote.petData.name = 'Tampered Pet Name';
      if (quote.pricingResult) {
        quote.pricingResult.totalMonthlyPremiumCop = toCop(0);
      }

      // Consultar el repositorio directamente
      const persisted = await repository.findById(quote.id);

      expect(persisted).not.toBeNull();
      expect(persisted?.status).toBe('OFFERED'); // Permanece OFFERED
      expect(persisted?.petData.name).toBe('Original Pet'); // Permanece intacto
      expect(persisted?.pricingResult?.totalMonthlyPremiumCop).toBe(originalPremium); // Prima inalterada
    });

    it('mutar el objeto obtenido mediante findById NO debe alterar consultas posteriores', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Luna',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 12,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.2,
        selectedAddonKeys: ['TELEMEDICINE'],
      });

      const quote = await service.createQuote(dto);

      // Primera lectura
      const read1 = await repository.findById(quote.id);
      expect(read1).not.toBeNull();
      expect(read1?.pricingResult?.activeAddons.length).toBe(1);

      // Mutación profunda de arreglos y propiedades anidadas
      read1!.petData.breedCode = 'TAMPERED_BREED';
      read1!.pricingResult!.activeAddons.length = 0; // Vaciar add-ons en la referencia local

      // Segunda lectura independiente
      const read2 = await repository.findById(quote.id);
      expect(read2?.petData.breedCode).toBe('MIXED_BREED_CAT');
      expect(read2?.pricingResult?.activeAddons.length).toBe(1); // Mantiene el add-on intacto
      expect(read2?.petData.breedCode).not.toBe('TAMPERED_BREED');
    });

    it('findByQuoteNumber debe proveer un snapshot clonado e inmutable', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Milo',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'POODLE',
        sizeCategory: 'SMALL',
        ageInMonths: 18,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);

      const byNumber1 = await repository.findByQuoteNumber(quote.quoteNumber);
      expect(byNumber1).not.toBeNull();
      byNumber1!.status = 'REJECTED';

      const byNumber2 = await repository.findByQuoteNumber(quote.quoteNumber);
      expect(byNumber2?.status).toBe('OFFERED');
    });

    it('actualizaciones legítimas deben clonar el estado y proteger contra mutaciones concurrentes', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Chester',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'PUG',
        sizeCategory: 'SMALL',
        ageInMonths: 36,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.1,
      });

      const quote = await service.createQuote(dto);

      const updatePayload: QuoteSnapshot = {
        ...quote,
        status: 'BOUND',
        boundAt: new Date().toISOString(),
      };

      const updated = await repository.update(updatePayload);

      // Mutar updatePayload después del update
      updatePayload.status = 'EXPIRED';

      expect(updated.status).toBe('BOUND');
      const retrieved = await repository.findById(quote.id);
      expect(retrieved?.status).toBe('BOUND');
    });
  });
});
