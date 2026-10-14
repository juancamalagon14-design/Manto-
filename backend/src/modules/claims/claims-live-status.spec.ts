import { Test, TestingModule } from '@nestjs/testing';
import { toCop } from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import { PolicyEntity } from '../policies/policies.types';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { ClaimEntity, CLAIMS_REPOSITORY } from './claims.types';
import { StpEngineService } from './stp-engine.service';

describe('ClaimsService - Live Claim Status & Timeline (LiveClaimTracker)', () => {
  let claimsService: ClaimsService;
  let claimsRepository: InMemoryClaimsRepository;
  let policiesServiceMock: { getPolicyById: jest.Mock };

  const mockPolicy: PolicyEntity = {
    id: 'pol-live-001',
    policyNumber: 'MTO-PET-2026-LIVE01',
    quoteId: 'quote-001',
    quoteNumber: 'Q-001',
    status: 'ACTIVE',
    customer: { fullName: 'Valentina Restrepo', email: 'valentina@example.com' },
    petData: {
      name: 'Kira',
      species: 'CANINE',
      breedCode: 'SIBERIAN_HUSKY',
      gender: 'FEMALE',
      sizeCategory: 'LARGE',
      ageInMonths: 18,
      isSterilized: true,
      city: 'MEDELLIN',
    },
    coverages: [],
    monthlyPremiumCop: toCop(39900),
    annualPremiumCop: toCop(478800),
    billingFrequency: 'MONTHLY',
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseClaim: ClaimEntity = {
    id: 'claim-live-100',
    claimNumber: 'CLM-2026-LIVE99',
    policyId: 'pol-live-001',
    policyNumber: 'MTO-PET-2026-LIVE01',
    incidentType: 'ACCIDENT',
    incidentDate: new Date().toISOString(),
    description: 'Atención médica veterinaria por laceración.',
    dianInvoice: {
      invoiceNumber: 'FE-9901',
      providerNit: '900123456-1',
      providerName: 'Clínica Veterinaria Medellín',
      dianCufe: 'cufe-live-test-12345678',
      issueDate: new Date().toISOString(),
      items: [{ description: 'Sutura', amountCop: toCop(180000), isCovered: true, category: 'SURGERY' }],
      totalInvoiceCop: toCop(180000),
      ocrConfidence: 0.98,
    },
    breBKey: { type: 'PHONE_NUMBER', value: '3129876543' },
    eligibleExpensesCop: toCop(180000),
    deductibleCop: toCop(27000),
    netReimbursementCop: toCop(153000),
    status: 'PAID',
    stpEvaluation: {
      eligibleForStp: true,
      tierLimitCop: toCop(300000),
      rejectionReasons: [],
      fraudRiskScore: 0.0,
    },
    disbursementId: 'disb-live-001',
    disbursementTrackingCode: 'BREB-2026-LIVETRACK1',
    financialInstitution: 'Bancolombia',
    submittedAt: new Date().toISOString(),
    adjudicatedAt: new Date().toISOString(),
    adjudicatedBy: 'STP_ENGINE_AUTOMATED',
  };

  beforeEach(async () => {
    claimsRepository = new InMemoryClaimsRepository();
    policiesServiceMock = {
      getPolicyById: jest.fn().mockResolvedValue(mockPolicy),
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
          useValue: { disburseClaimViaBreB: jest.fn() },
        },
      ],
    }).compile();

    claimsService = module.get<ClaimsService>(ClaimsService);
  });

  it('debe generar el estatus en vivo con los 4 hitos completos para un siniestro pagado vía STP', async () => {
    await claimsRepository.save(baseClaim);

    const statusDto = await claimsService.getClaimLiveStatus(baseClaim.id);

    expect(statusDto).toBeDefined();
    expect(statusDto.claimNumber).toBe('CLM-2026-LIVE99');
    expect(statusDto.petName).toBe('Kira');
    expect(statusDto.status).toBe('PAID');
    expect(statusDto.claimedAmountCop).toBe(180000);
    expect(statusDto.deductibleCop).toBe(27000);
    expect(statusDto.netPayableAmountCop).toBe(153000);

    // Timeline
    expect(statusDto.timeline).toHaveLength(4);
    expect(statusDto.timeline[0].stepKey).toBe('SUBMITTED');
    expect(statusDto.timeline[0].status).toBe('COMPLETED');
    expect(statusDto.timeline[1].stepKey).toBe('ANALYSIS');
    expect(statusDto.timeline[1].status).toBe('COMPLETED');
    expect(statusDto.timeline[2].stepKey).toBe('DECISION');
    expect(statusDto.timeline[2].status).toBe('COMPLETED');
    expect(statusDto.timeline[3].stepKey).toBe('PAYMENT');
    expect(statusDto.timeline[3].status).toBe('COMPLETED');

    // Payout
    expect(statusDto.payout).toBeDefined();
    expect(statusDto.payout?.status).toBe('SETTLED');
    expect(statusDto.payout?.trackingCode).toBe('BREB-2026-LIVETRACK1');
    expect(statusDto.payout?.accountMasked).toBe('****6543');
    expect(statusDto.requiresActionFromUser).toBe(false);
  });

  it('debe reflejar estado IN_PROGRESS en DECISION y PENDING en PAYMENT para siniestros en HUMAN_REVIEW', async () => {
    const reviewClaim: ClaimEntity = {
      ...baseClaim,
      id: 'claim-review-002',
      status: 'HUMAN_REVIEW',
      disbursementId: undefined,
      disbursementTrackingCode: undefined,
      rejectionReason: 'Excede límite STP',
    };
    await claimsRepository.save(reviewClaim);

    const statusDto = await claimsService.getClaimLiveStatus(reviewClaim.id);

    expect(statusDto.status).toBe('HUMAN_REVIEW');
    expect(statusDto.timeline[2].stepKey).toBe('DECISION');
    expect(statusDto.timeline[2].status).toBe('IN_PROGRESS');
    expect(statusDto.timeline[3].stepKey).toBe('PAYMENT');
    expect(statusDto.timeline[3].status).toBe('PENDING');
    expect(statusDto.payout).toBeUndefined();
  });

  it('debe reflejar FAILED en DECISION y PAYMENT para siniestros rechazados', async () => {
    const rejectedClaim: ClaimEntity = {
      ...baseClaim,
      id: 'claim-rejected-003',
      status: 'REJECTED',
      rejectionReason: 'Tratamiento estético no amparado en póliza',
      disbursementId: undefined,
      disbursementTrackingCode: undefined,
    };
    await claimsRepository.save(rejectedClaim);

    const statusDto = await claimsService.getClaimLiveStatus(rejectedClaim.id);

    expect(statusDto.status).toBe('REJECTED');
    expect(statusDto.timeline[2].stepKey).toBe('DECISION');
    expect(statusDto.timeline[2].status).toBe('FAILED');
    expect(statusDto.timeline[2].description).toContain('Tratamiento estético no amparado');
    expect(statusDto.timeline[3].stepKey).toBe('PAYMENT');
    expect(statusDto.timeline[3].status).toBe('FAILED');
  });
});
