import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { copDesdeColumna, reviveMoney, serializeMoney } from '../../database/money-json';
import { BreBKey } from '../reimbursements/reimbursements.types';
import {
  ClaimEntity,
  DianInvoiceData,
  IClaimsRepository,
  StpEvaluationResult,
} from './claims.types';

interface FilaSiniestro {
  id: string;
  claim_number: string;
  policy_id: string;
  policy_number: string;
  status: ClaimEntity['status'];
  incident_type: ClaimEntity['incidentType'];
  incident_date: Date;
  description: string;
  dian_cufe: string;
  dian_invoice: unknown;
  clinical_record: unknown | null;
  bre_b_key_type: BreBKey['type'] | null;
  bre_b_key_value: string | null;
  eligible_expenses_cop: string;
  deductible_cop: string;
  net_reimbursement_cop: string;
  stp_evaluation: unknown;
  sla_category: string | null;
  sla_resolution_estimated_time: string | null;
  triage_route: string | null;
  triage_reasons: string[] | null;
  claimed_amount_cop: string | null;
  approved_amount_cop: string | null;
  disbursement_id: string | null;
  disbursement_tracking_code: string | null;
  financial_institution: string | null;
  submitted_at: Date;
  adjudicated_at: Date | null;
  adjudicated_by: string | null;
  rejection_reason: string | null;
  audit_notes: string | null;
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las tablas van cualificadas: no se depende de `search_path`. */
const T = 'insurance.claims';

/**
 * Siniestros en PostgreSQL.
 *
 * La factura de la DIAN, la Historia Clínica y la decisión del motor STP se
 * guardan en `jsonb`: son el expediente de por qué se pagó o no se pagó, y se
 * releen tal como se tomaron.
 *
 * `dian_cufe` es UNIQUE en la base. Antes la duplicidad se revisaba con una
 * consulta previa en el servicio, que dos radicaciones simultáneas de la misma
 * factura podían burlar: la ventana entre el `findByCufe` y el `save`. Ahora
 * la segunda inserción falla, y eso es lo correcto para un control antifraude.
 */
@Injectable()
export class PostgresClaimsRepository implements IClaimsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private static readonly COLUMNAS = `
    id, claim_number, policy_id, policy_number, status,
    incident_type, incident_date, description,
    dian_cufe, dian_invoice, clinical_record, bre_b_key_type, bre_b_key_value,
    eligible_expenses_cop, deductible_cop, net_reimbursement_cop,
    stp_evaluation, sla_category, sla_resolution_estimated_time,
    triage_route, triage_reasons, claimed_amount_cop, approved_amount_cop,
    disbursement_id, disbursement_tracking_code, financial_institution,
    submitted_at, adjudicated_at, adjudicated_by, rejection_reason, audit_notes`;

  private static readonly PLACEHOLDERS = Array.from({ length: 31 }, (_, i) => `$${i + 1}`).join(', ');

  private aDominio(f: FilaSiniestro): ClaimEntity {
    return {
      id: f.id,
      claimNumber: f.claim_number,
      policyId: f.policy_id,
      policyNumber: f.policy_number,
      status: f.status,
      incidentType: f.incident_type,
      incidentDate: f.incident_date.toISOString(),
      description: f.description,
      dianInvoice: reviveMoney<DianInvoiceData>(f.dian_invoice),
      clinicalRecord: f.clinical_record ? reviveMoney(f.clinical_record) : undefined,
      breBKey: {
        type: f.bre_b_key_type as BreBKey['type'],
        value: f.bre_b_key_value as string,
      },
      eligibleExpensesCop: copDesdeColumna(f.eligible_expenses_cop),
      deductibleCop: copDesdeColumna(f.deductible_cop),
      netReimbursementCop: copDesdeColumna(f.net_reimbursement_cop),
      stpEvaluation: reviveMoney<StpEvaluationResult>(f.stp_evaluation),
      slaCategory: (f.sla_category as any) ?? undefined,
      slaResolutionEstimatedTime: f.sla_resolution_estimated_time ?? undefined,
      triageRoute: (f.triage_route as any) ?? undefined,
      triageReasons: f.triage_reasons ?? undefined,
      claimedAmountCop: f.claimed_amount_cop ? copDesdeColumna(f.claimed_amount_cop) : undefined,
      approvedAmountCop: f.approved_amount_cop ? copDesdeColumna(f.approved_amount_cop) : undefined,
      disbursementId: f.disbursement_id ?? undefined,
      disbursementTrackingCode: f.disbursement_tracking_code ?? undefined,
      financialInstitution: f.financial_institution ?? undefined,
      submittedAt: f.submitted_at.toISOString(),
      adjudicatedAt: f.adjudicated_at ? f.adjudicated_at.toISOString() : undefined,
      adjudicatedBy: f.adjudicated_by ?? undefined,
      rejectionReason: f.rejection_reason ?? undefined,
      auditNotes: f.audit_notes ?? undefined,
    };
  }

