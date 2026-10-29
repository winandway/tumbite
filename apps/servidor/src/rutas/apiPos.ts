import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { exigirMiRestaurante } from './catalogo';
import { aceptarPedido, marcarListo } from './operacion';

/**
 * C-API-POS (29 oct 2026), como las integraciones de DoorDash y Uber Eats: el sistema de punto de
 * venta del restaurante lee sus pedidos y los acepta o marca listos con una llave del restaurante
 * (cabecera x-api-key). La llave la crea y la revoca solo el dueño, se muestra una vez y se guarda
 * solo su huella. Nunca expone la dirección, el teléfono ni el dinero del cliente.
 */
export const apiPos = new Hono<{ Bindings: Env; Variables: Variables }>();

const LIMITE = 120;
const uso = new Map<string, { n: number; desde: number }>();

async function restauranteDeLaLlave(c: Parameters<typeof base>[0]) {
  const llave = c.req.header('x-api-key');
  if (!llave) throw new ErrorDatos('Missing x-api-key header.', undefined, 401);
  const db = base(c);
  const f = await db
    .prepare(
      'SELECT id, restaurante_id FROM claves_restaurante WHERE huella = ? AND revocada_en IS NULL',
    )
    .bind(await sha256(llave))
    .first<{ id: string; restaurante_id: string }>();
  if (!f) throw new ErrorDatos('Invalid API key.', undefined, 401);
  const ahora = Date.now();
  const r = uso.get(f.id);
  if (!r || ahora - r.desde > 60_000) uso.set(f.id, { n: 1, desde: ahora });
  else if (++r.n > LIMITE)
    throw new ErrorDatos('Too many requests. Try again in a minute.', undefined, 429);
  await db
    .prepare("UPDATE claves_restaurante SET usada_en = datetime('now') WHERE id = ?")
    .bind(f.id)
    .run();
  return f.restaurante_id;
}

// ---------- El dueño maneja sus llaves desde el panel ----------

apiPos.get('/mi-restaurante/claves-api', async (c) => {
  const rid = await exigirMiRestaurante(c, 'dueno');
  const { results } = await base(c)
    .prepare(
      'SELECT id, nombre, prefijo, creado_en AS creadoEn, usada_en AS usadaEn, revocada_en AS revocadaEn FROM claves_restaurante WHERE restaurante_id = ? ORDER BY creado_en DESC',
    )
    .bind(rid)
    .all();
  return c.json({ claves: results });
});

apiPos.post('/mi-restaurante/claves-api', async (c) => {
  const rid = await exigirMiRestaurante(c, 'dueno');
  const { nombre } = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(2, { error: 'Ponle un nombre a la llave.' }).max(60),
    }),
  );
  const db = base(c);
  const activas = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM claves_restaurante WHERE restaurante_id = ? AND revocada_en IS NULL',
    )
    .bind(rid)
    .first<{ n: number }>();
  if (Number(activas?.n ?? 0) >= 5)
    throw new ErrorDatos(
      'Ya tienes 5 llaves activas. Revoca una antes de crear otra.',
      undefined,
      409,
    );
  const llave = `dvx_pos_${nuevoToken()}`;
  const id = nuevoId();
  await db
    .prepare(
      'INSERT INTO claves_restaurante (id, restaurante_id, nombre, huella, prefijo, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, rid, nombre, await sha256(llave), llave.slice(0, 12), c.get('usuario')?.id ?? null)
    .run();
  // La única vez que se muestra completa.
  return c.json({ id, llave }, 201);
});

apiPos.post('/mi-restaurante/claves-api/:id/revocar', async (c) => {
  const rid = await exigirMiRestaurante(c, 'dueno');
  const r = await base(c)
    .prepare(
      "UPDATE claves_restaurante SET revocada_en = datetime('now') WHERE id = ? AND restaurante_id = ? AND revocada_en IS NULL",
    )
    .bind(c.req.param('id'), rid)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa llave no existe o ya estaba revocada.', undefined, 404);
  return c.json({ ok: true });
});

// ---------- La API v1 que usa el punto de venta ----------

apiPos.get('/v1/pos/pedidos', async (c) => {
  const rid = await restauranteDeLaLlave(c);
  const { results } = await base(c)
    .prepare(
      `SELECT p.id, p.estado, p.lineas_json, p.notas, p.tiempo_prep_min, p.programado_para, p.creado_en, p.aceptado_en, p.listo_en,
              (SELECT modo FROM preferencias_entrega pe WHERE pe.pedido_id = p.id) AS entrega
         FROM pedidos p WHERE p.restaurante_id = ? AND p.estado IN ('pagado','aceptado','listo','en_camino')
        ORDER BY p.creado_en LIMIT 100`,
    )
    .bind(rid)
    .all<Record<string, unknown>>();
  return c.json({
    orders: results.map((f) => ({
      id: String(f.id),
      status: String(f.estado),
      items: (
        JSON.parse(String(f.lineas_json)) as {
          platoId: string;
          nombreEs: string;
          nombreEn: string;
          cantidad: number;
          opciones?: { id: string; nombreEs: string; nombreEn: string }[];
        }[]
      ).map((l) => ({
        itemId: l.platoId,
        name: l.nombreEn || l.nombreEs,
        nameEs: l.nombreEs,
        quantity: l.cantidad,
        options: (l.opciones ?? []).map((o) => ({ id: o.id, name: o.nombreEn || o.nombreEs })),
      })),
      notes: String(f.notas ?? ''),
      delivery: f.entrega === 'mano' ? 'hand_to_me' : 'door',
      scheduledFor: f.programado_para ?? null,
      prepMinutes: f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
      createdAt: f.creado_en,
      acceptedAt: f.aceptado_en ?? null,
      readyAt: f.listo_en ?? null,
    })),
  });
});

apiPos.post('/v1/pos/pedidos/:id/aceptar', async (c) => {
  const rid = await restauranteDeLaLlave(c);
  const { prepMinutes } = await leerCuerpo(
    c,
    z.object({ prepMinutes: z.number().int().min(5).max(120) }),
  );
  await aceptarPedido(c.env, base(c), c.req.param('id'), rid, prepMinutes);
  return c.json({ ok: true });
});

apiPos.post('/v1/pos/pedidos/:id/listo', async (c) => {
  const rid = await restauranteDeLaLlave(c);
  await marcarListo(c.env, base(c), c.req.param('id'), rid);
  return c.json({ ok: true });
});
