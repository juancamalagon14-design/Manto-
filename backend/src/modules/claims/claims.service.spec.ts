import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { toCop } from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import { PolicyEntity } from '../policies/policies.types';
import { MockBreBAdapter } from '../reimbursements/bre-b.adapter';
import { InMemoryReimbursementsRepository } from '../reimbursements/reimbursements.repository';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import { BRE_B_ADAPTER, REIMBURSEMENTS_REPOSITORY } from '../reimbursements/reimbursements.types';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { CLAIMS_REPOSITORY } from './claims.types';
import { ClinicalRecordDto, SubmitClaimDto } from './dto/submit-claim.dto';
import { StpEngineService } from './stp-engine.service';

describe('ClaimsService (Gestión de Siniestros y Dispersión Bre-B)', () => {
  let claimsService: ClaimsService;
  let claimsRepository: InMemoryClaimsRepository;
  let reimbursementsService: ReimbursementsService;
  let policiesServiceMock: { getPolicyById: jest.Mock };

  const effectiveDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // Hace 60 días
  const recentIncidentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // Hace 2 días

  const baseActivePolicy: PolicyEntity = {
    id: 'pol-active-001',
    policyNumber: 'MTO-PET-2026-ACTIVE1',
    quoteId: 'quote-001',
    quoteNumber: 'Q-001',
    status: 'ACTIVE',
    customer: { fullName: 'Santiago Ramirez', email: 'santiago@example.com' },
    petData: {
      name: 'Max',
      species: 'CANINE',
      breedCode: 'GOLDEN_RETRIEVER',
      gender: 'MALE',
      sizeCategory: 'LARGE',
      ageInMonths: 24,
      isSterilized: true,
      city: 'MEDELLIN',
    },
    coverages: [
      {
        code: 'ACCIDENT_EMERGENCY',
        name: 'Urgencias por Accidente',
        description: 'Traumatismos',
        annualLimitCop: toCop(3500000),
        waitingPeriodDays: 0,
        deductiblePercentage: 0.15,
      },
      {
        code: 'COMMON_ILLNESSES',
        name: 'Enfermedades Comunes',
        description: 'Patologías médicas',
        annualLimitCop: toCop(5000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.15,
      },
    ],
    monthlyPremiumCop: toCop(45000),
    annualPremiumCop: toCop(540000),
    billingFrequency: 'MONTHLY',
    effectiveDate,
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    createdAt: effectiveDate,
    updatedAt: effectiveDate,
  };

  const sampleClinicalRecord: ClinicalRecordDto = {
    symptomsOnsetDate: recentIncidentDate,
    presumptiveDiagnosis: 'Atención de urgencia por caída jugando en el parque',
    veterinarianName: 'Dr. Alejandro Restrepo',
    hasPreExistingSigns: false,
    ocrConfidence: 0.96,
  };

  const sampleSubmitDto: SubmitClaimDto = {
    policyId: 'pol-active-001',
    incidentType: 'ACCIDENT',
    incidentDate: recentIncidentDate,
    description: 'Atención de urgencia por caída jugando en el parque.',
    eligibleExpensesCop: 200000,
    dianInvoice: {
      invoiceNumber: 'FE-VET-1002',
      providerNit: '901234567-8',
      providerName: 'Hospital Veterinario de Antioquia',
      dianCufe: 'cufe_hash_abc1234567890def',
      issueDate: recentIncidentDate,
      items: [
        {
          description: 'Radiografía y curación de herida',
          amountCop: 200000,
          isCovered: true,
          category: 'TRAUMA',
        },
      ],
      totalInvoiceCop: 200000,
      ocrConfidence: 0.95,
    },
    clinicalRecord: sampleClinicalRecord,
    breBKey: {
      type: 'PHONE_NUMBER',
      value: '3001234567',
    },
  };

  beforeEach(async () => {
    claimsRepository = new InMemoryClaimsRepository();
    const brebAdapter = new MockBreBAdapter();
    const reimbursementsRepo = new InMemoryReimbursementsRepository();
    reimbursementsService = new ReimbursementsService(brebAdapter, reimbursementsRepo);

    policiesServiceMock = {
      getPolicyById: jest.fn().mockResolvedValue(baseActivePolicy),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        StpEngineService,
        {
          provide: CLAIMS_REPOSITORY,
          useValue: claimsRepository,
        },
        {
          provide: PoliciesService,
          useValue: policiesServiceMock,
        },
        {
          provide: ReimbursementsService,
          useValue: reimbursementsService,
        },
      ],
    }).compile();

    claimsService = module.get<ClaimsService>(ClaimsService);
  });

  afterEach(() => {
    claimsRepository.clear();
  });

  describe('submitClaim - Validación de Póliza y Períodos de Carencia', () => {
    it('debe arrojar NotFoundException si la póliza no existe', async () => {
      policiesServiceMock.getPolicyById.mockResolvedValueOnce(null);

      await expect(
        claimsService.submitClaim({ ...sampleSubmitDto, policyId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe arrojar BadRequestException si la póliza no está en estado ACTIVE', async () => {
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...baseActivePolicy,
        status: 'PENDING_PAYMENT',
      });

      await expect(claimsService.submitClaim(sampleSubmitDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe arrojar BadRequestException si la póliza no cuenta con la cobertura solicitada', async () => {
      await expect(
        claimsService.submitClaim({
          ...sampleSubmitDto,
          incidentType: 'CIVIL_LIABILITY', // Póliza baseActivePolicy no tiene RCE
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe arrojar BadRequestException si el incidente es anterior a la vigencia de la póliza', async () => {
      const priorDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // Hace 90 días (vigencia empezó hace 60)

      await expect(
        claimsService.submitClaim({
          ...sampleSubmitDto,
          incidentDate: priorDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe arrojar BadRequestException si el incidente está en período de carencia', async () => {
      // Póliza contratada hace solo 10 días, cobertura COMMON_ILLNESS requiere 30 días de carencia
      const veryRecentEffective = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...baseActivePolicy,
        effectiveDate: veryRecentEffective,
        createdAt: veryRecentEffective,
      });

      await expect(
        claimsService.submitClaim({
          ...sampleSubmitDto,
          incidentType: 'COMMON_ILLNESS',
          incidentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ).rejects.toThrow(/período de carencia/i);
    });
  });

  describe('submitClaim - STP Automatizado y Dispersión Bre-B', () => {
    it('debe liquidar en STP_APPROVED y transicionar a PAID con dispersión Bre-B inmediata', async () => {
      const claim = await claimsService.submitClaim(sampleSubmitDto);

      expect(claim).toBeDefined();
      expect(claim.claimNumber).toMatch(/^CLM-2026-[A-F0-9]{6}$/);
      expect(claim.status).toBe('PAID');
      expect(claim.stpEvaluation.eligibleForStp).toBe(true);

      // Deducción: $200.000 - 15% ($30.000) = $170.000 COP
      expect(claim.netReimbursementCop).toBe(toCop(170000));
      expect(claim.deductibleCop).toBe(toCop(30000));

      // Dispersión Bre-B
      expect(claim.disbursementId).toBeDefined();
      expect(claim.disbursementTrackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
      expect(claim.financialInstitution).toBe('Bancolombia');
      expect(claim.adjudicatedBy).toBe('STP_ENGINE_AUTOMATED');

      // Persistencia
      const savedInRepo = await claimsRepository.findById(claim.id);
      expect(savedInRepo?.status).toBe('PAID');
      expect(savedInRepo?.disbursementTrackingCode).toBe(claim.disbursementTrackingCode);
    });

    it('debe enrutar a HUMAN_REVIEW cuando el monto supera el límite STP', async () => {
      // Para MEDIUM_ILLNESS el límite es $600.000 COP
      // Gastos $800.000 -> Reembolso $680.000 COP (> 600.000)
      const highAmountDto: SubmitClaimDto = {
        ...sampleSubmitDto,
        incidentType: 'COMMON_ILLNESS',
        eligibleExpensesCop: 800000,
        dianInvoice: {
          ...sampleSubmitDto.dianInvoice,
          dianCufe: 'unique_cufe_high_amount_01',
          items: [{ description: 'Tratamiento', amountCop: 800000, isCovered: true, category: 'CLINIC' }],
          totalInvoiceCop: 800000,
        },
      };

      const claim = await claimsService.submitClaim(highAmountDto);

      expect(claim.status).toBe('HUMAN_REVIEW');
      expect(claim.stpEvaluation.eligibleForStp).toBe(false);
      expect(claim.rejectionReason).toMatch(/excede el umbral Fast-Track de bajo riesgo|excede el límite de aprobación STP/i);
      expect(claim.disbursementId).toBeUndefined();
    });

    it('debe enrutar a HUMAN_REVIEW con alerta de fraude si el CUFE ya fue utilizado previamente', async () => {
      // 1. Radicar primer siniestro con el CUFE
      await claimsService.submitClaim(sampleSubmitDto);

      // 2. Radicar segundo siniestro con el mismo CUFE
      const duplicateDto: SubmitClaimDto = {
        ...sampleSubmitDto,
        description: 'Segundo reclamo con la misma factura.',
      };

      const claim2 = await claimsService.submitClaim(duplicateDto);

      expect(claim2.status).toBe('HUMAN_REVIEW');
      expect(claim2.stpEvaluation.eligibleForStp).toBe(false);
      expect(claim2.rejectionReason).toMatch(/código CUFE.*siniestro anterior/i);
      expect(claim2.stpEvaluation.fraudRiskScore).toBeGreaterThanOrEqual(0.85);
    });

    it('debe rechazar con BadRequestException si no se adjunta la Historia Clínica obligatoria', async () => {
      const dtoWithoutClinical: any = {
        ...sampleSubmitDto,
      };
      delete dtoWithoutClinical.clinicalRecord;

      await expect(claimsService.submitClaim(dtoWithoutClinical)).rejects.toThrow(BadRequestException);
      await expect(claimsService.submitClaim(dtoWithoutClinical)).rejects.toThrow(
        /La Historia Clínica o Epicrisis es obligatoria/i,
      );
    });

    it('debe limpiar automáticamente el borrador si ClaimsDraftService está disponible', async () => {
      const deleteDraftMock = jest.fn().mockResolvedValue({ success: true, message: 'OK' });
      const customClaimsService = new ClaimsService(
        claimsRepository,
        policiesServiceMock as any,
        reimbursementsService,
        new StpEngineService(),
        undefined,
        undefined,
        { deleteDraft: deleteDraftMock } as any,
      );

      const claim = await customClaimsService.submitClaim(sampleSubmitDto);
      expect(claim.status).toBe('PAID');
      expect(deleteDraftMock).toHaveBeenCalledWith('pol-active-001');
    });
  });

  describe('adjudicateClaimByHuman - Mesa Médica y Dispersión Posterior', () => {
    it('debe permitir aprobar un siniestro en HUMAN_REVIEW y disparar el pago Bre-B', async () => {
      // Crear siniestro en HUMAN_REVIEW (monto alto)
      const claimInReview = await claimsService.submitClaim({
        ...sampleSubmitDto,
        incidentType: 'COMMON_ILLNESS',
        eligibleExpensesCop: 900000,
        dianInvoice: {
          ...sampleSubmitDto.dianInvoice,
          dianCufe: 'cufe_human_review_001',
          items: [{ description: 'Hospitalización prolongada', amountCop: 900000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 900000,
        },
      });

      expect(claimInReview.status).toBe('HUMAN_REVIEW');

      // Adjudicar manualmente
      const adjudicated = await claimsService.adjudicateClaimByHuman(claimInReview.id, {
        decision: 'APPROVED',
        adjusterId: 'ADJ-DR-MENDOZA',
        adjusterNotes: 'Facturas auditadas médicamente y autorizadas con éxito.',
      });

      expect(adjudicated.status).toBe('PAID');
      expect(adjudicated.adjudicatedBy).toBe('ADJ-DR-MENDOZA');
      expect(adjudicated.disbursementId).toBeDefined();
      expect(adjudicated.disbursementTrackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
    });

    it('debe permitir ajustar el monto aprobado y dispersar el nuevo monto', async () => {
      const claimInReview = await claimsService.submitClaim({
        ...sampleSubmitDto,
        eligibleExpensesCop: 800000,
        dianInvoice: {
          ...sampleSubmitDto.dianInvoice,
          dianCufe: 'cufe_adjust_amount_002',
          items: [{ description: 'Cirugía compleja', amountCop: 800000, isCovered: true, category: 'SURG' }],
          totalInvoiceCop: 800000,
        },
      });

      const adjudicated = await claimsService.adjudicateClaimByHuman(claimInReview.id, {
        decision: 'APPROVED',
        approvedAmountCop: 500000, // Ajuste manual del ajustador
        adjusterId: 'ADJ-AUDIT-02',
        adjusterNotes: 'Se descuentan insumos no cubiertos según condicionado.',
      });

      expect(adjudicated.status).toBe('PAID');
      expect(adjudicated.netReimbursementCop).toBe(toCop(500000));
    });

    it('debe permitir rechazar justificadamente un siniestro en HUMAN_REVIEW sin dispersar fondos', async () => {
      const claimInReview = await claimsService.submitClaim({
        ...sampleSubmitDto,
        eligibleExpensesCop: 800000,
        dianInvoice: {
          ...sampleSubmitDto.dianInvoice,
          dianCufe: 'cufe_reject_003',
          items: [{ description: 'Consulta no justificada', amountCop: 800000, isCovered: true, category: 'CLINIC' }],
          totalInvoiceCop: 800000,
        },
      });

      const rejected = await claimsService.adjudicateClaimByHuman(claimInReview.id, {
        decision: 'REJECTED',
        rejectionReason: 'Tratamiento estético no cubierto por la póliza.',
        adjusterId: 'ADJ-DR-MENDOZA',
      });

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Tratamiento estético no cubierto por la póliza.');
      expect(rejected.disbursementId).toBeUndefined();
    });

    it('debe arrojar BadRequestException si se intenta adjudicar un siniestro que ya está PAID', async () => {
      const paidClaim = await claimsService.submitClaim(sampleSubmitDto);
      expect(paidClaim.status).toBe('PAID');

      await expect(
        claimsService.adjudicateClaimByHuman(paidClaim.id, {
          decision: 'APPROVED',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getClaimById', () => {
    it('debe recuperar un siniestro existente', async () => {
      const created = await claimsService.submitClaim(sampleSubmitDto);
      const retrieved = await claimsService.getClaimById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.claimNumber).toBe(created.claimNumber);
    });

    it('debe arrojar NotFoundException cuando el id no existe', async () => {
      await expect(claimsService.getClaimById('unknown-claim-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
