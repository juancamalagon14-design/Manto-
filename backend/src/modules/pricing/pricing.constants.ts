import { ColombianPeso, multiplyCop, toCop } from '../../common/types/money';
import {
  AddonKey,
  AddonOption,
  City,
  DeductibleOption,
  Gender,
  MinimumBaselineCoverage,
  SizeCategory,
  Species,
} from './pricing.types';

export const BASE_PREMIUM_COP: ColombianPeso = toCop(30000);

/**
 * Salario mínimo legal mensual vigente.
 *
 * VIGENCIA: 2026. Decreto 0159 del 19 de febrero de 2026 (Ministerio del
 * Trabajo), que fija transitoriamente el SMLMV en $1.750.905 después de que el
 * Consejo de Estado suspendiera provisionalmente el Decreto 1469 de 2025.
 *
 * ESTA CONSTANTE SE ACTUALIZA CADA ENERO. No es un número de conveniencia: de
 * él depende el monto del amparo que exige la Ley 1801, y quedarse corto es
 * incumplir el mínimo legal. El valor anterior del amparo estaba escrito a
 * mano en $65.000.000, que eran 50 SMLMV de 2024; para 2026 eso son 37,1
 * SMLMV, es decir 13 salarios por debajo de lo que la norma obliga a cubrir,
 * mientras el nombre del amparo, su descripción y las 15 notas de raza
 * afirmaban "50 SMLMV".
 */
export const SMLMV_COP: ColombianPeso = toCop(1750905);

/** Año de vigencia del SMLMV de arriba. Si no es el año en curso, hay que actualizarlo. */
export const SMLMV_VIGENCIA_ANIO = 2026;

/** Múltiplo de SMLMV que la Ley 1801 de 2016 exige para el amparo de RCE canina. */
export const RCE_LEY_1801_SMLMV = 50;

/**
 * Valor asegurado del amparo obligatorio de RCE, derivado del SMLMV vigente.
 * 2026: 50 × $1.750.905 = $87.545.250.
 */
export const RCE_LEY_1801_LIMIT_COP: ColombianPeso = multiplyCop(SMLMV_COP, RCE_LEY_1801_SMLMV);


/**
 * Esterilización: se sigue capturando como dato de la póliza, pero NO descuenta.
 *
 * Decisión de negocio (septiembre 2026): el 5% se traslada al descuento por
 * múltiples mascotas. La esterilización tampoco figura como factor de tarifa en
 * los principales operadores del mercado, así que dejarla en cero es coherente.
 *
 * Si más adelante se decide volver a tarificarla, basta cambiar este valor:
 * el dato ya viaja en `PricingCalculationInput.isSterilized`.
 */
export const STERILIZATION_DISCOUNT = 0.0;

/**
 * Descuento por asegurar dos o más mascotas bajo el mismo titular.
 * Se aplica sobre la tarifa base de cada mascota de la póliza.
 */
export const MULTI_PET_DISCOUNT = 0.05;

/** A partir de cuántas mascotas aplica `MULTI_PET_DISCOUNT`. */
export const MULTI_PET_DISCOUNT_THRESHOLD = 2;

/**
 * Factor por sexo.
 *
 * Los machos presentan mayor siniestralidad por trauma (conducta más expuesta) y por
 * patología prostática y testicular. Es un factor reconocido por operadores del mercado:
 * Embrace lo lista explícitamente entre sus variables de tarifa.
 *
 * ⚠️ CALIBRACIÓN PROVISIONAL. El 3% es un recargo conservador tomado del comportamiento
 * general del mercado, NO de siniestralidad propia de Manto. Debe recalibrarse con la
 * experiencia real de la cartera en cuanto haya volumen suficiente. Mientras tanto se
 * mantiene bajo a propósito: un factor equivocado y pequeño hace menos daño que uno
 * equivocado y grande.
 *
 * El sexo es obligatorio: si no se informa, `PricingService` lanza 400 en vez de
 * asumir un valor. No hay factor neutro — o es macho o es hembra.
 */
export const GENDER_FACTORS: Record<Gender, number> = {
  MALE: 1.03,
  FEMALE: 1.0,
};

