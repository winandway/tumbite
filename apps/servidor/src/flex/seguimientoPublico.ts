import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';
import { horasEstimadas, rutaCallesGuardada } from './rutaCalles';

/**
 * Divoox Flex · Fase 7 (C-FLEX-SEGUIMIENTO-PLUS). Todos los países. El rastreo público por número
 * de guía, al estándar del mercado (Amazon, UPS, DHL, MRW), SIN datos privados:
 * - hora estimada de llegada cuando la ruta ya tiene sus tiempos por calles;
 * - cuántas paradas faltan antes de la tuya mientras el conductor está en la calle;
 * - cuando eres la PRÓXIMA parada y el conductor mandó su ubicación hace poco, su posición
 *   aproximada (redondeada a unos 100 m) para el mapa. Nunca la dirección de destino ni de nadie;
 * - entregado: dónde quedó (puerta, recepción…) y la foto de la entrega durante 14 días (la foto se
 *   pide «que se vea el lugar y sin personas», C-FLEX-LUGAR). Nunca la firma ni el nombre.
 * Nada de esto escribe en la base: solo lecturas por clave o por índice.
 */
export const flexSeguimientoPublico = new Hono<{ Bindings: Env; Variables: Variables }>();

export const DIAS_FOTO_PUBLICA = 14;
const MINUTOS_UBICACION = 10;
const ANTES_DE_ENTREGAR = ['asignado', 'cargado', 'en_transito'];

const redondear = (n: number) => Math.round(n * 1000) / 1000;

type Entrega = { lugar: string | null; foto: boolean; entregadoEn: string };
export type ExtraSeguimiento = {
  llegadaEstimada: string | null;
  paradasAntes: number | null;
  cerca: { lat: number; lng: number; actualizadoEn: string } | null;
  entrega: Entrega | null;
};

/** Lo que se suma al rastreo de un paquete. */
export async function extraSeguimiento(
  db: D1Database,
  paquete: { id: string; estado: string },
): Promise<ExtraSeguimiento> {
  const vacio: ExtraSeguimiento = {
    llegadaEstimada: null,
    paradasAntes: null,
    cerca: null,
    entrega: null,
  };
  if (paquete.estado === 'entregado') {
    const ev = await db
      .prepare(
        "SELECT metadatos_json, creado_en FROM paquete_eventos WHERE paquete_id = ? AND tipo = 'entregado' ORDER BY id DESC LIMIT 1",
      )
      .bind(paquete.id)
      .first<{ metadatos_json: string; creado_en: string }>();
    if (!ev) return vacio;
    const meta = (JSON.parse(ev.metadatos_json || 'null') ?? {}) as {
      lugar?: string | null;
      fotoId?: string | null;
    };
    const reciente =
      Date.now() - Date.parse(`${ev.creado_en.replace(' ', 'T')}Z`) <
      DIAS_FOTO_PUBLICA * 86_400_000;
    return {
      ...vacio,
      entrega: {
        lugar: meta.lugar ?? null,
        foto: Boolean(meta.fotoId) && reciente,
        entregadoEn: ev.creado_en,
      },
    };
  }
  if (!ANTES_DE_ENTREGAR.includes(paquete.estado)) return vacio;
  const rq = await db
    .prepare(
      `SELECT rq.ruta_id, rq.parada_id, rp.orden, rp.estado AS parada_estado, r.estado AS ruta_estado,
              r.iniciada_en, r.bloque_desde, r.conductor_lat, r.conductor_lng, r.conductor_ubicacion_en
         FROM ruta_paquetes rq JOIN ruta_paradas rp ON rp.id = rq.parada_id JOIN rutas_flex r ON r.id = rq.ruta_id
        WHERE rq.paquete_id = ? AND rq.activo = 1`,
    )
    .bind(paquete.id)
    .first<{
      ruta_id: string;
      parada_id: string;
      orden: number;
      parada_estado: string;
      ruta_estado: string;
      iniciada_en: string | null;
      bloque_desde: string | null;
      conductor_lat: number | null;
      conductor_lng: number | null;
      conductor_ubicacion_en: string | null;
    }>();
  if (!rq || !['pendiente', 'llegada'].includes(rq.parada_estado)) return vacio;
  const enCalle = rq.ruta_estado === 'en_curso';
  const antes = enCalle
    ? await db
        .prepare(
          "SELECT COUNT(*) AS n FROM ruta_paradas WHERE ruta_id = ? AND orden < ? AND estado IN ('pendiente', 'llegada')",
        )
        .bind(rq.ruta_id, rq.orden)
        .first<{ n: number }>()
    : null;
  const paradasAntes = antes ? Number(antes.n) : null;
  const rc = await rutaCallesGuardada(db, rq.ruta_id);
  const salida = rq.iniciada_en ?? rq.bloque_desde;
  const llegadaEstimada =
    rc && salida
      ? (horasEstimadas(rc, salida).find((h) => h.paradaId === rq.parada_id)?.llegada ?? null)
      : null;
  const ubicacionReciente =
    rq.conductor_ubicacion_en &&
    Date.now() - Date.parse(`${rq.conductor_ubicacion_en.replace(' ', 'T')}Z`) <
      MINUTOS_UBICACION * 60_000;
  const cerca =
    enCalle &&
    paradasAntes === 0 &&
    ubicacionReciente &&
    rq.conductor_lat != null &&
    rq.conductor_lng != null
      ? {
          lat: redondear(rq.conductor_lat),
          lng: redondear(rq.conductor_lng),
          actualizadoEn: rq.conductor_ubicacion_en!,
        }
      : null;
  return { llegadaEstimada, paradasAntes, cerca, entrega: null };
}

const CODIGO = /^DVX[A-Z2-9]{10}$/;

/** La foto de la entrega, solo si el paquete se entregó hace menos de 14 días. Privada y sin caché. */
flexSeguimientoPublico.get('/seguimiento/:codigo/foto', async (c) => {
  const db = base(c);
  const codigo = c.req.param('codigo').trim().toUpperCase();
  const noHay = () => new ErrorDatos('Esa foto no está disponible.', undefined, 404);
  if (!CODIGO.test(codigo)) throw noHay();
  const p = await db
    .prepare('SELECT id, estado FROM paquetes WHERE codigo_seguimiento = ?')
    .bind(codigo)
    .first<{ id: string; estado: string }>();
  if (!p || p.estado !== 'entregado') throw noHay();
  const extra = await extraSeguimiento(db, p);
  if (!extra.entrega?.foto) throw noHay();
  const ev = await db
    .prepare(
      "SELECT json_extract(metadatos_json, '$.fotoId') AS foto FROM paquete_eventos WHERE paquete_id = ? AND tipo = 'entregado' ORDER BY id DESC LIMIT 1",
    )
    .bind(p.id)
    .first<{ foto: string | null }>();
  const f = ev?.foto
    ? await db
        .prepare(
          "SELECT clave FROM flex_pruebas WHERE id = ? AND tipo = 'foto' AND purgada_en IS NULL",
        )
        .bind(ev.foto)
        .first<{ clave: string }>()
    : null;
  const obj = f && c.env.BUCKET ? await c.env.BUCKET.get(f.clave) : null;
  if (!obj) throw noHay();
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/webp',
      'cache-control': 'private, no-store',
    },
  });
});
