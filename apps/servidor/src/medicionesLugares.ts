import { Hono } from 'hono';
import { z } from 'zod';
import {
  HOLGURA_RELOJ_MS,
  PRECISION_MEDICION_M,
  TOPE_MOVIMIENTO_KM,
  distanciaKm,
  distanciaLegible,
  precisionSirve,
} from '@tumbite/compartido';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';
import {
  type FilaLugar,
  auditoria,
  leerLugar,
  moverRuta,
  olvidarLugaresDe,
  rutaDeLaCiudad,
} from './lugaresPropios';
import { notificar } from './notificaciones';
import { anotarGpsFoto, guardarFoto } from './fotoLimpia';
import { MAX_FOTO_BYTES, tipoReal } from './rutas/fotos';

/**
 * C-ESTOY-AQUI (27 nov 2026, Gerencia con luz verde de Richard) — todas las ciudades, con El Vigía
 * (Venezuela) de primer uso. Medir los lugares propios en la calle:
 *
 * 1. El equipo crea en el panel una TAREA de medición con lugares de UNA ciudad y la asigna a uno o
 *    varios conductores (de confianza o cuentas de Soporte).
 * 2. Solo los asignados la ven en Driver («Puntos por medir»). Al llegar tocan «Estoy aquí»: se guardan
 *    el GPS, su precisión (nunca peor que PRECISION_MEDICION_M), la hora, quién y una foto opcional.
 * 3. La medición queda PENDIENTE: no cambia nada. El equipo ve «movido 140 m» con los dos puntos y la
 *    aprueba o la rechaza. Solo al aprobar se mueve el lugar (y su ruta del tabulador, como al
 *    editarlo a mano) y se olvida la caché del buscador de esa ciudad.
 *
 * Candados: sin aprobación no cambia nada; la precisión se exige aquí y en la base (CHECK); un lugar
 * nunca cambia de ciudad ni se mueve más de TOPE_MOVIMIENTO_KM; solo los asignados ven y miden.
 */

export const medicionesLugares = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaTarea = {
  id: string;
  zona_id: string;
  titulo: string;
  nota: string;
  estado: 'abierta' | 'cerrada';
  creada_en: string;
};
type FilaMedicion = {
  id: string;
  tarea_id: string;
  lugar_id: string;
  zona_id: string;
  conductor_id: string;
  lat: number;
  lng: number;
  precision_m: number;
  tomada_en: string;
  recibida_en: string;
  antes_lat: number;
  antes_lng: number;
  distancia_m: number;
  foto_clave: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  revisada_en: string | null;
  motivo: string | null;
};

const metrosEntre = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.round(distanciaKm(a, b) * 1000);

/** La hora del teléfono, en el formato de la base (UTC, sin «T» ni zona). */
const aSqlUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

const medicionPublica = (m: FilaMedicion) => ({
  id: m.id,
  tareaId: m.tarea_id,
  lugarId: m.lugar_id,
  lat: Number(m.lat),
  lng: Number(m.lng),
  precisionM: Number(m.precision_m),
  tomadaEn: m.tomada_en,
  antes: { lat: Number(m.antes_lat), lng: Number(m.antes_lng) },
  distanciaM: m.distancia_m,
  conFoto: !!m.foto_clave,
  estado: m.estado,
  motivo: m.motivo,
});

async function leerTarea(db: D1Database, id: string) {
  const t = await db
    .prepare('SELECT * FROM mediciones_tareas WHERE id = ?')
    .bind(id)
    .first<FilaTarea>();
  if (!t) throw new ErrorDatos('Esa tarea de medición no existe.', undefined, 404);
  return t;
}

