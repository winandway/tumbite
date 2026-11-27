import { Hono } from 'hono';
import { z } from 'zod';
import {
  FOTOS_MEDICION,
  HOLGURA_RELOJ_MS,
  PRECISION_MEDICION_M,
  RADIO_ESTOY_AQUI_M,
  RADIO_FOTOS_LUGAR_M,
  type TipoFotoMedicion,
  distanciaKm,
  distanciaLegible,
  fotosQueFaltan,
  nombreFotoMedicion,
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
 * 2. Solo los asignados la ven en Driver («Puntos por medir»). A menos de RADIO_ESTOY_AQUI_M (300 m)
 *    del punto tocan «Estoy aquí»: se guardan el GPS, su precisión (nunca peor que
 *    PRECISION_MEDICION_M), la hora y quién. Después, las TRES fotos obligatorias con la cámara
 *    (C-TRES-FOTOS), cada una con su hora y su GPS.
 * 3. La medición queda PENDIENTE: no cambia nada. El equipo ve «movido 140 m» con los dos puntos y la
 *    aprueba (solo con las tres fotos) o la rechaza. Solo al aprobar se mueve el lugar (y su ruta del
 *    tabulador, como al editarlo a mano), se olvida la caché del buscador de esa ciudad y sus fotos
 *    pasan a públicas: «Así se ve el lugar» (C-FOTOS-PUBLICAS); el equipo puede quitar cualquiera.
 *
 * Candados: sin aprobación no cambia nada; la precisión se exige aquí y en la base (CHECK); un lugar
 * nunca cambia de ciudad ni se mueve más de RADIO_ESTOY_AQUI_M; solo los asignados ven y miden.
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
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  revisada_en: string | null;
  motivo: string | null;
};

const metrosEntre = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.round(distanciaKm(a, b) * 1000);

/** La hora del teléfono, en el formato de la base (UTC, sin «T» ni zona). */
const aSqlUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

type FilaFoto = {
  id: string;
  medicion_id: string;
  lugar_id: string;
  conductor_id: string;
  tipo: TipoFotoMedicion;
  clave: string;
  lat: number;
  lng: number;
  precision_m: number | null;
  tomada_en: string;
  publica: number;
  quitada_en: string | null;
};

const fotoPublica = (f: FilaFoto) => ({
  id: f.id,
  tipo: f.tipo,
  lat: Number(f.lat),
  lng: Number(f.lng),
  tomadaEn: f.tomada_en,
  publica: f.publica === 1,
  quitada: !!f.quitada_en,
});

/** Las fotos de cada medición, en el orden de FOTOS_MEDICION. */
function fotosDe(fotos: readonly FilaFoto[], medicionId: string) {
  return fotos
    .filter((f) => f.medicion_id === medicionId)
    .sort((a, b) => FOTOS_MEDICION.indexOf(a.tipo) - FOTOS_MEDICION.indexOf(b.tipo))
    .map(fotoPublica);
}

