import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { leerPoligono } from '../territorio';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { paisDeZona } from '../internacional/paises';

/**
 * Franquicias y superadmin (C-FRANQUICIAS, C-TERRITORIO). Una ciudad puede tener VARIAS franquicias;
 * cada una administra las áreas de cobertura que el superadmin le asigna. Su dueño y sus managers
 * entran a /panel/franchise-<ciudad>-<codigo> y ven SOLO lo de sus áreas: restaurantes,
 * repartidores, pedidos e incidencias. El superadmin (solo admin) ve todo.
 */
export const franquicias = new Hono<{ Bindings: Env; Variables: Variables }>();

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const codigoNuevo = () =>
  [...crypto.getRandomValues(new Uint8Array(10))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const rutaFranquicia = (zonaNombre: string, codigo: string) =>
  `franchise-${slug(zonaNombre)}-${codigo}`;

type Metricas = {
  pedidosHoy: number;
  pedidos30: number;
  ventas30: number;
  ganancia30: number;
  /** C-MONEDA-RECORRIDO: la moneda de la ciudad; ventas y ganancia cuentan solo pedidos en ella. */
  moneda: string;
  restaurantes: number;
  restaurantesAbiertos: number;
  repartidores: number;
  repartidoresConectados: number;
  ticketsAbiertos: number;
};

/**
 * De quién son los números: de una ciudad entera (superadmin) o de un conjunto de áreas (una
 * franquicia). Una franquicia sin áreas asignadas no ve nada: no hereda la ciudad.
 */
type Alcance = { zonaId: string } | { areas: string[] };

function filtro(a: Alcance, columna = 'area_id'): { sql: string; params: string[] } {
  if ('zonaId' in a) return { sql: 'zona_id = ?', params: [a.zonaId] };
  if (!a.areas.length) return { sql: '0', params: [] };
  return { sql: `${columna} IN (${a.areas.map(() => '?').join(',')})`, params: a.areas };
}

async function metricasDe(db: D1Database, alcance: Alcance): Promise<Metricas> {
  const f = filtro(alcance);
  const p = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN estado <> 'pago_pendiente' AND creado_en >= datetime('now','start of day') THEN 1 ELSE 0 END) AS hoy,
        SUM(CASE WHEN estado = 'entregado' AND creado_en >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS n30
       FROM pedidos WHERE ${f.sql}`,
    )
    .bind(...f.params)
    .first<{ hoy: number | null; n30: number | null }>();
  // C-MONEDA-RECORRIDO: una ciudad tiene una sola moneda (las áreas de una franquicia son de su
  // ciudad). Las ventas se suman SOLO en esa moneda: nunca se mezclan dólares con pesos.
  const zonaDeAlcance =
    'zonaId' in alcance
      ? alcance.zonaId
      : alcance.areas.length
        ? ((
            await db
              .prepare('SELECT zona_id FROM areas WHERE id = ?')
              .bind(alcance.areas[0])
              .first<{ zona_id: string }>()
          )?.zona_id ?? null)
        : null;
  const moneda = zonaDeAlcance ? (await paisDeZona(db, zonaDeAlcance)).moneda : 'USD';
  const v = await db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS ventas, COALESCE(SUM(ganancia), 0) AS ganancia FROM pedidos
       WHERE ${f.sql} AND estado = 'entregado' AND creado_en >= datetime('now','-30 days') AND moneda = ?`,
    )
    .bind(...f.params, moneda)
    .first<{ ventas: number | null; ganancia: number | null }>();
  const r = await db
    .prepare(
      `SELECT SUM(CASE WHEN estado = 'aprobado' THEN 1 ELSE 0 END) AS n, SUM(CASE WHEN estado = 'aprobado' AND abierto = 1 THEN 1 ELSE 0 END) AS abiertos FROM restaurantes WHERE ${f.sql}`,
    )
    .bind(...f.params)
    .first<{ n: number | null; abiertos: number | null }>();
  const d = await db
    .prepare(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN conectado = 1 THEN 1 ELSE 0 END) AS conectados FROM repartidores WHERE ${f.sql}`,
    )
    .bind(...f.params)
    .first<{ n: number | null; conectados: number | null }>();
  const t =
    'zonaId' in alcance
      ? await db
          .prepare("SELECT COUNT(*) AS n FROM tickets WHERE zona_id = ? AND estado = 'abierto'")
          .bind(alcance.zonaId)
          .first<{ n: number | null }>()
      : await db
          .prepare(
            `SELECT COUNT(*) AS n FROM tickets WHERE estado = 'abierto' AND pedido_id IN (SELECT id FROM pedidos WHERE ${f.sql})`,
          )
          .bind(...f.params)
          .first<{ n: number | null }>();
  return {
    pedidosHoy: Number(p?.hoy ?? 0),
    pedidos30: Number(p?.n30 ?? 0),
    ventas30: Number(v?.ventas ?? 0),
    ganancia30: Number(v?.ganancia ?? 0),
    moneda,
    restaurantes: Number(r?.n ?? 0),
    restaurantesAbiertos: Number(r?.abiertos ?? 0),
    repartidores: Number(d?.n ?? 0),
    repartidoresConectados: Number(d?.conectados ?? 0),
    ticketsAbiertos: Number(t?.n ?? 0),
  };
}

type FilaFranquicia = {
  id: string;
  zona_id: string;
  zona_nombre: string;
  pais: string;
  codigo: string;
  estado: string;
  dueno_id: string | null;
  dueno_correo: string;
  motos: number;
  notas: string;
  creado_en: string;
  vendida_en: string | null;
  nombre: string;
  ticket_id: string | null;
  condiciones_json: string;
};

const SELECT_FRANQUICIA = `SELECT f.*, z.nombre AS zona_nombre, z.pais AS pais FROM franquicias f JOIN zonas z ON z.id = f.zona_id`;

/**
 * Condiciones comerciales de la franquicia. Ningún valor viene de fábrica: todos quedan en null
 * («pendiente de definición comercial») hasta que el negocio los fije. Ningún cálculo de dinero
 * los lee todavía.
 */
const esquemaCondiciones = z.object({
  cuotaEntradaCentavos: z.number().int().min(0).nullable().default(null),
  porcentajeIngresos: z.number().min(0).max(100).nullable().default(null),
  cuotaMensualCentavos: z.number().int().min(0).nullable().default(null),
  plazoMeses: z.number().int().min(0).max(1200).nullable().default(null),
  exclusividadTerritorial: z.boolean().nullable().default(null),
  observaciones: z.string().trim().max(2000).default(''),
});
type Condiciones = z.infer<typeof esquemaCondiciones>;

function leerCondiciones(texto: string): Condiciones {
  try {
    const r = esquemaCondiciones.safeParse(JSON.parse(texto || '{}'));
    if (r.success) return r.data;
  } catch {
    console.error('franquicias: condiciones ilegibles', texto.slice(0, 80));
  }
  return esquemaCondiciones.parse({});
}

function publica(f: FilaFranquicia) {
  return {
    id: f.id,
    nombre: f.nombre || f.zona_nombre,
    zonaId: f.zona_id,
    ciudad: f.zona_nombre,
    pais: f.pais,
    estado: f.estado,
    duenoCorreo: f.dueno_correo,
    tieneCuenta: Boolean(f.dueno_id),
    motos: Number(f.motos),
    notas: f.notas,
    creada: f.creado_en,
    vendida: f.vendida_en,
    ticketId: f.ticket_id,
    condiciones: leerCondiciones(f.condiciones_json),
    ruta: rutaFranquicia(f.zona_nombre, f.codigo),
  };
}

async function areasDe(db: D1Database, franquiciaId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT area_id FROM franquicia_areas WHERE franquicia_id = ?')
    .bind(franquiciaId)
    .all<{ area_id: string }>();
  return results.map((r) => r.area_id);
}

type Rol = 'admin' | 'dueno' | 'manager';

/** Qué papel tiene esta cuenta en esta franquicia (o null: para ella la franquicia no existe). */
async function rolEn(
  db: D1Database,
  u: { id: string; correo: string; rol: string },
  f: FilaFranquicia,
): Promise<Rol | null> {
  if (u.rol === 'admin') return 'admin';
  if (f.dueno_id === u.id) return 'dueno';
  // C-FRANQUICIA-CORREO-CONFIRMADO (27 oct 2026): el acceso por correo solo vale con el correo
  // CONFIRMADO. Antes, registrar (o cambiar la cuenta a) el correo de una franquicia sin cuenta
  // abría su panel a cualquiera. Lo encontró la auditoría de Divoox Flex.
  if (!(await correoConfirmado(db, u.id))) return null;
  if (f.dueno_correo !== '' && f.dueno_correo.toLowerCase() === u.correo.toLowerCase())
    return 'dueno';
  const m = await db
    .prepare('SELECT rol FROM franquicia_miembros WHERE franquicia_id = ? AND correo = ?')
    .bind(f.id, u.correo)
    .first<{ rol: 'dueno' | 'manager' }>();
  return m?.rol ?? null;
}

async function correoConfirmado(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT correo_confirmado_en FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ correo_confirmado_en: string | null }>();
  return Boolean(f?.correo_confirmado_en);
}

// ───────────────────────── Superadmin ─────────────────────────

franquicias.get('/admin/resumen', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: lista } = await db
    .prepare(`${SELECT_FRANQUICIA} ORDER BY z.nombre, f.nombre`)
    .all<FilaFranquicia>();
  const filas: (ReturnType<typeof publica> & { metricas: Metricas; areas: number })[] = [];
  for (const f of lista) {
    const areas = await areasDe(db, f.id);
    filas.push({ ...publica(f), areas: areas.length, metricas: await metricasDe(db, { areas }) });
  }
  // Ciudades: los resultados globales por ciudad, con cuántas franquicias y áreas tiene cada una.
  const { results: zonas } = await db
    .prepare(
      `SELECT z.id, z.nombre, z.pais, z.activa,
        (SELECT COUNT(*) FROM franquicias f WHERE f.zona_id = z.id) AS franquicias,
        (SELECT COUNT(*) FROM areas a WHERE a.zona_id = z.id AND a.estado <> 'cerrada') AS areas,
        (SELECT COUNT(*) FROM areas a WHERE a.zona_id = z.id AND a.estado <> 'cerrada'
           AND NOT EXISTS (SELECT 1 FROM franquicia_areas fa WHERE fa.area_id = a.id)) AS areas_libres
       FROM zonas z ORDER BY z.activa DESC, z.nombre`,
    )
    .all<{
      id: string;
      nombre: string;
      pais: string;
      activa: number;
      franquicias: number;
      areas: number;
      areas_libres: number;
    }>();
  const ciudades = [];
  for (const z of zonas)
    ciudades.push({
      id: z.id,
      ciudad: z.nombre,
      pais: z.pais,
      activa: Boolean(z.activa),
      franquicias: Number(z.franquicias),
      areas: Number(z.areas),
      areasLibres: Number(z.areas_libres),
      metricas: await metricasDe(db, { zonaId: z.id }),
    });
  const cuenta = (e: string) => filas.filter((f) => f.estado === e).length;
  const leads = await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE tipo = 'franquicia' AND estado <> 'cerrado'")
    .first<{ n: number }>();
  const abiertos = await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE estado = 'abierto'")
    .first<{ n: number }>();
  return c.json({
    totales: {
      franquicias: filas.length,
      vendidas: cuenta('vendida') + cuenta('activa') + cuenta('pausada'),
      activas: cuenta('activa'),
      interesados: Number(leads?.n ?? 0),
      ticketsAbiertos: Number(abiertos?.n ?? 0),
      motos: filas.reduce((s, f) => s + f.motos, 0),
    },
    franquicias: filas,
    ciudades,
    // Compatibilidad con el panel de antes: las ciudades que no tienen ninguna franquicia.
    sinFranquicia: ciudades.filter((z) => z.franquicias === 0),
  });
});

const esquemaFranquicia = z.object({
  zonaId: z.string().min(2).max(40),
  nombre: z.string().trim().max(80).default(''),
  estado: z.enum(['prospecto', 'vendida', 'activa', 'pausada', 'cerrada']).default('prospecto'),
  duenoCorreo: z.string().trim().email().max(200).or(z.literal('')).default(''),
  motos: z.coerce.number().int().min(0).max(10000).default(0),
  notas: z.string().trim().max(3000).default(''),
  condiciones: esquemaCondiciones.optional(),
});

async function enlazarDueno(db: D1Database, correo: string): Promise<string | null> {
  if (!correo) return null;
  // Solo se enlaza una cuenta con el correo CONFIRMADO (C-FRANQUICIA-CORREO-CONFIRMADO); si no,
  // queda por correo y entra cuando lo confirme.
  const u = await db
    .prepare(
      'SELECT id FROM usuarios WHERE correo = ? AND activo = 1 AND correo_confirmado_en IS NOT NULL',
    )
    .bind(correo)
    .first<{ id: string }>();
  return u?.id ?? null;
}

async function crearFranquicia(
  db: D1Database,
  d: z.infer<typeof esquemaFranquicia>,
  ticketId: string | null,
): Promise<string> {
  const zona = await db.prepare('SELECT id FROM zonas WHERE id = ?').bind(d.zonaId).first();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe. Créala primero en Zonas.', 'zonaId', 404);
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO franquicias (id, zona_id, codigo, estado, dueno_id, dueno_correo, motos, notas, vendida_en, nombre, ticket_id, condiciones_json)
       VALUES (?,?,?,?,?,?,?,?, CASE WHEN ? IN ('vendida','activa') THEN datetime('now') END, ?,?,?)`,
    )
    .bind(
      id,
      d.zonaId,
      codigoNuevo(),
      d.estado,
      await enlazarDueno(db, d.duenoCorreo),
      d.duenoCorreo,
      d.motos,
      d.notas,
      d.estado,
      d.nombre,
      ticketId,
      JSON.stringify(d.condiciones ?? esquemaCondiciones.parse({})),
    )
    .run();
  return id;
}

