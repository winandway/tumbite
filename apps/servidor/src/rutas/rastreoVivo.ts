import { type FaseRastreo, faseDePedido, faseDeViaje } from '@tumbite/compartido';
import { Hono } from 'hono';
import type { Env } from '../env';
import {
  detenidoDe,
  leerLlegada,
  listoMsDe,
  llegadaParaMostrar,
  posicionDe,
} from '../llegadaEstimada';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * C-RASTREO-VIVO (16 nov 2026, orden de Richard). Todos los países. Lo que la ficha del pedido y la
 * del viaje del equipo piden cada pocos segundos MIENTRAS está abierta y visible: el tramo, la
 * posición viva del repartidor o conductor, la ruta y la hora de llegada.
 *
 * - SOLO LECTURA y barata: el pedido o viaje por su llave, la posición por la llave del repartidor y
 *   su última lectura (índice), y la fila de la llegada por su llave. Cero escrituras por mirar.
 * - Privacidad: exige `viajes.ubicacion_en_vivo` y la zona de trabajo de quien mira (mapa de rutas
 *   `rutasAdmin.ts`, intermedio de permisos). Cerrado (entregado, cancelado, terminado) no devuelve
 *   ninguna posición.
 */
export const rastreoVivoRutas = new Hono<{ Bindings: Env; Variables: Variables }>();

type Fila = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const punto = (lat: unknown, lng: unknown) => {
  const a = num(lat);
  const b = num(lng);
  return a == null || b == null ? null : { lat: a, lng: b };
};

export type Rastreo = {
  vivo: boolean;
  estado: string;
  fase: FaseRastreo | null;
  esEnvio: boolean;
  origen: { lat: number; lng: number } | null;
  destino: { lat: number; lng: number } | null;
  posicion: { lat: number; lng: number; en: string; haceS: number } | null;
  llegada: ReturnType<typeof llegadaParaMostrar>;
  ruta: string | null;
  detenido: ReturnType<typeof detenidoDe>;
};

/** El rastreo de un pedido para el equipo (solo lectura). */
export async function rastreoPedido(
  db: D1Database,
  id: string,
  ahora = Date.now(),
): Promise<Rastreo> {
  const p = await db
    .prepare(
      `SELECT p.estado, p.lat, p.lng, p.repartidor_id, p.aceptado_en, p.tiempo_prep_min,
          r.lat AS rest_lat, r.lng AS rest_lng,
          EXISTS (SELECT 1 FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_restaurante') AS llego
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?`,
    )
    .bind(id)
    .first<Fila>();
  if (!p) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const fase = faseDePedido({
    estado: String(p.estado),
    conRepartidor: p.repartidor_id != null,
    llegoAlRestaurante: Number(p.llego) === 1,
  });
  return armar(db, {
    estado: String(p.estado),
    fase,
    esEnvio: false,
    origen: punto(p.rest_lat, p.rest_lng),
    destino: punto(p.lat, p.lng),
    conductorId: p.repartidor_id == null ? null : String(p.repartidor_id),
    clave: `pedido:${id}`,
    listoMs: listoMsDe(p),
    ahora,
  });
}

/** El rastreo de un viaje o envío para el equipo (solo lectura). */
export async function rastreoViaje(
  db: D1Database,
  id: string,
  ahora = Date.now(),
): Promise<Rastreo> {
  const o = await db
    .prepare(
      `SELECT o.conductor_id, o.tipo_operacion, v.estado, v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id WHERE o.id = ?`,
    )
    .bind(id)
    .first<Fila>();
  if (!o) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  return armar(db, {
    estado: String(o.estado),
    fase: o.conductor_id == null ? null : faseDeViaje(String(o.estado)),
    esEnvio: String(o.tipo_operacion) === 'envio_paquete',
    origen: punto(o.origen_lat, o.origen_lng),
    destino: punto(o.destino_lat, o.destino_lng),
    conductorId: o.conductor_id == null ? null : String(o.conductor_id),
    clave: `viaje:${id}`,
    listoMs: null,
    ahora,
  });
}

async function armar(
  db: D1Database,
  d: {
    estado: string;
    fase: FaseRastreo | null;
    esEnvio: boolean;
    origen: { lat: number; lng: number } | null;
    destino: { lat: number; lng: number } | null;
    conductorId: string | null;
    clave: string;
    listoMs: number | null;
    ahora: number;
  },
): Promise<Rastreo> {
  const base0 = {
    estado: d.estado,
    fase: d.fase,
    esEnvio: d.esEnvio,
    origen: d.origen,
    destino: d.destino,
  };
  // Cerrado o sin repartidor: nunca se devuelve una posición.
  if (!d.fase || !d.conductorId)
    return { ...base0, vivo: false, posicion: null, llegada: null, ruta: null, detenido: null };
  const [pos, fila] = await Promise.all([posicionDe(db, d.conductorId), leerLlegada(db, d.clave)]);
  const vigente = fila && fila.calculo.fase === d.fase ? fila : null;
  return {
    ...base0,
    vivo: true,
    posicion: pos
      ? {
          lat: pos.lat,
          lng: pos.lng,
          en: new Date(pos.en).toISOString(),
          haceS: Math.max(0, Math.round((d.ahora - pos.en) / 1000)),
        }
      : null,
    llegada: llegadaParaMostrar(vigente, d.fase, d.ahora, d.listoMs),
    ruta: vigente?.ruta ?? null,
    detenido: detenidoDe(vigente, d.fase, pos, d.ahora),
  };
}

rastreoVivoRutas.get('/admin/pedidos/:id/rastreo', async (c) => {
  exigir(c, 'admin');
  return c.json(await rastreoPedido(base(c), c.req.param('id')), 200, {
    'Cache-Control': 'private, no-store',
  });
});

rastreoVivoRutas.get('/admin/viajes/:id/rastreo', async (c) => {
  exigir(c, 'admin');
  return c.json(await rastreoViaje(base(c), c.req.param('id')), 200, {
    'Cache-Control': 'private, no-store',
  });
});
