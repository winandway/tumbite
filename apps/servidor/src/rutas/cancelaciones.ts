import { Hono } from 'hono';
import { z } from 'zod';
import {
  IDS_MOTIVO_CANCELACION,
  type PagaComida,
  motivoCancelacion,
  textoMotivoCancelacion,
} from '@tumbite/compartido';
import { nuevoId } from '../cripto';
import type { Env } from '../env';
import { anotarEvento, cancelarConReembolso } from '../manager';
import { notificar } from '../notificaciones';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { crearTicket } from './tickets';

/**
 * C-CANCELAR-LISTO (10 nov 2026, punto D1) — todos los países.
 * Un pedido ya «listo» tiene comida hecha y, a veces, un repartidor en camino: como en DoorDash y
 * Uber Eats, el restaurante no lo cancela solo. Pide la cancelación a soporte con un motivo de la
 * lista; el motivo dice quién asume la comida preparada. Soporte aprueba (se cancela y el cliente
 * recibe todo su dinero) o rechaza (el pedido sigue). Ficha:
 * docs/investigaciones-rea/2026-11-10-cancelar-pedido-listo.md.
 */
export const cancelaciones = new Hono<{ Bindings: Env; Variables: Variables }>();

type Fila = {
  id: string;
  pedido_id: string;
  restaurante_id: string;
  restaurante?: string;
  motivo: string;
  detalle: string;
  paga_comida: string;
  estado: string;
  nota_soporte: string;
  creado_en: string;
  resuelta_en: string | null;
};
const aSolicitud = (f: Fila) => ({
  id: f.id,
  pedidoId: f.pedido_id,
  codigo: f.pedido_id.slice(0, 4).toUpperCase(),
  restaurante: f.restaurante,
  motivo: f.motivo,
  detalle: f.detalle,
  pagaComida: f.paga_comida as PagaComida,
  estado: f.estado,
  notaSoporte: f.nota_soporte,
  creada: f.creado_en,
  resuelta: f.resuelta_en,
});

const esquemaPedir = z
  .object({
    motivo: z.enum(IDS_MOTIVO_CANCELACION, { error: 'Elige el motivo de la cancelación.' }),
    detalle: z.string().trim().max(300).default(''),
  })
  .refine((d) => d.motivo !== 'otro' || d.detalle.length >= 3, {
    error: 'Cuéntanos qué pasó.',
    path: ['detalle'],
  });

