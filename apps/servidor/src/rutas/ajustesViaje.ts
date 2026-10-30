import { Hono } from 'hono';
import { z } from 'zod';
import { esDeNoche } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';

/**
 * C-MOTO-CIUDAD (30 oct 2026): interruptores por ciudad de cada servicio de viajes, como los pone Uber
 * en cada mercado. El código para empezar el viaje (siempre, solo de noche o nunca) y la selfie del
 * conductor con el casco puesto antes de aceptar (vale 12 horas). Sin ajuste, lo de siempre: código
 * siempre y sin selfie.
 */
export const ajustesViaje = new Hono<{ Bindings: Env; Variables: Variables }>();

type Ajustes = { pin: 'siempre' | 'noche' | 'nunca'; selfieCasco: boolean };
export const HORAS_SELFIE_CASCO = 12;

export async function ajustesDe(db: D1Database, servicio: string, zona: string): Promise<Ajustes> {
  const f = await db
    .prepare(
      'SELECT pin, selfie_casco FROM ajustes_viaje_zona WHERE servicio_id = ? AND zona_id = ?',
    )
    .bind(servicio, zona)
    .first<{ pin: Ajustes['pin']; selfie_casco: number }>();
  return { pin: f?.pin ?? 'siempre', selfieCasco: Boolean(f?.selfie_casco) };
}

/** ¿El viaje que se pide ahora lleva código? Se decide al pedirlo (el pasajero y el conductor lo ven igual). */
export async function pinParaViajeNuevo(
  db: D1Database,
  servicio: string,
  zona: string,
  ahora = new Date(),
): Promise<boolean> {
  const a = await ajustesDe(db, servicio, zona);
  if (a.pin === 'siempre') return true;
  if (a.pin === 'nunca') return false;
  const z = await db
    .prepare('SELECT zona_horaria FROM zonas WHERE id = ?')
    .bind(zona)
    .first<{ zona_horaria: string }>();
  return esDeNoche(ahora, z?.zona_horaria ?? 'America/New_York');
}

/** Antes de aceptar: si la ciudad pide la selfie con casco, tiene que haber una de las últimas 12 horas. */
export async function revisarSelfieCasco(
  db: D1Database,
  conductorId: string,
  operacionId: string,
): Promise<void> {
  const op = await db
    .prepare('SELECT servicio_id, zona_id FROM operaciones WHERE id = ?')
    .bind(operacionId)
    .first<{ servicio_id: string; zona_id: string }>();
  if (!op || !(await ajustesDe(db, op.servicio_id, op.zona_id)).selfieCasco) return;
  const ok = await db
    .prepare("SELECT 1 FROM selfies_casco WHERE usuario_id = ? AND tomada_en > datetime('now', ?)")
    .bind(conductorId, `-${HORAS_SELFIE_CASCO} hours`)
    .first();
  if (!ok)
    throw new ErrorDatos(
      'Antes de aceptar viajes, tómate una selfie con el casco puesto.',
      'selfie_casco',
      409,
    );
}

ajustesViaje.get('/admin/viajes/ajustes', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      'SELECT zona_id AS zona, servicio_id AS servicio, pin, selfie_casco AS selfieCasco, actualizado_en AS actualizado FROM ajustes_viaje_zona ORDER BY zona_id, servicio_id',
    )
    .all();
  return c.json({ ajustes: results.map((r) => ({ ...r, selfieCasco: Boolean(r.selfieCasco) })) });
});

ajustesViaje.put('/admin/viajes/ajustes', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      zona: z.string().min(2).max(40),
      servicio: z.enum(['moto', 'carro']),
      pin: z.enum(['siempre', 'noche', 'nunca']),
      selfieCasco: z.boolean(),
    }),
  );
  const db = base(c);
  if (!(await db.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(d.zona).first()))
    throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  const antes = await ajustesDe(db, d.servicio, d.zona);
  await db.batch([
    db
      .prepare(
        `INSERT INTO ajustes_viaje_zona (zona_id, servicio_id, pin, selfie_casco, actualizado_por) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(zona_id, servicio_id) DO UPDATE SET pin = excluded.pin, selfie_casco = excluded.selfie_casco,
           actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
      )
      .bind(d.zona, d.servicio, d.pin, d.selfieCasco ? 1 : 0, admin.id),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        admin.id,
        'ajustes_viaje',
        `${d.servicio}:${d.zona}`,
        JSON.stringify(antes),
        JSON.stringify({ pin: d.pin, selfieCasco: d.selfieCasco }),
      ),
  ]);
  return c.json({ ok: true });
});

/** La selfie con el casco puesto: privada, en casco/<conductor>/…; vale 12 horas. */
ajustesViaje.post('/conductor/selfie-casco', async (c) => {
  const u = exigir(c, 'repartidor');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const id = nuevoId();
  const clave = `casco/${u.id}/${id}`;
  await c.env.BUCKET.put(clave, bytes, {
    httpMetadata: { contentType: tipo, cacheControl: 'private, no-store' },
  });
  await base(c)
    .prepare('INSERT INTO selfies_casco (id, usuario_id, clave) VALUES (?, ?, ?)')
    .bind(id, u.id, clave)
    .run();
  return c.json({ ok: true }, 201);
});
