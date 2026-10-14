import { Species } from '../pricing/pricing.types';

export interface EligibilityInput {
  species: Species;
  breedCode: string;
  ageInMonths: number;
  hasPreExistingChronicConditions: boolean;
}

export interface EligibilityResult {
  isEligible: boolean;
  rejectionReasons: string[];
  isSpecialHandlingBreed: boolean;
  requiresSpecialHandlingRce: boolean;
  notes: string[];
}
