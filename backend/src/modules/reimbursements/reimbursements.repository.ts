import { Injectable } from '@nestjs/common';
import {
  DisbursementTransaction,
  IReimbursementsRepository,
} from './reimbursements.types';

@Injectable()
export class InMemoryReimbursementsRepository implements IReimbursementsRepository {
  private readonly transactions = new Map<string, DisbursementTransaction>();

  private clone(transaction: DisbursementTransaction): DisbursementTransaction {
    if (typeof structuredClone === 'function') {
      return structuredClone(transaction);
    }
    return JSON.parse(
      JSON.stringify(transaction, (_, value) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    );
  }

  public async save(
    transaction: DisbursementTransaction,
  ): Promise<DisbursementTransaction> {
    const copy = this.clone(transaction);
    this.transactions.set(copy.id, copy);
    return this.clone(copy);
  }

  public async findById(id: string): Promise<DisbursementTransaction | null> {
    const tx = this.transactions.get(id);
    if (!tx) {
      return null;
    }
    return this.clone(tx);
  }

  public async findByClaimId(
    claimId: string,
  ): Promise<DisbursementTransaction | null> {
    for (const tx of this.transactions.values()) {
      if (tx.claimId === claimId) {
        return this.clone(tx);
      }
    }
    return null;
  }

  public async findByPolicyId(
    policyId: string,
  ): Promise<DisbursementTransaction[]> {
    const results: DisbursementTransaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.policyId === policyId) {
        results.push(this.clone(tx));
      }
    }
    return results;
  }

  public async findByTrackingCode(
    trackingCode: string,
  ): Promise<DisbursementTransaction | null> {
    for (const tx of this.transactions.values()) {
      if (tx.breBTrackingCode === trackingCode) {
        return this.clone(tx);
      }
    }
    return null;
  }

  public async findAll(): Promise<DisbursementTransaction[]> {
    return Array.from(this.transactions.values()).map((t) => this.clone(t));
  }

  public clear(): void {
    this.transactions.clear();
  }
}
