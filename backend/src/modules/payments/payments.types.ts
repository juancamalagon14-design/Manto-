import { ColombianPeso } from '../../common/types/money';

export type PaymentProvider = 'MERCADO_PAGO' | 'MOCK';

export type PaymentMethodType = 'CREDIT_CARD' | 'DEBIT_CARD' | 'PSE' | 'CASH';

export type PaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'IN_PROCESS'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface PaymentTransaction {
  transactionId: string;
  policyId: string;
  quoteId: string;
  amountCop: ColombianPeso;
  currency: 'COP';
  provider: PaymentProvider;
  providerReference: string;
  idempotencyKey: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface MercadoPagoPreferenceRequest {
  policyId: string;
  quoteId: string;
  amountCop: number | ColombianPeso;
  title: string;
  payer: {
    name: string;
    email: string;
    phone?: string;
    nationalId?: string;
  };
  paymentMethod?: PaymentMethodType;
  idempotencyKey?: string;
  notificationUrl?: string;
  backUrls?: {
    success: string;
    failure: string;
    pending: string;
  };
}

export interface MercadoPagoPreferenceResponse {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface MercadoPagoPaymentDetails {
  id: string;
  status: PaymentStatus;
  externalReference: string;
  transactionAmount: number;
  paymentMethodId?: string;
  paymentTypeId?: string;
  dateApproved?: string;
  raw?: any;
}

export interface MercadoPagoWebhookPayload {
  action?: string;
  api_version?: string;
  data?: { id: string };
  date_created?: string;
  id?: number | string;
  live_mode?: boolean;
  type?: string;
  user_id?: number | string;
  [key: string]: any;
}

export interface WebhookSignatureOptions {
  maxAgeSeconds?: number;
  currentTimestamp?: number;
}

export interface IMercadoPagoAdapter {
  createPreference(request: MercadoPagoPreferenceRequest): Promise<MercadoPagoPreferenceResponse>;
  getPayment(paymentId: string): Promise<MercadoPagoPaymentDetails>;
  validateWebhookSignature(
    signatureHeader?: string,
    requestId?: string,
    dataId?: string,
    options?: WebhookSignatureOptions,
  ): boolean;
  isUsingMock(): boolean;
}

export const MERCADOPAGO_ADAPTER = 'IMercadoPagoAdapter';

export interface IPaymentsRepository {
  save(transaction: PaymentTransaction): Promise<PaymentTransaction>;
  findById(transactionId: string): Promise<PaymentTransaction | null>;
  findByPolicyId(policyId: string): Promise<PaymentTransaction[]>;
  findByIdempotencyKey(key: string): Promise<PaymentTransaction | null>;
  findByProviderReference(providerReference: string): Promise<PaymentTransaction | null>;
  update(transaction: PaymentTransaction): Promise<PaymentTransaction>;
}

export const PAYMENTS_REPOSITORY = 'IPaymentsRepository';
