import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-CUENTA-PRUEBA (21 nov 2026, pedido de Gerencia para la prueba en vivo en Novi) — todos los países.
 *
 * Una sola marca de «cuenta de prueba» (`usuarios.es_prueba`), que pone solo el equipo desde el panel
 * (tres puntos → «Marcar como prueba» / «Quitar marca»), con el antes y el después en la auditoría. La
 * marca sirve para dos cosas:
 * - los servicios encendidos en una ciudad SOLO para pruebas (`servicios_prueba`) los ven y los piden
 *   únicamente estas cuentas; el resto de la ciudad, no;
 * - los listados del panel, los reportes, los conteos y los «registros nuevos» las dejan fuera por defecto.
 */
export const cuentaPrueba = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Fragmento SQL: la cuenta (alias `u` por defecto) NO es de prueba. */
export const sinPrueba = (alias = 'u') => `COALESCE(${alias}.es_prueba, 0) = 0`;

export async function esCuentaPrueba(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT es_prueba FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ es_prueba: number | null }>();
  return Number(f?.es_prueba) === 1;
}

export async function marcarCuentaPrueba(
  db: D1Database,
  d: { usuarioId: string; prueba: boolean; actorId: string },
) {
  const antes = await db
    .prepare('SELECT nombre, rol, es_prueba FROM usuarios WHERE id = ?')
    .bind(d.usuarioId)
    .first<{ nombre: string; rol: string; es_prueba: number | null }>();
  if (!antes) throw new ErrorDatos('Esa cuenta ya no existe.', undefined, 404);
  await db.batch([
    db
      .prepare('UPDATE usuarios SET es_prueba = ? WHERE id = ?')
      .bind(d.prueba ? 1 : 0, d.usuarioId),
    db
      .prepare(
        "INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, 'cuenta_prueba', ?, ?, ?)",
      )
      .bind(
        d.actorId,
        d.usuarioId,
        JSON.stringify({ prueba: Number(antes.es_prueba) === 1 }),
        JSON.stringify({ prueba: d.prueba }),
      ),
  ]);
  return { prueba: d.prueba };
}

cuentaPrueba.post('/admin/usuarios/:id/prueba', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, z.object({ prueba: z.boolean() }));
  const r = await marcarCuentaPrueba(base(c), {
    usuarioId: c.req.param('id'),
    prueba: d.prueba,
    actorId: u.id,
  });
  return c.json({ ok: true, ...r });
});

/** Los servicios encendidos solo para pruebas, por ciudad. */
cuentaPrueba.get('/admin/servicios-prueba', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT p.servicio_id AS servicio, p.zona_id AS zona, z.nombre AS ciudad, p.creado_en AS desde
         FROM servicios_prueba p LEFT JOIN zonas z ON z.id = p.zona_id ORDER BY 1, 2`,
    )
    .all();
  return c.json({ servicios: results });
});

cuentaPrueba.put('/admin/servicios-prueba', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.string().min(1).max(40),
      zona: z.string().min(1).max(64),
      encendido: z.boolean(),
    }),
  );
  const db = base(c);
  const existe = await db
    .prepare(
      'SELECT (SELECT 1 FROM servicios WHERE id = ?) AS s, (SELECT 1 FROM zonas WHERE id = ?) AS z',
    )
    .bind(d.servicio, d.zona)
    .first<{ s: number | null; z: number | null }>();
  if (!existe?.s) throw new ErrorDatos('Ese servicio no existe.', 'servicio', 422);
  if (!existe.z) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 422);
  await db.batch([
    d.encendido
      ? db
          .prepare(
            'INSERT OR IGNORE INTO servicios_prueba (servicio_id, zona_id, creado_por) VALUES (?, ?, ?)',
          )
          .bind(d.servicio, d.zona, u.id)
      : db
          .prepare('DELETE FROM servicios_prueba WHERE servicio_id = ? AND zona_id = ?')
          .bind(d.servicio, d.zona),
    db
      .prepare(
        "INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, 'servicio_prueba', ?, '{}', ?)",
      )
      .bind(u.id, `${d.servicio}:${d.zona}`, JSON.stringify({ encendido: d.encendido })),
  ]);
  return c.json({ ok: true });
});
