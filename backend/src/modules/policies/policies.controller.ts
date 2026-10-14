import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { CancelPolicyDto } from './dto/cancel-policy.dto';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import { PoliciesService } from './policies.service';
import { PolicyEntity } from './policies.types';

@Controller(['v1/policies', 'policies'])
@UseFilters(HttpExceptionFilter)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  /**
   * POST /v1/policies/checkout
   * Inicia el proceso de emisión, vincula la cotización y genera la preferencia de Mercado Pago.
   * Retorna 201 Created.
   */
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  public async checkoutPolicy(@Body() dto: CheckoutPolicyDto): Promise<{
    policy: PolicyEntity;
    preferenceId: string;
    initPoint: string;
    sandboxInitPoint: string;
  }> {
    return await this.policiesService.initiateCheckout(dto);
  }

  /**
   * GET /v1/policies/:id
   * Consulta los detalles completos de una póliza emitida.
   * Aplica verificación dinámica de vigencia anual.
   * Retorna 200 OK.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getPolicy(@Param('id') id: string): Promise<PolicyEntity> {
    return await this.policiesService.getPolicyById(id);
  }

  /**
   * GET /v1/policies/:id/certificate
   * Consulta la carátula digital certificada de una póliza activa (Ley 527 de 1999).
   */
  @Get(':id/certificate')
  @HttpCode(HttpStatus.OK)
  public async getDigitalCertificate(@Param('id') id: string) {
    return await this.policiesService.getDigitalCertificate(id);
  }

  /**
   * POST /v1/policies/:id/cancel
   * Cancela una póliza registrando la causa y fecha formal.
   * Retorna 200 OK.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancelPolicy(
    @Param('id') id: string,
    @Body() dto: CancelPolicyDto,
  ): Promise<PolicyEntity> {
    return await this.policiesService.cancelPolicy(id, dto);
  }
}
