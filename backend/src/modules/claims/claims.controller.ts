import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { ClaimsDraftService } from './claims-draft.service';
import { ClaimDraftResponse } from './claim-draft.types';
import { ClaimsService } from './claims.service';
import { ClaimEntity } from './claims.types';
import { AdjudicateClaimDto } from './dto/adjudicate-claim.dto';
import { LiveClaimStatusDto } from './dto/live-claim-status.dto';
import { SaveClaimDraftDto } from './dto/save-claim-draft.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';

@Controller(['v1/claims', 'claims'])
@UseFilters(HttpExceptionFilter)
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
    private readonly claimsDraftService: ClaimsDraftService,
  ) {}

  /**
   * POST /v1/claims/draft
   * Guarda o actualiza el estado parcial de un reclamo en progreso con TTL de 24 horas.
   * Retorna 200 OK con confirmación y fecha de expiración.
   */
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  public async saveDraft(@Body() dto: SaveClaimDraftDto): Promise<ClaimDraftResponse> {
    return await this.claimsDraftService.saveDraft(dto);
  }

  /**
   * GET /v1/claims/draft/:userId
   * Retorna el borrador activo no expirado (< 24h) para rehidratar el formulario.
   * Si ha transcurrido más de 24 horas o no existe, retorna 404 Not Found.
   */
  @Get('draft/:userId')
  @HttpCode(HttpStatus.OK)
  public async getDraft(@Param('userId') userId: string): Promise<ClaimDraftResponse> {
    return await this.claimsDraftService.getDraft(userId);
  }

  /**
   * DELETE /v1/claims/draft/:userId
   * Elimina el borrador al radicar exitosamente o por descarte del tomador.
   * Retorna 200 OK.
   */
  @Delete('draft/:userId')
  @HttpCode(HttpStatus.OK)
  public async deleteDraft(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    return await this.claimsDraftService.deleteDraft(userId);
  }

  /**
   * POST /v1/claims
   * Radica un nuevo siniestro veterinario con validación de factura DIAN.
   * Ejecuta el motor STP (Straight-Through Processing) y, si califica,
   * liquida y dispersa inmediatamente vía Bre-B (Banco de la República).
   * Retorna 201 Created.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async submitClaim(@Body() dto: SubmitClaimDto): Promise<ClaimEntity> {
    return await this.claimsService.submitClaim(dto);
  }

  /**
   * GET /v1/claims
   * Retorna el listado general de siniestros para auditoría y seguimiento.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  public async listClaims(): Promise<ClaimEntity[]> {
    return await this.claimsService.listClaims();
  }

  /**
   * GET /v1/claims/:id
   * Consulta el estado actuarial y detalle del reembolso de un siniestro.
   * Retorna 200 OK.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getClaim(@Param('id') id: string): Promise<ClaimEntity> {
    return await this.claimsService.getClaimById(id);
  }

  /**
   * GET /v1/claims/:id/live-status y GET /v1/claims/:id/status
   * Consulta el estatus en vivo y timeline transaccional (LiveClaimTracker)
   * con los 4 hitos canónicos: Radicación, Triage IA, Decisión y Dispersión Bre-B.
   * Retorna 200 OK.
   */
  @Get([':id/status', ':id/live-status'])
  @HttpCode(HttpStatus.OK)
  public async getClaimStatus(@Param('id') id: string): Promise<LiveClaimStatusDto> {
    return await this.claimsService.getClaimLiveStatus(id);
  }

  /**
   * POST /v1/claims/:id/adjudicate
   * Permite al ajustador médico humano aprobar o ajustar siniestros en HUMAN_REVIEW.
   * Tras la aprobación, dispara la dispersión inmediata a través de Bre-B.
   * Retorna 200 OK.
   */
  @Post(':id/adjudicate')
  @HttpCode(HttpStatus.OK)
  public async adjudicateClaim(
    @Param('id') id: string,
    @Body() dto: AdjudicateClaimDto,
  ): Promise<ClaimEntity> {
    return await this.claimsService.adjudicateClaimByHuman(id, dto);
  }
}

