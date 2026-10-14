import { Injectable } from '@nestjs/common';
import { BREED_REGISTRY } from '../pricing/pricing.constants';
import { EligibilityInput, EligibilityResult } from './eligibility.types';

@Injectable()
export class EligibilityService {
  public static readonly MIN_AGE_MONTHS = 2; // 8 semanas cumplidas
  public static readonly MAX_AGE_MONTHS = 144; // 12 años cumplidos

  public evaluateEligibility(input: EligibilityInput): EligibilityResult {
    const rejectionReasons: string[] = [];
    const notes: string[] = [];

    // 1. Validación de Especie
    if (!['CANINE', 'FELINE'].includes(input.species)) {
      rejectionReasons.push(
        `Especie no asegurable: ${input.species}. Únicamente se admiten caninos y felinos domésticos.`,
      );
    }

    // 2. Validación de Edad al Ingreso
    if (input.ageInMonths < EligibilityService.MIN_AGE_MONTHS) {
      rejectionReasons.push(
        `La mascota debe tener mínimo ${EligibilityService.MIN_AGE_MONTHS} meses (8 semanas cumplidas) para ingresar. Edad actual: ${input.ageInMonths} meses.`,
      );
    }

    if (input.ageInMonths > EligibilityService.MAX_AGE_MONTHS) {
      rejectionReasons.push(
        `La edad máxima de ingreso para nuevos asegurados es ${EligibilityService.MAX_AGE_MONTHS} meses (12 años cumplidos). Edad actual: ${input.ageInMonths} meses.`,
      );
    }

    // 3. Validación de Raza en el Registro
    const breed = BREED_REGISTRY[input.breedCode];
    if (!breed) {
      rejectionReasons.push(`Código de raza '${input.breedCode}' no registrado en el catálogo actuarial.`);
    } else if (breed.species !== input.species) {
      rejectionReasons.push(
        `Incongruencia biológica: La raza ${breed.name} no pertenece a la especie ${input.species}.`,
      );
    }

    // 4. Condiciones Preexistentes Crónicas
    if (input.hasPreExistingChronicConditions) {
      notes.push(
        'La mascota tiene condiciones preexistentes declaradas. Las patologías previas quedan excluidas de la cobertura de enfermedades.',
      );
    }

    const isSpecialHandlingBreed = breed?.isSpecialHandling ?? false;
    if (isSpecialHandlingBreed) {
      notes.push(
        'Raza clasificada como de manejo especial en Colombia (Ley 1801 de 2016). Requiere cobertura obligatoria de Responsabilidad Civil Extracontractual de 50 SMLMV.',
      );
    }

    return {
      isEligible: rejectionReasons.length === 0,
      rejectionReasons,
      isSpecialHandlingBreed,
      requiresSpecialHandlingRce: isSpecialHandlingBreed,
      notes,
    };
  }
}
