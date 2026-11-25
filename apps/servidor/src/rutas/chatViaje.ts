import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { AVISOS, notificar } from '../notificaciones';
import { type Variables, base, exigir } from '../sesion';
import { limiteIntentos } from '../seguridad';
import { ErrorDatos, leerCuerpo } from '../validar';
import { sinContacto } from './viajesHistorial';
import { taparOfensivas } from '../filtroPalabras';
import { bloqueo, marcarPorFiltro } from './moderacion';

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

/**
 * C-CHAT-VIAJE-LLEGA (24 nov 2026, prueba real: el pasajero no vio los mensajes del conductor). Lo que
 * la ficha del viaje (la que las dos apps ya consultan) dice del chat: cuántos mensajes de la otra
 * persona no ha visto quien pregunta y el último mensaje (corto, de quién y la hora). Solo lee: la
 * marca de «visto» la escribe `POST /viajes/:id/mensajes/visto` al abrir el chat, una vez por cambio.
 */
export async function resumenChatViaje(
  db: D1Database,
  operacionId: string,
  yoId: string,
): Promise<{
  mensajesSinLeer: number;
  ultimoMensaje: { texto: string; mio: boolean; nombre: string; en: string } | null;
}> {
  const v = await db
    .prepare(
      `SELECT o.cliente_id, o.conductor_id, v.estado, v.chat_visto_cliente, v.chat_visto_conductor
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id WHERE o.id = ?`,
    )
    .bind(operacionId)
    .first<{
      cliente_id: string;
      conductor_id: string | null;
      estado: string;
      chat_visto_cliente: number | null;
      chat_visto_conductor: number | null;
    }>();
  if (!v || !v.conductor_id || !ACTIVOS.has(v.estado))
    return { mensajesSinLeer: 0, ultimoMensaje: null };
  const soyCliente = yoId === v.cliente_id;
  if (!soyCliente && yoId !== v.conductor_id) return { mensajesSinLeer: 0, ultimoMensaje: null };
  const visto = Number((soyCliente ? v.chat_visto_cliente : v.chat_visto_conductor) ?? 0);
  const otro = soyCliente ? v.conductor_id : v.cliente_id;
  const inicio = await inicioDeLaPareja(db, operacionId, v.conductor_id);
  const filtro = `m.operacion_id = ?1 AND m.texto <> '' AND m.de_usuario_id IN (?2, ?3)
      AND m.creado_en >= COALESCE(?4, '')
      AND m.de_usuario_id NOT IN (SELECT bloqueado_id FROM bloqueos_usuario WHERE usuario_id = ?2)
      AND NOT EXISTS (SELECT 1 FROM contenido_oculto x WHERE x.tipo = 'mensaje_viaje' AND x.ref = CAST(m.id AS TEXT))`;
  const [sinLeer, ultimo] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM mensajes_viaje m WHERE ${filtro} AND m.de_usuario_id = ?3 AND m.id > ?5`,
      )
      .bind(operacionId, yoId, otro, inicio, visto)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT m.de_usuario_id AS de, u.nombre, m.texto, m.creado_en AS en FROM mensajes_viaje m
           JOIN usuarios u ON u.id = m.de_usuario_id WHERE ${filtro} ORDER BY m.id DESC LIMIT 1`,
      )
      .bind(operacionId, yoId, otro, inicio)
      .first<{ de: string; nombre: string; texto: string; en: string }>(),
  ]);
  return {
    mensajesSinLeer: Number(sinLeer?.n ?? 0),
    ultimoMensaje: ultimo
      ? {
          texto: ultimo.texto.length > 90 ? `${ultimo.texto.slice(0, 89)}…` : ultimo.texto,
          mio: ultimo.de === yoId,
          nombre: ultimo.nombre.split(' ')[0] ?? '',
          en: ultimo.en,
        }
      : null,
  };
}

/**
 * C-CHAT-VIAJE-LLEGA: «ya lo vi». Al abrir el chat (y mientras está abierto y llega algo nuevo), la
 * app marca hasta el último mensaje que se le muestra. Una sola escritura y solo si avanza: abrir
 * otra vez sin nada nuevo no escribe nada. Por persona (pasajero o conductor) y por viaje.
 */
