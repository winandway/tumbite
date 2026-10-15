import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * Las migraciones M4 y M5 de la Fase 1 (docs/fase-1/) están PREPARADAS, no ejecutadas sobre datos
 * reales. Esta prueba las corre sobre una base de prueba con repartidores «de antes» y comprueba
 * que copian bien, que se pueden repetir sin duplicar y que nadie pierde Comida.
 */
const carpeta = join(__dirname, '..', '..', '..', '..', 'docs', 'fase-1');
const sentencias = (archivo: string) =>
  readFileSync(join(carpeta, archivo), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

async function correr(db: D1Database, archivo: string) {
  for (const s of sentencias(archivo)) await db.prepare(s).run();
}

describe('migraciones preparadas de la Fase 1 (M4 y M5)', () => {
  it('copian los vehículos, habilitan Comida a todos y se pueden repetir sin duplicar', async () => {
    const m = mundo();
    const conCarro = await m.cuenta('repartidor', 'Rep Carro');
    const enBici = await m.cuenta('repartidor', 'Rep Bici');
    const sinPlaca = await m.cuenta('repartidor', 'Rep Moto');
    const repetidoA = await m.cuenta('repartidor', 'Rep A');
    const repetidoB = await m.cuenta('repartidor', 'Rep B');
    const sinVehiculo = await m.cuenta('repartidor', 'Rep Nada');
    const datos: [string, string, string][] = [
      [conCarro.id, 'carro', 'abc 123'],
      [enBici.id, 'bicicleta', ''],
      [sinPlaca.id, 'moto', ''],
      [repetidoA.id, 'carro', 'DUP1'],
      [repetidoB.id, 'moto', 'dup1'],
    ];
    for (const [id, tipo, placa] of datos)
      await m.DB.prepare(
        'INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, placa) VALUES (?, ?, ?)',
      )
        .bind(id, tipo, placa)
        .run();
    await m.DB.prepare("INSERT INTO kyc (usuario_id, estado) VALUES (?, 'aprobado')")
      .bind(conCarro.id)
      .run();

    for (let vez = 0; vez < 2; vez++) {
      await correr(m.DB, 'M4-vehiculos.sql');
      await correr(m.DB, 'M5-comida-y-vehiculo-activo.sql');
    }

    const vehiculos = await m.DB.prepare(
      "SELECT conductor_id, tipo, placa, estado FROM vehiculos WHERE origen = 'migracion' ORDER BY conductor_id",
    ).all<{ conductor_id: string; tipo: string; placa: string; estado: string }>();
    const por = new Map(vehiculos.results.map((v) => [v.conductor_id, v]));
    expect(vehiculos.results).toHaveLength(3); // las dos placas repetidas no se copian
    expect(por.get(conCarro.id)).toMatchObject({ placa: 'ABC 123', estado: 'aprobado' });
    expect(por.get(enBici.id)).toMatchObject({ estado: 'aprobado' });
    expect(por.get(sinPlaca.id)).toMatchObject({ estado: 'registrado' });

    const sinComida = await m.DB.prepare(
      `SELECT COUNT(*) AS n FROM usuarios u WHERE u.rol = 'repartidor' AND NOT EXISTS (
         SELECT 1 FROM habilitaciones h WHERE h.conductor_id = u.id AND h.servicio_id = 'comida' AND h.estado = 'aprobada')`,
    ).first<{ n: number }>();
    expect(sinComida?.n).toBe(0);
    const habs = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM habilitaciones WHERE servicio_id = 'comida'",
    ).first<{ n: number }>();
    expect(habs?.n).toBe(6);

    const activo = await m.DB.prepare(
      'SELECT vehiculo_activo_id AS v FROM repartidores WHERE usuario_id = ?',
    )
      .bind(conCarro.id)
      .first<{ v: string }>();
    expect(activo?.v).toBe(`mig-${conCarro.id}`);
    const kyc = await m.DB.prepare(
      "SELECT estado FROM cumplimientos WHERE conductor_id = ? AND requisito = 'identidad'",
    )
      .bind(conCarro.id)
      .first<{ estado: string }>();
    expect(kyc?.estado).toBe('aprobado');

    // Comida sigue igual para todos, incluido quien no tenía vehículo.
    const r = await m.llamar('GET', '/datos/conductor/servicios', undefined, sinVehiculo.token);
    expect(
      r.datos.servicios.find((s: { servicioId: string }) => s.servicioId === 'comida'),
    ).toMatchObject({ habilitacion: 'aprobada', puedeActivar: true });

    // La verificación es de solo lectura y responde.
    for (const s of sentencias('verificar.sql')) await m.DB.prepare(s).all();
    // La vuelta atrás deja todo como antes de M5 y retira los vehículos copiados.
    await correr(m.DB, 'revertir.sql');
    const quedan = await m.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM habilitaciones WHERE origen = 'migracion') AS h, (SELECT COUNT(*) FROM vehiculos WHERE origen = 'migracion' AND estado != 'retirado') AS v",
    ).first<{ h: number; v: number }>();
    expect(quedan).toEqual({ h: 0, v: 0 });
  });
});
