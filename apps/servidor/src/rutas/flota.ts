import { Hono } from 'hono';
import { z } from 'zod';
import { correoCanonico, telefonoCanonico } from '@tumbite/compartido';
import { enviarCorreo } from '../correo';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { entornoDe } from '../entorno';
import type { Env } from '../env';
import { notificar } from '../notificaciones';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { exigirMiRestaurante } from './catalogo';

/**
 * C-FLOTA-PROPIA (10 nov 2026, punto B3) — Chile y todos los países.
 * Un restaurante con sus propios repartidores, como Self-Delivery de DoorDash y «usar tus propios
 * repartidores» de Uber Eats (ficha docs/investigaciones-rea/2026-11-10-flota-propia-restaurante.md):
 * los invita con el mismo mecanismo de Flex, ellos usan Divoox Driver y reciben SOLO los pedidos de
 * ese restaurante; el cliente ve el mismo seguimiento. Si su flota no puede y el restaurante encendió
 * el respaldo, el pedido pasa a la red de Divoox; si no, se le avisa (nunca cae solo a la red).
 * Encendido solo en el sitio de pruebas: el reparto del dinero con flota propia lo decide Richard.
 */
export const flota = new Hono<{ Bindings: Env; Variables: Variables }>();

export const flotaPropiaDisponible = (c: Ctx): boolean =>
  entornoDe(c.req.url) === 'pruebas' || c.env.FLOTA_PROPIA === '1';

/** usuario → restaurante, solo de restaurantes que hoy trabajan con flota propia. */
export async function flotasActivas(db: D1Database): Promise<Map<string, string>> {
  const { results } = await db
    .prepare(
      `SELECT f.usuario_id, f.restaurante_id FROM flota_restaurante f
       JOIN restaurantes r ON r.id = f.restaurante_id
       WHERE f.estado = 'activo' AND r.flota_modo = 'propia'`,
    )
    .all<{ usuario_id: string; restaurante_id: string }>();
  return new Map(results.map((f) => [f.usuario_id, f.restaurante_id]));
}

// ───────────────────────── El restaurante ─────────────────────────

flota.get('/mi-restaurante/flota', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  const db = base(c);
  const r = await db
    .prepare('SELECT nombre, flota_modo, flota_respaldo FROM restaurantes WHERE id = ?')
    .bind(rid)
    .first<{ nombre: string; flota_modo: string; flota_respaldo: number }>();
  const { results: repartidores } = await db
    .prepare(
      `SELECT u.id, u.nombre, COALESCE(d.conectado, 0) AS conectado,
        EXISTS (SELECT 1 FROM pedidos p WHERE p.repartidor_id = u.id AND p.estado IN ('aceptado','listo','en_camino')) AS ocupado
       FROM flota_restaurante f JOIN usuarios u ON u.id = f.usuario_id
       LEFT JOIN repartidores d ON d.usuario_id = u.id
       WHERE f.restaurante_id = ? AND f.estado = 'activo' ORDER BY u.nombre`,
    )
    .bind(rid)
    .all<{ id: string; nombre: string; conectado: number; ocupado: number }>();
  const { results: invitaciones } = await db
    .prepare(
      `SELECT id, nombre, correo_canonico AS correo, telefono_canonico AS telefono, creado_en AS fecha
       FROM invitaciones_flota WHERE restaurante_id = ? AND estado = 'pendiente' AND vence_en > datetime('now')
       ORDER BY creado_en DESC`,
    )
    .bind(rid)
    .all();
  // Pedidos que esperan repartidor y para los que su flota no tuvo a nadie libre.
  const { results: sinRepartidor } = await db
    .prepare(
      `SELECT id, substr(id, 1, 4) AS codigo, flota_aviso_en AS desde FROM pedidos
       WHERE restaurante_id = ? AND estado IN ('aceptado','listo') AND repartidor_id IS NULL
       AND flota_aviso_en IS NOT NULL ORDER BY flota_aviso_en`,
    )
    .bind(rid)
    .all();
  return c.json({
    disponible: flotaPropiaDisponible(c),
    restaurante: r?.nombre ?? '',
    modo: r?.flota_modo === 'propia' ? 'propia' : 'divoox',
    respaldo: Number(r?.flota_respaldo ?? 0) === 1,
    repartidores: repartidores.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      conectado: Number(x.conectado) === 1,
      ocupado: Number(x.ocupado) === 1,
    })),
    invitaciones,
    sinRepartidor,
  });
});

flota.put('/mi-restaurante/flota', async (c) => {
  const rid = await exigirMiRestaurante(c, 'dueno');
  const d = await leerCuerpo(
    c,
    z.object({ modo: z.enum(['divoox', 'propia']), respaldo: z.boolean().default(false) }),
  );
  if (d.modo === 'propia' && !flotaPropiaDisponible(c))
    throw new ErrorDatos(
      'La flota propia todavía no está disponible en tu ciudad. Te avisamos apenas se pueda encender.',
      'modo',
      409,
    );
  await base(c)
    .prepare('UPDATE restaurantes SET flota_modo = ?, flota_respaldo = ? WHERE id = ?')
    .bind(d.modo, d.respaldo ? 1 : 0, rid)
    .run();
  return c.json({ ok: true, modo: d.modo, respaldo: d.respaldo });
});

