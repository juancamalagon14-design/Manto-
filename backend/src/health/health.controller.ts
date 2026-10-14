import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: {
    status: 'connected' | 'in_memory' | 'disconnected';
    latencyMs?: number;
    pool?: {
      total: number;
      idle: number;
      waiting: number;
    };
    error?: string;
  };
  service: string;
  version: string;
}

@Controller(['health', 'v1/health'])
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool | null) {}

  /**
   * Endpoint de monitoreo de salud y liveness/readiness probe.
   * Accesible en:
   *  - GET /health (Reverse Proxies, Docker Compose, Kubernetes)
   *  - GET /v1/health (API Gateway, Clientes Frontend, Health Check PaaS)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  public async checkHealth(): Promise<HealthCheckResponse> {
    const timestamp = new Date().toISOString();
    const uptimeSeconds = Math.floor(process.uptime());
    const environment = process.env.NODE_ENV || 'development';

    // Si no hay base de datos configurada, opera en memoria (modo degradado / dev)
    if (!this.pool) {
      return {
        status: 'degraded',
        timestamp,
        uptimeSeconds,
        environment,
        database: {
          status: 'in_memory',
        },
        service: 'manto-backend',
        version: '2.0.0',
      };
    }

    try {
      const start = Date.now();
      // Verificación de conectividad activa contra PostgreSQL 16
      await this.pool.query('SELECT 1 AS alive');
      const latencyMs = Date.now() - start;

      return {
        status: 'ok',
        timestamp,
        uptimeSeconds,
        environment,
        database: {
          status: 'connected',
          latencyMs,
          pool: {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount,
          },
        },
        service: 'manto-backend',
        version: '2.0.0',
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`HealthCheck falló al consultar PostgreSQL: ${errorMessage}`);

      throw new ServiceUnavailableException({
        status: 'error',
        timestamp,
        uptimeSeconds,
        environment,
        database: {
          status: 'disconnected',
          error: environment === 'production' ? 'Database connection failure' : errorMessage,
        },
        service: 'manto-backend',
        version: '2.0.0',
      });
    }
  }
}
