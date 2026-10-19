import { leerConfigPais, paisIncompleto } from '../internacional/paises';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  ESTADOS_AREA,
  ESTADOS_PUBLICADOS,
  caja,
  poligonosSeSolapan,
  validarPoligono,
} from '@tumbite/compartido';
import { nuevoId } from '../cripto';
import { cobertura, leerPoligono, recalcularAreasCiudad } from '../territorio';
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

/**
 * La ciudad que atiende ese punto, o null si todavía no llegamos ahí. Desde el 17 oct 2026 sale de
 * la cobertura territorial (áreas dibujadas, o el círculo de la ciudad si no tiene áreas).
 * Con soloActivas = false devuelve también la ciudad de una próxima apertura (lista de espera,
 * restaurantes que se registran antes de abrir).
 */
export async function zonaPara(
  db: D1Database,
  lat: number | null | undefined,
  lng: number | null | undefined,
  soloActivas = true,
): Promise<Zona | null> {
  const c = await cobertura(db, lat, lng);
  if (!c.zona) return null;
  if (soloActivas && c.estado !== 'dentro') return null;
  return aZona(c.zona as unknown as Record<string, unknown>);
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
  // Estado o provincia (FL, ON, JAL…) e idioma principal de la ciudad. Opcionales.
  region: z.string().trim().max(40).default(''),
  idioma: z.enum(['en', 'es']).default('en'),
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
  // C-TOPES-PAIS: una ciudad de un país incompleto (sin tarifas o sin topes) no se activa.
  if (d.activa) {
    const pais = d.pais.toUpperCase();
    const falta = paisIncompleto(pais, await leerConfigPais(base(c), pais));
    if (falta)
      throw new ErrorDatos(
        'Este país todavía no tiene sus tarifas y topes escritos: la ciudad no se puede activar.',
        'activa',
        409,
      );
  }
  await base(c)
    .prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, region, idioma) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, pais=excluded.pais, moneda=excluded.moneda, zona_horaria=excluded.zona_horaria,
      lat=excluded.lat, lng=excluded.lng, radio_km=excluded.radio_km, activa=excluded.activa, region=excluded.region, idioma=excluded.idioma`,
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
      d.region.toUpperCase(),
      d.idioma,
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

// ───────────────────────── Cobertura pública (C-TERRITORIO) ─────────────────────────

/**
 * ¿Llega Tumbite a este punto? Si no, en qué ciudades sí estamos y qué áreas abren pronto.
 * La app y la web la piden con la dirección del cliente; la decisión siempre es del servidor.
 */
zonas.get('/cobertura', async (c) => {
  const db = base(c);
  const q = z
    .object({
      lat: z.coerce.number().finite().optional(),
      lng: z.coerce.number().finite().optional(),
    })
    .safeParse(c.req.query());
  const r = await cobertura(
    db,
    q.success ? q.data.lat : undefined,
    q.success ? q.data.lng : undefined,
  );
  const { results: activas } = await db
    .prepare('SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY nombre')
    .all<{ id: string; nombre: string; pais: string }>();
  const { results: proximas } = await db
    .prepare(
      `SELECT a.nombre AS area, z.nombre AS ciudad, z.pais, a.apertura_prevista AS apertura
       FROM areas a JOIN zonas z ON z.id = a.zona_id WHERE a.estado = 'proximamente'
       ORDER BY a.apertura_prevista IS NULL, a.apertura_prevista, z.nombre, a.nombre LIMIT 50`,
    )
    .all();
  c.header('cache-control', 'public, max-age=60');
  return c.json({
    estado: r.estado,
    zona: r.zona ? { id: r.zona.id, nombre: r.zona.nombre, pais: r.zona.pais } : null,
    area: r.area
      ? { id: r.area.id, nombre: r.area.nombre, apertura: r.area.aperturaPrevista }
      : null,
    ciudadesActivas: activas,
    proximas,
  });
});

// ───────────────────────── Áreas de cada ciudad (superadmin) ─────────────────────────

type FilaAreaAdmin = {
  id: string;
  zona_id: string;
  nombre: string;
  estado: string;
  poligono: string;
  prioridad: number;
  apertura_prevista: string | null;
  creado_en: string;
  actualizado_en: string;
  franquicia_id: string | null;
  franquicia_nombre: string | null;
};

const aAreaAdmin = (a: FilaAreaAdmin) => ({
  id: a.id,
  zonaId: a.zona_id,
  nombre: a.nombre,
  estado: a.estado,
  poligono: leerPoligono(a.poligono),
  prioridad: Number(a.prioridad),
  aperturaPrevista: a.apertura_prevista,
  creada: a.creado_en,
  actualizada: a.actualizado_en,
  franquicia: a.franquicia_id ? { id: a.franquicia_id, nombre: a.franquicia_nombre ?? '' } : null,
});

const SELECT_AREA = `SELECT a.*, fa.franquicia_id, COALESCE(NULLIF(f.nombre, ''), f.dueno_correo) AS franquicia_nombre
  FROM areas a LEFT JOIN franquicia_areas fa ON fa.area_id = a.id LEFT JOIN franquicias f ON f.id = fa.franquicia_id`;

const poligonoValido = z.custom<[number, number][]>((v) => validarPoligono(v) === null, {
  error: 'El área no es válida: revisa que tenga al menos 3 puntos y que su borde no se cruce.',
});
const esquemaArea = z.object({
  nombre: z.string().trim().min(2).max(80),
  poligono: poligonoValido,
  estado: z.enum(ESTADOS_AREA).default('borrador'),
  prioridad: z.coerce.number().int().min(-100).max(100).default(0),
  aperturaPrevista: z.iso.date().nullable().default(null),
});

/** Regla de superposición: dos áreas publicadas de la misma ciudad no pueden pisarse. */
async function exigirSinSolape(
  db: D1Database,
  zonaId: string,
  poligono: [number, number][],
  estado: string,
  ignorar: string | null,
) {
  if (!(ESTADOS_PUBLICADOS as readonly string[]).includes(estado)) return;
  const { results } = await db
    .prepare(
      `SELECT id, nombre, poligono FROM areas WHERE zona_id = ? AND estado IN (${ESTADOS_PUBLICADOS.map(() => '?').join(',')}) AND id <> ?`,
    )
    .bind(zonaId, ...ESTADOS_PUBLICADOS, ignorar ?? '')
    .all<{ id: string; nombre: string; poligono: string }>();
  const choca = results.some((o) => poligonosSeSolapan(poligono, leerPoligono(o.poligono)));
  if (choca)
    throw new ErrorDatos(
      'Esta área se pisa con otra área publicada de la ciudad. Ajusta el borde (pueden compartirlo) o deja una de las dos en borrador.',
      'poligono',
      409,
    );
}

zonas.get('/admin/zonas/:id/areas', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(`${SELECT_AREA} WHERE a.zona_id = ? ORDER BY a.estado = 'cerrada', a.nombre`)
    .bind(c.req.param('id'))
    .all<FilaAreaAdmin>();
  return c.json({ areas: results.map(aAreaAdmin) });
});

zonas.post('/admin/zonas/:id/areas', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaArea);
  const db = base(c);
  const zonaId = c.req.param('id');
  if (!(await db.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(zonaId).first()))
    throw new ErrorDatos('Esa ciudad no existe.', undefined, 404);
  await exigirSinSolape(db, zonaId, d.poligono, d.estado, null);
  const id = nuevoId();
  const k = caja(d.poligono);
  await db
    .prepare(
      `INSERT INTO areas (id, zona_id, nombre, estado, poligono, min_lat, max_lat, min_lng, max_lng, prioridad, apertura_prevista, actualizado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      zonaId,
      d.nombre,
      d.estado,
      JSON.stringify(d.poligono),
      k.minLat,
      k.maxLat,
      k.minLng,
      k.maxLng,
      d.prioridad,
      d.aperturaPrevista,
      u.id,
    )
    .run();
  await recalcularAreasCiudad(db, zonaId);
  const f = await db.prepare(`${SELECT_AREA} WHERE a.id = ?`).bind(id).first<FilaAreaAdmin>();
  return c.json({ area: f ? aAreaAdmin(f) : null }, 201);
});

