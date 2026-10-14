import { toCop } from '../../common/types/money';
import { PolicyEntity } from '../policies/policies.types';
import { ClinicalRecordData, DianInvoiceData, IncidentType } from './claims.types';
import { StpEngineService } from './stp-engine.service';

describe('StpEngineService (Motor STP Escalonado y Prevención de Fraude)', () => {
  let service: StpEngineService;

  const mockBaseAccidentPolicy: PolicyEntity = {
    id: 'pol-base-001',
    policyNumber: 'MTO-PET-2026-BASE01',
    quoteId: 'quote-001',
    quoteNumber: 'Q-001',
    status: 'ACTIVE',
    customer: { fullName: 'Laura Gomez', email: 'laura@example.com' },
    petData: {
      name: 'Firulais',
      species: 'CANINE',
      breedCode: 'MIXED_BREED_DOG',
      sizeCategory: 'MEDIUM',
      ageInMonths: 36,
      gender: 'MALE',
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
        code: 'EMERGENCY_CONSULTATIONS',
        name: 'Consultas de Urgencia',
        description: 'Consultas',
        annualLimitCop: toCop(450000),
        waitingPeriodDays: 2,
        deductiblePercentage: 0.15,
      },
      {
        code: 'DIAGNOSTIC_IMAGING_LABS',
        name: 'Exámenes por Trauma',
        description: 'Exámenes',
        annualLimitCop: toCop(800000),
        waitingPeriodDays: 0,
        deductiblePercentage: 0.15,
      },
    ],
    monthlyPremiumCop: toCop(34900),
    annualPremiumCop: toCop(418800),
    billingFrequency: 'MONTHLY',
    rulesVersion: 'PET_RULES_v2.0.0',
    autoRenewalEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockMediumIllnessPolicy: PolicyEntity = {
    ...mockBaseAccidentPolicy,
    id: 'pol-medium-002',
    policyNumber: 'MTO-PET-2026-MED002',
    coverages: [
      ...mockBaseAccidentPolicy.coverages,
      {
        code: 'COMMON_ILLNESSES',
        name: 'Enfermedades Comunes',
        description: 'Enfermedades',
        annualLimitCop: toCop(5000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.15,
      },
    ],
  };

  const mockComprehensivePolicy: PolicyEntity = {
    ...mockBaseAccidentPolicy,
    id: 'pol-comp-003',
    policyNumber: 'MTO-PET-2026-COMP03',
    coverages: [
      ...mockBaseAccidentPolicy.coverages,
      {
        code: 'COMMON_ILLNESSES',
        name: 'Enfermedades Comunes',
        description: 'Enfermedades',
        annualLimitCop: toCop(5000000),
        waitingPeriodDays: 30,
        deductiblePercentage: 0.15,
      },
      {
        code: 'PRESCRIPTION_DRUGS',
        name: 'Medicamentos Recetados',
        description: 'Fármacos',
        annualLimitCop: toCop(600000),
        waitingPeriodDays: 15,
        deductiblePercentage: 0.15,
      },
      {
        code: 'CIVIL_LIABILITY_1801',
        name: 'Responsabilidad Civil',
        description: 'RCE',
        annualLimitCop: toCop(65000000),
        waitingPeriodDays: 0,
        deductiblePercentage: 0.15,
      },
    ],
  };

  const validDianInvoice: DianInvoiceData = {
    invoiceNumber: 'FE-2026-9901',
    providerNit: '900123456-7',
    providerName: 'Clínica Veterinaria Santa Bárbara',
    dianCufe: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    issueDate: new Date().toISOString(),
    items: [
      {
        description: 'Sutura de urgencia por laceración',
        amountCop: toCop(180000),
        isCovered: true,
        category: 'SURGERY',
      },
      {
        description: 'Antibiótico inyectable post-trauma',
        amountCop: toCop(70000),
        isCovered: true,
        category: 'MEDICATION',
      },
    ],
    totalInvoiceCop: toCop(250000),
    ocrConfidence: 0.96,
  };

  const validClinicalRecord: ClinicalRecordData = {
    symptomsOnsetDate: new Date().toISOString(),
    presumptiveDiagnosis: 'Atención médica veterinaria de urgencia por laceración',
    microchipNumber: '977200008899112',
    veterinarianName: 'Dr. Santiago Vargas',
    veterinarianLicense: 'COMVEZCOL-14522',
    hasPreExistingSigns: false,
    clinicalSummary: 'Paciente acude por evento agudo reciente. Sin signos de preexistencias.',
    ocrConfidence: 0.97,
  };

  beforeEach(() => {
    service = new StpEngineService();
  });

  describe('determineTierCategory & getTierLimit', () => {
    it('debe clasificar como BASE_ACCIDENT con límite de $300.000 COP', () => {
      const tier = service.determineTierCategory(mockBaseAccidentPolicy);
      expect(tier).toBe('BASE_ACCIDENT');
      expect(service.getTierLimit(tier)).toBe(toCop(300000));
    });

    it('debe clasificar como MEDIUM_ILLNESS con límite de $600.000 COP', () => {
      const tier = service.determineTierCategory(mockMediumIllnessPolicy);
      expect(tier).toBe('MEDIUM_ILLNESS');
      expect(service.getTierLimit(tier)).toBe(toCop(600000));
    });

    it('debe clasificar como TOTAL_COMPREHENSIVE con límite de $1.200.000 COP', () => {
      const tier = service.determineTierCategory(mockComprehensivePolicy);
      expect(tier).toBe('TOTAL_COMPREHENSIVE');
      expect(service.getTierLimit(tier)).toBe(toCop(1200000));
    });
  });

  describe('calculatePersonalizedStpLimit & calculatePetRiskMultiplier (Personalización por Mascota)', () => {
    it('debe calcular multiplicador favorable para mascota joven y criolla (vigor híbrido)', () => {
      const multiplier = service.calculatePetRiskMultiplier(mockBaseAccidentPolicy);
      // age: 36m (1.0), deducible 15% (1.0), raza MIXED_BREED_DOG (1.05) -> 1.05
      expect(multiplier).toBe(1.05);
    });

    it('debe calcular multiplicador conservador para perro senior de 10 años (120 meses)', () => {
      const seniorPolicy: PolicyEntity = {
        ...mockBaseAccidentPolicy,
        petData: {
          ...mockBaseAccidentPolicy.petData,
          ageInMonths: 110, // Senior (factor 0.85)
          breedCode: 'LABRADOR_RETRIEVER', // (factor 1.0)
        },
      };

      const multiplier = service.calculatePetRiskMultiplier(seniorPolicy);
      expect(multiplier).toBe(0.85);

      const stpLimit = service.calculatePersonalizedStpLimit(seniorPolicy, 'ACCIDENT');
      // Base: $300.000 * 0.85 = $255.000 COP
      expect(stpLimit.personalizedStpLimitCop).toBe(toCop(255000));
      expect(stpLimit.hasCoverage).toBe(true);
    });

    it('debe reportar hasCoverage: false y límite $0 COP si la mascota no tiene contratada la cobertura', () => {
      const stpLimit = service.calculatePersonalizedStpLimit(mockBaseAccidentPolicy, 'COMMON_ILLNESS');
      expect(stpLimit.hasCoverage).toBe(false);
      expect(stpLimit.personalizedStpLimitCop).toBe(toCop(0));
    });
  });

  describe('evaluateStp - Flujos de Aprobación Automática (STP_APPROVED)', () => {
    it('debe calificar favorablemente para liquidación STP cuando cumple todas las reglas y monto <= $200.000 COP', () => {
      const invoiceUnder200k: DianInvoiceData = {
        ...validDianInvoice,
        items: [{ description: 'Sutura de urgencia menor', amountCop: toCop(180000), isCovered: true, category: 'SURGERY' }],
        totalInvoiceCop: toCop(180000),
      };

      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(180000),
          netReimbursementCop: toCop(153000), // <= 200.000 COP tope bajo riesgo
          dianInvoice: invoiceUnder200k,
          clinicalRecord: validClinicalRecord,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(true);
      expect(result.tierCategory).toBe('BASE_ACCIDENT');
      expect(result.slaCategory).toBe('FAST_TRACK_MINUTES');
      expect(result.slaResolutionEstimatedTime).toContain('3 a 5 minutos');
      expect(result.rejectionReasons).toHaveLength(0);
      expect(result.fraudRiskScore).toBe(0);
    });
  });

  describe('evaluateStp - Enrutamiento a HUMAN_REVIEW y Control Antifraude', () => {
    it('debe enrutar a HUMAN_REVIEW si el reembolso supera el umbral Fast-Track de bajo riesgo ($200.000 COP)', () => {
      const invoiceHigh: DianInvoiceData = {
        ...validDianInvoice,
        items: [{ description: 'Consulta y cirugía menor', amountCop: toCop(300000), isCovered: true, category: 'TRAUMA' }],
        totalInvoiceCop: toCop(300000),
      };

      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(300000),
          netReimbursementCop: toCop(255000), // > 200.000 COP tope de bajo riesgo
          dianInvoice: invoiceHigh,
          clinicalRecord: validClinicalRecord,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.slaCategory).toBe('EXPEDITED_AUDIT_24H');
      expect(result.rejectionReasons.some((r) => r.includes('excede el umbral Fast-Track de bajo riesgo'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW si falta la Historia Clínica obligatoria', () => {
      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(150000),
          netReimbursementCop: toCop(127500),
          dianInvoice: validDianInvoice,
          // clinicalRecord omitido intencionalmente
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('Falta documento obligatorio: La historia clínica'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW y generar alerta si la Historia Clínica detecta preexistencias', () => {
      const clinicalWithPreExisting: ClinicalRecordData = {
        ...validClinicalRecord,
        hasPreExistingSigns: true,
        preExistingNotes: 'Paciente con antecedentes crónicos de vómitos recurrentes desde hace 4 meses.',
      };

      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(150000),
          netReimbursementCop: toCop(127500),
          dianInvoice: validDianInvoice,
          clinicalRecord: clinicalWithPreExisting,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.slaCategory).toBe('SPECIALIZED_REVIEW_48H');
      expect(result.clinicalRecordValidation?.preExistingAlert).toBe(true);
      expect(result.rejectionReasons.some((r) => r.includes('Alerta de Preexistencia detectada en Historia Clínica'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW si la fecha de inicio de síntomas es previa a la póliza', () => {
      const clinicalPastDate: ClinicalRecordData = {
        ...validClinicalRecord,
        symptomsOnsetDate: '2025-01-01T00:00:00.000Z', // Anterior a la vigencia 2026
      };

      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(150000),
          netReimbursementCop: toCop(127500),
          dianInvoice: validDianInvoice,
          clinicalRecord: clinicalPastDate,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.clinicalRecordValidation?.preExistingAlert).toBe(true);
      expect(result.rejectionReasons.some((r) => r.includes('es anterior a la vigencia de la póliza'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW si el reembolso supera el límite STP del tier', () => {
      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(400000),
          netReimbursementCop: toCop(340000), // > 300.000 COP para base
          dianInvoice: {
            ...validDianInvoice,
            items: [{ description: 'Cirugía ortopédica', amountCop: toCop(400000), isCovered: true, category: 'TRAUMA' }],
            totalInvoiceCop: toCop(400000),
          },
          clinicalRecord: validClinicalRecord,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('excede el límite de aprobación STP') || r.includes('excede el umbral Fast-Track'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW si la confianza OCR es menor al 90% (< 0.90)', () => {
      const invoiceLowConfidence: DianInvoiceData = {
        ...validDianInvoice,
        ocrConfidence: 0.84, // < 0.90
      };

      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(200000),
          netReimbursementCop: toCop(170000),
          dianInvoice: invoiceLowConfidence,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('Confianza OCR insuficiente'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW e incrementar score de fraude si el CUFE ya fue utilizado', () => {
      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(200000),
          netReimbursementCop: toCop(170000),
          dianInvoice: validDianInvoice,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: true,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.fraudRiskScore).toBeGreaterThanOrEqual(0.85);
      expect(result.rejectionReasons.some((r) => r.includes('Alerta de Fraude: El código CUFE'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW si hay discrepancias contables en la factura DIAN', () => {
      const invoiceDiscrepancy: DianInvoiceData = {
        ...validDianInvoice,
        items: [
          { description: 'Item 1', amountCop: toCop(100000), isCovered: true, category: 'CLINIC' },
          { description: 'Item 2', amountCop: toCop(50000), isCovered: true, category: 'CLINIC' },
        ],
        totalInvoiceCop: toCop(220000), // Suma da 150000 != 220000
      };

      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(150000),
          netReimbursementCop: toCop(127500),
          dianInvoice: invoiceDiscrepancy,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('Discrepancia contable'))).toBe(true);
    });

    it('debe enrutar a HUMAN_REVIEW si los gastos declarados superan el total de la factura', () => {
      const result = service.evaluateStp({
        claimData: {
          incidentType: 'ACCIDENT',
          eligibleExpensesCop: toCop(300000), // > 250.000 totalInvoiceCop
          netReimbursementCop: toCop(200000),
          dianInvoice: validDianInvoice,
        },
        policy: mockBaseAccidentPolicy,
        isCufeDuplicate: false,
      });

      expect(result.eligibleForStp).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('superan el valor bruto total facturado'))).toBe(true);
    });
  });
});
