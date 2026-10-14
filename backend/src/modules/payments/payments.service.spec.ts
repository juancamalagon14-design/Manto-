import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { toCop } from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import { MockMercadoPagoAdapter } from './mercadopago.adapter';
import { InMemoryPaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import {
  MERCADOPAGO_ADAPTER,
  MercadoPagoPreferenceRequest,
  PAYMENTS_REPOSITORY,
} from './payments.types';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let adapter: MockMercadoPagoAdapter;
  let repository: InMemoryPaymentsRepository;
  let policiesServiceMock: {
    activatePolicy: jest.Mock;
  };

  beforeEach(async () => {
    adapter = new MockMercadoPagoAdapter();
    repository = new InMemoryPaymentsRepository();
    policiesServiceMock = {
      activatePolicy: jest.fn().mockResolvedValue({ id: 'pol-123', status: 'ACTIVE' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: MERCADOPAGO_ADAPTER,
          useValue: adapter,
        },
        {
          provide: PAYMENTS_REPOSITORY,
          useValue: repository,
        },
        {
          provide: PoliciesService,
          useValue: policiesServiceMock,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    repository.clear();
    adapter.clear();
    jest.clearAllMocks();
  });

  it('debe estar definido e instanciado correctamente', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentPreference', () => {
    it('debe crear preferencia en Mercado Pago y registrar la transacción en PENDING', async () => {
      const request: MercadoPagoPreferenceRequest = {
        policyId: 'pol-test-999',
        quoteId: 'qte-test-888',
        amountCop: toCop(45900),
        title: 'Seguro Mascota Manto 2.0 - Mensual',
        payer: {
          name: 'Valentina Morales',
          email: 'valentina@example.com',
          phone: '3109876543',
          nationalId: '1020304050',
        },
        paymentMethod: 'CREDIT_CARD',
      };

      const result = await service.createPaymentPreference(request);

      expect(result).toBeDefined();
      expect(result.preferenceId).toMatch(/^pref_mock_/);
      expect(result.initPoint).toBeDefined();

      // Verificar persistencia en el repositorio en PENDING
      const transactions = await repository.findByPolicyId('pol-test-999');
      expect(transactions).toHaveLength(1);
      const tx = transactions[0];
      expect(tx.status).toBe('PENDING');
      expect(tx.amountCop).toBe(toCop(45900));
      expect(tx.currency).toBe('COP');
      expect(tx.providerReference).toBe(result.preferenceId);
      expect(tx.paymentMethod).toBe('CREDIT_CARD');
    });
  });

  describe('processWebhookNotification', () => {
    it('debe rechazar webhooks con firma HMAC SHA-256 adulterada con UnauthorizedException', async () => {
      const payload = { data: { id: 'pay_test_001' } };
      const meta = {
        signature: 'ts=1726234567,v1=bad_fake_hash_12345',
        requestId: 'req-001',
      };

      await expect(service.processWebhookNotification(payload, meta)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(policiesServiceMock.activatePolicy).not.toHaveBeenCalled();
    });

    it('debe procesar webhook exitoso (APPROVED), actualizar transacción y activar póliza', async () => {
      // 1. Crear preferencia primero
      const preference = await service.createPaymentPreference({
        policyId: 'pol-active-test',
        quoteId: 'qte-active-test',
        amountCop: toCop(55000),
        title: 'Seguro Mascota Manto',
        payer: { name: 'Pedro', email: 'pedro@example.com' },
      });

      // 2. Registrar pago APPROVED en el adaptador con externalReference = policyId
      adapter.registerMockPayment('pay_webhook_approved', {
        status: 'APPROVED',
        externalReference: 'pol-active-test',
        transactionAmount: 55000,
        dateApproved: new Date().toISOString(),
      });

      // 3. Crear firma válida HMAC
      const secret = MockMercadoPagoAdapter.DEFAULT_MOCK_SECRET;
      const dataId = 'pay_webhook_approved';
      const requestId = 'req-valid-123';
      const ts = '1726234567';
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      const webhookPayload = {
        action: 'payment.updated',
        data: { id: dataId },
      };

      const result = await service.processWebhookNotification(webhookPayload, {
        signature: `ts=${ts},v1=${v1}`,
        requestId,
      });

      expect(result.received).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.policyId).toBe('pol-active-test');

      // Validar que se invocó a PoliciesService.activatePolicy con el policyId
      expect(policiesServiceMock.activatePolicy).toHaveBeenCalledWith(
        'pol-active-test',
        expect.any(String),
      );

      // Validar actualización de la transacción
      const txs = await repository.findByPolicyId('pol-active-test');
      expect(txs[0].status).toBe('APPROVED');
      expect(txs[0].paidAt).toBeDefined();
    });

    it('debe registrar pago REJECTED sin invocar activación de póliza', async () => {
      const webhookPayload = {
        action: 'payment.updated',
        data: { id: 'rej_payment_declined' },
      };

      const result = await service.processWebhookNotification(webhookPayload, {
        signature: 'test-valid-signature',
      });

      expect(result.received).toBe(true);
      expect(result.status).toBe('REJECTED');
      expect(policiesServiceMock.activatePolicy).not.toHaveBeenCalled();
    });

    it('debe ignorar grácilmente webhooks sin identificador de pago', async () => {
      const result = await service.processWebhookNotification({});
      expect(result.received).toBe(true);
      expect(result.ignored).toBe(true);
      expect(policiesServiceMock.activatePolicy).not.toHaveBeenCalled();
    });
  });

  describe('Consultas de Transacción', () => {
    it('debe recuperar transacciones por id y lanzar NotFoundException si no existe', async () => {
      await expect(service.getTransactionById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );

      const pref = await service.createPaymentPreference({
        policyId: 'pol-find-1',
        quoteId: 'qte-find-1',
        amountCop: toCop(35000),
        title: 'Test',
        payer: { name: 'Ana', email: 'ana@example.com' },
      });

      const txs = await service.getTransactionsByPolicyId('pol-find-1');
      expect(txs).toHaveLength(1);

      const found = await service.getTransactionById(txs[0].transactionId);
      expect(found.transactionId).toBe(txs[0].transactionId);
    });
  });
});
