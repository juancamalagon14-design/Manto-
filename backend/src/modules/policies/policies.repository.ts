import { Injectable } from '@nestjs/common';
import { IPoliciesRepository, PolicyEntity } from './policies.types';

@Injectable()
export class InMemoryPoliciesRepository implements IPoliciesRepository {
  private readonly policies = new Map<string, PolicyEntity>();

  private clone(policy: PolicyEntity): PolicyEntity {
    if (typeof structuredClone === 'function') {
      return structuredClone(policy);
    }
    return JSON.parse(JSON.stringify(policy));
  }

  public async save(policy: PolicyEntity): Promise<PolicyEntity> {
    const copy = this.clone(policy);
    this.policies.set(copy.id, copy);
    return this.clone(copy);
  }

  public async findById(id: string): Promise<PolicyEntity | null> {
    const policy = this.policies.get(id);
    if (!policy) {
      return null;
    }
    return this.clone(policy);
  }

  public async findByPolicyNumber(policyNumber: string): Promise<PolicyEntity | null> {
    for (const policy of this.policies.values()) {
      if (policy.policyNumber === policyNumber) {
        return this.clone(policy);
      }
    }
    return null;
  }

  public async findByQuoteId(quoteId: string): Promise<PolicyEntity | null> {
    for (const policy of this.policies.values()) {
      if (policy.quoteId === quoteId) {
        return this.clone(policy);
      }
    }
    return null;
  }

  public async update(policy: PolicyEntity): Promise<PolicyEntity> {
    const copy = this.clone(policy);
    this.policies.set(copy.id, copy);
    return this.clone(copy);
  }

  public async findAll(): Promise<PolicyEntity[]> {
    return Array.from(this.policies.values()).map((p) => this.clone(p));
  }

  public clear(): void {
    this.policies.clear();
  }
}