const esquemaInvitacion = z
  .object({
    nombre: z.string().trim().min(2, { error: 'Escribe el nombre del repartidor.' }).max(80),
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'Escribe un correo válido.' }))
      .or(z.literal(''))
      .default(''),
    telefono: z.string().trim().max(30).default(''),
  })
  .refine((d) => d.correo !== '' || d.telefono.length >= 7, {
    error: 'Escribe el correo o el celular del repartidor.',
    path: ['correo'],
  });

flota.post('/mi-restaurante/flota/invitaciones', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  const u = exigir(c, 'restaurante');
  const d = await leerCuerpo(c, esquemaInvitacion);
  const db = base(c);
  const r = await db
    .prepare('SELECT nombre FROM restaurantes WHERE id = ?')
    .bind(rid)
    .first<{ nombre: string }>();
  const token = nuevoToken();
  const id = nuevoId();
  const correo = d.correo ? correoCanonico(d.correo) : null;
  const telefono = telefonoCanonico(d.telefono);
  await db
    .prepare(
      `INSERT INTO invitaciones_flota (id, restaurante_id, nombre, correo_canonico, telefono_canonico, token_hash, invitado_por)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .bind(id, rid, d.nombre, correo, telefono, await sha256(token), u.id)
    .run();
  const sitio = (c.env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
  const enlace = `${sitio}/driver/fleet/${token}`;
  const nombre = r?.nombre ?? 'Un restaurante';
  const avisos: Promise<unknown>[] = [];
  if (d.correo)
    avisos.push(
      enviarCorreo(c.env, {
        de: 'avisos',
        para: d.correo,
        asunto: `${nombre} te invitó a su equipo de reparto en Divoox Driver`,
        texto: `${nombre} te invitó a repartir sus pedidos con Divoox Driver. Instala la app, entra con este correo y acepta la invitación: ${enlace}`,
      }),
    );
  // Si ya reparte con Divoox Driver, también le llega al celular.
  const ya = await db
    .prepare(
      `SELECT id, idioma FROM usuarios WHERE rol = 'repartidor' AND activo = 1
        AND ((?1 IS NOT NULL AND telefono_canonico = ?1) OR (?2 IS NOT NULL AND correo_canonico = ?2)) LIMIT 1`,
    )
    .bind(telefono, correo)
    .first<{ id: string; idioma: string }>();
  if (ya)
    avisos.push(
      notificar(c.env, db, ya.id, {
        titulo: ya.idioma === 'en' ? `${nombre} invited you` : `${nombre} te invitó`,
        cuerpo:
          ya.idioma === 'en'
            ? 'Open Divoox Driver and accept to deliver this restaurant’s orders.'
            : 'Abre Divoox Driver y acepta para repartir los pedidos de este restaurante.',
        datos: { tipo: 'flota_invitacion' },
      }),
    );
  // Nunca frena: si el correo no sale, el restaurante tiene el enlace para mandarlo él.
  await Promise.allSettled(avisos);
  return c.json({ invitacion: { id, nombre: d.nombre, estado: 'pendiente' }, enlace }, 201);
});

flota.delete('/mi-restaurante/flota/invitaciones/:id', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  await base(c)
    .prepare(
      `UPDATE invitaciones_flota SET estado = 'cancelada', respondida_en = datetime('now')
       WHERE id = ? AND restaurante_id = ? AND estado = 'pendiente'`,
    )
    .bind(c.req.param('id'), rid)
    .run();
  return c.json({ ok: true });
});

flota.delete('/mi-restaurante/flota/repartidores/:usuarioId', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  await base(c)
    .prepare(
      `UPDATE flota_restaurante SET estado = 'retirado', retirado_en = datetime('now')
       WHERE restaurante_id = ? AND usuario_id = ? AND estado = 'activo'`,
    )
    .bind(rid, c.req.param('usuarioId'))
    .run();
  return c.json({ ok: true });
});

// ───────────────────────── El enlace público ─────────────────────────

type FilaInvitacion = {
  id: string;
  restaurante_id: string;
  nombre: string;
  estado: string;
  vencida: number;
  restaurante: string;
};
const SELECT_INVITACION = `SELECT i.id, i.restaurante_id, i.nombre, i.estado, i.vence_en <= datetime('now') AS vencida, r.nombre AS restaurante
  FROM invitaciones_flota i JOIN restaurantes r ON r.id = i.restaurante_id`;

flota.get('/flota/invitacion/:token', async (c) => {
  const f = await base(c)
    .prepare(`${SELECT_INVITACION} WHERE i.token_hash = ?`)
    .bind(await sha256(c.req.param('token')))
    .first<FilaInvitacion>();
  if (!f) throw new ErrorDatos('Esta invitación no existe o ya no sirve.', undefined, 404);
  return c.json({
    restaurante: f.restaurante,
    nombre: f.nombre,
    estado: f.estado === 'pendiente' && Number(f.vencida) === 1 ? 'vencida' : f.estado,
  });
});

// ───────────────────────── El repartidor ─────────────────────────

flota.get('/repartidor/flota', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const mia = await db
    .prepare(
      `SELECT r.id, r.nombre, r.flota_modo FROM flota_restaurante f JOIN restaurantes r ON r.id = f.restaurante_id
       WHERE f.usuario_id = ? AND f.estado = 'activo'`,
    )
    .bind(u.id)
    .first<{ id: string; nombre: string; flota_modo: string }>();
  const yo = await db
    .prepare('SELECT correo_canonico, telefono_canonico FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ correo_canonico: string | null; telefono_canonico: string | null }>();
  const { results } = await db
    .prepare(
      `SELECT i.id, r.nombre AS restaurante, i.creado_en AS fecha FROM invitaciones_flota i
       JOIN restaurantes r ON r.id = i.restaurante_id
       WHERE i.estado = 'pendiente' AND i.vence_en > datetime('now')
       AND ((?1 IS NOT NULL AND i.correo_canonico = ?1) OR (?2 IS NOT NULL AND i.telefono_canonico = ?2))
       ORDER BY i.creado_en DESC`,
    )
    .bind(yo?.correo_canonico ?? correoCanonico(u.correo), yo?.telefono_canonico ?? null)
    .all();
  return c.json({
    flota: mia
      ? { restauranteId: mia.id, restaurante: mia.nombre, exclusiva: mia.flota_modo === 'propia' }
      : null,
    invitaciones: results,
  });
});

/** Entra a la flota: una sola flota activa por repartidor (la anterior se retira). */
async function entrar(db: D1Database, usuarioId: string, inv: FilaInvitacion) {
  if (inv.estado !== 'pendiente' || Number(inv.vencida) === 1)
    throw new ErrorDatos('Esta invitación ya no está disponible.', undefined, 409);
  await db.batch([
    db
      .prepare(
        `UPDATE flota_restaurante SET estado = 'retirado', retirado_en = datetime('now')
         WHERE usuario_id = ? AND estado = 'activo' AND restaurante_id <> ?`,
      )
      .bind(usuarioId, inv.restaurante_id),
    db
      .prepare(
        `INSERT INTO flota_restaurante (restaurante_id, usuario_id) VALUES (?, ?)
         ON CONFLICT(restaurante_id, usuario_id) DO UPDATE SET estado = 'activo', retirado_en = NULL`,
      )
      .bind(inv.restaurante_id, usuarioId),
    db
      .prepare(
        `UPDATE invitaciones_flota SET estado = 'aceptada', usuario_id = ?, respondida_en = datetime('now') WHERE id = ?`,
      )
      .bind(usuarioId, inv.id),
  ]);
}

flota.post('/repartidor/flota/enlace/:token/aceptar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const inv = await db
    .prepare(`${SELECT_INVITACION} WHERE i.token_hash = ?`)
    .bind(await sha256(c.req.param('token')))
    .first<FilaInvitacion>();
  if (!inv) throw new ErrorDatos('Esta invitación no existe o ya no sirve.', undefined, 404);
  await entrar(db, u.id, inv);
  return c.json({ ok: true, restaurante: inv.restaurante });
});

flota.post('/repartidor/flota/invitaciones/:id/:respuesta', async (c) => {
  const u = exigir(c, 'repartidor');
  const respuesta = z.enum(['aceptar', 'rechazar']).parse(c.req.param('respuesta'));
  const db = base(c);
  const yo = await db
    .prepare('SELECT correo_canonico, telefono_canonico FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ correo_canonico: string | null; telefono_canonico: string | null }>();
  // Solo una invitación dirigida a su correo o a su celular.
  const inv = await db
    .prepare(
      `${SELECT_INVITACION} WHERE i.id = ?1
       AND ((?2 IS NOT NULL AND i.correo_canonico = ?2) OR (?3 IS NOT NULL AND i.telefono_canonico = ?3))`,
    )
    .bind(
      c.req.param('id'),
      yo?.correo_canonico ?? correoCanonico(u.correo),
      yo?.telefono_canonico ?? null,
    )
    .first<FilaInvitacion>();
  if (!inv) throw new ErrorDatos('Esta invitación no existe o ya no sirve.', undefined, 404);
  if (respuesta === 'rechazar') {
    await db
      .prepare(
        `UPDATE invitaciones_flota SET estado = 'rechazada', usuario_id = ?, respondida_en = datetime('now')
         WHERE id = ? AND estado = 'pendiente'`,
      )
      .bind(u.id, inv.id)
      .run();
    return c.json({ ok: true });
  }
  await entrar(db, u.id, inv);
  return c.json({ ok: true, restaurante: inv.restaurante });
});

/** El repartidor sale de la flota por su cuenta. */
flota.delete('/repartidor/flota', async (c) => {
  const u = exigir(c, 'repartidor');
  await base(c)
    .prepare(
      `UPDATE flota_restaurante SET estado = 'retirado', retirado_en = datetime('now')
       WHERE usuario_id = ? AND estado = 'activo'`,
    )
    .bind(u.id)
    .run();
  return c.json({ ok: true });
});
