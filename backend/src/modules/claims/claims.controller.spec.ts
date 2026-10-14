import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { toCop } from '../../common/types/money';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ClaimEntity } from './claims.types';
import { AdjudicateClaimDto } from './dto/adjudicate-claim.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';

import { ClaimsDraftService } from './claims-draft.service';
import { SaveClaimDraftDto } from './dto/save-claim-draft.dto';

describe('ClaimsController', () => {
  let controller: ClaimsController;
  let serviceMock: {
    submitClaim: jest.Mock;
    getClaimById: jest.Mock;
    adjudicateClaimByHuman: jest.Mock;
  };
  let draftServiceMock: {
    saveDraft: jest.Mock;
    getDraft: jest.Mock;
    deleteDraft: jest.Mock;
  };

  const mockClaim: ClaimEntity = {
    id: 'clm-uuid-1234',
    claimNumber: 'CLM-2026-A1B2C3',
    policyId: 'pol-uuid-1234',
    policyNumber: 'MTO-PET-2026-990102',
    incidentType: 'ACCIDENT',
    incidentDate: new Date().toISOString(),
    description: 'Atención de emergencia veterinaria por trauma.',
    dianInvoice: {
      invoiceNumber: 'FE-1020',
      providerNit: '900987654-1',
      providerName: 'Veterinaria Central',
      dianCufe: 'cufe-hex-value-1234567890',
      issueDate: new Date().toISOString(),
      items: [{ description: 'Sutura', amountCop: toCop(150000), isCovered: true, category: 'SURG' }],
      totalInvoiceCop: toCop(150000),
      ocrConfidence: 0.98,
    },
    breBKey: { type: 'PHONE_NUMBER', value: '3001234567' },
    eligibleExpensesCop: toCop(150000),
    deductibleCop: toCop(22500),
    netReimbursementCop: toCop(127500),
    status: 'PAID',
    stpEvaluation: {
      eligibleForStp: true,
      tierCategory: 'BASE_ACCIDENT',
      tierLimitCop: toCop(300000),
      rejectionReasons: [],
      fraudRiskScore: 0,
    },
    disbursementId: 'disb-uuid-1234',
    disbursementTrackingCode: 'BREB-2026-FFAA1122',
    financialInstitution: 'Bancolombia',
    clinicalRecord: {
      symptomsOnsetDate: new Date().toISOString(),
      presumptiveDiagnosis: 'Atención de emergencia veterinaria por trauma.',
      veterinarianName: 'Dr. Alejandro Restrepo',
      hasPreExistingSigns: false,
      ocrConfidence: 0.98,
    },
    submittedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    serviceMock = {
      submitClaim: jest.fn().mockResolvedValue(mockClaim),
      getClaimById: jest.fn().mockResolvedValue(mockClaim),
      adjudicateClaimByHuman: jest.fn().mockResolvedValue({
        ...mockClaim,
        status: 'PAID',
        adjudicatedBy: 'ADJ-HUMAN-01',
      }),
    };

    draftServiceMock = {
      saveDraft: jest.fn().mockResolvedValue({
        success: true,
        message: 'Borrador de siniestro guardado exitosamente (TTL 24 horas).',
        draft: {
          userId: 'usr-123',
          policyId: 'pol-123',
          currentStep: 2,
          formData: {},
          savedAtTimestamp: Date.now(),
        },
        expiresInSeconds: 86400,
      }),
      getDraft: jest.fn().mockResolvedValue({
        success: true,
        draft: {
          userId: 'usr-123',
          policyId: 'pol-123',
          currentStep: 2,
          formData: {},
          savedAtTimestamp: Date.now(),
        },
        expiresInSeconds: 86400,
      }),
      deleteDraft: jest.fn().mockResolvedValue({
        success: true,
        message: 'Borrador de siniestro eliminado exitosamente.',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClaimsController],
      providers: [
        {
          provide: ClaimsService,
          useValue: serviceMock,
        },
        {
          provide: ClaimsDraftService,
          useValue: draftServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ClaimsController>(ClaimsController);
  });

  it('debe estar definido e instanciado', () => {
    expect(controller).toBeDefined();
  });

  describe('Validación de DTOs', () => {
    it('debe fallar la validación cuando faltan campos obligatorios en SubmitClaimDto', async () => {
      const dto = plainToInstance(SubmitClaimDto, {
        policyId: '',
        incidentType: 'INVALID_TYPE' as any,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'policyId')).toBe(true);
      expect(errors.some((e) => e.property === 'incidentType')).toBe(true);
      expect(errors.some((e) => e.property === 'dianInvoice')).toBe(true);
      expect(errors.some((e) => e.property === 'clinicalRecord')).toBe(true);
      expect(errors.some((e) => e.property === 'breBKey')).toBe(true);
    });

    it('debe fallar cuando el tipo de llave Bre-B no es válido', async () => {
      const dto = plainToInstance(SubmitClaimDto, {
        policyId: 'pol-123',
        incidentType: 'ACCIDENT',
        incidentDate: new Date().toISOString(),
        description: 'Descripción válida de emergencia',
        eligibleExpensesCop: 100000,
        dianInvoice: {
          invoiceNumber: 'FE-1',
          providerNit: '900',
          providerName: 'Vet',
          dianCufe: 'cufe12345678',
          issueDate: new Date().toISOString(),
          items: [{ description: 'Test', amountCop: 100000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 100000,
          ocrConfidence: 0.95,
        },
        clinicalRecord: {
          symptomsOnsetDate: new Date().toISOString(),
          presumptiveDiagnosis: 'Descripción válida de emergencia',
          veterinarianName: 'Dr. Alejandro Restrepo',
          hasPreExistingSigns: false,
          ocrConfidence: 0.95,
        },
        breBKey: {
          type: 'CRYPTO_WALLET' as any,
          value: '0x123',
        },
      });

      const errors = await validate(dto);
      const breBError = errors.find((e) => e.property === 'breBKey');
      expect(breBError).toBeDefined();
    });

    it('debe fallar la validación de AdjudicateClaimDto con decisión inválida', async () => {
      const dto = plainToInstance(AdjudicateClaimDto, {
        decision: 'MAYBE' as any,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'decision')).toBe(true);
    });

    it('debe fallar la validación de AdjudicateClaimDto si approvedAmountCop tiene decimales (CERO flotantes)', async () => {
      const dto = plainToInstance(AdjudicateClaimDto, {
        decision: 'APPROVED',
        approvedAmountCop: 150000.75,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'approvedAmountCop')).toBe(true);
      const amountError = errors.find((e) => e.property === 'approvedAmountCop');
      expect(amountError?.constraints?.isInt).toBeDefined();
    });
  });

  describe('Endpoints HTTP', () => {
    it('POST /v1/claims debe delegar a submitClaim y retornar el siniestro creado', async () => {
      const submitDto: SubmitClaimDto = {
        policyId: 'pol-uuid-1234',
        incidentType: 'ACCIDENT',
        incidentDate: new Date().toISOString(),
        description: 'Atención médica veterinaria por accidente.',
        eligibleExpensesCop: 150000,
        dianInvoice: {
          invoiceNumber: mockClaim.dianInvoice.invoiceNumber,
          providerNit: mockClaim.dianInvoice.providerNit,
          providerName: mockClaim.dianInvoice.providerName,
          dianCufe: mockClaim.dianInvoice.dianCufe,
          issueDate: mockClaim.dianInvoice.issueDate,
          items: mockClaim.dianInvoice.items.map((i) => ({
            description: i.description,
            amountCop: Number(i.amountCop),
            isCovered: i.isCovered,
            category: i.category,
          })),
          totalInvoiceCop: Number(mockClaim.dianInvoice.totalInvoiceCop),
          ocrConfidence: mockClaim.dianInvoice.ocrConfidence,
        },
        clinicalRecord: {
          symptomsOnsetDate: new Date().toISOString(),
          presumptiveDiagnosis: 'Atención médica veterinaria por accidente.',
          veterinarianName: 'Dr. Alejandro Restrepo',
          hasPreExistingSigns: false,
          ocrConfidence: 0.98,
        },
        breBKey: mockClaim.breBKey,
      };

      const result = await controller.submitClaim(submitDto);

      expect(serviceMock.submitClaim).toHaveBeenCalledWith(submitDto);
      expect(result).toEqual(mockClaim);
      expect(result.status).toBe('PAID');
    });

    it('GET /v1/claims/:id debe retornar el siniestro correspondiente', async () => {
      const result = await controller.getClaim('clm-uuid-1234');

      expect(serviceMock.getClaimById).toHaveBeenCalledWith('clm-uuid-1234');
      expect(result.id).toBe('clm-uuid-1234');
    });

    it('POST /v1/claims/:id/adjudicate debe delegar a adjudicateClaimByHuman', async () => {
      const adjudicateDto: AdjudicateClaimDto = {
        decision: 'APPROVED',
        adjusterId: 'ADJ-HUMAN-01',
        adjusterNotes: 'Liquidación conforme.',
      };

      const result = await controller.adjudicateClaim('clm-uuid-1234', adjudicateDto);

      expect(serviceMock.adjudicateClaimByHuman).toHaveBeenCalledWith(
        'clm-uuid-1234',
        adjudicateDto,
      );
      expect(result.status).toBe('PAID');
      expect(result.adjudicatedBy).toBe('ADJ-HUMAN-01');
    });

    it('POST /v1/claims/draft debe guardar el borrador delegando en ClaimsDraftService', async () => {
      const draftDto: SaveClaimDraftDto = {
        userId: 'usr-123',
        policyId: 'pol-123',
        currentStep: 2,
        formData: { description: 'Siniestro en progreso' },
      };

      const result = await controller.saveDraft(draftDto);

      expect(draftServiceMock.saveDraft).toHaveBeenCalledWith(draftDto);
      expect(result.success).toBe(true);
      expect(result.expiresInSeconds).toBe(86400);
    });

    it('GET /v1/claims/draft/:userId debe retornar el borrador activo delegando en ClaimsDraftService', async () => {
      const result = await controller.getDraft('usr-123');

      expect(draftServiceMock.getDraft).toHaveBeenCalledWith('usr-123');
      expect(result.success).toBe(true);
      expect(result.draft?.userId).toBe('usr-123');
    });

    it('DELETE /v1/claims/draft/:userId debe eliminar el borrador delegando en ClaimsDraftService', async () => {
      const result = await controller.deleteDraft('usr-123');

      expect(draftServiceMock.deleteDraft).toHaveBeenCalledWith('usr-123');
      expect(result.success).toBe(true);
    });
  });
});
