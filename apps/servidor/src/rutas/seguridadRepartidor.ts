import { Hono } from 'hono';
import { z } from 'zod';
import { numeroEmergencia } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { correosEquipo } from '../avisosEquipo';
import { enviarCorreo } from '../correo';

/**
 * C-SEGURIDAD-REPARTIDOR (29 oct 2026), como el centro de seguridad de Dasher y Uber Driver:
 * botón de emergencia (avisa al equipo con el aviso de sistema, que nunca se apaga, y da el número
 * de emergencias del país), reportar un incidente y compartir el recorrido con un contacto por un
 * enlace secreto que dura 12 horas.
 */
export const seguridadRepartidor = new Hono<{ Bindings: Env; Variables: Variables }>();

const lugar = {
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
};

async function datosRepartidor(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT u.nombre, u.telefono, d.codigo, z.pais FROM usuarios u LEFT JOIN repartidores d ON d.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = d.zona_id WHERE u.id = ?`,
    )
    .bind(id)
    .first<{
      nombre: string;
      telefono: string | null;
      codigo: string | null;
      pais: string | null;
    }>();
}

seguridadRepartidor.post('/repartidor/emergencia', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, z.object({ ...lugar, pedidoId: z.string().max(80).optional() }));
  const db = base(c);
  const r = await datosRepartidor(db, u.id);
  await db
    .prepare(
      "INSERT INTO incidentes_repartidor (id, repartidor_id, tipo, pedido_id, lat, lng) VALUES (?, ?, 'emergencia', ?, ?, ?)",
    )
    .bind(nuevoId(), u.id, d.pedidoId ?? null, d.lat ?? null, d.lng ?? null)
    .run();
  const donde =
    d.lat != null && d.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`
      : 'sin ubicación';
  for (const para of await correosEquipo(c.env, 'sistema'))
    await enviarCorreo(c.env, {
      de: 'avisos',
      para,
      asunto: `EMERGENCIA de un repartidor: ${r?.nombre ?? ''} (${r?.codigo ?? ''})`,
      texto: `El repartidor ${r?.nombre ?? ''} (${r?.codigo ?? ''}, teléfono ${r?.telefono ?? 'sin teléfono'}) tocó el botón de emergencia.\n\nDónde: ${donde}\nPedido: ${d.pedidoId ?? 'ninguno'}\n\nLlámalo ya.`,
    }).catch((e: unknown) => console.error('seguridad: correo de emergencia', e));
  return c.json({ numero: numeroEmergencia(r?.pais) }, 201);
});

seguridadRepartidor.post('/repartidor/incidentes', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      ...lugar,
      motivo: z.enum(['accidente', 'acoso', 'robo', 'animal', 'otro']),
      detalle: z.string().trim().min(3, { error: 'Cuéntanos qué pasó.' }).max(1000),
      pedidoId: z.string().max(80).optional(),
    }),
  );
  const db = base(c);
  const r = await datosRepartidor(db, u.id);
  await db
    .prepare(
      "INSERT INTO incidentes_repartidor (id, repartidor_id, tipo, motivo, detalle, pedido_id, lat, lng) VALUES (?, ?, 'incidente', ?, ?, ?, ?, ?)",
    )
    .bind(nuevoId(), u.id, d.motivo, d.detalle, d.pedidoId ?? null, d.lat ?? null, d.lng ?? null)
    .run();
  for (const para of await correosEquipo(c.env, 'pedidos'))
    await enviarCorreo(c.env, {
      de: 'avisos',
      para,
      asunto: `Incidente de un repartidor (${d.motivo}): ${r?.nombre ?? ''}`,
      texto: `${r?.nombre ?? ''} (${r?.codigo ?? ''}, ${r?.telefono ?? 'sin teléfono'}) reportó un incidente: ${d.motivo}.\n\n${d.detalle}\n\nPedido: ${d.pedidoId ?? 'ninguno'}`,
    }).catch((e: unknown) => console.error('seguridad: correo de incidente', e));
  return c.json({ ok: true }, 201);
});

seguridadRepartidor.post('/repartidor/compartir-recorrido', async (c) => {
  const u = exigir(c, 'repartidor');
  const codigo = nuevoToken();
  await base(c)
    .prepare(
      "INSERT INTO recorridos_compartidos (huella, repartidor_id, expira_en) VALUES (?, ?, datetime('now', '+12 hours'))",
    )
    .bind(await sha256(codigo), u.id)
    .run();
  const sitio = (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');
  return c.json({ url: `${sitio}/driver-trip/${codigo}` }, 201);
});

seguridadRepartidor.get('/publico/recorrido/:codigo', async (c) => {
  const codigo = c.req.param('codigo');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(codigo))
    throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  const f = await base(c)
    .prepare(
      `SELECT u.nombre, d.lat, d.lng, d.ubicacion_en, d.conectado, s.expira_en > datetime('now') AS vigente
         FROM recorridos_compartidos s JOIN usuarios u ON u.id = s.repartidor_id
         LEFT JOIN repartidores d ON d.usuario_id = s.repartidor_id WHERE s.huella = ?`,
    )
    .bind(await sha256(codigo))
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  c.header('x-robots-tag', 'noindex, nofollow');
  if (!Number(f.vigente)) return c.json({ recorrido: { terminado: true } });
  return c.json({
    recorrido: {
      terminado: false,
      nombre: String(f.nombre ?? '').split(' ')[0],
      conectado: Number(f.conectado ?? 0) === 1,
      ubicacion: f.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
      ubicacionEn: f.ubicacion_en ?? null,
    },
  });
});

seguridadRepartidor.get('/admin/seguridad', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT i.id, i.tipo, i.motivo, i.detalle, i.pedido_id AS pedidoId, i.lat, i.lng, i.creado_en AS fecha,
              u.nombre, d.codigo FROM incidentes_repartidor i JOIN usuarios u ON u.id = i.repartidor_id
         LEFT JOIN repartidores d ON d.usuario_id = i.repartidor_id ORDER BY i.creado_en DESC LIMIT 200`,
    )
    .all();
  return c.json({ incidentes: results });
});
