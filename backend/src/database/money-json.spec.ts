import { copDesdeColumna, reviveMoney, serializeMoney } from './money-json';
import { addCop, ColombianPeso, toCop } from '../common/types/money';

/**
 * El puente entre `ColombianPeso` (un `bigint`) y `jsonb` (donde `JSON.parse`
 * devuelve `number`). Si este puente falla, el dominio recibe `number` donde
 * espera `bigint` y la primera suma lanza «Cannot mix BigInt and other types».
 */
describe('Serialización de dinero hacia y desde jsonb', () => {
  it('un monto vuelve idéntico después de ir y volver', () => {
    const original = { totalMonthlyPremiumCop: toCop(86_033) };
    const vuelta = reviveMoney<typeof original>(JSON.parse(serializeMoney(original)));
    expect(vuelta.totalMonthlyPremiumCop).toBe(original.totalMonthlyPremiumCop);
    expect(typeof vuelta.totalMonthlyPremiumCop).toBe('bigint');
  });

  it('conserva el valor exacto por encima de 2^53', () => {
    // `Number()` perdía el último dígito, que es el mismo motivo por el que las
    // columnas se escriben con `String(total)`. El monto mayor del dominio hoy
    // son 50 SMLMV ($87.545.250), muy por debajo; el criterio no puede depender
    // de eso.
    const grande = 9_007_199_254_740_993n as ColombianPeso;
    const vuelta = reviveMoney<{ xCop: ColombianPeso }>(
      JSON.parse(serializeMoney({ xCop: grande })),
    );
    expect(vuelta.xCop).toBe(grande);
  });

  it('revive el dinero anidado en arreglos y objetos', () => {
    const doc = {
      coverages: [{ code: 'A', annualLimitCop: toCop(3_500_000) }],
      appliedFactors: { basePremiumCop: toCop(30_000) },
    };
    const vuelta = reviveMoney<typeof doc>(JSON.parse(serializeMoney(doc)));
    expect(() =>
      addCop(vuelta.coverages[0].annualLimitCop, vuelta.appliedFactors.basePremiumCop),
    ).not.toThrow();
    expect(typeof vuelta.coverages[0].annualLimitCop).toBe('bigint');
  });

  it('no toca lo que no es dinero', () => {
    const doc = { ocrConfidence: 0.97, fraudRiskScore: 0.4, petName: 'Nala' };
    const vuelta = reviveMoney<typeof doc>(JSON.parse(serializeMoney(doc)));
    expect(vuelta.ocrConfidence).toBe(0.97);
    expect(vuelta.fraudRiskScore).toBe(0.4);
    expect(vuelta.petName).toBe('Nala');
  });

  it('un decimal ya escrito en la base se LEE redondeado, no lanza', () => {
    // Lanzar al leer no evitaba nada: la fila ya estaba confirmada. Lo único
    // que lograba era dejar el expediente inaccesible para siempre, y arrastrar
    // a los demás registros en cualquier `findAll`.
    expect(() => reviveMoney<{ xCop: ColombianPeso }>({ xCop: 400_000.5 })).not.toThrow();
    expect(reviveMoney<{ xCop: ColombianPeso }>({ xCop: 400_000.5 }).xCop).toBe(400_001n);
  });

  it('un bigint devuelto por Postgres como texto se revive', () => {
    expect(reviveMoney<{ xCop: ColombianPeso }>({ xCop: '87545250' }).xCop).toBe(87_545_250n);
  });

  it('copDesdeColumna acepta las tres formas en que pg devuelve un bigint', () => {
    expect(copDesdeColumna('87545250')).toBe(87_545_250n);
    expect(copDesdeColumna(86_033)).toBe(86_033n);
    expect(copDesdeColumna(86_033n)).toBe(86_033n);
    expect(() => copDesdeColumna(null)).toThrow(/nula/i);
  });
});
