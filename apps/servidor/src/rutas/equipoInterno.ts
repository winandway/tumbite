import { Hono } from 'hono';
import { z } from 'zod';
import {
  type Alcance,
  CONFIG_PERMISOS,
  NOMBRES_PERMISOS,
  PERMISOS_INTERNOS,
  PLANTILLAS_SISTEMA,
  type Topes,
  alcanceDentroDe,
  celdaCsv,
  correoCanonico,
  mueveDinero,
  nombreCumpleSoporte,
  permisosFuera,
  rangoPrefijo,
  textoPlano,
  topesDentroDe,
  unirAlcances,
} from '@tumbite/compartido';
import type { Env } from '../env';
import {
  type AccesoEnSesion,
  type PlantillaLeida,
  accesoDe,
  anotarAccesoSensible,
  cerrarSesionesDe,
  esDueno,
  esquemaAlcance,
  leerAccesoInterno,
  leerAlcance,
  plantillaDeFila,
  renovarSesionesDe,
} from '../accesoInterno';
import { NOMBRE_PLANO } from '../buscadorSql';
import { enviarCorreo } from '../correo';
import { hashClave, nuevoId, nuevoToken, sha256 } from '../cripto';
import { entornoDe } from '../entorno';
import { COOKIE_SESION, DIAS_SESION, type Ctx, type Variables, base, exigir } from '../sesion';
import { segundoFactorActivo, segundoFactorVigente } from '../segundoFactor';
import { pasaTurnstile } from '../turnstile';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-PERMISOS-FINOS y C-EQUIPO-INVITACION (MON-5, 15 nov 2026) — todos los países.
 * «Equipo interno»: personas, plantillas de puesto, invitaciones de un solo uso, suspender y quitar
 * el acceso (cierra sus sesiones al instante), registro de lo que hizo y de lo que VIO cada uno, y
 * «Ver dato» (teléfono o correo completos, con su permiso y una fila en el registro).
 *
 * Regla de oro (aviso de Stripe sobre quien invita [DOC]): nadie da más de lo que tiene — ni
 * permisos, ni alcance, ni topes de dinero. Lo comprueba el servidor en cada alta y cada cambio.
 */
export const equipoInterno = new Hono<{ Bindings: Env; Variables: Variables }>();

const POR_PAGINA = 50;
type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v == null ? null : String(v));

// ─────────────────────────────── Ayudas ───────────────────────────────

function mio(c: Ctx): AccesoEnSesion {
  const a = accesoDe(c);
  if (!a) throw new ErrorDatos('Tu sesión terminó. Vuelve a entrar.', undefined, 401);
  return a;
}

/** Todas las plantillas: las de fábrica (con lo editado encima) y las creadas por el equipo. */
async function todasLasPlantillas(db: D1Database): Promise<PlantillaLeida[]> {
  const { results } = await db
    .prepare(
      'SELECT id, nombre_es, nombre_en, descripcion_es, descripcion_en, permisos_json, topes_json FROM plantillas_internas ORDER BY creado_en LIMIT 200',
    )
    .all<{
      id: string;
      nombre_es: string;
      nombre_en: string;
      descripcion_es: string;
      descripcion_en: string;
      permisos_json: string;
      topes_json: string | null;
    }>();
  const guardadas = new Map(results.map((r) => [r.id, r]));
  const fabrica = PLANTILLAS_SISTEMA.map((p) => plantillaDeFila(p.id, guardadas.get(p.id) ?? null));
  const propias = results
    .filter((r) => !PLANTILLAS_SISTEMA.some((p) => p.id === r.id))
    .map((r) => plantillaDeFila(r.id, r));
  return [...fabrica, ...propias].filter((p): p is PlantillaLeida => !!p);
}

const esquemaTopes = z
  .record(
    z.string().regex(/^[A-Z]{3}$/, { error: 'Moneda no válida.' }),
    z.number().int().min(0).max(1_000_000_000),
  )
  .nullable()
  .optional();
const esquemaAsignacion = z.object({
  plantillaId: z.string().regex(/^[a-z0-9_-]{2,40}$/),
  alcance: esquemaAlcance.default({}),
  venceEn: z.iso.date({ error: 'La fecha debe ser AAAA-MM-DD.' }).nullable().optional(),
});
const esquemaMotivo = z
  .string()
  .trim()
  .min(5, { error: 'Escribe el motivo (al menos 5 letras).' })
  .max(300);

function aAlcance(a: z.infer<typeof esquemaAlcance>): Alcance {
  return {
    paises: a.paises?.length ? a.paises : null,
    zonas: a.zonas?.length ? a.zonas : null,
    servicios: a.servicios?.length ? a.servicios : null,
  };
}

/** Ciudades pedidas que no caen en los países de quien da el acceso (`alcanceDentroDe` no lo ve). */
async function zonasFuera(db: D1Database, pedidas: string[], propias: Alcance): Promise<boolean> {
  if (!pedidas.length || (propias.paises === null && propias.zonas === null)) return false;
  const zonasPropias = new Set(propias.zonas ?? []);
  const otras = pedidas.filter((z) => !zonasPropias.has(z));
  if (!otras.length) return false;
  if (!propias.paises?.length) return true;
  const { results } = await db
    .prepare(`SELECT id, pais FROM zonas WHERE id IN (${otras.map(() => '?').join(', ')})`)
    .bind(...otras)
    .all<{ id: string; pais: string }>();
  const paises = new Set(propias.paises);
  return otras.some((z) => !results.some((r) => r.id === z && paises.has(r.pais)));
}

