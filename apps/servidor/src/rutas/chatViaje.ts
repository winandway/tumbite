import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { AVISOS, notificar } from '../notificaciones';
import { type Variables, base, exigir } from '../sesion';
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
  const { results } = await db
    .prepare(
      `SELECT m.id, m.de_usuario_id AS de, u.nombre, m.texto, m.creado_en AS en FROM mensajes_viaje m
         JOIN usuarios u ON u.id = m.de_usuario_id WHERE m.operacion_id = ? AND m.id > ? ORDER BY m.id LIMIT 200`,
    )
    .bind(v.id, Number.isFinite(desde) ? desde : 0)
    .all<{ id: number; de: string; nombre: string; texto: string; en: string }>();
  return c.json({
    abierto,
    mensajes: results.map((m) => ({
      ...m,
      nombre: m.nombre.split(' ')[0],
      mio: m.de === u.id,
    })),
  });
});

chatViaje.post('/viajes/:id/mensajes', async (c) => {
  const u = exigir(c, 'cliente', 'repartidor');
  const db = base(c);
  const v = await viajeDelChat(db, c.req.param('id'), u);
  if (!ACTIVOS.has(v.estado) || !v.conductor_id)
    throw new ErrorDatos('Este viaje ya no está activo: el chat se cerró.', undefined, 409);
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
