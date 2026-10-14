import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PG_POOL } from '../database/database.module';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let poolMock: any;

  describe('con PostgreSQL conectado', () => {
    beforeEach(async () => {
      poolMock = {
        query: jest.fn().mockResolvedValue({ rows: [{ alive: 1 }] }),
        totalCount: 5,
        idleCount: 4,
        waitingCount: 0,
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: PG_POOL,
            useValue: poolMock,
          },
        ],
      }).compile();

      controller = module.get<HealthController>(HealthController);
    });

    it('debe responder HTTP 200 con status ok y métricas de base de datos', async () => {
      const response = await controller.checkHealth();

      expect(response.status).toBe('ok');
      expect(response.database.status).toBe('connected');
      expect(response.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.database.pool?.total).toBe(5);
      expect(response.timestamp).toBeDefined();
      expect(poolMock.query).toHaveBeenCalledWith('SELECT 1 AS alive');
    });

    it('debe lanzar ServiceUnavailableException cuando la base de datos falla', async () => {
      poolMock.query.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(controller.checkHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('sin PostgreSQL configurado (modo memoria)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: PG_POOL,
            useValue: null,
          },
        ],
      }).compile();

      controller = module.get<HealthController>(HealthController);
    });

    it('debe retornar status degraded indicando base en memoria', async () => {
      const response = await controller.checkHealth();

      expect(response.status).toBe('degraded');
      expect(response.database.status).toBe('in_memory');
      expect(response.timestamp).toBeDefined();
    });
  });
});