/**
 * Lo que se va a dar cabe en lo de quien lo da: permisos, alcance y topes. Si no, 403 con lo que
 * sobra dicho en palabras.
 */
async function noDarMasDeLoQueTengo(
  db: D1Database,
  yo: AccesoEnSesion,
  dar: { permisos: string[]; alcances: Alcance[]; topes: Array<Topes | null> },
) {
  const sobran = permisosFuera(dar.permisos, yo.permisos);
  if (sobran.length)
    throw new ErrorDatos(
      `No puedes dar permisos que tú no tienes: ${sobran
        .map(
          (p) =>
            (new Map(Object.entries(NOMBRES_PERMISOS)).get(p) as { es: string } | undefined)?.es ??
            p,
        )
        .join(', ')}.`,
      'permisos',
      403,
    );
  const alcance = unirAlcances(dar.alcances);
  if (
    !alcanceDentroDe(alcance, yo.alcance) ||
    (await zonasFuera(db, alcance.zonas ?? [], yo.alcance))
  )
    throw new ErrorDatos(
      'No puedes dar acceso a ciudades, países o servicios fuera de los tuyos.',
      'alcance',
      403,
    );
  if (dar.topes.some((t) => !topesDentroDe(t, yo.topes)))
    throw new ErrorDatos('No puedes dar un tope de dinero mayor que el tuyo.', 'topes', 403);
}

async function plantillasPorId(db: D1Database, ids: string[]) {
  const todas = await todasLasPlantillas(db);
  const out: PlantillaLeida[] = [];
  for (const id of ids) {
    const p = todas.find((x) => x.id === id);
    if (!p) throw new ErrorDatos('Esa plantilla de puesto no existe.', 'plantillas', 404);
    out.push(p);
  }
  return out;
}

function estadoDe(f: Fila): string {
  if (f.estado === 'suspendido' || f.estado === 'retirado') return String(f.estado);
  const n = Number(f.asignaciones ?? 0);
  if (n > 0 && Number(f.vencidas ?? 0) >= n) return 'vencido';
  return 'activo';
}

const enLocalOPruebas = (c: Ctx) => {
  const e = entornoDe(c.req.url);
  return e === 'local' || e === 'pruebas';
};

function auditoria(
  db: D1Database,
  actor: string,
  accion: string,
  usuarioId: string,
  antes: unknown,
  despues: unknown,
) {
  return db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      actor,
      accion,
      `equipo:${usuarioId}`,
      antes === undefined ? null : JSON.stringify(antes).slice(0, 4000),
      JSON.stringify(despues).slice(0, 4000),
    );
}

// ─────────────────────────────── Mi acceso (para el panel) ───────────────────────────────

equipoInterno.get('/admin/equipo/yo', async (c) => {
  const u = exigir(c, 'admin');
  const a = mio(c);
  const activo = await segundoFactorActivo(base(c));
  return c.json({
    id: u.id,
    permisos: a.permisos,
    fuentes: a.fuentes,
    alcance: a.alcance,
    topes: a.topes,
    dueno: a.dueno,
    origen: a.origen,
    segundoFactor: { activo, vigente: a.dueno || segundoFactorVigente(u.segundoFactorEn) },
  });
});

// ─────────────────────────────── Personas ───────────────────────────────

const SELECT_MIEMBRO = `SELECT u.id, u.nombre, u.correo, ec.estado, ec.ultima_entrada_en AS ultimaEntrada,
       ec.motivo, p.perfil,
       (SELECT COUNT(*) FROM asignaciones_internas a WHERE a.usuario_id = u.id) AS asignaciones,
       (SELECT COUNT(*) FROM asignaciones_internas a WHERE a.usuario_id = u.id AND a.vence_en IS NOT NULL AND a.vence_en <= datetime('now')) AS vencidas,
       (SELECT MIN(a.vence_en) FROM asignaciones_internas a WHERE a.usuario_id = u.id AND a.vence_en > datetime('now')) AS venceEn
  FROM usuarios u
  LEFT JOIN equipo_cuentas ec ON ec.usuario_id = u.id
  LEFT JOIN perfiles_internos p ON p.usuario_id = u.id`;

async function conAsignaciones(db: D1Database, env: Env, filas: Fila[]) {
  const ids = filas.map((f) => String(f.id));
  const { results } = ids.length
    ? await db
        .prepare(
          `SELECT usuario_id, plantilla_id, alcance_json, vence_en FROM asignaciones_internas WHERE usuario_id IN (${ids.map(() => '?').join(', ')})`,
        )
        .bind(...ids)
        .all<{
          usuario_id: string;
          plantilla_id: string;
          alcance_json: string;
          vence_en: string | null;
        }>()
    : { results: [] };
  return filas.map((f) => {
    const mias = results.filter((r) => r.usuario_id === f.id);
    const dueno = esDueno(env, String(f.correo ?? ''));
    return {
      id: String(f.id),
      nombre: String(f.nombre ?? ''),
      correo: String(f.correo ?? ''),
      estado: dueno ? 'activo' : estadoDe(f),
      dueno,
      perfilViejo: mias.length ? null : (texto(f.perfil) ?? 'total'),
      plantillas: dueno ? ['total'] : mias.map((m) => m.plantilla_id),
      alcance: unirAlcances(mias.map((m) => leerAlcance(m.alcance_json))),
      ultimaEntrada: texto(f.ultimaEntrada),
      venceEn: texto(f.venceEn),
    };
  });
}

