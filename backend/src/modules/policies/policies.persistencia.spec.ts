import { Pool } from 'pg';
import { EligibilityService } from '../eligibility/eligibility.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from '../quotes/dto/create-quote.dto';
import { PostgresQuotesRepository } from '../quotes/quotes.postgres.repository';
import { QuotesService } from '../quotes/quotes.service';
import { CheckoutPolicyDto } from './dto/checkout-policy.dto';
import { PostgresPoliciesRepository } from './policies.postgres.repository';
import { PoliciesService } from './policies.service';

/**
 * Persistencia de pólizas y siniestros en PostgreSQL.
 *
 * Aquí vive el dinero: la cuota emitida, los topes de cada amparo y el copago
 * con el que se va a liquidar un reembolso. Todo eso tiene que volver de la
 * base exactamente como se guardó, y como `bigint`, no como `number`.
 *
 * Se salta si no hay `DATABASE_URL`.
 */
const URL_BASE = process.env.DATABASE_URL;
const describeSiHayBase = URL_BASE ? describe : describe.skip;

describeSiHayBase('Persistencia de pólizas en PostgreSQL', () => {
  let pool: Pool;
  let quotesRepo: PostgresQuotesRepository;
  let policiesRepo: PostgresPoliciesRepository;
  let quotes: QuotesService;
  let policies: PoliciesService;

  const pagosFalsos = {
    createPaymentPreference: jest.fn().mockResolvedValue({
      preferenceId: 'pref_test',
      initPoint: 'https://mp.test/pay',
      sandboxInitPoint: 'https://mp.test/sandbox',
    }),
  };

  const cotizar = () =>
    quotes.createQuote(
      Object.assign(new CreateQuoteDto(), {
        petName: 'Nala',
        species: 'CANINE',
        breedCode: 'ROTTWEILER',
        ageInMonths: 36,
        city: 'BOGOTA',
        gender: 'MALE',
        isSterilized: false,
        deductiblePercentage: 0.2,
        selectedAddonKeys: ['COMMON_ILLNESSES', 'TELEMEDICINE'],
        billingFrequency: 'MONTHLY',
        hasPreExistingChronicConditions: false,
      }),
    );

  const emitir = (quoteId: string) =>
    policies.initiateCheckout(
      Object.assign(new CheckoutPolicyDto(), {
        quoteId,
        customer: {
          fullName: 'Cliente de Prueba',
          email: 'cliente@ejemplo.co',
          phone: '3001234567',
          nationalId: '1020304050',
        },
        paymentMethodType: 'PSE',
        billingFrequency: 'MONTHLY',
        autoRenewalEnabled: true,
      }) as CheckoutPolicyDto,
    );

  beforeAll(() => {
    pool = new Pool({ connectionString: URL_BASE });
    quotesRepo = new PostgresQuotesRepository(pool);
    policiesRepo = new PostgresPoliciesRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    pagosFalsos.createPaymentPreference.mockClear();
    await quotesRepo.clear();
    quotes = new QuotesService(new EligibilityService(), new PricingService(), quotesRepo);
    policies = new PoliciesService(policiesRepo, quotes, pagosFalsos as never);
  });

  it('una póliza emitida se relee con su cuota intacta', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const leida = await policies.getPolicyById(policy.id);

    expect(leida.monthlyPremiumCop).toBe(q.pricingResult!.totalMonthlyPremiumCop);
    expect(leida.annualPremiumCop).toBe(q.pricingResult!.totalAnnualPremiumCop);
    expect(typeof leida.monthlyPremiumCop).toBe('bigint');
  });

  it('los amparos emitidos se releen con tope, carencia y copago', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const leida = await policies.getPolicyById(policy.id);

    expect(leida.coverages).toHaveLength(policy.coverages.length);
    for (const c of leida.coverages) {
      expect(typeof c.annualLimitCop).toBe('bigint');
      expect(typeof c.deductiblePercentage).toBe('number');
      expect(typeof c.waitingPeriodDays).toBe('number');
    }
    // El copago contratado fue 20%: los amparos de reembolso lo llevan.
    const enfermedad = leida.coverages.find((c) => c.code === 'COMMON_ILLNESSES');
    expect(enfermedad?.deductiblePercentage).toBe(0.2);
    // Los de servicio y el mínimo legal, cero.
    expect(leida.coverages.find((c) => c.code === 'TELEMEDICINE')?.deductiblePercentage).toBe(0);
    expect(
      leida.coverages.find((c) => c.code === 'CIVIL_LIABILITY_1801')?.deductiblePercentage,
    ).toBe(0);
  });

  it('el amparo sin tope conserva su marca al releerse', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const leida = await policies.getPolicyById(policy.id);
    expect(leida.coverages.find((c) => c.code === 'TELEMEDICINE')?.hasNoAnnualLimit).toBe(true);
  });

  it('activar la póliza persiste número, vigencia y hash del certificado', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    await policies.activatePolicy(policy.id, 'tx_test');

    const leida = await policies.getPolicyById(policy.id);
    expect(leida.status).toBe('ACTIVE');
    expect(leida.policyNumber).toMatch(/^MTO-PET-\d{4}-[0-9A-F]{6}$/);
    expect(leida.effectiveDate).toBeDefined();
    expect(leida.expirationDate).toBeDefined();
    expect(leida.policyCertificateHash).toHaveLength(64);
  });

  it('la base impide dos pólizas para la misma cotización', async () => {
    // En memoria esto era una consulta previa en el servicio: una condición
    // de carrera. Aquí es una restricción UNIQUE.
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    const gemela = { ...policy, id: '99999999-8888-7777-6666-555555555555' };
    await expect(policiesRepo.save(gemela)).rejects.toThrow(
      /una_poliza_por_cotizacion|duplicate|unique/i,
    );
  });

  it('la base impide una póliza ACTIVE sin número ni certificado', async () => {
    // La interfaz llegó a anunciar «póliza emitida» sobre un registro así.
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    const incompleta = { ...policy, status: 'ACTIVE' as const };
    await expect(policiesRepo.save(incompleta)).rejects.toThrow(/activa_esta_completa|check/i);
  });

  it('se puede buscar por número de póliza y por cotización', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const activa = await policies.activatePolicy(policy.id, 'tx_test');

    expect((await policiesRepo.findByPolicyNumber(activa.policyNumber!))?.id).toBe(policy.id);
    expect((await policiesRepo.findByQuoteId(q.id))?.id).toBe(policy.id);
  });

  it('las pólizas vencidas se consultan con índice, no filtrando en Node', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    await policies.activatePolicy(policy.id, 'tx_test');

    // Hoy no hay ninguna vencida; en un año sí.
    expect(await policiesRepo.findVencidasActivas(new Date())).toHaveLength(0);
    const enDosAnios = new Date(Date.now() + 2 * 365 * 86400000);
    expect(await policiesRepo.findVencidasActivas(enDosAnios)).toHaveLength(1);
  });

  it('un id que no es UUID devuelve null en vez de reventar', async () => {
    await expect(policiesRepo.findById('no-soy-uuid')).resolves.toBeNull();
    await expect(policiesRepo.findByQuoteId('tampoco')).resolves.toBeNull();
  });
});