/** C-ESTOY-AQUI: solo un conductor asignado ve o mide una tarea (a los demás, como si no existiera). */
async function tareaDelConductor(db: D1Database, tareaId: string, conductorId: string) {
  const t = await db
    .prepare(
      `SELECT t.* FROM mediciones_tareas t
         JOIN mediciones_tarea_asignados a ON a.tarea_id = t.id AND a.conductor_id = ?
        WHERE t.id = ?`,
    )
    .bind(conductorId, tareaId)
    .first<FilaTarea>();
  if (!t) throw new ErrorDatos('Esa tarea de medición no existe.', undefined, 404);
  return t;
}

/** Los conductores elegidos: cuentas de conductor activas (las de Soporte también lo son). */
async function exigirConductores(db: D1Database, ids: readonly string[]) {
  if (!ids.length) return [];
  const { results } = await db
    .prepare(
      `SELECT id, nombre FROM usuarios WHERE rol = 'repartidor' AND activo = 1
         AND id IN (${ids.map(() => '?').join(', ')})`,
    )
    .bind(...ids)
    .all<{ id: string; nombre: string }>();
  if (results.length !== ids.length)
    throw new ErrorDatos('Elige solo cuentas de conductor activas.', 'conductores', 400);
  return results;
}

/** Aviso a cada conductor recién asignado (su campana y su celular, en Driver). */
async function avisarAsignados(
  env: Env,
  db: D1Database,
  ids: readonly string[],
  titulo: string,
  lugares: number,
) {
  await Promise.all(
    ids.map((id) =>
      notificar(env, db, { id, app: 'repartidor' }, (i) => ({
        titulo: i === 'en' ? 'New points to measure' : 'Tienes puntos por medir',
        cuerpo:
          i === 'en'
            ? `${titulo}: ${lugares} ${lugares === 1 ? 'place' : 'places'}. Go to each one and tap «I’m here».`
            : `${titulo}: ${lugares} ${lugares === 1 ? 'lugar' : 'lugares'}. Ve a cada uno y toca «Estoy aquí».`,
        datos: { tipo: 'mediciones_asignadas' },
      })).catch((e: unknown) => console.error('mediciones: no salió el aviso', String(e))),
    ),
  );
}

// ─────────────────────────────── Panel (equipo) ───────────────────────────────

const esquemaTarea = z.object({
  zona: z.string().trim().min(2).max(40),
  titulo: z.string().trim().min(3).max(120),
  nota: z.string().trim().max(500).default(''),
  lugares: z.array(z.string().trim().min(4).max(64)).min(1).max(200),
  conductores: z.array(z.string().trim().min(4).max(64)).max(20).default([]),
});

