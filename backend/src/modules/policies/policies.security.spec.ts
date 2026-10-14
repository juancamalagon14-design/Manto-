import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as crypto from 'crypto';
import { copToNumber, toCop } from '../../common/types/money';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { MockMercadoPagoAdapter } from '../payments/mercadopago.adapter';
import { PaymentsController } from '../payments/payments.controller';
import { InMemoryPaymentsRepository } from '../payments/payments.repository';
import { PaymentsService } from '../payments/payments.service';
import {
  MERCADOPAGO_ADAPTER,
  PAYMENTS_REPOSITORY,
  PaymentTransaction,
} from '../payments/payments.types';
import { PricingModule } from '../pricing/pricing.module';
import { CreateQuoteDto } from '../quotes/dto/create-quote.dto';
import { InMemoryQuotesRepository } from '../quotes/quotes.repository';
import { QuotesService } from '../quotes/quotes.service';
import { QUOTES_REPOSITORY } from '../quotes/quotes.types';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import { PoliciesController } from './policies.controller';
import { InMemoryPoliciesRepository } from './policies.repository';
import { PoliciesService } from './policies.service';
import { POLICIES_REPOSITORY, PolicyEntity } from './policies.types';

describe('PoliciesModule & PaymentsModule - Auditoría de Seguridad Exhaustiva y Suite de Pruebas Adversarias', () => {
  let policiesService: PoliciesService;
  let policiesController: PoliciesController;
  let policiesRepository: InMemoryPoliciesRepository;

  let paymentsService: PaymentsService;
  let paymentsController: PaymentsController;
  let paymentsRepository: InMemoryPaymentsRepository;
  let mpAdapter: MockMercadoPagoAdapter;

  let quotesService: QuotesService;
  let quotesRepository: InMemoryQuotesRepository;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    policiesRepository = new InMemoryPoliciesRepository();
    paymentsRepository = new InMemoryPaymentsRepository();
    quotesRepository = new InMemoryQuotesRepository();
    mpAdapter = new MockMercadoPagoAdapter();

    const module: TestingModule = await Test.createTestingModule({
      imports: [EligibilityModule, PricingModule],
      controllers: [PoliciesController, PaymentsController],
      providers: [
        PoliciesService,
        PaymentsService,
        QuotesService,
        {
          provide: POLICIES_REPOSITORY,
          useValue: policiesRepository,
        },
        {
          provide: PAYMENTS_REPOSITORY,
          useValue: paymentsRepository,
        },
        {
          provide: QUOTES_REPOSITORY,
          useValue: quotesRepository,
        },
        {
          provide: MERCADOPAGO_ADAPTER,
          useValue: mpAdapter,
        },
      ],
    }).compile();

    policiesService = module.get<PoliciesService>(PoliciesService);
    policiesController = module.get<PoliciesController>(PoliciesController);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    paymentsController = module.get<PaymentsController>(PaymentsController);
    quotesService = module.get<QuotesService>(QuotesService);

    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  afterEach(() => {
    policiesRepository.clear();
    paymentsRepository.clear();
    quotesRepository.clear();
    mpAdapter.clear();
    jest.clearAllMocks();
  });

  /**
   * Utilidad para crear rápidamente una cotización elegible con prima calculada.
   */
  async function createTestQuote(overrides?: Partial<CreateQuoteDto>) {
    const dto = plainToInstance(CreateQuoteDto, {
      petName: 'Max',
      species: 'CANINE',
      breedCode: 'GOLDEN_RETRIEVER',
      sizeCategory: 'LARGE',
      ageInMonths: 24,
      city: 'BOGOTA',
      isSterilized: true,
      gender: 'MALE',
      deductiblePercentage: 0.15,
      customerName: 'Juanita Morales',
      customerEmail: 'juanita@example.com',
      ...overrides,
    });
    return await quotesService.createQuote(dto);
  }

  /**
   * Utilidad para realizar el checkout completo de una póliza hasta estado PENDING_PAYMENT.
   */
  async function initiateTestCheckout(billingFrequency: 'MONTHLY' | 'ANNUAL' = 'MONTHLY') {
    const quote = await createTestQuote();
    const checkoutDto = plainToInstance(CheckoutPolicyDto, {
      quoteId: quote.id,
      customer: {
        fullName: 'Juanita Morales',
        email: 'juanita@example.com',
        phone: '3001234567',
        nationalId: '1020304050',
      },
      billingFrequency,
      paymentMethodType: 'CREDIT_CARD',
      autoRenewalEnabled: true,
    });
    const result = await policiesService.initiateCheckout(checkoutDto);
    return { quote, policy: result.policy, preferenceId: result.preferenceId };
  }

  /**
   * Generador de firmas HMAC SHA-256 válidas de Mercado Pago con el secreto predeterminado.
   */
  function generateMpSignature(
    dataId: string,
    requestId: string,
    ts: string,
    secret: string = MockMercadoPagoAdapter.DEFAULT_MOCK_SECRET,
  ): string {
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
  }

  // =========================================================================
  // VECTOR 1: FALSIFICACIÓN DE WEBHOOKS DE MERCADO PAGO (HMAC SHA-256)
  // =========================================================================
  describe('Vector 1: Falsificación de Webhooks de Mercado Pago (HMAC SHA-256)', () => {
    it('debe rechazar con 401 Unauthorized cualquier webhook con firma HMAC falsa o alterada', async () => {
      const { policy } = await initiateTestCheckout();
      const paymentId = 'pay_fake_sig_001';
      const requestId = 'req-attack-1';
      const ts = String(Math.floor(Date.now() / 1000));

      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: copToNumber(policy.monthlyPremiumCop),
      });

      // Firma con hash v1 completamente aleatorio (falso)
      const fakeV1 = crypto.randomBytes(32).toString('hex');
      const badSignature = `ts=${ts},v1=${fakeV1}`;

      const payload = { action: 'payment.updated', data: { id: paymentId } };

      await expect(
        paymentsService.processWebhookNotification(payload, {
          signature: badSignature,
          requestId,
        }),
      ).rejects.toThrow(UnauthorizedException);

      // Verificar que la póliza sigue en PENDING_PAYMENT y NO fue activada
      const fetchedPolicy = await policiesRepository.findById(policy.id);
      expect(fetchedPolicy?.status).toBe('PENDING_PAYMENT');
      expect(fetchedPolicy?.policyNumber).toBeUndefined();
    });

    it('debe rechazar con 401 Unauthorized cualquier webhook sin cabecera x-signature (firma ausente)', async () => {
      const { policy } = await initiateTestCheckout();
      const paymentId = 'pay_no_sig_002';

      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: copToNumber(policy.monthlyPremiumCop),
      });

      const payload = { action: 'payment.updated', data: { id: paymentId } };

      // Intento 1: meta undefined
      await expect(paymentsService.processWebhookNotification(payload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Intento 2: signature string vacío o solo espacios
      await expect(
        paymentsService.processWebhookNotification(payload, { signature: '   ', requestId: 'req-2' }),
      ).rejects.toThrow(UnauthorizedException);

      // Verificar que la póliza no fue activada
      const fetchedPolicy = await policiesRepository.findById(policy.id);
      expect(fetchedPolicy?.status).toBe('PENDING_PAYMENT');
    });

    it('debe rechazar cabeceras de firma malformadas (faltando ts o v1, o separadores incorrectos)', async () => {
      const paymentId = 'pay_malformed_003';
      const payload = { action: 'payment.updated', data: { id: paymentId } };

      const malformedHeaders = [
        'v1=abcd1234efgh5678', // Falta ts
        'ts=1726234567', // Falta v1
        'invalid-format-string-without-keys',
        'ts=not_a_number,v1=',
        'ts=12345,v1=short', // Longitud insuficiente
      ];

      for (const badSig of malformedHeaders) {
        await expect(
          paymentsService.processWebhookNotification(payload, {
            signature: badSig,
            requestId: 'req-malformed',
          }),
        ).rejects.toThrow(UnauthorizedException);
      }
    });

    it('debe mitigar Replay Attacks: rechazar payloads si se altera el timestamp ts respecto a la firma', async () => {
      const { policy } = await initiateTestCheckout();
      const paymentId = 'pay_replay_004';
      const requestId = 'req-replay-1';
      const legitimateTs = '1726234567';

      // Firma generada legítimamente con legitimateTs
      const validSig = generateMpSignature(paymentId, requestId, legitimateTs);

      // El atacante adultera el ts en el header intentando replay con otro tiempo
      const alteredTs = '1726234999';
      const replaySig = validSig.replace(`ts=${legitimateTs}`, `ts=${alteredTs}`);

      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: copToNumber(policy.monthlyPremiumCop),
      });

      const payload = { action: 'payment.updated', data: { id: paymentId } };

      await expect(
        paymentsService.processWebhookNotification(payload, {
          signature: replaySig,
          requestId,
        }),
      ).rejects.toThrow(UnauthorizedException);

      const fetchedPolicy = await policiesRepository.findById(policy.id);
      expect(fetchedPolicy?.status).toBe('PENDING_PAYMENT');
    });

    it('debe mitigar Replay Attacks: rechazar webhooks cuyo timestamp ts exceda la ventana de tolerancia (maxAgeSeconds)', async () => {
      const paymentId = 'pay_expired_ts_005';
      const requestId = 'req-expired-ts';
      const nowSeconds = 1726234000;
      const oldTimestamp = String(nowSeconds - 3600); // 1 hora de antigüedad

      const oldSignature = generateMpSignature(paymentId, requestId, oldTimestamp);

      // Verificación directa en el adaptador con ventana de tolerancia de 300 segundos (5 min)
      const isAccepted = mpAdapter.validateWebhookSignature(oldSignature, requestId, paymentId, {
        maxAgeSeconds: 300,
        currentTimestamp: nowSeconds,
      });

      expect(isAccepted).toBe(false);
    });

    it('debe mitigar Timing Attacks mediante crypto.timingSafeEqual', () => {
      const dataId = 'pay_timing_safe_006';
      const requestId = 'req-timing';
      const ts = '1726234567';

      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const secret = MockMercadoPagoAdapter.DEFAULT_MOCK_SECRET;
      const computedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      // Hash idéntico en los primeros 63 caracteres pero diferente en el último nibble
      const almostMatchingHash =
        computedHash.substring(0, 63) + (computedHash[63] === 'a' ? 'b' : 'a');

      const almostSig = `ts=${ts},v1=${almostMatchingHash}`;
      const isValid = mpAdapter.validateWebhookSignature(almostSig, requestId, dataId);

      expect(isValid).toBe(false);
    });

    it('debe aceptar y validar exitosamente firmas legítimas calculadas con el secreto oficial', async () => {
      const { policy } = await initiateTestCheckout();
      const paymentId = 'pay_legit_007';
      const requestId = 'req-legit-ok';
      const ts = String(Math.floor(Date.now() / 1000));

      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: copToNumber(policy.monthlyPremiumCop),
        dateApproved: new Date().toISOString(),
      });

      const validSig = generateMpSignature(paymentId, requestId, ts);

      const result = await paymentsService.processWebhookNotification(
        { action: 'payment.updated', data: { id: paymentId } },
        { signature: validSig, requestId },
      );

      expect(result.received).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.policyId).toBe(policy.id);

      // Verificar que la póliza SÍ se activó legítimamente
      const activatedPolicy = await policiesRepository.findById(policy.id);
      expect(activatedPolicy?.status).toBe('ACTIVE');
      expect(activatedPolicy?.policyNumber).toMatch(/^MTO-PET-\d{4}-[A-Z0-9]{6}$/);
    });
  });

  // =========================================================================
  // VECTOR 2: DISCREPANCIAS DE MONTOS E INYECCIÓN FINANCIERA
  // =========================================================================
  describe('Vector 2: Discrepancias de Montos e Inyección Financiera', () => {
    it('debe abortar activación si el monto pagado es drásticamente inferior al cotizado (ej. $1.000 COP vs $45.000 COP)', async () => {
      // 1. Iniciar checkout de póliza con prima mensual real (~$45.000 COP o más)
      const { policy } = await initiateTestCheckout('MONTHLY');
      const expectedAmount = copToNumber(policy.monthlyPremiumCop);
      expect(expectedAmount).toBeGreaterThanOrEqual(30000);

      const paymentId = 'pay_underpayment_attack_001';
      const requestId = 'req-underpay';
      const ts = String(Math.floor(Date.now() / 1000));

      // 2. Simular pago aprobado en MP pero por solo $1.000 COP (inyección / evasión financiera)
      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: 1000, // Vulnerabilidad financiera si no se valida
        dateApproved: new Date().toISOString(),
      });

      const validSig = generateMpSignature(paymentId, requestId, ts);

      // 3. Procesar webhook
      const webhookResponse = await paymentsService.processWebhookNotification(
        { action: 'payment.updated', data: { id: paymentId } },
        { signature: validSig, requestId },
      );

      // 4. Aserciones de defensa
      expect(webhookResponse.status).toBe('AMOUNT_MISMATCH');
      expect(webhookResponse.reason).toContain('inferior a la prima requerida');

      // La póliza NO debe haber sido activada bajo ninguna circunstancia
      const policyInDb = await policiesRepository.findById(policy.id);
      expect(policyInDb?.status).toBe('PENDING_PAYMENT');
      expect(policyInDb?.policyNumber).toBeUndefined();
      expect(policyInDb?.effectiveDate).toBeUndefined();

      // La transacción debe registrar el rechazo de seguridad
      const transactions = await paymentsRepository.findByPolicyId(policy.id);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].status).toBe('REJECTED');
      expect(transactions[0].metadata?.rejectionReason).toBe(
        'DISCREPANCIA_MONTO_PAGO_INSUFICIENTE',
      );
      expect(transactions[0].metadata?.actualAmountPaid).toBe(1000);
      expect(transactions[0].metadata?.expectedAmountCop).toBe(expectedAmount);
    });

    it('debe rechazar discrepancias sutiles de $1 COP por debajo de la prima requerida', async () => {
      const { policy } = await initiateTestCheckout('MONTHLY');
      const expectedAmount = copToNumber(policy.monthlyPremiumCop);
      const underpaidAmount = expectedAmount - 1; // 1 peso menos

      const paymentId = 'pay_subtle_underpayment_002';
      const requestId = 'req-subtle-underpay';
      const ts = String(Math.floor(Date.now() / 1000));

      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: underpaidAmount,
      });

      const validSig = generateMpSignature(paymentId, requestId, ts);

      const result = await paymentsService.processWebhookNotification(
        { action: 'payment.updated', data: { id: paymentId } },
        { signature: validSig, requestId },
      );

      expect(result.status).toBe('AMOUNT_MISMATCH');

      const policyInDb = await policiesRepository.findById(policy.id);
      expect(policyInDb?.status).toBe('PENDING_PAYMENT');
    });

    it('debe rechazar montos pagados de 0 COP o negativos', async () => {
      const { policy } = await initiateTestCheckout('MONTHLY');

      for (const badAmount of [0, -5000]) {
        const paymentId = `pay_zero_neg_${badAmount}`;
        const requestId = `req-zero-neg-${badAmount}`;
        const ts = String(Math.floor(Date.now() / 1000));

        mpAdapter.registerMockPayment(paymentId, {
          status: 'APPROVED',
          externalReference: policy.id,
          transactionAmount: badAmount,
        });

        const validSig = generateMpSignature(paymentId, requestId, ts);

        const result = await paymentsService.processWebhookNotification(
          { action: 'payment.updated', data: { id: paymentId } },
          { signature: validSig, requestId },
        );

        expect(result.status).toBe('AMOUNT_MISMATCH');

        const policyInDb = await policiesRepository.findById(policy.id);
        expect(policyInDb?.status).toBe('PENDING_PAYMENT');
      }
    });

    it('debe aceptar montos iguales o mayores a la prima pactada y activar la póliza', async () => {
      const { policy } = await initiateTestCheckout('MONTHLY');
      const expectedAmount = copToNumber(policy.monthlyPremiumCop);

      const paymentId = 'pay_exact_amount_003';
      const requestId = 'req-exact';
      const ts = String(Math.floor(Date.now() / 1000));

      mpAdapter.registerMockPayment(paymentId, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: expectedAmount, // Exacto
        dateApproved: new Date().toISOString(),
      });

      const validSig = generateMpSignature(paymentId, requestId, ts);

      const result = await paymentsService.processWebhookNotification(
        { action: 'payment.updated', data: { id: paymentId } },
        { signature: validSig, requestId },
      );

      expect(result.status).toBe('APPROVED');

      const policyInDb = await policiesRepository.findById(policy.id);
      expect(policyInDb?.status).toBe('ACTIVE');
      expect(policyInDb?.policyNumber).toBeDefined();
    });
  });

  // =========================================================================
  // VECTOR 3: IDEMPOTENCIA Y DOBLE ACTIVACIÓN CONCURRENTE
  // =========================================================================
  describe('Vector 3: Idempotencia y Doble Activación Concurrente', () => {
    it('debe ser estrictamente idempotente ante disparos concurrentes (Promise.all) de webhooks APPROVED para la misma póliza', async () => {
      const { policy } = await initiateTestCheckout('ANNUAL');
      const expectedAmount = copToNumber(policy.annualPremiumCop);

      const paymentId1 = 'pay_concurrent_A';
      const paymentId2 = 'pay_concurrent_B';
      const ts = String(Math.floor(Date.now() / 1000));

      mpAdapter.registerMockPayment(paymentId1, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: expectedAmount,
        dateApproved: new Date().toISOString(),
      });

      mpAdapter.registerMockPayment(paymentId2, {
        status: 'APPROVED',
        externalReference: policy.id,
        transactionAmount: expectedAmount,
        dateApproved: new Date().toISOString(),
      });

      const sig1 = generateMpSignature(paymentId1, 'req-conc-1', ts);
      const sig2 = generateMpSignature(paymentId2, 'req-conc-2', ts);

      // Ejecución simultánea concurrente (Race condition stress test)
      const [res1, res2] = await Promise.all([
        paymentsService.processWebhookNotification(
          { action: 'payment.updated', data: { id: paymentId1 } },
          { signature: sig1, requestId: 'req-conc-1' },
        ),
        paymentsService.processWebhookNotification(
          { action: 'payment.updated', data: { id: paymentId2 } },
          { signature: sig2, requestId: 'req-conc-2' },
        ),
      ]);

      expect(res1.status).toBe('APPROVED');
      expect(res2.status).toBe('APPROVED');

      // Ambas respuestas deben referenciar la misma póliza
      expect(res1.policyId).toBe(policy.id);
      expect(res2.policyId).toBe(policy.id);

      // Verificar estado final en base de datos
      const finalPolicy = await policiesRepository.findById(policy.id);
      expect(finalPolicy).toBeDefined();
      expect(finalPolicy?.status).toBe('ACTIVE');

      // El número de póliza debe existir y tener formato estándar
      expect(finalPolicy?.policyNumber).toMatch(/^MTO-PET-\d{4}-[A-Z0-9]{6}$/);

      // Solo debe existir 1 registro de esta póliza (sin duplicados)
      const allPolicies = await policiesRepository.findAll();
      const matches = allPolicies.filter((p) => p.id === policy.id);
      expect(matches).toHaveLength(1);
    });

    it('debe preservar inmutabilidad del policyNumber y fechas si se re-invoca activatePolicy secuencialmente', async () => {
      const { policy } = await initiateTestCheckout('MONTHLY');

      // Primera activación
      const activatedFirst = await policiesService.activatePolicy(policy.id, 'tx-1');
      const initialPolicyNumber = activatedFirst.policyNumber;
      const initialEffectiveDate = activatedFirst.effectiveDate;
      const initialExpirationDate = activatedFirst.expirationDate;
      const initialHash = activatedFirst.policyCertificateHash;

      // Segunda invocación idempotente
      const activatedSecond = await policiesService.activatePolicy(policy.id, 'tx-2');

      // Nada debe haber mutado
      expect(activatedSecond.policyNumber).toBe(initialPolicyNumber);
      expect(activatedSecond.effectiveDate).toBe(initialEffectiveDate);
      expect(activatedSecond.expirationDate).toBe(initialExpirationDate);
      expect(activatedSecond.policyCertificateHash).toBe(initialHash);
      expect(activatedSecond.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // VECTOR 4: VIOLACIONES A LA MÁQUINA DE ESTADOS DE PÓLIZA
  // =========================================================================
  describe('Vector 4: Violaciones a la Máquina de Estados de Póliza', () => {
    it('debe rechazar con BadRequestException cualquier intento de activar una póliza CANCELLED', async () => {
      const { policy } = await initiateTestCheckout();

      // Cancelar la póliza
      await policiesService.cancelPolicy(policy.id, {
        reason: 'Titular desiste de la contratación',
      });

      const cancelled = await policiesRepository.findById(policy.id);
      expect(cancelled?.status).toBe('CANCELLED');

      // Intento adversario de reactivar una póliza cancelada
      await expect(policiesService.activatePolicy(policy.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(policiesService.activatePolicy(policy.id)).rejects.toThrow(
        /Solo PENDING_PAYMENT es admisible/,
      );
    });

    it('debe rechazar con BadRequestException cualquier intento de activar una póliza EXPIRED', async () => {
      const { policy } = await initiateTestCheckout();

      // Forzar póliza a estado EXPIRED
      const expiredPolicy: PolicyEntity = {
        ...policy,
        status: 'EXPIRED',
      };
      await policiesRepository.update(expiredPolicy);

      await expect(policiesService.activatePolicy(policy.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(policiesService.activatePolicy(policy.id)).rejects.toThrow(
        /Solo PENDING_PAYMENT es admisible/,
      );
    });

    it('debe rechazar con BadRequestException el intento de cancelar una póliza sin motivo justificado', async () => {
      const { policy } = await initiateTestCheckout();

      // 1. Capa de servicio con motivo menor a 5 caracteres
      await expect(
        policiesService.cancelPolicy(policy.id, { reason: 'no' }),
      ).rejects.toThrow(BadRequestException);

      // 2. Capa de servicio con motivo vacío o espacios
      await expect(
        policiesService.cancelPolicy(policy.id, { reason: '     ' }),
      ).rejects.toThrow(BadRequestException);

      // 3. Validación de DTO a nivel de Pipes HTTP
      const invalidDtos = [
        plainToInstance(CancelPolicyDto, { reason: '' }),
        plainToInstance(CancelPolicyDto, { reason: 'abc' }),
        plainToInstance(CancelPolicyDto, {}),
      ];

      for (const dto of invalidDtos) {
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('debe rechazar con ConflictException cancelar una póliza que ya se encuentra cancelada', async () => {
      const { policy } = await initiateTestCheckout();

      await policiesService.cancelPolicy(policy.id, { reason: 'Primera cancelación válida' });

      // Segundo intento de cancelación idéntica
      await expect(
        policiesService.cancelPolicy(policy.id, { reason: 'Segunda cancelación duplicada' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar con BadRequestException cancelar una póliza expirada', async () => {
      const { policy } = await initiateTestCheckout();

      // Marcar como expirada
      const expiredPolicy: PolicyEntity = { ...policy, status: 'EXPIRED' };
      await policiesRepository.update(expiredPolicy);

      await expect(
        policiesService.cancelPolicy(policy.id, { reason: 'Intento de cancelar póliza expirada' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe validar la transición de ACTIVE a PENDING_RENEWAL y preservar el período de gracia de 30 días', async () => {
      const { policy } = await initiateTestCheckout('MONTHLY');
      await policiesService.activatePolicy(policy.id);

      // Transición a PENDING_RENEWAL por fallo de cobro recurrente
      const renewalPolicy = await policiesService.handleRenewalFailure(
        policy.id,
        'Tarjeta rechazada por saldo insuficiente',
      );

      expect(renewalPolicy.status).toBe('PENDING_RENEWAL');
      expect(renewalPolicy.gracePeriodEndsAt).toBeDefined();

      // Verificar que el período de gracia expira exactamente ~30 días en el futuro
      const graceEnd = new Date(renewalPolicy.gracePeriodEndsAt!);
      const now = new Date();
      const diffDays = Math.round((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);

      // Cobertura amparada durante los 30 días de gracia (Código de Comercio Art. 1068)
      const checkDuringGrace = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // Día 15
      expect(policiesService.isCovered(renewalPolicy, checkDuringGrace)).toBe(true);

      // Cobertura terminada después de los 30 días de gracia
      const checkAfterGrace = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000); // Día 31
      expect(policiesService.isCovered(renewalPolicy, checkAfterGrace)).toBe(false);
    });

    it('debe rechazar pasar a PENDING_RENEWAL pólizas que no estén en estado ACTIVE', async () => {
      const { policy } = await initiateTestCheckout(); // Estado PENDING_PAYMENT

      await expect(policiesService.handleRenewalFailure(policy.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(policiesService.handleRenewalFailure(policy.id)).rejects.toThrow(
        /Solo es posible pasar a PENDING_RENEWAL pólizas que se encuentren en estado ACTIVE/,
      );
    });
  });

  // =========================================================================
  // VECTOR 5: CERTIFICACIÓN LEGAL E INTEGRIDAD DIGITAL (LEY 527 DE 1999)
  // =========================================================================
  describe('Vector 5: Certificación Legal e Integridad Digital (Ley 527 de 1999)', () => {
    it('debe generar un hash criptográfico SHA-256 canónico tras la activación formal', async () => {
      const { policy } = await initiateTestCheckout('ANNUAL');
      const activated = await policiesService.activatePolicy(policy.id);

      expect(activated.policyCertificateHash).toBeDefined();
      expect(activated.policyCertificateHash).toHaveLength(64);
      expect(activated.policyCertificateHash).toMatch(/^[a-f0-9]{64}$/);

      // Verificación de integridad inicial (debe ser válido al emitirse)
      const integrity = policiesService.verifyCertificateIntegrity(activated);
      expect(integrity.isValid).toBe(true);
      expect(integrity.computedHash).toBe(activated.policyCertificateHash);
    });

    it('debe ser tamper-evident: cualquier alteración a los datos asegurados invalida el hash SHA-256', async () => {
      const { policy } = await initiateTestCheckout('MONTHLY');
      const activated = await policiesService.activatePolicy(policy.id);
      const originalHash = activated.policyCertificateHash;

      // Vector de ataque 1: Alterar el nombre de la mascota asegurada
      const tamperedPetName: PolicyEntity = {
        ...activated,
        petData: { ...activated.petData, name: 'Maximus Adversary' },
      };
      const check1 = policiesService.verifyCertificateIntegrity(tamperedPetName);
      expect(check1.isValid).toBe(false);
      expect(check1.computedHash).not.toBe(originalHash);

      // Vector de ataque 2: Alterar el documento del tomador
      const tamperedNationalId: PolicyEntity = {
        ...activated,
        customer: { ...activated.customer, nationalId: '9999999999' },
      };
      const check2 = policiesService.verifyCertificateIntegrity(tamperedNationalId);
      expect(check2.isValid).toBe(false);
      expect(check2.computedHash).not.toBe(originalHash);

      // Vector de ataque 3: Alterar el límite anual de cobertura (fraude de límites asegurados)
      const tamperedLimits: PolicyEntity = {
        ...activated,
        coverages: activated.coverages.map((c, idx) =>
          idx === 0 ? { ...c, annualLimitCop: toCop(999_999_999) } : c,
        ),
      };
      const check3 = policiesService.verifyCertificateIntegrity(tamperedLimits);
      expect(check3.isValid).toBe(false);
      expect(check3.computedHash).not.toBe(originalHash);

      // Vector de ataque 4: Alterar la prima mensual o anual
      const tamperedPremium: PolicyEntity = {
        ...activated,
        monthlyPremiumCop: toCop(1000),
      };
      const check4 = policiesService.verifyCertificateIntegrity(tamperedPremium);
      expect(check4.isValid).toBe(false);
      expect(check4.computedHash).not.toBe(originalHash);

      // Vector de ataque 5: Alterar la fecha de inicio de vigencia (fraude de cobertura retroactiva)
      const tamperedEffectiveDate: PolicyEntity = {
        ...activated,
        effectiveDate: new Date('2020-01-01T00:00:00.000Z').toISOString(),
      };
      const check5 = policiesService.verifyCertificateIntegrity(tamperedEffectiveDate);
      expect(check5.isValid).toBe(false);
      expect(check5.computedHash).not.toBe(originalHash);

      // Vector de ataque 6: Alterar la versión del set de reglas actuariales
      const tamperedRules: PolicyEntity = {
        ...activated,
        rulesVersion: 'PET_RULES_v1.0.0-tampered',
      };
      const check6 = policiesService.verifyCertificateIntegrity(tamperedRules);
      expect(check6.isValid).toBe(false);
      expect(check6.computedHash).not.toBe(originalHash);
    });

    it('debe emitir la carátula digital certificada con el marco legal explícito de la Ley 527 de 1999', async () => {
      const { policy } = await initiateTestCheckout('ANNUAL');
      await policiesService.activatePolicy(policy.id);

      const certificate = await policiesService.getDigitalCertificate(policy.id);

      expect(certificate).toBeDefined();
      expect(certificate.policyNumber).toMatch(/^MTO-PET-\d{4}-[A-Z0-9]{6}$/);
      expect(certificate.legalFramework).toBe(
        'Ley 527 de 1999 - Comercio Electrónico y Firma Digital (Colombia)',
      );
      expect(certificate.certificateHash).toHaveLength(64);
      expect(certificate.insuredPet.name).toBe('Max');
      expect(certificate.policyholder.fullName).toBe('Juanita Morales');
      expect(certificate.coverages.length).toBeGreaterThan(0);
      expect(certificate.issuedAt).toBeDefined();
    });

    it('debe rechazar la emisión de carátula digital con BadRequestException si la póliza no está en estado ACTIVE', async () => {
      const { policy } = await initiateTestCheckout(); // Estado PENDING_PAYMENT

      await expect(policiesService.getDigitalCertificate(policy.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(policiesService.getDigitalCertificate(policy.id)).rejects.toThrow(
        /La carátula digital certificada solo está disponible para pólizas debidamente activadas y vigentes/,
      );
    });
  });
});