zonas.patch('/admin/areas/:id', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaArea.partial());
  const db = base(c);
  const a = await db
    .prepare('SELECT * FROM areas WHERE id = ?')
    .bind(c.req.param('id'))
    .first<FilaAreaAdmin>();
  if (!a) throw new ErrorDatos('Esa área no existe.', undefined, 404);
  const poligono = d.poligono ?? leerPoligono(a.poligono);
  const estado = d.estado ?? a.estado;
  await exigirSinSolape(db, a.zona_id, poligono, estado, a.id);
  const k = caja(poligono);
  await db
    .prepare(
      `UPDATE areas SET nombre = ?, estado = ?, poligono = ?, min_lat = ?, max_lat = ?, min_lng = ?, max_lng = ?,
       prioridad = ?, apertura_prevista = ?, actualizado_en = datetime('now'), actualizado_por = ? WHERE id = ?`,
    )
    .bind(
      d.nombre ?? a.nombre,
      estado,
      JSON.stringify(poligono),
      k.minLat,
      k.maxLat,
      k.minLng,
      k.maxLng,
      d.prioridad ?? Number(a.prioridad),
      d.aperturaPrevista === undefined ? a.apertura_prevista : d.aperturaPrevista,
      u.id,
      a.id,
    )
    .run();
  await recalcularAreasCiudad(db, a.zona_id);
  const f = await db.prepare(`${SELECT_AREA} WHERE a.id = ?`).bind(a.id).first<FilaAreaAdmin>();
  return c.json({ area: f ? aAreaAdmin(f) : null });
});
