import { Hono } from 'hono';
import { z } from 'zod';
import { distanciaKm } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { configRegalos } from './regalos';
import { zonaPara } from './zonas';

/**
 * La campana del inicio (18 oct 2026, «como los grandes»): avisos reales del cliente, calculados
 * al momento y sin tabla nueva (no hay «leído»):
 *   - pedido: cada pedido en curso (pagado, aceptado, listo, en camino) → cuentan como pendientes
 *     (el punto rojo de la campana);
 *   - regalo: en los restaurantes donde ya compró, la tarjeta de sellos en marcha y el descuento
 *     de «cliente que vuelve» cuando ya le toca;
 *   - apertura: las zonas de su ciudad marcadas «próximamente».
 */
export const avisos = new Hono<{ Bindings: Env; Variables: Variables }>();

const EN_CURSO = ['pagado', 'aceptado', 'listo', 'en_camino'];
const coord = z.coerce.number().finite().optional();

export type Aviso =
  | {
      tipo: 'pedido';
      pedidoId: string;
      estado: string;
      restauranteId: string;
      restauranteNombre: string;
      creadoEn: string;
    }
  | {
      tipo: 'regalo';
      regalo: 'sellos' | 'vuelve';
      restauranteId: string;
      restauranteNombre: string;
      progreso: number;
      meta: number;
      pb: number | null;
    }
  | { tipo: 'apertura'; area: string; ciudad: string; apertura: string | null };

avisos.get('/mis-avisos', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const q = z.object({ lat: coord, lng: coord }).safeParse(c.req.query());
  const lista: Aviso[] = [];

  const pedidos = await db
    .prepare(
      `SELECT p.id, p.estado, p.restaurante_id, p.creado_en, r.nombre FROM pedidos p
         JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.cliente_id = ? AND p.estado IN (${EN_CURSO.map((e) => `'${e}'`).join(',')})
        ORDER BY p.creado_en DESC LIMIT 10`,
    )
    .bind(u.id)
    .all<{
      id: string;
      estado: string;
      restaurante_id: string;
      creado_en: string;
      nombre: string;
    }>();
  for (const p of pedidos.results)
    lista.push({
      tipo: 'pedido',
      pedidoId: p.id,
      estado: p.estado,
      restauranteId: p.restaurante_id,
      restauranteNombre: p.nombre,
      creadoEn: p.creado_en,
    });

  // Regalos: solo donde ya compró (hasta 20 restaurantes, los más recientes).
  const historial = await db
    .prepare(
      `SELECT p.restaurante_id, r.nombre, MAX(p.entregado_en) AS ultimo,
              MAX(CASE WHEN p.regalo_tipo = 'sellos' THEN p.creado_en END) AS ultimo_sello
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.cliente_id = ? AND p.estado = 'entregado' AND r.estado = 'aprobado'
        GROUP BY p.restaurante_id ORDER BY ultimo DESC LIMIT 20`,
    )
    .bind(u.id)
    .all<{
      restaurante_id: string;
      nombre: string;
      ultimo: string | null;
      ultimo_sello: string | null;
    }>();
  for (const h of historial.results) {
    const cfg = await configRegalos(db, h.restaurante_id);
    if (cfg.sellos) {
      const n = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM pedidos WHERE restaurante_id = ? AND cliente_id = ? AND estado = 'entregado' AND creado_en > ?",
        )
        .bind(h.restaurante_id, u.id, h.ultimo_sello ?? '0000')
        .first<{ n: number }>();
      lista.push({
        tipo: 'regalo',
        regalo: 'sellos',
        restauranteId: h.restaurante_id,
        restauranteNombre: h.nombre,
        progreso: Math.min(Number(n?.n ?? 0), cfg.sellos_meta),
        meta: cfg.sellos_meta,
        pb: null,
      });
    }
    if (cfg.vuelve && h.ultimo) {
      const dias = (Date.now() - new Date(`${h.ultimo}Z`).getTime()) / 86_400_000;
      if (dias >= cfg.vuelve_dias)
        lista.push({
          tipo: 'regalo',
          regalo: 'vuelve',
          restauranteId: h.restaurante_id,
          restauranteNombre: h.nombre,
          progreso: 1,
          meta: 1,
          pb: cfg.vuelve_pb,
        });
    }
  }

  // Próximas aperturas en su ciudad: por su ubicación (aunque caiga fuera de las áreas abiertas,
  // vale la ciudad más cercana que la cubre con su círculo) o, si no, la ciudad de su cuenta.
  let zona: { id: string; nombre: string } | null = q.success
    ? await zonaPara(db, q.data.lat, q.data.lng, false)
    : null;
  if (!zona && q.success && q.data.lat != null && q.data.lng != null) {
    const { lat, lng } = q.data;
    const { results } = await db
      .prepare('SELECT id, nombre, lat, lng, radio_km FROM zonas')
      .all<{ id: string; nombre: string; lat: number; lng: number; radio_km: number }>();
    const cerca = results
      .map((z) => ({ z, km: distanciaKm({ lat, lng }, { lat: z.lat, lng: z.lng }) }))
      .filter((x) => x.km <= x.z.radio_km)
      .sort((a, b) => a.km - b.km)[0];
    if (cerca) zona = { id: cerca.z.id, nombre: cerca.z.nombre };
  }
  if (!zona) {
    const f = await db
      .prepare(
        'SELECT z.id, z.nombre FROM usuarios u JOIN zonas z ON z.id = u.zona_id WHERE u.id = ?',
      )
      .bind(u.id)
      .first<{ id: string; nombre: string }>();
    if (f) zona = f;
  }
  if (zona) {
    const areas = await db
      .prepare(
        "SELECT nombre, apertura_prevista FROM areas WHERE zona_id = ? AND estado = 'proximamente' ORDER BY apertura_prevista, nombre LIMIT 5",
      )
      .bind(zona.id)
      .all<{ nombre: string; apertura_prevista: string | null }>();
    for (const a of areas.results)
      lista.push({
        tipo: 'apertura',
        area: a.nombre,
        ciudad: zona.nombre,
        apertura: a.apertura_prevista,
      });
  }

  return c.json({
    avisos: lista,
    pendientes: lista.filter((a) => a.tipo === 'pedido').length,
  });
});