async function franquiciaPorId(db: D1Database, id: string): Promise<FilaFranquicia> {
  const f = await db
    .prepare(`${SELECT_FRANQUICIA} WHERE f.id = ?`)
    .bind(id)
    .first<FilaFranquicia>();
  if (!f) throw new ErrorDatos('Esa franquicia no existe.', undefined, 404);
  return f;
}

franquicias.post('/admin/franquicias', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaFranquicia);
  const db = base(c);
  const id = await crearFranquicia(db, d, null);
  return c.json({ franquicia: publica(await franquiciaPorId(db, id)) }, 201);
});

/** La solicitud del formulario «Quiero una franquicia» pasa a ser una franquicia en prospecto. */
franquicias.post('/admin/franquicias/desde-solicitud/:ticketId', async (c) => {
  exigir(c, 'admin');
  const { zonaId } = await leerCuerpo(c, z.object({ zonaId: z.string().min(2).max(40) }));
  const db = base(c);
  const t = await db
    .prepare(
      "SELECT id, nombre, correo, asunto, ciudad FROM tickets WHERE id = ? AND tipo = 'franquicia'",
    )
    .bind(c.req.param('ticketId'))
    .first<{ id: string; nombre: string; correo: string; asunto: string; ciudad: string }>();
  if (!t) throw new ErrorDatos('Esa solicitud no existe.', undefined, 404);
  if (await db.prepare('SELECT 1 FROM franquicias WHERE ticket_id = ?').bind(t.id).first())
    throw new ErrorDatos('Esa solicitud ya tiene su franquicia.', undefined, 409);
  const id = await crearFranquicia(
    db,
    esquemaFranquicia.parse({
      zonaId,
      nombre: t.nombre.slice(0, 80),
      duenoCorreo: t.correo,
      notas: `Solicitud: ${t.asunto}${t.ciudad ? ` · ${t.ciudad}` : ''}`.slice(0, 3000),
    }),
    t.id,
  );
  await db
    .prepare(
      "UPDATE tickets SET estado = 'respondido', actualizado_en = datetime('now') WHERE id = ? AND estado = 'abierto'",
    )
    .bind(t.id)
    .run();
  return c.json({ franquicia: publica(await franquiciaPorId(db, id)) }, 201);
});

