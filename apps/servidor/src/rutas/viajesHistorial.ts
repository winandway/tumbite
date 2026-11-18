import { sinPlusCode } from '@tumbite/compartido';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { notificar } from '../notificaciones';
import {
  COLUMNAS_REGALO_PASAJERO,
  type FilaRegaloPasajero,
  JOIN_REGALO_PASAJERO,
  regaloPasajero,
} from '../regalosDivoox';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { crearTicket } from './tickets';

/**
 * C-VIAJES-HISTORIAL (13 nov 2026) — todos los países. «Mis viajes» del pasajero y del conductor, el
 * recibo de cada viaje y la ayuda con el viaje adjunto, como Uber:
 *
 * - La lista va paginada por fecha (`antes`), con el índice del pasajero (`operaciones_cliente`) o el
 *   del conductor (`operaciones_conductor`, parcial: solo filas con conductor). Nada escribe por mirar.
 * - El recibo: desglose de la cotización, forma de pago, propina con tarjeta, distancia, tiempo real
 *   (desde que empezó hasta que terminó) y el conductor con su vehículo (solo su nombre de pila).
 * - La ayuda abre un ticket de soporte con el viaje adjunto. «Olvidé algo en el vehículo» además avisa
 *   al conductor y le deja el caso a la vista en su historial; el contacto es SIEMPRE por soporte: nadie
 *   ve el teléfono del otro. Un caso por viaje y motivo (repetir devuelve el mismo).
 */
/**
 * C-OLVIDE-ALGO-UNA-VEZ: lo que el conductor ve del caso. Hasta 140 caracteres, sin enlaces, correos
 * ni teléfonos (filtro simple: el contacto va siempre por soporte). El ticket guarda el texto entero.
 */
export const MAX_TEXTO_CONDUCTOR = 140;
export function textoParaConductor(texto: string): string {
  const limpio = sinContacto(texto);
  return limpio.length > MAX_TEXTO_CONDUCTOR
    ? `${limpio.slice(0, MAX_TEXTO_CONDUCTOR - 1).trimEnd()}…`
    : limpio;
}

