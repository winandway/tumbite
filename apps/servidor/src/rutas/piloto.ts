import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { SERVICIOS_PILOTO } from '../esquema';

/**
 * C-PILOTO (30 oct 2026): participantes autorizados del piloto en producción controlada
 * (docs/PLAN-LANZAMIENTO-PILOTO.md). Lo que esté «solo piloto» lo ven y lo usan únicamente ellos.
 * Cada alta y baja queda en piloto_eventos con quién la hizo.
 */
export const piloto = new Hono<{ Bindings: Env; Variables: Variables }>();

export async function esParticipante(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT 1 AS si FROM piloto_participantes WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ si: number }>();
  return Boolean(f);
}

piloto.get('/admin/piloto', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: participantes } = await db
    .prepare(
      `SELECT p.usuario_id AS usuarioId, u.nombre, u.correo, u.rol, p.nota, p.creado_en AS creadoEn
         FROM piloto_participantes p JOIN usuarios u ON u.id = p.usuario_id
        ORDER BY p.creado_en DESC LIMIT 500`,
    )
    .all();
  const { results: eventos } = await db
    .prepare(
      `SELECT e.id, e.usuario_id AS usuarioId, u.nombre, e.accion, e.nota, a.nombre AS autor, e.creado_en AS creadoEn
         FROM piloto_eventos e
         LEFT JOIN usuarios u ON u.id = e.usuario_id
         LEFT JOIN usuarios a ON a.id = e.autor_id
        ORDER BY e.id DESC LIMIT 30`,
    )
    .all();
  return c.json({ participantes, eventos });
});

piloto.post('/admin/piloto', async (c) => {
  const yo = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ correo: z.string().trim().email().max(200), nota: z.string().max(200).default('') }),
  );
  const db = base(c);
  const u = await db
    .prepare('SELECT id FROM usuarios WHERE lower(correo) = lower(?)')
    .bind(d.correo)
    .first<{ id: string }>();
  if (!u)
    throw new ErrorDatos(
      'No hay ninguna cuenta con ese correo. La persona tiene que registrarse primero en la app.',
      'correo',
      404,
    );
  const r = await db
    .prepare(
      'INSERT OR IGNORE INTO piloto_participantes (usuario_id, nota, agregado_por) VALUES (?, ?, ?)',
    )
    .bind(u.id, d.nota, yo.id)
    .run();
  if (r.meta.changes)
    await db
      .prepare(
        "INSERT INTO piloto_eventos (usuario_id, accion, autor_id, nota) VALUES (?, 'alta', ?, ?)",
      )
      .bind(u.id, yo.id, d.nota)
      .run();
  return c.json({ ok: true, usuarioId: u.id, nuevo: Boolean(r.meta.changes) });
});

piloto.delete('/admin/piloto/:usuarioId', async (c) => {
  const yo = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('usuarioId');
  const r = await db
    .prepare('DELETE FROM piloto_participantes WHERE usuario_id = ?')
    .bind(id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa persona no está en el piloto.', undefined, 404);
  await db
    .prepare("INSERT INTO piloto_eventos (usuario_id, accion, autor_id) VALUES (?, 'baja', ?)")
    .bind(id, yo.id)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- C-PILOTO-SERVICIOS

piloto.get('/admin/piloto/servicios', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const ids = [...SERVICIOS_PILOTO];
  const { results: servicios } = await db
    .prepare(
      `SELECT id, nombre_es AS nombreEs, nombre_en AS nombreEn FROM servicios
        WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY orden, id`,
    )
    .bind(...ids)
    .all<{ id: string }>();
  const { results: zonas } = await db
    .prepare('SELECT id, nombre FROM zonas WHERE activa = 1 ORDER BY nombre')
    .all();
  const { results: encendidos } = await db
    .prepare('SELECT servicio_id AS servicio, zona_id AS zona FROM servicios_piloto ORDER BY 1, 2')
    .all();
  return c.json({ servicios, zonas, encendidos });
});

piloto.put('/admin/piloto/servicios', async (c) => {
  const yo = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      servicio: z.string().min(2).max(32),
      zona: z.string().min(2).max(64),
      piloto: z.boolean(),
    }),
  );
  if (!SERVICIOS_PILOTO.has(d.servicio))
    throw new ErrorDatos(
      'Ese servicio no se puede encender en el piloto. Moto y Carro llevan pasajeros y esperan la aprobación legal y el seguro.',
      'servicio',
      409,
    );
  const db = base(c);
  const zona = await db.prepare('SELECT 1 AS si FROM zonas WHERE id = ?').bind(d.zona).first();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  const r = d.piloto
    ? await db
        .prepare('INSERT OR IGNORE INTO servicios_piloto (servicio_id, zona_id) VALUES (?, ?)')
        .bind(d.servicio, d.zona)
        .run()
    : await db
        .prepare('DELETE FROM servicios_piloto WHERE servicio_id = ? AND zona_id = ?')
        .bind(d.servicio, d.zona)
        .run();
  if (r.meta.changes)
    await db
      .prepare(
        'INSERT INTO piloto_eventos (usuario_id, accion, autor_id, nota) VALUES (?, ?, ?, ?)',
      )
      .bind(
        `${d.servicio}:${d.zona}`,
        d.piloto ? 'servicio_on' : 'servicio_off',
        yo.id,
        `${d.servicio} · ${d.zona}`,
      )
      .run();
  return c.json({ ok: true });
});