const medicionPublica = (m: FilaMedicion, fotos: readonly FilaFoto[]) => ({
  id: m.id,
  tareaId: m.tarea_id,
  lugarId: m.lugar_id,
  lat: Number(m.lat),
  lng: Number(m.lng),
  precisionM: Number(m.precision_m),
  tomadaEn: m.tomada_en,
  antes: { lat: Number(m.antes_lat), lng: Number(m.antes_lng) },
  distanciaM: m.distancia_m,
  fotos: fotosDe(fotos, m.id),
  faltanFotos: fotosQueFaltan(fotos.filter((f) => f.medicion_id === m.id).map((f) => f.tipo)),
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
  const [t, l, a, m, f] = await db.batch([
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
    db
      .prepare(
        `SELECT f.* FROM mediciones_fotos f JOIN mediciones_lugar m ON m.id = f.medicion_id
          WHERE m.zona_id = ? LIMIT 1500`,
      )
      .bind(zona),
  ]);
  type L = { tarea_id: string; lugar_id: string; nombre: string; lat: number; lng: number };
  type A = { tarea_id: string; id: string; nombre: string; correo: string };
  type M = FilaMedicion & { conductor_nombre: string | null };
  const lugares = (l?.results ?? []) as L[];
  const asignados = (a?.results ?? []) as A[];
  const mediciones = (m?.results ?? []) as M[];
  const fotos = (f?.results ?? []) as FilaFoto[];
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
          ...medicionPublica(y, fotos),
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
  // C-TRES-FOTOS: sin las tres fotos no se aprueba (se dice cuáles faltan).
  const { results: tiene } = await db
    .prepare('SELECT tipo FROM mediciones_fotos WHERE medicion_id = ?')
    .bind(m.id)
    .all<{ tipo: string }>();
  const faltan = fotosQueFaltan(tiene.map((x) => x.tipo));
  if (faltan.length)
    throw new ErrorDatos(
      `Faltan fotos: ${faltan.map((x) => nombreFotoMedicion(x, 'es').toLowerCase()).join(', ')}. Pide al conductor que las tome en el lugar.`,
      undefined,
      409,
    );
  const punto = { lat: Number(m.lat), lng: Number(m.lng) };
  const actual = { lat: Number(lugar.lat), lng: Number(lugar.lng) };
  if (distanciaKm(actual, punto) * 1000 > RADIO_ESTOY_AQUI_M)
    throw new ErrorDatos(
      `La medición queda a más de ${RADIO_ESTOY_AQUI_M} m del lugar. Si de verdad está allá, cámbialo a mano en «Lugares propios».`,
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
    // C-FOTOS-PUBLICAS: las fotos de esta medición pasan a ser las que se ven del lugar; las de una
    // medición aprobada antes dejan de verse (el lugar muestra siempre su medición más nueva).
    db
      .prepare(
        `UPDATE mediciones_fotos SET publica = CASE WHEN medicion_id = ?1 THEN 1 ELSE 0 END
          WHERE lugar_id = ?2
            AND EXISTS (SELECT 1 FROM mediciones_lugar WHERE id = ?1 AND estado = 'aprobada' AND revisada_por = ?3)`,
      )
      .bind(m.id, lugar.id, admin.id),
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

async function leerFoto(db: D1Database, id: string) {
  const f = await db
    .prepare('SELECT * FROM mediciones_fotos WHERE id = ?')
    .bind(id)
    .first<FilaFoto>();
  if (!f) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  return f;
}

async function servirFoto(env: Env, clave: string, cache: string) {
  const obj = env.BUCKET ? await env.BUCKET.get(clave) : null;
  if (!obj) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': cache,
    },
  });
}

/** Una foto de una medición, para el equipo (privada, sin caché). */
medicionesLugares.get('/admin/mediciones/fotos/:id', async (c) => {
  exigir(c, 'admin');
  const f = await leerFoto(base(c), c.req.param('id'));
  return servirFoto(c.env, f.clave, 'private, no-store');
});

/** C-FOTOS-PUBLICAS: el equipo quita una foto de «Así se ve el lugar» (deja de verse al instante). */
medicionesLugares.post('/admin/mediciones/fotos/:id/quitar', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const f = await leerFoto(db, c.req.param('id'));
  if (!f.quitada_en)
    await db.batch([
      db
        .prepare(
          "UPDATE mediciones_fotos SET publica = 0, quitada_por = ?, quitada_en = datetime('now') WHERE id = ?",
        )
        .bind(admin.id, f.id),
      auditoria(db, admin.id, 'medicion.foto.quitar', `medicion-foto:${f.id}`, null, {
        lugar: f.lugar_id,
        tipo: f.tipo,
      }),
    ]);
  return c.json({ ok: true });
});

// ─────────────────────────── Público: «Así se ve el lugar» ───────────────────────────

