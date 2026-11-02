/**
 * C-MODO-DESTINO (BRE-6, 2 nov 2026), como «Driver Destinations» de Uber (REA de su ayuda pública,
 * ficha docs/investigaciones-rea/2026-11-02-promociones-y-destino.md): el repartidor pone su
 * destino y, hasta dos veces por día de su ciudad, solo recibe ofertas cuya entrega lo acerca.
 * Se apaga solo al llegar (con la ubicación que manda la app) o a mano. Todos los países.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { USOS_DESTINO_DIA, diaLocal, llegoAlDestino } from '@tumbite/compartido';
import type { Env } from './env';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';

type FilaDestino = {
  repartidor_id: string;
  direccion: string;
  lat: number;
  lng: number;
  activo: number;
  motivo: string | null;
};

/** Los destinos encendidos, por repartidor (para el reparto de ofertas). */
export async function destinosActivos(
  db: D1Database,
): Promise<Map<string, { lat: number; lng: number }>> {
  const { results } = await db
    .prepare('SELECT repartidor_id, lat, lng FROM modo_destino WHERE activo = 1')
    .all<{ repartidor_id: string; lat: number; lng: number }>();
  return new Map(results.map((r) => [r.repartidor_id, { lat: Number(r.lat), lng: Number(r.lng) }]));
}

/** Con cada ubicación: si llegó a su destino, el modo se apaga solo. */
export async function revisarLlegadaDestino(
  db: D1Database,
  repartidorId: string,
  aqui: { lat: number; lng: number },
): Promise<void> {
  const d = await db
    .prepare('SELECT lat, lng FROM modo_destino WHERE repartidor_id = ? AND activo = 1')
    .bind(repartidorId)
    .first<{ lat: number; lng: number }>();
  if (d && llegoAlDestino(aqui, { lat: Number(d.lat), lng: Number(d.lng) }))
    await db
      .prepare(
        "UPDATE modo_destino SET activo = 0, apagado_en = datetime('now'), motivo = 'llegada' WHERE repartidor_id = ? AND activo = 1",
      )
      .bind(repartidorId)
      .run();
}

async function hoyDe(db: D1Database, repartidorId: string): Promise<string> {
  const z = await db
    .prepare(
      'SELECT z.zona_horaria FROM repartidores r JOIN zonas z ON z.id = r.zona_id WHERE r.usuario_id = ?',
    )
    .bind(repartidorId)
    .first<{ zona_horaria: string }>();
  return diaLocal(new Date(), z?.zona_horaria ?? 'America/New_York');
}

async function resumen(db: D1Database, repartidorId: string) {
  const dia = await hoyDe(db, repartidorId);
  const [d, usos] = await Promise.all([
    db
      .prepare('SELECT * FROM modo_destino WHERE repartidor_id = ?')
      .bind(repartidorId)
      .first<FilaDestino>(),
    db
      .prepare('SELECT usos FROM usos_modo_destino WHERE repartidor_id = ? AND dia = ?')
      .bind(repartidorId, dia)
      .first<{ usos: number }>(),
  ]);
  const usados = Number(usos?.usos ?? 0);
  return {
    activo: Number(d?.activo ?? 0) === 1,
    direccion: d?.direccion ?? null,
    lat: d ? Number(d.lat) : null,
    lng: d ? Number(d.lng) : null,
    motivo: d?.motivo ?? null,
    usosHoy: usados,
    usosRestantes: Math.max(0, USOS_DESTINO_DIA - usados),
  };
}

export const modoDestino = new Hono<{ Bindings: Env; Variables: Variables }>();

modoDestino.get('/repartidor/destino', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(await resumen(base(c), u.id));
});

modoDestino.put('/repartidor/destino', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      direccion: z.string().trim().min(3).max(200),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  );
  const db = base(c);
  const dia = await hoyDe(db, u.id);
  // Cuenta el uso solo si quedan (un solo paso: dos toques a la vez no pasan de dos).
  const r = await db
    .prepare(
      `INSERT INTO usos_modo_destino (repartidor_id, dia, usos) VALUES (?1, ?2, 1)
       ON CONFLICT(repartidor_id, dia) DO UPDATE SET usos = usos + 1 WHERE usos < ?3`,
    )
    .bind(u.id, dia, USOS_DESTINO_DIA)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Ya usaste el modo destino dos veces hoy. Vuelve a estar disponible mañana.',
      undefined,
      409,
    );
  await db
    .prepare(
      `INSERT INTO modo_destino (repartidor_id, direccion, lat, lng, activo, encendido_en, apagado_en, motivo)
       VALUES (?, ?, ?, ?, 1, datetime('now'), NULL, NULL)
       ON CONFLICT(repartidor_id) DO UPDATE SET direccion = excluded.direccion, lat = excluded.lat,
         lng = excluded.lng, activo = 1, encendido_en = datetime('now'), apagado_en = NULL, motivo = NULL`,
    )
    .bind(u.id, d.direccion, d.lat, d.lng)
    .run();
  return c.json(await resumen(db, u.id));
});

modoDestino.delete('/repartidor/destino', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await db
    .prepare(
      "UPDATE modo_destino SET activo = 0, apagado_en = datetime('now'), motivo = 'a_mano' WHERE repartidor_id = ? AND activo = 1",
    )
    .bind(u.id)
    .run();
  return c.json(await resumen(db, u.id));
});
