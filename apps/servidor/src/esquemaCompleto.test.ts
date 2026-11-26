import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: módulo de Node sin tipos (el mismo que genera la lista)
import { columnasDelEsquema } from '../../../scripts/generar-columnas.mjs';
import { reiniciarEsquema } from './esquema';
import { COLUMNAS_DEL_ESQUEMA } from './esquemaColumnas';
import { mundo } from './pruebas/ayuda';

/**
 * Candado C-ESQUEMA-COMPLETO (15 oct 2026). Una columna agregada al CREATE de una tabla que ya
 * existe nunca llega a la base (schema.sql solo crea lo que falta). Pasó con evidencias.modo y
 * evidencias.nota: el estado del repartidor y las fotos de entrega fallaban en producción.
 */
describe('el esquema completo existe en la base', () => {
  it('la lista que revisa el servidor es la de schema.sql (regenerar con scripts/generar-columnas.mjs)', () => {
    const esquema = readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
    expect(COLUMNAS_DEL_ESQUEMA).toEqual(columnasDelEsquema(esquema));
  });

  it('una base vieja sin evidencias.modo ni evidencias.nota se repara sola al arrancar', async () => {
    const m = mundo();
    await m.DB.prepare('DROP TABLE evidencias').run();
    await m.DB.prepare(
      `CREATE TABLE evidencias (pedido_id TEXT NOT NULL, tipo TEXT NOT NULL, clave TEXT NOT NULL, lat REAL, lng REAL,
         distancia_m INTEGER, creada_en TEXT NOT NULL DEFAULT (datetime('now')), confirmada_en TEXT, borrada_en TEXT,
         PRIMARY KEY (pedido_id, tipo))`,
    ).run();
    reiniciarEsquema();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.esquema).toBe('ok');
    const cols = await m.DB.prepare("SELECT name FROM pragma_table_info('evidencias')").all<{
      name: string;
    }>();
    expect(cols.results.map((c) => c.name)).toEqual(expect.arrayContaining(['modo', 'nota']));
  });

  it('C-CAMILA-FALLOS: la tabla de gasto de Camila que ya existía recibe sola las columnas de capturas y del resumen de fallos', async () => {
    const m = mundo();
    await m.DB.prepare('ALTER TABLE camila_gasto DROP COLUMN capturas').run();
    await m.DB.prepare('ALTER TABLE camila_gasto DROP COLUMN resumen_fallos').run();
    reiniciarEsquema();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.esquema).toBe('ok');
    const cols = await m.DB.prepare("SELECT name FROM pragma_table_info('camila_gasto')").all<{
      name: string;
    }>();
    expect(cols.results.map((c) => c.name)).toEqual(
      expect.arrayContaining(['capturas', 'resumen_fallos']),
    );
  });

  it('C-REGALO-CONDUCTOR-TOPE-VENCE: el regalo de arranque y sus cargas que ya existían reciben solos el tope, la vigencia y el vencimiento', async () => {
    const m = mundo();
    await m.DB.prepare('DROP TABLE regalo_conductor_nuevo').run();
    await m.DB.prepare(
      `CREATE TABLE regalo_conductor_nuevo (zona_id TEXT PRIMARY KEY, monto INTEGER NOT NULL CHECK (monto > 0),
         presupuesto INTEGER NOT NULL CHECK (presupuesto > 0), activo INTEGER NOT NULL DEFAULT 0,
         actualizado_por TEXT, actualizado_en TEXT NOT NULL DEFAULT (datetime('now')))`,
    ).run();
    await m.DB.prepare('ALTER TABLE cargas_saldo_conductor DROP COLUMN vence_en').run();
    reiniciarEsquema();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.esquema).toBe('ok');
    const cols = await m.DB.prepare(
      "SELECT name FROM pragma_table_info('regalo_conductor_nuevo') UNION ALL SELECT name FROM pragma_table_info('cargas_saldo_conductor')",
    ).all<{ name: string }>();
    expect(cols.results.map((c) => c.name)).toEqual(
      expect.arrayContaining(['tope_diario', 'vigencia_dias', 'encendido_en', 'vence_en']),
    );
  });

  it('si falta una columna del esquema que nadie agrega, la salud lo dice en rojo', async () => {
    const m = mundo();
    await m.DB.prepare('DROP TABLE avisos_pedido').run();
    await m.DB.prepare(
      'CREATE TABLE avisos_pedido (pedido_id TEXT NOT NULL, aviso TEXT NOT NULL)',
    ).run();
    reiniciarEsquema();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.esquema).toBe('error');
  });
});
