import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { toCop } from '../../common/types/money';
import { MockBreBAdapter } from './bre-b.adapter';
import { InMemoryReimbursementsRepository } from './reimbursements.repository';
import { ReimbursementsService } from './reimbursements.service';
import { BRE_B_ADAPTER, BreBKey, REIMBURSEMENTS_REPOSITORY } from './reimbursements.types';

describe('ReimbursementsService', () => {
  let service: ReimbursementsService;
  let adapter: MockBreBAdapter;
  let repository: InMemoryReimbursementsRepository;

  beforeEach(async () => {
    adapter = new MockBreBAdapter();
    repository = new InMemoryReimbursementsRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReimbursementsService,
        {
          provide: BRE_B_ADAPTER,
          useValue: adapter,
        },
        {
          provide: REIMBURSEMENTS_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ReimbursementsService>(ReimbursementsService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('disburseClaimViaBreB', () => {
    const validKey: BreBKey = {
      type: 'PHONE_NUMBER',
      value: '3151234567',
    };

    it('debe ejecutar una dispersión inmediata exitosa y persistirla como SETTLED_INSTANTLY', async () => {
      const claimId = '123e4567-e89b-12d3-a456-426614174001';
      const policyId = '123e4567-e89b-12d3-a456-426614174002';
      const amount = toCop(450000);

      const result = await service.disburseClaimViaBreB(claimId, policyId, amount, validKey);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.claimId).toBe(claimId);
      expect(result.policyId).toBe(policyId);
      expect(result.amountCop).toBe(amount);
      expect(result.status).toBe('SETTLED_INSTANTLY');
      expect(result.financialInstitution).toBe('Nequi');
      expect(result.breBTrackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
      expect(result.disbursedAt).toBeDefined();

      // Verificar persistencia en repositorio
      const persisted = await repository.findByClaimId(claimId);
      expect(persisted).toBeDefined();
      expect(persisted?.id).toBe(result.id);
    });

    it('debe arrojar BadRequestException si el monto es menor o igual a cero', async () => {
      await expect(
        service.disburseClaimViaBreB('claim-01', 'pol-01', toCop(0), validKey),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.disburseClaimViaBreB('claim-01', 'pol-01', -100n as any, validKey),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe arrojar BadRequestException si la llave Bre-B tiene sintaxis inválida', async () => {
      const invalidKey: BreBKey = {
        type: 'PHONE_NUMBER',
        value: '12345',
      };

      await expect(
        service.disburseClaimViaBreB('claim-01', 'pol-01', toCop(200000), invalidKey),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDisbursementByClaimId & getDisbursementById', () => {
    it('debe consultar la dispersión por claimId y por UUID id', async () => {
      const claimId = 'claim-uuid-test';
      const policyId = 'policy-uuid-test';
      const key: BreBKey = { type: 'EMAIL', value: 'cliente@daviplata.com' };

      const tx = await service.disburseClaimViaBreB(claimId, policyId, toCop(150000), key);

      const byClaim = await service.getDisbursementByClaimId(claimId);
      expect(byClaim?.id).toBe(tx.id);
      expect(byClaim?.financialInstitution).toBe('Daviplata');

      const byId = await service.getDisbursementById(tx.id);
      expect(byId.id).toBe(tx.id);
    });

    it('debe arrojar NotFoundException cuando el id de dispersión no existe', async () => {
      await expect(service.getDisbursementById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
