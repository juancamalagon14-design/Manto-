import * as crypto from 'crypto';
import { toCop } from '../../common/types/money';
import {
  MercadoPagoAdapter,
  MockMercadoPagoAdapter,
  RealMercadoPagoAdapter,
} from './mercadopago.adapter';
import { MercadoPagoPreferenceRequest } from './payments.types';

describe('MercadoPagoAdapter & MockMercadoPagoAdapter', () => {
  let mockAdapter: MockMercadoPagoAdapter;

  beforeEach(() => {
    mockAdapter = new MockMercadoPagoAdapter();
  });

  afterEach(() => {
    mockAdapter.clear();
  });

  describe('MockMercadoPagoAdapter', () => {
    it('debe reportar que está operando en modo simulado/mock', () => {
      expect(mockAdapter.isUsingMock()).toBe(true);
    });

    it('debe generar preferencias de pago con URLs válidas de Colombia', async () => {
      const request: MercadoPagoPreferenceRequest = {
        policyId: 'pol-test-123',
        quoteId: 'qte-test-456',
        amountCop: toCop(58900),
        title: 'Seguro Mascota Manto - Firulais (Mensual)',
        payer: {
          name: 'Carlos Rodríguez',
          email: 'carlos@example.com',
          phone: '3001234567',
          nationalId: '1017123456',
        },
      };

      const response = await mockAdapter.createPreference(request);

      expect(response).toBeDefined();
      expect(response.preferenceId).toMatch(/^pref_mock_/);
      expect(response.initPoint).toContain('mercadopago.com.co');
      expect(response.initPoint).toContain(response.preferenceId);
      expect(response.sandboxInitPoint).toContain('sandbox.mercadopago.com.co');
    });

    it('debe consultar pagos predeterminados con estado APPROVED', async () => {
      const payment = await mockAdapter.getPayment('pay_mock_123');

      expect(payment).toBeDefined();
      expect(payment.id).toBe('pay_mock_123');
      expect(payment.status).toBe('APPROVED');
      expect(payment.transactionAmount).toBe(45000);
      expect(payment.dateApproved).toBeDefined();
    });

    it('debe simular pagos rechazados deterministas con prefijo rej_', async () => {
      const payment = await mockAdapter.getPayment('rej_payment_insufficient');

      expect(payment).toBeDefined();
      expect(payment.status).toBe('REJECTED');
      expect(payment.raw?.rejection_code).toBe('cc_rejected_insufficient_amount');
    });

    it('debe simular pagos pendientes con prefijo pen_', async () => {
      const payment = await mockAdapter.getPayment('pen_pse_waiting');

      expect(payment).toBeDefined();
      expect(payment.status).toBe('IN_PROCESS');
      expect(payment.paymentMethodId).toBe('pse');
    });

    it('debe permitir registrar pagos personalizados en memoria para pruebas', async () => {
      mockAdapter.registerMockPayment('custom_pay_999', {
        status: 'REFUNDED',
        externalReference: 'policy-refund-test',
        transactionAmount: 120000,
      });

      const payment = await mockAdapter.getPayment('custom_pay_999');

      expect(payment.status).toBe('REFUNDED');
      expect(payment.externalReference).toBe('policy-refund-test');
      expect(payment.transactionAmount).toBe(120000);
    });

    describe('Validación Criptográfica de Webhooks (HMAC SHA-256)', () => {
      it('debe validar exitosamente firmas criptográficas válidas con formato oficial de Mercado Pago', () => {
        const secret = MockMercadoPagoAdapter.DEFAULT_MOCK_SECRET;
        const dataId = '1234567890';
        const requestId = 'req-test-uuid-456';
        const ts = '1726234567';

        const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
        const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
        const signatureHeader = `ts=${ts},v1=${v1}`;

        const isValid = mockAdapter.validateWebhookSignature(signatureHeader, requestId, dataId);
        expect(isValid).toBe(true);
      });

      it('debe rechazar firmas criptográficas adulteradas o con hash modificado', () => {
        const requestId = 'req-test-uuid-456';
        const dataId = '1234567890';
        const ts = '1726234567';
        const fakeV1 = crypto.randomBytes(32).toString('hex');
        const signatureHeader = `ts=${ts},v1=${fakeV1}`;

        const isValid = mockAdapter.validateWebhookSignature(signatureHeader, requestId, dataId);
        expect(isValid).toBe(false);
      });

      it('debe rechazar headers mal formados o ausentes', () => {
        expect(mockAdapter.validateWebhookSignature(undefined, 'req', 'id')).toBe(false);
        expect(mockAdapter.validateWebhookSignature('', 'req', 'id')).toBe(false);
        expect(mockAdapter.validateWebhookSignature('invalid-signature', 'req', 'id')).toBe(false);
        expect(mockAdapter.validateWebhookSignature('ts=123', 'req', 'id')).toBe(false);
      });

      it('debe aceptar tokens explícitos de prueba como test-valid-signature', () => {
        expect(mockAdapter.validateWebhookSignature('test-valid-signature')).toBe(true);
        expect(mockAdapter.validateWebhookSignature('mock-valid-signature')).toBe(true);
      });
    });
  });

  describe('MercadoPagoAdapter (Inyectable Dual)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('debe operar con MockMercadoPagoAdapter cuando no hay ACCESS_TOKEN configurado', () => {
      const adapter = new MercadoPagoAdapter();
      expect(adapter.isUsingMock()).toBe(true);
    });

    it('debe instanciar RealMercadoPagoAdapter cuando existe MERCADOPAGO_ACCESS_TOKEN válido', () => {
      process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-1234567890123456-ABCDEF-token';
      const adapter = new MercadoPagoAdapter();
      expect(adapter.isUsingMock()).toBe(false);
    });
  });
});