chatViaje.post('/viajes/:id/mensajes/visto', limiteIntentos(60, 60_000), async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const db = base(c);
  const v = await viajeDelChat(db, c.req.param('id'), u);
  const col = u.id === v.cliente_id ? 'chat_visto_cliente' : 'chat_visto_conductor';
  const ultimo = await db
    .prepare('SELECT MAX(id) AS id FROM mensajes_viaje WHERE operacion_id = ?')
    .bind(v.id)
    .first<{ id: number | null }>();
  const hasta = Number(ultimo?.id ?? 0);
  if (hasta > 0)
    await db
      .prepare(`UPDATE viajes SET ${col} = ?1 WHERE operacion_id = ?2 AND COALESCE(${col}, 0) < ?1`)
      .bind(hasta, v.id)
      .run();
  return c.json({ ok: true, ...(await resumenChatViaje(db, v.id, u.id)) });
});

chatViaje.get('/viajes/:id/mensajes', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const v = await viajeDelChat(db, c.req.param('id'), u);
  const abierto = ACTIVOS.has(v.estado) && Boolean(v.conductor_id);
  // Terminado el viaje, pasajero y conductor ya no ven la conversación (el equipo sí).
  if (!abierto && u.rol !== 'admin') return c.json({ abierto: false, mensajes: [] });
  const desde = Number(c.req.query('desde') ?? 0);
  // C-MODERACION: sin los mensajes de quien bloqueó (?6) ni lo que el equipo ocultó.
  const pareja =
    u.rol === 'admin'
      ? ''
      : ` AND m.de_usuario_id IN (?3, ?4) AND m.creado_en >= COALESCE(?5, '')
          AND m.de_usuario_id NOT IN (SELECT bloqueado_id FROM bloqueos_usuario WHERE usuario_id = ?6)
          AND NOT EXISTS (SELECT 1 FROM contenido_oculto o WHERE o.tipo = 'mensaje_viaje' AND o.ref = CAST(m.id AS TEXT))`;
  const inicio = u.rol === 'admin' ? null : await inicioDeLaPareja(db, v.id, v.conductor_id);
  const consulta = db.prepare(
    `SELECT m.id, m.de_usuario_id AS de, u.nombre, m.texto, m.creado_en AS en FROM mensajes_viaje m
       JOIN usuarios u ON u.id = m.de_usuario_id WHERE m.operacion_id = ?1 AND m.id > ?2 AND m.texto <> ''${pareja}
      ORDER BY m.id LIMIT 200`,
  );
  const desdeId = Number.isFinite(desde) ? desde : 0;
  const { results } = await (
    u.rol === 'admin'
      ? consulta.bind(v.id, desdeId)
      : consulta.bind(v.id, desdeId, v.cliente_id, v.conductor_id, inicio, u.id)
  ).all<{ id: number; de: string; nombre: string; texto: string; en: string }>();
  const otro = u.id === v.cliente_id ? v.conductor_id : v.cliente_id;
  return c.json({
    abierto,
    bloqueaste: u.rol !== 'admin' && otro ? await bloqueo(db, u.id, otro) : false,
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
  const sinDatos = sinContacto(texto);
  if (!sinDatos) throw new ErrorDatos('Escribe un mensaje.', 'texto', 422);
  // C-MODERACION: las palabras ofensivas se tapan y el mensaje queda en la bandeja del equipo.
  const { texto: limpio, tapado } = taparOfensivas(sinDatos);
  const nuevo = await db
    .prepare('INSERT INTO mensajes_viaje (operacion_id, de_usuario_id, texto) VALUES (?, ?, ?)')
    .bind(v.id, u.id, limpio)
    .run();
  if (tapado)
    await marcarPorFiltro(db, {
      tipo: 'mensaje_viaje',
      ref: String(nuevo.meta.last_row_id),
      objeto: 'viaje',
      objetoId: v.id,
      autorId: u.id,
      texto: sinDatos,
    });
  const para = u.id === v.cliente_id ? v.conductor_id : v.cliente_id;
  // Si la otra persona lo bloqueó, no recibe el aviso (y quien escribe no se entera).
  if (await bloqueo(db, para, u.id)) return c.json({ ok: true });
  await notificar(
    c.env,
    db,
    { id: para, app: para === v.conductor_id ? 'repartidor' : 'cliente' },
    (i) => ({
      ...AVISOS.mensaje(i, u.nombre.split(' ')[0] ?? '', limpio),
      // C-CHAT-VIAJE-LLEGA: `mensaje` hace que tocar el aviso abra el viaje con el chat abierto.
      datos: { tipo: 'viaje', viajeId: v.id, mensaje: '1' },
    }),
  ).catch((e: unknown) => console.error('chat del viaje: aviso', e));
  return c.json({ ok: true });
});
