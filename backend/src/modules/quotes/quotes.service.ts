import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EligibilityService } from '../eligibility/eligibility.service';
import { PricingService } from '../pricing/pricing.service';
import { BindQuoteDto } from './dto/bind-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import {
  IQuotesRepository,
  QUOTES_REPOSITORY,
  QuoteCustomer,
  QuotePetData,
  QuoteSnapshot,
} from './quotes.types';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  private readonly bindingLocks = new Set<string>();

  public static readonly PRODUCT_VERSION = 'PET_STANDARD_v2';
  public static readonly RULES_VERSION = 'PET_RULES_v2.0.0';
  public static readonly VALIDITY_DAYS = 15;

  constructor(
    private readonly eligibilityService: EligibilityService,
    private readonly pricingService: PricingService,
    @Inject(QUOTES_REPOSITORY)
    private readonly quotesRepository: IQuotesRepository,
  ) {}

  /**
   * Genera un número de cotización amigable y trazable (ej. QTE-20260912-A1B2).
   */
  private generateQuoteNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `QTE-${year}${month}${day}-${randomHex}`;
  }

  /**
   * Orquesta la creación de cotizaciones:
   * 1. Evalúa elegibilidad biológica y legal.
   * 2. Si no es elegible: persiste con status = 'REJECTED' y rejectionReasons, sin cálculo de primas.
   * 3. Si es elegible: calcula tarificación determinista y persiste con status = 'OFFERED' y vigencia de 15 días.
   */
  public async createQuote(dto: CreateQuoteDto): Promise<QuoteSnapshot> {
    const petName = dto.petName;
    const species = dto.species;
    const breedCode = dto.breedCode;
    const ageInMonths = dto.ageInMonths;
    const city = dto.city;
    const gender = dto.gender;
    const isSterilized = dto.isSterilized === true;
    const deductiblePercentage = dto.deductiblePercentage;
    const selectedAddonKeys = dto.selectedAddonKeys ?? [];
    const billingFrequency = dto.billingFrequency ?? 'MONTHLY';
    const petsInPolicy = dto.petsInPolicy;

    // El tamaño que se congela es el que usa el motor, validado contra el
    // típico de la raza, no el que declaró el cliente.
    const sizeCategory = this.pricingService.resolveEffectiveSizeCategory(
      breedCode,
      dto.sizeCategory,
    );

    this.logger.log(
      `Iniciando cotización para mascota '${petName}' (Especie: ${species}, Raza: ${breedCode}, Edad: ${ageInMonths}m)`,
    );

    // 1. Evaluación de Elegibilidad
    const eligibilityResult = this.eligibilityService.evaluateEligibility({
      species,
      breedCode,
      ageInMonths,
      hasPreExistingChronicConditions: dto.hasPreExistingChronicConditions ?? false,
    });

    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + QuotesService.VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const petData: QuotePetData = {
      name: petName,
      species,
      breedCode,
      sizeCategory,
      ageInMonths,
      city,
      gender,
      isSterilized,
      petsInPolicy,
    };

    const customer: QuoteCustomer = {
      fullName: dto.customerName,
      email: dto.customerEmail,
      phone: dto.customerPhone,
    };

    const quoteId = uuidv4();
    const quoteNumber = this.generateQuoteNumber();

    // 2. Si NO es elegible: Guardar y retornar status = 'REJECTED' sin cálculo de primas
    if (!eligibilityResult.isEligible) {
      this.logger.warn(
        `Cotización ${quoteNumber} RECHAZADA por elegibilidad: ${eligibilityResult.rejectionReasons.join('; ')}`,
      );

      const rejectedQuote: QuoteSnapshot = {
        id: quoteId,
        quoteNumber,
        status: 'REJECTED',
        petData,
        selectedDeductiblePercentage: deductiblePercentage,
        selectedAddonKeys,
        billingFrequency,
        customer,
        pricingResult: null,
        eligibilityResult,
        productVersion: QuotesService.PRODUCT_VERSION,
        rulesVersion: QuotesService.RULES_VERSION,
        createdAt,
        expiresAt,
        rejectionReasons: eligibilityResult.rejectionReasons,
      };

      return await this.quotesRepository.save(rejectedQuote);
    }

    // 3. Si ES elegible: Calcular tarificación determinista
    const pricingResult = this.pricingService.calculateQuote({
      species,
      breedCode,
      sizeCategory,
      ageInMonths,
      city,
      gender,
      petsInPolicy,
      isSterilized,
      deductiblePercentage,
      selectedAddonKeys,
      billingFrequency,
    });

    const offeredQuote: QuoteSnapshot = {
      id: quoteId,
      quoteNumber,
      status: 'OFFERED',
      petData,
      selectedDeductiblePercentage: deductiblePercentage,
      selectedAddonKeys: pricingResult.activeAddons.map((a) => a.key),
      billingFrequency,
      customer,
      pricingResult,
      eligibilityResult,
      productVersion: QuotesService.PRODUCT_VERSION,
      rulesVersion: QuotesService.RULES_VERSION,
      createdAt,
      expiresAt,
    };

    this.logger.log(`Cotización ${quoteNumber} OFRECIDA con éxito (Válida hasta ${expiresAt})`);
    return await this.quotesRepository.save(offeredQuote);
  }

  /**
   * Recupera una cotización por su UUID con verificación de expiración dinámica de 15 días.
   */
  public async getQuoteById(id: string): Promise<QuoteSnapshot> {
    const quote = await this.quotesRepository.findById(id);
    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }

    // Expiración dinámica si status === 'OFFERED' y la fecha actual excede expiresAt
    if (quote.status === 'OFFERED' && new Date() > new Date(quote.expiresAt)) {
      this.logger.log(`Cotización ${quote.quoteNumber} marcada dinámicamente como EXPIRED`);
      quote.status = 'EXPIRED';
      return await this.quotesRepository.update(quote);
    }

    return quote;
  }

  /**
   * Vincula (bind) una cotización vigente a póliza:
   * Valida que no esté rechazada, que no haya expirado y que no haya sido vinculada previamente.
   */
  public async bindQuote(id: string, dto: BindQuoteDto): Promise<QuoteSnapshot> {
    if (this.bindingLocks.has(id)) {
      throw new ConflictException('La cotización ya está en proceso de vinculación concurrente.');
    }
    this.bindingLocks.add(id);

    try {
      const quote = await this.quotesRepository.findById(id);
      if (!quote) {
        throw new NotFoundException('Cotización no encontrada');
      }

      // Validación de estado: No elegible / Rechazada
      if (quote.status === 'REJECTED') {
        throw new BadRequestException('No es posible vincular una cotización no elegible.');
      }

      // Validación de estado: Ya vinculada
      if (quote.status === 'BOUND') {
        throw new ConflictException('La cotización ya fue vinculada a una póliza.');
      }

      // Validación de estado: Expirada
      const isExpiredDate = new Date() > new Date(quote.expiresAt);
      if (quote.status === 'EXPIRED' || isExpiredDate) {
        if (quote.status !== 'EXPIRED') {
          quote.status = 'EXPIRED';
          await this.quotesRepository.update(quote);
        }
        throw new BadRequestException(
          'La cotización ha expirado (validez de 15 días). Debe generarse una nueva cotización.',
        );
      }

      // Transición a BOUND
      quote.status = 'BOUND';
      quote.boundAt = new Date().toISOString();

      if (dto.billingFrequency) {
        quote.billingFrequency = dto.billingFrequency;
      }

      this.logger.log(
        `Cotización ${quote.quoteNumber} exitosamente VINCULADA (Método: ${dto.paymentMethodType})`,
      );

      return await this.quotesRepository.update(quote);
    } finally {
      this.bindingLocks.delete(id);
    }
  }
}