export const SPECIES_FACTORS: Record<Species, number> = {
  CANINE: 1.0,
  FELINE: 0.92,
};

export const SIZE_FACTORS: Record<SizeCategory, number> = {
  TOY: 0.92,
  SMALL: 0.96,
  MEDIUM: 1.0,
  LARGE: 1.08,
  GIANT: 1.18,
};

export const CITY_FACTORS: Record<City, number> = {
  BOGOTA: 1.08,
  MEDELLIN: 1.04,
  CALI: 1.0,
  OTHER: 0.95,
};

export const DEDUCTIBLE_FACTORS: Record<DeductibleOption, number> = {
  0.1: 1.15,
  0.15: 1.0,
  0.2: 0.88,
};

export interface BreedActuarialProfile {
  code: string;
  name: string;
  species: Species;
  factor: number;
  isSpecialHandling: boolean; // Sujeto a Ley 1801 de 2016
  typicalSize: SizeCategory;
  fenotipoSublimitNote?: string;
}

export const BREED_REGISTRY: Record<string, BreedActuarialProfile> = {
  // =========================================================================
  // CANINOS: Razas Más Comunes en Colombia (No Sujetas a Manejo Especial)
  // =========================================================================
  MIXED_BREED_DOG: {
    code: 'MIXED_BREED_DOG',
    name: 'Criollo / Mestizo',
    species: 'CANINE',
    factor: 0.88,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Raza mestiza; vigor híbrido con baja incidencia de patologías congénitas hereditarias.',
  },
  POODLE: {
    code: 'POODLE',
    name: 'Poodle / Caniche',
    species: 'CANINE',
    factor: 0.98,
    isSpecialHandling: false,
    typicalSize: 'TOY',
    fenotipoSublimitNote: 'Sublímite para luxación patelar medial, cataratas juveniles y otitis externa recurrente.',
  },
  SCHNAUZER: {
    code: 'SCHNAUZER',
    name: 'Schnauzer Miniatura',
    species: 'CANINE',
    factor: 1.02,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite metabólico para hiperlipidemia, pancreatitis aguda y urolitiasis cálcica.',
  },
  GOLDEN_RETRIEVER: {
    code: 'GOLDEN_RETRIEVER',
    name: 'Golden Retriever',
    species: 'CANINE',
    factor: 1.05,
    isSpecialHandling: false,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Sublímite para displasia de cadera y codo tras carencia.',
  },
  LABRADOR_RETRIEVER: {
    code: 'LABRADOR_RETRIEVER',
    name: 'Labrador Retriever',
    species: 'CANINE',
    factor: 1.05,
    isSpecialHandling: false,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Sublímite para problemas articulares y control de peso.',
  },
  GERMAN_SHEPHERD: {
    code: 'GERMAN_SHEPHERD',
    name: 'Pastor Alemán',
    species: 'CANINE',
    factor: 1.12,
    isSpecialHandling: false,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Sublímite osteoarticular de columna y cadera.',
  },
  FRENCH_BULLDOG: {
    code: 'FRENCH_BULLDOG',
    name: 'Bulldog Francés',
    species: 'CANINE',
    factor: 1.35,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite respiratorio por síndrome braquiocefálico (BOAS).',
  },
  PUG: {
    code: 'PUG',
    name: 'Pug / Carlino',
    species: 'CANINE',
    factor: 1.3,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite para afecciones respiratorias y oculares.',
  },
  SHIH_TZU: {
    code: 'SHIH_TZU',
    name: 'Shih Tzu',
    species: 'CANINE',
    factor: 1.1,
    isSpecialHandling: false,
    typicalSize: 'TOY',
    fenotipoSublimitNote: 'Sublímite para úlceras corneales, síndrome braquiocefálico moderado y otitis.',
  },
  YORKSHIRE_TERRIER: {
    code: 'YORKSHIRE_TERRIER',
    name: 'Yorkshire Terrier',
    species: 'CANINE',
    factor: 1.0,
    isSpecialHandling: false,
    typicalSize: 'TOY',
    fenotipoSublimitNote: 'Sublímite para colapso traqueal, luxación patelar y enfermedad periodontal temprana.',
  },
  BEAGLE: {
    code: 'BEAGLE',
    name: 'Beagle',
    species: 'CANINE',
    factor: 1.02,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite para afecciones intervertebrales discales (IVDD), otitis y control de obesidad.',
  },
  CHIHUAHUA: {
    code: 'CHIHUAHUA',
    name: 'Chihuahua',
    species: 'CANINE',
    factor: 0.95,
    isSpecialHandling: false,
    typicalSize: 'TOY',
    fenotipoSublimitNote: 'Sublímite para colapso traqueal, hipoglucemia juvenil y persistencia de fontanela.',
  },
  POMERANIAN: {
    code: 'POMERANIAN',
    name: 'Pomerania / Spitz Enano',
    species: 'CANINE',
    factor: 1.05,
    isSpecialHandling: false,
    typicalSize: 'TOY',
    fenotipoSublimitNote: 'Sublímite para luxación rotuliana, colapso traqueal y alopecia X.',
  },
  SIBERIAN_HUSKY: {
    code: 'SIBERIAN_HUSKY',
    name: 'Husky Siberiano',
    species: 'CANINE',
    factor: 1.08,
    isSpecialHandling: false,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Sublímite para distrofia corneal, cataratas juveniles y displasia coxofemoral.',
  },
  BORDER_COLLIE: {
    code: 'BORDER_COLLIE',
    name: 'Border Collie',
    species: 'CANINE',
    factor: 1.0,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Sublímite para anomalía ocular del Collie (CEA) y sensibilidad al gen MDR1.',
  },
  BOXER: {
    code: 'BOXER',
    name: 'Boxer',
    species: 'CANINE',
    factor: 1.2,
    isSpecialHandling: false,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Sublímite para miocardiopatía arritmogénica del bóxer (ARVC), mastocitomas y BOAS leve.',
  },
  ENGLISH_BULLDOG: {
    code: 'ENGLISH_BULLDOG',
    name: 'Bulldog Inglés',
    species: 'CANINE',
    factor: 1.38,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Sublímite respiratorio severo por síndrome braquiocefálico (BOAS) y displasia coxofemoral.',
  },
  DACHSHUND: {
    code: 'DACHSHUND',
    name: 'Dachshund / Teckel / Salchicha',
    species: 'CANINE',
    factor: 1.12,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite para enfermedad discal intervertebral condrodistrófica (IVDD severa).',
  },
  MALTESE: {
    code: 'MALTESE',
    name: 'Bichón Maltés',
    species: 'CANINE',
    factor: 0.98,
    isSpecialHandling: false,
    typicalSize: 'TOY',
    fenotipoSublimitNote: 'Sublímite para epífora crónica, dermatitis periorbitaria y luxación de rótula.',
  },
  COCKER_SPANIEL: {
    code: 'COCKER_SPANIEL',
    name: 'Cocker Spaniel',
    species: 'CANINE',
    factor: 1.06,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Sublímite para otitis externa crónica proliferativa, ectropión ocular y queratoconjuntivitis seca.',
  },

  // =========================================================================
  // FELINOS: Razas Más Comunes en Colombia
  // =========================================================================
  MIXED_BREED_CAT: {
    code: 'MIXED_BREED_CAT',
    name: 'Gato Criollo / Mestizo',
    species: 'FELINE',
    factor: 0.85,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Gato mestizo; alta rusticidad biológica, seguimiento de retrovirosis felinas (FeLV/FIV).',
  },
  SIAMESE: {
    code: 'SIAMESE',
    name: 'Siamés',
    species: 'FELINE',
    factor: 1.0,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite para bronquitis asmática felina, estrabismo congénito y amiloidosis.',
  },
  PERSIAN: {
    code: 'PERSIAN',
    name: 'Persa',
    species: 'FELINE',
    factor: 1.2,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite oftalmológico y renal por enfermedad poliquística renal (PKD).',
  },
  MAINE_COON: {
    code: 'MAINE_COON',
    name: 'Maine Coon',
    species: 'FELINE',
    factor: 1.15,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Sublímite para miocardiopatía hipertrófica (HCM), atrofia muscular espinal y displasia de cadera.',
  },
  BENGAL: {
    code: 'BENGAL',
    name: 'Gato Bengalí',
    species: 'FELINE',
    factor: 1.1,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite para atrofia progresiva retiniana (PRA-b), déficit de piruvato quinasa y HCM.',
  },
  RAGDOLL: {
    code: 'RAGDOLL',
    name: 'Ragdoll',
    species: 'FELINE',
    factor: 1.08,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Sublímite para cardiomiopatía hipertrófica hereditaria (HCM) y síndrome urológico felino (FLUTD).',
  },
  BRITISH_SHORTHAIR: {
    code: 'BRITISH_SHORTHAIR',
    name: 'Británico de Pelo Corto',
    species: 'FELINE',
    factor: 1.06,
    isSpecialHandling: false,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Sublímite para hemofilia B, urolitiasis y control de sobrepeso.',
  },
  SPHYNX: {
    code: 'SPHYNX',
    name: 'Sphynx / Gato Esfinge',
    species: 'FELINE',
    factor: 1.25,
    isSpecialHandling: false,
    typicalSize: 'SMALL',
    fenotipoSublimitNote: 'Sublímite dermatológico severo (alopecia congénita, dermatitis seborreica) y cardiomiopatía hipertrófica.',
  },

  // =========================================================================
  // CANINOS DE MANEJO ESPECIAL (15 Razas Sujetas a Ley 1801 de 2016 de Colombia)
  // RCE Obligatoria de 50 SMLMV por mandato legal
  // =========================================================================
  AMERICAN_PIT_BULL_TERRIER: {
    code: 'AMERICAN_PIT_BULL_TERRIER',
    name: 'American Pit Bull Terrier',
    species: 'CANINE',
    factor: 1.25,
    isSpecialHandling: true,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para displasia de cadera y luxación patelar.',
  },
  AMERICAN_STAFFORDSHIRE_TERRIER: {
    code: 'AMERICAN_STAFFORDSHIRE_TERRIER',
    name: 'American Staffordshire Terrier',
    species: 'CANINE',
    factor: 1.24,
    isSpecialHandling: true,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para displasia coxofemoral y ataxia cerebelosa.',
  },
  STAFFORDSHIRE_TERRIER: {
    code: 'STAFFORDSHIRE_TERRIER',
    name: 'Staffordshire Terrier',
    species: 'CANINE',
    factor: 1.24,
    isSpecialHandling: true,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para cataratas hereditarias y L-2-HGA.',
  },
  BULL_TERRIER: {
    code: 'BULL_TERRIER',
    name: 'Bull Terrier',
    species: 'CANINE',
    factor: 1.22,
    isSpecialHandling: true,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para nefrotoxicidad hereditaria y sordera congénita.',
  },
  BULLMASTIFF: {
    code: 'BULLMASTIFF',
    name: 'Bullmastiff',
    species: 'CANINE',
    factor: 1.28,
    isSpecialHandling: true,
    typicalSize: 'GIANT',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para torsión gástrica (GDV) y displasia articular severa.',
  },
  DOBERMAN: {
    code: 'DOBERMAN',
    name: 'Dóberman',
    species: 'CANINE',
    factor: 1.22,
    isSpecialHandling: true,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite cardiológico para cardiomiopatía dilatada (DCM).',
  },
  DOGO_ARGENTINO: {
    code: 'DOGO_ARGENTINO',
    name: 'Dogo Argentino',
    species: 'CANINE',
    factor: 1.26,
    isSpecialHandling: true,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para displasia coxofemoral y sordera neurosensorial.',
  },
  DOGUE_DE_BORDEAUX: {
    code: 'DOGUE_DE_BORDEAUX',
    name: 'Dogo de Burdeos',
    species: 'CANINE',
    factor: 1.3,
    isSpecialHandling: true,
    typicalSize: 'GIANT',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para estenosis aórtica, dilatación gástrica y ectropión.',
  },
  FILA_BRASILEIRO: {
    code: 'FILA_BRASILEIRO',
    name: 'Fila Brasileiro',
    species: 'CANINE',
    factor: 1.28,
    isSpecialHandling: true,
    typicalSize: 'GIANT',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para torsión gástrica y displasia coxofemoral/codo.',
  },
  NEAPOLITAN_MASTIFF: {
    code: 'NEAPOLITAN_MASTIFF',
    name: 'Mastín Napolitano',
    species: 'CANINE',
    factor: 1.3,
    isSpecialHandling: true,
    typicalSize: 'GIANT',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para prolapso de glándula nictitante (ojo de cereza) y displasia articular.',
  },
  PRESA_CANARIO: {
    code: 'PRESA_CANARIO',
    name: 'Presa Canario / Dogo Canario',
    species: 'CANINE',
    factor: 1.28,
    isSpecialHandling: true,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para displasia de cadera, codo y osteocondritis disecante.',
  },
  ROTTWEILER: {
    code: 'ROTTWEILER',
    name: 'Rottweiler',
    species: 'CANINE',
    factor: 1.28,
    isSpecialHandling: true,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para osteosarcoma, estenosis subaórtica y displasia articular.',
  },
  TOSA_INU: {
    code: 'TOSA_INU',
    name: 'Tosa Japonés / Tosa Inu',
    species: 'CANINE',
    factor: 1.28,
    isSpecialHandling: true,
    typicalSize: 'GIANT',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para dilatación-torsión gástrica y displasia coxofemoral.',
  },
  AMERICAN_BULLY: {
    code: 'AMERICAN_BULLY',
    name: 'American Bully',
    species: 'CANINE',
    factor: 1.25,
    isSpecialHandling: true,
    typicalSize: 'MEDIUM',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para síndrome braquiocefálico y displasia articular.',
  },
  CANE_CORSO: {
    code: 'CANE_CORSO',
    name: 'Cane Corso / Mastín Italiano',
    species: 'CANINE',
    factor: 1.26,
    isSpecialHandling: true,
    typicalSize: 'LARGE',
    fenotipoSublimitNote: 'Raza de manejo especial según Ley 1801 (RCE Obligatoria 50 SMLMV). Sublímite para ectropión/entropión, displasia coxofemoral y torsión gástrica.',
  },
};

