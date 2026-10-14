import { Injectable } from '@nestjs/common';
import { IPaymentsRepository, PaymentTransaction } from './payments.types';

@Injectable()
export class InMemoryPaymentsRepository implements IPaymentsRepository {
  private readonly transactions = new Map<string, PaymentTransaction>();

  private clone(transaction: PaymentTransaction): PaymentTransaction {
    if (typeof structuredClone === 'function') {
      return structuredClone(transaction);
    }
    return JSON.parse(JSON.stringify(transaction));
  }

  public async save(transaction: PaymentTransaction): Promise<PaymentTransaction> {
    const copy = this.clone(transaction);
    this.transactions.set(copy.transactionId, copy);
    return this.clone(copy);
  }

  public async findById(transactionId: string): Promise<PaymentTransaction | null> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return null;
    }
    return this.clone(transaction);
  }

  public async findByPolicyId(policyId: string): Promise<PaymentTransaction[]> {
    const matches: PaymentTransaction[] = [];
    for (const transaction of this.transactions.values()) {
      if (transaction.policyId === policyId) {
        matches.push(this.clone(transaction));
      }
    }
    return matches;
  }

  public async findByIdempotencyKey(key: string): Promise<PaymentTransaction | null> {
    for (const transaction of this.transactions.values()) {
      if (transaction.idempotencyKey === key) {
        return this.clone(transaction);
      }
    }
    return null;
  }

  public async findByProviderReference(providerReference: string): Promise<PaymentTransaction | null> {
    for (const transaction of this.transactions.values()) {
      if (transaction.providerReference === providerReference) {
        return this.clone(transaction);
      }
    }
    return null;
  }

  public async update(transaction: PaymentTransaction): Promise<PaymentTransaction> {
    const copy = this.clone(transaction);
    this.transactions.set(copy.transactionId, copy);
    return this.clone(copy);
  }

  public clear(): void {
    this.transactions.clear();
  }
}