franquicias.get('/admin/solicitudes-franquicia', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT t.id, t.codigo, t.estado, t.nombre, t.correo, t.pais, t.ciudad, t.asunto, t.creado_en AS creada,
        (SELECT f.id FROM franquicias f WHERE f.ticket_id = t.id) AS franquicia_id
       FROM tickets t WHERE t.tipo = 'franquicia' ORDER BY t.creado_en DESC LIMIT 200`,
    )
    .all();
  return c.json({ solicitudes: results });
});

franquicias.get('/admin/franquicias/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const f = await franquiciaPorId(db, c.req.param('id'));
  const { results: areas } = await db
    .prepare(
      `SELECT a.id, a.nombre, a.estado, fa.franquicia_id FROM areas a
       LEFT JOIN franquicia_areas fa ON fa.area_id = a.id WHERE a.zona_id = ? ORDER BY a.nombre`,
    )
    .bind(f.zona_id)
    .all<{ id: string; nombre: string; estado: string; franquicia_id: string | null }>();
  const { results: miembros } = await db
    .prepare(
      `SELECT m.correo, m.rol, m.creado_en AS desde, (SELECT 1 FROM usuarios u WHERE u.correo = m.correo AND u.activo = 1) AS tiene_cuenta
       FROM franquicia_miembros m WHERE m.franquicia_id = ? ORDER BY m.rol, m.correo`,
    )
    .bind(f.id)
    .all<{ correo: string; rol: string; desde: string; tiene_cuenta: number | null }>();
  return c.json({
    franquicia: publica(f),
    areas: areas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      estado: a.estado,
      asignada: a.franquicia_id === f.id,
      deOtra: Boolean(a.franquicia_id && a.franquicia_id !== f.id),
    })),
    miembros: miembros.map((m) => ({
      correo: m.correo,
      rol: m.rol,
      desde: m.desde,
      tieneCuenta: Boolean(m.tiene_cuenta),
    })),
  });
});

franquicias.patch('/admin/franquicias/:id', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaFranquicia.omit({ zonaId: true }).partial());
  const db = base(c);
  const f = await franquiciaPorId(db, c.req.param('id'));
  const correo = d.duenoCorreo ?? f.dueno_correo;
  const estado = d.estado ?? f.estado;
  await db
    .prepare(
      `UPDATE franquicias SET estado = ?, dueno_correo = ?, dueno_id = ?, motos = ?, notas = ?, nombre = ?, condiciones_json = ?,
       vendida_en = COALESCE(vendida_en, CASE WHEN ? IN ('vendida','activa') THEN datetime('now') END) WHERE id = ?`,
    )
    .bind(
      estado,
      correo,
      await enlazarDueno(db, correo),
      d.motos ?? f.motos,
      d.notas ?? f.notas,
      d.nombre ?? f.nombre,
      JSON.stringify(d.condiciones ?? leerCondiciones(f.condiciones_json)),
      estado,
      f.id,
    )
    .run();
  return c.json({ franquicia: publica(await franquiciaPorId(db, f.id)) });
});

/** Las áreas de la franquicia (reemplaza la lista). Cada área es de UNA sola franquicia y de su ciudad. */
franquicias.put('/admin/franquicias/:id/areas', async (c) => {
  const u = exigir(c, 'admin');
  const { areaIds } = await leerCuerpo(
    c,
    z.object({ areaIds: z.array(z.string().min(1).max(60)).max(500) }),
  );
  const db = base(c);
  const f = await franquiciaPorId(db, c.req.param('id'));
  const ids = [...new Set(areaIds)];
  if (ids.length) {
    const { results } = await db
      .prepare(
        `SELECT a.id, a.zona_id, fa.franquicia_id FROM areas a LEFT JOIN franquicia_areas fa ON fa.area_id = a.id
         WHERE a.id IN (${ids.map(() => '?').join(',')})`,
      )
      .bind(...ids)
      .all<{ id: string; zona_id: string; franquicia_id: string | null }>();
    if (results.length !== ids.length) throw new ErrorDatos('Esa área no existe.', 'areaIds', 404);
    if (results.some((a) => a.zona_id !== f.zona_id))
      throw new ErrorDatos('Solo se asignan áreas de la ciudad de la franquicia.', 'areaIds', 422);
    if (results.some((a) => a.franquicia_id && a.franquicia_id !== f.id))
      throw new ErrorDatos('Esa área ya es de otra franquicia. Quítasela primero.', 'areaIds', 409);
  }
  await db.batch([
    db.prepare('DELETE FROM franquicia_areas WHERE franquicia_id = ?').bind(f.id),
    ...ids.map((a) =>
      db
        .prepare(
          'INSERT INTO franquicia_areas (area_id, franquicia_id, asignada_por) VALUES (?,?,?)',
        )
        .bind(a, f.id, u.id),
    ),
  ]);
  return c.json({ ok: true, areas: ids.length });
});

franquicias.post('/admin/franquicias/:id/miembros', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      correo: z.string().trim().email().max(200),
      rol: z.enum(['manager', 'dueno']).default('manager'),
    }),
  );
  const db = base(c);
  const f = await franquiciaPorId(db, c.req.param('id'));
  await db
    .prepare(
      `INSERT INTO franquicia_miembros (franquicia_id, correo, rol, creado_por) VALUES (?,?,?,?)
       ON CONFLICT(franquicia_id, correo) DO UPDATE SET rol = excluded.rol`,
    )
    .bind(f.id, d.correo.toLowerCase(), d.rol, u.id)
    .run();
  return c.json({ ok: true }, 201);
});

franquicias.delete('/admin/franquicias/:id/miembros/:correo', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const f = await franquiciaPorId(db, c.req.param('id'));
  await db
    .prepare('DELETE FROM franquicia_miembros WHERE franquicia_id = ? AND correo = ?')
    .bind(f.id, decodeURIComponent(c.req.param('correo')))
    .run();
  return c.json({ ok: true });
});

// ───────────────────────── El franquiciado y sus managers ─────────────────────────

/** Las franquicias a las que entra esta cuenta (dueño o manager), con su dirección. */
franquicias.get('/mi-franquicia', async (c) => {
  const u = exigir(c);
  // Por correo solo entra una cuenta con el correo confirmado (C-FRANQUICIA-CORREO-CONFIRMADO).
  const confirmado = await correoConfirmado(base(c), u.id);
  const { results } = await base(c)
    .prepare(
      `${SELECT_FRANQUICIA} WHERE f.dueno_id = ?1 OR (?4 = 1 AND ((f.dueno_correo = ?2 AND f.dueno_correo <> '')
       OR f.id IN (SELECT franquicia_id FROM franquicia_miembros WHERE correo = ?3))) ORDER BY z.nombre, f.nombre`,
    )
    .bind(u.id, u.correo, u.correo, confirmado ? 1 : 0)
    .all<FilaFranquicia>();
  const lista = results.map((f) => ({
    nombre: f.nombre || f.zona_nombre,
    ciudad: f.zona_nombre,
    ruta: rutaFranquicia(f.zona_nombre, f.codigo),
  }));
  return c.json({ ruta: lista[0]?.ruta ?? null, franquicias: lista });
});

/** La franquicia de esa dirección, si esta cuenta entra; si no, «no existe» (404, no 403). */
async function franquiciaDeRuta(
  c: Context<{ Bindings: Env; Variables: Variables }>,
): Promise<{ f: FilaFranquicia; rol: Rol; areas: string[]; db: D1Database }> {
  const u = exigir(c);
  const codigo = /-([0-9a-f]{20})$/.exec(c.req.param('ruta') ?? '')?.[1];
  const db = base(c);
  const f = codigo
    ? await db
        .prepare(`${SELECT_FRANQUICIA} WHERE f.codigo = ?`)
        .bind(codigo)
        .first<FilaFranquicia>()
    : null;
  const rol = f ? await rolEn(db, u, f) : null;
  if (!f || !rol) throw new ErrorDatos('Esta página no existe.', undefined, 404);
  // La dirección vieja empezaba con «franquicia-»: sigue valiendo para quien ya la tenía guardada.
  const pedida = (c.req.param('ruta') ?? '').replace(/^franquicia-/, 'franchise-');
  if (pedida !== rutaFranquicia(f.zona_nombre, f.codigo))
    throw new ErrorDatos('Esta página no existe.', undefined, 404);
  return { f, rol, areas: await areasDe(db, f.id), db };
}

franquicias.get('/franquicia/:ruta/resumen', async (c) => {
  const { f, rol, areas, db } = await franquiciaDeRuta(c);
  const fr = filtro({ areas });
  const fp = filtro({ areas }, 'p.area_id');
  const { results: misAreas } = areas.length
    ? await db
        .prepare(
          `SELECT id, nombre, estado, poligono FROM areas WHERE id IN (${areas.map(() => '?').join(',')}) ORDER BY nombre`,
        )
        .bind(...areas)
        .all<{ id: string; nombre: string; estado: string; poligono: string }>()
    : { results: [] };
  const { results: restaurantes } = await db
    .prepare(
      `SELECT nombre, estado, abierto, plan FROM restaurantes WHERE ${fr.sql} ORDER BY nombre`,
    )
    .bind(...fr.params)
    .all<{ nombre: string; estado: string; abierto: number; plan: string }>();
  // Repartidores: los que están en sus áreas, y los que llevan un pedido de sus áreas.
  const { results: repartidores } = await db
    .prepare(
      `SELECT u.nombre, d.conectado, d.puntos FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id
       WHERE ${filtro({ areas }, 'd.area_id').sql}
          OR d.usuario_id IN (SELECT p.repartidor_id FROM pedidos p WHERE ${fp.sql} AND p.estado IN ('aceptado','listo','en_camino'))
       ORDER BY d.conectado DESC, u.nombre`,
    )
    .bind(...areas, ...fp.params)
    .all<{ nombre: string; conectado: number; puntos: number }>();
  const { results: pedidos } = await db
    .prepare(
      `SELECT p.id, p.estado, p.total, p.moneda, p.creado_en AS creado, r.nombre AS restaurante, a.nombre AS area
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id LEFT JOIN areas a ON a.id = p.area_id
       WHERE ${fp.sql} AND p.estado <> 'pago_pendiente' AND p.creado_en >= datetime('now','-30 days')
       ORDER BY p.estado IN ('pagado','aceptado','listo','en_camino') DESC, p.creado_en DESC LIMIT 100`,
    )
    .bind(...fp.params)
    .all<{
      id: string;
      estado: string;
      total: number;
      moneda: string | null;
      creado: string;
      restaurante: string;
      area: string | null;
    }>();
  const { results: incidencias } = await db
    .prepare(
      `SELECT t.id, t.codigo, t.tipo, t.estado, t.asunto, t.actualizado_en AS fecha FROM tickets t
       WHERE t.tipo IN ('queja','soporte') AND t.pedido_id IN (SELECT p.id FROM pedidos p WHERE ${fp.sql})
       ORDER BY t.estado = 'cerrado', t.actualizado_en DESC LIMIT 100`,
    )
    .bind(...fp.params)
    .all();
  return c.json({
    franquicia: publica(f),
    rol,
    areas: misAreas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      estado: a.estado,
      poligono: leerPoligono(a.poligono),
    })),
    metricas: await metricasDe(db, { areas }),
    restaurantes: restaurantes.map((r) => ({ ...r, abierto: Boolean(r.abierto) })),
    repartidores: repartidores.map((r) => ({
      nombre: r.nombre.split(' ')[0],
      conectado: Boolean(r.conectado),
      puntos: Number(r.puntos),
    })),
    // Sin datos del cliente: el número corto del pedido, su estado, el restaurante y el área.
    pedidos: pedidos.map((p) => ({
      codigo: p.id.slice(0, 8).toUpperCase(),
      estado: p.estado,
      total: Number(p.total),
      moneda: p.moneda ?? 'USD',
      creado: p.creado,
      restaurante: p.restaurante,
      area: p.area,
    })),
    quejas: incidencias,
  });
});

/** El manager atiende las incidencias de SUS pedidos: las marca respondidas o cerradas. */
franquicias.patch('/franquicia/:ruta/incidencias/:id', async (c) => {
  const { areas, db } = await franquiciaDeRuta(c);
  const { estado } = await leerCuerpo(
    c,
    z.object({ estado: z.enum(['abierto', 'respondido', 'cerrado']) }),
  );
  const fp = filtro({ areas }, 'p.area_id');
  const r = await db
    .prepare(
      `UPDATE tickets SET estado = ?, actualizado_en = datetime('now') WHERE id = ? AND tipo IN ('queja','soporte')
       AND pedido_id IN (SELECT p.id FROM pedidos p WHERE ${fp.sql})`,
    )
    .bind(estado, c.req.param('id'), ...fp.params)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esta página no existe.', undefined, 404);
  return c.json({ ok: true });
});
