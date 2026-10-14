import { AgeOptionItem } from '@/types/ai';

export const AGE_DROPDOWN_OPTIONS: readonly AgeOptionItem[] = Object.freeze([
  {
    id: 'UNDER_2_MONTHS',
    label: 'Menos de 2 meses (< 8 semanas cumplidas)',
    category: 'FLAG_WARNING',
    ageInMonths: 1,
    isEligible: false,
    warningFlag: 'UNDER_MIN_AGE',
    warningMessage:
      'Por bienestar animal y normativa aseguradora, la edad mínima asegurable es de 2 meses (8 semanas cumplidas) con su primer esquema de vacunación iniciado.',
  },
  { id: '2_MONTHS', label: '2 meses', category: 'PUPPY_MONTHS', ageInMonths: 2, isEligible: true },
  { id: '3_MONTHS', label: '3 meses', category: 'PUPPY_MONTHS', ageInMonths: 3, isEligible: true },
  { id: '4_MONTHS', label: '4 meses', category: 'PUPPY_MONTHS', ageInMonths: 4, isEligible: true },
  { id: '5_MONTHS', label: '5 meses', category: 'PUPPY_MONTHS', ageInMonths: 5, isEligible: true },
  { id: '6_MONTHS', label: '6 meses', category: 'PUPPY_MONTHS', ageInMonths: 6, isEligible: true },
  { id: '7_MONTHS', label: '7 meses', category: 'PUPPY_MONTHS', ageInMonths: 7, isEligible: true },
  { id: '8_MONTHS', label: '8 meses', category: 'PUPPY_MONTHS', ageInMonths: 8, isEligible: true },
  { id: '9_MONTHS', label: '9 meses', category: 'PUPPY_MONTHS', ageInMonths: 9, isEligible: true },
  { id: '10_MONTHS', label: '10 meses', category: 'PUPPY_MONTHS', ageInMonths: 10, isEligible: true },
  { id: '11_MONTHS', label: '11 meses', category: 'PUPPY_MONTHS', ageInMonths: 11, isEligible: true },
  { id: '1_YEAR', label: '1 año (12 meses)', category: 'ADULT_YEARS', ageInMonths: 12, isEligible: true },
  { id: '2_YEARS', label: '2 años (24 meses)', category: 'ADULT_YEARS', ageInMonths: 24, isEligible: true },
  { id: '3_YEARS', label: '3 años (36 meses)', category: 'ADULT_YEARS', ageInMonths: 36, isEligible: true },
  { id: '4_YEARS', label: '4 años (48 meses)', category: 'ADULT_YEARS', ageInMonths: 48, isEligible: true },
  { id: '5_YEARS', label: '5 años (60 meses)', category: 'ADULT_YEARS', ageInMonths: 60, isEligible: true },
  { id: '6_YEARS', label: '6 años (72 meses)', category: 'ADULT_YEARS', ageInMonths: 72, isEligible: true },
  { id: '7_YEARS', label: '7 años (84 meses)', category: 'ADULT_YEARS', ageInMonths: 84, isEligible: true },
  { id: '8_YEARS', label: '8 años (96 meses)', category: 'ADULT_YEARS', ageInMonths: 96, isEligible: true },
  { id: '9_YEARS', label: '9 años (108 meses)', category: 'ADULT_YEARS', ageInMonths: 108, isEligible: true },
  { id: '10_YEARS', label: '10 años (120 meses)', category: 'ADULT_YEARS', ageInMonths: 120, isEligible: true },
  { id: '11_YEARS', label: '11 años (132 meses)', category: 'ADULT_YEARS', ageInMonths: 132, isEligible: true },
  { id: '12_YEARS', label: '12 años (144 meses)', category: 'ADULT_YEARS', ageInMonths: 144, isEligible: true },
  { id: '13_YEARS', label: '13 años (156 meses)', category: 'SENIOR_YEARS', ageInMonths: 156, isEligible: true },
  { id: '14_YEARS', label: '14 años (168 meses)', category: 'SENIOR_YEARS', ageInMonths: 168, isEligible: true },
  { id: '14_PLUS_YEARS', label: '14+ años (> 168 meses)', category: 'SENIOR_YEARS', ageInMonths: 170, isEligible: true },
]);

/**
 * Los catálogos de coberturas y de razas ya NO viven aquí.
 *
 * Mantener copias en el frontend causó dos fallas reales:
 *   · `PITBULL`: el código del desplegable no existía en `BREED_REGISTRY`, el
 *     backend respondía 400 y la cotización terminaba en otro motor.
 *   · Topes desincronizados: la interfaz prometía $1.500.000 en medicamentos
 *     cuando la póliza emitida otorga $600.000.
 *
 * Ahora se piden al motor, que es la única fuente de verdad:
 *   · `api.getBreeds()`  → GET /v1/pricing/breeds
 *   · `api.getAddons()`  → GET /v1/pricing/addons
 *
 * Las razas de manejo especial (Ley 1801) llegan marcadas con
 * `isSpecialHandling` en el catálogo de razas; quien anexa el amparo de RCE es
 * el backend, no la interfaz.
 */
