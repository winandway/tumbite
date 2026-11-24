import { Hono } from 'hono';
import { z } from 'zod';
import { distanciaKm } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { configRegalos } from './regalos';
import { zonaPara } from './zonas';
import { campanaDe } from '../campana';

/**
 * La campana del inicio (18 oct 2026, «como los grandes»): avisos reales del cliente, calculados
 * al momento (lo leído se guarda con UNA marca «visto hasta» por cuenta, C-CAMPANA-SE-VACIA):
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
      /** Lo que se le muestra al cliente (la app nueva): «enviado» con pago al recibir. */
      estadoVisible: string;
      restauranteId: string;
      restauranteNombre: string;
      creadoEn: string;
      /** C-CAMPANA-SE-VACIA: cuándo cambió por última vez (su estado nuevo es la noticia). */
      en: string;
    }
  | {
      tipo: 'regalo';
      regalo: 'sellos' | 'vuelve';
      restauranteId: string;
      restauranteNombre: string;
      progreso: number;
      meta: number;
      pb: number | null;
      en: string;
    }
  | { tipo: 'apertura'; area: string; ciudad: string; apertura: string | null; en: string };

avisos.get('/mis-avisos', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const q = z.object({ lat: coord, lng: coord }).safeParse(c.req.query());
  const lista: Aviso[] = [];

  const pedidos = await db
    .prepare(
      `SELECT p.id, p.estado, p.metodo_pago, p.restaurante_id, p.creado_en, r.nombre,
              MAX(p.creado_en, COALESCE(p.pagado_en, ''), COALESCE(p.aceptado_en, ''),
                  COALESCE(p.listo_en, ''), COALESCE(p.recogido_en, '')) AS cambio_en FROM pedidos p
         JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.cliente_id = ? AND p.estado IN (${EN_CURSO.map((e) => `'${e}'`).join(',')})
        ORDER BY p.creado_en DESC LIMIT 10`,
    )
    .bind(u.id)
    .all<{
      id: string;
      estado: string;
      metodo_pago: string | null;
      restaurante_id: string;
      creado_en: string;
      nombre: string;
      cambio_en: string;
    }>();
  for (const p of pedidos.results)
    lista.push({
      tipo: 'pedido',
      pedidoId: p.id,
      // Revisor B3 (18 nov 2026): `estado` queda como lo entiende el cliente 27 publicado; con pago
      // al recibir, «pagado» todavía no está pagado y la app nueva lee `estadoVisible` («enviado»).
      estado: p.estado,
      estadoVisible:
        p.estado === 'pagado' && p.metodo_pago && p.metodo_pago !== 'tarjeta'
          ? 'enviado'
          : p.estado,
      restauranteId: p.restaurante_id,
      restauranteNombre: p.nombre,
      creadoEn: p.creado_en,
      en: p.cambio_en || p.creado_en,
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
        // Un sello nuevo llega con cada pedido entregado.
        en: h.ultimo ?? '',
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
          // El día en que le tocó el descuento de «cliente que vuelve».
          en: new Date(new Date(`${h.ultimo}Z`).getTime() + cfg.vuelve_dias * 86_400_000)
            .toISOString()
            .replace('T', ' ')
            .slice(0, 19),
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
        "SELECT nombre, apertura_prevista, COALESCE(actualizado_en, creado_en) AS en FROM areas WHERE zona_id = ? AND estado = 'proximamente' ORDER BY apertura_prevista, nombre LIMIT 5",
      )
      .bind(zona.id)
      .all<{ nombre: string; apertura_prevista: string | null; en: string | null }>();
    for (const a of areas.results)
      lista.push({
        tipo: 'apertura',
        area: a.nombre,
        ciudad: zona.nombre,
        apertura: a.apertura_prevista,
        en: a.en ?? '',
      });
  }

  // C-CAMPANA-SE-VACIA: cada aviso dice si ya lo vio y `sinLeer` es el número de la campana (va a cero
  // al abrirla). `pendientes` se queda igual para las versiones de la app ya publicadas.
  const campana = await campanaDe(db, u.id, 'cliente', lista);
  return c.json({
    avisos: campana.avisos,
    sinLeer: campana.sinLeer,
    pendientes: lista.filter((a) => a.tipo === 'pedido').length,
  });
});
