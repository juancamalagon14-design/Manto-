import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { copDesdeColumna, reviveMoney, serializeMoney } from '../../database/money-json';
import { QuotePetData } from '../quotes/quotes.types';
import { IPoliciesRepository, PolicyCoverage, PolicyEntity } from './policies.types';

interface FilaPoliza {
  id: string;
  policy_number: string | null;
  quote_id: string;
  quote_number: string;
  status: PolicyEntity['status'];
  customer_full_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_national_id: string | null;
  pet_data: unknown;
  coverages: unknown;
  monthly_premium_cop: string;
  annual_premium_cop: string;
  billing_frequency: 'MONTHLY' | 'ANNUAL';
  effective_date: Date | null;
  expiration_date: Date | null;
  policy_certificate_hash: string | null;
  rules_version: string;
  auto_renewal_enabled: boolean;
  grace_period_ends_at: Date | null;
  last_payment_transaction_id: string | null;
  cancellation_reason: string | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las tablas van cualificadas: no se depende de `search_path`. */
const T = 'insurance.policies';

/**
 * Con qué se reemplazan los datos del titular al ejercer el derecho de
 * supresión. No se ponen en nulo: una póliza sin correo rompe el tipo
 * `PolicyCustomer` del dominio, y además conviene que la fila diga
 * explícitamente que hubo una supresión y no que quedó incompleta.
 */
const TITULAR_SUPRIMIDO = {
  nombre: 'Titular con datos suprimidos (Ley 1581)',
  correo: 'suprimido@manto.invalid',
};

/**
 * Pólizas en PostgreSQL.
 *
 * `pet_data` y `coverages` van en `jsonb`: las coberturas emitidas son parte
 * del contrato y se guardan tal como se emitieron, con su tope, su carencia y
 * su copago. Lo que se consulta y se reporta va en columnas.
 *
 * Dos garantías se movieron del servicio a la base:
 *   · `UNIQUE (quote_id)` — una cotización no puede producir dos pólizas.
 *     Antes era una consulta previa, o sea una condición de carrera.
 *   · `CHECK (activa_esta_completa)` — una póliza ACTIVE tiene número,
 *     vigencia y hash de certificado. Sin excepción.
 */
@Injectable()
export class PostgresPoliciesRepository implements IPoliciesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private static readonly COLUMNAS = `
    id, policy_number, quote_id, quote_number, status,
    customer_full_name, customer_email, customer_phone, customer_national_id,
    pet_data, coverages,
    monthly_premium_cop, annual_premium_cop, billing_frequency,
    effective_date, expiration_date, policy_certificate_hash,
    rules_version, auto_renewal_enabled,
    grace_period_ends_at, last_payment_transaction_id,
    cancellation_reason, cancelled_at,
    created_at, updated_at`;

  private static readonly PLACEHOLDERS = Array.from({ length: 25 }, (_, i) => `$${i + 1}`).join(', ');

  private aDominio(f: FilaPoliza): PolicyEntity {
    return {
      id: f.id,
      policyNumber: f.policy_number ?? undefined,
      quoteId: f.quote_id,
      quoteNumber: f.quote_number,
      status: f.status,
      customer: {
        fullName: f.customer_full_name,
        email: f.customer_email,
        phone: f.customer_phone ?? undefined,
        nationalId: f.customer_national_id ?? undefined,
      },
      petData: reviveMoney<QuotePetData>(f.pet_data),
      coverages: reviveMoney<PolicyCoverage[]>(f.coverages),
      monthlyPremiumCop: copDesdeColumna(f.monthly_premium_cop),
      annualPremiumCop: copDesdeColumna(f.annual_premium_cop),
      billingFrequency: f.billing_frequency,
      effectiveDate: f.effective_date ? f.effective_date.toISOString() : undefined,
      expirationDate: f.expiration_date ? f.expiration_date.toISOString() : undefined,
      policyCertificateHash: f.policy_certificate_hash ?? undefined,
      rulesVersion: f.rules_version,
      autoRenewalEnabled: f.auto_renewal_enabled,
      gracePeriodEndsAt: f.grace_period_ends_at ? f.grace_period_ends_at.toISOString() : undefined,
      lastPaymentTransactionId: f.last_payment_transaction_id ?? undefined,
      cancellationReason: f.cancellation_reason ?? undefined,
      cancelledAt: f.cancelled_at ? f.cancelled_at.toISOString() : undefined,
      createdAt: f.created_at.toISOString(),
      updatedAt: f.updated_at.toISOString(),
    };
  }