cancelaciones.post('/restaurante/pedidos/:id/pedir-cancelacion', async (c) => {
  const u = exigir(c, 'restaurante');
  const d = await leerCuerpo(c, esquemaPedir);
  const db = base(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      `SELECT p.id, p.estado, p.zona_id, r.id AS rid, r.nombre AS restaurante FROM pedidos p
       JOIN restaurantes r ON r.id = p.restaurante_id
       WHERE p.id = ?1 AND (r.dueno_id = ?2 OR r.id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?2))`,
    )
    .bind(id, u.id)
    .first<{ id: string; estado: string; zona_id: string; rid: string; restaurante: string }>();
  if (!p) throw new ErrorDatos('No encontramos ese pedido.', undefined, 404);
  if (p.estado !== 'listo')
    throw new ErrorDatos(
      'Solo se pide a soporte la cancelación de un pedido que ya está listo y todavía no salió.',
      undefined,
      409,
    );
  const ya = await db
    .prepare("SELECT 1 FROM solicitudes_cancelacion WHERE pedido_id = ? AND estado = 'pendiente'")
    .bind(id)
    .first();
  if (ya)
    throw new ErrorDatos(
      'Ya pediste la cancelación de este pedido. Soporte la está revisando.',
      undefined,
      409,
    );
  const paga = motivoCancelacion(d.motivo)?.paga ?? 'por_definir';
  const sid = nuevoId();
  const codigo = id.slice(0, 4).toUpperCase();
  // El caso de soporte va primero: si no se puede abrir, no queda una solicitud que nadie ve.
  const caso = await crearTicket(c.env, db, {
    tipo: 'soporte',
    nombre: u.nombre,
    correo: u.correo,
    idioma: u.idioma,
    asunto: `Cancelar pedido listo ${codigo} · ${p.restaurante}`,
    mensaje: [
      `El restaurante pide cancelar el pedido ${codigo}, que ya está listo.`,
      `Motivo: ${textoMotivoCancelacion(d.motivo, 'es')}.`,
      d.detalle ? `Detalle: ${d.detalle}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    datos: { origen: 'cancelar_listo', solicitudId: sid, motivo: d.motivo, pagaComida: paga },
    usuarioId: u.id,
    pedidoId: id,
    zonaId: p.zona_id,
  });
  await db.batch([
    db
      .prepare(
        `INSERT INTO solicitudes_cancelacion (id, pedido_id, restaurante_id, pedida_por, motivo, detalle, paga_comida, ticket_id)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .bind(sid, id, p.rid, u.id, d.motivo, d.detalle, paga, caso.id),
    db.prepare("UPDATE tickets SET prioridad = 'alta' WHERE id = ?").bind(caso.id),
  ]);
  await anotarEvento(db, id, 'cancelacion_pedida_por_restaurante', d.motivo);
  const f = await db
    .prepare('SELECT * FROM solicitudes_cancelacion WHERE id = ?')
    .bind(sid)
    .first<Fila>();
  return c.json({ solicitud: aSolicitud(f!) }, 201);
});

/** Las solicitudes de mi restaurante (pendientes y de las últimas 24 horas). */
cancelaciones.get('/restaurante/cancelaciones', async (c) => {
  const u = exigir(c, 'restaurante');
  const { results } = await base(c)
    .prepare(
      `SELECT s.* FROM solicitudes_cancelacion s JOIN restaurantes r ON r.id = s.restaurante_id
       WHERE (r.dueno_id = ?1 OR r.id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1))
       AND (s.estado = 'pendiente' OR s.creado_en > datetime('now', '-1 day'))
       ORDER BY s.creado_en DESC LIMIT 50`,
    )
    .bind(u.id)
    .all<Fila>();
  return c.json({ solicitudes: results.map(aSolicitud) });
});

// ───────────────────────── Soporte ─────────────────────────

cancelaciones.get('/admin/cancelaciones', async (c) => {
  exigir(c, 'admin');
  const estado = z
    .enum(['pendiente', 'aprobada', 'rechazada'])
    .catch('pendiente')
    .parse(c.req.query('estado'));
  const pedido = c.req.query('pedido');
  const { results } = await base(c)
    .prepare(
      `SELECT s.*, r.nombre AS restaurante FROM solicitudes_cancelacion s
       JOIN restaurantes r ON r.id = s.restaurante_id
       WHERE ${pedido ? 's.pedido_id = ?' : 's.estado = ?'} ORDER BY s.creado_en DESC LIMIT 100`,
    )
    .bind(pedido ?? estado)
    .all<Fila>();
  return c.json({ solicitudes: results.map(aSolicitud) });
});

const esquemaResolver = z.object({
  nota: z.string().trim().max(300).default(''),
  /** Soporte puede corregir quién asume la comida después de revisar el caso. */
  pagaComida: z.enum(['restaurante', 'cliente', 'divoox']).optional(),
});

cancelaciones.post('/admin/cancelaciones/:id/:decision', async (c) => {
  const admin = exigir(c, 'admin');
  const decision = z.enum(['aprobar', 'rechazar']).parse(c.req.param('decision'));
  const d = await leerCuerpo(c, esquemaResolver);
  const db = base(c);
  const s = await db
    .prepare(
      `SELECT s.*, r.dueno_id FROM solicitudes_cancelacion s JOIN restaurantes r ON r.id = s.restaurante_id
       WHERE s.id = ? AND s.estado = 'pendiente'`,
    )
    .bind(c.req.param('id'))
    .first<Fila & { dueno_id: string }>();
  if (!s) throw new ErrorDatos('Esta solicitud ya fue resuelta.', undefined, 409);
  const paga = d.pagaComida ?? s.paga_comida;
  if (decision === 'aprobar') {
    if (paga === 'por_definir')
      throw new ErrorDatos('Elige quién asume la comida antes de aprobar.', 'pagaComida', 400);
    const ok = await cancelarConReembolso(c.env, db, s.pedido_id, {
      desde: ['listo'],
      actorId: admin.id,
    });
    if (!ok)
      throw new ErrorDatos(
        'Este pedido ya no está listo (salió o ya se canceló). Revisa el pedido.',
        undefined,
        409,
      );
    await anotarEvento(
      db,
      s.pedido_id,
      'cancelado_por_soporte',
      `${s.motivo} · comida: ${paga}${d.nota ? ` · ${d.nota}` : ''}`,
    );
  }
  await db
    .prepare(
      `UPDATE solicitudes_cancelacion SET estado = ?, paga_comida = ?, nota_soporte = ?, resuelta_por = ?, resuelta_en = datetime('now')
       WHERE id = ? AND estado = 'pendiente'`,
    )
    .bind(decision === 'aprobar' ? 'aprobada' : 'rechazada', paga, d.nota, admin.id, s.id)
    .run();
  const codigo = s.pedido_id.slice(0, 4).toUpperCase();
  await notificar(c.env, db, s.dueno_id, {
    titulo:
      decision === 'aprobar' ? `Pedido ${codigo} cancelado` : `El pedido ${codigo} sigue en curso`,
    cuerpo:
      decision === 'aprobar'
        ? 'Soporte aprobó la cancelación. El cliente recibe su dinero.'
        : `Soporte no aprobó la cancelación.${d.nota ? ` ${d.nota}` : ''}`,
    datos: { tipo: 'cancelacion_resuelta', pedidoId: s.pedido_id },
  }).catch((e: unknown) => console.error('cancelaciones: no se pudo avisar al restaurante', e));
  return c.json({ ok: true, estado: decision === 'aprobar' ? 'aprobada' : 'rechazada' });
});