/** Las tareas de una ciudad con sus lugares, asignados y mediciones (lo pendiente primero). */
medicionesLugares.get('/admin/mediciones', async (c) => {
  exigir(c, 'admin');
  const q = z.object({ zona: z.string().trim().min(2).max(40) }).parse(c.req.query());
  const db = base(c);
  const zona = q.zona.toUpperCase();
  const [t, l, a, m] = await db.batch([
    db
      .prepare(
        "SELECT * FROM mediciones_tareas WHERE zona_id = ? ORDER BY estado = 'cerrada', creada_en DESC LIMIT 50",
      )
      .bind(zona),
    db
      .prepare(
        `SELECT tl.tarea_id, tl.lugar_id, lp.nombre, lp.lat, lp.lng, lp.activo FROM mediciones_tarea_lugares tl
           JOIN mediciones_tareas t ON t.id = tl.tarea_id JOIN lugares_propios lp ON lp.id = tl.lugar_id
          WHERE t.zona_id = ? ORDER BY tl.orden LIMIT 2000`,
      )
      .bind(zona),
    db
      .prepare(
        `SELECT a.tarea_id, u.id, u.nombre, u.correo FROM mediciones_tarea_asignados a
           JOIN mediciones_tareas t ON t.id = a.tarea_id JOIN usuarios u ON u.id = a.conductor_id
          WHERE t.zona_id = ? LIMIT 500`,
      )
      .bind(zona),
    db
      .prepare(
        `SELECT m.*, u.nombre AS conductor_nombre FROM mediciones_lugar m
           LEFT JOIN usuarios u ON u.id = m.conductor_id
          WHERE m.zona_id = ? ORDER BY m.estado <> 'pendiente', m.recibida_en DESC LIMIT 500`,
      )
      .bind(zona),
  ]);
  type L = { tarea_id: string; lugar_id: string; nombre: string; lat: number; lng: number };
  type A = { tarea_id: string; id: string; nombre: string; correo: string };
  type M = FilaMedicion & { conductor_nombre: string | null };
  const lugares = (l?.results ?? []) as L[];
  const asignados = (a?.results ?? []) as A[];
  const mediciones = (m?.results ?? []) as M[];
  return c.json({
    tareas: ((t?.results ?? []) as FilaTarea[]).map((x) => ({
      id: x.id,
      titulo: x.titulo,
      nota: x.nota,
      estado: x.estado,
      creadaEn: x.creada_en,
      lugares: lugares
        .filter((y) => y.tarea_id === x.id)
        .map((y) => ({ id: y.lugar_id, nombre: y.nombre, lat: Number(y.lat), lng: Number(y.lng) })),
      asignados: asignados
        .filter((y) => y.tarea_id === x.id)
        .map((y) => ({ id: y.id, nombre: y.nombre, correo: y.correo })),
      mediciones: mediciones
        .filter((y) => y.tarea_id === x.id)
        .map((y) => ({
          ...medicionPublica(y),
          conductor: y.conductor_nombre ?? '',
          lugar: lugares.find((z0) => z0.lugar_id === y.lugar_id)?.nombre ?? '',
        })),
    })),
  });
});

/** A quién se le puede asignar: las cuentas de conductor de esa ciudad y las de Soporte. */
medicionesLugares.get('/admin/mediciones/candidatos', async (c) => {
  exigir(c, 'admin');
  const q = z
    .object({ zona: z.string().trim().min(2).max(40), q: z.string().trim().max(60).default('') })
    .parse(c.req.query());
  const like = `%${q.q.replace(/[%_]/g, '')}%`;
  const { results } = await base(c)
    .prepare(
      `SELECT id, nombre, correo, zona_id FROM usuarios
        WHERE rol = 'repartidor' AND activo = 1
          AND (zona_id = ? OR nombre LIKE 'Soporte%')
          AND (nombre LIKE ? OR correo LIKE ?)
        ORDER BY nombre LIMIT 40`,
    )
    .bind(q.zona.toUpperCase(), like, like)
    .all<{ id: string; nombre: string; correo: string; zona_id: string | null }>();
  return c.json({
    candidatos: results.map((x) => ({ id: x.id, nombre: x.nombre, correo: x.correo })),
  });
});

medicionesLugares.post('/admin/mediciones', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaTarea);
  const zona = await db
    .prepare('SELECT id, nombre FROM zonas WHERE id = ?')
    .bind(d.zona.toUpperCase())
    .first<{ id: string; nombre: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe.', 'zona', 404);
  const ids = [...new Set(d.lugares)];
  const { results } = await db
    .prepare(
      `SELECT id, zona_id, activo FROM lugares_propios WHERE id IN (${ids.map(() => '?').join(', ')})`,
    )
    .bind(...ids)
    .all<{ id: string; zona_id: string; activo: number }>();
  // C-ESTOY-AQUI: una tarea es de UNA ciudad; un lugar de otra ciudad no entra.
  if (results.length !== ids.length || results.some((x) => x.zona_id !== zona.id))
    throw new ErrorDatos('Todos los lugares tienen que ser de esta ciudad.', 'lugares', 400);
  const conductores = await exigirConductores(db, [...new Set(d.conductores)]);
  const id = nuevoId();
  await db.batch([
    db
      .prepare(
        'INSERT INTO mediciones_tareas (id, zona_id, titulo, nota, creada_por) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, zona.id, d.titulo, d.nota, admin.id),
    ...ids.map((l, i) =>
      db
        .prepare(
          'INSERT INTO mediciones_tarea_lugares (tarea_id, lugar_id, orden) VALUES (?, ?, ?)',
        )
        .bind(id, l, i),
    ),
    ...conductores.map((x) =>
      db
        .prepare(
          'INSERT INTO mediciones_tarea_asignados (tarea_id, conductor_id, asignado_por) VALUES (?, ?, ?)',
        )
        .bind(id, x.id, admin.id),
    ),
    auditoria(db, admin.id, 'medicion.tarea.crear', `medicion-tarea:${id}`, null, {
      zona: zona.id,
      titulo: d.titulo,
      lugares: ids,
      conductores: conductores.map((x) => x.id),
    }),
  ]);
  await avisarAsignados(
    c.env,
    db,
    conductores.map((x) => x.id),
    d.titulo,
    ids.length,
  );
  return c.json({ tarea: { id, zona: zona.id, titulo: d.titulo } }, 201);
});

