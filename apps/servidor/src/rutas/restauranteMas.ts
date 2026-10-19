import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * El restaurante como los grandes (auditoría final, puntos 19 a 22): reseñas con respuesta,
 * reordenar platos y categorías, festivos y cierres, y varios usuarios con roles.
 */
export const restauranteMas = new Hono<{ Bindings: Env; Variables: Variables }>();

/** El restaurante de esta persona: dueño o miembro del equipo (manager o staff). */
export async function restauranteDe(
  db: D1Database,
  usuarioId: string,
): Promise<{ id: string; rol: 'dueno' | 'manager' | 'staff' } | null> {
  const r = await db
    .prepare(
      `SELECT r.id, CASE WHEN r.dueno_id = ?1 THEN 'dueno' ELSE m.rol END AS rol
         FROM restaurantes r LEFT JOIN miembros_restaurante m ON m.restaurante_id = r.id AND m.usuario_id = ?1
        WHERE r.dueno_id = ?1 OR m.usuario_id = ?1 LIMIT 1`,
    )
    .bind(usuarioId)
    .first<{ id: string; rol: 'dueno' | 'manager' | 'staff' }>();
  return r ?? null;
}

async function mio(
  c: { get: (k: 'usuario') => { id: string; rol: string } | null },
  db: D1Database,
  minimo: 'staff' | 'manager' | 'dueno' = 'staff',
) {
  const u = c.get('usuario');
  if (!u || u.rol !== 'restaurante')
    throw new ErrorDatos('Tu cuenta no tiene permiso para esto.', undefined, 403);
  const r = await restauranteDe(db, u.id);
  if (!r) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  const nivel = new Map([
    ['staff', 0],
    ['manager', 1],
    ['dueno', 2],
  ]);
  if ((nivel.get(r.rol) ?? 0) < (nivel.get(minimo) ?? 0))
    throw new ErrorDatos('Solo el dueño o un manager puede hacer esto.', undefined, 403);
  return { u, ...r };
}

// ───────── Reseñas con respuesta ─────────
restauranteMas.get('/mi-restaurante/resenas', async (c) => {
  const db = base(c);
  const r = await mio(c, db);
  const { results } = await db
    .prepare(
      `SELECT c.pedido_id, c.estrellas_restaurante, c.estrellas_repartidor, c.culpa_restaurante, c.comentario, c.respuesta, c.respondida_en, c.creado_en, u.nombre AS cliente
         FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id JOIN usuarios u ON u.id = p.cliente_id
        WHERE p.restaurante_id = ? ORDER BY c.creado_en DESC LIMIT 200`,
    )
    .bind(r.id)
    .all<Record<string, unknown>>();
  const resumen = await db
    .prepare(
      `SELECT AVG(c.estrellas_restaurante) AS promedio, COUNT(*) AS n, SUM(CASE WHEN c.respuesta IS NOT NULL THEN 1 ELSE 0 END) AS respondidas
         FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id WHERE p.restaurante_id = ?`,
    )
    .bind(r.id)
    .first<{ promedio: number | null; n: number; respondidas: number }>();
  return c.json({
    promedio: resumen?.promedio == null ? null : Math.round(resumen.promedio * 10) / 10,
    total: Number(resumen?.n ?? 0),
    respondidas: Number(resumen?.respondidas ?? 0),
    resenas: results.map((x) => ({
      pedidoId: String(x.pedido_id),
      // Solo el nombre de pila: privacidad del cliente.
      cliente: String(x.cliente ?? '').split(' ')[0],
      estrellas: Number(x.estrellas_restaurante),
      estrellasRepartidor: x.estrellas_repartidor == null ? null : Number(x.estrellas_repartidor),
      culpaRestaurante: Number(x.culpa_restaurante) === 1,
      comentario: String(x.comentario ?? ''),
      respuesta: x.respuesta ? String(x.respuesta) : null,
      respondidaEn: x.respondida_en ? String(x.respondida_en) : null,
      creadoEn: String(x.creado_en),
    })),
  });
});

restauranteMas.post('/mi-restaurante/resenas/:pedidoId/responder', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  const { texto } = await leerCuerpo(c, z.object({ texto: z.string().trim().min(2).max(600) }));
  const ok = await db
    .prepare(
      `UPDATE calificaciones SET respuesta = ?, respondida_en = datetime('now')
        WHERE pedido_id = ? AND pedido_id IN (SELECT id FROM pedidos WHERE restaurante_id = ?)`,
    )
    .bind(texto, c.req.param('pedidoId'), r.id)
    .run();
  if (!ok.meta.changes) throw new ErrorDatos('Esa reseña no existe.', undefined, 404);
  return c.json({ ok: true });
});

// ───────── Orden de platos y categorías ─────────
// Rutas propias (no cuelgan de /platos/:id ni de /categorias para no chocar con las del catálogo).
restauranteMas.put('/mi-restaurante/orden-platos', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  const { ids } = await leerCuerpo(
    c,
    z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }),
  );
  await db.batch(
    ids.map((id, i) =>
      db
        .prepare('UPDATE platos SET orden = ? WHERE id = ? AND restaurante_id = ?')
        .bind(i, id, r.id),
    ),
  );
  return c.json({ ok: true });
});

