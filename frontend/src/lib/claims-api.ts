import {
  GeneratePresignedUrlRequest,
  LiveClaimStatus,
  PresignedUrlResponse,
  SubmitClaimRequest,
  SubmitClaimResponse,
  ClaimEntityData,
  AdjudicateClaimRequest,
  SaveClaimDraftDto,
  ClaimDraftResponse,
} from '@/types/claims';
import { MantoApiError } from './api';

const BASE_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

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
  } catch (_networkError) {
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

/**
 * Calcula el hash SHA-256 binario de un archivo de manera segura en el navegador
 * utilizando la Web Crypto API estándar.
 */
export async function calculateFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const claimsApi = {
  /**
   * Solicita una Presigned URL efímera a Cloudflare R2 / AWS S3 para cargar el soporte.
   */
  async generatePresignedUrl(
    dto: GeneratePresignedUrlRequest,
  ): Promise<PresignedUrlResponse> {
    return safeFetch<PresignedUrlResponse>('/v1/claims/documents/presigned-url', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  /**
   * Sube el binario directamente al bucket de objetos sin saturar la memoria del backend.
   */
  async uploadFileToStorage(
    file: File,
    presigned: PresignedUrlResponse,
  ): Promise<void> {
    const response = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        ...(presigned.requiredHeaders || {}),
      },
      body: file,
    });

    if (!response.ok) {
      throw new MantoApiError(
        `Error al cargar el archivo en el almacenamiento seguro (HTTP ${response.status})`,
        response.status,
        presigned.uploadUrl,
      );
    }
  },

  /**
   * Radicación formal del siniestro.
   */
  async submitClaim(dto: SubmitClaimRequest): Promise<SubmitClaimResponse> {
    return safeFetch<SubmitClaimResponse>('/v1/claims', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  /**
   * Consulta del estado en vivo y la línea de tiempo transaccional.
   */
  async getClaimLiveStatus(claimId: string): Promise<LiveClaimStatus> {
    return safeFetch<LiveClaimStatus>(`/v1/claims/${claimId}/status`);
  },

  /**
   * Consulta el listado general de siniestros para la consola de auditoría médica.
   */
  async listClaims(): Promise<ClaimEntityData[]> {
    return safeFetch<ClaimEntityData[]>('/v1/claims');
  },

  /**
   * Consulta el detalle completo de un siniestro por su ID.
   */
  async getClaimById(claimId: string): Promise<ClaimEntityData> {
    return safeFetch<ClaimEntityData>(`/v1/claims/${claimId}`);
  },

  /**
   * Resolución / adjudicación pericial de un siniestro (aprobación médica o rechazo).
   */
  async adjudicateClaim(
    claimId: string,
    dto: AdjudicateClaimRequest,
  ): Promise<ClaimEntityData> {
    return safeFetch<ClaimEntityData>(`/v1/claims/${claimId}/adjudicate`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  /**
   * Guarda o actualiza el borrador del siniestro (TTL 24 horas).
   */
  async saveDraft(dto: SaveClaimDraftDto): Promise<ClaimDraftResponse> {
    return safeFetch<ClaimDraftResponse>('/v1/claims/draft', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  /**
   * Obtiene el borrador activo del usuario si no ha expirado (< 24 horas).
   */
  async getDraft(userId: string): Promise<ClaimDraftResponse | null> {
    try {
      return await safeFetch<ClaimDraftResponse>(`/v1/claims/draft/${encodeURIComponent(userId)}`);
    } catch (err) {
      if (err instanceof MantoApiError && err.status === 404) {
        return null;
      }
      return null;
    }
  },

  /**
   * Elimina el borrador tras radicación formal o descarte voluntario.
   */
  async deleteDraft(userId: string): Promise<void> {
    try {
      await safeFetch(`/v1/claims/draft/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignorar si ya no existía
    }
  },
};