export const SPECIAL_HANDLING_BREED_CODES: readonly string[] = Object.freeze(
  Object.values(BREED_REGISTRY)
    .filter((breed) => breed.isSpecialHandling)
    .map((breed) => breed.code),
);

export const BASELINE_COVERAGES_CATALOG: MinimumBaselineCoverage[] = [
  {
    code: 'ACCIDENT_EMERGENCY',
    name: 'Urgencias y Hospitalización por Accidente',
    description: 'Atención vital, estabilización, suturas, fracturas y cirugías derivadas de traumatismos o accidentes imprevistos.',
    annualLimitCop: toCop(3500000),
    // El copago real lo inyecta PricingService con el deducible contratado.
    // Este valor es solo el del tramo por defecto.
    copayDeductiblePercentage: 0.15,
    waitingPeriodDays: 0, // Inmediato
  },
  {
    code: 'EMERGENCY_CONSULTATIONS',
    name: 'Consultas Médicas Veterinarias de Urgencia',
    description: 'Hasta 3 consultas presenciales o de choque al año por evento súbito.',
    annualLimitCop: toCop(450000),
    copayDeductiblePercentage: 0.15,
    waitingPeriodDays: 2,
  },
  {
    code: 'DIAGNOSTIC_IMAGING_LABS',
    name: 'Exámenes de Diagnóstico por Trauma',
    description: 'Radiografías, ecografías y cuadros hemáticos requeridos para la estabilización tras un accidente.',
    annualLimitCop: toCop(800000),
    copayDeductiblePercentage: 0.15,
    waitingPeriodDays: 0,
  },
];

