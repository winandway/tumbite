import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reiniciarEsquema } from './esquema';
import { OCUPACION_DDL, RUTAS_FLEX_DDL, rehacerFlex } from './esquemaFlex';
import { mundo } from './pruebas/ayuda';

/**
 * C-FLEX-OCUPACION (Flex, Fase 2). conductor_ocupacion y rutas_flex se rehacen al arrancar si vienen
 * de antes, SIN perder filas, y los disparadores y vistas que las usan vuelven a existir.
 */
const esquema = readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
const bloque = (nombre: string) => {
  const i = esquema.indexOf(`CREATE TABLE IF NOT EXISTS ${nombre} (`);
  return esquema.slice(i, esquema.indexOf(');', i) + 1);
};

describe('esquema de Flex, Fase 2 (C-FLEX-OCUPACION)', () => {
  it('las definiciones del código son las de schema.sql', () => {
    expect(bloque('conductor_ocupacion')).toBe(OCUPACION_DDL);
    expect(bloque('rutas_flex')).toBe(RUTAS_FLEX_DDL);
  });

  it('una base con las tablas viejas se rehace sola al arrancar, conserva las filas y los disparadores', async () => {
    const m = mundo();
    const cli = await m.cuenta('cliente');
    const rep = await m.cuenta('repartidor');
    // Formas viejas: la ocupación sin ruta_flex (con un repartidor ocupado en comida) y la ruta de la Fase 1.
    await m.DB.batch([
      m.DB.prepare('PRAGMA defer_foreign_keys = ON'),
      m.DB.prepare('DROP VIEW IF EXISTS inconsistencias_operaciones'),
      m.DB.prepare('DROP VIEW IF EXISTS inconsistencias_operaciones_ocupacion'),
      m.DB.prepare('DROP TABLE conductor_ocupacion'),
      m.DB.prepare(`CREATE TABLE conductor_ocupacion (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'operacion')),
  operacion_id TEXT REFERENCES operaciones(id),
  pedidos INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((tipo = 'comida' AND operacion_id IS NULL AND pedidos >= 1)
      OR (tipo = 'operacion' AND operacion_id IS NOT NULL AND pedidos = 0))
)`),
      m.DB.prepare(
        "INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos) VALUES (?, 'comida', 2)",
      ).bind(rep.id),
      m.DB.prepare(
        "INSERT INTO empresas (id, nombre, pais, moneda, dueno_id) VALUES ('e1', 'Vieja', 'US', 'USD', ?)",
      ).bind(cli.id),
      m.DB.prepare('DROP TABLE rutas_flex'),
      m.DB.prepare(`CREATE TABLE rutas_flex (
  id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES empresas(id), centro_id TEXT, lote_id TEXT,
  nombre TEXT NOT NULL DEFAULT '', conductor_id TEXT, vehiculo_id TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'lista', 'asignada', 'en_curso', 'terminada', 'cancelada')),
  bloque_desde TEXT, bloque_hasta TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')), actualizado_en TEXT NOT NULL DEFAULT (datetime('now')))`),
      m.DB.prepare(
        "INSERT INTO rutas_flex (id, empresa_id, nombre, estado) VALUES ('r1', 'e1', 'Lunes', 'lista'), ('r2', 'e1', 'Vieja', 'cancelada')",
      ),
    ]);
    // La migración conserva las filas tal cual (después, el cuadre de la Fase 3 las ajusta a los pedidos reales).
    expect(await rehacerFlex(m.DB)).toEqual({ rutas: true, ocupacion: true });
    const oc = await m.DB.prepare(
      'SELECT conductor_id, tipo, pedidos, ruta_id FROM conductor_ocupacion',
    ).all();
    expect(oc.results).toEqual([
      { conductor_id: rep.id, tipo: 'comida', pedidos: 2, ruta_id: null },
    ]);
    expect(await rehacerFlex(m.DB)).toEqual({ rutas: false, ocupacion: false }); // idempotente
    reiniciarEsquema();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.esquema).toBe('ok');
    const rutas = await m.DB.prepare('SELECT id, estado, nombre FROM rutas_flex ORDER BY id').all();
    expect(rutas.results).toEqual([
      { id: 'r1', estado: 'borrador', nombre: 'Lunes' },
      { id: 'r2', estado: 'cancelada', nombre: 'Vieja' },
    ]);
    const objetos = await m.DB.prepare(
      "SELECT name FROM sqlite_master WHERE name IN ('inconsistencias_operaciones', 'pedidos_ocupa_conductor', 'rutas_flex_ocupa_conductor', 'rutas_flex_transicion_valida', 'conductor_ocupacion_ruta')",
    ).all<{ name: string }>();
    expect(objetos.results.map((o) => o.name).sort()).toEqual([
      'conductor_ocupacion_ruta',
      'inconsistencias_operaciones',
      'pedidos_ocupa_conductor',
      'rutas_flex_ocupa_conductor',
      'rutas_flex_transicion_valida',
    ]);
    // La tabla nueva exige la forma correcta: una ocupación de ruta sin ruta no entra.
    await expect(
      m.DB.prepare("INSERT INTO conductor_ocupacion (conductor_id, tipo) VALUES (?, 'ruta_flex')")
        .bind(rep.id)
        .run(),
    ).rejects.toThrow();
  });
});
