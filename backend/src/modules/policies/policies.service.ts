import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { copToNumber, toCop } from '../../common/types/money';
import { PaymentsService } from '../payments/payments.service';
import { QuotesService } from '../quotes/quotes.service';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import {
  IPoliciesRepository,
  POLICIES_REPOSITORY,
  PolicyCoverage,
  PolicyDigitalCertificate,
  PolicyEntity,
} from './policies.types';

/** Colombia es UTC-05:00 todo el año: no hay horario de verano que ajustar. */
const HORAS_DESPLAZAMIENTO_COLOMBIA = 5;

/**
 * Instante en que termina el día colombiano, `anios` años después de `desde`.
 *
 * Se construye sobre la fecha calendario tal como se ve en Bogotá, no sobre la
 * fecha UTC: el 31 de diciembre a las 8 p. m. en Colombia ya es 1 de enero en
 * UTC, y tomar el día equivocado corre la vigencia un día entero.
 *
 * Las 23:59:59.999 de Colombia son las 04:59:59.999 UTC del día siguiente. Se
 * arma con `Date.UTC`, que normaliza el desbordamiento de calendario: una
 * póliza emitida un 29 de febrero vence el 1 de marzo del año siguiente en vez
 * de producir una fecha inexistente.
 */
function finDelDiaEnColombia(desde: Date, anios: number): string {
  const enColombia = new Date(desde.getTime() - HORAS_DESPLAZAMIENTO_COLOMBIA * 3_600_000);
  return new Date(
    Date.UTC(
      enColombia.getUTCFullYear() + anios,
      enColombia.getUTCMonth(),
      enColombia.getUTCDate() + 1,
      HORAS_DESPLAZAMIENTO_COLOMBIA - 1,
      59,
      59,
      999,
    ),
  ).toISOString();
}

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);
  public static readonly RULES_VERSION = 'PET_RULES_v2.0.0';

  private readonly activationLocks = new Map<string, Promise<PolicyEntity>>();

  constructor(
    @Inject(POLICIES_REPOSITORY)
    private readonly policiesRepository: IPoliciesRepository,
    private readonly quotesService: QuotesService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Genera el número formal de póliza bajo el estándar corporativo: MTO-PET-YYYY-XXXXXX.
   */
  public generatePolicyNumber(): string {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 caracteres alfanuméricos
    return `MTO-PET-${year}-${randomHex}`;
  }

  /**
   * Inicia el flujo de checkout y vinculación de cotización:
   * 1. Vincula formalmente la cotización (QuotesService.bindQuote) asegurando vigencia y elegibilidad.
   * 2. Persiste la póliza en estado PENDING_PAYMENT.
   * 3. Genera la preferencia de pago en Mercado Pago y retorna el enlace initPoint.
   */
  public async initiateCheckout(dto: CheckoutPolicyDto): Promise<{
    policy: PolicyEntity;
    preferenceId: string;
    initPoint: string;
    sandboxInitPoint: string;
  }> {
    // 1. Evitar duplicidad si ya existe póliza asociada a la cotización
    const existingPolicy = await this.policiesRepository.findByQuoteId(dto.quoteId);
    if (existingPolicy) {
      throw new ConflictException('Ya existe una póliza emitida o en proceso para esta cotización.');
    }

    // 2. Vincular cotización en QuotesService (transiciona de OFFERED a BOUND)
    const boundQuote = await this.quotesService.bindQuote(dto.quoteId, {
      paymentMethodType: dto.paymentMethodType ?? 'CREDIT_CARD',
      billingFrequency: dto.billingFrequency,
    });

    if (!boundQuote.pricingResult) {
      throw new BadRequestException('La cotización no cuenta con cálculo de primas válido.');
    }

    // 3. Estructurar coberturas combinando garantías base y add-ons activos
    const coverages: PolicyCoverage[] = [];

    if (boundQuote.pricingResult.guaranteedBaselineCoverages) {
      for (const cov of boundQuote.pricingResult.guaranteedBaselineCoverages) {
        coverages.push({
          code: cov.code,
          name: cov.name,
          description: cov.description,
          annualLimitCop: cov.annualLimitCop,
          waitingPeriodDays: cov.waitingPeriodDays,
          deductiblePercentage: cov.copayDeductiblePercentage,
          isMandatory: cov.isMandatoryByLaw ?? false,
        });
      }
    }

    if (boundQuote.pricingResult.activeAddons) {
      for (const addon of boundQuote.pricingResult.activeAddons) {
        coverages.push({
          code: addon.key,
          name: addon.name,
          description: addon.description,
          annualLimitCop: addon.annualLimitCop,
          hasNoAnnualLimit: addon.hasNoAnnualLimit,
          waitingPeriodDays: addon.waitingPeriodDays,
          // Los amparos de add-on se emitían sin deducible, y al liquidar un
          // siniestro ClaimsService caía en un `?? 0.15` inventado. Ahora cada
          // amparo lleva su copago explícito: el contratado si es de
          // reembolso, cero si es de servicio o es el mínimo de Ley 1801.
          deductiblePercentage: addon.copayApplies
            ? boundQuote.pricingResult.effectiveDeductiblePercentage
            : 0,
          isMandatory: addon.isMandatoryByLaw,
        });
      }
    }

    const billingFrequency = dto.billingFrequency ?? boundQuote.billingFrequency;
    const now = new Date().toISOString();

    const policy: PolicyEntity = {
      id: uuidv4(),
      quoteId: boundQuote.id,
      quoteNumber: boundQuote.quoteNumber,
      status: 'PENDING_PAYMENT',
      customer: {
        fullName: dto.customer.fullName,
        email: dto.customer.email,
        phone: dto.customer.phone,
        nationalId: dto.customer.nationalId,
      },
      petData: boundQuote.petData,
      coverages,
      monthlyPremiumCop: boundQuote.pricingResult.totalMonthlyPremiumCop,
      annualPremiumCop: boundQuote.pricingResult.totalAnnualPremiumCop,
      billingFrequency,
      rulesVersion: PoliciesService.RULES_VERSION,
      autoRenewalEnabled: dto.autoRenewalEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const savedPolicy = await this.policiesRepository.save(policy);

    // 4. Crear preferencia de pago en Mercado Pago
    const effectiveAmountCop =
      billingFrequency === 'ANNUAL'
        ? boundQuote.pricingResult.totalAnnualPremiumCop
        : boundQuote.pricingResult.totalMonthlyPremiumCop;

    const preference = await this.paymentsService.createPaymentPreference({
      policyId: savedPolicy.id,
      quoteId: savedPolicy.quoteId,
      amountCop: copToNumber(effectiveAmountCop),
      title: `Seguro Mascota Manto - ${savedPolicy.petData.name} (${billingFrequency === 'ANNUAL' ? 'Anual' : 'Mensual'})`,
      payer: {
        name: savedPolicy.customer.fullName,
        email: savedPolicy.customer.email,
        phone: savedPolicy.customer.phone,
        nationalId: savedPolicy.customer.nationalId,
      },
      paymentMethod: dto.paymentMethodType ?? 'CREDIT_CARD',
    });

    this.logger.log(
      `Checkout iniciado con éxito: Póliza ${savedPolicy.id} en PENDING_PAYMENT (Preferencia MP: ${preference.preferenceId})`,
    );

    return {
      policy: savedPolicy,
      preferenceId: preference.preferenceId,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
    };
  }

  /**
   * Activa formalmente una póliza al confirmarse el pago por webhook o pasarela:
   * 1. Valida que el estado actual sea PENDING_PAYMENT.
   * 2. Protege contra condiciones de carrera y dobles activaciones concurrentes (idempotencia estricta).
   * 3. Genera número formal corporativo: MTO-PET-YYYY-XXXXXX.
   * 4. Fija vigencia de 1 año exacto (hasta las 23:59:59 del año siguiente).
   * 5. Genera hash criptográfico SHA-256 de certificación para firma digital (Ley 527 de 1999).
   * 6. Transiciona a ACTIVE.
   */
  public async activatePolicy(policyId: string, paymentTransactionId?: string): Promise<PolicyEntity> {
    // Si ya existe una activación en vuelo para esta misma póliza, esperar su resolución
    if (this.activationLocks.has(policyId)) {
      return await this.activationLocks.get(policyId)!;
    }

    const activationPromise = this.performActivation(policyId, paymentTransactionId);
    this.activationLocks.set(policyId, activationPromise);

    try {
      return await activationPromise;
    } finally {
      this.activationLocks.delete(policyId);
    }
  }

  private async performActivation(
    policyId: string,
    paymentTransactionId?: string,
  ): Promise<PolicyEntity> {
    const policy = await this.policiesRepository.findById(policyId);
    if (!policy) {
      throw new NotFoundException(`Póliza con id '${policyId}' no encontrada.`);
    }

    // Idempotencia: si ya está activa, retornar sin alterar certificado ni número
    if (policy.status === 'ACTIVE') {
      this.logger.log(`Póliza ${policy.policyNumber || policy.id} ya se encuentra ACTIVA (idempotencia)`);
      return policy;
    }

    if (policy.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `No es posible activar una póliza con estado '${policy.status}'. Solo PENDING_PAYMENT es admisible.`,
      );
    }

    const policyNumber = this.generatePolicyNumber();

    /**
     * Vigencia: inicio hoy, fin un año después al cierre del día EN COLOMBIA.
     *
     * Decía «23:59:59 UTC», y eso son las 6:59:59 p. m. en Bogotá: la cobertura
     * se apagaba cinco horas antes del final del último día de vigencia, en
     * horario en que una urgencia veterinaria es perfectamente posible. Un
     * seguro colombiano vence a la medianoche colombiana.
     *
     * Colombia no tiene horario de verano, así que el desplazamiento es -05:00
     * fijo y la conversión es exacta sin librería de zonas.
     */
    const effective = new Date();
    const expirationDate = finDelDiaEnColombia(effective, 1);
    const effectiveDate = effective.toISOString();

    // Hash criptográfico de integridad según Ley 527 de 1999 (República de Colombia)
    const certificatePayload = {
      policyNumber,
      policyId: policy.id,
      quoteId: policy.quoteId,
      quoteNumber: policy.quoteNumber,
      customer: policy.customer,
      petData: policy.petData,
      coverages: policy.coverages.map((c) => ({
        code: c.code,
        // El amparo sin tope se firma como SIN_TOPE, no como "0". Un cero en el
        // payload del certificado de Ley 527 declara un amparo de cero pesos.
        annualLimitCop: c.hasNoAnnualLimit ? 'SIN_TOPE' : String(c.annualLimitCop),
        waitingPeriodDays: c.waitingPeriodDays,
        deductiblePercentage: c.deductiblePercentage ?? null,
      })),
      effectiveDate,
      expirationDate,
      billingFrequency: policy.billingFrequency,
      monthlyPremiumCop: String(policy.monthlyPremiumCop),
      annualPremiumCop: String(policy.annualPremiumCop),
      rulesVersion: policy.rulesVersion,
    };

    const policyCertificateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(certificatePayload))
      .digest('hex');

    policy.policyNumber = policyNumber;
    policy.status = 'ACTIVE';
    policy.effectiveDate = effectiveDate;
    policy.expirationDate = expirationDate;
    policy.policyCertificateHash = policyCertificateHash;
    policy.lastPaymentTransactionId = paymentTransactionId;
    policy.updatedAt = new Date().toISOString();

    this.logger.log(
      `Póliza ${policyNumber} activada exitosamente (Vigencia hasta: ${expirationDate}, Hash: ${policyCertificateHash.substring(0, 10)}...)`,
    );

    return await this.policiesRepository.update(policy);
  }

  /**
   * Gestiona el fallo en cobro recurrente o renovación:
   * Transiciona la póliza de ACTIVE a PENDING_RENEWAL y preserva el período de gracia de 30 días
   * según la legislación colombiana (Código de Comercio Art. 1068).
   */
  public async handleRenewalFailure(policyId: string, reason?: string): Promise<PolicyEntity> {
    const policy = await this.policiesRepository.findById(policyId);
    if (!policy) {
      throw new NotFoundException(`Póliza con id '${policyId}' no encontrada.`);
    }

    if (policy.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Solo es posible pasar a PENDING_RENEWAL pólizas que se encuentren en estado ACTIVE. Estado actual: ${policy.status}`,
      );
    }

    const now = new Date();
    // Período de gracia formal de 30 días calendario
    const gracePeriodDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    policy.status = 'PENDING_RENEWAL';
    policy.gracePeriodEndsAt = gracePeriodDate.toISOString();
    policy.updatedAt = now.toISOString();

    this.logger.warn(
      `Póliza ${policy.policyNumber || policy.id} entró en período de gracia (PENDING_RENEWAL hasta ${policy.gracePeriodEndsAt}). Motivo: ${reason || 'Fallo de cobro recurrente'}`,
    );

    return await this.policiesRepository.update(policy);
  }

  /**
   * Consulta una póliza por ID con evaluación dinámica de expiración.
   */
  public async getPolicyById(id: string): Promise<PolicyEntity> {
    const policy = await this.policiesRepository.findById(id);
    if (!policy) {
      throw new NotFoundException(`Póliza con id '${id}' no encontrada.`);
    }

    // Expiración dinámica si ha sobrepasado la fecha límite de vigencia
    if (policy.status === 'ACTIVE' && policy.expirationDate) {
      const now = new Date();
      if (now > new Date(policy.expirationDate)) {
        this.logger.log(`Póliza ${policy.policyNumber} expiró dinámicamente.`);
        policy.status = 'EXPIRED';
        policy.updatedAt = now.toISOString();
        return await this.policiesRepository.update(policy);
      }
    }

    return policy;
  }

  /**
   * Cancela una póliza con motivo documentado.
   */
  public async cancelPolicy(id: string, dto: CancelPolicyDto): Promise<PolicyEntity> {
    if (!dto?.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException(
        'La causa de cancelación es obligatoria y debe contener al menos 5 caracteres válidos.',
      );
    }

    const policy = await this.policiesRepository.findById(id);
    if (!policy) {
      throw new NotFoundException(`Póliza con id '${id}' no encontrada.`);
    }

    if (policy.status === 'CANCELLED') {
      throw new ConflictException('La póliza ya se encuentra cancelada.');
    }

    if (policy.status === 'EXPIRED') {
      throw new BadRequestException('No es posible cancelar una póliza que ya se encuentra expirada.');
    }

    policy.status = 'CANCELLED';
    policy.cancellationReason = dto.reason;
    policy.cancelledAt = new Date().toISOString();
    policy.updatedAt = new Date().toISOString();

    this.logger.log(
      `Póliza ${policy.policyNumber || policy.id} CANCELADA. Causa: ${dto.reason}${dto.cancelledBy ? ` (Por: ${dto.cancelledBy})` : ''}`,
    );

    return await this.policiesRepository.update(policy);
  }

  /**
   * Emite y retorna la carátula digital certificada de la póliza (Ley 527 de 1999).
   */
  public async getDigitalCertificate(id: string): Promise<PolicyDigitalCertificate> {
    const policy = await this.getPolicyById(id);

    if (policy.status !== 'ACTIVE' || !policy.policyCertificateHash || !policy.policyNumber) {
      throw new BadRequestException(
        'La carátula digital certificada solo está disponible para pólizas debidamente activadas y vigentes.',
      );
    }

    return {
      policyNumber: policy.policyNumber,
      certificateHash: policy.policyCertificateHash,
      legalFramework: 'Ley 527 de 1999 - Comercio Electrónico y Firma Digital (Colombia)',
      insuredPet: policy.petData,
      policyholder: policy.customer,
      effectiveDate: policy.effectiveDate!,
      expirationDate: policy.expirationDate!,
      billingFrequency: policy.billingFrequency,
      premiumCop:
        policy.billingFrequency === 'ANNUAL'
          ? policy.annualPremiumCop
          : policy.monthlyPremiumCop,
      coverages: policy.coverages,
      issuedAt: policy.effectiveDate!,
    };
  }

  /**
   * Valida la integridad criptográfica del certificado digital conforme a la Ley 527 de 1999.
   * Retorna valid: true si el hash coincide exactamente con los datos de la póliza (tamper-evident).
   */
  public verifyCertificateIntegrity(policy: PolicyEntity): {
    isValid: boolean;
    computedHash: string;
    storedHash?: string;
  } {
    if (!policy.policyCertificateHash || !policy.policyNumber || !policy.effectiveDate || !policy.expirationDate) {
      return {
        isValid: false,
        computedHash: '',
        storedHash: policy.policyCertificateHash,
      };
    }

    const certificatePayload = {
      policyNumber: policy.policyNumber,
      policyId: policy.id,
      quoteId: policy.quoteId,
      quoteNumber: policy.quoteNumber,
      customer: policy.customer,
      petData: policy.petData,
      coverages: policy.coverages.map((c) => ({
        code: c.code,
        // El amparo sin tope se firma como SIN_TOPE, no como "0". Un cero en el
        // payload del certificado de Ley 527 declara un amparo de cero pesos.
        annualLimitCop: c.hasNoAnnualLimit ? 'SIN_TOPE' : String(c.annualLimitCop),
        waitingPeriodDays: c.waitingPeriodDays,
        deductiblePercentage: c.deductiblePercentage ?? null,
      })),
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      billingFrequency: policy.billingFrequency,
      monthlyPremiumCop: String(policy.monthlyPremiumCop),
      annualPremiumCop: String(policy.annualPremiumCop),
      rulesVersion: policy.rulesVersion,
    };

    const computedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(certificatePayload))
      .digest('hex');

    return {
      isValid: computedHash === policy.policyCertificateHash,
      computedHash,
      storedHash: policy.policyCertificateHash,
    };
  }

  /**
   * Determina si la póliza brinda cobertura activa en la fecha dada (incluyendo el período de gracia de 30 días).
   */
  public isCovered(policy: PolicyEntity, checkDate: Date = new Date()): boolean {
    if (policy.status === 'ACTIVE') {
      if (policy.expirationDate && checkDate > new Date(policy.expirationDate)) {
        return false;
      }
      return true;
    }

    if (policy.status === 'PENDING_RENEWAL') {
      if (policy.gracePeriodEndsAt && checkDate <= new Date(policy.gracePeriodEndsAt)) {
        return true; // Cobertura amparada durante los 30 días de gracia
      }
      return false;
    }

    return false;
  }
}
