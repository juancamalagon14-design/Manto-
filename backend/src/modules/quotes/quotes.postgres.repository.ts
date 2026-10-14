import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { reviveMoney, serializeMoney } from '../../database/money-json';
import { ColombianPeso } from '../../common/types/money';
import { PricingCalculationResult } from '../pricing/pricing.types';
import { EligibilityResult } from '../eligibility/eligibility.types';
import { IQuotesRepository, QuoteSnapshot } from './quotes.types';

/**
 * Las tablas se nombran con su esquema.
 *
 * Antes se confiaba en un `SET search_path` que el pool aplicaba en un handler
 * `on('connect')` sin `await`: funcionaba por la cola FIFO del cliente, `pg`
 * ya lo marca como deprecado, y en `pg@9` dejará de aplicarse —momento en que
 * cada `FROM quotes` sin cualificar empezaría a fallar—. Cualificar no depende
 * de nada asíncrono.
 */
const T = 'insurance.quotes';
const TP = 'insurance.policies';

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Forma cruda de una fila de `insurance.quotes`. */
interface FilaCotizacion {
  id: string;
  quote_number: string;
  status: QuoteSnapshot['status'];
  pet_name: string;
  species: string;
  breed_code: string;
  size_category: string | null;
  age_in_months: number;
  city: string;
  gender: string;
  pets_in_policy: number | null;
  is_sterilized: boolean;
  deductible_percentage: string;
  selected_addon_keys: string[];
  billing_frequency: 'MONTHLY' | 'ANNUAL';
  customer_full_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pricing_result: unknown | null;
  eligibility_result: unknown;
  rejection_reasons: string[] | null;
  product_version: string;
  rules_version: string;
  created_at: Date;
  expires_at: Date;
  bound_at: Date | null;
}

/**
 * Cotizaciones en PostgreSQL.
 *
 * El `pricingResult` se guarda tal cual en `jsonb`: es un documento congelado
 * y reproducible, no un conjunto de campos a normalizar. Lo que se consulta
 * (número, estado, vigencia, datos de la mascota, primas) va en columnas.
 *
 * Al leer, los montos vuelven a `bigint` con `reviveMoney`. Sin eso el
 * snapshot recuperado trae `number` donde el dominio espera `ColombianPeso`, y
 * la primera suma con `addCop` lanza «Cannot mix BigInt and other types».
 */