  private parametros(p: PolicyEntity): unknown[] {
    return [
      p.id,
      p.policyNumber ?? null,
      p.quoteId,
      p.quoteNumber,
      p.status,
      p.customer.fullName,
      p.customer.email,
      p.customer.phone ?? null,
      p.customer.nationalId ?? null,
      serializeMoney(p.petData),
      serializeMoney(p.coverages),
      String(p.monthlyPremiumCop),
      String(p.annualPremiumCop),
      p.billingFrequency,
      p.effectiveDate ?? null,
      p.expirationDate ?? null,
      p.policyCertificateHash ?? null,
      p.rulesVersion,
      p.autoRenewalEnabled,
      p.gracePeriodEndsAt ?? null,
      p.lastPaymentTransactionId ?? null,
      p.cancellationReason ?? null,
      p.cancelledAt ?? null,
      p.createdAt,
      p.updatedAt,
    ];
  }

  public async save(policy: PolicyEntity): Promise<PolicyEntity> {
    const sql = `
      INSERT INTO ${T} (${PostgresPoliciesRepository.COLUMNAS})
      VALUES (${PostgresPoliciesRepository.PLACEHOLDERS})
      RETURNING ${PostgresPoliciesRepository.COLUMNAS}`;

    const { rows } = await this.pool.query<FilaPoliza>(sql, this.parametros(policy));
    return this.aDominio(rows[0]);
  }

  /**
   * Lo que una póliza puede cambiar.
   *
   * Antes esto era un `ON CONFLICT (id) DO UPDATE SET` con doce columnas, y
   * las que faltaban se descartaban sin decir nada mientras el método devolvía
   * el `RETURNING`: corregir el correo del titular —por donde se entrega el
   * certificado— o rectificar una cuota eran operaciones que respondían bien y
   * no guardaban nada. Aquí se escribe todo lo mutable, y lo inmutable es lo
   * que identifica la póliza y su origen: `id`, `quote_id`, `quote_number` y
   * `created_at`.
   *
   * Que `coverages` sea mutable ya no permite evadir la Ley 1801: el trigger
   * `policies_exigir_rce_ley_1801` rechaza cualquier escritura que deje a una
   * raza de manejo especial sin su amparo obligatorio.
   */
  public async update(policy: PolicyEntity): Promise<PolicyEntity> {
    // Lista de parámetros propia, no una reutilización posicional de
    // `parametros()`: aparear a mano un `SET` con el orden de otra sentencia es
    // exactamente el tipo de error que no avisa cuando se desplaza una columna.
    const sql = `
      UPDATE ${T} SET
        policy_number               = $2,
        status                      = $3,
        customer_full_name          = $4,
        customer_email              = $5,
        customer_phone              = $6,
        customer_national_id        = $7,
        pet_data                    = $8,
        coverages                   = $9,
        monthly_premium_cop         = $10,
        annual_premium_cop          = $11,
        billing_frequency           = $12,
        effective_date              = $13,
        expiration_date             = $14,
        policy_certificate_hash     = $15,
        rules_version               = $16,
        auto_renewal_enabled        = $17,
        grace_period_ends_at        = $18,
        last_payment_transaction_id = $19,
        cancellation_reason         = $20,
        cancelled_at                = $21,
        updated_at                  = $22
      WHERE id = $1
      RETURNING ${PostgresPoliciesRepository.COLUMNAS}`;

    const { rows } = await this.pool.query<FilaPoliza>(sql, [
      policy.id,
      policy.policyNumber ?? null,
      policy.status,
      policy.customer.fullName,
      policy.customer.email,
      policy.customer.phone ?? null,
      policy.customer.nationalId ?? null,
      serializeMoney(policy.petData),
      serializeMoney(policy.coverages),
      String(policy.monthlyPremiumCop),
      String(policy.annualPremiumCop),
      policy.billingFrequency,
      policy.effectiveDate ?? null,
      policy.expirationDate ?? null,
      policy.policyCertificateHash ?? null,
      policy.rulesVersion,
      policy.autoRenewalEnabled,
      policy.gracePeriodEndsAt ?? null,
      policy.lastPaymentTransactionId ?? null,
      policy.cancellationReason ?? null,
      policy.cancelledAt ?? null,
      policy.updatedAt,
    ]);
    if (rows.length === 0) {
      throw new Error(
        `No existe la póliza ${policy.id}: un update sobre una fila ausente no se ` +
          'convierte en insert silencioso.',
      );
    }
    return this.aDominio(rows[0]);
  }