equipoInterno.get('/admin/equipo/miembros', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const despues = (c.req.query('despues') ?? '').slice(0, 200);
  let filas: Fila[];
  let siguiente: string | null = null;
  if (q) {
    // Por comienzo del nombre (sin acentos, por su índice) o del correo (índice único del correo).
    const [desde, hasta] = rangoPrefijo(textoPlano(q));
    const [cd, ch] = rangoPrefijo(q.toLowerCase());
    const { results } = await db
      .prepare(
        `${SELECT_MIEMBRO} WHERE u.id IN (
           SELECT id FROM usuarios WHERE rol = 'admin' AND ${NOMBRE_PLANO} >= ? AND ${NOMBRE_PLANO} < ?
           UNION SELECT id FROM usuarios WHERE correo >= ? AND correo < ? AND rol = 'admin')
         ORDER BY u.nombre COLLATE NOCASE, u.id LIMIT ?`,
      )
      .bind(desde, hasta, cd, ch, POR_PAGINA)
      .all<Fila>();
    filas = results;
  } else {
    // Paginación por clave sobre (nombre, id) con el índice usuarios_rol_nombre: nunca OFFSET.
    const [nombreTras, idTras] = despues ? despues.split('~') : [null, null];
    const { results } = await db
      .prepare(
        `${SELECT_MIEMBRO} WHERE u.rol = 'admin'${despues ? ' AND (u.nombre COLLATE NOCASE > ?1 OR (u.nombre COLLATE NOCASE = ?1 AND u.id > ?2))' : ''}
         ORDER BY u.nombre COLLATE NOCASE, u.id LIMIT ${POR_PAGINA + 1}`,
      )
      .bind(...(despues ? [nombreTras ?? '', idTras ?? ''] : []))
      .all<Fila>();
    filas = results.slice(0, POR_PAGINA);
    const ultima = filas.at(-1);
    if (results.length > POR_PAGINA && ultima)
      siguiente = `${String(ultima.nombre)}~${String(ultima.id)}`;
  }
  return c.json({ miembros: await conAsignaciones(db, c.env, filas), siguiente });
});

equipoInterno.get('/admin/equipo/miembros/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare(`${SELECT_MIEMBRO} WHERE u.id = ? AND u.rol = 'admin'`)
    .bind(id)
    .first<Fila>();
  if (!f) throw new ErrorDatos('Esa persona no es del equipo.', undefined, 404);
  const [miembro] = await conAsignaciones(db, c.env, [f]);
  const acceso = await leerAccesoInterno(db, c.env, { id, correo: String(f.correo) });
  const veAccesos = mio(c).permisos.includes('auditoria.accesos');
  const [asignaciones, ajustes, acciones, accesos, cambios] = await db.batch([
    db
      .prepare(
        `SELECT a.plantilla_id AS plantillaId, a.alcance_json, a.vence_en AS venceEn, a.motivo,
                a.creado_en AS creadoEn, u.nombre AS asignadoPor
           FROM asignaciones_internas a LEFT JOIN usuarios u ON u.id = a.asignado_por WHERE a.usuario_id = ?`,
      )
      .bind(id),
    db
      .prepare(
        'SELECT permiso, tipo, motivo, creado_en AS creadoEn FROM permisos_persona WHERE usuario_id = ?',
      )
      .bind(id),
    db
      .prepare(
        'SELECT id, metodo, ruta, estado, creado_en AS creadoEn FROM acciones_equipo WHERE usuario_id = ? ORDER BY id DESC LIMIT 50',
      )
      .bind(id),
    db
      .prepare(
        `SELECT id, objeto, tipo, permiso, creado_en AS creadoEn FROM accesos_sensibles
          WHERE usuario_id = ? AND ? = 1 ORDER BY id DESC LIMIT 50`,
      )
      .bind(id, veAccesos ? 1 : 0),
    db
      .prepare(
        `SELECT a.id, a.accion, a.antes_json AS antes, a.despues_json AS despues, a.creado_en AS creadoEn,
                u.nombre AS actor
           FROM auditoria_admin a LEFT JOIN usuarios u ON u.id = a.actor_id
          WHERE a.objeto = ? ORDER BY a.id DESC LIMIT 50`,
      )
      .bind(`equipo:${id}`),
  ]);
  return c.json({
    miembro,
    acceso: {
      permisos: acceso.permisos,
      fuentes: acceso.fuentes,
      alcance: acceso.alcance,
      topes: acceso.topes,
      origen: acceso.origen,
      dueno: acceso.dueno,
    },
    asignaciones: (asignaciones?.results ?? []).map((r) => {
      const { alcance_json, ...resto } = r as Fila;
      return { ...resto, alcance: leerAlcance(texto(alcance_json)) };
    }),
    ajustes: ajustes?.results ?? [],
    acciones: acciones?.results ?? [],
    accesos: veAccesos ? (accesos?.results ?? []) : null,
    cambios: cambios?.results ?? [],
  });
});

const esquemaCambioMiembro = z.object({
  asignaciones: z.array(esquemaAsignacion).max(10),
  ajustes: z
    .array(
      z.object({
        permiso: z.enum(PERMISOS_INTERNOS),
        tipo: z.enum(['extra', 'quitado']),
        motivo: esquemaMotivo,
      }),
    )
    .max(30)
    .default([]),
  motivo: esquemaMotivo,
});

