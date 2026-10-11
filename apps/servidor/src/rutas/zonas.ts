import { Hono } from 'hono';
import { z } from 'zod';
import { distanciaKm } from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/** «Pueblo en pueblo»: cada ciudad es una zona. Todo lo operativo se filtra por zona. */
export const ZONA_INICIAL = 'US-FL-MIAMI';

export type Zona = {
  id: string;
  nombre: string;
  pais: string;
  moneda: string;
  zonaHoraria: string;
  lat: number;
  lng: number;
  radioKm: number;
  activa: boolean;
};

function aZona(f: Record<string, unknown>): Zona {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    pais: String(f.pais),
    moneda: String(f.moneda),
    zonaHoraria: String(f.zona_horaria),
    lat: Number(f.lat),
    lng: Number(f.lng),
    radioKm: Number(f.radio_km),
    activa: Number(f.activa) === 1,
  };
}

/** La zona activa más cercana que cubre ese punto, o null si todavía no llegamos ahí. */
export async function zonaPara(
  db: D1Database,
  lat: number | null | undefined,
  lng: number | null | undefined,
  soloActivas = true,
): Promise<Zona | null> {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { results } = await db
    .prepare(`SELECT * FROM zonas ${soloActivas ? 'WHERE activa = 1' : ''}`)
    .all<Record<string, unknown>>();
  let mejor: { zona: Zona; km: number } | null = null;
  for (const f of results) {
    const zona = aZona(f);
    const km = distanciaKm({ lat, lng }, zona);
    if (km <= zona.radioKm && (!mejor || km < mejor.km)) mejor = { zona, km };
  }
  return mejor?.zona ?? null;
}

export const zonas = new Hono<{ Bindings: Env; Variables: Variables }>();

zonas.get('/zonas', async (c) => {
  const { results } = await base(c)
    .prepare('SELECT * FROM zonas WHERE activa = 1 ORDER BY nombre')
    .all<Record<string, unknown>>();
  return c.json({ zonas: results.map(aZona) });
});

const esquemaZona = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}-[A-Z0-9]{2,3}-[A-Z0-9-]{2,30}$/, {
      error: 'El código va así: US-FL-OCALA (país, estado, ciudad).',
    }),
  nombre: z.string().trim().min(2).max(60),
  pais: z.string().trim().length(2),
  moneda: z.string().trim().length(3).default('USD'),
  zonaHoraria: z.string().trim().min(3).max(60).default('America/New_York'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radioKm: z.number().min(1).max(200).default(40),
  activa: z.boolean().default(false),
});

zonas.get('/admin/zonas', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT z.*, (SELECT COUNT(*) FROM restaurantes r WHERE r.zona_id = z.id) AS restaurantes,
      (SELECT COUNT(*) FROM repartidores d WHERE d.zona_id = z.id) AS repartidores,
      (SELECT COUNT(*) FROM lista_espera l WHERE l.zona_id = z.id) AS en_espera FROM zonas z ORDER BY z.activa DESC, z.nombre`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    zonas: results.map((f) => ({
      ...aZona(f),
      restaurantes: Number(f.restaurantes),
      repartidores: Number(f.repartidores),
      enEspera: Number(f.en_espera),
    })),
  });
});

zonas.put('/admin/zonas', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaZona);
  await base(c)
    .prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, pais=excluded.pais, moneda=excluded.moneda, zona_horaria=excluded.zona_horaria,
      lat=excluded.lat, lng=excluded.lng, radio_km=excluded.radio_km, activa=excluded.activa`,
    )
    .bind(
      d.id,
      d.nombre,
      d.pais.toUpperCase(),
      d.moneda.toUpperCase(),
      d.zonaHoraria,
      d.lat,
      d.lng,
      d.radioKm,
      d.activa ? 1 : 0,
    )
    .run();
  return c.json({ ok: true });
});

zonas.patch('/admin/zonas/:id', async (c) => {
  exigir(c, 'admin');
  const { activa } = await leerCuerpo(c, z.object({ activa: z.boolean() }));
  const r = await base(c)
    .prepare('UPDATE zonas SET activa = ? WHERE id = ?')
    .bind(activa ? 1 : 0, c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa zona no existe.', undefined, 404);
  return c.json({ ok: true });
});
