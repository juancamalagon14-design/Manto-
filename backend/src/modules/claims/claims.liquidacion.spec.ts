import { UnprocessableEntityException } from '@nestjs/common';
import { PolicyCoverage, PolicyEntity } from '../policies/policies.types';
import { InMemoryClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { StpEngineService } from './stp-engine.service';
import { SubmitClaimDto } from './dto/submit-claim.dto';

/**
 * Pruebas de liquidación de siniestros.
 *
 * `ClaimsService` liquidaba con `coverage.deductiblePercentage ?? 0.15`: si un
 * amparo llegaba emitido sin copago declarado —lo que pasaba con todos los
 * add-ons—, el motor no fallaba, asumía 15% y desembolsaba dinero real sobre
 * ese supuesto. Es la misma familia de defecto que el `city || 'BOGOTA'` que se
 * eliminó del módulo de IA: un valor por defecto donde hace falta un error.
 */
describe('ClaimsService — no liquida sobre un copago supuesto', () => {
  let claims: ClaimsService;
  let politicas: { getPolicyById: jest.Mock; isCovered: jest.Mock };
  let reembolsos: { dispatchReimbursement: jest.Mock };

  const amparo = (parcial: Partial<PolicyCoverage> = {}): PolicyCoverage =>
    ({
      code: 'ACCIDENT_EMERGENCY',
      name: 'Urgencias y Hospitalización por Accidente',
      description: 'Atención vital tras un accidente.',
      annualLimitCop: BigInt(3500000) as never,
      waitingPeriodDays: 0,
      deductiblePercentage: 0.15,
      isMandatory: false,
      ...parcial,
    }) as PolicyCoverage;

  const poliza = (coverages: PolicyCoverage[]): PolicyEntity =>
    ({
      id: 'pol_test',
      policyNumber: 'MTO-PET-2026-ABCDEF',
      quoteId: 'q_test',
      quoteNumber: 'QTE-TEST',
      status: 'ACTIVE',
      customer: { fullName: 'Cliente', email: 'c@e.co', phone: '3000000000', nationalId: '1' },
      petData: {
        name: 'Nala',
        species: 'CANINE',
        breedCode: 'MIXED_BREED_DOG',
        sizeCategory: 'MEDIUM',
        ageInMonths: 36,
        city: 'BOGOTA',
        gender: 'MALE',
        isSterilized: false,
      },
      coverages,
      monthlyPremiumCop: BigInt(30000) as never,
      annualPremiumCop: BigInt(330000) as never,
      billingFrequency: 'MONTHLY',
      effectiveDate: new Date(Date.now() - 90 * 86400000).toISOString(),
      expirationDate: new Date(Date.now() + 275 * 86400000).toISOString(),
      rulesVersion: 'PET_RULES_v2.0.0',
      autoRenewalEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }) as PolicyEntity;

  const radicar = (parcial: Partial<SubmitClaimDto> = {}): SubmitClaimDto =>
    ({
      policyId: 'pol_test',
      incidentType: 'ACCIDENT',
      incidentDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      description: 'Fractura de pata trasera tras una caída en el parque.',
      eligibleExpensesCop: 1000000,
      breBKey: { type: 'PHONE_NUMBER', value: '3001234567' },
      dianInvoice: {
        invoiceNumber: 'FE-1001',
        providerNit: '900123456-1',
        providerName: 'Clínica Veterinaria Prueba',
        dianCufe: `cufe-${Math.random().toString(36).slice(2)}`,
        issueDate: new Date(Date.now() - 86400000).toISOString(),
        items: [
          { description: 'Radiografía', amountCop: 400000, isCovered: true, category: 'DIAGNOSTICO' },
          { description: 'Cirugía', amountCop: 600000, isCovered: true, category: 'CIRUGIA' },
        ],
        totalInvoiceCop: 1000000,
        ocrConfidence: 0.98,
      },
      clinicalRecord: {
        symptomsOnsetDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        presumptiveDiagnosis: 'Fractura de pata trasera tras una caída en el parque',
        veterinarianName: 'Dr. Alejandro Restrepo',
        hasPreExistingSigns: false,
        ocrConfidence: 0.98,
      },
      ...parcial,
    }) as SubmitClaimDto;

  beforeEach(() => {
    politicas = {
      getPolicyById: jest.fn(),
      isCovered: jest.fn().mockReturnValue(true),
    };
    reembolsos = { dispatchReimbursement: jest.fn().mockResolvedValue({ status: 'SETTLED' }) };
    claims = new ClaimsService(
      new InMemoryClaimsRepository(),
      politicas as never,
      reembolsos as never,
      new StpEngineService(),
    );
  });

  it('lanza 422 cuando el amparo se emitió sin porcentaje de deducible', async () => {
    politicas.getPolicyById.mockResolvedValue(
      poliza([amparo({ deductiblePercentage: undefined })]),
    );
    await expect(claims.submitClaim(radicar())).rejects.toThrow(UnprocessableEntityException);
  });

  it('lanza 422 también si el deducible llega nulo', async () => {
    politicas.getPolicyById.mockResolvedValue(
      poliza([amparo({ deductiblePercentage: null as never })]),
    );
    await expect(claims.submitClaim(radicar())).rejects.toThrow(UnprocessableEntityException);
  });

  it('un copago de 0 es legítimo y NO se confunde con ausente', async () => {
    // Los amparos de servicio y el mínimo de Ley 1801 se emiten con copago 0.
    // Un guard con `??` los habría tratado como faltantes y liquidado al 15%.
    politicas.getPolicyById.mockResolvedValue(poliza([amparo({ deductiblePercentage: 0 })]));
    const claim = await claims.submitClaim(radicar());
    expect(Number(claim.deductibleCop)).toBe(0);
  });

  it.each([
    [0.1, 100000],
    [0.15, 150000],
    [0.2, 200000],
  ])('liquida con el copago emitido: %s sobre $1.000.000 son $%s', async (copago, esperado) => {
    politicas.getPolicyById.mockResolvedValue(
      poliza([amparo({ deductiblePercentage: copago })]),
    );
    const claim = await claims.submitClaim(radicar());
    expect(Number(claim.deductibleCop)).toBe(esperado);
  });

  it('el cliente no puede fijar su propio deducible en la radicación', async () => {
    politicas.getPolicyById.mockResolvedValue(poliza([amparo({ deductiblePercentage: 0.2 })]));
    const claim = await claims.submitClaim(
      radicar({ deductiblePercentage: 0 } as never),
    );
    // El copago sale de la póliza, no del payload.
    expect(Number(claim.deductibleCop)).toBe(200000);
  });

  it('liquida PREVENTIVE_WELLNESS con copago 0 legítimo', async () => {
    politicas.getPolicyById.mockResolvedValue(
      poliza([
        amparo({
          code: 'PREVENTIVE_WELLNESS',
          name: 'Pack Manto Bienestar: Vacunas y Desparasitación',
          deductiblePercentage: 0.0,
          annualLimitCop: BigInt(350000) as never,
          waitingPeriodDays: 0,
        }),
      ]),
    );
    const claim = await claims.submitClaim(
      radicar({
        incidentType: 'PREVENTIVE_WELLNESS',
        eligibleExpensesCop: 180000,
        dianInvoice: {
          invoiceNumber: 'FE-2002',
          providerNit: '900123456-1',
          providerName: 'Clínica Veterinaria Prueba',
          dianCufe: `cufe-bienestar-${Math.random().toString(36).slice(2)}`,
          issueDate: new Date(Date.now() - 86400000).toISOString(),
          items: [{ description: 'Vacuna Puppy + Rabia', amountCop: 180000, isCovered: true, category: 'PREVENTIVO' }],
          totalInvoiceCop: 180000,
          ocrConfidence: 0.98,
        },
      }),
    );

    // Con copago 0% el aporte del cliente es 0 y el reembolso es el 100%
    expect(Number(claim.deductibleCop)).toBe(0);
    expect(Number(claim.netReimbursementCop)).toBe(180000);
  });
});

/**
 * Los tres topes de STP estaban escritos dos veces: como constantes de la
 * clase y como literales en línea. `resolveStpLimit` usaba unas y
 * `calculatePersonalizedStpLimit` las otras, así que mover un tope en un sitio
 * dejaba el otro camino liquidando con la cifra vieja.
 */
describe('StpEngineService — una sola fuente para los topes', () => {
  const motor = new StpEngineService();

  it('los topes de la clase son los que usa el cálculo personalizado', () => {
    expect(Number(StpEngineService.STP_LIMIT_BASE_ACCIDENT)).toBe(300000);
    expect(Number(StpEngineService.STP_LIMIT_MEDIUM_ILLNESS)).toBe(600000);
    expect(Number(StpEngineService.STP_LIMIT_TOTAL_COMPREHENSIVE)).toBe(1200000);
  });

  it('el tope base del cálculo personalizado sale de las constantes', () => {
    const poliza = {
      coverages: [
        {
          code: 'COMMON_ILLNESSES',
          name: 'Enfermedades',
          description: '',
          annualLimitCop: BigInt(5000000),
          waitingPeriodDays: 30,
          deductiblePercentage: 0.15,
        },
      ],
      petData: { ageInMonths: 36, breedCode: 'MIXED_BREED_DOG', species: 'CANINE' },
    } as never;

    const r = motor.calculatePersonalizedStpLimit(poliza, 'COMMON_ILLNESS');
    expect(Number(r.baseCoverageLimitCop)).toBe(
      Number(StpEngineService.STP_LIMIT_MEDIUM_ILLNESS),
    );
    expect(typeof r.personalizedStpLimitCop).toBe('bigint');
  });
});
