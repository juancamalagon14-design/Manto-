import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { CalculateQuoteDto } from './dto/calculate-quote.dto';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { copToNumber } from '../../common/types/money';

describe('PricingController', () => {
  let controller: PricingController;
  let service: PricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [PricingService],
    }).compile();

    controller = module.get<PricingController>(PricingController);
    service = module.get<PricingService>(PricingService);
  });

  it('debe estar definido e instanciar correctamente el servicio', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('POST /v1/pricing/calculate-quote', () => {
    it('debe calcular exitosamente una cotización para un perro mestizo mediano en Bogotá', () => {
      const dto = plainToInstance(CalculateQuoteDto, {
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

      const result = controller.calculateQuote(dto);

      expect(result).toBeDefined();
      expect(result.mandatoryCivilLiabilityAttached).toBe(false);
      expect(copToNumber(result.baseMonthlyPremiumCop)).toBe(28512);
      expect(copToNumber(result.totalMonthlyPremiumCop)).toBe(28512);
      expect(copToNumber(result.totalAnnualPremiumCop)).toBe(28512 * 11);
      expect(result.guaranteedBaselineCoverages.length).toBeGreaterThan(0);
    });

    it('debe anexar RCE obligatoria por Ley 1801 para razas de manejo especial', () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'AMERICAN_PIT_BULL_TERRIER',
        sizeCategory: 'MEDIUM',
        ageInMonths: 36,
        city: 'CALI',
        isSterilized: false,
        deductiblePercentage: 0.15,
        selectedAddonKeys: [],
      });

      const result = controller.calculateQuote(dto);

      expect(result.mandatoryCivilLiabilityAttached).toBe(true);
      const rceAddon = result.activeAddons.find(
        (a) => a.key === 'CIVIL_LIABILITY_1801',
      );
      expect(rceAddon).toBeDefined();
      expect(copToNumber(rceAddon!.monthlyPremiumCop)).toBe(15000);
    });

    it('debe sumar múltiples add-ons seleccionados', () => {
      const dto = plainToInstance(CalculateQuoteDto, {
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

      const result = controller.calculateQuote(dto);

      expect(copToNumber(result.selectedAddonsTotalMonthlyCop)).toBe(44700);
      expect(copToNumber(result.totalMonthlyPremiumCop)).toBe(
        copToNumber(result.baseMonthlyPremiumCop) + 44700,
      );
    });

    it('debe lanzar BadRequestException si el código de raza no existe', () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'NON_EXISTENT_BREED',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: false,
        deductiblePercentage: 0.15,
        selectedAddonKeys: [],
      });

      expect(() => controller.calculateQuote(dto)).toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si la especie no coincide con la raza', () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'FELINE',
        gender: 'FEMALE',
        breedCode: 'ROTTWEILER',
        sizeCategory: 'LARGE',
        ageInMonths: 24,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.15,
        selectedAddonKeys: [],
      });

      expect(() => controller.calculateQuote(dto)).toThrow(BadRequestException);
    });
  });

  describe('Validación de DTO (CalculateQuoteDto con class-validator)', () => {
    it('debe pasar la validación con un payload completo y válido', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        gender: 'FEMALE',
        breedCode: 'FRENCH_BULLDOG',
        sizeCategory: 'SMALL',
        ageInMonths: 12,
        city: 'MEDELLIN',
        isSterilized: true,
        deductiblePercentage: 0.1,
        selectedAddonKeys: ['TELEMEDICINE'],
        billingFrequency: 'ANNUAL',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('debe normalizar alias comunes como "DOG", "Bogotá" y deducible 15', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'DOG',
        gender: 'MALE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'Bogotá',
        isSterilized: true,
        deductiblePercentage: 15,
        selectedAddonKeys: ['TELEMEDICINE'],
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.species).toBe('CANINE');
      expect(dto.breedCode).toBe('MIXED_BREED_DOG');
      expect(dto.sizeCategory).toBe('MEDIUM');
      expect(dto.ageInMonths).toBe(24);
      expect(dto.city).toBe('BOGOTA');
      expect(dto.isSterilized).toBe(true);
      expect(dto.deductiblePercentage).toBe(0.15);
      expect(dto.selectedAddonKeys).toEqual(['TELEMEDICINE']);
    });

    it('debe rechazar una edad menor a 2 meses', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 1,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const ageError = errors.find((e) => e.property === 'ageInMonths');
      expect(ageError).toBeDefined();
      expect(ageError!.constraints?.min).toContain('mínima asegurable es de 2 meses');
    });

    it('debe rechazar una edad mayor a 144 meses', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 145,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const ageError = errors.find((e) => e.property === 'ageInMonths');
      expect(ageError).toBeDefined();
      expect(ageError!.constraints?.max).toContain('máxima asegurable');
    });

    it('debe rechazar una especie no permitida', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'REPTILE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
      });

      const errors = await validate(dto);
      const speciesError = errors.find((e) => e.property === 'species');
      expect(speciesError).toBeDefined();
    });

    it('debe rechazar un deducible no soportado', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        deductiblePercentage: 0.5,
      });

      const errors = await validate(dto);
      const deductibleError = errors.find((e) => e.property === 'deductiblePercentage');
      expect(deductibleError).toBeDefined();
    });

    it('debe rechazar un add-on inexistente en el catálogo', async () => {
      const dto = plainToInstance(CalculateQuoteDto, {
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 24,
        city: 'BOGOTA',
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['INVALID_ADDON' as any],
      });

      const errors = await validate(dto);
      const addonError = errors.find((e) => e.property === 'selectedAddonKeys');
      expect(addonError).toBeDefined();
    });
  });

  describe('GET /v1/pricing/special-handling y GET /v1/pricing/breeds', () => {
    it('GET /v1/pricing/special-handling debe retornar la lista de códigos de razas reguladas', () => {
      const breeds = controller.getSpecialHandlingBreeds();
      expect(Array.isArray(breeds)).toBe(true);
      expect(breeds.length).toBe(15);
      expect(breeds).toContain('AMERICAN_PIT_BULL_TERRIER');
      expect(breeds).toContain('ROTTWEILER');
    });

    it('GET /v1/pricing/breeds debe retornar catálogo con specialHandlingCoverage 87545250', () => {
      const catalog = controller.getBreedCatalog();
      expect(Array.isArray(catalog)).toBe(true);
      expect(catalog.length).toBeGreaterThan(0);

      const pitbull = catalog.find((b) => b.code === 'AMERICAN_PIT_BULL_TERRIER');
      expect(pitbull).toBeDefined();
      expect(pitbull!.isSpecialHandling).toBe(true);
      expect(pitbull!.specialHandlingCoverage).toBe('87545250');
    });
  });

  describe('Manejo de Excepciones con RFC 7807 (HttpExceptionFilter)', () => {
    let filter: HttpExceptionFilter;

    beforeEach(() => {
      filter = new HttpExceptionFilter();
    });

    it('debe formatear excepciones HTTP como RFC 7807 Problem Details con Content-Type application/problem+json', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        url: '/v1/pricing/calculate-quote',
        headers: { 'x-trace-id': 'trace-test-123' },
      };

      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      } as any;

      const exception = new BadRequestException('Código de raza no reconocido: PERRO_FANTASMA');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.manto.com.co/errors/http_400',
          title: 'Solicitud Inválida',
          status: 400,
          detail: 'Código de raza no reconocido: PERRO_FANTASMA',
          instance: '/v1/pricing/calculate-quote',
          code: 'HTTP_400',
          traceId: 'trace-test-123',
        }),
      );
    });

    it('debe formatear errores de validación múltiples con array invalidParams', () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      const mockRequest = {
        url: '/v1/pricing/calculate-quote',
        headers: {},
      };

      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      } as any;

      const validationMessages = [
        'La especie debe ser CANINE o FELINE',
        'La edad mínima asegurable es de 2 meses',
      ];
      const exception = new BadRequestException(validationMessages);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          invalidParams: [
            { name: 'body', reason: 'La especie debe ser CANINE o FELINE' },
            { name: 'body', reason: 'La edad mínima asegurable es de 2 meses' },
          ],
        }),
      );
    });
  });
});
