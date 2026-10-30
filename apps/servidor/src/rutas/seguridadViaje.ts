import { Hono } from 'hono';
import { z } from 'zod';
import { bloqueoPorHoras, esDeNoche, seDesvio, telefonoCanonico } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId, nuevoToken, sha256 } from '../cripto';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { enviarSms } from '../sms';
import { ErrorDatos, leerCuerpo } from '../validar';
import { registrarEmergencia } from './viajesPasajero';

/**
 * C-VIAJE-SEGURIDAD-2 (30 oct 2026), copiado del kit de seguridad de Uber:
 * - contactos de confianza (hasta 5) que reciben por mensaje el enlace del viaje en vivo al empezar,
 *   siempre o solo de noche, como elija el pasajero;
 * - si el conductor se sale de la ruta, la app del pasajero pregunta «¿Todo bien?» (RideCheck);
 * - límite de horas al volante: con 12 horas manejando en 24, no recibe viajes hasta descansar 6.
 */
export const seguridadViaje = new Hono<{ Bindings: Env; Variables: Variables }>();

export const MAX_CONTACTOS = 5;

seguridadViaje.get('/seguridad', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const { results } = await db
    .prepare(
      'SELECT id, nombre, telefono FROM contactos_confianza WHERE cliente_id = ? ORDER BY creado_en',
    )
    .bind(u.id)
    .all<{ id: string; nombre: string; telefono: string }>();
  const a = await db
    .prepare('SELECT compartir FROM ajustes_seguridad WHERE cliente_id = ?')
    .bind(u.id)
    .first<{ compartir: string }>();
  return c.json({ contactos: results, compartir: a?.compartir ?? 'nunca' });
});

seguridadViaje.post('/seguridad/contactos', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(1, { error: 'Escribe el nombre.' }).max(60),
      telefono: z.string().trim().min(7).max(20),
    }),
  );
  const telefono = telefonoCanonico(d.telefono);
  if (!telefono) throw new ErrorDatos('Ese número no parece un celular.', 'telefono');
  const db = base(c);
  const n = await db
    .prepare('SELECT COUNT(*) AS n FROM contactos_confianza WHERE cliente_id = ?')
    .bind(u.id)
    .first<{ n: number }>();
  if (Number(n?.n ?? 0) >= MAX_CONTACTOS)
    throw new ErrorDatos('Puedes tener hasta 5 contactos de confianza.', undefined, 409);
  const r = await db
    .prepare(
      'INSERT OR IGNORE INTO contactos_confianza (id, cliente_id, nombre, telefono) VALUES (?, ?, ?, ?)',
    )
    .bind(nuevoId(), u.id, d.nombre, telefono)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Ese número ya está en tus contactos.', 'telefono', 409);
  return c.json({ ok: true }, 201);
});

seguridadViaje.delete('/seguridad/contactos/:id', async (c) => {
  const u = exigir(c, 'cliente');
  await base(c)
    .prepare('DELETE FROM contactos_confianza WHERE id = ? AND cliente_id = ?')
    .bind(c.req.param('id'), u.id)
    .run();
  return c.json({ ok: true });
});

seguridadViaje.put('/seguridad/compartir', async (c) => {
  const u = exigir(c, 'cliente');
  const { compartir } = await leerCuerpo(
    c,
    z.object({ compartir: z.enum(['nunca', 'siempre', 'noche']) }),
  );
  await base(c)
    .prepare(
      `INSERT INTO ajustes_seguridad (cliente_id, compartir) VALUES (?, ?)
       ON CONFLICT(cliente_id) DO UPDATE SET compartir = excluded.compartir`,
    )
    .bind(u.id, compartir)
    .run();
  return c.json({ ok: true });
});

/**
 * Al empezar el viaje: si el pasajero lo pidió (siempre, o de noche en la hora de su ciudad), sus
 * contactos reciben por mensaje el enlace del viaje en vivo. Nunca frena el viaje.
 */
