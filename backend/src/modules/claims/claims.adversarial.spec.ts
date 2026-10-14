import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
import { ClaimsService } from './claims.service';
import { ClaimEntity, CLAIMS_REPOSITORY } from './claims.types';
import { ClaimDocumentTypeDto } from './dto/generate-presigned-url.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { InvoiceOcrService } from './invoice-ocr.service';
import { StpEngineService } from './stp-engine.service';

/**
 * Suite de Pruebas Adversarias y Hardening Anti-Fraude (Paso 4)
 * Certificación de Seguridad Ofensiva y Defensiva - Manto 2.0
 */
describe('Claims & Triage - Pruebas Adversarias y Hardening Anti-Fraude (Paso 4)', () => {
  let claimsService: ClaimsService;
  let claimsRepo: InMemoryClaimsRepository;
  let storageService: ClaimsStorageService;
  let triageWorker: ClaimsTriageWorker;
  let policiesMock: { getPolicyById: jest.Mock };

  const validIncidentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const validEffectiveDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const mockVictimPolicy: PolicyEntity = {
    id: 'pol-victim-001',
    policyNumber: 'MTO-PET-2026-VIC001',
    quoteId: 'quote-vic-001',
    quoteNumber: 'Q-VIC-001',
    status: 'ACTIVE',
    customer: { fullName: 'Ana Maria Hurtado', email: 'ana@example.com' },
    petData: {
      name: 'Luna',
      species: 'CANINE',
      breedCode: 'GOLDEN_RETRIEVER',
      gender: 'FEMALE',
      sizeCategory: 'LARGE',
      ageInMonths: 36,
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
        deductiblePercentage: 0.10,
      },
    ],
    monthlyPremiumCop: toCop(34900),
    annualPremiumCop: toCop(418800),
    billingFrequency: 'MONTHLY',
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    effectiveDate: validEffectiveDate,
    createdAt: validEffectiveDate,
    updatedAt: validEffectiveDate,
  };

  const mockAttackerPolicy: PolicyEntity = {
    ...mockVictimPolicy,
    id: 'pol-attacker-002',
    policyNumber: 'MTO-PET-2026-ATK002',
    customer: { fullName: 'Carlos Malicioso', email: 'carlos.fake@attack.com' },
  };

  const mockZeroDeductiblePolicy: PolicyEntity = {
    ...mockVictimPolicy,
    id: 'pol-zero-payout-003',
    policyNumber: 'MTO-PET-2026-ZERO003',
    coverages: [
      {
        ...mockVictimPolicy.coverages[0],
        deductiblePercentage: 1.0,
      },
    ],
  };

  beforeEach(async () => {
    claimsRepo = new InMemoryClaimsRepository();
    storageService = new ClaimsStorageService();
    const brebAdapter = new MockBreBAdapter();
    const reimbursementsRepo = new InMemoryReimbursementsRepository();
    const reimbursementsService = new ReimbursementsService(brebAdapter, reimbursementsRepo);
    const auditLogService = new AuditLogService();
    const stpEngine = new StpEngineService();
    const ocrService = new InvoiceOcrService(new MockGeminiProvider() as any);

    policiesMock = {
      getPolicyById: jest.fn().mockImplementation(async (id: string) => {
        if (id === mockVictimPolicy.id) return mockVictimPolicy;
        if (id === mockAttackerPolicy.id) return mockAttackerPolicy;
        if (id === mockZeroDeductiblePolicy.id) return mockZeroDeductiblePolicy;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        ClaimsTriageWorker,
        InvoiceOcrService,
        StpEngineService,
        {
          provide: ClaimsStorageService,
          useValue: storageService,
        },
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

    claimsService = module.get<ClaimsService>(ClaimsService);
    triageWorker = module.get<ClaimsTriageWorker>(ClaimsTriageWorker);
  });

  // =========================================================================
  // VECTOR ADVERSARIO 1: BROKEN OBJECT LEVEL AUTHORIZATION (BOLA/IDOR)
  // =========================================================================
  describe('Vector Adversario 1: Broken Object Level Authorization (BOLA / IDOR)', () => {
    it('debe impedir que un atacante radique un siniestro asociando soportes médicos de otro usuario', async () => {
      // 1. Usuario Legítimo (Víctima) sube su factura confidencial
      const legitimatePresigned = await storageService.generatePresignedUploadUrl(
        {
          fileName: 'factura_urgencia_luna.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 150000,
          documentType: ClaimDocumentTypeDto.DIAN_INVOICE,
          sha256Checksum: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        },
        'user-victim-uuid',
      );

      // 2. Atacante intenta radicar reclamación en su póliza usando el documentId de la víctima
      await expect(
        storageService.validateUserDocuments([legitimatePresigned.documentId], 'user-attacker-uuid'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        storageService.validateUserDocuments([legitimatePresigned.documentId], 'user-attacker-uuid'),
      ).rejects.toThrow(/no pertenece al usuario autenticado/i);
    });

    it('debe impedir que un atacante confirme o manipule el estado de subida de un documento ajeno', async () => {
      const presigned = await storageService.generatePresignedUploadUrl(
        {
          fileName: 'radiografia_victima.png',
          mimeType: 'image/png',
          fileSizeBytes: 300000,
          documentType: ClaimDocumentTypeDto.LAB_RESULTS,
          sha256Checksum: '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111',
        },
        'user-victim-uuid',
      );

      await expect(
        storageService.confirmDocumentUpload(presigned.documentId, 'user-attacker-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // VECTOR ADVERSARIO 2: RE-SUBMISSION & HASH COLLISION HARDENING
  // =========================================================================
  describe('Vector Adversario 2: Ataques de Doble Reembolso y Colisión de Hash SHA-256', () => {
    it('debe bloquear Fast-Track y desviar a Auditoría Manual ante duplicidad de CUFE inter-póliza', async () => {
      const duplicateCufe = 'cufe_adversarial_attack_syndicate_001';

      // 1. Radicación previa legítima con ese CUFE
      const initialClaim: ClaimEntity = {
        id: 'claim-legit-001',
        claimNumber: 'CLM-2026-LEGIT1',
        policyId: mockVictimPolicy.id,
        policyNumber: mockVictimPolicy.policyNumber || 'MTO-PET-2026-VIC001',
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Siniestro legítimo pagado.',
        dianInvoice: {
          invoiceNumber: 'FE-9001',
          providerNit: '900111222-3',
          providerName: 'Clínica Veterinaria Santa Fe',
          dianCufe: duplicateCufe,
          issueDate: validIncidentDate,
          items: [{ description: 'Urgencia', amountCop: toCop(120000), isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: toCop(120000),
          ocrConfidence: 0.96,
        },
        breBKey: { type: 'PHONE_NUMBER', value: '3101234567' },
        eligibleExpensesCop: toCop(120000),
        deductibleCop: toCop(12000),
        netReimbursementCop: toCop(108000),
        status: 'PAID',
        stpEvaluation: { eligibleForStp: true, tierLimitCop: toCop(300000), rejectionReasons: [], fraudRiskScore: 0.0 },
        submittedAt: validIncidentDate,
      };
      await claimsRepo.save(initialClaim);

      // 2. Ataque: El atacante intenta cobrar la misma factura médica con monto pequeño para burlar el Fast-Track (<$200k)
      const attackClaim: ClaimEntity = {
        id: 'claim-attack-002',
        claimNumber: 'CLM-2026-ATK002',
        policyId: mockAttackerPolicy.id,
        policyNumber: mockAttackerPolicy.policyNumber || 'MTO-PET-2026-ATK002',
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Intento de doble cobro de factura ajena con monto $120.000 COP.',
        dianInvoice: {
          invoiceNumber: 'FE-9001',
          providerNit: '900111222-3',
          providerName: 'Clínica Veterinaria Santa Fe',
          dianCufe: duplicateCufe,
          issueDate: validIncidentDate,
          items: [{ description: 'Urgencia', amountCop: toCop(120000), isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: toCop(120000),
          ocrConfidence: 0.96,
        },
        breBKey: { type: 'PHONE_NUMBER', value: '3159998877' },
        eligibleExpensesCop: toCop(120000),
        deductibleCop: toCop(12000),
        netReimbursementCop: toCop(108000),
        status: 'SUBMITTED',
        stpEvaluation: { eligibleForStp: true, tierLimitCop: toCop(300000), rejectionReasons: [], fraudRiskScore: 0.0 },
        submittedAt: validIncidentDate,
      };
      await claimsRepo.save(attackClaim);

      // 3. Ejecución del Worker de Triage
      const result = await triageWorker.processJob({
        claimId: attackClaim.id,
        policyId: attackClaim.policyId,
      });

      // El motor debe denegar Fast-Track y forzar Auditoría Manual
      expect(result.triageRoute).toBe('MANUAL_AUDIT');
      expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/CUFE.*ya reembolsado/i)]),
      );

      const updatedAttackClaim = await claimsRepo.findById(attackClaim.id);
      expect(updatedAttackClaim?.status).toBe('MANUAL_AUDIT_REQUIRED');
      expect(updatedAttackClaim?.disbursementId).toBeUndefined();
    });
  });

  // =========================================================================
  // VECTOR ADVERSARIO 3: CLÍNICAS VETERINARIAS SANCIONADAS / LISTAS NEGRAS
  // =========================================================================
  describe('Vector Adversario 3: Bloqueo de Clínicas Sancionadas y Proveedores Fantasma', () => {
    it('debe interceptar y bloquear Fast-Track si el NIT pertenece a la lista negra del sector', async () => {
      const blacklistedClaim: ClaimEntity = {
        id: 'claim-blacklist-nit-001',
        claimNumber: 'CLM-2026-BLK001',
        policyId: mockVictimPolicy.id,
        policyNumber: mockVictimPolicy.policyNumber || 'MTO-PET-2026-VIC001',
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Atención en clínica sancionada por fraude.',
        dianInvoice: {
          invoiceNumber: 'FE-8888',
          providerNit: '900999999-9', // NIT en lista negra
          providerName: 'Clínica Veterinaria Fantasma S.A.S.',
          dianCufe: 'cufe_clean_but_bad_provider_001',
          issueDate: validIncidentDate,
          items: [{ description: 'Consulta', amountCop: toCop(90000), isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: toCop(90000),
          ocrConfidence: 0.98,
        },
        breBKey: { type: 'PHONE_NUMBER', value: '3101234567' },
        eligibleExpensesCop: toCop(90000),
        deductibleCop: toCop(9000),
        netReimbursementCop: toCop(81000),
        status: 'SUBMITTED',
        stpEvaluation: { eligibleForStp: true, tierLimitCop: toCop(300000), rejectionReasons: [], fraudRiskScore: 0.0 },
        submittedAt: validIncidentDate,
      };
      await claimsRepo.save(blacklistedClaim);

      const result = await triageWorker.processJob({
        claimId: blacklistedClaim.id,
        policyId: blacklistedClaim.policyId,
      });

      expect(result.triageRoute).toBe('MANUAL_AUDIT');
      expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/lista negra/i)]),
      );
    });
  });

  // =========================================================================
  // VECTOR ADVERSARIO 4: ALTERACIÓN DE METADATOS Y DISCREPANCIA FINANCIERA
  // =========================================================================
  describe('Vector Adversario 4: Intentos de Evasión por Monto y Sobrededucción', () => {
    it('debe forzar Auditoría Manual si el monto total de la factura supera el límite de Fast-Track ($200.000 COP)', async () => {
      const highAmountClaim: ClaimEntity = {
        id: 'claim-high-amount-001',
        claimNumber: 'CLM-2026-HIGH1',
        policyId: mockVictimPolicy.id,
        policyNumber: mockVictimPolicy.policyNumber || 'MTO-PET-2026-VIC001',
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Factura por $250.000 COP.',
        dianInvoice: {
          invoiceNumber: 'FE-7777',
          providerNit: '901234567-8',
          providerName: 'Hospital Veterinario de Antioquia S.A.S.',
          dianCufe: 'cufe_high_amount_valid_001',
          issueDate: validIncidentDate,
          items: [{ description: 'Procedimiento mayor', amountCop: toCop(250000), isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: toCop(250000),
          ocrConfidence: 0.95,
        },
        breBKey: { type: 'PHONE_NUMBER', value: '3101234567' },
        eligibleExpensesCop: toCop(250000),
        deductibleCop: toCop(25000),
        netReimbursementCop: toCop(225000),
        status: 'SUBMITTED',
        clinicalRecord: {
          symptomsOnsetDate: validIncidentDate,
          presumptiveDiagnosis: 'Procedimiento mayor',
          veterinarianName: 'Dr. Alejandro Restrepo',
          hasPreExistingSigns: false,
          ocrConfidence: 0.95,
        },
        stpEvaluation: { eligibleForStp: true, tierLimitCop: toCop(300000), rejectionReasons: [], fraudRiskScore: 0.0 },
        submittedAt: validIncidentDate,
      };
      await claimsRepo.save(highAmountClaim);

      const result = await triageWorker.processJob({
        claimId: highAmountClaim.id,
        policyId: highAmountClaim.policyId,
      });

      expect(result.triageRoute).toBe('MANUAL_AUDIT');
      expect(result.status).toBe('MANUAL_AUDIT_REQUIRED');
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/Monto reclamado.*excede el umbral de Fast-Track/i)]),
      );
    });

    it('debe suprimir cualquier desembolso si el deducible absorbe el 100% del siniestro ($0 COP payout)', async () => {
      const zeroPayoutClaim: ClaimEntity = {
        id: 'claim-zero-deductible-001',
        claimNumber: 'CLM-2026-ZERO1',
        policyId: mockZeroDeductiblePolicy.id,
        policyNumber: mockZeroDeductiblePolicy.policyNumber || 'MTO-PET-2026-ZERO003',
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Factura mínima de $30.000 COP donde el deducible mínimo pactado la absorbe.',
        dianInvoice: {
          invoiceNumber: 'FE-3333',
          providerNit: '901234567-8',
          providerName: 'Hospital Veterinario de Antioquia S.A.S.',
          dianCufe: 'cufe_zero_deductible_001',
          issueDate: validIncidentDate,
          items: [{ description: 'Curación menor', amountCop: toCop(30000), isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: toCop(30000),
          ocrConfidence: 0.97,
        },
        breBKey: { type: 'PHONE_NUMBER', value: '3101234567' },
        eligibleExpensesCop: toCop(30000),
        deductibleCop: toCop(30000),
        netReimbursementCop: toCop(0),
        status: 'SUBMITTED',
        clinicalRecord: {
          symptomsOnsetDate: validIncidentDate,
          presumptiveDiagnosis: 'Curación menor',
          veterinarianName: 'Dr. Alejandro Restrepo',
          hasPreExistingSigns: false,
          ocrConfidence: 0.97,
        },
        stpEvaluation: { eligibleForStp: true, tierLimitCop: toCop(300000), rejectionReasons: [], fraudRiskScore: 0.0 },
        submittedAt: validIncidentDate,
      };
      await claimsRepo.save(zeroPayoutClaim);

      const result = await triageWorker.processJob({
        claimId: zeroPayoutClaim.id,
        policyId: zeroPayoutClaim.policyId,
      });

      // No debe generar desembolso, se marca aprobado Fast-Track sin pago pendiente
      expect(result.triageRoute).toBe('FAST_TRACK');
      expect(result.status).toBe('FAST_TRACK_APPROVED');

      const saved = await claimsRepo.findById(zeroPayoutClaim.id);
      expect(saved?.netReimbursementCop).toBe(toCop(0));
      expect(saved?.disbursementId).toBeUndefined();
    });
  });
});
