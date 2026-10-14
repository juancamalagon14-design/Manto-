import { Module } from '@nestjs/common';
import { BreBAdapter } from './bre-b.adapter';
import { InMemoryReimbursementsRepository } from './reimbursements.repository';
import { ReimbursementsService } from './reimbursements.service';
import { BRE_B_ADAPTER, REIMBURSEMENTS_REPOSITORY } from './reimbursements.types';

@Module({
  providers: [
    ReimbursementsService,
    {
      provide: BRE_B_ADAPTER,
      useClass: BreBAdapter,
    },
    {
      provide: REIMBURSEMENTS_REPOSITORY,
      useClass: InMemoryReimbursementsRepository,
    },
  ],
  exports: [ReimbursementsService, BRE_B_ADAPTER, REIMBURSEMENTS_REPOSITORY],
})
export class ReimbursementsModule {}
