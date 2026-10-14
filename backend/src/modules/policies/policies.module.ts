import { forwardRef, Logger, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { PaymentsModule } from '../payments/payments.module';
import { QuotesModule } from '../quotes/quotes.module';
import { PoliciesController } from './policies.controller';
import { PostgresPoliciesRepository } from './policies.postgres.repository';
import { InMemoryPoliciesRepository } from './policies.repository';
import { PoliciesService } from './policies.service';
import { POLICIES_REPOSITORY } from './policies.types';

@Module({
  imports: [QuotesModule, forwardRef(() => PaymentsModule)],
  controllers: [PoliciesController],
  providers: [
    PoliciesService,
    {
      // Postgres cuando hay base configurada; en memoria si no. El token ya
      // existía, así que el servicio no cambia: es el punto de la inversión
      // de dependencias.
      provide: POLICIES_REPOSITORY,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null) => {
        if (pool) return new PostgresPoliciesRepository(pool);
        new Logger('PoliciesModule').warn(
          'Pólizas EN MEMORIA: no sobreviven a un reinicio.',
        );
        return new InMemoryPoliciesRepository();
      },
    },
  ],
  exports: [PoliciesService, POLICIES_REPOSITORY],
})
export class PoliciesModule {}
