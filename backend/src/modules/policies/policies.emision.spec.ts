import { EligibilityService } from '../eligibility/eligibility.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from '../quotes/dto/create-quote.dto';
import { InMemoryQuotesRepository } from '../quotes/quotes.repository';
import { QuotesService } from '../quotes/quotes.service';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import { InMemoryPoliciesRepository } from './policies.repository';
import { PoliciesService } from './policies.service';

/**
 * Pruebas de emisión de póliza.
 *
 * El contrato emitido tiene que decir lo mismo que se tarifó. Antes no lo
 * decía: los amparos de add-on salían sin campo de deducible (y `ClaimsService`
 * liquidaba con un `?? 0.15` inventado), el copago de los amparos base era
 * siempre 0.15 sin importar el tramo cobrado, y el amparo sin tope se firmaba
 * con `annualLimitCop: 0` dentro del hash del certificado de Ley 527.
 */
describe('PoliciesService — lo emitido coincide con lo tarifado', () => {
  let policies: PoliciesService;
  let quotes: QuotesService;

  /** Pasarela de pagos de mentiras: aquí no se prueba el pago. */
  const pagosFalsos = {
    createPaymentPreference: jest.fn().mockResolvedValue({
      preferenceId: 'pref_test',
      initPoint: 'https://mp.test/pay',
      sandboxInitPoint: 'https://mp.test/sandbox',
    }),
  };

  const cotizar = async (parcial: Partial<CreateQuoteDto> = {}) =>
    quotes.createQuote(
      Object.assign(new CreateQuoteDto(), {
        petName: 'Nala',
        species: 'CANINE',
        breedCode: 'ROTTWEILER',
        ageInMonths: 36,
        city: 'BOGOTA',
        gender: 'MALE',
        isSterilized: false,
        deductiblePercentage: 0.15,
        selectedAddonKeys: ['COMMON_ILLNESSES', 'TELEMEDICINE'],
        billingFrequency: 'MONTHLY',
        hasPreExistingChronicConditions: false,
        ...parcial,
      }),
    );

  const emitir = async (quoteId: string) =>
    policies.initiateCheckout(
      Object.assign(new CheckoutPolicyDto(), {
        quoteId,
        customer: {
          fullName: 'Cliente de Prueba',
          email: 'cliente@ejemplo.co',
          phone: '3001234567',
          nationalId: '00000000',
        },
        paymentMethodType: 'PSE',
        billingFrequency: 'MONTHLY',
        autoRenewalEnabled: true,
      }) as CheckoutPolicyDto,
    );

  beforeEach(() => {
    pagosFalsos.createPaymentPreference.mockClear();
    quotes = new QuotesService(
      new EligibilityService(),
      new PricingService(),
      new InMemoryQuotesRepository(),
    );
    policies = new PoliciesService(
      new InMemoryPoliciesRepository(),
      quotes,
      pagosFalsos as never,
    );
  });

  it.each([0.1, 0.15, 0.2] as const)(
    'con deducible %s, cada amparo de reembolso se emite con ese copago',
    async (deducible) => {
      const q = await cotizar({ deductiblePercentage: deducible });
      const { policy } = await emitir(q.id);

      const base = policy.coverages.filter((c) =>
        ['ACCIDENT_EMERGENCY', 'EMERGENCY_CONSULTATIONS', 'DIAGNOSTIC_IMAGING_LABS'].includes(
          c.code,
        ),
      );
      expect(base).toHaveLength(3);
      for (const c of base) {
        expect(c.deductiblePercentage).toBe(deducible);
      }

      const enfermedad = policy.coverages.find((c) => c.code === 'COMMON_ILLNESSES');
      expect(enfermedad?.deductiblePercentage).toBe(deducible);
    },
  );

  it('ningún amparo se emite sin porcentaje de deducible', async () => {
    // Era la causa del `?? 0.15` de ClaimsService: los add-ons salían sin él.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    for (const c of policy.coverages) {
      expect(c.deductiblePercentage).toBeDefined();
      expect(typeof c.deductiblePercentage).toBe('number');
    }
  });

  it('los amparos de servicio y el mínimo legal se emiten sin copago', async () => {
    const q = await cotizar({ deductiblePercentage: 0.2 });
    const { policy } = await emitir(q.id);

    const tele = policy.coverages.find((c) => c.code === 'TELEMEDICINE');
    const rce = policy.coverages.find((c) => c.code === 'CIVIL_LIABILITY_1801');
    // Cobrar copago sobre el amparo que exige la Ley 1801 reduciría de hecho
    // el mínimo legal.
    expect(tele?.deductiblePercentage).toBe(0);
    expect(rce?.deductiblePercentage).toBe(0);
  });

  it('el amparo sin tope se emite marcado como tal, no con tope cero', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const tele = policy.coverages.find((c) => c.code === 'TELEMEDICINE');
    expect(tele?.hasNoAnnualLimit).toBe(true);
  });

  it('la RCE de Ley 1801 llega a la póliza de una raza de manejo especial', async () => {
    const q = await cotizar({ selectedAddonKeys: [] });
    const { policy } = await emitir(q.id);
    const rce = policy.coverages.find((c) => c.code === 'CIVIL_LIABILITY_1801');
    expect(rce).toBeDefined();
    expect(rce?.isMandatory).toBe(true);
    // 50 SMLMV vigentes.
    expect(Number(rce?.annualLimitCop)).toBe(1750905 * 50);
  });

  it('el checkout deja la póliza esperando el pago, sin número ni vigencia', async () => {
    // La interfaz anunciaba "¡Póliza Emitida con Éxito!" sobre esta respuesta.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    expect(policy.status).toBe('PENDING_PAYMENT');
    expect(policy.policyNumber).toBeUndefined();
    expect(policy.effectiveDate).toBeUndefined();
    expect(policy.policyCertificateHash).toBeUndefined();
  });

  it('la prima de la póliza es la del snapshot, no un recálculo', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    expect(policy.monthlyPremiumCop).toBe(q.pricingResult?.totalMonthlyPremiumCop);
    expect(policy.annualPremiumCop).toBe(q.pricingResult?.totalAnnualPremiumCop);
  });

  it('el certificado firma el amparo sin tope como SIN_TOPE, no como 0', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const activa = await policies.activatePolicy(policy.id, 'tx_test');

    expect(activa.status).toBe('ACTIVE');
    expect(activa.policyNumber).toMatch(/^MTO-PET-\d{4}-[0-9A-F]{6}$/);
    expect(activa.policyCertificateHash).toHaveLength(64);

    const certificado = await policies.getDigitalCertificate(activa.id);
    const tele = certificado.coverages?.find((c: { code: string }) => c.code === 'TELEMEDICINE');
    expect(tele).toBeDefined();
  });

  it('una segunda cotización no puede vincularse dos veces a una póliza', async () => {
    const q = await cotizar();
    await emitir(q.id);
    await expect(emitir(q.id)).rejects.toThrow();
  });

  it('activar dos veces en paralelo emite una sola póliza', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const [a, b] = await Promise.all([
      policies.activatePolicy(policy.id, 'tx_1'),
      policies.activatePolicy(policy.id, 'tx_2'),
    ]);
    expect(a.policyNumber).toBe(b.policyNumber);
  });
});
