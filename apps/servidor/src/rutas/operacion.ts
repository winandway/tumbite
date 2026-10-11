import { Hono } from 'hono';
import { z } from 'zod';
import { celdasVecinas, distanciaKm, geohash, nivelDe } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { crearStripe } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';
import { type FilaPedido, aPedido } from './pedidos';
import { zonaPara } from './zonas';
import { anotar, anotarEstado } from '../historial';
import { AVISOS, notificar } from '../notificaciones';
import { formatearDolares } from '@tumbite/compartido';

export const operacion = new Hono<{ Bindings: Env; Variables: Variables }>();

const SEGUNDOS_OFERTA = 60;
const punto = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

// ======================= Restaurante =======================

async function miRestauranteId(c: Ctx): Promise<string> {
  const u = exigir(c, 'restaurante');
  const f = await base(c)
    .prepare('SELECT id FROM restaurantes WHERE dueno_id = ?')
    .bind(u.id)
    .first<{ id: string }>();
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  return f.id;
}

operacion.get('/restaurante/pedidos', async (c) => {
  const rid = await miRestauranteId(c);
  const { results } = await base(c)
    .prepare(
      `SELECT * FROM pedidos WHERE restaurante_id = ? AND (estado IN ('pagado','aceptado','listo','en_camino')
      OR (estado IN ('entregado','cancelado') AND creado_en > datetime('now','-1 day'))) ORDER BY creado_en DESC`,
    )
    .bind(rid)
    .all<FilaPedido>();
  return c.json({ pedidos: results.map(aPedido) });
});

async function cambiarEstado(
  db: D1Database,
  id: string,
  rid: string,
  desde: string[],
  a: string,
  extra = '',
  valores: unknown[] = [],
) {
  const r = await db
    .prepare(
      `UPDATE pedidos SET estado = ?${extra} WHERE id = ? AND restaurante_id = ? AND estado IN (${desde.map(() => '?').join(',')})`,
    )
    .bind(a, ...valores, id, rid, ...desde)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Este pedido ya cambió de estado. Actualiza la pantalla.', undefined, 409);
  await anotar(db, id, a, rid);
}

operacion.post('/restaurante/pedidos/:id/aceptar', async (c) => {
  const rid = await miRestauranteId(c);
  const { minutos } = await leerCuerpo(c, z.object({ minutos: z.number().int().min(5).max(120) }));
  await cambiarEstado(
    base(c),
    c.req.param('id'),
    rid,
    ['pagado'],
    'aceptado',
    ", aceptado_en = datetime('now'), tiempo_prep_min = ?",
    [minutos],
  );
  await avisarAlCliente(c.env, base(c), c.req.param('id'), (i, f) =>
    AVISOS.pedidoAceptado(i, f.restaurante),
  );
  return c.json({ ok: true });
});

operacion.post('/restaurante/pedidos/:id/listo', async (c) => {
  const rid = await miRestauranteId(c);
  await cambiarEstado(
    base(c),
    c.req.param('id'),
    rid,
    ['aceptado'],
    'listo',
    ", listo_en = datetime('now')",
  );
  return c.json({ ok: true });
});

/** Rechazar un pedido pagado: se cancela y se le devuelve TODO el dinero al cliente. */
operacion.post('/restaurante/pedidos/:id/rechazar', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const p = await db
    .prepare(
      "SELECT stripe_pago FROM pedidos WHERE id = ? AND restaurante_id = ? AND estado IN ('pagado','aceptado')",
    )
    .bind(c.req.param('id'), rid)
    .first<{ stripe_pago: string | null }>();
  if (!p) throw new ErrorDatos('Este pedido ya no se puede rechazar.', undefined, 409);
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (p.stripe_pago) {
    if (!stripe)
      throw new ErrorDatos(
        'No se puede devolver el dinero ahora mismo. Escríbenos.',
        undefined,
        422,
      );
    await stripe.post(
      '/refunds',
      { payment_intent: p.stripe_pago, metadata: { pedido_id: c.req.param('id') } },
      `reembolso-${c.req.param('id')}`,
    );
  }
  await cambiarEstado(
    db,
    c.req.param('id'),
    rid,
    ['pagado', 'aceptado'],
    'cancelado',
    ", cancelado_en = datetime('now')",
  );
  return c.json({ ok: true });
});

