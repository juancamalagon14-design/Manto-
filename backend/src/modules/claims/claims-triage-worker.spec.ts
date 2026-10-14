import { Test, TestingModule } from '@nestjs/testing';
import { copToNumber, toCop } from '../../common/types/money';
import { GeminiProvider, MockGeminiProvider } from '../ai/gemini.provider';
import { PoliciesService } from '../policies/policies.service';
import { PolicyEntity } from '../policies/policies.types';
import { MockBreBAdapter } from '../reimbursements/bre-b.adapter';
import { InMemoryReimbursementsRepository } from '../reimbursements/reimbursements.repository';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import { BRE_B_ADAPTER, REIMBURSEMENTS_REPOSITORY } from '../reimbursements/reimbursements.types';
import { AuditLogService } from './audit-log.service';
import { ClaimsStorageService } from './claims-storage.service';
import { ClaimsTriageWorker } from './claims-triage.worker';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimEntity, CLAIMS_REPOSITORY } from './claims.types';
import { InvoiceOcrService } from './invoice-ocr.service';
import { StpEngineService } from './stp-engine.service';

describe('ClaimsTriageWorker (Pipeline Asíncrono BullMQ & 10 Reglas de Triage)', () => {
  let worker: ClaimsTriageWorker;
  let claimsRepo: InMemoryClaimsRepository;
  let policiesMock: { getPolicyById: jest.Mock };
  let auditLogService: AuditLogService;

  const validEffectiveDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const validIncidentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const mockPolicy: PolicyEntity = {
    id: 'pol-worker-001',
    policyNumber: 'MTO-PET-2026-WORKER1',
    quoteId: 'quote-001',
    quoteNumber: 'Q-001',
    status: 'ACTIVE',
    customer: { fullName: 'Felipe Jaramillo', email: 'felipe@example.com' },
    petData: {
      name: 'Simba',
      species: 'CANINE',
      breedCode: 'BEAGLE',
      gender: 'MALE',
      sizeCategory: 'MEDIUM',
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
        description: 'Patologías',
        annualLimitCop: toCop(5000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.15,
      },
    ],
    monthlyPremiumCop: toCop(39900),
    annualPremiumCop: toCop(478800),
    billingFrequency: 'MONTHLY',
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    effectiveDate: validEffectiveDate,
    createdAt: validEffectiveDate,
    updatedAt: validEffectiveDate,
  };

  const createBaseClaim = (id: string, overrides: Partial<ClaimEntity> = {}): ClaimEntity => ({
    id,
    claimNumber: `CLM-2026-${id.slice(0, 6)}`,
    policyId: mockPolicy.id,
    policyNumber: mockPolicy.policyNumber || 'MTO-PET-2026-WORKER1',
    incidentType: 'ACCIDENT',
    incidentDate: validIncidentDate,
    description: 'Atención de urgencia veterinaria por herida.',
    dianInvoice: {
      invoiceNumber: 'FE-1042',
      providerNit: '901234567-8',
      providerName: 'Hospital Veterinario de Antioquia S.A.S.',
      dianCufe: `cufe_unique_${id}`,
      issueDate: validIncidentDate,
      items: [{ description: 'Sutura', amountCop: toCop(150000), isCovered: true, category: 'TRAUMA' }],
      totalInvoiceCop: toCop(150000),
      ocrConfidence: 0.95,
    },
    breBKey: { type: 'PHONE_NUMBER', value: '3009876543' },
    eligibleExpensesCop: toCop(150000),
    deductibleCop: toCop(22500),
    netReimbursementCop: toCop(127500),
    clinicalRecord: {
      symptomsOnsetDate: validIncidentDate,
      presumptiveDiagnosis: 'Atención de urgencia por trauma',
      hasPreExistingSigns: false,
      ocrConfidence: 0.95,
    },
    status: 'SUBMITTED',
    stpEvaluation: {
      eligibleForStp: true,
      tierLimitCop: toCop(300000),
      rejectionReasons: [],
      fraudRiskScore: 0.0,
    },
    submittedAt: validIncidentDate,
    ...overrides,
  });

  beforeEach(async () => {
    claimsRepo = new InMemoryClaimsRepository();
    policiesMock = {
      getPolicyById: jest.fn().mockResolvedValue(mockPolicy),
    };
    const brebAdapter = new MockBreBAdapter();
    const reimbursementsRepo = new InMemoryReimbursementsRepository();
    const reimbursementsService = new ReimbursementsService(brebAdapter, reimbursementsRepo);
    auditLogService = new AuditLogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsTriageWorker,
        InvoiceOcrService,
        StpEngineService,
        ClaimsStorageService,
        {
          provide: CLAIMS_REPOSITORY,
          useValue: claimsRepo,
        },
        {
          provide: PoliciesService,
          useValue: policiesMock,
        },
        {
          provide: ReimbursementsService,
          useValue: reimbursementsService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
        {
          provide: GeminiProvider,
          useClass: MockGeminiProvider,
        },
      ],
    }).compile();

    worker = module.get<ClaimsTriageWorker>(ClaimsTriageWorker);
  });

  it('1. Fast-Track Exitoso: Satisface 100% de reglas (<$200k COP sin alertas) -> FAST_TRACK_APPROVED y pago PAID', async () => {
    const claim = createBaseClaim('claim-ft-001', { eligibleExpensesCop: toCop(150000) });
    await claimsRepo.save(claim);

    const result = await worker.processJob({
      claimId: claim.id,
      policyId: claim.policyId,
    });

    expect(result.triageRoute).toBe('FAST_TRACK');
    expect(result.status).toBe('PAID');
    expect(result.reasons).toHaveLength(0);

    const updated = await claimsRepo.findById(claim.id);
    expect(updated?.status).toBe('PAID');
    expect(updated?.disbursementTrackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
    expect(copToNumber(updated!.netReimbursementCop)).toBe(127500); // 150k - 15% ($22.500)
    expect(copToNumber(updated!.deductibleCop)).toBe(22500);

    // Auditoría
    const logs = await auditLogService.getLogsByClaimId(claim.id);
    expect(logs.some((l) => l.action === 'TRIAGE_EVALUATED')).toBe(true);
  });

  it('2. Violación Regla 1: Monto >= $200.000 COP -> Rutea obligatoriamente a MANUAL_AUDIT_REQUIRED', async () => {
    const highClaim = createBaseClaim('claim-high-002', {
      eligibleExpensesCop: toCop(250000),
      dianInvoice: {
        ...createBaseClaim('claim-high-002').dianInvoice,
        totalInvoiceCop: toCop(250000),
        items: [{ description: 'Exámenes', amountCop: toCop(250000), isCovered: true, category: 'TRAUMA' }],
      },
    });
    await claimsRepo.save(highClaim);

    const result = await worker.processJob({
      claimId: highClaim.id,
      policyId: highClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');
    expect(result.reasons[0]).toContain('excede el umbral de Fast-Track ($200.000 COP)');

    const updated = await claimsRepo.findById(highClaim.id);
    expect(updated?.status).toBe('MANUAL_AUDIT_REQUIRED');
    expect(updated?.disbursementId).toBeUndefined();
  });

  it('3. Violación Regla 3: Incidente dentro de período de carencia -> Rutea a MANUAL_AUDIT_REQUIRED', async () => {
    // COMMON_ILLNESS exige 30 días de carencia. Póliza empezó hace solo 10 días.
    const recentEffective = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    policiesMock.getPolicyById.mockResolvedValueOnce({
      ...mockPolicy,
      effectiveDate: recentEffective,
      createdAt: recentEffective,
    });

    const carenciaClaim = createBaseClaim('claim-carencia-003', {
      incidentType: 'COMMON_ILLNESS',
      incidentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      eligibleExpensesCop: toCop(80000),
      dianInvoice: {
        ...createBaseClaim('claim-carencia-003').dianInvoice,
        totalInvoiceCop: toCop(80000),
      },
    });
    await claimsRepo.save(carenciaClaim);

    const result = await worker.processJob({
      claimId: carenciaClaim.id,
      policyId: carenciaClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.reasons[0]).toContain('período de carencia');
  });

  it('4. Violación Regla 5: Replay Attack de CUFE DIAN -> Rutea a MANUAL_AUDIT_REQUIRED con alerta de fraude', async () => {
    // 1. Radicar y pagar primer siniestro con CUFE 'cufe_reused_dian_test'
    const claim1 = createBaseClaim('claim-orig-004', {
      dianInvoice: {
        ...createBaseClaim('claim-orig-004').dianInvoice,
        dianCufe: 'cufe_reused_dian_test',
      },
    });
    await claimsRepo.save(claim1);
    await worker.processJob({ claimId: claim1.id, policyId: claim1.policyId });

    // 2. Intentar radicar segundo siniestro con el mismo CUFE
    const duplicateClaim = createBaseClaim('claim-dup-004', {
      dianInvoice: {
        ...createBaseClaim('claim-dup-004').dianInvoice,
        dianCufe: 'cufe_reused_dian_test',
      },
    });
    await claimsRepo.save(duplicateClaim);

    const result = await worker.processJob({
      claimId: duplicateClaim.id,
      policyId: duplicateClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.reasons.some((r) => r.includes('CUFE'))).toBe(true);
    expect(result.fraudRiskScore).toBeGreaterThanOrEqual(10.0);
  });

  it('5. Violación Regla 6: Confianza OCR baja (< 0.85) -> Rutea a MANUAL_AUDIT_REQUIRED', async () => {
    const lowConfClaim = createBaseClaim('claim-lowconf-005', {
      dianInvoice: {
        ...createBaseClaim('claim-lowconf-005').dianInvoice,
        ocrConfidence: 0.65,
      },
    });
    await claimsRepo.save(lowConfClaim);

    const result = await worker.processJob({
      claimId: lowConfClaim.id,
      policyId: lowConfClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.reasons.some((r) => r.includes('Confianza OCR insuficiente'))).toBe(true);
  });

  it('6. Violación Regla 8: Clínica veterinaria en lista negra -> Rutea a MANUAL_AUDIT_REQUIRED con score de fraude', async () => {
    const blacklistedClaim = createBaseClaim('claim-blacklisted-006', {
      dianInvoice: {
        ...createBaseClaim('claim-blacklisted-006').dianInvoice,
        providerNit: '900999999-9', // NIT en lista negra
      },
    });
    await claimsRepo.save(blacklistedClaim);

    const result = await worker.processJob({
      claimId: blacklistedClaim.id,
      policyId: blacklistedClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.reasons.some((r) => r.includes('lista negra'))).toBe(true);
    expect(result.fraudRiskScore).toBeGreaterThanOrEqual(50.0);
  });

  it('7. Violación Regla 9: Discrepancia / Inflación de factura (claimed > ocr_extracted_total) -> MANUAL_AUDIT', async () => {
    const inflatedClaim = createBaseClaim('claim-inflated-007', {
      eligibleExpensesCop: toCop(190000), // Usuario reclama 190k
      claimedAmountCop: toCop(190000),
      dianInvoice: {
        ...createBaseClaim('claim-inflated-007').dianInvoice,
        totalInvoiceCop: toCop(50000), // Pero la factura OCR solo es de 50k
      },
    });
    await claimsRepo.save(inflatedClaim);

    const result = await worker.processJob({
      claimId: inflatedClaim.id,
      policyId: inflatedClaim.policyId,
    });

    expect(result.triageRoute).toBe('MANUAL_AUDIT');
    expect(result.reasons.some((r) => r.includes('Discrepancia financiera'))).toBe(true);
  });

  it('8. Supresión de desembolso $0 COP: Gasto cubierto inferior al deducible -> FAST_TRACK_APPROVED sin pago en Bre-B', async () => {
    // Si el gasto elegible es menor al deducible aplicable, neto es $0
    const zeroPayoutClaim = createBaseClaim('claim-zero-008', {
      eligibleExpensesCop: toCop(10000), // Deducible 15% de 10k o deducible mínimo
      dianInvoice: {
        ...createBaseClaim('claim-zero-008').dianInvoice,
        totalInvoiceCop: toCop(10000),
        items: [{ description: 'Curación mínima', amountCop: toCop(10000), isCovered: true, category: 'TRAUMA' }],
      },
    });
    // Forzamos deductiblePercentage = 1.0 para que el neto sea 0
    policiesMock.getPolicyById.mockResolvedValueOnce({
      ...mockPolicy,
      coverages: [
        {
          ...mockPolicy.coverages[0],
          deductiblePercentage: 1.0, // 100% deducible
        },
      ],
    });
    await claimsRepo.save(zeroPayoutClaim);

    const result = await worker.processJob({
      claimId: zeroPayoutClaim.id,
      policyId: zeroPayoutClaim.policyId,
    });

    expect(result.triageRoute).toBe('FAST_TRACK');
    expect(result.status).toBe('FAST_TRACK_APPROVED');

    const updated = await claimsRepo.findById(zeroPayoutClaim.id);
    expect(updated?.status).toBe('FAST_TRACK_APPROVED');
    expect(copToNumber(updated!.netReimbursementCop)).toBe(0);
    expect(updated?.disbursementId).toBeUndefined(); // Sin dispersión bancaria
  });
});
