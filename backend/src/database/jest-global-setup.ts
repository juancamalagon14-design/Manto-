import { Pool } from 'pg';
import { aplicarMigraciones } from './database.module';

/**
 * Deja la base lista antes de que corra cualquier suite.
 *
 * Las pruebas de persistencia creaban su propio `Pool` y daban por hecho que el
 * esquema `insurance` ya existía, así que solo pasaban si alguien había
 * arrancado la aplicación antes contra esa misma base. Contra una base recién
 * creada —lo que hace un pipeline de integración, y lo que crea
 * `docker compose up`— fallaban las veinte con `relation "quotes" does not
 * exist`. El «145 en verde» era condicional y no reproducible.
 *
 * Sin `DATABASE_URL` no hay nada que preparar: las suites de persistencia se
 * saltan solas y las unitarias no tocan la base.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  const pool = new Pool({ connectionString: url });
  try {
    await aplicarMigraciones(pool);
  } finally {
    await pool.end();
  }
}
