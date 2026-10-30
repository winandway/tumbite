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

// ---------------------------------------------------------------- C-PILOTO-LIMITES

/** Topes por defecto del piloto: 50 dólares por pedido y 150 por día (se cambian en el superadmin). */
const TOPE_PEDIDO = 5000;
const TOPE_DIA = 15000;

async function leerTopes(db: D1Database) {
  const { results } = await db
    .prepare(
      "SELECT clave, valor FROM config WHERE clave IN ('piloto_tope_pedido', 'piloto_tope_dia')",
    )
    .all<{ clave: string; valor: string }>();
  const v = new Map(results.map((f) => [f.clave, Number(f.valor)]));
  return {
    porPedidoCentavos: v.get('piloto_tope_pedido') ?? TOPE_PEDIDO,
    porDiaCentavos: v.get('piloto_tope_dia') ?? TOPE_DIA,
  };
}

/**
 * Para los participantes del piloto: un error no cuesta más que el tope. Quien no está en el piloto
 * no cambia nada. El día suma los pedidos de hoy que no se cancelaron.
 */
export async function exigirTopePiloto(db: D1Database, usuarioId: string, totalCentavos: number) {
  if (!(await esParticipante(db, usuarioId))) return;
  const t = await leerTopes(db);
  if (totalCentavos > t.porPedidoCentavos)
    throw new ErrorDatos(
      `En el piloto cada pedido puede ser de hasta $${(t.porPedidoCentavos / 100).toFixed(2)}.`,
      'total',
      409,
    );
  const hoy = await db
    .prepare(
      "SELECT COALESCE(SUM(total), 0) AS suma FROM pedidos WHERE cliente_id = ? AND estado != 'cancelado' AND creado_en >= date('now')",
    )
    .bind(usuarioId)
    .first<{ suma: number }>();
  if (Number(hoy?.suma ?? 0) + totalCentavos > t.porDiaCentavos)
    throw new ErrorDatos(
      `En el piloto puedes pedir hasta $${(t.porDiaCentavos / 100).toFixed(2)} por día.`,
      'total',
      409,
    );
}

piloto.get('/admin/piloto/limites', async (c) => {
  exigir(c, 'admin');
  return c.json(await leerTopes(base(c)));
});

piloto.put('/admin/piloto/limites', async (c) => {
  const yo = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      porPedidoCentavos: z.number().int().min(100).max(1_000_000),
      porDiaCentavos: z.number().int().min(100).max(5_000_000),
    }),
  );
  const db = base(c);
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('piloto_tope_pedido', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(String(d.porPedidoCentavos)),
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('piloto_tope_dia', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(String(d.porDiaCentavos)),
    db
      .prepare(
        "INSERT INTO piloto_eventos (usuario_id, accion, autor_id, nota) VALUES ('topes', 'topes', ?, ?)",
      )
      .bind(yo.id, `${d.porPedidoCentavos}/${d.porDiaCentavos}`),
  ]);
  return c.json({ ok: true });
});
