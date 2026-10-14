import { Logger, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { PricingModule } from '../pricing/pricing.module';
import { QuotesController } from './quotes.controller';
import { PostgresQuotesRepository } from './quotes.postgres.repository';
import { InMemoryQuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';
import { QUOTES_REPOSITORY } from './quotes.types';

@Module({
  imports: [EligibilityModule, PricingModule],
  controllers: [QuotesController],
  providers: [
    QuotesService,
    {
      /**
       * Postgres cuando hay base configurada; en memoria si no.
       *
       * El token existía desde el principio, así que el cambio no toca
       * `QuotesService` ni una línea: es el punto de la inversión de
       * dependencias. En memoria queda solo para pruebas unitarias y para
       * levantar el proyecto sin instalar Postgres — no es un modo de
       * operación, porque al reiniciar el proceso se pierde todo.
       */
      provide: QUOTES_REPOSITORY,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null) => {
        if (pool) return new PostgresQuotesRepository(pool);
        new Logger('QuotesModule').warn(
          'Cotizaciones EN MEMORIA: no sobreviven a un reinicio.',
        );
        return new InMemoryQuotesRepository();
      },
    },
  ],
  exports: [QuotesService, QUOTES_REPOSITORY],
})
export class QuotesModule {}