@Injectable()
export class PostgresQuotesRepository implements IQuotesRepository {
  private readonly logger = new Logger(PostgresQuotesRepository.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private aDominio(f: FilaCotizacion): QuoteSnapshot {
    return {
      id: f.id,
      quoteNumber: f.quote_number,
      status: f.status,
      petData: {
        name: f.pet_name,
        species: f.species as QuoteSnapshot['petData']['species'],
        breedCode: f.breed_code,
        sizeCategory: (f.size_category ?? undefined) as QuoteSnapshot['petData']['sizeCategory'],
        ageInMonths: f.age_in_months,
        city: f.city as QuoteSnapshot['petData']['city'],
        gender: f.gender as QuoteSnapshot['petData']['gender'],
        isSterilized: f.is_sterilized,
        petsInPolicy: f.pets_in_policy ?? undefined,
      },
      selectedDeductiblePercentage: Number(
        f.deductible_percentage,
      ) as QuoteSnapshot['selectedDeductiblePercentage'],
      selectedAddonKeys: f.selected_addon_keys as QuoteSnapshot['selectedAddonKeys'],
      billingFrequency: f.billing_frequency,
      customer: {
        fullName: f.customer_full_name ?? undefined,
        email: f.customer_email ?? undefined,
        phone: f.customer_phone ?? undefined,
      },
      pricingResult: f.pricing_result
        ? reviveMoney<PricingCalculationResult>(f.pricing_result)
        : null,
      eligibilityResult: reviveMoney<EligibilityResult>(f.eligibility_result),
      productVersion: f.product_version,
      rulesVersion: f.rules_version,
      createdAt: f.created_at.toISOString(),
      expiresAt: f.expires_at.toISOString(),
      boundAt: f.bound_at ? f.bound_at.toISOString() : undefined,
      rejectionReasons: f.rejection_reasons ?? undefined,
    };
  }

  private parametros(q: QuoteSnapshot): unknown[] {
    const total = q.pricingResult?.totalMonthlyPremiumCop;
    const anual = q.pricingResult?.totalAnnualPremiumCop;
    return [
      q.id,
      q.quoteNumber,
      q.status,
      q.petData.name,
      q.petData.species,
      q.petData.breedCode,
      q.petData.sizeCategory ?? null,
      q.petData.ageInMonths,
      q.petData.city,
      q.petData.gender,
      q.petData.petsInPolicy ?? null,
      q.petData.isSterilized,
      q.selectedDeductiblePercentage,
      q.selectedAddonKeys,
      q.billingFrequency,
      q.customer.fullName ?? null,
      q.customer.email ?? null,
      q.customer.phone ?? null,
      // bigint a texto: `pg` no serializa BigInt y `Number()` perdería
      // precisión por encima de 2^53. Postgres lo castea a bigint.
      total !== undefined && total !== null ? String(total) : null,
      anual !== undefined && anual !== null ? String(anual) : null,
      q.pricingResult ? serializeMoney(q.pricingResult) : null,
      serializeMoney(q.eligibilityResult),
      q.rejectionReasons ?? null,
      q.productVersion,
      q.rulesVersion,
      q.createdAt,
      q.expiresAt,
      q.boundAt ?? null,
    ];
  }

  private static readonly COLUMNAS = `
    id, quote_number, status,
    pet_name, species, breed_code, size_category, age_in_months, city, gender,
    pets_in_policy, is_sterilized,
    deductible_percentage, selected_addon_keys, billing_frequency,
    customer_full_name, customer_email, customer_phone,
    total_monthly_premium_cop, total_annual_premium_cop,
    pricing_result, eligibility_result, rejection_reasons,
    product_version, rules_version,
    created_at, expires_at, bound_at`;

  private static readonly PLACEHOLDERS = Array.from({ length: 28 }, (_, i) => `$${i + 1}`).join(', ');

  /**
   * `save` inserta y `update` actualiza. Separados, y la separación es el
   * arreglo de un defecto concreto.
   *
   * Los dos compartían un `INSERT … ON CONFLICT (id) DO UPDATE SET` con una
   * lista corta de columnas mutables, y todo lo que no estuviera en esa lista
   * se descartaba **en silencio**: el método devolvía el `RETURNING`, así que
   * el llamador recibía un objeto de aspecto correcto y creía haber guardado.
   * `bindQuote` cambiaba `billingFrequency` a ANNUAL y la API respondía 200 con
   * MONTHLY; un cambio de add-ons movía `selected_addon_keys` pero dejaba
   * `pricing_result` —el documento congelado que justifica la prima— diciendo
   * otra cosa.
   *
   * Con las dos operaciones separadas, `update` escribe todo lo que el dominio
   * puede cambiar legítimamente, y un `id` repetido en `save` falla en vez de
   * convertirse en una actualización silenciosa.
   */
  public async save(quote: QuoteSnapshot): Promise<QuoteSnapshot> {
    const sql = `
      INSERT INTO ${T} (${PostgresQuotesRepository.COLUMNAS})
      VALUES (${PostgresQuotesRepository.PLACEHOLDERS})
      RETURNING ${PostgresQuotesRepository.COLUMNAS}`;

    const { rows } = await this.pool.query<FilaCotizacion>(sql, this.parametros(quote));
    return this.aDominio(rows[0]);
  }

  /**
   * Lo inmutable de una cotización es su identidad y su origen: `id`,
   * `quote_number`, `created_at`. Todo lo demás puede cambiar —al vincular, al
   * recalcular con otros amparos, al completar los datos del titular— y cuando
   * cambia, el `pricing_result` tiene que moverse con ello. Que la prima y los
   * amparos contratados pudieran quedar desincronizados era el defecto.
   */
  public async update(quote: QuoteSnapshot): Promise<QuoteSnapshot> {
    const total = quote.pricingResult?.totalMonthlyPremiumCop;
    const anual = quote.pricingResult?.totalAnnualPremiumCop;

    // Lista de parámetros propia, no una reutilización posicional de
    // `parametros()`: aparear a mano un `SET` con el orden de otra sentencia es
    // exactamente el tipo de error que no avisa cuando se desplaza una columna.
    const sql = `
      UPDATE ${T} SET
        status                    = $2,
        pet_name                  = $3,
        species                   = $4,
        breed_code                = $5,
        size_category             = $6,
        age_in_months             = $7,
        city                      = $8,
        gender                    = $9,
        pets_in_policy            = $10,
        is_sterilized             = $11,
        deductible_percentage     = $12,
        selected_addon_keys       = $13,
        billing_frequency         = $14,
        customer_full_name        = $15,
        customer_email            = $16,
        customer_phone            = $17,
        total_monthly_premium_cop = $18,
        total_annual_premium_cop  = $19,
        pricing_result            = $20,
        eligibility_result        = $21,
        rejection_reasons         = $22,
        product_version           = $23,
        rules_version             = $24,
        expires_at                = $25,
        bound_at                  = $26
      WHERE id = $1
      RETURNING ${PostgresQuotesRepository.COLUMNAS}`;

    const { rows } = await this.pool.query<FilaCotizacion>(sql, [
      quote.id,
      quote.status,
      quote.petData.name,
      quote.petData.species,
      quote.petData.breedCode,
      quote.petData.sizeCategory ?? null,
      quote.petData.ageInMonths,
      quote.petData.city,
      quote.petData.gender,
      quote.petData.petsInPolicy ?? null,
      quote.petData.isSterilized,
      quote.selectedDeductiblePercentage,
      quote.selectedAddonKeys,
      quote.billingFrequency,
      quote.customer.fullName ?? null,
      quote.customer.email ?? null,
      quote.customer.phone ?? null,
      total !== undefined && total !== null ? String(total) : null,
      anual !== undefined && anual !== null ? String(anual) : null,
      quote.pricingResult ? serializeMoney(quote.pricingResult) : null,
      serializeMoney(quote.eligibilityResult),
      quote.rejectionReasons ?? null,
      quote.productVersion,
      quote.rulesVersion,
      quote.expiresAt,
      quote.boundAt ?? null,
    ]);
    if (rows.length === 0) {
      throw new Error(
        `No existe la cotización ${quote.id}: un update sobre una fila ausente no ` +
          'se convierte en insert silencioso.',
      );
    }
    return this.aDominio(rows[0]);
  }

  /**
   * Supresión de datos personales (Ley 1581 de 2012, art. 8 lit. e).
   *
   * Una cotización que no produjo póliza no tiene deber legal ni contractual de
   * permanecer, así que se borra la fila entera. Si ya produjo póliza, la clave
   * ajena lo impide y la supresión va por la póliza, que sí tiene deber de
   * conservación y se anonimiza en vez de borrarse.
   */
  public async suprimirDatosPersonales(id: string): Promise<'BORRADA' | 'TIENE_POLIZA'> {
    if (!ES_UUID.test(id)) return 'BORRADA';
    const { rowCount } = await this.pool.query(
      `DELETE FROM ${T}
        WHERE id = $1
          AND NOT EXISTS (SELECT 1 FROM ${TP} WHERE quote_id = $1)`,
      [id],
    );
    return rowCount && rowCount > 0 ? 'BORRADA' : 'TIENE_POLIZA';
  }

  public async findById(id: string): Promise<QuoteSnapshot | null> {
    // Un id que no es UUID hace que Postgres lance 22P02 en vez de no
    // encontrar nada: se trata como «no existe», que es lo que significa.
    if (!ES_UUID.test(id)) {
      return null;
    }
    const { rows } = await this.pool.query<FilaCotizacion>(
      `SELECT ${PostgresQuotesRepository.COLUMNAS} FROM ${T} WHERE id = $1`,
      [id],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findByQuoteNumber(quoteNumber: string): Promise<QuoteSnapshot | null> {
    const { rows } = await this.pool.query<FilaCotizacion>(
      `SELECT ${PostgresQuotesRepository.COLUMNAS} FROM ${T} WHERE quote_number = $1`,
      [quoteNumber],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  /** Solo para pruebas de integración. */
  public async clear(): Promise<void> {
    await this.pool.query(`TRUNCATE ${T}, ${TP}, insurance.claims CASCADE`);
  }

  /** Suma de primas emitidas, para reportería. Usa las columnas, no el jsonb. */
  public async totalPrimaMensualOfrecida(): Promise<ColombianPeso> {
    const { rows } = await this.pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(total_monthly_premium_cop), 0)::text AS total
         FROM ${T} WHERE status IN ('OFFERED', 'BOUND')`,
    );
    return BigInt(rows[0].total ?? '0') as ColombianPeso;
  }
}