/** La persona a la que se le cambia algo: del equipo, no yo, no el dueño, y que no tenga más que yo. */
async function destinoGestionable(c: Ctx, id: string) {
  const u = exigir(c, 'admin');
  const db = base(c);
  if (id === u.id)
    throw new ErrorDatos(
      'No puedes cambiar tu propio acceso. Pídeselo a otra persona que gestione el equipo.',
      undefined,
      409,
    );
  const f = await db
    .prepare("SELECT id, nombre, correo FROM usuarios WHERE id = ? AND rol = 'admin'")
    .bind(id)
    .first<{ id: string; nombre: string; correo: string }>();
  if (!f) throw new ErrorDatos('Esa persona no es del equipo.', undefined, 404);
  if (esDueno(c.env, f.correo))
    throw new ErrorDatos('La cuenta del dueño siempre tiene acceso Total.', undefined, 409);
  const suyo = await leerAccesoInterno(db, c.env, f);
  if (permisosFuera(suyo.permisos, mio(c).permisos).length)
    throw new ErrorDatos(
      'Esta persona tiene permisos que tú no tienes: la gestiona alguien con más acceso.',
      undefined,
      403,
    );
  return { u, db, f, suyo };
}

equipoInterno.put('/admin/equipo/miembros/:id', async (c) => {
  const { u, db, f, suyo } = await destinoGestionable(c, c.req.param('id'));
  const d = await leerCuerpo(c, esquemaCambioMiembro);
  const ids = [...new Set(d.asignaciones.map((a) => a.plantillaId))];
  const plantillas = await plantillasPorId(db, ids);
  await noDarMasDeLoQueTengo(db, mio(c), {
    permisos: [
      ...plantillas.flatMap((p) => p.permisos),
      ...d.ajustes.filter((a) => a.tipo === 'extra').map((a) => a.permiso),
    ],
    alcances: d.asignaciones.map((a) => aAlcance(a.alcance)),
    topes: plantillas.filter((p) => mueveDinero(p.permisos)).map((p) => p.topes),
  });
  await db.batch([
    db.prepare('DELETE FROM asignaciones_internas WHERE usuario_id = ?').bind(f.id),
    db.prepare('DELETE FROM permisos_persona WHERE usuario_id = ?').bind(f.id),
    ...d.asignaciones.map((a) =>
      db
        .prepare(
          'INSERT INTO asignaciones_internas (usuario_id, plantilla_id, alcance_json, vence_en, motivo, asignado_por) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          f.id,
          a.plantillaId,
          JSON.stringify(a.alcance),
          a.venceEn ? `${a.venceEn} 23:59:59` : null,
          d.motivo,
          u.id,
        ),
    ),
    ...d.ajustes.map((a) =>
      db
        .prepare(
          'INSERT INTO permisos_persona (usuario_id, permiso, tipo, motivo, puesto_por) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(f.id, a.permiso, a.tipo, a.motivo, u.id),
    ),
    auditoria(
      db,
      u.id,
      'equipo.permisos',
      f.id,
      { permisos: suyo.permisos },
      {
        asignaciones: d.asignaciones,
        ajustes: d.ajustes,
        motivo: d.motivo,
      },
    ),
    // Vale desde su próxima petición: no hace falta que vuelva a entrar.
    renovarSesionesDe(db, f.id),
  ]);
  return c.json({ ok: true });
});

async function cambiarEstado(c: Ctx, estado: 'suspendido' | 'activo' | 'retirado') {
  const { u, db, f } = await destinoGestionable(c, c.req.param('id') ?? '');
  const { motivo } = await leerCuerpo(c, z.object({ motivo: esquemaMotivo }));
  const antes = await db
    .prepare('SELECT estado FROM equipo_cuentas WHERE usuario_id = ?')
    .bind(f.id)
    .first<{ estado: string }>();
  await db.batch([
    db
      .prepare(
        `INSERT INTO equipo_cuentas (usuario_id, estado, motivo, actualizado_por, actualizado_en)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado, motivo = excluded.motivo,
           actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en`,
      )
      .bind(f.id, estado, motivo, u.id),
    auditoria(
      db,
      u.id,
      `equipo.${estado}`,
      f.id,
      { estado: antes?.estado ?? 'activo' },
      { estado, motivo },
    ),
    // Suspender o quitar: fuera al instante en todos sus aparatos. Reactivar: recalcula al entrar.
    estado === 'activo' ? renovarSesionesDe(db, f.id) : cerrarSesionesDe(db, f.id),
  ]);
  return c.json({ ok: true, estado });
}

equipoInterno.post('/admin/equipo/miembros/:id/suspender', (c) => cambiarEstado(c, 'suspendido'));
equipoInterno.post('/admin/equipo/miembros/:id/reactivar', (c) => cambiarEstado(c, 'activo'));
equipoInterno.post('/admin/equipo/miembros/:id/quitar', (c) => cambiarEstado(c, 'retirado'));

// ─────────────────────────────── Plantillas ───────────────────────────────

equipoInterno.get('/admin/equipo/plantillas', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const [plantillas, { results: usos }] = await Promise.all([
    todasLasPlantillas(db),
    db
      .prepare(
        'SELECT plantilla_id, COUNT(*) AS n FROM asignaciones_internas GROUP BY plantilla_id',
      )
      .all<{ plantilla_id: string; n: number }>(),
  ]);
  const n = new Map(usos.map((r) => [r.plantilla_id, Number(r.n)]));
  return c.json({
    plantillas: plantillas.map((p) => ({
      ...p,
      editable: p.id !== 'total',
      borrable: !p.sistema,
      personas: n.get(p.id) ?? 0,
    })),
    permisos: PERMISOS_INTERNOS,
  });
});