  /**
   * Supresión de datos personales (Ley 1581 de 2012, art. 8 lit. e).
   *
   * Una póliza no se borra: hay deber legal y contractual de conservar el
   * expediente —la prima cobrada, los amparos emitidos, la vigencia— y el
   * derecho de supresión no alcanza a lo que se debe conservar. Lo que se hace
   * es anonimizar: la fila conserva todo su valor actuarial y contable y deja
   * de identificar a una persona.
   *
   * El nombre de la mascota se conserva a propósito: es el objeto asegurado y
   * parte del contrato, no un dato del titular.
   */
  public async suprimirDatosPersonales(id: string): Promise<boolean> {
    if (!ES_UUID.test(id)) return false;
    const { rowCount } = await this.pool.query(
      `UPDATE ${T} SET
         customer_full_name   = $2,
         customer_email       = $3,
         customer_phone       = NULL,
         customer_national_id = NULL,
         pii_suprimida_en     = now(),
         updated_at           = now()
       WHERE id = $1`,
      [id, TITULAR_SUPRIMIDO.nombre, TITULAR_SUPRIMIDO.correo],
    );
    return Boolean(rowCount && rowCount > 0);
  }

  public async findById(id: string): Promise<PolicyEntity | null> {
    if (!ES_UUID.test(id)) return null;
    const { rows } = await this.pool.query<FilaPoliza>(
      `SELECT ${PostgresPoliciesRepository.COLUMNAS} FROM ${T} WHERE id = $1`,
      [id],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findByPolicyNumber(policyNumber: string): Promise<PolicyEntity | null> {
    const { rows } = await this.pool.query<FilaPoliza>(
      `SELECT ${PostgresPoliciesRepository.COLUMNAS} FROM ${T} WHERE policy_number = $1`,
      [policyNumber],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findByQuoteId(quoteId: string): Promise<PolicyEntity | null> {
    if (!ES_UUID.test(quoteId)) return null;
    const { rows } = await this.pool.query<FilaPoliza>(
      `SELECT ${PostgresPoliciesRepository.COLUMNAS} FROM ${T} WHERE quote_id = $1`,
      [quoteId],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findAll(): Promise<PolicyEntity[]> {
    const { rows } = await this.pool.query<FilaPoliza>(
      `SELECT ${PostgresPoliciesRepository.COLUMNAS} FROM ${T} ORDER BY created_at DESC`,
    );
    return rows.map((f) => this.aDominio(f));
  }

  /**
   * Pólizas cuya vigencia venció y siguen marcadas como activas.
   *
   * En memoria esto exigía traer todas y filtrar en Node. Con un índice sobre
   * `expiration_date` es una consulta, y es la que necesita el proceso de
   * renovación cuando exista.
   */
  public async findVencidasActivas(referencia: Date = new Date()): Promise<PolicyEntity[]> {
    const { rows } = await this.pool.query<FilaPoliza>(
      `SELECT ${PostgresPoliciesRepository.COLUMNAS}
         FROM ${T}
        WHERE status = 'ACTIVE' AND expiration_date < $1
        ORDER BY expiration_date`,
      [referencia.toISOString()],
    );
    return rows.map((f) => this.aDominio(f));
  }
}
