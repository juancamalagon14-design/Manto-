import { Pool } from 'pg';
import { EligibilityService } from '../eligibility/eligibility.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { PostgresQuotesRepository } from './quotes.postgres.repository';
import { QuotesService } from './quotes.service';
import { addCop } from '../../common/types/money';

/**
 * Persistencia real contra PostgreSQL.
 *
 * No usa dobles: se conecta a la base de `DATABASE_URL`. Si no está definida,
 * la suite se salta con un aviso, para que `npx jest` siga funcionando en una
 * máquina sin Postgres instalado.
 *
 * Lo que verifica, y es el motivo de existir: que una cotización recuperada de
 * la base sea utilizable por el dominio. El snapshot se guarda como `jsonb`, y
 * `JSON.parse` devuelve `number` donde `ColombianPeso` es un `bigint`: sin
 * revivir los montos, la primera operación aritmética lanza «Cannot mix
 * BigInt and other types» en producción y no en las pruebas unitarias.
 */

const URL_BASE = process.env.DATABASE_URL;
const describeSiHayBase = URL_BASE ? describe : describe.skip;

if (!URL_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[quotes.persistencia] DATABASE_URL no está definida: se omiten las pruebas de persistencia.',
  );
}

describeSiHayBase('Persistencia de cotizaciones en PostgreSQL', () => {
  let pool: Pool;
  let repo: PostgresQuotesRepository;
  let service: QuotesService;

  const dto = (parcial: Partial<CreateQuoteDto> = {}): CreateQuoteDto =>
    Object.assign(new CreateQuoteDto(), {
      petName: 'Nala',
      species: 'CANINE',
      breedCode: 'ROTTWEILER',
      ageInMonths: 36,
      city: 'BOGOTA',
      gender: 'MALE',
      isSterilized: false,
      deductiblePercentage: 0.15,
      selectedAddonKeys: ['COMMON_ILLNESSES'],
      billingFrequency: 'MONTHLY',
      hasPreExistingChronicConditions: false,
      customerName: 'Cliente de Prueba',
      customerEmail: 'cliente@ejemplo.co',
      customerPhone: '3001234567',
      ...parcial,
    });

  beforeAll(async () => {
    pool = new Pool({ connectionString: URL_BASE });
    repo = new PostgresQuotesRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await repo.clear();
    service = new QuotesService(new EligibilityService(), new PricingService(), repo);
  });

  it('una cotización emitida sobrevive a releerla desde la base', async () => {
    const emitida = await service.createQuote(dto());
    const leida = await service.getQuoteById(emitida.id);

    expect(leida.quoteNumber).toBe(emitida.quoteNumber);
    expect(leida.status).toBe('OFFERED');
    expect(leida.petData).toEqual(emitida.petData);
    expect(leida.customer.email).toBe('cliente@ejemplo.co');
  });

  it('los montos vuelven como bigint, no como number', async () => {
    const emitida = await service.createQuote(dto());
    const leida = await service.getQuoteById(emitida.id);
    const p = leida.pricingResult!;

    expect(typeof p.totalMonthlyPremiumCop).toBe('bigint');
    expect(typeof p.baseMonthlyPremiumCop).toBe('bigint');
    expect(typeof p.appliedFactors.basePremiumCop).toBe('bigint');
    for (const c of p.guaranteedBaselineCoverages) {
      expect(typeof c.annualLimitCop).toBe('bigint');
    }
    for (const a of p.activeAddons) {
      expect(typeof a.monthlyPremiumCop).toBe('bigint');
    }
  });

  it('el snapshot recuperado se puede usar en aritmética de pesos', async () => {
    // Esta es la prueba que falla si no se reviven los montos.
    const emitida = await service.createQuote(dto());
    const leida = await service.getQuoteById(emitida.id);
    const p = leida.pricingResult!;

    const suma = addCop(p.baseMonthlyPremiumCop, p.selectedAddonsTotalMonthlyCop);
    expect(suma).toBe(p.totalMonthlyPremiumCop);
  });

  it('la prima leída es idéntica a la emitida, al peso', async () => {
    const emitida = await service.createQuote(dto());
    const leida = await service.getQuoteById(emitida.id);
    expect(leida.pricingResult!.totalMonthlyPremiumCop).toBe(
      emitida.pricingResult!.totalMonthlyPremiumCop,
    );
    expect(leida.pricingResult!.appliedFactors).toEqual(emitida.pricingResult!.appliedFactors);
  });

  it('la RCE obligatoria de Ley 1801 queda persistida', async () => {
    const emitida = await service.createQuote(dto({ breedCode: 'ROTTWEILER' }));
    const leida = await service.getQuoteById(emitida.id);
    const rce = leida.pricingResult!.activeAddons.find((a) => a.key === 'CIVIL_LIABILITY_1801');

    expect(leida.pricingResult!.mandatoryCivilLiabilityAttached).toBe(true);
    expect(rce).toBeDefined();
    expect(Number(rce!.annualLimitCop)).toBe(1750905 * 50);
  });

  it('una cotización rechazada se guarda sin cálculo de primas', async () => {
    const rechazada = await service.createQuote(dto({ breedCode: 'PITBULL' }));
    expect(rechazada.status).toBe('REJECTED');

    const leida = await service.getQuoteById(rechazada.id);
    expect(leida.status).toBe('REJECTED');
    expect(leida.pricingResult).toBeNull();
    expect(leida.rejectionReasons!.length).toBeGreaterThan(0);
  });

  it('se puede buscar por número de cotización', async () => {
    const emitida = await service.createQuote(dto());
    const leida = await repo.findByQuoteNumber(emitida.quoteNumber);
    expect(leida?.id).toBe(emitida.id);
  });

  it('un id que no es UUID devuelve null en vez de reventar', async () => {
    await expect(repo.findById('no-soy-un-uuid')).resolves.toBeNull();
  });

  it('el número de cotización es único: la base lo garantiza', async () => {
    const a = await service.createQuote(dto());
    const duplicada = { ...a, id: '11111111-2222-3333-4444-555555555555' };
    await expect(repo.save(duplicada)).rejects.toThrow(/quote_number|duplicate|única|unique/i);
  });

  it('vincular una cotización actualiza su estado sin tocar el cálculo', async () => {
    const emitida = await service.createQuote(dto());
    const vinculada = await service.bindQuote(emitida.id, { paymentMethodType: 'PSE' });
    expect(vinculada.status).toBe('BOUND');

    const leida = await service.getQuoteById(emitida.id);
    expect(leida.status).toBe('BOUND');
    expect(leida.boundAt).toBeDefined();
    expect(leida.pricingResult!.totalMonthlyPremiumCop).toBe(
      emitida.pricingResult!.totalMonthlyPremiumCop,
    );
  });

  it('la reportería suma desde las columnas, no desde el jsonb', async () => {
    const a = await service.createQuote(dto());
    const b = await service.createQuote(dto({ petName: 'Nube', breedCode: 'MIXED_BREED_DOG' }));
    const total = await repo.totalPrimaMensualOfrecida();
    expect(total).toBe(
      addCop(a.pricingResult!.totalMonthlyPremiumCop, b.pricingResult!.totalMonthlyPremiumCop),
    );
  });
});