const esquemaPlantilla = z.object({
  nombre: z.object({
    es: z.string().trim().min(2, { error: 'Escribe el nombre en español.' }).max(60),
    en: z.string().trim().min(2, { error: 'Escribe el nombre en inglés.' }).max(60),
  }),
  descripcion: z
    .object({
      es: z.string().trim().max(300).default(''),
      en: z.string().trim().max(300).default(''),
    })
    .default({ es: '', en: '' }),
  permisos: z
    .array(z.enum(PERMISOS_INTERNOS))
    .min(1, { error: 'Elige al menos un permiso.' })
    .max(80),
  topes: esquemaTopes,
});

async function guardarPlantilla(c: Ctx, id: string, nueva: boolean) {
  const u = exigir(c, 'admin');
  const db = base(c);
  if (id === 'total')
    throw new ErrorDatos('La plantilla Total es todo, siempre: no se edita.', undefined, 409);
  const d = await leerCuerpo(c, esquemaPlantilla);
  await noDarMasDeLoQueTengo(db, mio(c), {
    permisos: d.permisos,
    alcances: [],
    topes: mueveDinero(d.permisos) ? [d.topes ?? null] : [],
  });
  const sistema = PLANTILLAS_SISTEMA.some((p) => p.id === id) ? 1 : 0;
  const antes = nueva ? null : (await todasLasPlantillas(db)).find((p) => p.id === id);
  if (!nueva && !antes) throw new ErrorDatos('Esa plantilla de puesto no existe.', undefined, 404);
  await db.batch([
    db
      .prepare(
        `INSERT INTO plantillas_internas (id, nombre_es, nombre_en, descripcion_es, descripcion_en, permisos_json, topes_json, sistema, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET nombre_es = excluded.nombre_es, nombre_en = excluded.nombre_en,
           descripcion_es = excluded.descripcion_es, descripcion_en = excluded.descripcion_en,
           permisos_json = excluded.permisos_json, topes_json = excluded.topes_json, actualizado_en = datetime('now')`,
      )
      .bind(
        id,
        d.nombre.es,
        d.nombre.en,
        d.descripcion.es,
        d.descripcion.en,
        JSON.stringify(d.permisos),
        d.topes ? JSON.stringify(d.topes) : null,
        sistema,
        u.id,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        u.id,
        nueva ? 'equipo.plantilla_nueva' : 'equipo.plantilla',
        `equipo:plantilla:${id}`,
        antes ? JSON.stringify({ permisos: antes.permisos, topes: antes.topes }) : null,
        JSON.stringify({ permisos: d.permisos, topes: d.topes ?? null }),
      ),
    // Quien tiene esta plantilla ve el cambio en su próxima petición.
    db
      .prepare(
        'UPDATE sesiones SET permisos_json = NULL WHERE usuario_id IN (SELECT usuario_id FROM asignaciones_internas WHERE plantilla_id = ?)',
      )
      .bind(id),
  ]);
  return c.json({ ok: true, id });
}

equipoInterno.post('/admin/equipo/plantillas', (c) =>
  guardarPlantilla(c, `p-${nuevoId().slice(0, 8)}`, true),
);
equipoInterno.put('/admin/equipo/plantillas/:id', (c) =>
  guardarPlantilla(c, c.req.param('id'), false),
);

equipoInterno.delete('/admin/equipo/plantillas/:id', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  if (PLANTILLAS_SISTEMA.some((p) => p.id === id))
    throw new ErrorDatos('Las plantillas de fábrica no se borran.', undefined, 409);
  const usos = await db
    .prepare('SELECT COUNT(*) AS n FROM asignaciones_internas WHERE plantilla_id = ?')
    .bind(id)
    .first<{ n: number }>();
  if (Number(usos?.n ?? 0) > 0)
    throw new ErrorDatos(
      'Esta plantilla todavía la tiene alguien del equipo. Quítasela primero.',
      undefined,
      409,
    );
  const r = await db.prepare('DELETE FROM plantillas_internas WHERE id = ?').bind(id).run();
  if (!r.meta.changes) throw new ErrorDatos('Esa plantilla de puesto no existe.', undefined, 404);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, NULL, ?)',
    )
    .bind(u.id, 'equipo.plantilla_borrada', `equipo:plantilla:${id}`, '{}')
    .run();
  return c.json({ ok: true });
});

// ─────────────────────────────── Invitaciones ───────────────────────────────

const esquemaInvitacion = z
  .object({
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'Escribe un correo válido.' })),
    nombre: z.string().trim().min(2, { error: 'Escribe el nombre.' }).max(80),
    plantillas: z
      .array(z.string().regex(/^[a-z0-9_-]{2,40}$/))
      .min(1, { error: 'Elige al menos una plantilla de puesto.' })
      .max(10),
    alcance: esquemaAlcance.default({}),
    venceEn: z.iso.date({ error: 'La fecha debe ser AAAA-MM-DD.' }).nullable().optional(),
    motivo: esquemaMotivo,
    idioma: z.enum(['es', 'en']).default('en'),
  })
  .refine((d) => nombreCumpleSoporte(d.correo, d.nombre), {
    error: 'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
    path: ['nombre'],
  });

