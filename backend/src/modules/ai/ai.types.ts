import {
  AddonKey,
  City,
  DeductibleOption,
  SizeCategory,
  Species,
} from '../pricing/pricing.types';

/**
 * Cómo arranca la sesión.
 *
 * `GUIDED_CHAT` se eliminó: dejaba la sesión en `ASK_PET_NAME` con
 * `inputType: 'text'` y **ningún endpoint aceptaba texto**, así que era un
 * callejón sin salida anunciado en el contrato. La conversación la conduce
 * Nuquí en el frontend; el backend solo abre la sesión y analiza la foto.
 */
export type ChatMode = 'INITIAL_SELECTION' | 'LIVE_CAMERA';

/**
 * Estados que esta sesión puede tomar.
 *
 * Eran trece; nueve se quedaron sin escritor al eliminarse la máquina de
 * estados del cotizador paralelo (`ASK_BREED`, `ASK_AGE_DROPDOWN`,
 * `ASK_LOCATION_MAPS`, `ASK_STERILIZATION`, `READY_FOR_QUOTE`,
 * `QUOTE_OFFERED`, ...). Un estado que nadie escribe es una promesa de
 * comportamiento que el servicio no cumple.
 */
export type ConversationStep =
  | 'SELECT_MODE'
  | 'CAMERA_CAPTURE'
  | 'ASK_PET_NAME'
  | 'POST_PHOTO_AGE_VERIFICATION';

export type AgeSelectionOption =
  // Advertencia: menor de 2 meses
  | 'UNDER_2_MONTHS'
  // Cachorros: 2 a 11 meses
  | '2_MONTHS'
  | '3_MONTHS'
  | '4_MONTHS'
  | '5_MONTHS'
  | '6_MONTHS'
  | '7_MONTHS'
  | '8_MONTHS'
  | '9_MONTHS'
  | '10_MONTHS'
  | '11_MONTHS'
  // Adultos / Jóvenes: 1 a 8 años
  | '1_YEAR'
  | '2_YEARS'
  | '3_YEARS'
  | '4_YEARS'
  | '5_YEARS'
  | '6_YEARS'
  | '7_YEARS'
  | '8_YEARS'
  // Senior: 9 a 12 años
  | '9_YEARS'
  | '10_YEARS'
  | '11_YEARS'
  | '12_YEARS'
  // Advertencia: mayor de 12 años
  | 'OVER_12_YEARS';

export interface AgeOptionItem {
  id: AgeSelectionOption;
  label: string;
  category: 'PUPPY_MONTHS' | 'ADULT_YEARS' | 'FLAG_WARNING';
  ageInMonths: number;
  isEligible: boolean;
  warningFlag?: 'UNDER_MIN_AGE' | 'OVER_MAX_AGE';
  warningMessage?: string;
}

