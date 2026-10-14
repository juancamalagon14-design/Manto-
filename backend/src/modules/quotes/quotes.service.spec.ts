import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { PricingModule } from '../pricing/pricing.module';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { InMemoryQuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';
import { QUOTES_REPOSITORY, QuoteSnapshot } from './quotes.types';
import { plainToInstance } from 'class-transformer';

describe('QuotesService', () => {
  let service: QuotesService;
  let repository: InMemoryQuotesRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EligibilityModule, PricingModule],
      providers: [
        QuotesService,
        {
          provide: QUOTES_REPOSITORY,
          useClass: InMemoryQuotesRepository,
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
    repository = module.get<InMemoryQuotesRepository>(QUOTES_REPOSITORY);
  });

  afterEach(() => {
    repository.clear();
  });

  it('debe estar definido e inicializar el repositorio y servicios dependientes', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
  });

  describe('createQuote', () => {
    it('debe generar una cotización exitosa en estado OFFERED para una mascota elegible', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Lucas',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['PRESCRIPTION_DRUGS'],
        billingFrequency: 'MONTHLY',
        customerName: 'Carlos Gómez',
        customerEmail: 'carlos@example.com',
        customerPhone: '+573001234567',
      });

      const quote = await service.createQuote(dto);

      expect(quote).toBeDefined();
      expect(quote.id).toBeDefined();
      expect(quote.quoteNumber).toMatch(/^QTE-\d{8}-[A-Z0-9]+$/);
      expect(quote.status).toBe('OFFERED');
      expect(quote.productVersion).toBe('PET_STANDARD_v2');
      expect(quote.rulesVersion).toBe('PET_RULES_v2.0.0');

      // Validar vigencia inmutable de 15 días calendario
      const createdTime = new Date(quote.createdAt).getTime();
      const expiresTime = new Date(quote.expiresAt).getTime();
      const differenceDays = (expiresTime - createdTime) / (1000 * 60 * 60 * 24);
      expect(differenceDays).toBeCloseTo(15, 2);

      // Validar datos de la mascota
      expect(quote.petData.name).toBe('Lucas');
      expect(quote.petData.breedCode).toBe('MIXED_BREED_DOG');
      expect(quote.petData.isSterilized).toBe(true);

      // Validar resultado congelado de tarificación y elegibilidad
      expect(quote.eligibilityResult.isEligible).toBe(true);
      expect(quote.pricingResult).toBeDefined();
      expect(quote.pricingResult?.totalMonthlyPremiumCop).toBeDefined();
      expect(quote.pricingResult?.sterilizationDiscountApplied).toBe(false);

      // Validar persistencia en repositorio
      const persisted = await repository.findById(quote.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.quoteNumber).toBe(quote.quoteNumber);
    });

    it('debe admitir y cotizar mascotas senior (120 y 144 meses) con recargo actuarial', async () => {
      const seniorDto = plainToInstance(CreateQuoteDto, {
        petName: 'Senior Pet',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 120, // 10 años
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(seniorDto);
      expect(quote.status).toBe('OFFERED');
      expect(quote.eligibilityResult.isEligible).toBe(true);
      expect(quote.pricingResult?.appliedFactors.ageFactor).toBe(1.6);

      const geriatricDto = plainToInstance(CreateQuoteDto, {
        petName: 'Geriatric Pet',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 144, // 12 años límite máximo
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const quoteGeriatric = await service.createQuote(geriatricDto);
      expect(quoteGeriatric.status).toBe('OFFERED');
      expect(quoteGeriatric.eligibilityResult.isEligible).toBe(true);
      expect(quoteGeriatric.pricingResult?.appliedFactors.ageFactor).toBe(1.9);
    });

    it('debe generar una cotización en estado REJECTED sin cálculo de prima cuando la mascota no es elegible', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Firulais Cachorro',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'SMALL',
        ageInMonths: 1, // Menor a 2 meses (no elegible)
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.15,
        billingFrequency: 'MONTHLY',
      });

      const quote = await service.createQuote(dto);

      expect(quote).toBeDefined();
      expect(quote.status).toBe('REJECTED');
      expect(quote.pricingResult).toBeNull();
      expect(quote.rejectionReasons).toBeDefined();
      expect(quote.rejectionReasons?.length).toBeGreaterThan(0);
      expect(quote.rejectionReasons?.[0]).toContain('mínimo 2 meses');
      expect(quote.eligibilityResult.isEligible).toBe(false);

      // Validar que se guardó en el repositorio para trazabilidad
      const persisted = await repository.findById(quote.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.status).toBe('REJECTED');
    });

    it('debe incluir RCE obligatoria por Ley 1801 para razas de manejo especial', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Rocky',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'AMERICAN_PIT_BULL_TERRIER',
        sizeCategory: 'LARGE',
        ageInMonths: 30,
        city: 'CALI',
        isSterilized: true,
        deductiblePercentage: 0.1,
      });

      const quote = await service.createQuote(dto);

      expect(quote.status).toBe('OFFERED');
      expect(quote.pricingResult?.mandatoryCivilLiabilityAttached).toBe(true);
      expect(quote.eligibilityResult.isSpecialHandlingBreed).toBe(true);
    });
  });

  describe('getQuoteById', () => {
    it('debe retornar la cotización existente', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Misi',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 12,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.2,
      });

      const created = await service.createQuote(dto);
      const retrieved = await service.getQuoteById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.status).toBe('OFFERED');
    });

    it('debe lanzar NotFoundException cuando la cotización no existe', async () => {
      await expect(service.getQuoteById('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });

    it('debe actualizar dinámicamente a EXPIRED si pasaron más de 15 días desde la creación', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Misi',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 12,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.2,
      });

      const created = await service.createQuote(dto);

      // Simular que expiró alterando expiresAt en el repositorio a una fecha en el pasado
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      await repository.update({
        ...created,
        expiresAt: pastDate,
      });

      const retrieved = await service.getQuoteById(created.id);

      expect(retrieved.status).toBe('EXPIRED');

      // Validar que se actualizó en el repositorio
      const persisted = await repository.findById(created.id);
      expect(persisted?.status).toBe('EXPIRED');
    });
  });

  describe('bindQuote', () => {
    it('debe vincular exitosamente una cotización en estado OFFERED vigente', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Toby',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 36,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);

      const boundQuote = await service.bindQuote(quote.id, {
        paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        cardToken: 'tok_test_12345',
      });

      expect(boundQuote.status).toBe('BOUND');
      expect(boundQuote.boundAt).toBeDefined();
      expect(new Date(boundQuote.boundAt!).getTime()).toBeLessThanOrEqual(Date.now());

      const persisted = await repository.findById(quote.id);
      expect(persisted?.status).toBe('BOUND');
      expect(persisted?.boundAt).toBe(boundQuote.boundAt);
    });

    it('debe rechazar la vinculación de una cotización no elegible (REJECTED) con BadRequestException', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Ineligible Pet',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 150, // > 12 años (máximo 144 meses)
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);
      expect(quote.status).toBe('REJECTED');

      await expect(
        service.bindQuote(quote.id, {
          paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar la vinculación de una cotización ya vinculada (BOUND) con ConflictException', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Toby',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 36,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);

      await service.bindQuote(quote.id, {
        paymentMethodType: 'WOMPI_TOKENIZED_CARD',
      });

      // Segundo intento de vinculación
      await expect(
        service.bindQuote(quote.id, {
          paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar la vinculación de una cotización expirada con BadRequestException', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Toby',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 36,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const quote = await service.createQuote(dto);

      // Simular expiración en repositorio
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      await repository.update({
        ...quote,
        expiresAt: pastDate,
      });

      await expect(
        service.bindQuote(quote.id, {
          paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si la cotización a vincular no existe', async () => {
      await expect(
        service.bindQuote('non-existent-id', {
          paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