equipoInterno.get('/admin/equipo/invitaciones', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT i.id, i.correo, i.nombre, i.plantillas_json, i.alcance_json, i.vence_acceso_en AS venceEn,
              i.expira_en AS expiraEn, i.creado_en AS creadoEn, u.nombre AS invitadoPor,
              CASE WHEN i.aceptada_en IS NOT NULL THEN 'aceptada'
                   WHEN i.cancelada_en IS NOT NULL THEN 'cancelada'
                   WHEN i.expira_en <= datetime('now') THEN 'vencida' ELSE 'pendiente' END AS estado
         FROM invitaciones_equipo i LEFT JOIN usuarios u ON u.id = i.invitado_por
        ORDER BY i.creado_en DESC LIMIT 50`,
    )
    .all<Fila>();
  return c.json({
    invitaciones: results.map(({ plantillas_json, alcance_json, ...r }) => ({
      ...r,
      plantillas: JSON.parse(String(plantillas_json ?? '[]')) as string[],
      alcance: leerAlcance(texto(alcance_json)),
    })),
  });
});

equipoInterno.post('/admin/equipo/invitaciones', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaInvitacion);
  const plantillas = await plantillasPorId(db, [...new Set(d.plantillas)]);
  await noDarMasDeLoQueTengo(db, mio(c), {
    permisos: plantillas.flatMap((p) => p.permisos),
    alcances: [aAlcance(d.alcance)],
    topes: plantillas.filter((p) => mueveDinero(p.permisos)).map((p) => p.topes),
  });
  // Solo correos sin cuenta: una cuenta de cliente, repartidor o comercio no se convierte en
  // cuenta del equipo (cada persona del equipo entra con su correo de trabajo).
  const existe = await db
    .prepare('SELECT rol FROM usuarios WHERE correo = ? OR correo_canonico = ?')
    .bind(d.correo, correoCanonico(d.correo))
    .first<{ rol: string }>();
  if (existe)
    throw new ErrorDatos(
      existe.rol === 'admin'
        ? 'Esa persona ya es del equipo. Cambia su acceso desde su ficha.'
        : 'Ese correo ya tiene una cuenta de Divoox. Invita a la persona con su correo de trabajo.',
      'correo',
      409,
    );
  const codigo = nuevoToken();
  const id = nuevoId();
  await db.batch([
    // Una invitación pendiente por correo: la nueva reemplaza a la anterior.
    db
      .prepare(
        "UPDATE invitaciones_equipo SET cancelada_en = datetime('now') WHERE correo = ? AND aceptada_en IS NULL AND cancelada_en IS NULL",
      )
      .bind(d.correo),
    db
      .prepare(
        `INSERT INTO invitaciones_equipo (id, codigo_hash, correo, nombre, plantillas_json, alcance_json, vence_acceso_en, motivo, idioma, invitado_por, expira_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
      )
      .bind(
        id,
        await sha256(codigo),
        d.correo,
        d.nombre,
        JSON.stringify(plantillas.map((p) => p.id)),
        JSON.stringify(d.alcance),
        d.venceEn ? `${d.venceEn} 23:59:59` : null,
        d.motivo,
        d.idioma,
        u.id,
        `+${CONFIG_PERMISOS.diasInvitacion} days`,
      ),
    db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, NULL, ?)',
      )
      .bind(
        u.id,
        'equipo.invitacion',
        `equipo:invitacion:${id}`,
        JSON.stringify({
          plantillas: d.plantillas,
          alcance: d.alcance,
          venceEn: d.venceEn ?? null,
          motivo: d.motivo,
        }),
      ),
  ]);
  const origen = new URL(c.req.url).origin;
  const enlace = `${origen}${d.idioma === 'es' ? '/es' : ''}/team-invite?code=${codigo}`;
  // En local y en el sitio de pruebas el correo NO sale a nadie: el enlace vuelve SOLO en esta
  // respuesta, para quien invitó. En producción sale por correo y nunca se devuelve.
  if (enLocalOPruebas(c)) return c.json({ ok: true, id, enlace, correoEnviado: false }, 201);
  const en = d.idioma === 'en';
  const nombre = d.nombre.split(' ')[0] ?? '';
  const envio = await enviarCorreo(c.env, {
    de: 'soporte',
    para: d.correo,
    idioma: d.idioma,
    asunto: en ? 'You’re invited to the Divoox team' : 'Te invitaron al equipo de Divoox',
    texto: en
      ? `Hi ${nombre},\n\n${u.nombre} invited you to the Divoox internal team. Tap this link to create your password (it works once and expires in ${CONFIG_PERMISOS.diasInvitacion} days):\n\n${enlace}\n\nIf you weren’t expecting this, ignore this email.`
      : `Hola, ${nombre}.\n\n${u.nombre} te invitó al equipo interno de Divoox. Toca este enlace para crear tu contraseña (sirve una vez y vence en ${CONFIG_PERMISOS.diasInvitacion} días):\n\n${enlace}\n\nSi no esperabas esta invitación, ignora este correo.`,
  });
  return c.json({ ok: true, id, correoEnviado: envio.ok }, 201);
});

equipoInterno.delete('/admin/equipo/invitaciones/:id', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const r = await db
    .prepare(
      "UPDATE invitaciones_equipo SET cancelada_en = datetime('now') WHERE id = ? AND aceptada_en IS NULL AND cancelada_en IS NULL",
    )
    .bind(c.req.param('id'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa invitación ya no está pendiente.', undefined, 409);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, NULL, ?)',
    )
    .bind(u.id, 'equipo.invitacion_cancelada', `equipo:invitacion:${c.req.param('id')}`, '{}')
    .run();
  return c.json({ ok: true });
});

