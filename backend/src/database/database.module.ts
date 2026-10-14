import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export const PG_POOL = 'PG_POOL';

/**
 * El esquema es una constante, no una variable de entorno.
 *
 * Existió como `DATABASE_SCHEMA` y era dos cosas malas a la vez. Primero, una
 * inyección de SQL: el valor se interpolaba en cinco sentencias
 * (`SET search_path TO ${esquema}`, `CREATE SCHEMA`, los `INSERT` en
 * `schema_migrations`), así que un valor como `insurance; CREATE TABLE …; --`
 * ejecutaba DDL arbitrario. Segundo, una perilla falsa: las migraciones nombran
 * `insurance` explícitamente, de modo que cualquier otro valor dejaba el
 * backend inservible con un error de migración.
 *
 * Los repositorios cualifican las tablas (`insurance.quotes`) en vez de
 * depender de `search_path`, que además se fijaba en un handler asíncrono sin
 * `await` — algo que `pg@9` va a dejar de tolerar.
 */
export const ESQUEMA = 'insurance';

/**
 * true cuando hay una base de datos configurada.
 *
 * Sin configuración el backend sigue arrancando con los repositorios en
 * memoria, que es lo que usan las pruebas unitarias y lo que permite levantar
 * el proyecto recién clonado sin instalar Postgres. Pero en memoria NO es un
 * modo de operación: al reiniciar el proceso se pierden cotizaciones, pólizas
 * y siniestros. Cada módulo lo advierte en el arranque.
 */
export function hayBaseDeDatos(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_HOST);
}

function cadenaDeConexion(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const usuario = encodeURIComponent(process.env.DATABASE_USER || 'manto_app');
  const clave = encodeURIComponent(process.env.DATABASE_PASSWORD || '');
  const host = process.env.DATABASE_HOST || 'localhost';
  const puerto = process.env.DATABASE_PORT || '5432';
  const base = process.env.DATABASE_NAME || 'manto_db';
  return `postgresql://${usuario}:${clave}@${host}:${puerto}/${base}`;
}

/**
 * Conexión a PostgreSQL y aplicación de migraciones.
 *
 * Sin ORM, a propósito. Las entidades del dominio son tipos planos con
 * `ColombianPeso` (un `bigint` con marca nominal); un ORM con decoradores
 * obligaría a reescribirlas y a pelear con ese tipo en cada columna de dinero.
 * SQL explícito en los repositorios es más corto, auditable, y deja ver lo
 * que realmente se guarda — que en un producto de seguros es parte del
 * expediente, no un detalle de implementación.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: async (): Promise<Pool | null> => {
        const logger = new Logger('Database');

        if (!hayBaseDeDatos()) {
          logger.warn(
            'Sin DATABASE_URL ni DATABASE_HOST: se usarán repositorios EN MEMORIA. ' +
              'Todo lo que se emita se perderá al reiniciar el proceso.',
          );
          return null;
        }

        const pool = new Pool({
          connectionString: cadenaDeConexion(),
          max: Number(process.env.DATABASE_POOL_MAX || 10),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 10_000,
          // Azure Database for PostgreSQL exige TLS. En local no hay certificado.
          ssl:
            process.env.DATABASE_SSL === 'true'
              ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
              : undefined,
        });

        pool.on('error', (err) => {
          logger.error(`Error inesperado en el pool de PostgreSQL: ${err.message}`);
        });

        await aplicarMigraciones(pool, logger);
        logger.log(`Conectado a PostgreSQL (esquema ${ESQUEMA})`);
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool | null) {}

  public async onApplicationShutdown(): Promise<void> {
    // Sin cerrar el pool el proceso no termina: quedan sockets abiertos.
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Pool de PostgreSQL cerrado');
    }
  }
}

/**
 * Dónde están los `.sql`.
 *
 * Compilado son `dist/database/migrations` (los copia `nest-cli.json` con
 * `assets`); bajo ts-jest son `src/database/migrations`. En los dos casos es
 * una carpeta `migrations` junto a este archivo, pero si algún empaquetado la
 * deja fuera se busca también desde la raíz del proyecto antes de rendirse.
 */
function carpetaDeMigraciones(): string {
  const junto = path.join(__dirname, 'migrations');
  if (fs.existsSync(junto)) return junto;
  return path.resolve(process.cwd(), 'src', 'database', 'migrations');
}

/**
 * Aplica las migraciones pendientes, en orden y dentro de una transacción
 * cada una. Se registran en `insurance.schema_migrations` para que volver a
 * arrancar no las repita.
 *
 * Se exporta porque las pruebas de persistencia la necesitan: antes creaban un
 * `Pool` crudo y daban por hecho que el esquema existía, así que solo pasaban
 * si alguien había arrancado la aplicación antes contra esa misma base. Contra
 * una base recién creada —lo que hace un pipeline de integración— fallaban las
 * veinte.
 */
export async function aplicarMigraciones(pool: Pool, logger = new Logger('Database')): Promise<void> {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${ESQUEMA}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${ESQUEMA}.schema_migrations (
      nombre      text        PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  const carpeta = carpetaDeMigraciones();
  if (!fs.existsSync(carpeta)) {
    logger.warn(`No se encontró la carpeta de migraciones en ${carpeta}`);
    return;
  }

  const archivos = fs
    .readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query<{ nombre: string }>(
    `SELECT nombre FROM ${ESQUEMA}.schema_migrations`,
  );
  const aplicadas = new Set(rows.map((r) => r.nombre));

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;

    const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query(
        `INSERT INTO ${ESQUEMA}.schema_migrations (nombre) VALUES ($1)`,
        [archivo],
      );
      await cliente.query('COMMIT');
      logger.log(`Migración aplicada: ${archivo}`);
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw new Error(
        `La migración ${archivo} falló y se revirtió: ${(err as Error).message}`,
      );
    } finally {
      cliente.release();
    }
  }
}