/** Quita enlaces, correos y teléfonos de un texto libre (filtro simple; C-CHAT-VIAJE también). */
export function sinContacto(texto: string): string {
  return (
    texto
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[…]')
      .replace(/\S+@\S+/g, '[…]')
      .replace(/\b[a-z0-9-]+\.(?:com|net|org|io|co|me|ve|us|app|link|ly)\b\S*/gi, '[…]')
      // Un teléfono: dígitos con espacios, guiones, puntos o paréntesis, con 7 dígitos o más.
      .replace(/[+\d(][\d\s().-]{5,}\d/g, (x) => (x.replace(/\D/g, '').length >= 7 ? '[…]' : x))
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export const viajesHistorial = new Hono<{ Bindings: Env; Variables: Variables }>();

const TAMANO_PAGINA = 20;
/** Hasta cuántos días después del viaje se puede pedir ayuda desde la app. */
export const DIAS_AYUDA_VIAJE = 30;
export const MOTIVOS_AYUDA_VIAJE = [
  'objeto_olvidado',
  'cobro',
  'conductor',
  'seguridad',
  'otro',
] as const;

const consultaPagina = z.object({
  antes: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .optional(),
});

type FilaLista = {
  id: string;
  servicio: string;
  categoria: string | null;
  estado: string;
  origen: string;
  destino: string;
  total: number | null;
  moneda: string | null;
  metodoPago: string;
  creadoEn: string;
};

const COLUMNAS_LISTA = `o.id, o.servicio_id AS servicio, v.categoria, v.estado, v.origen_direccion AS origen,
  v.destino_direccion AS destino, q.total, q.moneda, v.metodo_pago AS metodoPago, o.creado_en AS creadoEn`;

const sinCodigo = (x: string) => sinPlusCode(String(x ?? '')) || String(x ?? '');

function pagina<F extends FilaLista>(filas: F[]) {
  const mas = filas.length > TAMANO_PAGINA;
  // C-SIN-PLUS-CODE: también los viajes guardados antes del arreglo.
  const viajes = filas
    .slice(0, TAMANO_PAGINA)
    .map((f) => ({ ...f, origen: sinCodigo(f.origen), destino: sinCodigo(f.destino) }));
  return { viajes, siguiente: mas ? (viajes.at(-1)?.creadoEn ?? null) : null };
}

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. El pasajero recibe además los puntos exactos de su
 * viaje (recogida, paradas en orden y destino) para dibujar el mapita de la ruta y pedir la misma ruta
 * otra vez. Solo lectura: dos consultas por página (la lista y sus paradas), nada se escribe.
 */
type FilaListaPasajero = FilaLista &
  FilaRegaloPasajero & {
    origenLat: number | null;
    origenLng: number | null;
    destinoLat: number | null;
    destinoLng: number | null;
    conductorNombre: string | null;
    deConfianza: number;
    rutinaId: string | null;
    menor: string | null;
  };

viajesHistorial.get('/viajes/historial', async (c) => {
  const u = exigir(c, 'cliente');
  const q = consultaPagina.catch({}).parse(c.req.query());
  const db = base(c);
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS_LISTA}, v.origen_lat AS origenLat, v.origen_lng AS origenLng,
              v.destino_lat AS destinoLat, v.destino_lng AS destinoLng,
              -- C-CONDUCTOR-CONFIANZA: con quién viajó y si ya es de confianza (para marcarlo desde aquí).
              (SELECT nombre FROM usuarios cu WHERE cu.id = o.conductor_id AND v.estado = 'terminado') AS conductorNombre,
              EXISTS (SELECT 1 FROM conductores_confianza k WHERE k.cliente_id = o.cliente_id
                        AND k.conductor_id = o.conductor_id) AS deConfianza,
              v.rutina_id AS rutinaId, v.menor_nombre AS menor,
              -- C-PRECIO-CON-REGALO: el regalo del viaje, para mostrar el precio como en la tarjeta.
              ${COLUMNAS_REGALO_PASAJERO}
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         ${JOIN_REGALO_PASAJERO}
        WHERE o.cliente_id = ?1 AND o.tipo_operacion = 'viaje_pasajero' AND (?2 IS NULL OR o.creado_en < ?2)
        ORDER BY o.creado_en DESC LIMIT ?3`,
    )
    .bind(u.id, q.antes ?? null, TAMANO_PAGINA + 1)
    .all<FilaListaPasajero>();
  const p = pagina(results);
  const ids = p.viajes.map((v) => v.id);
  const paradas = new Map<string, { lat: number; lng: number; direccion: string }[]>();
  if (ids.length) {
    const { results: filas } = await db
      .prepare(
        `SELECT operacion_id AS id, lat, lng, direccion FROM paradas_viaje
          WHERE operacion_id IN (${ids.map(() => '?').join(', ')}) ORDER BY operacion_id, orden`,
      )
      .bind(...ids)
      .all<{ id: string; lat: number; lng: number; direccion: string }>();
    for (const f of filas)
      paradas.set(f.id, [
        ...(paradas.get(f.id) ?? []),
        { lat: f.lat, lng: f.lng, direccion: f.direccion },
      ]);
  }
  return c.json({
    ...p,
    viajes: p.viajes.map(
      ({
        origenLat,
        origenLng,
        destinoLat,
        destinoLng,
        conductorNombre,
        deConfianza,
        regalo_monto,
        regalo_codigo,
        regalo_estado,
        regalo_nombre_es,
        regalo_nombre_en,
        ...v
      }) => ({
        ...v,
        regalo: regaloPasajero({
          regalo_monto,
          regalo_codigo,
          regalo_estado,
          regalo_nombre_es,
          regalo_nombre_en,
        }),
        // Solo el nombre de pila del conductor de un viaje terminado: es lo que se marca de confianza.
        conductor: conductorNombre ? (conductorNombre.split(' ')[0] ?? '') : null,
        deConfianza: deConfianza === 1,
        puntos:
          origenLat != null && origenLng != null && destinoLat != null && destinoLng != null
            ? {
                origen: { lat: origenLat, lng: origenLng },
                destino: { lat: destinoLat, lng: destinoLng },
                paradas: paradas.get(v.id) ?? [],
              }
            : null,
      }),
    ),
  });
});

viajesHistorial.get('/conductor/viajes/historial', async (c) => {
  const u = exigir(c, 'repartidor');
  const q = consultaPagina.catch({}).parse(c.req.query());
  const db = base(c);
  const [{ results }, { results: perdidos }] = await Promise.all([
    db
      .prepare(
        `SELECT ${COLUMNAS_LISTA}
           FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
           LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
          WHERE o.conductor_id = ?1 AND o.tipo_operacion = 'viaje_pasajero' AND (?2 IS NULL OR o.creado_en < ?2)
          ORDER BY o.creado_en DESC LIMIT ?3`,
      )
      .bind(u.id, q.antes ?? null, TAMANO_PAGINA + 1)
      .all<FilaLista>(),
    // Los objetos olvidados de la última semana, para que el conductor los tenga a la vista.
    db
      .prepare(
        `SELECT operacion_id AS viajeId, detalle, creado_en AS creadoEn FROM ayuda_viajes
          WHERE conductor_id = ? AND motivo = 'objeto_olvidado' AND creado_en >= datetime('now', '-7 days')
          ORDER BY creado_en DESC LIMIT 10`,
      )
      .bind(u.id)
      .all<{ viajeId: string; detalle: string; creadoEn: string }>(),
  ]);
  return c.json({ ...pagina(results), objetosOlvidados: perdidos });
});

type FilaRecibo = FilaRegaloPasajero & {
  id: string;
  servicio: string;
  categoria: string | null;
  estado: string;
  metodo_pago: string;
  origen: string;
  destino: string;
  creado_en: string;
  iniciado_en: string | null;
  terminado_en: string | null;
  segundos: number | null;
  total: number | null;
  moneda: string | null;
  distancia_m: number | null;
  duracion_s: number | null;
  desglose_json: string | null;
  propina: number | null;
  conductor: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  placa: string | null;
  plazas: number | null;
  vehiculo_tipo: string | null;
};

async function filaRecibo(db: D1Database, id: string, quien: 'cliente' | 'conductor', uid: string) {
  return db
    .prepare(
      `SELECT o.id, o.servicio_id AS servicio, v.categoria, v.estado, v.metodo_pago, v.origen_direccion AS origen,
              v.destino_direccion AS destino, o.creado_en, v.iniciado_en, v.terminado_en,
              CAST((julianday(v.terminado_en) - julianday(v.iniciado_en)) * 86400 AS INTEGER) AS segundos,
              q.total, q.moneda, q.distancia_m, q.duracion_s, q.desglose_json, cv.propina,
              u.nombre AS conductor, h.marca, h.modelo, h.color, h.placa, h.plazas, h.tipo AS vehiculo_tipo,
              ${COLUMNAS_REGALO_PASAJERO}
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id
         ${JOIN_REGALO_PASAJERO}
         LEFT JOIN cobros_viaje cv ON cv.operacion_id = o.id
         LEFT JOIN usuarios u ON u.id = o.conductor_id
         LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
        WHERE o.id = ? AND ${quien === 'cliente' ? 'o.cliente_id' : 'o.conductor_id'} = ?`,
    )
    .bind(id, uid)
    .first<FilaRecibo>();
}

function desgloseDe(json: string | null): Record<string, number> {
  try {
    const d = JSON.parse(json ?? '{}') as unknown;
    if (!d || typeof d !== 'object') return {};
    return Object.fromEntries(
      Object.entries(d).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

function recibo(f: FilaRecibo) {
  return {
    id: f.id,
    servicio: f.servicio,
    categoria: f.categoria ?? 'estandar',
    estado: f.estado,
    metodoPago: f.metodo_pago,
    origen: sinCodigo(f.origen),
    destino: sinCodigo(f.destino),
    fecha: f.creado_en,
    total: f.total,
    moneda: f.moneda,
    // C-PRECIO-CON-REGALO: lo que pagó Divoox (el recibo dice lo que se pagó de verdad).
    regalo: regaloPasajero(f),
    desglose: desgloseDe(f.desglose_json),
    propina: f.propina ?? 0,
    distanciaM: f.distancia_m,
    // Tiempo real del viaje si empezó y terminó; si no, el estimado de la cotización.
    duracionS: f.segundos != null && f.segundos >= 0 ? f.segundos : f.duracion_s,
    conductor: f.conductor
      ? {
          nombre: f.conductor.split(' ')[0] ?? '',
          vehiculo: {
            tipo: f.vehiculo_tipo,
            marca: f.marca,
            modelo: f.modelo,
            color: f.color,
            placa: f.placa,
            plazas: f.plazas,
          },
        }
      : null,
  };
}

viajesHistorial.get('/viajes/:id/recibo', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await filaRecibo(db, c.req.param('id'), 'cliente', u.id);
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const { results: ayuda } = await db
    .prepare('SELECT motivo, ticket_id AS ticketId FROM ayuda_viajes WHERE operacion_id = ?')
    .bind(f.id)
    .all<{ motivo: string; ticketId: string }>();
  return c.json({ recibo: recibo(f), ayuda });
});

viajesHistorial.get('/conductor/viajes/:id/recibo', async (c) => {
  const u = exigir(c, 'repartidor');
  const f = await filaRecibo(base(c), c.req.param('id'), 'conductor', u.id);
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  const r = recibo(f);
  // El conductor no necesita su propio nombre: ve el recibo con su vehículo.
  return c.json({
    recibo: { ...r, conductor: r.conductor ? { vehiculo: r.conductor.vehiculo } : null },
  });
});

const ASUNTOS = new Map<string, [string, string]>([
  ['objeto_olvidado', ['Olvidé algo en el vehículo', 'I left something in the vehicle']],
  ['cobro', ['Problema con el cobro del viaje', 'Problem with the ride charge']],
  ['conductor', ['Problema con el conductor', 'Problem with the driver']],
  ['seguridad', ['Problema de seguridad en el viaje', 'Safety issue on the ride']],
  ['otro', ['Ayuda con un viaje', 'Help with a ride']],
]);

viajesHistorial.post('/viajes/:id/ayuda', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      motivo: z.enum(MOTIVOS_AYUDA_VIAJE),
      detalle: z.string().trim().min(3).max(1000),
    }),
  );
  const f = await db
    .prepare(
      `SELECT o.id, o.servicio_id, o.conductor_id, o.zona_id, z.pais, v.estado, o.creado_en,
              (o.creado_en >= datetime('now', '-${DIAS_AYUDA_VIAJE} days')) AS reciente,
              cu.nombre, cu.correo, cu.idioma
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         JOIN usuarios cu ON cu.id = o.cliente_id
         LEFT JOIN zonas z ON z.id = o.zona_id
        WHERE o.id = ? AND o.cliente_id = ? AND o.tipo_operacion = 'viaje_pasajero'`,
    )
    .bind(id, u.id)
    .first<{
      id: string;
      servicio_id: string;
      conductor_id: string | null;
      zona_id: string;
      pais: string | null;
      estado: string;
      creado_en: string;
      reciente: number;
      nombre: string;
      correo: string;
      idioma: string;
    }>();
  if (!f) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  if (!f.reciente)
    throw new ErrorDatos(
      'Pasaron más de 30 días desde este viaje. Escríbenos desde Ayuda.',
      undefined,
      409,
    );
  if (d.motivo === 'objeto_olvidado' && !f.conductor_id)
    throw new ErrorDatos('Este viaje no llegó a tener conductor.', 'motivo', 409);
  const ya = await db
    .prepare('SELECT ticket_id FROM ayuda_viajes WHERE operacion_id = ? AND motivo = ?')
    .bind(id, d.motivo)
    .first<{ ticket_id: string }>();
  if (ya) return c.json({ ticketId: ya.ticket_id, repetido: true });
  const en = f.idioma === 'en';
  const asunto = ASUNTOS.get(d.motivo) ?? ['Ayuda con un viaje', 'Help with a ride'];
  // C-OLVIDE-ALGO-UNA-VEZ (14 nov 2026): el caso se reclama en el MISMO lote que el ticket. Si dos
  // toques llegan a la vez, el segundo choca con la clave (viaje, motivo), no nace un segundo ticket
  // y devuelve el primero. Lo que ve el conductor es un texto corto y sin teléfonos ni enlaces.
  const reclamo = (ticketId: string) => [
    db
      .prepare(
        `INSERT INTO ayuda_viajes (operacion_id, motivo, ticket_id, cliente_id, conductor_id, detalle)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, d.motivo, ticketId, u.id, f.conductor_id, textoParaConductor(d.detalle)),
  ];
  let t: { id: string };
  try {
    t = await crearTicket(
      c.env,
      db,
      {
        tipo: 'soporte',
        nombre: f.nombre,
        correo: f.correo,
        pais: f.pais ?? '',
        idioma: en ? 'en' : 'es',
        asunto: en ? asunto[1] : asunto[0],
        mensaje: d.detalle,
        datos: { viaje: id, servicio: f.servicio_id, motivo: d.motivo, estado: f.estado },
        usuarioId: u.id,
        zonaId: f.zona_id,
      },
      reclamo,
    );
  } catch (e) {
    const otro = await db
      .prepare('SELECT ticket_id FROM ayuda_viajes WHERE operacion_id = ? AND motivo = ?')
      .bind(id, d.motivo)
      .first<{ ticket_id: string }>();
    if (otro) return c.json({ ticketId: otro.ticket_id, repetido: true });
    throw e;
  }
  if (d.motivo === 'objeto_olvidado' && f.conductor_id) {
    // Se avisa al conductor; si el aviso no sale, el caso igual queda en su historial y en soporte.
    // C-AVISOS-IDIOMA: antes salía en los dos idiomas a la vez; ahora en el de su app.
    await notificar(c.env, db, f.conductor_id, (i) => ({
      ...(i === 'en'
        ? {
            titulo: 'Lost item',
            cuerpo:
              'A rider left something in your vehicle. Check My rides; our team will contact you.',
          }
        : {
            titulo: 'Objeto olvidado',
            cuerpo:
              'Un pasajero olvidó algo en tu vehículo. Revisa Mis viajes; nuestro equipo te contacta.',
          }),
      datos: { tipo: 'objeto_olvidado', viajeId: id },
    })).catch((e: unknown) => console.error('viajes: aviso de objeto olvidado', e));
  }
  return c.json({ ticketId: t.id, repetido: false }, 201);
});