/** Inicio y fin (en hora UTC de la base) del día de hoy en la zona horaria del restaurante. */
export function limitesDelDia(zonaHoraria: string, ahora = new Date()): [string, string] {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(ahora)
    .reduce<Record<string, string>>((m, p) => ({ ...m, [p.type]: p.value }), {});
  const localComoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
  );
  const desfase = localComoUtc - Math.floor(ahora.getTime() / 60_000) * 60_000;
  const inicio =
    Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)) - desfase;
  const sql = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
  return [sql(inicio), sql(inicio + 86_400_000)];
}

/** Resumen del día: pedidos, ventas, regalos, comisión y lo que le toca al restaurante. */
operacion.get('/restaurante/resumen', async (c) => {
  const rid = await miRestauranteId(c);
  const db = base(c);
  const z = await db
    .prepare(
      'SELECT z.zona_horaria FROM restaurantes r JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?',
    )
    .bind(rid)
    .first<{ zona_horaria: string }>();
  const [desde, hasta] = limitesDelDia(z?.zona_horaria ?? 'America/New_York');
  const f = await db
    .prepare(
      `SELECT COUNT(CASE WHEN estado = 'entregado' THEN 1 END) AS entregados,
      COUNT(CASE WHEN estado IN ('pagado','aceptado','listo','en_camino') THEN 1 END) AS en_curso,
      COUNT(CASE WHEN estado = 'cancelado' THEN 1 END) AS cancelados,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN subtotal END), 0) AS ventas,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN regalo END), 0) AS regalos,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN comision END), 0) AS comision,
      COALESCE(SUM(CASE WHEN estado = 'entregado' THEN pago_restaurante END), 0) AS neto
      FROM pedidos WHERE restaurante_id = ? AND pagado_en >= ? AND pagado_en < ?`,
    )
    .bind(rid, desde, hasta)
    .first<Record<string, number>>();
  return c.json({
    resumen: {
      entregados: Number(f?.entregados ?? 0),
      enCurso: Number(f?.en_curso ?? 0),
      cancelados: Number(f?.cancelados ?? 0),
      ventas: Number(f?.ventas ?? 0),
      regalos: Number(f?.regalos ?? 0),
      comision: Number(f?.comision ?? 0),
      neto: Number(f?.neto ?? 0),
    },
  });
});

// ======================= Repartidor =======================

async function miFicha(c: Ctx) {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await db.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)').bind(u.id).run();
  const f = await db
    .prepare('SELECT * FROM repartidores WHERE usuario_id = ?')
    .bind(u.id)
    .first<Record<string, unknown>>();
  return { u, db, ficha: f as Record<string, unknown> };
}

async function entregaActiva(db: D1Database, repartidorId: string) {
  return db
    .prepare(
      `SELECT p.*, r.nombre AS restaurante_nombre, r.direccion AS restaurante_direccion, r.lat AS rest_lat, r.lng AS rest_lng, r.telefono AS restaurante_telefono
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.repartidor_id = ? AND p.estado IN ('aceptado','listo','en_camino') LIMIT 1`,
    )
    .bind(repartidorId)
    .first<FilaPedido>();
}

operacion.get('/repartidor/estado', async (c) => {
  const { u, db, ficha } = await miFicha(c);
  const activo = await entregaActiva(db, u.id);
  return c.json({
    conectado: Number(ficha.conectado) === 1,
    tipo: ficha.tipo,
    puntos: Number(ficha.puntos),
    nivel: nivelDe(Number(ficha.puntos)),
    activo: activo ? conDatosRestaurante(activo) : null,
  });
});