  private parametros(c: ClaimEntity): unknown[] {
    return [
      c.id,
      c.claimNumber,
      c.policyId,
      c.policyNumber,
      c.status,
      c.incidentType,
      c.incidentDate,
      c.description,
      c.dianInvoice.dianCufe,
      serializeMoney(c.dianInvoice),
      c.clinicalRecord ? serializeMoney(c.clinicalRecord) : null,
      c.breBKey.type,
      c.breBKey.value,
      String(c.eligibleExpensesCop),
      String(c.deductibleCop),
      String(c.netReimbursementCop),
      serializeMoney(c.stpEvaluation),
      c.slaCategory ?? null,
      c.slaResolutionEstimatedTime ?? null,
      c.triageRoute ?? null,
      c.triageReasons ?? null,
      c.claimedAmountCop ? String(c.claimedAmountCop) : null,
      c.approvedAmountCop ? String(c.approvedAmountCop) : null,
      c.disbursementId ?? null,
      c.disbursementTrackingCode ?? null,
      c.financialInstitution ?? null,
      c.submittedAt,
      c.adjudicatedAt ?? null,
      c.adjudicatedBy ?? null,
      c.rejectionReason ?? null,
      c.auditNotes ?? null,
    ];
  }

  public async save(claim: ClaimEntity): Promise<ClaimEntity> {
    const sql = `
      INSERT INTO ${T} (${PostgresClaimsRepository.COLUMNAS})
      VALUES (${PostgresClaimsRepository.PLACEHOLDERS})
      RETURNING ${PostgresClaimsRepository.COLUMNAS}`;

    const { rows } = await this.pool.query<FilaSiniestro>(sql, this.parametros(claim));
    return this.aDominio(rows[0]);
  }

  /**
   * Lo que un siniestro puede cambiar durante su adjudicación.
   *
   * Lo que NO cambia es el expediente de lo radicado: el CUFE, la factura, el
   * tipo y la fecha del incidente, la descripción, el gasto elegible y el
   * momento de radicación. Que estén fuera del `SET` no es un olvido: si el
   * dominio intenta cambiarlos, el cambio se ignora y eso es lo correcto, pero
   * ninguna ruta lo intenta.
   */
  public async update(claim: ClaimEntity): Promise<ClaimEntity> {
    // Lista de parámetros propia, no una reutilización posicional de
    // `parametros()`: aparear a mano un `SET` con el orden de otra sentencia es
    // exactamente el tipo de error que no avisa cuando se desplaza una columna.
    const sql = `
      UPDATE ${T} SET
        status                        = $2,
        deductible_cop                = $3,
        net_reimbursement_cop         = $4,
        stp_evaluation                = $5,
        triage_route                  = $6,
        triage_reasons                = $7,
        approved_amount_cop           = $8,
        disbursement_id               = $9,
        disbursement_tracking_code    = $10,
        financial_institution         = $11,
        adjudicated_at                = $12,
        adjudicated_by                = $13,
        rejection_reason              = $14,
        audit_notes                   = $15,
        sla_category                  = $16,
        sla_resolution_estimated_time = $17
      WHERE id = $1
      RETURNING ${PostgresClaimsRepository.COLUMNAS}`;

    const { rows } = await this.pool.query<FilaSiniestro>(sql, [
      claim.id,
      claim.status,
      String(claim.deductibleCop),
      String(claim.netReimbursementCop),
      serializeMoney(claim.stpEvaluation),
      claim.triageRoute ?? null,
      claim.triageReasons ?? null,
      claim.approvedAmountCop ? String(claim.approvedAmountCop) : null,
      claim.disbursementId ?? null,
      claim.disbursementTrackingCode ?? null,
      claim.financialInstitution ?? null,
      claim.adjudicatedAt ?? null,
      claim.adjudicatedBy ?? null,
      claim.rejectionReason ?? null,
      claim.auditNotes ?? null,
      claim.slaCategory ?? null,
      claim.slaResolutionEstimatedTime ?? null,
    ]);
    if (rows.length === 0) {
      throw new Error(
        `No existe el siniestro ${claim.id}: un update sobre una fila ausente no se ` +
          'convierte en insert silencioso.',
      );
    }
    return this.aDominio(rows[0]);
  }