/** Cambiar a quién está asignada (la lista completa). Los que salen dejan de verla al instante. */
medicionesLugares.put('/admin/mediciones/:id/asignados', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const tarea = await leerTarea(db, c.req.param('id'));
  if (tarea.estado !== 'abierta')
    throw new ErrorDatos('Esta tarea ya está cerrada.', undefined, 409);
  const d = await leerCuerpo(
    c,
    z.object({ conductores: z.array(z.string().trim().min(4).max(64)).max(20) }),
  );
  const conductores = await exigirConductores(db, [...new Set(d.conductores)]);
  const { results: antes } = await db
    .prepare('SELECT conductor_id FROM mediciones_tarea_asignados WHERE tarea_id = ?')
    .bind(tarea.id)
    .all<{ conductor_id: string }>();
  const ya = new Set(antes.map((x) => x.conductor_id));
  const nuevos = conductores.filter((x) => !ya.has(x.id)).map((x) => x.id);
  await db.batch([
    db.prepare('DELETE FROM mediciones_tarea_asignados WHERE tarea_id = ?').bind(tarea.id),
    ...conductores.map((x) =>
      db
        .prepare(
          'INSERT INTO mediciones_tarea_asignados (tarea_id, conductor_id, asignado_por) VALUES (?, ?, ?)',
        )
        .bind(tarea.id, x.id, admin.id),
    ),
    auditoria(
      db,
      admin.id,
      'medicion.tarea.asignar',
      `medicion-tarea:${tarea.id}`,
      [...ya],
      conductores.map((x) => x.id),
    ),
  ]);
  const { n } = (await db
    .prepare('SELECT COUNT(*) AS n FROM mediciones_tarea_lugares WHERE tarea_id = ?')
    .bind(tarea.id)
    .first<{ n: number }>()) ?? { n: 0 };
  await avisarAsignados(c.env, db, nuevos, tarea.titulo, n);
  return c.json({ ok: true });
});

/** Cerrar una tarea: los conductores dejan de verla. Lo pendiente se puede aprobar igual. */
medicionesLugares.post('/admin/mediciones/:id/cerrar', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const tarea = await leerTarea(db, c.req.param('id'));
  if (tarea.estado === 'abierta')
    await db.batch([
      db
        .prepare(
          "UPDATE mediciones_tareas SET estado = 'cerrada', cerrada_por = ?, cerrada_en = datetime('now') WHERE id = ?",
        )
        .bind(admin.id, tarea.id),
      auditoria(db, admin.id, 'medicion.tarea.cerrar', `medicion-tarea:${tarea.id}`, null, null),
    ]);
  return c.json({ ok: true });
});

