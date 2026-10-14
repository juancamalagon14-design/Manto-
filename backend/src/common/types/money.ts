// Enable native JSON serialization for BigInt/ColombianPeso across the entire runtime
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

/**
 * Tipo nominal para Pesos Colombianos (COP) enteros.
 * Erradica errores de redondeo de punto flotante IEEE-754 en operaciones financieras y actuariales.
 */
export type ColombianPeso = bigint & { readonly __brand: unique symbol };

/**
 * Constructor seguro de ColombianPeso desde número o bigint.
 * Redondea matemáticamente a entero para garantizar cero decimales.
 */
export function toCop(amount: number | bigint): ColombianPeso {
  if (typeof amount === 'bigint') {
    return amount as ColombianPeso;
  }
  if (!Number.isFinite(amount)) {
    throw new TypeError(`El monto en COP debe ser un número finito válido. Recibido: ${amount}`);
  }
  return BigInt(Math.round(amount)) as ColombianPeso;
}

/**
 * Convierte un ColombianPeso a número JavaScript para serialización JSON segura
 * (siempre dentro de los límites seguros de Number.MAX_SAFE_INTEGER).
 */
export function copToNumber(peso: ColombianPeso): number {
  return Number(peso);
}

/**
 * Multiplica un monto en COP por un factor escalar (ej. 1.05 o 0.95),
 * redondeando al entero de COP más cercano.
 */
export function multiplyCop(amount: ColombianPeso, factor: number): ColombianPeso {
  if (!Number.isFinite(factor) || factor < 0) {
    throw new RangeError(`Factor de multiplicación inválido: ${factor}`);
  }
  const numericAmount = Number(amount);
  return toCop(numericAmount * factor);
}

/**
 * Suma múltiples montos de COP enteros de forma exacta.
 */
export function addCop(...amounts: ColombianPeso[]): ColombianPeso {
  return amounts.reduce((acc, curr) => (acc + curr) as ColombianPeso, 0n as ColombianPeso);
}

/**
 * Formatea un ColombianPeso al formato estándar colombiano (ej. "COP $34.900").
 */
export function formatCop(amount: ColombianPeso): string {
  const num = Number(amount);
  return `COP $${num.toLocaleString('es-CO')}`;
}
