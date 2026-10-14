import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { copToNumber } from '../../common/types/money';
import {
  IMercadoPagoAdapter,
  MercadoPagoPaymentDetails,
  MercadoPagoPreferenceRequest,
  MercadoPagoPreferenceResponse,
  PaymentStatus,
  WebhookSignatureOptions,
} from './payments.types';

/**
 * MockMercadoPagoAdapter:
 * Adaptador simulado de alta fidelidad precalibrado para pruebas unitarias, CI/CD
 * y desarrollo local sin credenciales externas de Mercado Pago Colombia.
 */
export class MockMercadoPagoAdapter implements IMercadoPagoAdapter {
  private readonly logger = new Logger(MockMercadoPagoAdapter.name);
  public static readonly DEFAULT_MOCK_SECRET = 'mock_mercadopago_webhook_secret_key_co_2026';

  private readonly storedPreferences = new Map<string, MercadoPagoPreferenceRequest>();
  private readonly storedPayments = new Map<string, MercadoPagoPaymentDetails>();

  public isUsingMock(): boolean {
    return true;
  }

  /**
   * Registra un pago mockeado previamente para aserciones en pruebas.
   */
  public registerMockPayment(id: string, details: Partial<MercadoPagoPaymentDetails>): void {
    const fullDetails: MercadoPagoPaymentDetails = {
      id,
      status: details.status ?? 'APPROVED',
      externalReference: details.externalReference ?? 'mock-policy-id',
      transactionAmount: details.transactionAmount ?? 45000,
      paymentMethodId: details.paymentMethodId ?? 'visa',
      paymentTypeId: details.paymentTypeId ?? 'credit_card',
      dateApproved: details.dateApproved ?? new Date().toISOString(),
      raw: details.raw ?? {},
    };
    this.storedPayments.set(id, fullDetails);
  }