// La invitación desde el enlace (sin sesión): ver y aceptar. El código nunca se guarda, solo su huella.
async function invitacionVigente(db: D1Database, codigo: string) {
  const f = await db
    .prepare(
      `SELECT i.id, i.correo, i.nombre, i.plantillas_json, i.alcance_json, i.vence_acceso_en, i.idioma,
              i.invitado_por, i.expira_en, u.nombre AS invitado_por_nombre
         FROM invitaciones_equipo i LEFT JOIN usuarios u ON u.id = i.invitado_por
        WHERE i.codigo_hash = ? AND i.aceptada_en IS NULL AND i.cancelada_en IS NULL AND i.expira_en > datetime('now')`,
    )
    .bind(await sha256(codigo))
    .first<{
      id: string;
      correo: string;
      nombre: string;
      plantillas_json: string;
      alcance_json: string;
      vence_acceso_en: string | null;
      idioma: string;
      invitado_por: string;
      expira_en: string;
      invitado_por_nombre: string | null;
    }>();
  if (!f)
    throw new ErrorDatos(
      'Esta invitación ya se usó, venció o la cancelaron. Pide una nueva a quien te invitó.',
      undefined,
      410,
    );
  return f;
}

const esquemaCodigo = z.string().trim().min(20).max(200);

equipoInterno.post('/equipo-interno/invitacion/ver', async (c) => {
  const { codigo } = await leerCuerpo(c, z.object({ codigo: esquemaCodigo }));
  const f = await invitacionVigente(base(c), codigo);
  const plantillas = await plantillasPorId(
    base(c),
    JSON.parse(f.plantillas_json) as string[],
  ).catch(() => []);
  return c.json({
    correo: f.correo,
    nombre: f.nombre,
    invitadoPor: f.invitado_por_nombre,
    expiraEn: f.expira_en,
    plantillas: plantillas.map((p) => p.nombre),
  });
});

