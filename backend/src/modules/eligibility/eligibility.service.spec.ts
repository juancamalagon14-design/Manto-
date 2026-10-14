import { EligibilityService } from './eligibility.service';

describe('EligibilityService - Motor de Suscripción y Elegibilidad Biológica', () => {
  let service: EligibilityService;

  beforeEach(() => {
    service = new EligibilityService();
  });

  it('debe aprobar una mascota sana dentro de los límites de edad y raza válida', () => {
    const result = service.evaluateEligibility({
      species: 'CANINE',
      breedCode: 'MIXED_BREED_DOG',
      ageInMonths: 24,
      hasPreExistingChronicConditions: false,
    });

    expect(result.isEligible).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
    expect(result.isSpecialHandlingBreed).toBe(false);
  });

  it('debe rechazar cachorros menores a 2 meses (8 semanas cumplidas)', () => {
    const result = service.evaluateEligibility({
      species: 'CANINE',
      breedCode: 'LABRADOR_RETRIEVER',
      ageInMonths: 1,
      hasPreExistingChronicConditions: false,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rejectionReasons[0]).toContain('mínimo 2 meses');
  });

  it('debe admitir mascotas senior de 97, 120 y 144 meses (hasta 12 años cumplidos)', () => {
    for (const seniorAge of [97, 120, 144]) {
      const result = service.evaluateEligibility({
        species: 'CANINE',
        breedCode: 'GOLDEN_RETRIEVER',
        ageInMonths: seniorAge,
        hasPreExistingChronicConditions: false,
      });

      expect(result.isEligible).toBe(true);
      expect(result.rejectionReasons).toHaveLength(0);
    }
  });

  it('debe rechazar mascotas mayores a 12 años (más de 144 meses)', () => {
    const result = service.evaluateEligibility({
      species: 'CANINE',
      breedCode: 'GOLDEN_RETRIEVER',
      ageInMonths: 145, // Supera 12 años cumplidos
      hasPreExistingChronicConditions: false,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rejectionReasons[0]).toContain('144 meses (12 años cumplidos)');
  });

  it('debe detectar razas de manejo especial bajo la Ley 1801 de 2016 y marcar RCE obligatoria', () => {
    const result = service.evaluateEligibility({
      species: 'CANINE',
      breedCode: 'ROTTWEILER',
      ageInMonths: 36,
      hasPreExistingChronicConditions: false,
    });

    expect(result.isEligible).toBe(true);
    expect(result.isSpecialHandlingBreed).toBe(true);
    expect(result.requiresSpecialHandlingRce).toBe(true);
    expect(result.notes.some((n) => n.includes('Ley 1801'))).toBe(true);
  });

  it('debe rechazar razas inexistentes en el registro actuarial', () => {
    const result = service.evaluateEligibility({
      species: 'CANINE',
      breedCode: 'DRAGON_CANINO_DESCONOCIDO',
      ageInMonths: 12,
      hasPreExistingChronicConditions: false,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rejectionReasons[0]).toContain('no registrado');
  });

  it('debe alertar y registrar nota si existen condiciones preexistentes crónicas', () => {
    const result = service.evaluateEligibility({
      species: 'FELINE',
      breedCode: 'PERSIAN',
      ageInMonths: 48,
      hasPreExistingChronicConditions: true,
    });

    expect(result.isEligible).toBe(true); // Sigue siendo asegurable pero con nota de exclusión
    expect(result.notes.some((n) => n.includes('preexistentes'))).toBe(true);
  });
});
