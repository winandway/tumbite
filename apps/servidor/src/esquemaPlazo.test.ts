import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { DISPARADORES_HABILITACION, rehacerElegibilidad } from './esquemaPlazo';

/**
 * C-PLAZO-PAPELES en la base: las bases que ya existen (producción y pruebas) tienen la vista y los
 * disparadores viejos, que no conocen el plazo ni los requisitos exentos. `CREATE … IF NOT EXISTS`
 * no los reemplaza: esta prueba fija que el arranque los cambia, una sola vez y sin romper nada.
 */
const sqlDe = async (db: D1Database, nombre: string) =>
  (
    await db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').bind(nombre).first<{
      sql: string;
    }>()
  )?.sql ?? '';

describe('C-PLAZO-PAPELES: la base vieja se pone al día al arrancar', () => {
  it('cambia la vista y los dos disparadores viejos, y la segunda vez no toca nada', async () => {
    const m = mundo();
    await m.cuenta('cliente');
    // Una base como la de antes del 19 nov: vista y disparadores sin el plazo.
    await m.DB.batch([
      m.DB.prepare('DROP VIEW conductores_elegibles'),
      m.DB.prepare(
        `CREATE VIEW conductores_elegibles AS SELECT d.usuario_id AS conductor_id, '' AS servicio_id,
           '' AS vehiculo_id, d.zona_id, d.lat, d.lng, d.ubicacion_en, d.puntos FROM repartidores d WHERE 0`,
      ),
      m.DB.prepare('DROP TRIGGER habilitaciones_exigen_requisitos'),
      m.DB.prepare(
        `CREATE TRIGGER habilitaciones_exigen_requisitos BEFORE UPDATE OF estado ON habilitaciones
         WHEN NEW.estado = 'aprobada' AND 0 BEGIN SELECT RAISE(ABORT, 'habilitacion_con_requisitos_faltantes'); END`,
      ),
    ]);
    expect(await rehacerElegibilidad(m.DB)).toBe(true);
    for (const n of [
      'conductores_elegibles',
      'habilitaciones_exigen_requisitos',
      'habilitaciones_exigen_requisitos_alta',
    ]) {
      const sql = await sqlDe(m.DB, n);
      expect(sql, n).toContain('politica_requisitos');
    }
    expect(await sqlDe(m.DB, 'conductores_elegibles')).toContain('plazo_papeles');
    expect(await rehacerElegibilidad(m.DB)).toBe(false);
    // La vista nueva se puede leer.
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM conductores_elegibles').first<{
      n: number;
    }>();
    expect(n?.n).toBe(0);
  });

  it('schema.sql (bases nuevas) y el arranque (bases viejas) crean los mismos disparadores', () => {
    const esquema = readFileSync(
      fileURLToPath(new URL('../../../schema.sql', import.meta.url).href),
      'utf8',
    );
    const plano = (s: string) => s.replace(/\s+/g, ' ').trim();
    for (const d of DISPARADORES_HABILITACION) expect(plano(esquema)).toContain(plano(d));
  });
});
