/**
 * Persistencia de siniestros en PostgreSQL.
 *
 * Nació como suite adversaria de la revisión `manto-qa-security`: cada prueba
 * de aquí demostró un defecto real de la capa de persistencia. Se conservan
 * todas, ahora en verde, porque son la única cobertura de
 * `claims.postgres.repository.ts` y porque si una se pone roja es que volvió
 * algo que ya estaba mal.
 *
 * Se salta si no hay `DATABASE_URL`.
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { addCop, toCop } from '../../common/types/money';
import { EligibilityService } from '../eligibility/eligibility.service';
import { CheckoutPolicyDto } from '../policies/dto/checkout-policy.dto';
import { PostgresPoliciesRepository } from '../policies/policies.postgres.repository';
import { PoliciesService } from '../policies/policies.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateQuoteDto } from '../quotes/dto/create-quote.dto';
import { PostgresQuotesRepository } from '../quotes/quotes.postgres.repository';
import { QuotesService } from '../quotes/quotes.service';
import { PostgresClaimsRepository } from './claims.postgres.repository';
import { ClaimEntity } from './claims.types';
import { StpEngineService } from './stp-engine.service';

const URL_BASE = process.env.DATABASE_URL;
const describeSiHayBase = URL_BASE ? describe : describe.skip;

describeSiHayBase('Persistencia de siniestros en PostgreSQL', () => {
  let pool: Pool;
  let quotesRepo: PostgresQuotesRepository;
  let policiesRepo: PostgresPoliciesRepository;
  let claimsRepo: PostgresClaimsRepository;
  let quotes: QuotesService;
  let policies: PoliciesService;

  const pagosFalsos = {
    createPaymentPreference: jest.fn().mockResolvedValue({
      preferenceId: 'pref_test',
      initPoint: 'https://mp.test/pay',
      sandboxInitPoint: 'https://mp.test/sandbox',
    }),
  };

  const cotizar = (parcial: Partial<CreateQuoteDto> = {}) =>
    quotes.createQuote(
      Object.assign(new CreateQuoteDto(), {
        petName: 'Thor',
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
        customerName: 'Ana Rce',
        customerEmail: 'ana.rce@ejemplo.co',
        customerPhone: '3001234567',
        ...parcial,
      }),
    );

  const emitir = (quoteId: string) =>
    policies.initiateCheckout(
      Object.assign(new CheckoutPolicyDto(), {
        quoteId,
        customer: {
          fullName: 'Ana Rce',
          email: 'ana.rce@ejemplo.co',
          phone: '3001234567',
          nationalId: '1020304050',
        },
        paymentMethodType: 'PSE',
        billingFrequency: 'MONTHLY',
        autoRenewalEnabled: true,
      }) as CheckoutPolicyDto,
    );

  /** Siniestro mínimo válido, con los montos de factura que se quieran. */
  const siniestro = (
    policyId: string,
    policyNumber: string,
    opciones: { itemAmount?: number; total?: number; cufe?: string } = {},
  ): ClaimEntity => {
    const itemAmount = opciones.itemAmount ?? 400_000;
    const total = opciones.total ?? itemAmount;
    return {
      id: randomUUID(),
      claimNumber: `CLM-2026-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      policyId,
      policyNumber,
      status: 'SUBMITTED',
      incidentType: 'ACCIDENT',
      incidentDate: new Date().toISOString(),
      description: 'Fractura de radio por caída',
      dianInvoice: {
        invoiceNumber: 'FE-8891',
        providerNit: '900123456-7',
        providerName: 'Clínica Veterinaria del Norte',
        dianCufe: opciones.cufe ?? `cufe-${randomUUID()}`,
        issueDate: new Date().toISOString(),
        items: [
          {
            description: 'Radiografía',
            amountCop: toCop(itemAmount),
            isCovered: true,
            category: 'DIAGNOSTICO',
          },
        ],
        totalInvoiceCop: toCop(total),
        ocrConfidence: 0.97,
      },
      breBKey: { type: 'PHONE_NUMBER', value: '3001234567' },
      eligibleExpensesCop: toCop(itemAmount),
      deductibleCop: toCop(0),
      netReimbursementCop: toCop(itemAmount),
      stpEvaluation: {
        eligibleForStp: true,
        coverageCode: 'ACCIDENT_EMERGENCY',
        tierLimitCop: toCop(1_000_000),
        tierCategory: 'BASE_ACCIDENT',
        rejectionReasons: [],
        fraudRiskScore: 0,
      },
      submittedAt: new Date().toISOString(),
    };
  };

  beforeAll(() => {
    pool = new Pool({ connectionString: URL_BASE });
    quotesRepo = new PostgresQuotesRepository(pool);
    policiesRepo = new PostgresPoliciesRepository(pool);
    claimsRepo = new PostgresClaimsRepository(pool);
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

  // ------------------------------------------------- el dinero de la factura

  it('la factura vuelve con su dinero en bigint, igual que las columnas', async () => {
    // `DianInvoiceData` declaraba estos dos campos como `number`, y
    // `reviveMoney` los convertía a `bigint` por el sufijo `Cop`: el tipo decía
    // una cosa y el valor en tiempo de ejecución era otra. Ahora el tipo es
    // `ColombianPeso`, como manda el proyecto para todo peso colombiano.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const c = siniestro(policy.id, policy.quoteNumber);
    await claimsRepo.save(c);

    const leido = await claimsRepo.findById(c.id);
    expect(typeof leido!.dianInvoice.totalInvoiceCop).toBe('bigint');
    expect(typeof leido!.dianInvoice.items[0].amountCop).toBe('bigint');
    expect(leido!.dianInvoice.totalInvoiceCop).toBe(c.dianInvoice.totalInvoiceCop);
  });

  it('la regla contable del motor STP funciona sobre un siniestro releído', async () => {
    // La Regla 4 compara la suma de ítems contra el total de la factura. Con
    // `number` en el tipo y `bigint` en el valor, esa comparación lanzaba
    // «Cannot mix BigInt and other types» en cuanto el siniestro venía de la
    // base en vez de del cuerpo de la petición.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const c = siniestro(policy.id, policy.quoteNumber);
    await claimsRepo.save(c);
    const leido = await claimsRepo.findById(c.id);

    const evaluacion = new StpEngineService().evaluateStp({
      claimData: {
        incidentType: leido!.incidentType,
        eligibleExpensesCop: leido!.eligibleExpensesCop,
        netReimbursementCop: leido!.netReimbursementCop,
        dianInvoice: leido!.dianInvoice,
      },
      policy: await policiesRepo.findById(policy.id).then((p) => p!),
      isCufeDuplicate: false,
    });

    // `toContain` compara por identidad y NO admite matchers asimétricos: con
    // `toContain(expect.stringContaining(...))` la aserción no podía fallar
    // nunca y la prueba pasaba por el motivo equivocado.
    expect(evaluacion.rejectionReasons).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Discrepancia contable')]),
    );
  });

  it('una fila escrita con decimales sigue siendo LEGIBLE', async () => {
    // Defensa en profundidad. `@IsInt` en la DTO es lo que impide que entre un
    // monto con centavos; esto comprueba lo otro: que si una fila ya quedó
    // escrita así, leerla no lance. Lanzar al leer no evitaba nada —la fila ya
    // estaba confirmada— y en cambio dejaba el expediente inaccesible para
    // siempre: `findById`, `findByCufe` y hasta `findAll`, que arrastraba a
    // todos los demás siniestros con uno solo malo.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const c = siniestro(policy.id, policy.quoteNumber);
    await claimsRepo.save(c);

    await pool.query(
      `UPDATE insurance.claims
          SET dian_invoice = jsonb_set(dian_invoice, '{totalInvoiceCop}', '400000.5')
        WHERE id = $1`,
      [c.id],
    );

    const leido = await claimsRepo.findById(c.id);
    expect(leido).toBeTruthy();
    expect(leido!.dianInvoice.totalInvoiceCop).toBe(400_001n);
    await expect(claimsRepo.findAll()).resolves.toHaveLength(1);
  });

  it('los montos en columna vuelven como bigint por los cinco caminos de lectura', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const c = siniestro(policy.id, policy.quoteNumber);
    await claimsRepo.save(c);

    for (const leido of [
      await claimsRepo.findById(c.id),
      await claimsRepo.findByClaimNumber(c.claimNumber),
      await claimsRepo.findByCufe(c.dianInvoice.dianCufe),
      (await claimsRepo.findByPolicyId(policy.id))[0],
      (await claimsRepo.findAll())[0],
    ]) {
      expect(typeof leido!.eligibleExpensesCop).toBe('bigint');
      expect(typeof leido!.deductibleCop).toBe('bigint');
      expect(typeof leido!.netReimbursementCop).toBe('bigint');
      expect(typeof leido!.stpEvaluation.tierLimitCop).toBe('bigint');
      expect(() => addCop(leido!.netReimbursementCop, leido!.deductibleCop)).not.toThrow();
    }
  });

  // -------------------------------------------------- Ley 1801: inevadible

  it('la base RECHAZA despojar a un ROTTWEILER de la RCE de Ley 1801', async () => {
    // `CLAUDE.md` dice que el amparo obligatorio es inevadible por diseño. Lo
    // era en el motor de cálculo, pero el esquema aceptaba sin protestar una
    // actualización de `coverages` que lo quitara.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    expect(policy.coverages.some((c) => c.code === 'CIVIL_LIABILITY_1801')).toBe(true);

    const sinRce = {
      ...policy,
      coverages: policy.coverages.filter((c) => c.code !== 'CIVIL_LIABILITY_1801'),
    };
    await expect(policiesRepo.update(sinRce)).rejects.toThrow(/Ley 1801/i);

    const leida = await policiesRepo.findById(policy.id);
    expect(leida!.coverages.some((c) => c.code === 'CIVIL_LIABILITY_1801')).toBe(true);
  });

  it('la base RECHAZA dejar el amparo de Ley 1801 en cero o con copago', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    const enCero = {
      ...policy,
      coverages: policy.coverages.map((c) =>
        c.code === 'CIVIL_LIABILITY_1801' ? { ...c, annualLimitCop: toCop(0) } : c,
      ),
    };
    await expect(policiesRepo.update(enCero)).rejects.toThrow(/mínimo legal/i);

    const conCopago = {
      ...policy,
      coverages: policy.coverages.map((c) =>
        c.code === 'CIVIL_LIABILITY_1801' ? { ...c, deductiblePercentage: 0.2 } : c,
      ),
    };
    await expect(policiesRepo.update(conCopago)).rejects.toThrow(/copago/i);
  });

  it('una raza sin manejo especial no queda obligada al amparo', async () => {
    const q = await cotizar({ breedCode: 'MIXED_BREED_DOG', petName: 'Nube' });
    const { policy } = await emitir(q.id);
    const sinRce = {
      ...policy,
      coverages: policy.coverages.filter((c) => c.code !== 'CIVIL_LIABILITY_1801'),
    };
    await expect(policiesRepo.update(sinRce)).resolves.toBeTruthy();
  });

  // ------------------------------------------- lo que un update sí actualiza

  it('un cambio de cuota se guarda de verdad', async () => {
    // El `ON CONFLICT` no incluía las primas: el método devolvía el `RETURNING`
    // y el llamador creía haber guardado.
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    await policiesRepo.update({ ...policy, monthlyPremiumCop: toCop(999_999) });
    const leida = await policiesRepo.findById(policy.id);
    expect(leida!.monthlyPremiumCop).toBe(toCop(999_999));
  });

  it('corregir el correo del titular se guarda de verdad', async () => {
    // Es la vía por la que se entrega el certificado de la póliza: una
    // corrección que no se guarda deja al titular sin su contrato.
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    await policiesRepo.update({
      ...policy,
      customer: { ...policy.customer, email: 'correo.corregido@ejemplo.co' },
    });
    const leida = await policiesRepo.findById(policy.id);
    expect(leida!.customer.email).toBe('correo.corregido@ejemplo.co');
  });

  it('los add-ons y el pricing_result de una cotización se mueven juntos', async () => {
    const q = await cotizar();
    const original = q.pricingResult!.totalMonthlyPremiumCop;

    const recotizado = await cotizar({
      selectedAddonKeys: ['COMMON_ILLNESSES', 'TELEMEDICINE'],
    });
    expect(recotizado.pricingResult!.totalMonthlyPremiumCop).not.toBe(original);

    await quotesRepo.update({
      ...q,
      selectedAddonKeys: ['COMMON_ILLNESSES', 'TELEMEDICINE'],
      pricingResult: recotizado.pricingResult,
    });

    const leida = await quotesRepo.findById(q.id);
    expect(leida!.selectedAddonKeys).toContain('TELEMEDICINE');
    expect(leida!.pricingResult!.totalMonthlyPremiumCop).toBe(
      recotizado.pricingResult!.totalMonthlyPremiumCop,
    );
  });

  it('un update sobre una fila ausente falla en vez de convertirse en insert', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    await expect(
      policiesRepo.update({ ...policy, id: randomUUID() }),
    ).rejects.toThrow(/No existe la póliza/);
  });

  it('un save con id repetido falla en vez de actualizar en silencio', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    await expect(policiesRepo.save(policy)).rejects.toThrow(/duplicate|unique|pkey/i);
  });

  // --------------------------------- estados y rangos legítimos del dominio

  it('SUSPENDED es un estado admisible en la base', async () => {
    // Es un `PolicyStatus` declarado del dominio. El primer flujo de suspensión
    // por impago iba a chocar contra un CHECK que no lo contemplaba.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    await expect(policiesRepo.update({ ...policy, status: 'SUSPENDED' })).resolves.toBeTruthy();
  });

  it('una edad de 2 y de 144 meses exactos se persiste', async () => {
    for (const edad of [2, 144]) {
      const q = await cotizar({ ageInMonths: edad });
      expect(q.status).toBe('OFFERED');
      expect((await quotesRepo.findById(q.id))!.petData.ageInMonths).toBe(edad);
    }
  });

  it('los tres deducibles legítimos se persisten', async () => {
    for (const d of [0.1, 0.15, 0.2]) {
      const q = await cotizar({ deductiblePercentage: d as never });
      expect((await quotesRepo.findById(q.id))!.selectedDeductiblePercentage).toBe(d);
    }
  });

  it('una póliza cancelada se persiste con su motivo y fecha', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    await policiesRepo.update({
      ...policy,
      status: 'CANCELLED',
      cancellationReason: 'Solicitud del tomador',
      cancelledAt: new Date().toISOString(),
    });
    const leida = await policiesRepo.findById(policy.id);
    expect(leida!.status).toBe('CANCELLED');
    expect(leida!.cancellationReason).toBe('Solicitud del tomador');
  });

  it('un siniestro con reembolso IGUAL al gasto elegible se acepta', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const c = siniestro(policy.id, policy.quoteNumber);
    c.netReimbursementCop = c.eligibleExpensesCop;
    await expect(claimsRepo.save(c)).resolves.toBeTruthy();
  });

  // ------------------------------------ Ley 1581: derecho de supresión

  it('una cotización sin póliza se borra por completo', async () => {
    // No hay deber legal ni contractual de conservarla, así que el derecho de
    // supresión se ejerce borrando la fila.
    const q = await cotizar();
    await expect(quotesRepo.suprimirDatosPersonales(q.id)).resolves.toBe('BORRADA');
    await expect(quotesRepo.findById(q.id)).resolves.toBeNull();
  });

  it('una cotización que ya produjo póliza no se borra: la supresión va por la póliza', async () => {
    const q = await cotizar();
    await emitir(q.id);
    await expect(quotesRepo.suprimirDatosPersonales(q.id)).resolves.toBe('TIENE_POLIZA');
    await expect(quotesRepo.findById(q.id)).resolves.toBeTruthy();
  });

  it('la póliza se anonimiza conservando su valor actuarial y contable', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const antes = await policiesRepo.findById(policy.id);

    await expect(policiesRepo.suprimirDatosPersonales(policy.id)).resolves.toBe(true);
    const despues = await policiesRepo.findById(policy.id);

    // Ya no identifica a nadie.
    expect(despues!.customer.email).not.toBe('ana.rce@ejemplo.co');
    expect(despues!.customer.fullName).not.toContain('Ana');
    expect(despues!.customer.phone).toBeUndefined();
    expect(despues!.customer.nationalId).toBeUndefined();

    // Y conserva todo lo que hay deber de conservar.
    expect(despues!.monthlyPremiumCop).toBe(antes!.monthlyPremiumCop);
    expect(despues!.annualPremiumCop).toBe(antes!.annualPremiumCop);
    expect(despues!.coverages).toHaveLength(antes!.coverages.length);
    expect(despues!.quoteNumber).toBe(antes!.quoteNumber);
  });

  it('la llave Bre-B del siniestro se puede suprimir porque está en columnas', async () => {
    // Su valor es una cédula, un teléfono o un correo del titular. Dentro del
    // `jsonb` de la factura no se habría podido borrar sin romper el documento
    // congelado.
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const c = siniestro(policy.id, policy.quoteNumber);
    await claimsRepo.save(c);

    expect((await claimsRepo.findById(c.id))!.breBKey.value).toBe('3001234567');
    await expect(claimsRepo.suprimirDatosPersonales(policy.id)).resolves.toBe(1);

    const { rows } = await pool.query<{ bre_b_key_value: string | null }>(
      'SELECT bre_b_key_value FROM insurance.claims WHERE id = $1',
      [c.id],
    );
    expect(rows[0].bre_b_key_value).toBeNull();

    // Y el soporte contable sigue completo.
    const leido = await claimsRepo.findById(c.id);
    expect(leido!.netReimbursementCop).toBe(c.netReimbursementCop);
    expect(leido!.dianInvoice.invoiceNumber).toBe('FE-8891');
  });

  // ------------------------------------------------ fechas y lecturas varias

  it('expiresAt son exactamente 15 días sin corrimiento por zona horaria', async () => {
    const q = await cotizar();
    const leida = await quotesRepo.findById(q.id);
    expect(leida!.expiresAt).toBe(q.expiresAt);
    const dias =
      (new Date(leida!.expiresAt).getTime() - new Date(leida!.createdAt).getTime()) / 86_400_000;
    expect(dias).toBe(15);
  });

  it('la vigencia termina al cierre del día en Colombia, no a las 6:59 p. m.', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);
    const activa = await policies.activatePolicy(policy.id, 'tx_test');

    const fin = new Date(activa.expirationDate!);
    // 23:59:59 en Colombia (UTC-5) son las 04:59:59 UTC del día siguiente.
    expect(fin.getUTCHours()).toBe(4);
    expect(fin.getUTCMinutes()).toBe(59);
    expect(fin.getUTCSeconds()).toBe(59);

    // Y se relee igual desde la base.
    const leida = await policiesRepo.findById(policy.id);
    expect(leida!.expirationDate).toBe(activa.expirationDate);
  });

  it('findVencidasActivas solo devuelve ACTIVE con vigencia pasada', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    const ayer = new Date(Date.now() - 86_400_000).toISOString();
    await policiesRepo.update({
      ...policy,
      status: 'ACTIVE',
      policyNumber: 'MTO-PET-2026-000001',
      effectiveDate: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      expirationDate: ayer,
      policyCertificateHash: 'a'.repeat(64),
    });

    const vencidas = await policiesRepo.findVencidasActivas(new Date());
    expect(vencidas.map((p) => p.id)).toContain(policy.id);
    for (const v of vencidas) {
      expect(typeof v.monthlyPremiumCop).toBe('bigint');
      expect(new Date(v.expirationDate!).getTime()).toBeLessThan(Date.now());
    }
  });

  it('todos los caminos de lectura de pólizas devuelven bigint y aguantan addCop', async () => {
    const q = await cotizar();
    const { policy } = await emitir(q.id);

    for (const leida of [
      await policiesRepo.findById(policy.id),
      await policiesRepo.findByQuoteId(q.id),
      (await policiesRepo.findAll())[0],
    ]) {
      expect(typeof leida!.monthlyPremiumCop).toBe('bigint');
      expect(typeof leida!.annualPremiumCop).toBe('bigint');
      expect(() => addCop(leida!.monthlyPremiumCop, leida!.annualPremiumCop)).not.toThrow();
      for (const c of leida!.coverages) {
        expect(typeof c.annualLimitCop).toBe('bigint');
      }
    }
  });

  it('totalPrimaMensualOfrecida suma en bigint y coincide con las primas ofrecidas', async () => {
    const a = await cotizar();
    const b = await cotizar({ breedCode: 'MIXED_BREED_DOG' });
    const total = await quotesRepo.totalPrimaMensualOfrecida();
    expect(typeof total).toBe('bigint');
    expect(total).toBe(
      addCop(a.pricingResult!.totalMonthlyPremiumCop, b.pricingResult!.totalMonthlyPremiumCop),
    );
  });
});
