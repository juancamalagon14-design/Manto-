import { Injectable } from '@nestjs/common';
import { ClaimDraftEntity, IClaimsDraftRepository } from './claim-draft.types';

/**
 * Repositorio de borradores de reclamos en memoria con expiración por TTL (24h).
 * Utilizado en ambientes de desarrollo y pruebas unitarias sin PostgreSQL.
 */
@Injectable()
export class InMemoryClaimsDraftRepository implements IClaimsDraftRepository {
  private readonly drafts = new Map<string, ClaimDraftEntity>();

  public async save(draft: ClaimDraftEntity): Promise<ClaimDraftEntity> {
    this.drafts.set(draft.userId, draft);
    return draft;
  }

  public async findByUserId(userId: string): Promise<ClaimDraftEntity | null> {
    // Buscar directamente por userId
    let draft = this.drafts.get(userId);

    // Si no se encuentra, buscar por policyId asociado
    if (!draft) {
      for (const item of this.drafts.values()) {
        if (item.policyId === userId) {
          draft = item;
          break;
        }
      }
    }

    if (!draft) {
      return null;
    }

    // Validación estricta de expiración TTL (24 horas)
    const now = Date.now();
    const expiresAtMs = new Date(draft.expiresAt).getTime();
    if (now >= expiresAtMs) {
      this.drafts.delete(draft.userId);
      return null;
    }

    return draft;
  }

  public async deleteByUserId(userId: string): Promise<boolean> {
    let deleted = this.drafts.delete(userId);

    // También limpiar si coincide con policyId
    for (const [key, item] of this.drafts.entries()) {
      if (item.policyId === userId) {
        this.drafts.delete(key);
        deleted = true;
      }
    }

    return deleted;
  }

  public clear(): void {
    this.drafts.clear();
  }
}