export const AGE_DROPDOWN_OPTIONS: readonly AgeOptionItem[] = Object.freeze([
  {
    id: 'UNDER_2_MONTHS',
    label: 'Menos de 2 meses (< 8 semanas)',
    category: 'FLAG_WARNING',
    ageInMonths: 1,
    isEligible: false,
    warningFlag: 'UNDER_MIN_AGE',
    warningMessage: 'La edad mínima asegurable es de 2 meses (8 semanas cumplidas).',
  },
  {
    id: '2_MONTHS',
    label: '2 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 2,
    isEligible: true,
  },
  {
    id: '3_MONTHS',
    label: '3 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 3,
    isEligible: true,
  },
  {
    id: '4_MONTHS',
    label: '4 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 4,
    isEligible: true,
  },
  {
    id: '5_MONTHS',
    label: '5 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 5,
    isEligible: true,
  },
  {
    id: '6_MONTHS',
    label: '6 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 6,
    isEligible: true,
  },
  {
    id: '7_MONTHS',
    label: '7 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 7,
    isEligible: true,
  },
  {
    id: '8_MONTHS',
    label: '8 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 8,
    isEligible: true,
  },
  {
    id: '9_MONTHS',
    label: '9 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 9,
    isEligible: true,
  },
  {
    id: '10_MONTHS',
    label: '10 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 10,
    isEligible: true,
  },
  {
    id: '11_MONTHS',
    label: '11 meses',
    category: 'PUPPY_MONTHS',
    ageInMonths: 11,
    isEligible: true,
  },
  {
    id: '1_YEAR',
    label: '1 año (12 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 12,
    isEligible: true,
  },
  {
    id: '2_YEARS',
    label: '2 años (24 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 24,
    isEligible: true,
  },
  {
    id: '3_YEARS',
    label: '3 años (36 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 36,
    isEligible: true,
  },
  {
    id: '4_YEARS',
    label: '4 años (48 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 48,
    isEligible: true,
  },
  {
    id: '5_YEARS',
    label: '5 años (60 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 60,
    isEligible: true,
  },
  {
    id: '6_YEARS',
    label: '6 años (72 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 72,
    isEligible: true,
  },
  {
    id: '7_YEARS',
    label: '7 años (84 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 84,
    isEligible: true,
  },
  {
    id: '8_YEARS',
    label: '8 años (96 meses)',
    category: 'ADULT_YEARS',
    ageInMonths: 96,
    isEligible: true,
  },
  {
    id: '9_YEARS',
    label: '9 años',
    category: 'ADULT_YEARS',
    ageInMonths: 108,
    isEligible: true,
  },
  {
    id: '10_YEARS',
    label: '10 años',
    category: 'ADULT_YEARS',
    ageInMonths: 120,
    isEligible: true,
  },
  {
    id: '11_YEARS',
    label: '11 años',
    category: 'ADULT_YEARS',
    ageInMonths: 132,
    isEligible: true,
  },
  {
    id: '12_YEARS',
    label: '12 años (límite máximo de nuevo ingreso)',
    category: 'ADULT_YEARS',
    ageInMonths: 144,
    isEligible: true,
  },
  {
    id: 'OVER_12_YEARS',
    label: 'Más de 12 años',
    category: 'FLAG_WARNING',
    ageInMonths: 156,
    isEligible: false,
    warningFlag: 'OVER_MAX_AGE',
    warningMessage: 'La edad máxima asegurable para nuevo ingreso es de 12 años (144 meses).',
  },
]);

export type InputType =
  | 'text'
  | 'mode_selection'
  | 'camera_capture'
  | 'age_dropdown'
  | 'location_maps'
  | 'boolean_buttons'
  | 'quote_summary'
  | 'none';

export interface InteractiveOption {
  id: string;
  label: string;
  value: string;
  description?: string;
  isEligible?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user' | 'system';
  text: string;
  inputType?: InputType;
  options?: InteractiveOption[];
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Lo que esta sesión llega a saber. Nada más.
 *
 * Tenía además `petName`, `ageOption`, `ageInMonths`, `city`, `isSterilized`,
 * `deductiblePercentage`, `selectedAddonKeys` y `billingFrequency`: los cinco
 * primeros sin un solo escritor desde que se eliminó la máquina de estados que
 * los recolectaba, y los tres últimos sembrados con un valor fijo que
 * `GET /v1/ai/chat/:sessionId` devolvía como si el cliente lo hubiera elegido.
 *
 * Quien recolecta el resto de los datos de la cotización es Nuquí en el
 * frontend, y quien los recibe es POST /v1/quotes. No pasan por aquí.
 */
export interface ChatSlots {
  species?: Species;
  breedCode?: string;
  breedName?: string;
  sizeCategory?: SizeCategory;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  isLiveCaptureValidated?: boolean;
}

export interface LiveCameraAnalysisResult {
  isValidLivePhoto: boolean;
  petDetected: boolean;
  species: Species;
  breedCode: string;
  breedName: string;
  sizeCategory: SizeCategory;
  confidence: number;
  estimatedAgeMonthsPreliminary?: number;
  visualFeatures?: {
    ears?: string;
    fur?: string;
    size?: string;
    colors?: string[];
  };
  errorReason?: string;
}

export interface ChatSessionState {
  sessionId: string;
  mode: ChatMode;
  currentStep: ConversationStep;
  slots: ChatSlots;
  history: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