async function leerMedicion(db: D1Database, id: string) {
  const m = await db
    .prepare('SELECT * FROM mediciones_lugar WHERE id = ?')
    .bind(id)
    .first<FilaMedicion>();
  if (!m) throw new ErrorDatos('Esa medición no existe.', undefined, 404);
  return m;
}

/**
 * Aprobar: el ÚNICO camino por el que una medición mueve un lugar. Se comprueba otra vez todo (la
 * misma ciudad, el tope de movimiento, la precisión) y que el lugar no se haya movido desde que se
 * midió (si el equipo lo cambió a mano, la medición compara contra un punto viejo: se rechaza).
 */
medicionesLugares.post('/admin/mediciones/medicion/:id/aprobar', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const m = await leerMedicion(db, c.req.param('id'));
  if (m.estado !== 'pendiente') throw new ErrorDatos('Esta medición ya se revisó.', undefined, 409);
  const lugar = await leerLugar(db, m.lugar_id);
  if (lugar.zona_id !== m.zona_id)
    throw new ErrorDatos('Un lugar no cambia de ciudad.', undefined, 409);
  if (!precisionSirve(Number(m.precision_m)))
    throw new ErrorDatos('Esta medición no tiene la precisión mínima.', undefined, 409);
  const punto = { lat: Number(m.lat), lng: Number(m.lng) };
  const actual = { lat: Number(lugar.lat), lng: Number(lugar.lng) };
  if (distanciaKm(actual, punto) > TOPE_MOVIMIENTO_KM)
    throw new ErrorDatos(
      `La medición queda a más de ${TOPE_MOVIMIENTO_KM} km del lugar. Si de verdad está allá, cámbialo a mano en «Lugares propios».`,
      undefined,
      409,
    );
  if (actual.lat !== Number(m.antes_lat) || actual.lng !== Number(m.antes_lng))
    throw new ErrorDatos(
      'El lugar cambió desde que se tomó esta medición. Recházala y pide medirlo otra vez.',
      undefined,
      409,
    );
  const ruta = await rutaDeLaCiudad(db, lugar.ruta_id, lugar.zona_id);
  const lugarAntes = { lat: actual.lat, lng: actual.lng };
  const r = await db.batch([
    db
      .prepare(
        `UPDATE mediciones_lugar SET estado = 'aprobada', revisada_por = ?, revisada_en = datetime('now')
          WHERE id = ? AND estado = 'pendiente'`,
      )
      .bind(admin.id, m.id),
    db
      .prepare(
        `UPDATE lugares_propios SET lat = ?, lng = ?, actualizado_por = ?, actualizado_en = datetime('now')
          WHERE id = ? AND zona_id = ? AND lat = ? AND lng = ?
            AND EXISTS (SELECT 1 FROM mediciones_lugar WHERE id = ? AND estado = 'aprobada' AND revisada_por = ?)`,
      )
      .bind(
        punto.lat,
        punto.lng,
        admin.id,
        lugar.id,
        m.zona_id,
        actual.lat,
        actual.lng,
        m.id,
        admin.id,
      ),
    ...(ruta ? moverRuta(db, admin.id, ruta, punto) : []),
    auditoria(
      db,
      admin.id,
      'lugar_propio.medicion_aprobada',
      `lugar-propio:${lugar.id}`,
      lugarAntes,
      { ...punto, medicion: m.id, precisionM: m.precision_m },
    ),
  ]);
  if (!r[0]?.meta.changes) throw new ErrorDatos('Esta medición ya se revisó.', undefined, 409);
  olvidarLugaresDe(lugar.zona_id);
  return c.json({ ok: true, lugar: { id: lugar.id, ...punto } });
});

