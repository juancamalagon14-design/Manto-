import { Injectable } from '@nestjs/common';
import { ClaimEntity, IClaimsRepository } from './claims.types';

@Injectable()
export class InMemoryClaimsRepository implements IClaimsRepository {
  private readonly claims = new Map<string, ClaimEntity>();

  private clone(claim: ClaimEntity): ClaimEntity {
    if (typeof structuredClone === 'function') {
      return structuredClone(claim);
    }
    return JSON.parse(
      JSON.stringify(claim, (_, value) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    );
  }

  public async save(claim: ClaimEntity): Promise<ClaimEntity> {
    const copy = this.clone(claim);
    this.claims.set(copy.id, copy);
    return this.clone(copy);
  }

  public async findById(id: string): Promise<ClaimEntity | null> {
    const claim = this.claims.get(id);
    if (!claim) {
      return null;
    }
    return this.clone(claim);
  }

  public async findByClaimNumber(claimNumber: string): Promise<ClaimEntity | null> {
    for (const claim of this.claims.values()) {
      if (claim.claimNumber === claimNumber) {
        return this.clone(claim);
      }
    }
    return null;
  }

  public async findByPolicyId(policyId: string): Promise<ClaimEntity[]> {
    const results: ClaimEntity[] = [];
    for (const claim of this.claims.values()) {
      if (claim.policyId === policyId) {
        results.push(this.clone(claim));
      }
    }
    return results;
  }

  /**
   * Búsqueda por CUFE (Código Único de Factura Electrónica de la DIAN).
   * Fundamental para prevención de fraudes y reclamos duplicados con la misma factura.
   */
  public async findByCufe(cufe: string): Promise<ClaimEntity | null> {
    if (!cufe) {
      return null;
    }
    const normalizedInput = cufe.trim().toLowerCase();
    for (const claim of this.claims.values()) {
      if (
        claim.dianInvoice?.dianCufe &&
        claim.dianInvoice.dianCufe.trim().toLowerCase() === normalizedInput
      ) {
        return this.clone(claim);
      }
    }
    return null;
  }

  public async update(claim: ClaimEntity): Promise<ClaimEntity> {
    const copy = this.clone(claim);
    this.claims.set(copy.id, copy);
    return this.clone(copy);
  }

  public async findAll(): Promise<ClaimEntity[]> {
    return Array.from(this.claims.values()).map((c) => this.clone(c));
  }

  public clear(): void {
    this.claims.clear();
  }
}
