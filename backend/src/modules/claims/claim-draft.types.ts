import { SaveClaimDraftDto } from './dto/save-claim-draft.dto';

export interface ClaimDraftEntity {
  id: string;
  userId: string;
  policyId: string;
  currentStep: number;
  formData: Record<string, unknown>;
  savedAtTimestamp: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface ClaimDraftResponse {
  success: boolean;
  message?: string;
  draft?: {
    userId: string;
    policyId: string;
    currentStep: number;
    formData: Record<string, unknown>;
    savedAtTimestamp: number;
    expiresAt?: string;
  };
  expiresInSeconds?: number;
  expiresAt?: string;
}

export interface IClaimsDraftRepository {
  save(draft: ClaimDraftEntity): Promise<ClaimDraftEntity>;
  findByUserId(userId: string): Promise<ClaimDraftEntity | null>;
  deleteByUserId(userId: string): Promise<boolean>;
  clear?(): void;
}

export const CLAIMS_DRAFT_REPOSITORY = 'CLAIMS_DRAFT_REPOSITORY';
