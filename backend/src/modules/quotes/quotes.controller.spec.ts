import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { PricingModule } from '../pricing/pricing.module';
import { BindQuoteDto } from './dto/bind-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuotesController } from './quotes.controller';
import { InMemoryQuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';
import { QUOTES_REPOSITORY } from './quotes.types';

describe('QuotesController', () => {
  let controller: QuotesController;
  let service: QuotesService;
  let repository: InMemoryQuotesRepository;

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

    controller = module.get<QuotesController>(QuotesController);
    service = module.get<QuotesService>(QuotesService);
    repository = module.get<InMemoryQuotesRepository>(QUOTES_REPOSITORY);
  });

  afterEach(() => {
    repository.clear();
  });

  it('debe estar definido e instanciar dependencias correctamente', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('DTO Validation & Normalization', () => {
    it('debe normalizar especie "perro" / "DOG" a "CANINE"', () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Max',
        species: 'DOG',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'Bogotá',
        isSterilized: 'true',
        deductiblePercentage: 15,
      });

      expect(dto.species).toBe('CANINE');
      expect(dto.city).toBe('BOGOTA');
      expect(dto.isSterilized).toBe(true);
      expect(dto.deductiblePercentage).toBe(0.15);
    });

    it('debe validar errores cuando faltan campos obligatorios', async () => {
      const dto = plainToInstance(CreateQuoteDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const fieldsWithErrors = errors.map((e) => e.property);
      expect(fieldsWithErrors).toContain('petName');
      expect(fieldsWithErrors).toContain('species');
      expect(fieldsWithErrors).toContain('city');
    });

    it('debe rechazar edades fuera del rango (menores a 2 o mayores a 144 meses)', async () => {
      const dtoLow = plainToInstance(CreateQuoteDto, {
        petName: 'Bebe',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'SMALL',
        ageInMonths: 1,
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const errorsLow = await validate(dtoLow);
      expect(errorsLow.some((e) => e.property === 'ageInMonths')).toBe(true);

      const dtoHigh = plainToInstance(CreateQuoteDto, {
        petName: 'Abuelo',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'SMALL',
        ageInMonths: 145,
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
      });

      const errorsHigh = await validate(dtoHigh);
      expect(errorsHigh.some((e) => e.property === 'ageInMonths')).toBe(true);
    });
  });

  describe('Endpoints', () => {
    it('POST /v1/quotes debe retornar 201 Created con el snapshot', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Luna',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 18,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.1,
      });

      const result = await controller.createQuote(dto);
      expect(result).toBeDefined();
      expect(result.status).toBe('OFFERED');
      expect(result.petData.name).toBe('Luna');
    });

    it('GET /v1/quotes/:id debe retornar 200 OK con la cotización', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Luna',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 18,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.1,
      });

      const created = await controller.createQuote(dto);
      const fetched = await controller.getQuote(created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('POST /v1/quotes/:id/bind debe retornar 200 OK y estado BOUND', async () => {
      const dto = plainToInstance(CreateQuoteDto, {
        petName: 'Luna',
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'MIXED_BREED_CAT',
        sizeCategory: 'SMALL',
        ageInMonths: 18,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.1,
      });

      const created = await controller.createQuote(dto);
      const bindDto = plainToInstance(BindQuoteDto, {
        paymentMethodType: 'WOMPI_TOKENIZED_CARD',
        cardToken: 'tok_card_test_999',
      });

      const bound = await controller.bindQuote(created.id, bindDto);
      expect(bound.status).toBe('BOUND');
      expect(bound.boundAt).toBeDefined();
    });
  });
});
