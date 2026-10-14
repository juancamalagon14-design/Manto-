import { addCop, copToNumber, formatCop, multiplyCop, toCop } from './money';

describe('ColombianPeso & Money Utilities (Doctrina Cero Flotantes)', () => {
  describe('toCop', () => {
    it('debe construir un ColombianPeso a partir de un entero', () => {
      const cop = toCop(35000);
      expect(typeof cop).toBe('bigint');
      expect(cop).toBe(35000n);
    });

    it('debe redondear matemáticamente cualquier valor con punto flotante a entero estricto', () => {
      const cop1 = toCop(34900.49);
      expect(cop1).toBe(34900n);

      const cop2 = toCop(34900.51);
      expect(cop2).toBe(34901n);
    });

    it('debe preservar el valor si ya es un bigint', () => {
      const bigVal = 100000n;
      const cop = toCop(bigVal);
      expect(cop).toBe(100000n);
    });

    it('debe arrojar TypeError ante valores no finitos (NaN o Infinity)', () => {
      expect(() => toCop(NaN)).toThrow(TypeError);
      expect(() => toCop(Infinity)).toThrow(TypeError);
      expect(() => toCop(-Infinity)).toThrow(TypeError);
    });
  });

  describe('copToNumber', () => {
    it('debe convertir ColombianPeso a número JavaScript de forma segura', () => {
      const cop = toCop(87545250);
      const num = copToNumber(cop);
      expect(typeof num).toBe('number');
      expect(num).toBe(87545250);
    });
  });

  describe('multiplyCop', () => {
    it('debe multiplicar exactamente por un factor escalar y redondear a entero', () => {
      const base = toCop(30000);
      // 30.000 * 1.05 = 31.500
      expect(multiplyCop(base, 1.05)).toBe(31500n);

      // 30.000 * 0.88 = 26.400
      expect(multiplyCop(base, 0.88)).toBe(26400n);

      // 30.000 * 1.35 = 40.500
      expect(multiplyCop(base, 1.35)).toBe(40500n);
    });

    it('debe rechazar factores negativos o no finitos', () => {
      const base = toCop(30000);
      expect(() => multiplyCop(base, -0.5)).toThrow(RangeError);
      expect(() => multiplyCop(base, NaN)).toThrow(RangeError);
      expect(() => multiplyCop(base, Infinity)).toThrow(RangeError);
    });
  });

  describe('addCop', () => {
    it('debe sumar múltiples montos en COP con precisión entera exacta', () => {
      const c1 = toCop(30000);
      const c2 = toCop(24900);
      const c3 = toCop(15000);
      const sum = addCop(c1, c2, c3);

      expect(sum).toBe(69900n);
      expect(typeof sum).toBe('bigint');
    });

    it('debe retornar 0n si no se pasan argumentos', () => {
      expect(addCop()).toBe(0n);
    });
  });

  describe('formatCop', () => {
    it('debe formatear a formato estándar colombiano COP', () => {
      const cop = toCop(87545250);
      const formatted = formatCop(cop);
      expect(formatted).toContain('COP $');
      expect(formatted).toMatch(/87[\.,]545[\.,]250/);
    });
  });

  describe('JSON Serialization', () => {
    it('debe serializar BigInt de manera transparente en JSON.stringify', () => {
      const obj = {
        amountCop: toCop(200000),
        description: 'Umbral Fast-Track Bre-B',
      };
      const jsonStr = JSON.stringify(obj);
      expect(jsonStr).toBe('{"amountCop":200000,"description":"Umbral Fast-Track Bre-B"}');
    });
  });
});