equipoInterno.post('/equipo-interno/invitacion/aceptar', async (c) => {
  const pasa = await pasaTurnstile(
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header('cf-turnstile-response'),
    c.req.header('cf-connecting-ip'),
  );
  if (!pasa)
    throw new ErrorDatos(
      'No pudimos confirmar que eres una persona. Recarga la página e intenta de nuevo.',
      undefined,
      403,
    );
  const d = await leerCuerpo(
    c,
    z.object({
      codigo: esquemaCodigo,
      nombre: z.string().trim().min(2, { error: 'Escribe tu nombre.' }).max(80),
      clave: z
        .string()
        .min(8, { error: 'La contraseña debe tener al menos 8 caracteres.' })
        .max(200, { error: 'La contraseña es demasiado larga.' }),
    }),
  );
  const db = base(c);
  const inv = await invitacionVigente(db, d.codigo);
  if (!nombreCumpleSoporte(inv.correo, d.nombre))
    throw new ErrorDatos(
      'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
      'nombre',
      400,
    );
  // Un solo uso: se reclama primero (dos clics a la vez no crean dos cuentas).
  const id = nuevoId();
  const reclamo = await db
    .prepare(
      "UPDATE invitaciones_equipo SET aceptada_en = datetime('now') WHERE id = ? AND aceptada_en IS NULL AND cancelada_en IS NULL",
    )
    .bind(inv.id)
    .run();
  if (!reclamo.meta.changes)
    throw new ErrorDatos(
      'Esta invitación ya se usó, venció o la cancelaron. Pide una nueva a quien te invitó.',
      undefined,
      410,
    );
  const existe = await db
    .prepare('SELECT 1 FROM usuarios WHERE correo = ? OR correo_canonico = ?')
    .bind(inv.correo, correoCanonico(inv.correo))
    .first();
  if (existe) {
    await db
      .prepare('UPDATE invitaciones_equipo SET aceptada_en = NULL WHERE id = ?')
      .bind(inv.id)
      .run();
    throw new ErrorDatos(
      'Ese correo ya tiene una cuenta de Divoox. Pide que te inviten con tu correo de trabajo.',
      undefined,
      409,
    );
  }
  const plantillas = JSON.parse(inv.plantillas_json) as string[];
  const token = nuevoToken();
  const idioma = inv.idioma === 'es' ? 'es' : 'en';
  await db.batch([
    db
      .prepare(
        `INSERT INTO usuarios (id, correo, nombre, rol, idioma, clave_hash, correo_canonico, correo_confirmado_en)
         VALUES (?, ?, ?, 'admin', ?, ?, ?, datetime('now'))`,
      )
      .bind(id, inv.correo, d.nombre, idioma, await hashClave(d.clave), correoCanonico(inv.correo)),
    db
      .prepare(
        "INSERT INTO equipo_cuentas (usuario_id, estado, invitado_por, ultima_entrada_en) VALUES (?, 'activo', ?, datetime('now'))",
      )
      .bind(id, inv.invitado_por),
    ...plantillas.map((p) =>
      db
        .prepare(
          'INSERT INTO asignaciones_internas (usuario_id, plantilla_id, alcance_json, vence_en, motivo, asignado_por) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(id, p, inv.alcance_json, inv.vence_acceso_en, 'Invitación', inv.invitado_por),
    ),
    db.prepare('UPDATE invitaciones_equipo SET usuario_id = ? WHERE id = ?').bind(id, inv.id),
    auditoria(db, inv.invitado_por, 'equipo.alta', id, undefined, {
      plantillas,
      invitacion: inv.id,
    }),
    db
      .prepare("INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))")
      .bind(await sha256(token), id, `+${DIAS_SESION} days`),
  ]);
  c.header(
    'Set-Cookie',
    `${COOKIE_SESION}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS_SESION * 86400}`,
  );
  return c.json(
    { token, usuario: { id, nombre: d.nombre, correo: inv.correo, rol: 'admin', idioma } },
    201,
  );
});

// ─────────────────────────────── Ver dato (teléfono o correo completos) ───────────────────────────────

const TABLAS_DATO = {
  cliente: "SELECT telefono, correo FROM usuarios WHERE id = ? AND rol = 'cliente'",
  repartidor: "SELECT telefono, correo FROM usuarios WHERE id = ? AND rol = 'repartidor'",
  cuenta: "SELECT telefono, correo FROM usuarios WHERE id = ? AND rol != 'admin'",
  ticket: 'SELECT telefono, correo FROM tickets WHERE id = ?',
  pedido:
    'SELECT u.telefono, u.correo FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.id = ?',
} as const;

equipoInterno.get('/admin/datos-personales/:tipo/:id/:campo', async (c) => {
  const u = exigir(c, 'admin');
  const tipo = c.req.param('tipo');
  const campo = c.req.param('campo');
  if (campo !== 'telefono' && campo !== 'correo')
    throw new ErrorDatos('Ese dato no existe.', undefined, 404);
  const sql = new Map(Object.entries(TABLAS_DATO)).get(tipo);
  if (!sql) throw new ErrorDatos('Ese dato no existe.', undefined, 404);
  const db = base(c);
  const f = await db
    .prepare(sql)
    .bind(c.req.param('id'))
    .first<{ telefono: string | null; correo: string | null }>();
  if (!f) throw new ErrorDatos('Ese dato no existe.', undefined, 404);
  const valor = campo === 'telefono' ? f.telefono : f.correo;
  // Primero el registro (sin el dato); si no se puede anotar, no se muestra.
  await anotarAccesoSensible(
    db,
    u.id,
    `${tipo}:${c.req.param('id')}`,
    campo,
    'clientes.datos_personales',
  );
  c.header('cache-control', 'private, no-store');
  return c.json({ valor: valor ?? '' });
});

// ─────────────────────────────── Registro (cambios y accesos) ───────────────────────────────

const TIPOS_REGISTRO = ['acciones', 'permisos', 'accesos'] as const;

equipoInterno.get('/admin/equipo/registro', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const tipo = (TIPOS_REGISTRO as readonly string[]).includes(c.req.query('tipo') ?? '')
    ? (c.req.query('tipo') as (typeof TIPOS_REGISTRO)[number])
    : 'acciones';
  if (tipo === 'accesos' && !mio(c).permisos.includes('auditoria.accesos'))
    throw new ErrorDatos(
      'Tu acceso del equipo no incluye esto. Pídeselo a quien gestiona el equipo.',
      'permiso',
      403,
    );
  const persona = (c.req.query('usuario') ?? '').slice(0, 100);
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('desde') ?? '')
    ? c.req.query('desde')
    : null;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('hasta') ?? '')
    ? c.req.query('hasta')
    : null;
  const antesDe = Number(c.req.query('despues') ?? 0) || null;
  const csv = c.req.query('formato') === 'csv';
  const tope = csv ? 5000 : POR_PAGINA;
  const filtros: string[] = [];
  const valores: unknown[] = [];
  const tabla =
    tipo === 'acciones'
      ? { t: 'acciones_equipo', quien: 'x.usuario_id' }
      : tipo === 'accesos'
        ? { t: 'accesos_sensibles', quien: 'x.usuario_id' }
        : { t: 'auditoria_admin', quien: 'x.actor_id' };
  if (persona) {
    filtros.push(`${tabla.quien} = ?`);
    valores.push(persona);
  }
  if (tipo === 'permisos') filtros.push("x.objeto >= 'equipo:' AND x.objeto < 'equipo;'");
  if (desde) {
    filtros.push('x.creado_en >= ?');
    valores.push(desde);
  }
  if (hasta) {
    filtros.push("x.creado_en < date(?, '+1 day')");
    valores.push(hasta);
  }
  if (antesDe) {
    filtros.push('x.id < ?');
    valores.push(antesDe);
  }
  const columnas =
    tipo === 'acciones'
      ? "x.metodo || ' ' || x.ruta AS que, x.estado AS detalle"
      : tipo === 'accesos'
        ? "x.tipo AS que, x.objeto || ' · ' || x.permiso AS detalle"
        : 'x.accion AS que, x.objeto AS detalle';
  const { results } = await db
    .prepare(
      `SELECT x.id, ${tabla.quien} AS usuarioId, u.nombre, ${columnas}, x.creado_en AS creadoEn
         FROM ${tabla.t} x LEFT JOIN usuarios u ON u.id = ${tabla.quien}
        ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
        ORDER BY x.id DESC LIMIT ${tope + 1}`,
    )
    .bind(...valores)
    .all<{
      id: number;
      usuarioId: string;
      nombre: string | null;
      que: string;
      detalle: string;
      creadoEn: string;
    }>();
  const filas = results.slice(0, tope);
  if (csv) {
    const cuerpo = [
      ['fecha', 'persona', 'tipo', 'que', 'detalle'],
      ...filas.map((f) => [f.creadoEn, f.nombre ?? f.usuarioId, tipo, f.que, String(f.detalle)]),
    ]
      .map((fila) => fila.map((x) => celdaCsv(String(x ?? ''))).join(','))
      .join('\n');
    return c.body(`\uFEFF${cuerpo}\n`, 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="divoox-team-log-${tipo}.csv"`,
      'cache-control': 'private, no-store',
    });
  }
  return c.json({
    tipo,
    registro: filas,
    siguiente: results.length > tope ? String(filas.at(-1)?.id ?? '') : null,
  });
});