restauranteMas.put('/mi-restaurante/orden-categorias', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  const { categorias } = await leerCuerpo(
    c,
    z.object({ categorias: z.array(z.string().trim().max(60)).max(50) }),
  );
  await db
    .prepare('UPDATE restaurantes SET categorias_orden = ? WHERE id = ?')
    .bind(JSON.stringify(categorias), r.id)
    .run();
  return c.json({ ok: true, categorias });
});

// ───────── Festivos y cierres ─────────
const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'La fecha tiene que ser AAAA-MM-DD.' });

restauranteMas.get('/mi-restaurante/cierres', async (c) => {
  const db = base(c);
  const r = await mio(c, db);
  const { results } = await db
    .prepare(
      "SELECT id, fecha, motivo FROM cierres_restaurante WHERE restaurante_id = ? AND fecha >= date('now', '-1 day') ORDER BY fecha",
    )
    .bind(r.id)
    .all<{ id: string; fecha: string; motivo: string }>();
  return c.json({ cierres: results });
});

restauranteMas.post('/mi-restaurante/cierres', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  const d = await leerCuerpo(
    c,
    z.object({ fecha: FECHA, motivo: z.string().trim().max(80).default('') }),
  );
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO cierres_restaurante (id, restaurante_id, fecha, motivo) VALUES (?, ?, ?, ?) ON CONFLICT(restaurante_id, fecha) DO UPDATE SET motivo = excluded.motivo',
    )
    .bind(id, r.id, d.fecha, d.motivo)
    .run();
  return c.json({ ok: true }, 201);
});

restauranteMas.delete('/mi-restaurante/cierres/:id', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'manager');
  await db
    .prepare('DELETE FROM cierres_restaurante WHERE id = ? AND restaurante_id = ?')
    .bind(c.req.param('id'), r.id)
    .run();
  return c.json({ ok: true });
});

// ───────── Equipo ─────────
restauranteMas.get('/mi-restaurante/equipo', async (c) => {
  const db = base(c);
  const r = await mio(c, db);
  const { results } = await db
    .prepare(
      `SELECT m.usuario_id, m.rol, m.creado_en, u.nombre, u.correo FROM miembros_restaurante m JOIN usuarios u ON u.id = m.usuario_id WHERE m.restaurante_id = ? ORDER BY m.creado_en`,
    )
    .bind(r.id)
    .all<Record<string, unknown>>();
  return c.json({
    miRol: r.rol,
    equipo: results.map((x) => ({
      usuarioId: String(x.usuario_id),
      nombre: String(x.nombre),
      correo: String(x.correo),
      rol: String(x.rol),
      desde: String(x.creado_en),
    })),
  });
});

/** El dueño agrega a alguien por su correo: la persona ya tiene cuenta de restaurante (creada en el panel) y no tiene restaurante propio. */
restauranteMas.post('/mi-restaurante/equipo', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'dueno');
  const d = await leerCuerpo(
    c,
    z.object({
      correo: z.string().trim().email(),
      rol: z.enum(['manager', 'staff']).default('staff'),
    }),
  );
  const u = await db
    .prepare("SELECT id FROM usuarios WHERE correo = ? AND rol = 'restaurante' AND activo = 1")
    .bind(d.correo)
    .first<{ id: string }>();
  if (!u)
    throw new ErrorDatos(
      'Esa persona todavía no tiene cuenta de restaurante en Tumbite: pídele que se registre en el panel primero.',
      'correo',
      404,
    );
  if (u.id === r.u.id) throw new ErrorDatos('Ya eres el dueño.', 'correo', 409);
  const otro = await restauranteDe(db, u.id);
  if (otro) throw new ErrorDatos('Esa persona ya pertenece a otro restaurante.', 'correo', 409);
  // Una sola sentencia (atómica): solo entra si la persona no es dueña ni miembro de ningún
  // restaurante en ese momento. Dos altas a la vez desde dos restaurantes: solo una gana.
  const alta = await db
    .prepare(
      `INSERT OR IGNORE INTO miembros_restaurante (restaurante_id, usuario_id, rol)
       SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM miembros_restaurante WHERE usuario_id = ?2)
         AND NOT EXISTS (SELECT 1 FROM restaurantes WHERE dueno_id = ?2)`,
    )
    .bind(r.id, u.id, d.rol)
    .run();
  if (!alta.meta.changes)
    throw new ErrorDatos('Esa persona ya pertenece a otro restaurante.', 'correo', 409);
  return c.json({ ok: true }, 201);
});

restauranteMas.delete('/mi-restaurante/equipo/:usuarioId', async (c) => {
  const db = base(c);
  const r = await mio(c, db, 'dueno');
  await db
    .prepare('DELETE FROM miembros_restaurante WHERE restaurante_id = ? AND usuario_id = ?')
    .bind(r.id, c.req.param('usuarioId'))
    .run();
  return c.json({ ok: true });
});
