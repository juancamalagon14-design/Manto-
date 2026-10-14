import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { ClaimsStorageService } from './claims-storage.service';
import { ClaimDocumentEntity } from './claims.types';
import {
  GeneratePresignedUrlDto,
  PresignedUrlResponseDto,
} from './dto/generate-presigned-url.dto';

@Controller(['v1/claims/documents', 'claims/documents'])
@UseFilters(HttpExceptionFilter)
export class ClaimsDocumentController {
  constructor(private readonly claimsStorageService: ClaimsStorageService) {}

  /**
   * POST /v1/claims/documents/presigned-url
   * Genera una URL prefirmada PUT (15 minutos) para Cloudflare R2 / AWS S3.
   * Permite la subida segura y aislada de facturas y soportes médicos sin saturar
   * el backend de NestJS con binarios pesados.
   */
  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  public async generatePresignedUrl(
    @Body() dto: GeneratePresignedUrlDto,
    @Req() req?: any,
  ): Promise<PresignedUrlResponseDto> {
    // Si hay usuario autenticado en JWT req.user.id se utiliza; de lo contrario fallback seguro
    const userId = req?.user?.id || dto.userId || 'anonymous-claimant-user';
    return await this.claimsStorageService.generatePresignedUploadUrl(dto, userId);
  }

  /**
   * GET /v1/claims/documents/:id
   * Consulta el estado de carga y metadatos de un documento.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getDocument(@Param('id') id: string): Promise<ClaimDocumentEntity | null> {
    return await this.claimsStorageService.getDocumentById(id);
  }

  /**
   * POST /v1/claims/documents/:id/confirm
   * Confirma la carga exitosa de un soporte en el storage.
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  public async confirmUpload(
    @Param('id') id: string,
    @Req() req?: any,
  ): Promise<ClaimDocumentEntity> {
    const userId = req?.user?.id || 'anonymous-claimant-user';
    return await this.claimsStorageService.confirmDocumentUpload(id, userId);
  }
}