export async function avisarContactos(c: Ctx, operacionId: string): Promise<number> {
  const db = base(c);
  const f = await db
    .prepare(
      `SELECT o.cliente_id, u.nombre, u.idioma, z.zona_horaria, COALESCE(a.compartir, 'nunca') AS compartir
         FROM operaciones o JOIN usuarios u ON u.id = o.cliente_id JOIN zonas z ON z.id = o.zona_id
         LEFT JOIN ajustes_seguridad a ON a.cliente_id = o.cliente_id WHERE o.id = ?`,
    )
    .bind(operacionId)
    .first<{
      cliente_id: string;
      nombre: string;
      idioma: string;
      zona_horaria: string;
      compartir: string;
    }>();
  if (!f || f.compartir === 'nunca') return 0;
  if (f.compartir === 'noche' && !esDeNoche(new Date(), f.zona_horaria)) return 0;
  const { results: contactos } = await db
    .prepare('SELECT telefono FROM contactos_confianza WHERE cliente_id = ?')
    .bind(f.cliente_id)
    .all<{ telefono: string }>();
  if (!contactos.length) return 0;
  const codigo = nuevoToken();
  await db
    .prepare('INSERT INTO viajes_compartidos (huella, operacion_id, creado_por) VALUES (?, ?, ?)')
    .bind(await sha256(codigo), operacionId, f.cliente_id)
    .run();
  const sitio = (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');
  const nombre = f.nombre.split(' ')[0] ?? '';
  let enviados = 0;
  for (const k of contactos)
    if (
      await enviarSms(c.env, db, {
        usuarioId: f.cliente_id,
        pedidoId: null,
        tipo: 'viaje_compartido',
        telefono: k.telefono,
        texto:
          f.idioma === 'es'
            ? `Divoox: ${nombre} empezó un viaje y lo compartió contigo. Síguelo en vivo: ${sitio}/ride/${codigo}`
            : `Divoox: ${nombre} started a ride and shared it with you. Follow it live: ${sitio}/ride/${codigo}`,
      })
    )
      enviados++;
  return enviados;
}

/**
 * RideCheck: mientras el viaje va en curso, si el conductor está lejos de la ruta se crea UN aviso
 * para que la app del pasajero pregunte si todo está bien. Devuelve el aviso abierto, si hay.
 */
export async function revisarDesvio(
  db: D1Database,
  v: {
    id: string;
    estado: string;
    origen: { lat: number; lng: number };
    destino: { lat: number; lng: number };
    conductor: { lat: number; lng: number } | null;
  },
): Promise<{ id: string; tipo: 'desvio' } | null> {
  if (v.estado !== 'en_curso') return null;
  if (v.conductor && seDesvio(v.origen, v.destino, v.conductor))
    await db
      .prepare(
        "INSERT OR IGNORE INTO alertas_viaje (id, operacion_id, tipo, lat, lng) VALUES (?, ?, 'desvio', ?, ?)",
      )
      .bind(nuevoId(), v.id, v.conductor.lat, v.conductor.lng)
      .run();
  const a = await db
    .prepare(
      "SELECT id FROM alertas_viaje WHERE operacion_id = ? AND tipo = 'desvio' AND respuesta = ''",
    )
    .bind(v.id)
    .first<{ id: string }>();
  return a ? { id: a.id, tipo: 'desvio' } : null;
}

/** El pasajero responde el «¿Todo bien?»: si pide ayuda, es una emergencia (equipo y número del país). */
seguridadViaje.post('/viajes/:id/alerta', async (c) => {
  const u = exigir(c, 'cliente');
  const id = c.req.param('id');
  const { respuesta, lat, lng } = await leerCuerpo(
    c,
    z.object({
      respuesta: z.enum(['bien', 'ayuda']),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
  );
  const db = base(c);
  const r = await db
    .prepare(
      `UPDATE alertas_viaje SET respuesta = ?, respondida_en = datetime('now')
        WHERE operacion_id = ? AND respuesta = ''
          AND operacion_id IN (SELECT id FROM operaciones WHERE cliente_id = ?)`,
    )
    .bind(respuesta, id, u.id)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese aviso ya no está abierto.', undefined, 404);
  if (respuesta === 'ayuda')
    return c.json(
      await registrarEmergencia(c, { operacionId: id, actorId: u.id, rol: 'pasajero', lat, lng }),
    );
  return c.json({ ok: true });
});

/** Antes de aceptar un viaje: con 12 horas al volante en 24, a descansar. */
export async function revisarHorasAlVolante(db: D1Database, conductorId: string): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT v.asignado_en AS inicio, v.terminado_en AS fin FROM operaciones o
         JOIN viajes v ON v.operacion_id = o.id
        WHERE o.conductor_id = ? AND v.asignado_en IS NOT NULL
          AND COALESCE(v.terminado_en, datetime('now')) > datetime('now', '-24 hours')`,
    )
    .bind(conductorId)
    .all<{ inicio: string; fin: string | null }>();
  const aIso = (t: string | null) => (t ? `${t.replace(' ', 'T')}Z` : null);
  const b = bloqueoPorHoras(
    results.map((r) => ({ inicio: aIso(r.inicio) ?? '', fin: aIso(r.fin) })),
    new Date(),
  );
  if (b.bloqueadoHasta) {
    const faltan = Math.max(1, Math.ceil((Date.parse(b.bloqueadoHasta) - Date.now()) / 3_600_000));
    throw new ErrorDatos(
      `Llevas ${Math.floor(b.horas)} horas manejando. Por tu seguridad, descansa: vuelves a recibir viajes en ${faltan} horas.`,
      undefined,
      409,
    );
  }
}
