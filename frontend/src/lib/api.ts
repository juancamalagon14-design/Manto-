import { AgeOptionItem, ChatMessage, ChatSessionState } from '@/types/ai';
import type { AddonOption, BreedCatalogEntry } from '@/types/pricing';
import {
  PricingCalculationInput,
  PricingCalculationResult,
  AddonKey,
  BillingFrequency,
  City,
  DeductibleOption,
  Gender,
  SizeCategory,
  Species,
} from '@/types/pricing';
import { CheckoutPolicyDto, CheckoutResult, QuoteSnapshot } from '@/types/policy';
import { AGE_DROPDOWN_OPTIONS } from './constants';

const BASE_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * Error de la API de Manto. Conserva el status HTTP para que la interfaz pueda
 * distinguir un dato inválido (4xx) de un backend caído (0 / 5xx).
 */
export class MantoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'MantoApiError';
  }

  /** true cuando no se pudo alcanzar el servidor. */
  public get isUnreachable(): boolean {
    return this.status === 0;
  }
}

async function safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_API_URL}${url}`;

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch (networkError: unknown) {
    if (
      (networkError instanceof Error && networkError.name === 'AbortError') ||
      (typeof networkError === 'object' && networkError !== null && 'name' in networkError && (networkError as { name: string }).name === 'AbortError')
    ) {
      throw networkError;
    }
    throw new MantoApiError(
      'No pudimos conectarnos con el servidor de Manto. Revisa tu conexión e intenta de nuevo.',
      0,
      fullUrl,
    );
  }

  if (!response.ok) {
    let detail = 'Error al comunicarse con el servidor';
    try {
      const body = await response.json();
      detail = body.detail || body.message || detail;
    } catch {
      detail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new MantoApiError(detail, response.status, fullUrl);
  }

  return response.json();
}

export const api = {
  /**
   * Catálogo de razas. Fuente de verdad única: el registro actuarial del backend.
   * Sin respaldo local — una lista desincronizada fue justo la causa del bug de
   * `PITBULL`, que el motor rechazaba y disparaba un cálculo distinto.
   */
  async getBreeds(): Promise<BreedCatalogEntry[]> {
    return safeFetch<BreedCatalogEntry[]>('/v1/pricing/breeds');
  },

  /**
   * Listado de razas de manejo especial bajo Ley 1801 (RCE 50 SMLMV obligatoria).
   */
  async getSpecialHandlingBreeds(): Promise<string[]> {
    return safeFetch<string[]>('/v1/pricing/special-handling');
  },

  /**
   * Catálogo de opcionales con sus topes reales. Sin copia local: los límites del
   * frontend se habían desincronizado (prometía $1.500.000 en medicamentos cuando
   * la póliza otorga $600.000).
   */
  async getAddons(): Promise<AddonOption[]> {
    return safeFetch<AddonOption[]>('/v1/pricing/addons');
  },

  async getAgeOptions(): Promise<AgeOptionItem[]> {
    try {
      return await safeFetch<AgeOptionItem[]>('/v1/ai/chat/age-options');
    } catch {
      return [...AGE_DROPDOWN_OPTIONS];
    }
  },

  /**
   * Abre la sesión conversacional. Sin respaldo local: si el backend no responde,
   * la interfaz lo dice en vez de simular una conversación que va a morir al
   * momento de cotizar.
   */
  async startChat(dto?: {
    mode?: 'INITIAL_SELECTION' | 'LIVE_CAMERA';
    customerName?: string;
  }): Promise<{ session: ChatSessionState; welcomeMessage: ChatMessage }> {
    return safeFetch('/v1/ai/chat/start', {
      method: 'POST',
      body: JSON.stringify(dto || { mode: 'INITIAL_SELECTION' }),
    });
  },

  /**
   * Envía la foto en vivo al pipeline de visión. Sin respaldo local: inventar una
   * raza detectada es afirmarle al cliente algo que nadie verificó.
   */
  async sendLivePhoto(
    sessionId: string,
    payload: { imageBase64: string; isLiveCapture: boolean },
  ): Promise<{ session: ChatSessionState; reply: ChatMessage }> {
    return safeFetch(`/v1/ai/chat/${sessionId}/live-photo`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        mimeType: 'image/jpeg',
        timestampCaptured: new Date().toISOString(),
      }),
    });
  },

  /**
   * Única fuente de las cifras que ve el cliente. Nuquí la llama para el plan
   * base y otra vez cada vez que cambian los opcionales: el total nunca se
   * suma en el navegador.
   */
  async calculateQuote(
    input: PricingCalculationInput,
    options?: { signal?: AbortSignal },
  ): Promise<PricingCalculationResult> {
    return safeFetch<PricingCalculationResult>('/v1/pricing/calculate-quote', {
      method: 'POST',
      body: JSON.stringify(input),
      signal: options?.signal,
    });
  },

  /**
   * Emite la cotización formal. Sin respaldo local: un quoteId generado en el
   * navegador no existe en el servidor y arrastraría al cliente hasta el
   * checkout con una cotización inexistente.
   */
  /**
   * Emite la cotización formal.
   *
   * Devuelve el snapshot del servidor tal cual. Antes devolvía
   * `{...res, id, quoteId: res.id || res.quoteId, quoteNumber}` sobre un `any`,
   * inventando un alias `quoteId` que el backend no emite y escondiendo que la
   * respuesta puede venir con `status: 'REJECTED'` y `pricingResult: null`.
   * Quien llama tiene que mirar `status`.
   */
  async createQuote(payload: {
    petName: string;
    species: Species;
    breedCode: string;
    /** Opcional: si no va, el motor usa el típico de la raza. */
    sizeCategory?: SizeCategory;
    ageInMonths: number;
    city: City;
    /** Obligatorio: entra como factor de tarifa. */
    gender: Gender;
    /** Mascotas que esta operación cubre. Desde 2 aplica el descuento. */
    petsInPolicy?: number;
    isSterilized: boolean;
    deductiblePercentage: DeductibleOption;
    selectedAddonKeys: AddonKey[];
    billingFrequency?: BillingFrequency;
  }): Promise<QuoteSnapshot> {
    return safeFetch<QuoteSnapshot>('/v1/quotes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Emite la póliza. Sin respaldo local: un número de póliza falso es peor que un error. */
  async checkoutPolicy(dto: CheckoutPolicyDto): Promise<CheckoutResult> {
    return safeFetch<CheckoutResult>('/v1/policies/checkout', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
};
