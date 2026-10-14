import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { ClaimDraftEntity, IClaimsDraftRepository } from './claim-draft.types';

const T = 'insurance.claim_drafts';

interface FilaDraft {
  user_id: string;
  id: string;
  policy_id: string;
  current_step: number;
  form_data: unknown;
  saved_at_timestamp: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

@Injectable()
export class PostgresClaimsDraftRepository implements IClaimsDraftRepository {
  private readonly logger = new Logger(PostgresClaimsDraftRepository.name);
  private tableEnsured = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${T} (
          user_id text PRIMARY KEY,
          id uuid NOT NULL,
          policy_id text NOT NULL,
          current_step integer NOT NULL,
          form_data jsonb NOT NULL,
          saved_at_timestamp bigint NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_claim_drafts_policy_id ON ${T} (policy_id);
        CREATE INDEX IF NOT EXISTS idx_claim_drafts_expires_at ON ${T} (expires_at);
      `);
      this.tableEnsured = true;
    } catch (err) {
      this.logger.error(`Error asegurando tabla ${T}: ${(err as Error).message}`);
    }
  }

  public async save(draft: ClaimDraftEntity): Promise<ClaimDraftEntity> {
    await this.ensureTable();

    const sql = `
      INSERT INTO ${T} (
        user_id, id, policy_id, current_step, form_data,
        saved_at_timestamp, created_at, updated_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        policy_id = EXCLUDED.policy_id,
        current_step = EXCLUDED.current_step,
        form_data = EXCLUDED.form_data,
        saved_at_timestamp = EXCLUDED.saved_at_timestamp,
        updated_at = EXCLUDED.updated_at,
        expires_at = EXCLUDED.expires_at
      RETURNING *;
    `;

    await this.pool.query(sql, [
      draft.userId,
      draft.id,
      draft.policyId,
      draft.currentStep,
      JSON.stringify(draft.formData),
      draft.savedAtTimestamp,
      draft.createdAt,
      draft.updatedAt,
      draft.expiresAt,
    ]);

    return draft;
  }

  public async findByUserId(userId: string): Promise<ClaimDraftEntity | null> {
    await this.ensureTable();

    const sql = `
      SELECT * FROM ${T}
      WHERE (user_id = $1 OR policy_id = $1) AND expires_at > now()
      ORDER BY updated_at DESC
      LIMIT 1;
    `;

    const { rows } = await this.pool.query<FilaDraft>(sql, [userId]);
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      policyId: row.policy_id,
      currentStep: row.current_step,
      formData: typeof row.form_data === 'string' ? JSON.parse(row.form_data) : (row.form_data as Record<string, unknown>),
      savedAtTimestamp: Number(row.saved_at_timestamp),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    };
  }

  public async deleteByUserId(userId: string): Promise<boolean> {
    await this.ensureTable();

    const sql = `DELETE FROM ${T} WHERE user_id = $1 OR policy_id = $1`;
    const result = await this.pool.query(sql, [userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
