import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PricingModule } from './modules/pricing/pricing.module';
import { EligibilityModule } from './modules/eligibility/eligibility.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { AiModule } from './modules/ai/ai.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { ReimbursementsModule } from './modules/reimbursements/reimbursements.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    /**
     * Configuración. Estaba en las dependencias sin registrar, así que las claves
     * se leían con `process.env` directo y sin validación. Registrarlo es el paso
     * previo a validar el esquema de variables de entorno.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    /**
     * Limitación de tasa. También estaba instalada y apagada: la API quedaba
     * expuesta a fuerza bruta y a abuso del endpoint de visión, que es el más
     * costoso porque llama a Gemini.
     *
     * 120 peticiones por minuto por IP como línea base, más dos cupos
     * nombrados: uno holgado para los catálogos estáticos (que se piden en
     * cada carga del cotizador) y uno estricto para visión, que es la llamada
     * costosa porque va a Gemini.
     */
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'catalogos', ttl: 60_000, limit: 600 },
      { name: 'vision', ttl: 60_000, limit: 10 },
    ]),

    DatabaseModule,
    PricingModule,
    EligibilityModule,
    QuotesModule,
    AiModule,
    PaymentsModule,
    PoliciesModule,
    ReimbursementsModule,
    ClaimsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