operacion.post('/repartidor/conectar', async (c) => {
  const { u, db } = await miFicha(c);
  const d = await leerCuerpo(
    c,
    z.object({
      conectado: z.boolean(),
      lat: z.number().nullable().default(null),
      lng: z.number().nullable().default(null),
    }),
  );
  await db
    .prepare(
      "UPDATE repartidores SET conectado = ?, lat = COALESCE(?, lat), lng = COALESCE(?, lng), zona_id = COALESCE(?, zona_id), geohash = COALESCE(?, geohash), ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(
      d.conectado ? 1 : 0,
      d.lat,
      d.lng,
      (await zonaPara(db, d.lat, d.lng))?.id ?? null,
      d.lat != null && d.lng != null ? geohash(d.lat, d.lng) : null,
      u.id,
    )
    .run();
  return c.json({ conectado: d.conectado });
});

operacion.post('/repartidor/ubicacion', async (c) => {
  const { u, db } = await miFicha(c);
  const d = await leerCuerpo(c, punto);
  await db
    .prepare(
      "UPDATE repartidores SET lat = ?, lng = ?, zona_id = COALESCE(?, zona_id), geohash = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(d.lat, d.lng, (await zonaPara(db, d.lat, d.lng))?.id ?? null, geohash(d.lat, d.lng), u.id)
    .run();
  return c.json({ ok: true });
});

/**
 * Reparto: cada pedido listo para buscar repartidor se ofrece primero al más CERCANO al restaurante.
 * Si dos están igual de cerca (menos de medio km de diferencia), gana el de nivel más alto.
 * Rechazar o dejar vencer la oferta (60 s) solo la pasa al siguiente: no castiga.
 */
type Libre = { id: string; lat: number; lng: number; puntos: number };

/** Repartidores libres de una zona (y, si se piden, solo de esas celdas del mapa). */
async function libresEn(db: D1Database, zonaId: string, celdas: string[] | null): Promise<Libre[]> {
  const filtroCeldas = celdas ? `AND d.geohash IN (${celdas.map(() => '?').join(',')})` : '';
  const { results } = await db
    .prepare(
      `SELECT d.usuario_id AS id, d.lat, d.lng, d.puntos FROM repartidores d
      WHERE d.zona_id = ? AND d.conectado = 1 ${filtroCeldas} AND d.lat IS NOT NULL
      AND d.ubicacion_en > datetime('now','-10 minutes')
      AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = d.usuario_id AND p.estado IN ('aceptado','listo','en_camino'))
      AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.repartidor_id = d.usuario_id AND o.estado = 'ofrecida')`,
    )
    .bind(zonaId, ...(celdas ?? []))
    .all<Libre>();
  return results;
}

export async function repartirOfertas(db: D1Database, env?: Env): Promise<void> {
  await db
    .prepare(
      `UPDATE ofertas SET estado = 'vencida' WHERE estado = 'ofrecida' AND creada_en < datetime('now', ?)`,
    )
    .bind(`-${SEGUNDOS_OFERTA} seconds`)
    .run();
  const { results: pendientes } = await db
    .prepare(
      `SELECT p.id, p.zona_id, p.pago_repartidor, r.lat, r.lng, r.geohash FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE p.estado IN ('aceptado','listo') AND p.repartidor_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.pedido_id = p.id AND o.estado = 'ofrecida') ORDER BY p.pagado_en LIMIT 20`,
    )
    .all<{
      id: string;
      zona_id: string;
      pago_repartidor: number | null;
      lat: number | null;
      lng: number | null;
      geohash: string | null;
    }>();
  if (!pendientes.length) return;
  const ocupados = new Set<string>();
  for (const p of pendientes) {
    const { results: yaVistos } = await db
      .prepare('SELECT repartidor_id FROM ofertas WHERE pedido_id = ?')
      .bind(p.id)
      .all<{ repartidor_id: string }>();
    const vistos = new Set(yaVistos.map((v) => v.repartidor_id));
    const ordenar = (libres: Libre[]) =>
      libres
        .filter((d) => !vistos.has(d.id) && !ocupados.has(d.id))
        .map((d) => ({
          ...d,
          km:
            p.lat != null && p.lng != null
              ? distanciaKm({ lat: d.lat, lng: d.lng }, { lat: p.lat, lng: p.lng })
              : 0,
        }))
        .filter((d) => d.km <= 15)
        .sort(
          (a, b) =>
            Math.floor(a.km * 2) - Math.floor(b.km * 2) ||
            nivelDe(b.puntos).indice - nivelDe(a.puntos).indice ||
            a.km - b.km,
        );
    // Camino rápido: solo la celda del restaurante y sus 8 vecinas (índice zona + celda).
    // Si ahí no hay nadie libre, se busca en toda la zona. Nunca se cruza de zona.
    let candidatos = p.geohash
      ? ordenar(await libresEn(db, p.zona_id, celdasVecinas(p.geohash)))
      : [];
    if (!candidatos.length) candidatos = ordenar(await libresEn(db, p.zona_id, null));
    const elegido = candidatos[0];
    if (!elegido) continue;
    ocupados.add(elegido.id);
    await db
      .prepare(
        "INSERT OR REPLACE INTO ofertas (pedido_id, repartidor_id, estado) VALUES (?, ?, 'ofrecida')",
      )
      .bind(p.id, elegido.id)
      .run();
    if (env) {
      const rep = await db
        .prepare('SELECT idioma FROM usuarios WHERE id = ?')
        .bind(elegido.id)
        .first<{ idioma: string }>();
      const i = rep?.idioma === 'en' ? 'en' : 'es';
      const km =
        p.lat != null && p.lng != null
          ? distanciaKm(
              { lat: elegido.lat, lng: elegido.lng },
              { lat: Number(p.lat), lng: Number(p.lng) },
            )
          : 0;
      await notificar(
        env,
        db,
        elegido.id,
        AVISOS.ofertaNueva(i, formatearDolares(Number(p.pago_repartidor ?? 0), i), km.toFixed(1)),
      );
    }
  }
}

/** Aviso al celular del cliente de un pedido, en su idioma. Nunca frena la operación. */
async function avisarAlCliente(
  env: Env,
  db: D1Database,
  pedidoId: string,
  aviso: (idioma: string, f: { restaurante: string }) => { titulo: string; cuerpo: string },
) {
  const f = await db
    .prepare(
      'SELECT p.cliente_id, u.idioma, r.nombre AS restaurante FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?',
    )
    .bind(pedidoId)
    .first<{ cliente_id: string; idioma: string; restaurante: string }>();
  if (!f) return;
  await notificar(env, db, f.cliente_id, {
    ...aviso(f.idioma, { restaurante: f.restaurante }),
    datos: { pedidoId },
  });
}

function conDatosRestaurante(f: FilaPedido) {
  return {
    ...aPedido(f),
    restaurante: {
      nombre: String(f.restaurante_nombre ?? ''),
      direccion: String(f.restaurante_direccion ?? ''),
      telefono: String(f.restaurante_telefono ?? ''),
      lat: f.rest_lat == null ? null : Number(f.rest_lat),
      lng: f.rest_lng == null ? null : Number(f.rest_lng),
    },
    pagoRepartidor: Number(f.pago_repartidor),
    distanciaKm: f.distancia_km == null ? null : Number(f.distancia_km),
  };
}

operacion.get('/repartidor/ofertas', async (c) => {
  const { u, db } = await miFicha(c);
  await repartirOfertas(db, c.env);
  const { results } = await db
    .prepare(
      `SELECT p.*, r.nombre AS restaurante_nombre, r.direccion AS restaurante_direccion, r.lat AS rest_lat, r.lng AS rest_lng, r.telefono AS restaurante_telefono, o.creada_en AS oferta_en
      FROM ofertas o JOIN pedidos p ON p.id = o.pedido_id JOIN restaurantes r ON r.id = p.restaurante_id
      WHERE o.repartidor_id = ? AND o.estado = 'ofrecida' AND p.repartidor_id IS NULL`,
    )
    .bind(u.id)
    .all<FilaPedido>();
  return c.json({
    ofertas: results.map((f) => ({
      ...conDatosRestaurante(f),
      ofertaEn: String(f.oferta_en),
      segundos: SEGUNDOS_OFERTA,
    })),
  });
});

operacion.post('/repartidor/ofertas/:id/aceptar', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const oferta = await db
    .prepare(
      "SELECT 1 FROM ofertas WHERE pedido_id = ? AND repartidor_id = ? AND estado = 'ofrecida'",
    )
    .bind(id, u.id)
    .first();
  if (!oferta) throw new ErrorDatos('Esta oferta ya no está disponible.', undefined, 409);
  if (await entregaActiva(db, u.id))
    throw new ErrorDatos('Termina tu entrega actual antes de aceptar otra.', undefined, 409);
  // Atómico: si dos tocan a la vez, solo uno se lo lleva.
  const r = await db
    .prepare(
      "UPDATE pedidos SET repartidor_id = ? WHERE id = ? AND repartidor_id IS NULL AND estado IN ('aceptado','listo')",
    )
    .bind(u.id, id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Otro repartidor ya tomó este pedido.', undefined, 409);
  await db
    .prepare("UPDATE ofertas SET estado = 'aceptada' WHERE pedido_id = ? AND repartidor_id = ?")
    .bind(id, u.id)
    .run();
  return c.json({ ok: true });
});

operacion.post('/repartidor/ofertas/:id/rechazar', async (c) => {
  const { u, db } = await miFicha(c);
  await db
    .prepare(
      "UPDATE ofertas SET estado = 'rechazada' WHERE pedido_id = ? AND repartidor_id = ? AND estado = 'ofrecida'",
    )
    .bind(c.req.param('id'), u.id)
    .run();
  return c.json({ ok: true });
});

operacion.post('/repartidor/pedidos/:id/recogido', async (c) => {
  const { u, db } = await miFicha(c);
  const r = await db
    .prepare(
      "UPDATE pedidos SET estado = 'en_camino', recogido_en = datetime('now') WHERE id = ? AND repartidor_id = ? AND estado = 'listo'",
    )
    .bind(c.req.param('id'), u.id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('El restaurante todavía no marcó el pedido como listo.', undefined, 409);
  await anotar(db, c.req.param('id'), 'en_camino', u.id);
  await avisarAlCliente(c.env, db, c.req.param('id'), (i) =>
    AVISOS.enCamino(i, u.nombre.split(' ')[0] ?? ''),
  );
  return c.json({ ok: true });
});

/** Entregado: se acredita a cada billetera, una sola vez (el libro no permite repetir pedido + concepto). */
operacion.post('/repartidor/pedidos/:id/entregado', async (c) => {
  const { u, db } = await miFicha(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      "SELECT p.*, r.dueno_id FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ? AND p.repartidor_id = ? AND p.estado = 'en_camino'",
    )
    .bind(id, u.id)
    .first<Record<string, unknown>>();
  if (!p) throw new ErrorDatos('Este pedido no está en camino contigo.', undefined, 409);
  const entrega = Number(p.envio) + Number(p.complemento);
  await db.batch([
    db
      .prepare(
        "UPDATE pedidos SET estado = 'entregado', entregado_en = datetime('now') WHERE id = ?",
      )
      .bind(id),
    anotarEstado(db, id, 'entregado', u.id),
    db
      .prepare(
        "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'venta')",
      )
      .bind(nuevoId(), p.dueno_id, id, Number(p.pago_restaurante)),
    db
      .prepare(
        "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'entrega')",
      )
      .bind(nuevoId(), u.id, id, entrega),
    db
      .prepare(
        "INSERT OR IGNORE INTO movimientos (id, usuario_id, pedido_id, monto, concepto) VALUES (?, ?, ?, ?, 'propina')",
      )
      .bind(nuevoId(), u.id, id, Number(p.propina)),
    db.prepare('UPDATE repartidores SET puntos = puntos + 10 WHERE usuario_id = ?').bind(u.id),
  ]);
  await avisarAlCliente(c.env, db, c.req.param('id'), (i) => AVISOS.entregado(i));
  return c.json({ ok: true });
});

// ======================= Cliente: seguimiento =======================

operacion.get('/pedidos/:id/seguimiento', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      `SELECT p.*, r.nombre AS restaurante_nombre, r.dueno_id, r.lat AS rest_lat, r.lng AS rest_lng, ur.nombre AS repartidor_nombre, d.lat AS rep_lat, d.lng AS rep_lng, d.ubicacion_en AS rep_en
      FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
      LEFT JOIN usuarios ur ON ur.id = p.repartidor_id LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id WHERE p.id = ?`,
    )
    .bind(c.req.param('id'))
    .first<FilaPedido>();
  if (!f || (f.cliente_id !== u.id && u.rol !== 'admin'))
    throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const enRuta = f.estado === 'en_camino';
  const { results: historial } = await base(c)
    .prepare(
      'SELECT estado, creado_en AS fecha FROM historial_estados WHERE pedido_id = ? ORDER BY id',
    )
    .bind(c.req.param('id'))
    .all<{ estado: string; fecha: string }>();
  // Tiempo estimado: lo que falta de cocina + el viaje a 25 km/h de ciudad (mínimo 5 min).
  const repLat = enRuta && f.rep_lat != null ? Number(f.rep_lat) : null;
  const repLng = enRuta && f.rep_lng != null ? Number(f.rep_lng) : null;
  const casa = f.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null;
  const rest =
    f.rest_lat != null && f.rest_lng != null
      ? { lat: Number(f.rest_lat), lng: Number(f.rest_lng) }
      : null;
  const origen = repLat != null && repLng != null ? { lat: repLat, lng: repLng } : rest;
  const kmQueFaltan = origen && casa ? distanciaKm(origen, casa) : null;
  const minutosViaje =
    kmQueFaltan == null ? null : Math.max(5, Math.round((kmQueFaltan / 25) * 60));
  const minutosCocina =
    f.estado === 'pagado' || f.estado === 'aceptado' ? Number(f.tiempo_prep_min ?? 20) : 0;
  const minutosEstimados =
    f.estado === 'entregado' || f.estado === 'cancelado' || minutosViaje == null
      ? null
      : minutosCocina + minutosViaje;
  return c.json({
    pedido: {
      ...aPedido(f),
      historial,
      restaurante: rest,
      minutosEstimados,
      repartidor: f.repartidor_id
        ? {
            // Solo el nombre de pila: la privacidad del repartidor también cuenta.
            nombre: String(f.repartidor_nombre ?? '').split(' ')[0],
            lat: repLat,
            lng: repLng,
            actualizado: enRuta ? ((f.rep_en as string | null) ?? null) : null,
          }
        : null,
    },
  });
});

operacion.post('/pedidos/:id/calificar', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      estrellasRestaurante: z.number().int().min(1).max(5),
      estrellasRepartidor: z.number().int().min(1).max(5).nullable().default(null),
      culpaRestaurante: z.boolean().default(false),
      comentario: z.string().trim().max(500).default(''),
    }),
  );
  const db = base(c);
  const p = await db
    .prepare("SELECT 1 FROM pedidos WHERE id = ? AND cliente_id = ? AND estado = 'entregado'")
    .bind(c.req.param('id'), u.id)
    .first();
  if (!p) throw new ErrorDatos('Solo se califican pedidos entregados.', undefined, 409);
  await db
    .prepare(
      'INSERT OR REPLACE INTO calificaciones (pedido_id, estrellas_restaurante, estrellas_repartidor, culpa_restaurante, comentario) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      c.req.param('id'),
      d.estrellasRestaurante,
      d.estrellasRepartidor,
      d.culpaRestaurante ? 1 : 0,
      d.comentario,
    )
    .run();
  return c.json({ ok: true });
});