export const ADDONS_CATALOG: Record<AddonKey, AddonOption> = {
  COMMON_ILLNESSES: {
    key: 'COMMON_ILLNESSES',
    name: 'Enfermedades Comunes e Infecciosas',
    description: 'Cubre patologías médicas como gastroenteritis, dermatitis, infecciones urinarias, otitis y cirugías por enfermedad no preexistente.',
    monthlyPremiumCop: toCop(24900),
    annualLimitCop: toCop(5000000),
    waitingPeriodDays: 30,
    isMandatoryByLaw: false,
    copayApplies: true,
  },
  PRESCRIPTION_DRUGS: {
    key: 'PRESCRIPTION_DRUGS',
    name: 'Medicamentos Recetados Ambulatorios',
    description: 'Reembolso de fármacos, antibióticos y analgésicos formulados por un médico veterinario con tarjeta profesional.',
    monthlyPremiumCop: toCop(12900),
    annualLimitCop: toCop(600000),
    // Se igualó a los 30 días de COMMON_ILLNESSES. Con 15 quedaba abierta una
    // ventana de antiselección: entre el día 15 y el 30 se reembolsaba la
    // medicación de una patología cuyo tratamiento aún no estaba cubierto, y
    // justo en el amparo de tasa sobre límite más alta del catálogo (23,6%).
    waitingPeriodDays: 30,
    isMandatoryByLaw: false,
    copayApplies: true,
  },
  PREVENTIVE_WELLNESS: {
    key: 'PREVENTIVE_WELLNESS',
    name: 'Pack Manto Bienestar: Vacunas y Desparasitación',
    description: 'Reembolso del 100% de vacunas anuales y desparasitaciones clínicas sin aporte por evento, activo de inmediato.',
    monthlyPremiumCop: toCop(14900),
    annualLimitCop: toCop(350000),
    waitingPeriodDays: 0,
    isMandatoryByLaw: false,
    copayApplies: false,
  },
  CIVIL_LIABILITY_1801: {
    key: 'CIVIL_LIABILITY_1801',
    name: 'Responsabilidad Civil Extracontractual (Ley 1801)',
    description: 'Indemnización de daños materiales o lesiones corporales ocasionadas por la mascota a terceras personas o animales (50 SMLMV).',
    // PENDIENTE ACTUARIAL: la prima quedó calibrada cuando el amparo eran
    // $65.000.000. Con el límite derivado del SMLMV vigente ($87.545.250) la
    // tasa sobre límite cae de 0,25% a 0,19%. No se reajusta aquí porque
    // inventar una prima es peor que dejar la discrepancia documentada: exige
    // revisión con frecuencia real de mordedura y severidad de RCE en Colombia.
    monthlyPremiumCop: toCop(15000),
    annualLimitCop: RCE_LEY_1801_LIMIT_COP,
    waitingPeriodDays: 0,
    isMandatoryByLaw: true,
    copayApplies: false,
  },
  FUNERAL_ASSISTANCE: {
    key: 'FUNERAL_ASSISTANCE',
    name: 'Asistencia Exequial y Cremación Individual',
    description: 'Acompañamiento compasivo, eutanasia justificada médicamente, traslado y cremación individual con entrega de cenizas en urna.',
    monthlyPremiumCop: toCop(9900),
    annualLimitCop: toCop(1200000),
    waitingPeriodDays: 30,
    isMandatoryByLaw: false,
    copayApplies: false,
  },
  TELEMEDICINE: {
    key: 'TELEMEDICINE',
    name: 'Telemedicina Veterinaria 24/7',
    description: 'Consultas ilimitadas por videollamada y chat con veterinarios certificados para orientación y triaje en cualquier momento.',
    monthlyPremiumCop: toCop(6900),
    // El amparo no tiene tope monetario: es un servicio, no un reembolso.
    // El 99.999.999 era un centinela interno, y desde que existe
    // GET /v1/pricing/addons se le mostraba al cliente como si fuera una
    // condición contractual. `hasNoAnnualLimit` es lo que la interfaz lee.
    annualLimitCop: toCop(0),
    hasNoAnnualLimit: true,
    waitingPeriodDays: 0,
    isMandatoryByLaw: false,
    copayApplies: false,
  },
  OWNER_HOSPITALIZATION_STAY: {
    key: 'OWNER_HOSPITALIZATION_STAY',
    name: 'Guardería por Hospitalización del Tomador',
    description: 'Alojamiento en hotel/guardería canina o felina de hasta 10 días continuos si el dueño asegurado es hospitalizado.',
    monthlyPremiumCop: toCop(4900),
    annualLimitCop: toCop(800000),
    waitingPeriodDays: 15,
    isMandatoryByLaw: false,
    copayApplies: false,
  },
};
