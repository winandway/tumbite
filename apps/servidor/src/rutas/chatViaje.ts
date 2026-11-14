import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { AVISOS, notificar } from '../notificaciones';
import { type Variables, base, exigir } from '../sesion';
import { limiteIntentos } from '../seguridad';
import { ErrorDatos, leerCuerpo } from '../validar';
import { sinContacto } from './viajesHistorial';

/**
 * C-CHAT-VIAJE (14 nov 2026, todos los países): mensajes entre el pasajero (o quien envía) y su
 * conductor durante el viaje, con el mismo patrón que el chat del pedido de Comida
 * (`/datos/pedidos/:id/mensajes`): se consulta cada pocos segundos, sin teléfonos ni enlaces, y al
 * terminar o cancelarse el viaje ellos ya no lo ven (queda para soporte). Sin llamadas enmascaradas.
 */
export const chatViaje = new Hono<{ Bindings: Env; Variables: Variables }>();

const ACTIVOS = new Set(['asignado', 'conductor_llego', 'en_curso']);

/** Mensajes por persona y por minuto en un viaje (como el chat de los tickets). */
export const MENSAJES_POR_MINUTO = 12;

/**
 * Desde cuándo ve la conversación la pareja de ahora: si el viaje cambió de conductor, el nuevo no
 * ve lo que el pasajero habló con el anterior (y el pasajero empieza una conversación nueva), como
 * Uber. El equipo lo ve todo.
 */
async function inicioDeLaPareja(db: D1Database, id: string, conductorId: string | null) {
  if (!conductorId) return null;
  const a = await db
    .prepare(
      'SELECT inicio FROM asignaciones_operacion WHERE operacion_id = ? AND conductor_id = ? AND fin IS NULL',
    )
    .bind(id, conductorId)
    .first<{ inicio: string }>();
  return a?.inicio ?? null;
}

async function viajeDelChat(db: D1Database, id: string, u: { id: string; rol: string }) {
  const v = await db
    .prepare(
      `SELECT o.id, o.cliente_id, o.conductor_id, v.estado FROM operaciones o
         JOIN viajes v ON v.operacion_id = o.id WHERE o.id = ?`,
    )
    .bind(id)
    .first<{ id: string; cliente_id: string; conductor_id: string | null; estado: string }>();
  const puede =
    v &&
    (u.rol === 'admin' || v.cliente_id === u.id || (v.conductor_id && v.conductor_id === u.id));
  if (!v || !puede) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  return v;
}

chatViaje.get('/viajes/:id/mensajes', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const v = await viajeDelChat(db, c.req.param('id'), u);
  const abierto = ACTIVOS.has(v.estado) && Boolean(v.conductor_id);
  // Terminado el viaje, pasajero y conductor ya no ven la conversación (el equipo sí).
  if (!abierto && u.rol !== 'admin') return c.json({ abierto: false, mensajes: [] });
  const desde = Number(c.req.query('desde') ?? 0);
  const pareja =
    u.rol === 'admin' ? '' : ` AND m.de_usuario_id IN (?3, ?4) AND m.creado_en >= COALESCE(?5, '')`;
  const inicio = u.rol === 'admin' ? null : await inicioDeLaPareja(db, v.id, v.conductor_id);
  const consulta = db.prepare(
    `SELECT m.id, m.de_usuario_id AS de, u.nombre, m.texto, m.creado_en AS en FROM mensajes_viaje m
       JOIN usuarios u ON u.id = m.de_usuario_id WHERE m.operacion_id = ?1 AND m.id > ?2${pareja}
      ORDER BY m.id LIMIT 200`,
  );
  const desdeId = Number.isFinite(desde) ? desde : 0;
  const { results } = await (
    u.rol === 'admin'
      ? consulta.bind(v.id, desdeId)
      : consulta.bind(v.id, desdeId, v.cliente_id, v.conductor_id, inicio)
  ).all<{ id: number; de: string; nombre: string; texto: string; en: string }>();
  return c.json({
    abierto,
    mensajes: results.map((m) => ({
      ...m,
      nombre: m.nombre.split(' ')[0],
      mio: m.de === u.id,
    })),
  });
});

chatViaje.post('/viajes/:id/mensajes', limiteIntentos(30, 60_000), async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const db = base(c);
  const v = await viajeDelChat(db, c.req.param('id'), u);
  if (!ACTIVOS.has(v.estado) || !v.conductor_id)
    throw new ErrorDatos('Este viaje ya no está activo: el chat se cerró.', undefined, 409);
  // Límite por persona (no por dirección de internet): lee el índice del viaje, no escribe nada.
  const recientes = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM mensajes_viaje WHERE operacion_id = ? AND de_usuario_id = ?
         AND creado_en > datetime('now', '-60 seconds')`,
    )
    .bind(v.id, u.id)
    .first<{ n: number }>();
  if (Number(recientes?.n ?? 0) >= MENSAJES_POR_MINUTO)
    throw new ErrorDatos(
      'Estás enviando muchos mensajes seguidos. Espera un momento.',
      undefined,
      429,
    );
  const { texto } = await leerCuerpo(c, z.object({ texto: z.string().trim().min(1).max(300) }));
  const limpio = sinContacto(texto);
  if (!limpio) throw new ErrorDatos('Escribe un mensaje.', 'texto', 422);
  await db
    .prepare('INSERT INTO mensajes_viaje (operacion_id, de_usuario_id, texto) VALUES (?, ?, ?)')
    .bind(v.id, u.id, limpio)
    .run();
  const para = u.id === v.cliente_id ? v.conductor_id : v.cliente_id;
  const destino = await db
    .prepare('SELECT idioma FROM usuarios WHERE id = ?')
    .bind(para)
    .first<{ idioma: string }>();
  await notificar(c.env, db, para, {
    ...AVISOS.mensaje(destino?.idioma === 'en' ? 'en' : 'es', u.nombre.split(' ')[0] ?? '', limpio),
    datos: { tipo: 'viaje', viajeId: v.id },
  }).catch((e: unknown) => console.error('chat del viaje: aviso', e));
  return c.json({ ok: true });
});
