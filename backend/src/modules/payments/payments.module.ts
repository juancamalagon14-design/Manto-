import { forwardRef, Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module';
import { MercadoPagoAdapter } from './mercadopago.adapter';
import { PaymentsController } from './payments.controller';
import { InMemoryPaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { MERCADOPAGO_ADAPTER, PAYMENTS_REPOSITORY } from './payments.types';

@Module({
  imports: [forwardRef(() => PoliciesModule)],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: MERCADOPAGO_ADAPTER,
      useClass: MercadoPagoAdapter,
    },
    {
      provide: PAYMENTS_REPOSITORY,
      useClass: InMemoryPaymentsRepository,
    },
  ],
  exports: [PaymentsService, MERCADOPAGO_ADAPTER, PAYMENTS_REPOSITORY],
})
export class PaymentsModule {}
