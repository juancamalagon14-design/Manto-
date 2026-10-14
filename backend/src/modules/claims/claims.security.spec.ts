import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { copToNumber, toCop } from '../../common/types/money';
import { PoliciesService } from '../policies/policies.service';
import { PolicyEntity } from '../policies/policies.types';
import { MockBreBAdapter, validateBreBKeySyntax } from '../reimbursements/bre-b.adapter';
import { InMemoryReimbursementsRepository } from '../reimbursements/reimbursements.repository';
import { ReimbursementsService } from '../reimbursements/reimbursements.service';
import {
  BRE_B_ADAPTER,
  BreBKey,
  REIMBURSEMENTS_REPOSITORY,
} from '../reimbursements/reimbursements.types';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import {
  ClaimEntity,
  CLAIMS_REPOSITORY,
  DianInvoiceData,
  IncidentType,
} from './claims.types';
import { ClinicalRecordDto, DianInvoiceDto, SubmitClaimDto } from './dto/submit-claim.dto';
import { StpEngineService } from './stp-engine.service';

describe('ClaimsModule & ReimbursementsModule (Bre-B) - Auditoría de Seguridad y Pruebas Adversarias', () => {
  let claimsService: ClaimsService;
  let claimsRepository: InMemoryClaimsRepository;
  let reimbursementsService: ReimbursementsService;
  let reimbursementsRepository: InMemoryReimbursementsRepository;
  let breBAdapter: MockBreBAdapter;
  let stpEngine: StpEngineService;
  let policiesServiceMock: { getPolicyById: jest.Mock };

  const effectiveDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // Hace 90 días
  const validIncidentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // Hace 2 días

  // Póliza 1: Base (Accidentes) - Límite STP $300.000 COP
  const mockBaseAccidentPolicy: PolicyEntity = {
    id: 'pol-base-sec-001',
    policyNumber: 'MTO-PET-2026-BASE01',
    quoteId: 'quote-base-001',
    quoteNumber: 'Q-BASE-001',
    status: 'ACTIVE',
    customer: { fullName: 'Camila Restrepo', email: 'camila@example.com' },
    petData: {
      name: 'Simón',
      species: 'CANINE',
      breedCode: 'BEAGLE',
      gender: 'MALE',
      sizeCategory: 'MEDIUM',
      ageInMonths: 20,
      isSterilized: true,
      city: 'MEDELLIN',
    },
    coverages: [
      {
        code: 'ACCIDENT_EMERGENCY',
        name: 'Urgencias por Accidente',
        description: 'Traumatismos y heridas',
        annualLimitCop: toCop(3500000),
        waitingPeriodDays: 0,
        deductiblePercentage: 0.0, // 0% deducible para testeo exacto de frontera de reembolso
      },
      {
        code: 'EMERGENCY_CONSULTATIONS',
        name: 'Consultas de Urgencia',
        description: 'Consultas médicas de emergencia',
        annualLimitCop: toCop(600000),
        waitingPeriodDays: 3,
        deductiblePercentage: 0.0,
      },
    ],
    monthlyPremiumCop: toCop(29900),
    annualPremiumCop: toCop(358800),
    billingFrequency: 'MONTHLY',
    effectiveDate,
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    createdAt: effectiveDate,
    updatedAt: effectiveDate,
  };

  // Póliza 2: Con Enfermedades Comunes - Límite STP $600.000 COP
  const mockMediumIllnessPolicy: PolicyEntity = {
    ...mockBaseAccidentPolicy,
    id: 'pol-med-sec-002',
    policyNumber: 'MTO-PET-2026-MED002',
    coverages: [
      ...mockBaseAccidentPolicy.coverages,
      {
        code: 'COMMON_ILLNESSES',
        name: 'Enfermedades Comunes',
        description: 'Patologías clínicas y gastroentéricas',
        annualLimitCop: toCop(5000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.0,
      },
    ],
  };

  // Póliza 3: Integral / Total - Límite STP $1.200.000 COP (2 add-ons)
  const mockTotalComprehensivePolicy: PolicyEntity = {
    ...mockBaseAccidentPolicy,
    id: 'pol-comp-sec-003',
    policyNumber: 'MTO-PET-2026-COMP03',
    coverages: [
      ...mockBaseAccidentPolicy.coverages,
      {
        code: 'COMMON_ILLNESSES',
        name: 'Enfermedades Comunes',
        description: 'Patologías clínicas',
        annualLimitCop: toCop(6000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.0,
      },
      {
        code: 'PRESCRIPTION_DRUGS',
        name: 'Medicamentos Recetados',
        description: 'Fármacos veterinarios ambulatorios',
        annualLimitCop: toCop(800000),
        waitingPeriodDays: 15,
        deductiblePercentage: 0.0,
      },
      {
        code: 'CIVIL_LIABILITY_1801',
        name: 'Responsabilidad Civil Extracontractual',
        description: 'RCE Mascotas',
        annualLimitCop: toCop(50000000),
        waitingPeriodDays: 0,
        deductiblePercentage: 0.0,
      },
    ],
  };

  const sampleDianInvoice: DianInvoiceDto = {
    invoiceNumber: 'FE-DIAN-2026-0099',
    providerNit: '900987654-3',
    providerName: 'Clínica Veterinaria Las Palmas',
    dianCufe: 'cufe_canonical_security_test_hash_001',
    issueDate: validIncidentDate,
    items: [
      {
        description: 'Procedimiento quirúrgico de trauma',
        amountCop: 300000,
        isCovered: true,
        category: 'TRAUMA',
      },
    ],
    totalInvoiceCop: 300000,
    ocrConfidence: 0.98,
  };

  const sampleDianInvoiceData: DianInvoiceData = {
    invoiceNumber: 'FE-DIAN-2026-0099',
    providerNit: '900987654-3',
    providerName: 'Clínica Veterinaria Las Palmas',
    dianCufe: 'cufe_canonical_security_test_hash_001',
    issueDate: validIncidentDate,
    items: [
      {
        description: 'Procedimiento quirúrgico de trauma',
        amountCop: toCop(300000),
        isCovered: true,
        category: 'TRAUMA',
      },
    ],
    totalInvoiceCop: toCop(300000),
    ocrConfidence: 0.98,
  };

  const sampleBreBKey: BreBKey = {
    type: 'PHONE_NUMBER',
    value: '3118765432',
  };

  const sampleClinicalRecord: ClinicalRecordDto = {
    symptomsOnsetDate: validIncidentDate,
    presumptiveDiagnosis: 'Atención médica veterinaria por urgencia / traumatismo',
    veterinarianName: 'Dr. Alejandro Restrepo',
    hasPreExistingSigns: false,
    ocrConfidence: 0.96,
  };

  beforeEach(async () => {
    claimsRepository = new InMemoryClaimsRepository();
    reimbursementsRepository = new InMemoryReimbursementsRepository();
    breBAdapter = new MockBreBAdapter();
    reimbursementsService = new ReimbursementsService(breBAdapter, reimbursementsRepository);
    stpEngine = new StpEngineService();

    policiesServiceMock = {
      getPolicyById: jest.fn().mockImplementation(async (id: string) => {
        if (id === mockBaseAccidentPolicy.id) return mockBaseAccidentPolicy;
        if (id === mockMediumIllnessPolicy.id) return mockMediumIllnessPolicy;
        if (id === mockTotalComprehensivePolicy.id) return mockTotalComprehensivePolicy;
        return null;
      }),
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
    reimbursementsRepository.clear();
    jest.clearAllMocks();
  });

  // =========================================================================
  // VECTOR 1: LÍMITES DE AUTO-APROBACIÓN STP SEGÚN TOPE DE BAJO RIESGO ($200.000 COP)
  // =========================================================================
  describe('Vector 1: Límites de Auto-Aprobación STP según Tope de Bajo Riesgo ($200.000 COP)', () => {
    describe('1.1 Frontera exacta $200.000 COP vs $200.001 COP', () => {
      it('debe auto-aprobar vía STP y dispersar inmediatamente si el reembolso es exactamente $200.000 COP', async () => {
        const dto: SubmitClaimDto = {
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Corte en pata durante paseo en parque.',
          eligibleExpensesCop: 200000,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: 'cufe_base_exact_200k',
            items: [{ description: 'Sutura', amountCop: 200000, isCovered: true, category: 'TRAUMA' }],
            totalInvoiceCop: 200000,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        };

        const claim = await claimsService.submitClaim(dto);

        expect(claim.status).toBe('PAID');
        expect(claim.stpEvaluation.eligibleForStp).toBe(true);
        expect(claim.stpEvaluation.tierCategory).toBe('BASE_ACCIDENT');
        expect(claim.netReimbursementCop).toBe(toCop(200000));
        expect(claim.disbursementTrackingCode).toMatch(/^BREB-2026-[A-F0-9]{8}$/);
        expect(claim.adjudicatedBy).toBe('STP_ENGINE_AUTOMATED');
      });

      it('debe pasar forzosamente a HUMAN_REVIEW si el reembolso es exactamente $200.001 COP ($1 COP sobre el límite)', async () => {
        const dto: SubmitClaimDto = {
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Corte en pata con valor de 200.001 COP.',
          eligibleExpensesCop: 200001,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: 'cufe_base_exceed_200001',
            items: [{ description: 'Sutura especializada', amountCop: 200001, isCovered: true, category: 'TRAUMA' }],
            totalInvoiceCop: 200001,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        };

        const claim = await claimsService.submitClaim(dto);

        expect(claim.status).toBe('HUMAN_REVIEW');
        expect(claim.stpEvaluation.eligibleForStp).toBe(false);
        expect(claim.rejectionReason).toMatch(/excede el umbral Fast-Track de bajo riesgo \(COP \$200\.000\)/);
        expect(claim.disbursementId).toBeUndefined();
      });

      it('evaluación directa en StpEngineService confirma límite en frontera de $200.000 COP', () => {
        const eval200k = stpEngine.evaluateStp({
          claimData: {
            incidentType: 'ACCIDENT',
            eligibleExpensesCop: toCop(200000),
            netReimbursementCop: toCop(200000),
            dianInvoice: sampleDianInvoiceData,
            clinicalRecord: {
              symptomsOnsetDate: new Date().toISOString(),
              presumptiveDiagnosis: 'Corte menor',
              hasPreExistingSigns: false,
              ocrConfidence: 0.95,
            },
          },
          policy: mockBaseAccidentPolicy,
          isCufeDuplicate: false,
        });
        expect(eval200k.eligibleForStp).toBe(true);

        const eval200k1 = stpEngine.evaluateStp({
          claimData: {
            incidentType: 'ACCIDENT',
            eligibleExpensesCop: toCop(200001),
            netReimbursementCop: toCop(200001),
            dianInvoice: { ...sampleDianInvoiceData, totalInvoiceCop: toCop(200001) },
            clinicalRecord: {
              symptomsOnsetDate: new Date().toISOString(),
              presumptiveDiagnosis: 'Corte menor',
              hasPreExistingSigns: false,
              ocrConfidence: 0.95,
            },
          },
          policy: mockBaseAccidentPolicy,
          isCufeDuplicate: false,
        });
        expect(eval200k1.eligibleForStp).toBe(false);
        expect(eval200k1.rejectionReasons[0]).toContain('excede el umbral Fast-Track de bajo riesgo');
      });
    });

    describe('1.2 Montos superiores a $200.000 COP en cualquier póliza enrutan a HUMAN_REVIEW para autenticación', () => {
      it('debe enrutar a HUMAN_REVIEW un siniestro de $600.000 COP con SLA < 24h', async () => {
        const dto: SubmitClaimDto = {
          policyId: mockMediumIllnessPolicy.id,
          incidentType: 'COMMON_ILLNESS',
          incidentDate: validIncidentDate,
          description: 'Tratamiento por gastroenteritis aguda.',
          eligibleExpensesCop: 600000,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: 'cufe_med_exact_600k',
            items: [{ description: 'Suero y medicación', amountCop: 600000, isCovered: true, category: 'CLINIC' }],
            totalInvoiceCop: 600000,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        };

        const claim = await claimsService.submitClaim(dto);

        expect(claim.status).toBe('HUMAN_REVIEW');
        expect(claim.stpEvaluation.eligibleForStp).toBe(false);
        expect(claim.rejectionReason).toMatch(/excede el umbral Fast-Track de bajo riesgo \(COP \$200\.000\)/);
        expect(claim.disbursementId).toBeUndefined();
      });

      it('debe enrutar a HUMAN_REVIEW un siniestro de $1.200.000 COP con SLA < 24h', async () => {
        const dto: SubmitClaimDto = {
          policyId: mockTotalComprehensivePolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Cirugía compleja de traumatismo articular.',
          eligibleExpensesCop: 1200000,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: 'cufe_comp_exact_1200k',
            items: [{ description: 'Procedimiento ortopédico', amountCop: 1200000, isCovered: true, category: 'SURG' }],
            totalInvoiceCop: 1200000,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        };

        const claim = await claimsService.submitClaim(dto);

        expect(claim.status).toBe('HUMAN_REVIEW');
        expect(claim.stpEvaluation.eligibleForStp).toBe(false);
        expect(claim.rejectionReason).toMatch(/excede el umbral Fast-Track de bajo riesgo \(COP \$200\.000\)/);
        expect(claim.disbursementId).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // VECTOR 2: FRAUDE CON FACTURACIÓN DIAN Y CÓDIGO CUFE
  // =========================================================================
  describe('Vector 2: Fraude con Facturación DIAN y Código CUFE', () => {
    it('debe detectar y bloquear reutilización del mismo CUFE en la misma póliza con alto score de fraude (>= 0.85)', async () => {
      const cufeShared = 'cufe_dian_reuse_attack_same_policy_001';

      // 1. Radicación de siniestro legítimo inicial
      const firstClaim = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Primer siniestro con factura legal.',
        eligibleExpensesCop: 200000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: cufeShared,
          items: [{ description: 'Consulta', amountCop: 200000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 200000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(firstClaim.status).toBe('PAID');

      // 2. Intento de re-utilización de la misma factura fiscal
      const duplicateClaim = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Ataque: radicar de nuevo con la misma factura.',
        eligibleExpensesCop: 200000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: cufeShared,
          items: [{ description: 'Consulta', amountCop: 200000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 200000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(duplicateClaim.status).toBe('HUMAN_REVIEW');
      expect(duplicateClaim.stpEvaluation.eligibleForStp).toBe(false);
      expect(duplicateClaim.stpEvaluation.fraudRiskScore).toBeGreaterThanOrEqual(0.85);
      expect(duplicateClaim.rejectionReason).toMatch(/Alerta de Fraude: El código CUFE.*siniestro anterior/i);
      expect(duplicateClaim.disbursementId).toBeUndefined();
    });

    it('debe detectar y bloquear reutilización de factura CUFE cruzada entre DIFERENTES pólizas (Cross-Policy Attack)', async () => {
      const cufeSharedCross = 'cufe_dian_cross_policy_syndicate_002';

      // 1. Póliza A radica el siniestro (<= 200.000 COP)
      const claimPolicyA = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Siniestro de Simón en Póliza A.',
        eligibleExpensesCop: 180000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: cufeSharedCross,
          items: [{ description: 'Rayos X', amountCop: 180000, isCovered: true, category: 'DIAG' }],
          totalInvoiceCop: 180000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });
      expect(claimPolicyA.status).toBe('PAID');

      // 2. Póliza B (otro titular) intenta radicar con la misma factura electrónica
      const claimPolicyB = await claimsService.submitClaim({
        policyId: mockMediumIllnessPolicy.id,
        incidentType: 'COMMON_ILLNESS',
        incidentDate: validIncidentDate,
        description: 'Siniestro de otra mascota intentando usar la factura de Póliza A.',
        eligibleExpensesCop: 180000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: cufeSharedCross,
          items: [{ description: 'Rayos X', amountCop: 180000, isCovered: true, category: 'DIAG' }],
          totalInvoiceCop: 180000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(claimPolicyB.status).toBe('HUMAN_REVIEW');
      expect(claimPolicyB.stpEvaluation.eligibleForStp).toBe(false);
      expect(claimPolicyB.stpEvaluation.fraudRiskScore).toBeGreaterThanOrEqual(0.85);
      expect(claimPolicyB.rejectionReason).toMatch(/Alerta de Fraude: El código CUFE.*siniestro anterior/i);
      expect(claimPolicyB.disbursementId).toBeUndefined();
    });


    it('debe normalizar CUFE contra evasiones por mayúsculas/minúsculas o espacios en blanco', async () => {
      const originalCufe = 'f9a8b7c6d5e4';
      await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Primer reclamo con CUFE canónico en minúsculas.',
        eligibleExpensesCop: 100000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: originalCufe,
          items: [{ description: 'Curación', amountCop: 100000, isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: 100000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      // Intento con mayúsculas y espacios
      const evasionCufe = `  ${originalCufe.toUpperCase()}  `;
      const evasionClaim = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Segundo reclamo con CUFE adulterado con espacios y mayúsculas.',
        eligibleExpensesCop: 100000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: evasionCufe,
          items: [{ description: 'Curación', amountCop: 100000, isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: 100000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(evasionClaim.status).toBe('HUMAN_REVIEW');
      expect(evasionClaim.stpEvaluation.eligibleForStp).toBe(false);
      expect(evasionClaim.rejectionReason).toMatch(/Alerta de Fraude: El código CUFE/i);
    });

    it('debe bloquear auto-aprobación STP si la confianza OCR es inferior al 90% (< 0.90)', async () => {
      const testCases = [0.89, 0.899, 0.75, 0.50];

      for (const confidence of testCases) {
        const claim = await claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: `Factura con baja confianza OCR ${confidence}.`,
          eligibleExpensesCop: 150000,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: `cufe_ocr_${confidence}`,
            ocrConfidence: confidence,
            items: [{ description: 'Atención', amountCop: 150000, isCovered: true, category: 'TRAUMA' }],
            totalInvoiceCop: 150000,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        });

        expect(claim.status).toBe('HUMAN_REVIEW');
        expect(claim.stpEvaluation.eligibleForStp).toBe(false);
        expect(claim.rejectionReason).toMatch(/Confianza OCR insuficiente/i);
        expect(claim.disbursementId).toBeUndefined();
      }
    });

    it('debe aceptar el umbral exacto del 90% de confianza OCR (>= 0.90)', async () => {
      const claim = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Factura con confianza OCR en el umbral exacto de 90%.',
        eligibleExpensesCop: 150000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: 'cufe_ocr_threshold_090',
          ocrConfidence: 0.90, // Exacto
          items: [{ description: 'Atención', amountCop: 150000, isCovered: true, category: 'TRAUMA' }],
          totalInvoiceCop: 150000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(claim.status).toBe('PAID');
      expect(claim.stpEvaluation.eligibleForStp).toBe(true);
    });

    it('debe detectar discrepancias contables aritméticas entre la suma de ítems y el total de la factura', async () => {
      const claim = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Factura DIAN con discrepancia en suma de ítems.',
        eligibleExpensesCop: 180000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: 'cufe_discrepancy_sum_001',
          items: [
            { description: 'Examen de sangre', amountCop: 100000, isCovered: true, category: 'LAB' },
            { description: 'Anestesia', amountCop: 50000, isCovered: true, category: 'SURG' },
          ],
          totalInvoiceCop: 250000, // Suma da 150.000 != 250.000
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(claim.status).toBe('HUMAN_REVIEW');
      expect(claim.stpEvaluation.eligibleForStp).toBe(false);
      expect(claim.stpEvaluation.fraudRiskScore).toBeGreaterThanOrEqual(0.40);
      expect(claim.rejectionReason).toMatch(/Discrepancia contable: La suma de ítems analizados.*no coincide/i);
    });

    it('debe detectar inconsistencia si los gastos elegibles declarados superan el total de la factura', async () => {
      const claim = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Declarando más gastos elegibles que el total facturado.',
        eligibleExpensesCop: 350000, // > 200.000 totalInvoiceCop
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: 'cufe_excess_eligible_001',
          items: [{ description: 'Tratamiento', amountCop: 200000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 200000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(claim.status).toBe('HUMAN_REVIEW');
      expect(claim.stpEvaluation.eligibleForStp).toBe(false);
      expect(claim.stpEvaluation.fraudRiskScore).toBeGreaterThanOrEqual(0.50);
      expect(claim.rejectionReason).toMatch(/superan el valor bruto total facturado/i);
    });
  });

  // =========================================================================
  // VECTOR 3: INTEGRIDAD DE PÓLIZA Y CARENCIAS CONTRACTUALES
  // =========================================================================
  describe('Vector 3: Integridad de Póliza y Carencias Contractuales', () => {
    it('debe rechazar de inmediato con BadRequestException radicaciones sobre pólizas en PENDING_PAYMENT', async () => {
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...mockBaseAccidentPolicy,
        status: 'PENDING_PAYMENT',
      });

      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro sobre póliza pendiente de pago.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar de inmediato con BadRequestException radicaciones sobre pólizas SUSPENDED', async () => {
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...mockBaseAccidentPolicy,
        status: 'SUSPENDED',
      });

      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro sobre póliza suspendida por mora.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar de inmediato con BadRequestException radicaciones sobre pólizas CANCELLED', async () => {
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...mockBaseAccidentPolicy,
        status: 'CANCELLED',
      });

      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro sobre póliza cancelada.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar de inmediato con BadRequestException radicaciones sobre pólizas EXPIRED', async () => {
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...mockBaseAccidentPolicy,
        status: 'EXPIRED',
      });

      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro sobre póliza expirada.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe arrojar NotFoundException si el policyId no existe en el sistema', async () => {
      await expect(
        claimsService.submitClaim({
          policyId: 'unregistered-policy-uuid',
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro con póliza fantasma.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe rechazar con BadRequestException siniestros con fecha anterior a la vigencia de la póliza', async () => {
      // Vigencia inició hace 90 días; incidente hace 120 días
      const priorDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: priorDate,
          description: 'Intento de reclamo retroactivo pre-póliza.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(/anterior a la fecha de inicio de vigencia/i);
    });

    it('debe rechazar con BadRequestException si el siniestro ocurrió dentro del período de carencia contractual', async () => {
      // Póliza contratada hace solo 15 días; cobertura COMMON_ILLNESS exige 30 días de carencia
      const recentPolicyStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      policiesServiceMock.getPolicyById.mockResolvedValueOnce({
        ...mockMediumIllnessPolicy,
        effectiveDate: recentPolicyStart,
        createdAt: recentPolicyStart,
      });

      const incidentDuringWaitingPeriod = new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 10 días tras vigencia < 30 días requeridos

      await expect(
        claimsService.submitClaim({
          policyId: mockMediumIllnessPolicy.id,
          incidentType: 'COMMON_ILLNESS',
          incidentDate: incidentDuringWaitingPeriod,
          description: 'Enfermedad durante el período de carencia.',
          eligibleExpensesCop: 200000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(/período de carencia \(30 días requeridos\)/i);
    });

    it('debe rechazar siniestros con fechas en el futuro', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: tomorrow,
          description: 'Incidente fechado en el futuro.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        }),
      ).rejects.toThrow(/no puede ser una fecha futura/i);
    });

    it('debe rechazar de inmediato con BadRequestException si se omite la historia clínica / epicrisis (obligatoria)', async () => {
      await expect(
        claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro sin historia clínica.',
          eligibleExpensesCop: 100000,
          dianInvoice: sampleDianInvoice,
          breBKey: sampleBreBKey,
        } as any),
      ).rejects.toThrow(/La Historia Clínica o Epicrisis es obligatoria/i);
    });
  });

  // =========================================================================
  // VECTOR 4: TOPE DE SUMA ASEGURADA REMANENTE
  // =========================================================================
  describe('Vector 4: Tope de Suma Asegurada Remanente', () => {
    it('debe topar el reembolso exactamente al saldo anual disponible sin sobrepagar ni un centavo', async () => {
      // Límite anual para ACCIDENT_EMERGENCY en mockBaseAccidentPolicy: $3.500.000 COP
      // 1. Radicar primer siniestro grande por $3.000.000 COP -> Aprobado y Pagado
      // Pasa a HUMAN_REVIEW porque $3.000.000 > $300.000 límite STP de Base
      const claim1 = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Cirugía mayor de emergencia traumatológica.',
        eligibleExpensesCop: 3000000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: 'cufe_limit_claim_01',
          items: [{ description: 'Cirugía mayor', amountCop: 3000000, isCovered: true, category: 'SURG' }],
          totalInvoiceCop: 3000000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(claim1.status).toBe('HUMAN_REVIEW');
      expect(claim1.netReimbursementCop).toBe(toCop(3000000));

      // Ajustador aprueba el siniestro 1 y se liquida/paga
      const adjudicated1 = await claimsService.adjudicateClaimByHuman(claim1.id, {
        decision: 'APPROVED',
        adjusterId: 'ADJ-SENIOR-1',
        adjusterNotes: 'Soporte quirúrgico verificado.',
      });
      expect(adjudicated1.status).toBe('PAID');
      expect(adjudicated1.netReimbursementCop).toBe(toCop(3000000));

      // Saldo disponible remanente para ACCIDENT_EMERGENCY: $3.500.000 - $3.000.000 = $500.000 COP

      // 2. Radicar segundo siniestro con gastos de $1.000.000 COP
      // Debe ser estrictamente topado a $500.000 COP, ni un peso más
      const claim2 = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Curación posterior secundaria.',
        eligibleExpensesCop: 1000000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: 'cufe_limit_claim_02',
          items: [{ description: 'Curación', amountCop: 1000000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 1000000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      // Pasa a HUMAN_REVIEW porque $500.000 > límite STP base ($300.000)
      expect(claim2.status).toBe('HUMAN_REVIEW');
      expect(claim2.netReimbursementCop).toBe(toCop(500000)); // EXACTAMENTE $500.000 COP (Topado)

      // Ajustador aprueba el siniestro 2
      const adjudicated2 = await claimsService.adjudicateClaimByHuman(claim2.id, {
        decision: 'APPROVED',
        adjusterId: 'ADJ-SENIOR-1',
      });
      expect(adjudicated2.status).toBe('PAID');
      expect(adjudicated2.netReimbursementCop).toBe(toCop(500000));

      // Total acumulado pagado: $3.000.000 + $500.000 = $3.500.000 COP (Límite 100% agotado)

      // 3. Radicar tercer siniestro: Debe resultar en $0 COP de reembolso
      const claim3 = await claimsService.submitClaim({
        policyId: mockBaseAccidentPolicy.id,
        incidentType: 'ACCIDENT',
        incidentDate: validIncidentDate,
        description: 'Tercer siniestro con límite agotado.',
        eligibleExpensesCop: 400000,
        dianInvoice: {
          ...sampleDianInvoice,
          dianCufe: 'cufe_limit_claim_03',
          items: [{ description: 'Control', amountCop: 400000, isCovered: true, category: 'MED' }],
          totalInvoiceCop: 400000,
        },
        clinicalRecord: sampleClinicalRecord,
        breBKey: sampleBreBKey,
      });

      expect(claim3.status).toBe('HUMAN_REVIEW');
      expect(claim3.netReimbursementCop).toBe(toCop(0));
      expect(claim3.rejectionReason).toMatch(/deducible y límites/i);
      expect(claim3.disbursementId).toBeUndefined();
    });
  });

  // =========================================================================
  // VECTOR 5: SEGURIDAD EN DISPERSIÓN INMEDIATA BRE-B (BANCO DE LA REPÚBLICA)
  // =========================================================================
  describe('Vector 5: Seguridad en Dispersión Inmediata Bre-B (Banco de la República)', () => {
    describe('5.1 Validación Estricta de Llaves Bre-B (SPI Banrep)', () => {
      it('debe validar números de celular colombianos legítimos e interceptar celulares inválidos', () => {
        // Válidos
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '3001234567' }).valid).toBe(true);
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '3109876543' }).valid).toBe(true);
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '3205551234' }).valid).toBe(true);

        // Adversarios: no inician con 3
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '2001234567' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '1001234567' }).valid).toBe(false);

        // Longitud incorrecta
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '300123456' }).valid).toBe(false); // 9 dígitos
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '30012345678' }).valid).toBe(false); // 11 dígitos

        // Inyecciones de caracteres no numéricos
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '300123456a' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '300-123-4567' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '300 1234567' }).valid).toBe(false);
      });

      it('debe validar identificaciones nacionales colombianas (6 a 10 dígitos) y rechazar malformadas', () => {
        // Válidas
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '1020304050' }).valid).toBe(true);
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '52123456' }).valid).toBe(true);
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '123456' }).valid).toBe(true);

        // Inválidas
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '12345' }).valid).toBe(false); // 5 dígitos
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '12345678901' }).valid).toBe(false); // 11 dígitos
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: '10203040A' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'NATIONAL_ID', value: 'CC-10203040' }).valid).toBe(false);
      });

      it('debe validar emails compatibles con la red SPI y rechazar formatos corruptos', () => {
        // Válidos
        expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'titular@manto.co' }).valid).toBe(true);
        expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'juan.perez@nequi.com.co' }).valid).toBe(true);

        // Inválidos
        expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'sin-arroba.com' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'usuario@' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'EMAIL', value: '@dominio.co' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'EMAIL', value: 'usuario @manto.co' }).valid).toBe(false);
      });

      it('debe rechazar tipos de llave no soportados o datos nulos/vacíos', () => {
        expect(validateBreBKeySyntax(null as any).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'CRYPTO_WALLET' as any, value: '0x1234' }).valid).toBe(false);
        expect(validateBreBKeySyntax({ type: 'PHONE_NUMBER', value: '' }).valid).toBe(false);
      });
    });

    describe('5.2 Inyecciones de Montos Negativos o Cero', () => {
      it('debe arrojar BadRequestException en ReimbursementsService ante dispersiones de 0 COP', async () => {
        await expect(
          reimbursementsService.disburseClaimViaBreB(
            'claim-zero-1',
            'pol-001',
            toCop(0),
            sampleBreBKey,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('debe arrojar BadRequestException en ReimbursementsService ante dispersiones de montos negativos', async () => {
        await expect(
          reimbursementsService.disburseClaimViaBreB(
            'claim-neg-1',
            'pol-001',
            -50000n as any,
            sampleBreBKey,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('debe arrojar BadRequestException en ClaimsService si los gastos elegibles declarados son 0 o negativos', async () => {
        // Intento con 0 COP
        await expect(
          claimsService.submitClaim({
            policyId: mockBaseAccidentPolicy.id,
            incidentType: 'ACCIDENT',
            incidentDate: validIncidentDate,
            description: 'Gastos en 0 COP.',
            eligibleExpensesCop: 0,
            dianInvoice: sampleDianInvoice,
            clinicalRecord: sampleClinicalRecord,
            breBKey: sampleBreBKey,
          }),
        ).rejects.toThrow(BadRequestException);

        // Intento con -100.000 COP
        await expect(
          claimsService.submitClaim({
            policyId: mockBaseAccidentPolicy.id,
            incidentType: 'ACCIDENT',
            incidentDate: validIncidentDate,
            description: 'Gastos negativos adversarios.',
            eligibleExpensesCop: -100000,
            dianInvoice: sampleDianInvoice,
            clinicalRecord: sampleClinicalRecord,
            breBKey: sampleBreBKey,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('debe arrojar BadRequestException si el ajustador aprueba un monto menor o igual a 0 COP', async () => {
        const claim = await claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro para mesa médica.',
          eligibleExpensesCop: 400000,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: 'cufe_human_zero_test',
            items: [{ description: 'Cirugía', amountCop: 400000, isCovered: true, category: 'SURG' }],
            totalInvoiceCop: 400000,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        });

        await expect(
          claimsService.adjudicateClaimByHuman(claim.id, {
            decision: 'APPROVED',
            approvedAmountCop: 0,
          }),
        ).rejects.toThrow(BadRequestException);

        await expect(
          claimsService.adjudicateClaimByHuman(claim.id, {
            decision: 'APPROVED',
            approvedAmountCop: -50000,
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('5.3 Bloqueo de Doble Dispersión (Idempotencia en Pago Bre-B)', () => {
      it('debe garantizar que llamadas duplicadas a disburseClaimViaBreB ejecuten el adaptador Bre-B EXACTAMENTE 1 vez', async () => {
        const claimId = 'claim-idempotency-uuid-001';
        const policyId = mockBaseAccidentPolicy.id;
        const amount = toCop(250000);

        const disburseSpy = jest.spyOn(breBAdapter, 'disburse');

        // Primera dispersión
        const tx1 = await reimbursementsService.disburseClaimViaBreB(
          claimId,
          policyId,
          amount,
          sampleBreBKey,
        );

        expect(tx1.status).toBe('SETTLED_INSTANTLY');
        expect(disburseSpy).toHaveBeenCalledTimes(1);

        // Segunda llamada (intento de replay o retry duplicado)
        const tx2 = await reimbursementsService.disburseClaimViaBreB(
          claimId,
          policyId,
          amount,
          sampleBreBKey,
        );

        // Ambas deben retornar la misma información y código de rastreo
        expect(tx2.id).toBe(tx1.id);
        expect(tx2.breBTrackingCode).toBe(tx1.breBTrackingCode);
        expect(tx2.status).toBe('SETTLED_INSTANTLY');

        // El adaptador de pagos del Banco de la República DEBE haberse ejecutado SOLO 1 vez
        expect(disburseSpy).toHaveBeenCalledTimes(1);
      });

      it('debe proteger contra condiciones de carrera concurrentes (Promise.all) dispersando fondos solo una vez', async () => {
        const claimId = 'claim-concurrent-race-002';
        const policyId = mockBaseAccidentPolicy.id;
        const amount = toCop(180000);

        const disburseSpy = jest.spyOn(breBAdapter, 'disburse');

        // Disparo simultáneo en paralelo
        const [resA, resB] = await Promise.all([
          reimbursementsService.disburseClaimViaBreB(claimId, policyId, amount, sampleBreBKey),
          reimbursementsService.disburseClaimViaBreB(claimId, policyId, amount, sampleBreBKey),
        ]);

        expect(resA.breBTrackingCode).toBe(resB.breBTrackingCode);
        expect(resA.id).toBe(resB.id);
        expect(disburseSpy).toHaveBeenCalledTimes(1);

        // Solo 1 transacción en el repositorio
        const txInRepo = await reimbursementsRepository.findByClaimId(claimId);
        expect(txInRepo).toBeDefined();
        expect(txInRepo?.id).toBe(resA.id);
      });

      it('debe rechazar con BadRequestException si se intenta adjudicar nuevamente un siniestro ya en estado PAID', async () => {
        // 1. Crear y auto-aprobar siniestro (status: PAID)
        const claim = await claimsService.submitClaim({
          policyId: mockBaseAccidentPolicy.id,
          incidentType: 'ACCIDENT',
          incidentDate: validIncidentDate,
          description: 'Siniestro con auto-aprobación y pago.',
          eligibleExpensesCop: 200000,
          dianInvoice: {
            ...sampleDianInvoice,
            dianCufe: 'cufe_double_adjudicate_01',
            items: [{ description: 'Consulta', amountCop: 200000, isCovered: true, category: 'MED' }],
            totalInvoiceCop: 200000,
          },
          clinicalRecord: sampleClinicalRecord,
          breBKey: sampleBreBKey,
        });

        expect(claim.status).toBe('PAID');

        // 2. Intento de adjudicación manual sobre siniestro pagado
        await expect(
          claimsService.adjudicateClaimByHuman(claim.id, {
            decision: 'APPROVED',
            adjusterId: 'ADJ-FRAUD-ATTACK',
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          claimsService.adjudicateClaimByHuman(claim.id, {
            decision: 'APPROVED',
          }),
        ).rejects.toThrow(/Solo es posible adjudicar siniestros en estado HUMAN_REVIEW/i);
      });

      it('debe rechazar con BadRequestException si se intenta re-dispersar un siniestro con un monto discrepante', async () => {
        const claimId = 'claim-mismatch-amount-003';
        const policyId = mockBaseAccidentPolicy.id;

        // Dispersión original por $150.000 COP
        await reimbursementsService.disburseClaimViaBreB(
          claimId,
          policyId,
          toCop(150000),
          sampleBreBKey,
        );

        // Intento de re-dispersión fraudulenta por $200.000 COP
        await expect(
          reimbursementsService.disburseClaimViaBreB(
            claimId,
            policyId,
            toCop(200000),
            sampleBreBKey,
          ),
        ).rejects.toThrow(BadRequestException);
        await expect(
          reimbursementsService.disburseClaimViaBreB(
            claimId,
            policyId,
            toCop(200000),
            sampleBreBKey,
          ),
        ).rejects.toThrow(/Conflicto de dispersión/i);
      });
    });
  });
});
