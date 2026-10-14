import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PaymentsService } from './payments.service';

@Controller(['v1/payments', 'payments'])
@UseFilters(HttpExceptionFilter)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /v1/payments/webhooks/mercadopago
   * Endpoint de notificación asíncrona de Mercado Pago Colombia.
   * Valida la firma criptográfica HMAC SHA-256 e interactúa con PoliciesModule.
   */
  @Post('webhooks/mercadopago')
  @HttpCode(HttpStatus.OK)
  public async handleMercadoPagoWebhook(
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
    @Body() payload?: any,
    @Query() query?: any,
  ) {
    return await this.paymentsService.processWebhookNotification(payload || {}, {
      signature,
      requestId,
      query,
    });
  }
}
