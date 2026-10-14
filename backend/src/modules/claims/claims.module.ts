import { Logger, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { AiModule } from '../ai/ai.module';
import { PoliciesModule } from '../policies/policies.module';
import { ReimbursementsModule } from '../reimbursements/reimbursements.module';
import { AuditLogService } from './audit-log.service';
import { ClaimsDocumentController } from './claims-document.controller';
import { ClaimsDraftService } from './claims-draft.service';
import { ClaimsStorageService } from './claims-storage.service';
import { ClaimsTriageQueueService } from './claims-triage-queue.service';
import { ClaimsTriageWorker } from './claims-triage.worker';
import { ClaimsController } from './claims.controller';
import { PostgresClaimsDraftRepository } from './claim-draft.postgres.repository';
import { InMemoryClaimsDraftRepository } from './claim-draft.repository';
import { CLAIMS_DRAFT_REPOSITORY } from './claim-draft.types';
import { PostgresClaimsRepository } from './claims.postgres.repository';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { CLAIMS_REPOSITORY } from './claims.types';
import { InvoiceOcrService } from './invoice-ocr.service';
import { StpEngineService } from './stp-engine.service';

@Module({
  imports: [PoliciesModule, ReimbursementsModule, AiModule],
  controllers: [ClaimsController, ClaimsDocumentController],
  providers: [
    ClaimsService,
    ClaimsDraftService,
    StpEngineService,
    ClaimsStorageService,
    AuditLogService,
    InvoiceOcrService,
    ClaimsTriageWorker,
    ClaimsTriageQueueService,
    {
      // Postgres cuando hay base configurada; en memoria si no. El token ya
      // existía, así que el servicio no cambia: es el punto de la inversión
      // de dependencias.
      provide: CLAIMS_REPOSITORY,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null) => {
        if (pool) return new PostgresClaimsRepository(pool);
        new Logger('ClaimsModule').warn(
          'Siniestros EN MEMORIA: no sobreviven a un reinicio.',
        );
        return new InMemoryClaimsRepository();
      },
    },
    {
      // Persistencia de Borradores (TTL 24 horas)
      provide: CLAIMS_DRAFT_REPOSITORY,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null) => {
        if (pool) return new PostgresClaimsDraftRepository(pool);
        return new InMemoryClaimsDraftRepository();
      },
    },
  ],
  exports: [
    ClaimsService,
    ClaimsDraftService,
    StpEngineService,
    ClaimsStorageService,
    AuditLogService,
    InvoiceOcrService,
    ClaimsTriageWorker,
    ClaimsTriageQueueService,
    CLAIMS_REPOSITORY,
    CLAIMS_DRAFT_REPOSITORY,
  ],
})
export class ClaimsModule {}