  /**
   * Supresión de datos personales (Ley 1581 de 2012, art. 8 lit. e).
   *
   * El siniestro se conserva —es soporte contable y actuarial— pero la llave
   * Bre-B se vacía: su valor es una cédula, un teléfono o un correo del titular,
   * y además un identificador financiero. Por eso está en columnas y no dentro
   * del `jsonb` de la factura, donde no se podría borrar sin romper el
   * documento congelado.
   *
   * La factura de la DIAN se conserva completa: los datos que lleva son del
   * prestador veterinario (NIT y razón social) y del acto médico, no del
   * titular.
   */
  public async suprimirDatosPersonales(policyId: string): Promise<number> {
    if (!ES_UUID.test(policyId)) return 0;
    const { rowCount } = await this.pool.query(
      `UPDATE ${T} SET
         bre_b_key_type   = NULL,
         bre_b_key_value  = NULL,
         pii_suprimida_en = now()
       WHERE policy_id = $1`,
      [policyId],
    );
    return rowCount ?? 0;
  }

  public async findById(id: string): Promise<ClaimEntity | null> {
    if (!ES_UUID.test(id)) return null;
    const { rows } = await this.pool.query<FilaSiniestro>(
      `SELECT ${PostgresClaimsRepository.COLUMNAS} FROM ${T} WHERE id = $1`,
      [id],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findByClaimNumber(claimNumber: string): Promise<ClaimEntity | null> {
    const { rows } = await this.pool.query<FilaSiniestro>(
      `SELECT ${PostgresClaimsRepository.COLUMNAS} FROM ${T} WHERE claim_number = $1`,
      [claimNumber],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findByPolicyId(policyId: string): Promise<ClaimEntity[]> {
    if (!ES_UUID.test(policyId)) return [];
    const { rows } = await this.pool.query<FilaSiniestro>(
      `SELECT ${PostgresClaimsRepository.COLUMNAS}
         FROM ${T} WHERE policy_id = $1 ORDER BY submitted_at DESC`,
      [policyId],
    );
    return rows.map((f) => this.aDominio(f));
  }

  public async findByCufe(cufe: string): Promise<ClaimEntity | null> {
    const { rows } = await this.pool.query<FilaSiniestro>(
      `SELECT ${PostgresClaimsRepository.COLUMNAS} FROM ${T} WHERE dian_cufe = $1`,
      [cufe],
    );
    return rows.length ? this.aDominio(rows[0]) : null;
  }

  public async findAll(): Promise<ClaimEntity[]> {
    const { rows } = await this.pool.query<FilaSiniestro>(
      `SELECT ${PostgresClaimsRepository.COLUMNAS} FROM ${T} ORDER BY submitted_at DESC`,
    );
    return rows.map((f) => this.aDominio(f));
  }
}