medicionesLugares.post('/admin/mediciones/medicion/:id/rechazar', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const m = await leerMedicion(db, c.req.param('id'));
  if (m.estado !== 'pendiente') throw new ErrorDatos('Esta medición ya se revisó.', undefined, 409);
  const d = await leerCuerpo(c, z.object({ motivo: z.string().trim().max(300).default('') }));
  await db.batch([
    db
      .prepare(
        `UPDATE mediciones_lugar SET estado = 'rechazada', revisada_por = ?, revisada_en = datetime('now'),
           motivo = ? WHERE id = ? AND estado = 'pendiente'`,
      )
      .bind(admin.id, d.motivo || null, m.id),
    auditoria(db, admin.id, 'medicion.rechazar', `medicion:${m.id}`, null, { motivo: d.motivo }),
  ]);
  return c.json({ ok: true });
});

/** La foto de una medición, solo para el equipo (privada, sin caché). */
medicionesLugares.get('/admin/mediciones/medicion/:id/foto', async (c) => {
  exigir(c, 'admin');
  const m = await leerMedicion(base(c), c.req.param('id'));
  const obj = m.foto_clave && c.env.BUCKET ? await c.env.BUCKET.get(m.foto_clave) : null;
  if (!obj) throw new ErrorDatos('Esta medición no tiene foto.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, no-store',
    },
  });
});

// ─────────────────────────────── Driver (conductor) ───────────────────────────────

/** «Puntos por medir»: solo las tareas abiertas asignadas a quien mira, con su última medición. */
medicionesLugares.get('/conductor/mediciones', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const [t, l, m] = await db.batch([
    db
      .prepare(
        `SELECT t.id, t.titulo, t.nota, t.zona_id, z.nombre AS ciudad FROM mediciones_tareas t
           JOIN mediciones_tarea_asignados a ON a.tarea_id = t.id AND a.conductor_id = ?
           LEFT JOIN zonas z ON z.id = t.zona_id
          WHERE t.estado = 'abierta' ORDER BY t.creada_en LIMIT 20`,
      )
      .bind(u.id),
    db
      .prepare(
        `SELECT tl.tarea_id, lp.id, lp.nombre, lp.lat, lp.lng FROM mediciones_tarea_lugares tl
           JOIN mediciones_tarea_asignados a ON a.tarea_id = tl.tarea_id AND a.conductor_id = ?
           JOIN mediciones_tareas t ON t.id = tl.tarea_id AND t.estado = 'abierta'
           JOIN lugares_propios lp ON lp.id = tl.lugar_id AND lp.activo = 1
          ORDER BY tl.orden LIMIT 1000`,
      )
      .bind(u.id),
    db
      .prepare(
        `SELECT * FROM mediciones_lugar WHERE conductor_id = ? AND tarea_id IN (
           SELECT tarea_id FROM mediciones_tarea_asignados WHERE conductor_id = ?)
          ORDER BY recibida_en DESC LIMIT 1000`,
      )
      .bind(u.id, u.id),
  ]);
  type L = { tarea_id: string; id: string; nombre: string; lat: number; lng: number };
  const lugares = (l?.results ?? []) as L[];
  const medidas = (m?.results ?? []) as FilaMedicion[];
  return c.json({
    precisionMaximaM: PRECISION_MEDICION_M,
    tareas: (
      (t?.results ?? []) as {
        id: string;
        titulo: string;
        nota: string;
        zona_id: string;
        ciudad: string | null;
      }[]
    ).map((x) => ({
      id: x.id,
      titulo: x.titulo,
      nota: x.nota,
      ciudad: x.ciudad ?? x.zona_id,
      lugares: lugares
        .filter((y) => y.tarea_id === x.id)
        .map((y) => {
          const ultima = medidas.find((z0) => z0.tarea_id === x.id && z0.lugar_id === y.id);
          return {
            id: y.id,
            nombre: y.nombre,
            lat: Number(y.lat),
            lng: Number(y.lng),
            medicion: ultima ? medicionPublica(ultima) : null,
          };
        }),
    })),
  });
});

const esquemaMedicion = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisionM: z.number(),
  /** La hora del GPS en el teléfono (ms). */
  tomadaEn: z.number().int().positive(),
});