/**
 * C-FOTOS-PUBLICAS (Richard, 27 nov 2026): las fotos aprobadas del lugar propio que queda en ese
 * punto (a RADIO_FOTOS_LUGAR_M o menos), para la app de clientes y Driver cuando el lugar es la
 * recogida o el destino. Solo las aprobadas y no quitadas. Solo lee (nada se escribe por mirar).
 */
medicionesLugares.get('/lugares/asi-se-ve', async (c) => {
  const q = z
    .object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) })
    .parse(c.req.query());
  const dLat = RADIO_FOTOS_LUGAR_M / 111_000;
  const dLng = dLat / Math.max(0.2, Math.cos((q.lat * Math.PI) / 180));
  const { results } = await base(c)
    .prepare(
      `SELECT lp.id AS lugar_id, lp.nombre, lp.lat, lp.lng, f.id, f.tipo FROM lugares_propios lp
         JOIN mediciones_fotos f ON f.lugar_id = lp.id AND f.publica = 1 AND f.quitada_en IS NULL
        WHERE lp.activo = 1 AND lp.lat BETWEEN ? AND ? AND lp.lng BETWEEN ? AND ? LIMIT 30`,
    )
    .bind(q.lat - dLat, q.lat + dLat, q.lng - dLng, q.lng + dLng)
    .all<{
      lugar_id: string;
      nombre: string;
      lat: number;
      lng: number;
      id: string;
      tipo: TipoFotoMedicion;
    }>();
  const metros = (x: { lat: number; lng: number }) =>
    distanciaKm({ lat: Number(x.lat), lng: Number(x.lng) }, q) * 1000;
  const cerca = results
    .filter((x) => metros(x) <= RADIO_FOTOS_LUGAR_M)
    .sort((a, b) => metros(a) - metros(b));
  const elegido = cerca[0];
  c.header('cache-control', 'public, max-age=300');
  if (!elegido) return c.json({ lugar: null, fotos: [] });
  return c.json({
    lugar: { id: elegido.lugar_id, nombre: elegido.nombre },
    fotos: cerca
      .filter((x) => x.lugar_id === elegido.lugar_id)
      .sort((a, b) => FOTOS_MEDICION.indexOf(a.tipo) - FOTOS_MEDICION.indexOf(b.tipo))
      .map((x) => ({ id: x.id, tipo: x.tipo, url: `/datos/lugares/fotos/${x.id}` })),
  });
});

/** Una foto pública de un lugar (solo si está aprobada y no se quitó). */
medicionesLugares.get('/lugares/fotos/:id', async (c) => {
  const f = await leerFoto(base(c), c.req.param('id'));
  if (f.publica !== 1 || f.quitada_en) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  return servirFoto(c.env, f.clave, 'public, max-age=3600');
});

// ─────────────────────────────── Driver (conductor) ───────────────────────────────

