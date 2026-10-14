import { Test, TestingModule } from '@nestjs/testing';
import { toCop } from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import { PolicyEntity } from '../policies/policies.types';
import { MockBreBAdapter } from '../reimbursements/bre-b.adapter';
import { InMemoryReimbursementsRepository } from '../reimbursements/reimbursements.repository';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import { ClaimsTriageWorker } from './claims-triage.worker';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimEntity, CLAIMS_REPOSITORY } from './claims.types';
import { InvoiceOcrService } from './invoice-ocr.service';
import { StpEngineService } from './stp-engine.service';

describe('ClaimsTriageWorker (Pipeline Asíncrono de Triage y Reglas Booleanas)', () => {
  let worker: ClaimsTriageWorker;
  let claimsRepository: InMemoryClaimsRepository;
  let reimbursementsService: ReimbursementsService;
  let policiesServiceMock: { getPolicyById: jest.Mock };
  let invoiceOcrServiceMock: { processInvoiceDocument: jest.Mock };

  const effectiveDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const recentIncidentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const baseActivePolicy: PolicyEntity = {
    id: 'pol-worker-001',
    policyNumber: 'MTO-PET-2026-WORKER1',
    quoteId: 'quote-001',
    quoteNumber: 'Q-001',
    status: 'ACTIVE',
    customer: { fullName: 'Valeria Restrepo', email: 'valeria@example.com' },
    petData: {
      name: 'Luna',
      species: 'FELINE',
      breedCode: 'DOMESTIC_SHORTHAIR',
      gender: 'FEMALE',
      sizeCategory: 'SMALL',
      ageInMonths: 18,
      isSterilized: true,
      city: 'BOGOTA',
    },
    coverages: [
      {
        code: 'ACCIDENT_EMERGENCY',
        name: 'Urgencias por Accidente',
        description: 'Accidentes',
        annualLimitCop: toCop(3500000),
        waitingPeriodDays: 0,
        deductiblePercentage: 0.15,
      },
      {
        code: 'COMMON_ILLNESSES',
        name: 'Enfermedades Comunes',
        description: 'Enfermedades',
        annualLimitCop: toCop(5000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.15,
      },
    ],
    monthlyPremiumCop: toCop(38000),
    annualPremiumCop: toCop(456000),
    billingFrequency: 'MONTHLY',
    effectiveDate,
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    createdAt: effectiveDate,
    updatedAt: effectiveDate,
  };

  const sampleClaim: ClaimEntity = {
    id: 'clm-worker-001',
    claimNumber: 'CLM-2026-WRK001',
    policyId: 'pol-worker-001',
    policyNumber: 'MTO-PET-2026-WORKER1',
    incidentType: 'ACCIDENT',
    incidentDate: recentIncidentDate,
    description: 'Atención médica por traumatismo leve.',
    dianInvoice: {
      invoiceNumber: 'FE-9901',
      providerNit: '900123456-7',
      providerName: 'Clínica Veterinaria Manto Red',
      dianCufe: 'cufe_worker_unique_hash_9901',
      issueDate: recentIncidentDate,
      items: [
        {
          description: 'Consulta de urgencia y curación',
          amountCop: toCop(180000),
          isCovered: true,
          category: 'URGENCY',
        },
      ],
      totalInvoiceCop: toCop(180000),
      ocrConfidence: 0.96,
    },
    clinicalRecord: {
      symptomsOnsetDate: recentIncidentDate,
      presumptiveDiagnosis: 'Traumatismo leve en miembro posterior',
      veterinarianName: 'Dra. Carolina Rios',
      hasPreExistingSigns: false,
      ocrConfidence: 0.97,
    },
    breBKey: {
      type: 'PHONE_NUMBER',
      value: '3109876543',
    },
    eligibleExpensesCop: toCop(180000),
    claimedAmountCop: toCop(180000),
    deductibleCop: toCop(27000),
    netReimbursementCop: toCop(153000),
    status: 'SUBMITTED',
    stpEvaluation: {
      eligibleForStp: true,
      tierLimitCop: toCop(300000),
      rejectionReasons: [],
      fraudRiskScore: 0,
    },
    submittedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    claimsRepository = new InMemoryClaimsRepository();
    const brebAdapter = new MockBreBAdapter();
    const reimbursementsRepo = new InMemoryReimbursementsRepository();
    reimbursementsService = new ReimbursementsService(brebAdapter, reimbursementsRepo);

    policiesServiceMock = {
      getPolicyById: jest.fn().mockResolvedValue(baseActivePolicy),
    };

    invoiceOcrServiceMock = {
      processInvoiceDocument: jest.fn().mockResolvedValue({
        invoiceData: sampleClaim.dianInvoice,
        fileSha256: 'sha256_mock_computed_digest_001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsTriageWorker,
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
          provide: InvoiceOcrService,
          useValue: invoiceOcrServiceMock,
        },
        {
          provide: ReimbursementsService,
          useValue: reimbursementsService,
        },
      ],
    }).compile();

    worker = module.get<ClaimsTriageWorker>(ClaimsTriageWorker);
    await claimsRepository.save(sampleClaim);
  });

  it('debe aprobar vía Fast-Track y dispersar por Bre-B cuando monto <= 200.000 COP sin alertas', async () => {
    const result = await worker.processJob({
      claimId: sampleClaim.id,
      policyId: sampleClaim.policyId,
    });

    expect(result.triageRoute).toBe('FAST_TRACK');
    expect(result.status).toBe('PAID');

    const updatedClaim = await claimsRepository.findById(sampleClaim.id);
    expect(updatedClaim?.status).toBe('PAID');
    expect(updatedClaim?.adjudicatedBy).toBe('STP_ENGINE_AUTOMATED');
    expect(updatedClaim?.disbursementId).toBeDefined();
    expect(updatedClaim?.disbursementTrackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
    expect(updatedClaim?.netReimbursementCop).toBe(toCop(153000));
  });

  it('debe enrutar a MANUAL_AUDIT_REQUIRED cuando el monto reclamado excede $200.000 COP', async () => {
    const highClaim: ClaimEntity = {
      ...sampleClaim,
      id: 'clm-worker-high',
      claimedAmountCop: toCop(450000),
      eligibleExpensesCop: toCop(450000),
      dianInvoice: {
        ...sampleClaim.dianInvoice,
        totalInvoiceCop: toCop(450000),
        dianCufe: 'cufe_high_unique_002',
        items: [{ description: 'Procedimiento mayor', amountCop: toCop(450000), isCovered: true, category: 'SURG' }],
      },
    };
    await claimsRepository.save(highClaim);

    const result = await worker.processJob({
      claimId: highClaim.id,
      policyId: highClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');

    const updatedClaim = await claimsRepository.findById(highClaim.id);
    expect(updatedClaim?.status).toBe('MANUAL_AUDIT_REQUIRED');
    expect(updatedClaim?.disbursementId).toBeUndefined();
    expect(updatedClaim?.triageReasons?.some((r) => r.includes('200.000 COP'))).toBe(true);
  });

  it('debe enrutar a MANUAL_AUDIT_REQUIRED si se detectan signos de preexistencia en la Historia Clínica', async () => {
    const preExistingClaim: ClaimEntity = {
      ...sampleClaim,
      id: 'clm-worker-pre-existing',
      clinicalRecord: {
        ...sampleClaim.clinicalRecord!,
        hasPreExistingSigns: true,
        preExistingNotes: 'Cuadro crónico iniciado antes de contratación',
      },
    };
    await claimsRepository.save(preExistingClaim);

    const result = await worker.processJob({
      claimId: preExistingClaim.id,
      policyId: preExistingClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');

    const updatedClaim = await claimsRepository.findById(preExistingClaim.id);
    expect(updatedClaim?.triageReasons?.some((r) => r.includes('previos a la vigencia'))).toBe(true);
    expect(result.fraudRiskScore).toBeGreaterThanOrEqual(40.0);
  });

  it('debe objetar si la fecha del incidente está dentro del período de carencia contractual', async () => {
    // Siniestro de enfermedad común ocurrido hace 5 días en póliza contratada hace solo 10 días (requiere 30 días)
    const recentPolicyEffective = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    policiesServiceMock.getPolicyById.mockResolvedValueOnce({
      ...baseActivePolicy,
      effectiveDate: recentPolicyEffective,
      createdAt: recentPolicyEffective,
    });

    const waitingClaim: ClaimEntity = {
      ...sampleClaim,
      id: 'clm-worker-waiting',
      incidentType: 'COMMON_ILLNESS',
      incidentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await claimsRepository.save(waitingClaim);

    const result = await worker.processJob({
      claimId: waitingClaim.id,
      policyId: waitingClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');
    expect(result.reasons.some((r) => r.toLowerCase().includes('carencia'))).toBe(true);
  });
});
