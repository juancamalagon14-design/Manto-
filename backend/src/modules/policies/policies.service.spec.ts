import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { PaymentsService } from '../payments/payments.service';
import { PricingModule } from '../pricing/pricing.module';
import { CreateQuoteDto } from '../quotes/dto/create-quote.dto';
import { InMemoryQuotesRepository } from '../quotes/quotes.repository';
import { QuotesService } from '../quotes/quotes.service';
import { QUOTES_REPOSITORY } from '../quotes/quotes.types';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import { InMemoryPoliciesRepository } from './policies.repository';
import { PoliciesService } from './policies.service';
import { POLICIES_REPOSITORY } from './policies.types';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let quotesService: QuotesService;
  let policiesRepository: InMemoryPoliciesRepository;
  let quotesRepository: InMemoryQuotesRepository;
  let paymentsServiceMock: {
    createPaymentPreference: jest.Mock;
  };

  beforeEach(async () => {
    policiesRepository = new InMemoryPoliciesRepository();
    quotesRepository = new InMemoryQuotesRepository();

    paymentsServiceMock = {
      createPaymentPreference: jest.fn().mockImplementation(async (params) => ({
        preferenceId: `pref_mock_${params.policyId.substring(0, 8)}`,
        initPoint: `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=pref_mock_${params.policyId.substring(0, 8)}`,
        sandboxInitPoint: `https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=pref_mock_${params.policyId.substring(0, 8)}`,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [EligibilityModule, PricingModule],
      providers: [
        PoliciesService,
        QuotesService,
        {
          provide: POLICIES_REPOSITORY,
          useValue: policiesRepository,
        },
        {
          provide: QUOTES_REPOSITORY,
          useValue: quotesRepository,
        },
        {
          provide: PaymentsService,
          useValue: paymentsServiceMock,
        },
      ],
    }).compile();

    service = module.get<PoliciesService>(PoliciesService);
    quotesService = module.get<QuotesService>(QuotesService);
  });

  afterEach(() => {
    policiesRepository.clear();
    quotesRepository.clear();
    jest.clearAllMocks();
  });

  it('debe estar definido e instanciado', () => {
    expect(service).toBeDefined();
    expect(quotesService).toBeDefined();
  });

  describe('initiateCheckout', () => {
    it('debe vincular la cotización, crear póliza en PENDING_PAYMENT y generar preferencia MP', async () => {
      // 1. Crear cotización previa en estado OFFERED
      const quoteDto = plainToInstance(CreateQuoteDto, {
        petName: 'Lucas',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'GOLDEN_RETRIEVER',
        sizeCategory: 'LARGE',
        ageInMonths: 24,
        city: 'BOGOTA',
        isSterilized: true,
        deductiblePercentage: 0.15,
        customerName: 'Santiago Vélez',
        customerEmail: 'santiago@example.com',
      });

      const quote = await quotesService.createQuote(quoteDto);
      expect(quote.status).toBe('OFFERED');

      // 2. Iniciar checkout
      const checkoutDto = plainToInstance(CheckoutPolicyDto, {
        quoteId: quote.id,
        customer: {
          fullName: 'Santiago Vélez',
          email: 'santiago@example.com',
          phone: '3151234567',
          nationalId: '1037654321',
        },
        paymentMethodType: 'CREDIT_CARD',
        billingFrequency: 'MONTHLY',
        autoRenewalEnabled: true,
      });

      const result = await service.initiateCheckout(checkoutDto);

      expect(result).toBeDefined();
      expect(result.policy).toBeDefined();
      expect(result.policy.status).toBe('PENDING_PAYMENT');
      expect(result.policy.quoteId).toBe(quote.id);
      expect(result.policy.customer.fullName).toBe('Santiago Vélez');
      expect(result.preferenceId).toMatch(/^pref_mock_/);
      expect(result.initPoint).toContain('mercadopago.com.co');

      // Coberturas combinadas
      expect(result.policy.coverages.length).toBeGreaterThan(0);

      // Cotización subyacente debe haber transicionado a BOUND
      const boundQuote = await quotesService.getQuoteById(quote.id);
      expect(boundQuote.status).toBe('BOUND');

      // Verificación de invocación a PaymentsService
      expect(paymentsServiceMock.createPaymentPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          policyId: result.policy.id,
          quoteId: quote.id,
          paymentMethod: 'CREDIT_CARD',
        }),
      );
    });

    it('debe impedir checkout duplicado para una misma cotización', async () => {
      const quoteDto = plainToInstance(CreateQuoteDto, {
        petName: 'Milo',
        species: 'CANINE',
        gender: 'MALE',
        breedCode: 'BEAGLE',
        sizeCategory: 'MEDIUM',
        ageInMonths: 18,
        city: 'MEDELLIN',
        isSterilized: false,
        deductiblePercentage: 0.1,
      });

      const quote = await quotesService.createQuote(quoteDto);

      const checkoutDto = plainToInstance(CheckoutPolicyDto, {
        quoteId: quote.id,
        customer: {
          fullName: 'Laura Gómez',
          email: 'laura@example.com',
        },
      });

      await service.initiateCheckout(checkoutDto);

      // Segundo checkout idéntico debe fallar con ConflictException
      await expect(service.initiateCheckout(checkoutDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('activatePolicy', () => {
    it('debe activar póliza en PENDING_PAYMENT, fijar número formal, vigencia anual y hash Ley 527', async () => {
      // 1. Crear cotización y póliza en PENDING_PAYMENT
      const quote = await quotesService.createQuote(
        plainToInstance(CreateQuoteDto, {
          petName: 'Kira',
          species: 'FELINE',
          gender: 'FEMALE',
          breedCode: 'SIAMESE',
          sizeCategory: 'SMALL',
          ageInMonths: 12,
          city: 'CALI',
          isSterilized: true,
          deductiblePercentage: 0.15,
        }),
      );

      const checkout = await service.initiateCheckout(
        plainToInstance(CheckoutPolicyDto, {
          quoteId: quote.id,
          customer: { fullName: 'Camila', email: 'camila@example.com' },
        }),
      );

      const pendingPolicyId = checkout.policy.id;

      // 2. Activar póliza
      const activated = await service.activatePolicy(pendingPolicyId, 'tx-mp-777');

      expect(activated.status).toBe('ACTIVE');
      expect(activated.policyNumber).toMatch(/^MTO-PET-\d{4}-[A-Z0-9]{6}$/);
      expect(activated.effectiveDate).toBeDefined();
      expect(activated.expirationDate).toBeDefined();

      // Verificar que la vigencia es de 1 año y termina en 23:59:59 hora Colombia (04:59:59 UTC)
      const expDate = new Date(activated.expirationDate!);
      expect(expDate.getUTCHours()).toBe(4);
      expect(expDate.getUTCMinutes()).toBe(59);
      expect(expDate.getUTCSeconds()).toBe(59);

      // Hash SHA-256 de Ley 527 de 1999 (64 caracteres hex)
      expect(activated.policyCertificateHash).toBeDefined();
      expect(activated.policyCertificateHash).toHaveLength(64);
      expect(activated.policyCertificateHash).toMatch(/^[a-f0-9]{64}$/);

      // Idempotencia: re-activar una póliza ya activa debe retornar sin error ni mutar número
      const reactivated = await service.activatePolicy(pendingPolicyId);
      expect(reactivated.status).toBe('ACTIVE');
      expect(reactivated.policyNumber).toBe(activated.policyNumber);
      expect(reactivated.policyCertificateHash).toBe(activated.policyCertificateHash);
    });

    it('debe rechazar activación si la póliza no existe', async () => {
      await expect(service.activatePolicy('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleRenewalFailure', () => {
    it('debe transicionar póliza ACTIVE a PENDING_RENEWAL (período de gracia)', async () => {
      const quote = await quotesService.createQuote(
        plainToInstance(CreateQuoteDto, {
          petName: 'Simba',
          species: 'FELINE',
          gender: 'MALE',
          breedCode: 'MIXED_BREED_CAT',
          sizeCategory: 'SMALL',
          ageInMonths: 20,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.2,
        }),
      );

      const checkout = await service.initiateCheckout(
        plainToInstance(CheckoutPolicyDto, {
          quoteId: quote.id,
          customer: { fullName: 'Andrés', email: 'andres@example.com' },
        }),
      );

      await service.activatePolicy(checkout.policy.id);

      const renewalPending = await service.handleRenewalFailure(
        checkout.policy.id,
        'Tarjeta rechazada por fondos insuficientes',
      );

      expect(renewalPending.status).toBe('PENDING_RENEWAL');
    });

    it('debe rechazar paso a PENDING_RENEWAL si la póliza no está activa', async () => {
      const quote = await quotesService.createQuote(
        plainToInstance(CreateQuoteDto, {
          petName: 'Toby',
          species: 'CANINE',
          gender: 'MALE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'MEDIUM',
          ageInMonths: 24,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.15,
        }),
      );

      const checkout = await service.initiateCheckout(
        plainToInstance(CheckoutPolicyDto, {
          quoteId: quote.id,
          customer: { fullName: 'Mario', email: 'mario@example.com' },
        }),
      );

      // Intento en estado PENDING_PAYMENT
      await expect(service.handleRenewalFailure(checkout.policy.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelPolicy', () => {
    it('debe cancelar póliza con motivo y fecha formal', async () => {
      const quote = await quotesService.createQuote(
        plainToInstance(CreateQuoteDto, {
          petName: 'Rocky',
          species: 'CANINE',
          gender: 'MALE',
          breedCode: 'BOXER',
          sizeCategory: 'LARGE',
          ageInMonths: 36,
          city: 'MEDELLIN',
          isSterilized: false,
          deductiblePercentage: 0.1,
        }),
      );

      const checkout = await service.initiateCheckout(
        plainToInstance(CheckoutPolicyDto, {
          quoteId: quote.id,
          customer: { fullName: 'Esteban', email: 'esteban@example.com' },
        }),
      );

      const cancelDto = plainToInstance(CancelPolicyDto, {
        reason: 'Venta de la mascota a nuevo tutor',
        cancelledBy: 'Santiago Vélez',
      });

      const cancelled = await service.cancelPolicy(checkout.policy.id, cancelDto);

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Venta de la mascota a nuevo tutor');
      expect(cancelled.cancelledAt).toBeDefined();

      // Segundo intento de cancelación debe fallar
      await expect(service.cancelPolicy(checkout.policy.id, cancelDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getDigitalCertificate', () => {
    it('debe emitir carátula digital para póliza activa según Ley 527 de 1999', async () => {
      const quote = await quotesService.createQuote(
        plainToInstance(CreateQuoteDto, {
          petName: 'Mia',
          species: 'FELINE',
          gender: 'FEMALE',
          breedCode: 'PERSIAN',
          sizeCategory: 'SMALL',
          ageInMonths: 15,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.1,
        }),
      );

      const checkout = await service.initiateCheckout(
        plainToInstance(CheckoutPolicyDto, {
          quoteId: quote.id,
          customer: { fullName: 'Daniela', email: 'daniela@example.com' },
        }),
      );

      await service.activatePolicy(checkout.policy.id);

      const certificate = await service.getDigitalCertificate(checkout.policy.id);

      expect(certificate).toBeDefined();
      expect(certificate.policyNumber).toMatch(/^MTO-PET-/);
      expect(certificate.legalFramework).toContain('Ley 527 de 1999');
      expect(certificate.certificateHash).toHaveLength(64);
      expect(certificate.insuredPet.name).toBe('Mia');
      expect(certificate.policyholder.fullName).toBe('Daniela');
      expect(certificate.coverages.length).toBeGreaterThan(0);
    });

    it('debe rechazar carátula digital para pólizas no activas', async () => {
      const quote = await quotesService.createQuote(
        plainToInstance(CreateQuoteDto, {
          petName: 'Can',
          species: 'CANINE',
          gender: 'MALE',
          breedCode: 'MIXED_BREED_DOG',
          sizeCategory: 'MEDIUM',
          ageInMonths: 20,
          city: 'BOGOTA',
          isSterilized: true,
          deductiblePercentage: 0.15,
        }),
      );

      const checkout = await service.initiateCheckout(
        plainToInstance(CheckoutPolicyDto, {
          quoteId: quote.id,
          customer: { fullName: 'Felipe', email: 'felipe@example.com' },
        }),
      );

      await expect(service.getDigitalCertificate(checkout.policy.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
