import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InMemoryClaimsDraftRepository } from './claim-draft.repository';
import { CLAIMS_DRAFT_REPOSITORY } from './claim-draft.types';
import { ClaimsDraftService } from './claims-draft.service';
import { SaveClaimDraftDto } from './dto/save-claim-draft.dto';

describe('ClaimsDraftService (Persistencia de Borradores con TTL 24h)', () => {
  let service: ClaimsDraftService;
  let repository: InMemoryClaimsDraftRepository;

  const sampleDraftDto: SaveClaimDraftDto = {
    userId: 'usr-12345',
    policyId: 'pol-67890',
    currentStep: 2,
    formData: {
      incidentType: 'ACCIDENT',
      incidentDate: '2026-09-28',
      description: 'Corte superficial en pata jugando en parque',
      claimedAmount: 180000,
    },
    savedAtTimestamp: Date.now(),
  };

  beforeEach(async () => {
    repository = new InMemoryClaimsDraftRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsDraftService,
        {
          provide: CLAIMS_DRAFT_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ClaimsDraftService>(ClaimsDraftService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('saveDraft', () => {
    it('debe guardar un borrador con éxito y asignar TTL de 24 horas (86.400 segundos)', async () => {
      const result = await service.saveDraft(sampleDraftDto);

      expect(result.success).toBe(true);
      expect(result.expiresInSeconds).toBe(86400);
      expect(result.expiresAt).toBeDefined();
      expect(result.draft).toBeDefined();
      expect(result.draft?.userId).toBe('usr-12345');
      expect(result.draft?.policyId).toBe('pol-67890');
      expect(result.draft?.currentStep).toBe(2);
      expect(result.draft?.formData).toEqual(sampleDraftDto.formData);

      // Fecha de expiración debe ser ~24 horas en el futuro
      const expiresAtMs = new Date(result.expiresAt!).getTime();
      const diffHours = (expiresAtMs - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it('debe usar policyId como fallback si no se especifica userId', async () => {
      const dtoWithoutUser: SaveClaimDraftDto = {
        policyId: 'pol-isolated-001',
        currentStep: 1,
        formData: { description: 'Emergencia veterinaria' },
      };

      const result = await service.saveDraft(dtoWithoutUser);

      expect(result.success).toBe(true);
      expect(result.draft?.userId).toBe('pol-isolated-001');

      // Recuperación por policyId
      const retrieved = await service.getDraft('pol-isolated-001');
      expect(retrieved.success).toBe(true);
      expect(retrieved.draft?.policyId).toBe('pol-isolated-001');
    });

    it('debe actualizar el borrador existente para el mismo usuario y reiniciar TTL', async () => {
      await service.saveDraft(sampleDraftDto);

      // Actualizar a paso 3 con más datos
      const updatedDto: SaveClaimDraftDto = {
        ...sampleDraftDto,
        currentStep: 3,
        formData: {
          ...sampleDraftDto.formData,
          payoutChannel: 'BRE_B',
          breBValue: '3001234567',
        },
      };

      const result = await service.saveDraft(updatedDto);
      expect(result.draft?.currentStep).toBe(3);
      expect(result.draft?.formData).toHaveProperty('payoutChannel', 'BRE_B');

      const retrieved = await service.getDraft('usr-12345');
      expect(retrieved.draft?.currentStep).toBe(3);
    });
  });

  describe('getDraft', () => {
    it('debe recuperar un borrador activo dentro de la ventana de 24 horas', async () => {
      await service.saveDraft(sampleDraftDto);

      const result = await service.getDraft('usr-12345');

      expect(result.success).toBe(true);
      expect(result.draft?.userId).toBe('usr-12345');
      expect(result.expiresInSeconds).toBeGreaterThan(86300);
      expect(result.expiresInSeconds).toBeLessThanOrEqual(86400);
    });

    it('debe permitir recuperar el borrador consultando por policyId', async () => {
      await service.saveDraft(sampleDraftDto);

      const result = await service.getDraft('pol-67890');

      expect(result.success).toBe(true);
      expect(result.draft?.policyId).toBe('pol-67890');
    });

    it('debe lanzar NotFoundException si no existe borrador para el usuario', async () => {
      await expect(service.getDraft('usr-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe invalidar y rechazar con NotFoundException si el borrador superó las 24 horas (expirado)', async () => {
      // Guardar con fecha expirada (hace 25 horas)
      const pastNow = Date.now() - 25 * 60 * 60 * 1000;
      const expiredDraft = {
        id: 'draft-expired-01',
        userId: 'usr-expired',
        policyId: 'pol-expired',
        currentStep: 1,
        formData: { test: true },
        savedAtTimestamp: pastNow,
        createdAt: new Date(pastNow).toISOString(),
        updatedAt: new Date(pastNow).toISOString(),
        expiresAt: new Date(pastNow + 24 * 60 * 60 * 1000).toISOString(), // Expiró hace 1 hora
      };

      await repository.save(expiredDraft);

      // Debe lanzar NotFoundException porque está expirado
      await expect(service.getDraft('usr-expired')).rejects.toThrow(
        NotFoundException,
      );

      // Y verificar que se eliminó del almacén
      const inMemory = await repository.findByUserId('usr-expired');
      expect(inMemory).toBeNull();
    });
  });

  describe('deleteDraft', () => {
    it('debe eliminar el borrador exitosamente', async () => {
      await service.saveDraft(sampleDraftDto);

      const deleteRes = await service.deleteDraft('usr-12345');
      expect(deleteRes.success).toBe(true);

      await expect(service.getDraft('usr-12345')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe responder success: true incluso si no había borrador (idempotencia)', async () => {
      const deleteRes = await service.deleteDraft('usr-no-draft');
      expect(deleteRes.success).toBe(true);
    });
  });
});