/** «Estoy aquí»: guarda la medición PENDIENTE. No toca el lugar. */
medicionesLugares.post('/conductor/mediciones/:tarea/lugares/:lugar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const tarea = await tareaDelConductor(db, c.req.param('tarea'), u.id);
  if (tarea.estado !== 'abierta')
    throw new ErrorDatos('Esta tarea ya se cerró. Gracias por tu ayuda.', undefined, 409);
  const enTarea = await db
    .prepare('SELECT 1 AS si FROM mediciones_tarea_lugares WHERE tarea_id = ? AND lugar_id = ?')
    .bind(tarea.id, c.req.param('lugar'))
    .first<{ si: number }>();
  if (!enTarea) throw new ErrorDatos('Ese lugar no está en esta tarea.', undefined, 404);
  const lugar: FilaLugar = await leerLugar(db, c.req.param('lugar'));
  if (lugar.zona_id !== tarea.zona_id || lugar.activo !== 1)
    throw new ErrorDatos('Ese lugar no está en esta tarea.', undefined, 404);
  const d = await leerCuerpo(c, esquemaMedicion);
  if (!precisionSirve(d.precisionM))
    throw new ErrorDatos(
      `El GPS todavía no es preciso (${Math.round(d.precisionM)} m). Espera unos segundos al aire libre o acércate más, hasta ${PRECISION_MEDICION_M} m o menos.`,
      'precisionM',
      422,
    );
  const ahora = Date.now();
  if (d.tomadaEn > ahora + HOLGURA_RELOJ_MS)
    throw new ErrorDatos(
      'La hora de tu teléfono no está bien. Corrígela y vuelve a intentar.',
      'tomadaEn',
      422,
    );
  if (ahora - d.tomadaEn > 2 * 60_000)
    throw new ErrorDatos('Esa ubicación es vieja. Toca «Estoy aquí» otra vez.', 'tomadaEn', 422);
  const antes = { lat: Number(lugar.lat), lng: Number(lugar.lng) };
  const punto = { lat: d.lat, lng: d.lng };
  if (distanciaKm(antes, punto) > TOPE_MOVIMIENTO_KM)
    throw new ErrorDatos(
      `Estás a ${distanciaLegible(metrosEntre(antes, punto), 'es')} de «${lugar.nombre}». Toca «Estoy aquí» cuando llegues al lugar.`,
      undefined,
      422,
    );
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO mediciones_lugar (id, tarea_id, lugar_id, zona_id, conductor_id, lat, lng, precision_m,
         tomada_en, antes_lat, antes_lng, distancia_m) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tarea.id,
      lugar.id,
      lugar.zona_id,
      u.id,
      punto.lat,
      punto.lng,
      d.precisionM,
      aSqlUtc(d.tomadaEn),
      antes.lat,
      antes.lng,
      metrosEntre(antes, punto),
    )
    .run();
  return c.json({ medicion: medicionPublica(await leerMedicion(db, id)) }, 201);
});

/** La foto opcional del lugar (la entrada, el letrero), de una medición propia y pendiente. */
medicionesLugares.post('/conductor/mediciones/medicion/:id/foto', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const m = await leerMedicion(db, c.req.param('id'));
  if (m.conductor_id !== u.id) throw new ErrorDatos('Esa medición no existe.', undefined, 404);
  if (m.estado !== 'pendiente') throw new ErrorDatos('Esta medición ya se revisó.', undefined, 409);
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
  const clave = `mediciones/${m.id}/${nuevoId()}`;
  const { gps } = await guardarFoto(c.env.BUCKET, clave, bytes, tipo, {
    cacheControl: 'private, no-store',
  });
  if (gps) await anotarGpsFoto(db, clave, gps);
  await db
    .prepare('UPDATE mediciones_lugar SET foto_clave = ? WHERE id = ?')
    .bind(clave, m.id)
    .run();
  return c.json({ url: '' });
});
