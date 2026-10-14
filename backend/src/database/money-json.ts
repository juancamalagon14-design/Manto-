import { Logger } from '@nestjs/common';
import { ColombianPeso } from '../common/types/money';

const logger = new Logger('MoneyJson');

/**
 * Revive los montos en pesos al leer un documento de `jsonb`.
 *
 * Aquí está el punto delicado de persistir el snapshot como JSON.
 *
 * `ColombianPeso` es un `bigint` con marca nominal. Al escribir funciona
 * porque `main.ts` le pone un `toJSON` a `BigInt.prototype` y sale como
 * número. Al LEER, `JSON.parse` devuelve `number`, no `bigint`, y el dominio
 * espera `bigint`. Si no se revive:
 *
 *   · `addCop(premio, otro)` lanza «Cannot mix BigInt and other types».
 *   · O peor, si en algún camino se suma con `+` entre números, el cálculo
 *     funciona pero pierde la marca y la garantía de exactitud: exactamente lo
 *     que el tipo nominal existe para evitar.
 *
 * La convención es el sufijo `Cop`, que ya usa todo el dominio
 * (`totalMonthlyPremiumCop`, `annualLimitCop`, `basePremiumCop`…). Se revive
 * por nombre de clave, no por posición, así que un campo nuevo que siga la
 * convención queda cubierto sin tocar esto.
 */

/** Toda clave que termine en `Cop` es dinero. */
const ES_DINERO = /Cop$/;

export function reviveMoney<T>(valor: unknown): T {
  return recorrer(valor, false) as T;
}

function recorrer(valor: unknown, esMonto: boolean): unknown {
  if (valor === null || valor === undefined) return valor;

  if (Array.isArray(valor)) {
    return valor.map((v) => recorrer(v, esMonto));
  }

  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = recorrer(v, ES_DINERO.test(clave));
    }
    return salida;
  }

  if (esMonto) {
    if (typeof valor === 'bigint') return valor;
    if (typeof valor === 'number') {
      if (!Number.isInteger(valor)) {
        /**
         * Aquí NO se lanza, y la razón importa.
         *
         * Lanzar al leer convierte un dato sucio en pérdida de acceso: la fila
         * ya está confirmada en la base, así que la excepción no evita nada y
         * en cambio deja el expediente ilegible para siempre —`findById`,
         * `findByCufe` y hasta `findAll`, que arrastra a todos los demás
         * registros con uno solo malo.
         *
         * Se redondea, se registra, y quien valide entradas es la frontera
         * (`@IsInt` en las DTO), no el lector.
         */
        const redondeado = Math.round(valor);
        logger.warn(
          `Monto en COP no entero recuperado de la base: ${valor}. ` +
            `Se lee como ${redondeado}. La fila quedó escrita con decimales: ` +
            'revisar la validación de la frontera que la admitió.',
        );
        return BigInt(redondeado) as ColombianPeso;
      }
      return BigInt(valor) as ColombianPeso;
    }
    if (typeof valor === 'string' && /^-?\d+$/.test(valor)) {
      // Postgres devuelve bigint como texto cuando el valor excede el entero seguro de JS.
      return BigInt(valor) as ColombianPeso;
    }
  }

  return valor;
}

/**
 * Serializa un documento del dominio para guardarlo en `jsonb`.
 *
 * Los montos se escriben como CADENA de dígitos, no como número JSON, y esa
 * decisión tiene una razón concreta.
 *
 * `JSON.stringify` no sabe serializar `bigint`, y la salida obvia —`Number(v)`—
 * pierde precisión por encima de 2^53. Escribir el dígito exacto tampoco
 * alcanza: quien lee el `jsonb` es `JSON.parse`, que devuelve `number` y
 * vuelve a perderlo. El único ida y vuelta exacto a cualquier magnitud es la
 * cadena, que `reviveMoney` reconoce y convierte de vuelta a `bigint`.
 *
 * Es el mismo criterio que ya se aplicaba a las columnas (`String(total)`, con
 * el comentario de que `Number()` perdería precisión). No puede ser distinto
 * según dónde se guarde el mismo peso.
 *
 * El monto mayor del dominio hoy son 50 SMLMV ($87.545.250), muy por debajo del
 * límite. Esto no se hace porque haga falta hoy, sino porque un documento
 * congelado que sustenta una prima ante la Superintendencia no puede tener una
 * clase de monto que se guarde bien y otra que se guarde «casi».
 *
 * La conversión se hace ANTES de `JSON.stringify`, recorriendo la estructura,
 * y no con un `replacer`. No es un rodeo: `common/types/money.ts` instala un
 * `BigInt.prototype.toJSON` que devuelve `Number(this)` —lo necesita la API
 * para responderle números al frontend— y `JSON.stringify` llama a ese `toJSON`
 * ANTES de pasar el valor al `replacer`. Cualquier `typeof v === 'bigint'`
 * dentro de un `replacer` es código muerto: para cuando se ejecuta, el `bigint`
 * ya se convirtió en número y ya perdió los dígitos. El parche global se queda
 * donde está, pero esta ruta no lo atraviesa.
 */
export function serializeMoney(valor: unknown): string {
  return JSON.stringify(aTextoLosMontos(valor));
}

/** Reemplaza cada `bigint` por su representación decimal exacta. */
function aTextoLosMontos(valor: unknown): unknown {
  if (typeof valor === 'bigint') return valor.toString();
  if (valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(aTextoLosMontos);

  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    salida[clave] = aTextoLosMontos(v);
  }
  return salida;
}

/**
 * Convierte una columna `bigint` de Postgres a `ColombianPeso`.
 *
 * `pg` devuelve los `bigint` como texto a propósito, porque por encima de
 * 2^53 un `number` de JavaScript ya no los representa. Se convierte sin pasar
 * por `Number`.
 */
export function copDesdeColumna(valor: string | number | bigint | null): ColombianPeso {
  if (valor === null) {
    throw new TypeError('Se esperaba un monto en COP y la columna vino nula.');
  }
  if (typeof valor === 'bigint') return valor as ColombianPeso;
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor)) {
      throw new TypeError(`Monto en COP no entero en la base de datos: ${valor}`);
    }
    return BigInt(valor) as ColombianPeso;
  }
  if (!/^-?\d+$/.test(valor)) {
    throw new TypeError(`Monto en COP con formato inesperado: ${valor}`);
  }
  return BigInt(valor) as ColombianPeso;
}
