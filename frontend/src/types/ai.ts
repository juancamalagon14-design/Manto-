import { AddonKey, City, DeductibleOption, SizeCategory, Species } from './pricing';
import { QuoteSnapshot } from './policy';

export type ChatMode = 'INITIAL_SELECTION' | 'LIVE_CAMERA';

export type ConversationStep =
  | 'WELCOME'
  | 'SELECT_MODE'
  | 'CAMERA_CAPTURE'
  | 'POST_PHOTO_AGE_VERIFICATION'
  | 'ASK_PET_NAME'
  | 'ASK_BREED'
  | 'ASK_BREED_DETAILS'
  | 'ASK_AGE_DROPDOWN'
  | 'ASK_LOCATION_MAPS'
  | 'ASK_STERILIZATION'
  | 'READY_FOR_QUOTE'
  | 'QUOTE_OFFERED'
  | 'INELIGIBLE_AGE';

export type AgeSelectionOption =
  | 'UNDER_2_MONTHS'
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
  | '1_YEAR'
  | '2_YEARS'
  | '3_YEARS'
  | '4_YEARS'
  | '5_YEARS'
  | '6_YEARS'
  | '7_YEARS'
  | '8_YEARS'
  | '9_YEARS'
  | '10_YEARS'
  | '11_YEARS'
  | '12_YEARS'
  | '13_YEARS'
  | '14_YEARS'
  | '14_PLUS_YEARS'
  | 'OVER_12_YEARS'
  | 'OVER_8_YEARS';

export interface AgeOptionItem {
  id: AgeSelectionOption;
  label: string;
  category: 'PUPPY_MONTHS' | 'ADULT_YEARS' | 'SENIOR_YEARS' | 'FLAG_WARNING';
  ageInMonths: number;
  isEligible: boolean;
  warningFlag?: 'UNDER_MIN_AGE' | 'OVER_MAX_AGE';
  warningMessage?: string;
}

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
 * Espejo de `ChatSlots` del backend. Solo lo que la sesión del servidor llega
 * a saber: el análisis de la foto y los datos de contacto. El resto de la
 * cotización lo recolecta Nuquí y viaja a POST /v1/quotes.
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
