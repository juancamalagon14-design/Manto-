import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { copToNumber, toCop } from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import {
  IMercadoPagoAdapter,
  IPaymentsRepository,
  MERCADOPAGO_ADAPTER,
  MercadoPagoPreferenceRequest,
  MercadoPagoPreferenceResponse,
  PAYMENTS_REPOSITORY,
  PaymentTransaction,
  WebhookSignatureOptions,
} from './payments.types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(MERCADOPAGO_ADAPTER)
    private readonly mpAdapter: IMercadoPagoAdapter,
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: IPaymentsRepository,
    @Inject(forwardRef(() => PoliciesService))
    private readonly policiesService: PoliciesService,
  ) {}

  /**
   * Genera la preferencia de pago en Mercado Pago y registra la transacción inicial en PENDING.
   */
  public async createPaymentPreference(
    params: MercadoPagoPreferenceRequest,
  ): Promise<MercadoPagoPreferenceResponse> {
    const preference = await this.mpAdapter.createPreference(params);

    const transaction: PaymentTransaction = {
      transactionId: uuidv4(),
      policyId: params.policyId,
      quoteId: params.quoteId,
      amountCop: toCop(params.amountCop),
      currency: 'COP',
      provider: this.mpAdapter.isUsingMock() ? 'MOCK' : 'MERCADO_PAGO',
      providerReference: preference.preferenceId,
      idempotencyKey: params.idempotencyKey || uuidv4(),
      status: 'PENDING',
      paymentMethod: params.paymentMethod || 'CREDIT_CARD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        initPoint: preference.initPoint,
        sandboxInitPoint: preference.sandboxInitPoint,
      },
    };

    await this.paymentsRepository.save(transaction);

    this.logger.log(
      `Transacción ${transaction.transactionId} creada en PENDING (Preferencia: ${preference.preferenceId}) para póliza ${params.policyId}`,
    );

    return preference;
  }

  /**
   * Procesa las notificaciones de Webhooks enviadas por Mercado Pago Colombia:
   * 1. Valida la firma criptográfica HMAC SHA-256 del header x-signature y x-request-id.
   * 2. Consulta el estado oficial de la transacción en la API de Mercado Pago.
   * 3. Si el estado es APPROVED, notifica a PoliciesService.activatePolicy().
   */
  public async processWebhookNotification(
    payload: any,
    meta?: {
      signature?: string;
      requestId?: string;
      query?: any;
      signatureOptions?: WebhookSignatureOptions;
    },
  ): Promise<{
    received: boolean;
    status?: string;
    policyId?: string;
    transactionId?: string;
    ignored?: boolean;
    reason?: string;
  }> {
    const dataId =
      payload?.data?.id || payload?.id || meta?.query?.id || meta?.query?.['data.id'];

    if (!dataId) {
      this.logger.warn('Notificación webhook recibida sin identificador de recurso de pago.');
      return {
        received: true,
        ignored: true,
        reason: 'Identificador de pago no encontrado en la notificación',
      };
    }

    // Validación obligatoria de firma criptográfica cuando se procesa un recurso de pago
    if (!meta?.signature || meta.signature.trim() === '') {
      this.logger.error(`Firma de webhook ausente para pago ${dataId}`);
      throw new UnauthorizedException(
        'Firma criptográfica x-signature requerida para procesar webhook de Mercado Pago.',
      );
    }

    const isValid = this.mpAdapter.validateWebhookSignature(
      meta.signature,
      meta.requestId,
      String(dataId),
      meta.signatureOptions,
    );

    if (!isValid) {
      this.logger.error(`Firma de webhook inválida para pago ${dataId}`);
      throw new UnauthorizedException(
        'Firma criptográfica HMAC SHA-256 de webhook Mercado Pago inválida.',
      );
    }

    // Consulta del pago en Mercado Pago
    const payment = await this.mpAdapter.getPayment(String(dataId));
    const policyId = payment.externalReference;

    this.logger.log(
      `Webhook Mercado Pago procesado: Pago ${dataId}, Estado: ${payment.status}, Póliza: ${policyId}`,
    );

    // Actualización o registro de la transacción en el repositorio
    let transaction: PaymentTransaction | null = null;
    if (policyId) {
      const transactions = await this.paymentsRepository.findByPolicyId(policyId);
      if (transactions.length > 0) {
        transaction = transactions[0];
      }
    }

    if (!transaction) {
      transaction = await this.paymentsRepository.findByProviderReference(String(dataId));
    }

    const now = new Date().toISOString();

    if (transaction) {
      transaction.status = payment.status;
      if (payment.dateApproved) {
        transaction.paidAt = payment.dateApproved;
      }
      transaction.updatedAt = now;
      await this.paymentsRepository.update(transaction);
    } else {
      transaction = {
        transactionId: uuidv4(),
        policyId: policyId || 'unknown',
        quoteId: 'webhook-direct',
        amountCop: toCop(payment.transactionAmount || 0),
        currency: 'COP',
        provider: this.mpAdapter.isUsingMock() ? 'MOCK' : 'MERCADO_PAGO',
        providerReference: String(dataId),
        idempotencyKey: uuidv4(),
        status: payment.status,
        paymentMethod: (payment.paymentTypeId?.toUpperCase() as any) || 'CREDIT_CARD',
        paidAt: payment.dateApproved,
        createdAt: now,
        updatedAt: now,
      };
      await this.paymentsRepository.save(transaction);
    }

    // Validación financiera anti-inyección: verificación estricta de monto pagado vs pactado
    if (payment.status === 'APPROVED' && policyId && policyId !== 'unknown') {
      const expectedAmountCop = copToNumber(transaction.amountCop);
      const actualAmountPaid = Number(payment.transactionAmount || 0);

      if (expectedAmountCop > 0 && actualAmountPaid < expectedAmountCop) {
        this.logger.error(
          `[Alerta de Seguridad Financiera] Discrepancia de monto para póliza ${policyId}: Esperado ${expectedAmountCop} COP, pero se pagó ${actualAmountPaid} COP. Activación abortada.`,
        );
        transaction.status = 'REJECTED';
        transaction.metadata = {
          ...transaction.metadata,
          rejectionReason: 'DISCREPANCIA_MONTO_PAGO_INSUFICIENTE',
          expectedAmountCop,
          actualAmountPaid,
        };
        await this.paymentsRepository.update(transaction);

        return {
          received: true,
          status: 'AMOUNT_MISMATCH',
          policyId,
          transactionId: transaction.transactionId,
          reason: `Monto pagado (${actualAmountPaid} COP) es inferior a la prima requerida (${expectedAmountCop} COP). Activación denegada.`,
        };
      }

      try {
        await this.policiesService.activatePolicy(policyId, transaction.transactionId);
        this.logger.log(`Póliza ${policyId} activada en consecuencia del pago ${dataId}`);
      } catch (err: any) {
        this.logger.error(
          `Error al activar póliza ${policyId} tras confirmación de pago: ${err.message}`,
        );
        // Si ya estaba activa o hubo otro error, no rompemos la respuesta 200 al webhook de MP
      }
    }

    return {
      received: true,
      status: payment.status,
      policyId,
      transactionId: transaction.transactionId,
    };
  }

  public async getTransactionById(transactionId: string): Promise<PaymentTransaction> {
    const tx = await this.paymentsRepository.findById(transactionId);
    if (!tx) {
      throw new NotFoundException(`Transacción '${transactionId}' no encontrada.`);
    }
    return tx;
  }

  public async getTransactionsByPolicyId(policyId: string): Promise<PaymentTransaction[]> {
    return await this.paymentsRepository.findByPolicyId(policyId);
  }
}