  public async createPreference(
    request: MercadoPagoPreferenceRequest,
  ): Promise<MercadoPagoPreferenceResponse> {
    const preferenceId = `pref_mock_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const initPoint = `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=${preferenceId}`;
    const sandboxInitPoint = `https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=${preferenceId}`;

    this.storedPreferences.set(preferenceId, request);

    // Registra automáticamente un pago predeterminado asociado para facilitar testing de webhooks
    this.storedPayments.set(preferenceId, {
      id: preferenceId,
      status: 'APPROVED',
      externalReference: request.policyId,
      transactionAmount:
        typeof request.amountCop === 'bigint'
          ? copToNumber(request.amountCop as any)
          : Number(request.amountCop),
      paymentMethodId: 'visa',
      paymentTypeId: 'credit_card',
      dateApproved: new Date().toISOString(),
    });

    this.logger.log(
      `[MockMercadoPago] Preferencia creada: ${preferenceId} para póliza ${request.policyId}`,
    );

    return {
      preferenceId,
      initPoint,
      sandboxInitPoint,
    };
  }

  public async getPayment(paymentId: string): Promise<MercadoPagoPaymentDetails> {
    if (this.storedPayments.has(paymentId)) {
      return this.storedPayments.get(paymentId)!;
    }

    // Comportamiento determinista para IDs con prefijos específicos de prueba
    if (paymentId.startsWith('rej_')) {
      return {
        id: paymentId,
        status: 'REJECTED',
        externalReference: 'policy-rejected-mock',
        transactionAmount: 45000,
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        raw: { rejection_code: 'cc_rejected_insufficient_amount' },
      };
    }

    if (paymentId.startsWith('pen_')) {
      return {
        id: paymentId,
        status: 'IN_PROCESS',
        externalReference: 'policy-pending-mock',
        transactionAmount: 45000,
        paymentMethodId: 'pse',
        paymentTypeId: 'bank_transfer',
        raw: { status_detail: 'pending_waiting_transfer' },
      };
    }

    // Default mock: Pago aprobado exitosamente
    return {
      id: paymentId,
      status: 'APPROVED',
      externalReference: 'mock-policy-default',
      transactionAmount: 45000,
      paymentMethodId: 'visa',
      paymentTypeId: 'credit_card',
      dateApproved: new Date().toISOString(),
      raw: { status: 'approved', status_detail: 'accredited' },
    };
  }

  public validateWebhookSignature(
    signatureHeader?: string,
    requestId?: string,
    dataId?: string,
    options?: WebhookSignatureOptions,
  ): boolean {
    if (!signatureHeader) {
      return false;
    }

    // Facilidad para pruebas unitarias con tokens fijos explícitos
    if (signatureHeader === 'test-valid-signature' || signatureHeader === 'mock-valid-signature') {
      return true;
    }
    if (signatureHeader === 'invalid-signature' || signatureHeader.startsWith('invalid')) {
      return false;
    }

    // Si viene en el formato oficial de Mercado Pago (ts=...,v1=...)
    try {
      const parts = signatureHeader.split(',');
      let ts: string | undefined;
      let v1: string | undefined;

      for (const part of parts) {
        const [key, value] = part.trim().split('=');
        if (key === 'ts') ts = value;
        if (key === 'v1') v1 = value;
      }

      if (!ts || !v1) {
        return false;
      }

      // Mitigación de Replay Attacks: validar frescura del timestamp si se especifica maxAgeSeconds
      if (options?.maxAgeSeconds && options.maxAgeSeconds > 0) {
        const nowSeconds = options.currentTimestamp ?? Math.floor(Date.now() / 1000);
        const tsNum = Number(ts);
        if (isNaN(tsNum) || Math.abs(nowSeconds - tsNum) > options.maxAgeSeconds) {
          return false;
        }
      }

      const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || MockMercadoPagoAdapter.DEFAULT_MOCK_SECRET;
      const manifest = `id:${dataId || ''};request-id:${requestId || ''};ts:${ts};`;
      const computedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      return (
        computedHash.length === v1.length &&
        crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(v1, 'hex'))
      );
    } catch {
      return false;
    }
  }

  public clear(): void {
    this.storedPreferences.clear();
    this.storedPayments.clear();
  }
}

/**
 * RealMercadoPagoAdapter:
 * Adaptador de producción conectado directamente a los endpoints REST de Mercado Pago Colombia.
 */
export class RealMercadoPagoAdapter implements IMercadoPagoAdapter {
  private readonly logger = new Logger(RealMercadoPagoAdapter.name);
  private readonly baseUrl = 'https://api.mercadopago.com';

  constructor(
    private readonly accessToken: string,
    private readonly webhookSecret?: string,
  ) {}

  public isUsingMock(): boolean {
    return false;
  }

  public async createPreference(
    request: MercadoPagoPreferenceRequest,
  ): Promise<MercadoPagoPreferenceResponse> {
    const amountNumber =
      typeof request.amountCop === 'bigint'
        ? copToNumber(request.amountCop as any)
        : Number(request.amountCop);

    const body: Record<string, any> = {
      items: [
        {
          id: request.quoteId,
          title: request.title,
          quantity: 1,
          unit_price: amountNumber,
          currency_id: 'COP',
        },
      ],
      external_reference: request.policyId,
      payer: {
        name: request.payer.name,
        email: request.payer.email,
        phone: request.payer.phone ? { number: request.payer.phone } : undefined,
        identification: request.payer.nationalId
          ? { type: 'CC', number: request.payer.nationalId }
          : undefined,
      },
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }], // Forzar tarjetas o PSE para inmediatez
        installments: 1,
      },
      back_urls: request.backUrls || {
        success: 'https://manto.com.co/checkout/success',
        failure: 'https://manto.com.co/checkout/failure',
        pending: 'https://manto.com.co/checkout/pending',
      },
      auto_return: 'approved',
      statement_descriptor: 'MANTO SEGUROS',
    };

    if (request.notificationUrl) {
      body.notification_url = request.notificationUrl;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    if (request.idempotencyKey) {
      headers['x-idempotency-key'] = request.idempotencyKey;
    }

    const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Error de Mercado Pago al crear preferencia (${response.status}): ${errorText}`);
      throw new Error(`Error en pasarela de pagos Mercado Pago: ${response.statusText}`);
    }

    // Response.json() devuelve unknown: se tipa el contrato esperado en vez de confiar a ciegas.
    const data = (await response.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    return {
      preferenceId: data.id ?? '',
      initPoint: data.init_point ?? '',
      sandboxInitPoint: data.sandbox_init_point ?? '',
    };
  }

  public async getPayment(paymentId: string): Promise<MercadoPagoPaymentDetails> {
    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Error al consultar pago ${paymentId} (${response.status}): ${errorText}`);
      throw new Error(`No fue posible recuperar el pago ${paymentId} de Mercado Pago`);
    }

    // Contrato mínimo del pago que consume el adaptador.
    const data = (await response.json()) as {
      id?: string | number;
      status?: string;
      external_reference?: string;
      transaction_amount?: number;
      payment_method_id?: string;
      payment_type_id?: string;
      date_approved?: string;
      [key: string]: unknown;
    };
    return {
      id: String(data.id),
      status: this.mapStatus(data.status as never),
      externalReference: data.external_reference ?? '',
      transactionAmount: data.transaction_amount ?? 0,
      paymentMethodId: data.payment_method_id,
      paymentTypeId: data.payment_type_id,
      dateApproved: data.date_approved,
      raw: data,
    };
  }

  public validateWebhookSignature(
    signatureHeader?: string,
    requestId?: string,
    dataId?: string,
    options?: WebhookSignatureOptions,
  ): boolean {
    if (!signatureHeader || !this.webhookSecret) {
      this.logger.warn('Falta encabezado de firma o secreto de webhook para validación HMAC');
      return false;
    }

    try {
      const parts = signatureHeader.split(',');
      let ts: string | undefined;
      let v1: string | undefined;

      for (const part of parts) {
        const [key, value] = part.trim().split('=');
        if (key === 'ts') ts = value;
        if (key === 'v1') v1 = value;
      }

      if (!ts || !v1) {
        return false;
      }

      // Mitigación de Replay Attacks: validar frescura del timestamp si se especifica maxAgeSeconds
      if (options?.maxAgeSeconds && options.maxAgeSeconds > 0) {
        const nowSeconds = options.currentTimestamp ?? Math.floor(Date.now() / 1000);
        const tsNum = Number(ts);
        if (isNaN(tsNum) || Math.abs(nowSeconds - tsNum) > options.maxAgeSeconds) {
          return false;
        }
      }

      const manifest = `id:${dataId || ''};request-id:${requestId || ''};ts:${ts};`;
      const computedHash = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(manifest)
        .digest('hex');

      return (
        computedHash.length === v1.length &&
        crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(v1, 'hex'))
      );
    } catch (err: any) {
      this.logger.error(`Excepción durante validación de firma webhook: ${err.message}`);
      return false;
    }
  }

  private mapStatus(mpStatus: string): PaymentStatus {
    switch (mpStatus) {
      case 'approved':
        return 'APPROVED';
      case 'in_process':
      case 'in_mediation':
      case 'authorized':
        return 'IN_PROCESS';
      case 'pending':
        return 'PENDING';
      case 'rejected':
        return 'REJECTED';
      case 'cancelled':
        return 'CANCELLED';
      case 'refunded':
      case 'charged_back':
        return 'REFUNDED';
      default:
        return 'PENDING';
    }
  }
}

/**
 * MercadoPagoAdapter:
 * Adaptador dual inyectable. Activa RealMercadoPagoAdapter si existe MERCADOPAGO_ACCESS_TOKEN
 * válido en variables de entorno, o conmuta a MockMercadoPagoAdapter precalibrado para 100% offline.
 */
@Injectable()
export class MercadoPagoAdapter implements IMercadoPagoAdapter {
  private readonly logger = new Logger(MercadoPagoAdapter.name);
  private readonly activeAdapter: IMercadoPagoAdapter;

  constructor() {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (token && token.trim().length > 5 && token !== 'mock') {
      this.logger.log('MercadoPagoAdapter inicializado en MODO REAL (Mercado Pago Colombia API)');
      this.activeAdapter = new RealMercadoPagoAdapter(
        token.trim(),
        process.env.MERCADOPAGO_WEBHOOK_SECRET,
      );
    } else {
      this.logger.log(
        'MercadoPagoAdapter operando con MockMercadoPagoAdapter precalibrado (100% offline)',
      );
      this.activeAdapter = new MockMercadoPagoAdapter();
    }
  }

  public isUsingMock(): boolean {
    return this.activeAdapter.isUsingMock();
  }

  public async createPreference(
    request: MercadoPagoPreferenceRequest,
  ): Promise<MercadoPagoPreferenceResponse> {
    return await this.activeAdapter.createPreference(request);
  }

  public async getPayment(paymentId: string): Promise<MercadoPagoPaymentDetails> {
    return await this.activeAdapter.getPayment(paymentId);
  }

  public validateWebhookSignature(
    signatureHeader?: string,
    requestId?: string,
    dataId?: string,
    options?: WebhookSignatureOptions,
  ): boolean {
    return this.activeAdapter.validateWebhookSignature(signatureHeader, requestId, dataId, options);
  }
}
