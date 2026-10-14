import * as fs from 'fs';
import * as path from 'path';
import { SPECIAL_HANDLING_BREED_CODES } from '../modules/pricing/pricing.constants';

/**
 * La lista de razas de manejo especial de la Ley 1801 de 2016 está en dos
 * sitios a propósito: en el dominio (`pricing.constants.ts`), que calcula, y en
 * la base (`insurance.razas_manejo_especial`), que hace cumplir el amparo
 * obligatorio con un trigger. La base no puede depender de que la aplicación
 * esté correcta para garantizar un mínimo legal.
 *
 * Esta prueba es lo que impide que las dos copias deriven: si alguien añade una
 * raza al registro del dominio sin la migración correspondiente, se pone roja.
 * No necesita base de datos, lee el SQL.
 */
describe('Razas de manejo especial: dominio y base no pueden derivar', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, 'migrations', '001_esquema_inicial.sql'),
    'utf8',
  );

  const razasEnLaBase = (): string[] => {
    const bloque = sql.match(
      /INSERT INTO insurance\.razas_manejo_especial \(breed_code\) VALUES([\s\S]*?);/,
    );
    if (!bloque) throw new Error('No se encontró la siembra de razas en la migración 001.');
    return [...bloque[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  };

  it('la migración siembra exactamente las razas que el dominio marca', () => {
    expect([...razasEnLaBase()].sort()).toEqual([...SPECIAL_HANDLING_BREED_CODES].sort());
  });

  it('el trigger que exige el amparo existe sobre pólizas y sobre cotizaciones', () => {
    expect(sql).toContain('CREATE TRIGGER policies_exigir_rce_ley_1801');
    expect(sql).toContain('CREATE TRIGGER quotes_exigir_rce_ley_1801');
  });

  it('el trigger no compara el monto contra una cifra escrita en SQL', () => {
    // 50 SMLMV cambian cada enero. Una cifra en SQL quedaría desactualizada en
    // silencio, que es peor que no tenerla: el monto lo garantiza el motor, que
    // sí conoce el SMLMV vigente. La base garantiza lo estructural.
    expect(sql).not.toMatch(/87\s*_?545\s*_?250/);
    expect(sql).not.toMatch(/1\s*_?750\s*_?905/);
  });
});