/** «Puntos por medir»: solo las tareas abiertas asignadas a quien mira, con su última medición. */
medicionesLugares.get('/conductor/mediciones', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const [t, l, m, f] = await db.batch([
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
    db
      .prepare(
        `SELECT * FROM mediciones_fotos WHERE conductor_id = ? AND medicion_id IN (
           SELECT id FROM mediciones_lugar WHERE conductor_id = ? AND estado = 'pendiente') LIMIT 600`,
      )
      .bind(u.id, u.id),
  ]);
  type L = { tarea_id: string; id: string; nombre: string; lat: number; lng: number };
  const lugares = (l?.results ?? []) as L[];
  const medidas = (m?.results ?? []) as FilaMedicion[];
  const fotos = (f?.results ?? []) as FilaFoto[];
  return c.json({
    precisionMaximaM: PRECISION_MEDICION_M,
    radioM: RADIO_ESTOY_AQUI_M,
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
            medicion: ultima ? medicionPublica(ultima, fotos) : null,
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
  // C-ESTOY-AQUI-300: solo a menos de 300 m del punto guardado (lo mismo que deja el botón de Driver).
  if (metrosEntre(antes, punto) > RADIO_ESTOY_AQUI_M)
    throw new ErrorDatos(
      `Acércate al punto: estás a ${distanciaLegible(metrosEntre(antes, punto), 'es')} de «${lugar.nombre}». «Estoy aquí» se activa a ${RADIO_ESTOY_AQUI_M} m o menos.`,
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
  return c.json({ medicion: medicionPublica(await leerMedicion(db, id), []) }, 201);
});

const esquemaDatosFoto = z.object({
  tipo: z.enum(FOTOS_MEDICION),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  precision: z.coerce.number().positive().max(10_000).optional(),
  hora: z.coerce.number().int().positive(),
});

/**
 * C-TRES-FOTOS: una de las tres fotos de una medición propia y pendiente, tomada con la cámara. Llega
 * con su GPS y su hora (cabeceras x-foto-*, nunca en la dirección). Tiene que ser de ahora y del
 * lugar (a RADIO_ESTOY_AQUI_M o menos del punto medido). Volver a tomarla la reemplaza.
 */
medicionesLugares.post('/conductor/mediciones/medicion/:id/fotos/:tipo', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const m = await leerMedicion(db, c.req.param('id'));
  if (m.conductor_id !== u.id) throw new ErrorDatos('Esa medición no existe.', undefined, 404);
  if (m.estado !== 'pendiente') throw new ErrorDatos('Esta medición ya se revisó.', undefined, 409);
  const datos = esquemaDatosFoto.safeParse({
    tipo: c.req.param('tipo'),
    lat: c.req.header('x-foto-lat'),
    lng: c.req.header('x-foto-lng'),
    precision: c.req.header('x-foto-precision') || undefined,
    hora: c.req.header('x-foto-hora'),
  });
  if (!datos.success)
    throw new ErrorDatos(
      'La foto llegó sin tu ubicación. Activa la ubicación y tómala otra vez.',
      'foto',
      422,
    );
  const d = datos.data;
  const ahora = Date.now();
  if (d.hora > ahora + HOLGURA_RELOJ_MS)
    throw new ErrorDatos(
      'La hora de tu teléfono no está bien. Corrígela y vuelve a intentar.',
      'foto',
      422,
    );
  if (ahora - d.hora > HOLGURA_RELOJ_MS)
    throw new ErrorDatos('Esa foto es vieja. Tómala otra vez en el lugar.', 'foto', 422);
  if (metrosEntre({ lat: Number(m.lat), lng: Number(m.lng) }, d) > RADIO_ESTOY_AQUI_M)
    throw new ErrorDatos('Toma la foto en el lugar que mediste.', 'foto', 422);
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
  const clave = `mediciones/${m.id}/${d.tipo}-${nuevoId()}`;
  // Se guarda limpia (sin los datos ocultos del archivo): puede llegar a ser pública.
  const { gps } = await guardarFoto(c.env.BUCKET, clave, bytes, tipo, {
    cacheControl: 'private, no-store',
  });
  if (gps) await anotarGpsFoto(db, clave, gps);
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO mediciones_fotos (id, medicion_id, lugar_id, conductor_id, tipo, clave, lat, lng, precision_m, tomada_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (medicion_id, tipo) DO UPDATE SET id = excluded.id, clave = excluded.clave,
         lat = excluded.lat, lng = excluded.lng, precision_m = excluded.precision_m,
         tomada_en = excluded.tomada_en, recibida_en = datetime('now')`,
    )
    .bind(
      id,
      m.id,
      m.lugar_id,
      u.id,
      d.tipo,
      clave,
      d.lat,
      d.lng,
      d.precision ?? null,
      aSqlUtc(d.hora),
    )
    .run();
  const { results } = await db
    .prepare('SELECT tipo FROM mediciones_fotos WHERE medicion_id = ?')
    .bind(m.id)
    .all<{ tipo: string }>();
  return c.json(
    { foto: { id, tipo: d.tipo }, faltan: fotosQueFaltan(results.map((x) => x.tipo)) },
    201,
  );
});
