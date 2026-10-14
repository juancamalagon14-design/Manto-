import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PricingService } from './pricing.service';
import { CalculateQuoteDto } from './dto/calculate-quote.dto';
import {
  AddonOption,
  BreedCatalogEntry,
  PricingCalculationResult,
} from './pricing.types';

/**
 * Los dos catálogos llevan `Cache-Control` y su propio cupo de tasa.
 *
 * Al mover razas y coberturas al backend, cada carga del cotizador pasó a
 * gastar dos peticiones del mismo cupo de 120/min que comparten `live-photo`
 * (la llamada costosa a Gemini) y `calculate-quote`. Un usuario que navegue de
 * más podía agotarlo y recibir un 429 justo en el checkout. Son datos
 * estáticos: se cachean y se les da cupo aparte.
 */
@Controller(['v1/pricing', 'pricing'])
@UseFilters(HttpExceptionFilter)
export class PricingController {
  private readonly logger = new Logger(PricingController.name);

  constructor(private readonly pricingService: PricingService) {}

  /**
   * POST /v1/pricing/calculate-quote
   * 
   * Calcula la tarifa base y la cotización total personalizada con coberturas mínimas y add-ons.
   * Valida exhaustivamente el payload con class-validator.
   * Maneja errores y excepciones bajo el estándar RFC 7807 (Problem Details).
   */
  @Post('calculate-quote')
  @HttpCode(HttpStatus.OK)
  public calculateQuote(@Body() dto: CalculateQuoteDto): PricingCalculationResult {
    this.logger.log(
      `Calculando cotización para especie=${dto.species}, raza=${dto.breedCode}, edad=${dto.ageInMonths} meses, ciudad=${dto.city}`,
    );

    // Antes había aquí una rama de compatibilidad
    // (`typeof dto.toPricingCalculationInput === 'function' ? ... : {...}`) con
    // toda una segunda construcción del input a base de `|| 'MEDIUM'`,
    // `?? 0.15` y `?? 0`. Era inalcanzable: con `transform: true` el
    // ValidationPipe global siempre entrega una instancia del DTO. Lo único
    // que hacía era mantener vivos unos valores por defecto que, si algún día
    // llegaban a ejecutarse, habrían tarifado con datos inventados.
    return this.pricingService.calculateQuote(dto.toPricingCalculationInput());
  }

  /**
   * GET /v1/pricing/breeds
   *
   * Catálogo de razas asegurables, servido desde el registro actuarial.
   *
   * Existe para que el frontend deje de mantener su propia lista: esa duplicación
   * causó que el código `PITBULL` del desplegable no existiera en `BREED_REGISTRY`,
   * el backend respondiera 400 y la cotización se calculara con un motor distinto.
   * El catálogo tiene una sola fuente de verdad, y es esta.
   */
  @Get('breeds')
  @Throttle({ catalogos: { ttl: 60_000, limit: 600 } })
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  @HttpCode(HttpStatus.OK)
  public getBreedCatalog(): BreedCatalogEntry[] {
    return this.pricingService.getBreedCatalog();
  }

  /**
   * GET /v1/pricing/special-handling
   *
   * Retorna la lista oficial de razas de manejo especial bajo Ley 1801 de 2016
   * (Art. 127 y ss. del Código Nacional de Seguridad y Convivencia Ciudadana).
   */
  @Get('special-handling')
  @Throttle({ catalogos: { ttl: 60_000, limit: 600 } })
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  @HttpCode(HttpStatus.OK)
  public getSpecialHandlingBreeds(): string[] {
    return this.pricingService.getSpecialHandlingBreeds();
  }

  /**
   * GET /v1/pricing/addons
   *
   * Catálogo de coberturas opcionales con sus topes y días de activación reales.
   *
   * Existe por la misma razón que /breeds: el frontend mantenía su propia copia y
   * los topes se desincronizaron (prometía $1.500.000 en medicamentos cuando la
   * póliza otorga $600.000). Una sola fuente de verdad.
   */
  @Get('addons')
  @Throttle({ catalogos: { ttl: 60_000, limit: 600 } })
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  @HttpCode(HttpStatus.OK)
  public getAddonCatalog(): AddonOption[] {
    return this.pricingService.getAddonCatalog();
  }
}
