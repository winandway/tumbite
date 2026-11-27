import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { asegurarEsquema } from './esquema';
import { INDICES_RETIRADOS } from './indicesRetirados';
import { crearBasePruebas } from './pruebas/d1';

/**
 * C-INDICES-SIN-USO (26 nov 2026): los índices que ninguna consulta usa no vuelven a la base, se borran
 * de las bases que ya los tienen, y las consultas que parecían necesitarlos siguen yendo por un índice.
 */
const schema = readFileSync(
  fileURLToPath(new URL('../../../schema.sql', import.meta.url).href),
  'utf8',
);
const esquemaTs = readFileSync(
  fileURLToPath(new URL('./esquema.ts', import.meta.url).href),
  'utf8',
);

async function indices(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

async function plan(db: D1Database, sql: string): Promise<string> {
  const { results } = await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all<{ detail: string }>();
  return results.map((r) => r.detail).join(' | ');
}

describe('C-INDICES-SIN-USO', () => {
  it('schema.sql y la migración ya no crean ninguno de los retirados', () => {
    const creados = (texto: string) =>
      [...texto.matchAll(/INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)/gi)].map((m) => m[1]);
    for (const n of INDICES_RETIRADOS) {
      expect(creados(schema)).not.toContain(n);
      expect(creados(esquemaTs)).not.toContain(n);
    }
  });

  it('una base que todavía los tiene (producción hoy) queda sin ellos al arrancar', async () => {
    const db = crearBasePruebas();
    await db.batch([
      db.prepare('CREATE INDEX IF NOT EXISTS pedidos_sesion ON pedidos(stripe_sesion)'),
      db.prepare(
        'CREATE INDEX IF NOT EXISTS miembros_restaurante_usuario ON miembros_restaurante(usuario_id)',
      ),
      db.prepare(
        'CREATE INDEX IF NOT EXISTS invitaciones_flota_correo ON invitaciones_flota(correo_canonico, estado)',
      ),
    ]);
    expect(await indices(db)).toContain('pedidos_sesion');
    await asegurarEsquema(db, 'produccion');
    const quedan = await indices(db);
    for (const n of INDICES_RETIRADOS) expect(quedan).not.toContain(n);
  });

  it('las consultas de esas tablas siguen yendo por un índice (nada quedó recorriendo la tabla entera)', async () => {
    const db = crearBasePruebas();
    await asegurarEsquema(db, 'produccion');
    expect(
      await plan(db, 'SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?'),
    ).toMatch(/USING (COVERING )?INDEX miembros_restaurante_una_persona/);
    expect(
      await plan(db, 'SELECT id FROM catalogo_productos WHERE comercio_id = ? AND sku = ?'),
    ).toMatch(/USING (COVERING )?INDEX/);
    expect(
      await plan(
        db,
        "SELECT id FROM invitaciones_flota WHERE restaurante_id = ? AND estado = 'pendiente'",
      ),
    ).toMatch(/USING (COVERING )?INDEX invitaciones_flota_restaurante/);
  });
});
