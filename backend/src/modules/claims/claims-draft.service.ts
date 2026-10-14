import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ClaimDraftEntity,
  ClaimDraftResponse,
  CLAIMS_DRAFT_REPOSITORY,
  IClaimsDraftRepository,
} from './claim-draft.types';
import { SaveClaimDraftDto } from './dto/save-claim-draft.dto';

@Injectable()
export class ClaimsDraftService {
  private readonly logger = new Logger(ClaimsDraftService.name);

  /** TTL oficial de 24 horas (86.400 segundos / 86.400.000 ms). */
  public static readonly DRAFT_TTL_HOURS = 24;
  public static readonly DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
  public static readonly DRAFT_TTL_SECONDS = 24 * 60 * 60;

  constructor(
    @Inject(CLAIMS_DRAFT_REPOSITORY)
    private readonly draftRepository: IClaimsDraftRepository,
  ) {}

  /**
   * Guarda o actualiza el estado parcial de un reclamo en progreso.
   * Asigna un TTL estricto de 24 horas a partir del momento de guardado.
   */
  public async saveDraft(dto: SaveClaimDraftDto): Promise<ClaimDraftResponse> {
    const effectiveUserId = dto.userId || dto.policyId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ClaimsDraftService.DRAFT_TTL_MS);

    const draftEntity: ClaimDraftEntity = {
      id: uuidv4(),
      userId: effectiveUserId,
      policyId: dto.policyId,
      currentStep: dto.currentStep,
      formData: dto.formData,
      savedAtTimestamp: dto.savedAtTimestamp || now.getTime(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const saved = await this.draftRepository.save(draftEntity);

    this.logger.log(
      `Borrador de siniestro guardado para user/policy=${effectiveUserId} (Paso ${saved.currentStep}, expira en ${saved.expiresAt})`,
    );

    return {
      success: true,
      message: 'Borrador de siniestro guardado exitosamente (TTL 24 horas).',
      draft: {
        userId: saved.userId,
        policyId: saved.policyId,
        currentStep: saved.currentStep,
        formData: saved.formData,
        savedAtTimestamp: saved.savedAtTimestamp,
        expiresAt: saved.expiresAt,
      },
      expiresInSeconds: ClaimsDraftService.DRAFT_TTL_SECONDS,
      expiresAt: saved.expiresAt,
    };
  }

  /**
   * Recupera el borrador activo no expirado (< 24h) para el usuario o póliza.
   * Si no existe o han transcurrido más de 24 horas, lanza NotFoundException.
   */
  public async getDraft(userId: string): Promise<ClaimDraftResponse> {
    const draft = await this.draftRepository.findByUserId(userId);

    if (!draft) {
      throw new NotFoundException(
        `No se encontró un borrador activo para el identificador '${userId}' o ha expirado (validez de 24 horas).`,
      );
    }

    const nowMs = Date.now();
    const expiresAtMs = new Date(draft.expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));

    return {
      success: true,
      draft: {
        userId: draft.userId,
        policyId: draft.policyId,
        currentStep: draft.currentStep,
        formData: draft.formData,
        savedAtTimestamp: draft.savedAtTimestamp,
        expiresAt: draft.expiresAt,
      },
      expiresInSeconds: remainingSeconds,
      expiresAt: draft.expiresAt,
    };
  }

  /**
   * Elimina el borrador de siniestro al radicar formalmente o por descarte voluntario.
   */
  public async deleteDraft(userId: string): Promise<{ success: boolean; message: string }> {
    const deleted = await this.draftRepository.deleteByUserId(userId);

    this.logger.log(
      `Borrador de siniestro para '${userId}' ${deleted ? 'eliminado' : 'no encontrado (ya limpio)'}.`,
    );

    return {
      success: true,
      message: deleted
        ? 'Borrador de siniestro eliminado exitosamente.'
        : 'No había borrador pendiente por eliminar.',
    };
  }
}
