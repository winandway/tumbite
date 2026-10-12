import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * Franquicias y superadmin. Cada ciudad (zona) puede tener una franquicia; su dueño ve su ciudad
 * en /panel/franquicia-<ciudad>-<codigo>. El superadmin (solo admin) ve todas. Candado C-FRANQUICIAS.
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
  `franquicia-${slug(zonaNombre)}-${codigo}`;

type Metricas = {
  pedidosHoy: number;
  pedidos30: number;
  ventas30: number;
  ganancia30: number;
  restaurantes: number;
  restaurantesAbiertos: number;
  repartidores: number;
  repartidoresConectados: number;
  ticketsAbiertos: number;
};

async function metricasDe(db: D1Database, zonaId: string): Promise<Metricas> {
  const p = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN estado <> 'pago_pendiente' AND creado_en >= datetime('now','start of day') THEN 1 ELSE 0 END) AS hoy,
        SUM(CASE WHEN estado = 'entregado' AND creado_en >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS n30,
        SUM(CASE WHEN estado = 'entregado' AND creado_en >= datetime('now','-30 days') THEN total ELSE 0 END) AS ventas,
        SUM(CASE WHEN estado = 'entregado' AND creado_en >= datetime('now','-30 days') THEN ganancia ELSE 0 END) AS ganancia
       FROM pedidos WHERE zona_id = ?`,
    )
    .bind(zonaId)
    .first<{
      hoy: number | null;
      n30: number | null;
      ventas: number | null;
      ganancia: number | null;
    }>();
  const r = await db
    .prepare(
      "SELECT SUM(CASE WHEN estado = 'aprobado' THEN 1 ELSE 0 END) AS n, SUM(CASE WHEN estado = 'aprobado' AND abierto = 1 THEN 1 ELSE 0 END) AS abiertos FROM restaurantes WHERE zona_id = ?",
    )
    .bind(zonaId)
    .first<{ n: number | null; abiertos: number | null }>();
  const d = await db
    .prepare(
      'SELECT COUNT(*) AS n, SUM(CASE WHEN conectado = 1 THEN 1 ELSE 0 END) AS conectados FROM repartidores WHERE zona_id = ?',
    )
    .bind(zonaId)
    .first<{ n: number | null; conectados: number | null }>();
  const t = await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE zona_id = ? AND estado = 'abierto'")
    .bind(zonaId)
    .first<{ n: number | null }>();
  return {
    pedidosHoy: Number(p?.hoy ?? 0),
    pedidos30: Number(p?.n30 ?? 0),
    ventas30: Number(p?.ventas ?? 0),
    ganancia30: Number(p?.ganancia ?? 0),
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
};

const SELECT_FRANQUICIA = `SELECT f.*, z.nombre AS zona_nombre, z.pais AS pais FROM franquicias f JOIN zonas z ON z.id = f.zona_id`;

function publica(f: FilaFranquicia) {
  return {
    id: f.id,
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
    ruta: rutaFranquicia(f.zona_nombre, f.codigo),
  };
}

// ───────────────────────── Superadmin ─────────────────────────

franquicias.get('/admin/resumen', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results: lista } = await db
    .prepare(`${SELECT_FRANQUICIA} ORDER BY z.nombre`)
    .all<FilaFranquicia>();
  const filas: (ReturnType<typeof publica> & { metricas: Metricas })[] = [];
  for (const f of lista) filas.push({ ...publica(f), metricas: await metricasDe(db, f.zona_id) });
  const { results: zonas } = await db
    .prepare(
      'SELECT z.id, z.nombre, z.pais, z.activa FROM zonas z WHERE NOT EXISTS (SELECT 1 FROM franquicias f WHERE f.zona_id = z.id) ORDER BY z.nombre',
    )
    .all<{ id: string; nombre: string; pais: string; activa: number }>();
  const sinFranquicia = [];
  for (const z of zonas)
    sinFranquicia.push({
      id: z.id,
      ciudad: z.nombre,
      pais: z.pais,
      activa: Boolean(z.activa),
      metricas: await metricasDe(db, z.id),
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
    sinFranquicia,
  });
});

const esquemaFranquicia = z.object({
  zonaId: z.string().min(2).max(40),
  estado: z.enum(['prospecto', 'vendida', 'activa', 'pausada']).default('prospecto'),
  duenoCorreo: z.string().trim().email().max(200).or(z.literal('')).default(''),
  motos: z.coerce.number().int().min(0).max(10000).default(0),
  notas: z.string().trim().max(3000).default(''),
});

async function enlazarDueno(db: D1Database, correo: string): Promise<string | null> {
  if (!correo) return null;
  const u = await db
    .prepare('SELECT id FROM usuarios WHERE correo = ? AND activo = 1')
    .bind(correo)
    .first<{ id: string }>();
  return u?.id ?? null;
}

franquicias.post('/admin/franquicias', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaFranquicia);
  const db = base(c);
  const zona = await db.prepare('SELECT id FROM zonas WHERE id = ?').bind(d.zonaId).first();
  if (!zona) throw new ErrorDatos('Esa ciudad no existe. Créala primero en Zonas.', 'zonaId', 404);
  const existe = await db
    .prepare('SELECT 1 FROM franquicias WHERE zona_id = ?')
    .bind(d.zonaId)
    .first();
  if (existe) throw new ErrorDatos('Esa ciudad ya tiene franquicia.', 'zonaId', 409);
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO franquicias (id, zona_id, codigo, estado, dueno_id, dueno_correo, motos, notas, vendida_en)
       VALUES (?,?,?,?,?,?,?,?, CASE WHEN ? IN ('vendida','activa') THEN datetime('now') END)`,
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
    )
    .run();
  const f = await db
    .prepare(`${SELECT_FRANQUICIA} WHERE f.id = ?`)
    .bind(id)
    .first<FilaFranquicia>();
  return c.json({ franquicia: f ? publica(f) : null }, 201);
});

franquicias.patch('/admin/franquicias/:id', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaFranquicia.omit({ zonaId: true }).partial());
  const db = base(c);
  const f = await db
    .prepare(`${SELECT_FRANQUICIA} WHERE f.id = ?`)
    .bind(c.req.param('id'))
    .first<FilaFranquicia>();
  if (!f) throw new ErrorDatos('Esa franquicia no existe.', undefined, 404);
  const correo = d.duenoCorreo ?? f.dueno_correo;
  const estado = d.estado ?? f.estado;
  await db
    .prepare(
      `UPDATE franquicias SET estado = ?, dueno_correo = ?, dueno_id = ?, motos = ?, notas = ?,
       vendida_en = COALESCE(vendida_en, CASE WHEN ? IN ('vendida','activa') THEN datetime('now') END) WHERE id = ?`,
    )
    .bind(
      estado,
      correo,
      await enlazarDueno(db, correo),
      d.motos ?? f.motos,
      d.notas ?? f.notas,
      estado,
      f.id,
    )
    .run();
  const nueva = await db
    .prepare(`${SELECT_FRANQUICIA} WHERE f.id = ?`)
    .bind(f.id)
    .first<FilaFranquicia>();
  return c.json({ franquicia: nueva ? publica(nueva) : null });
});

// ───────────────────────── El franquiciado ─────────────────────────

/** ¿Esta cuenta es dueña de una franquicia? Devuelve su dirección para llevarla a su panel. */
franquicias.get('/mi-franquicia', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      `${SELECT_FRANQUICIA} WHERE f.dueno_id = ? OR (f.dueno_correo = ? AND f.dueno_correo <> '')`,
    )
    .bind(u.id, u.correo)
    .first<FilaFranquicia>();
  return c.json({ ruta: f ? rutaFranquicia(f.zona_nombre, f.codigo) : null });
});

franquicias.get('/franquicia/:ruta/resumen', async (c) => {
  const u = exigir(c);
  const codigo = /-([0-9a-f]{20})$/.exec(c.req.param('ruta'))?.[1];
  const db = base(c);
  const f = codigo
    ? await db
        .prepare(`${SELECT_FRANQUICIA} WHERE f.codigo = ?`)
        .bind(codigo)
        .first<FilaFranquicia>()
    : null;
  const esDueno =
    f &&
    (f.dueno_id === u.id ||
      (f.dueno_correo !== '' && f.dueno_correo.toLowerCase() === u.correo.toLowerCase()));
  // Para cualquiera que no sea el dueño o el admin, la página simplemente no existe.
  if (!f || (!esDueno && u.rol !== 'admin'))
    throw new ErrorDatos('Esta página no existe.', undefined, 404);
  if (c.req.param('ruta') !== rutaFranquicia(f.zona_nombre, f.codigo))
    throw new ErrorDatos('Esta página no existe.', undefined, 404);
  const { results: restaurantes } = await db
    .prepare(
      'SELECT nombre, estado, abierto, plan FROM restaurantes WHERE zona_id = ? ORDER BY nombre',
    )
    .bind(f.zona_id)
    .all<{ nombre: string; estado: string; abierto: number; plan: string }>();
  const { results: repartidores } = await db
    .prepare(
      'SELECT u.nombre, d.conectado, d.puntos FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id WHERE d.zona_id = ? ORDER BY d.conectado DESC, u.nombre',
    )
    .bind(f.zona_id)
    .all<{ nombre: string; conectado: number; puntos: number }>();
  const { results: quejas } = await db
    .prepare(
      "SELECT tipo, estado, asunto, actualizado_en AS fecha FROM tickets WHERE zona_id = ? AND tipo IN ('queja','soporte') ORDER BY actualizado_en DESC LIMIT 50",
    )
    .bind(f.zona_id)
    .all();
  return c.json({
    franquicia: publica(f),
    metricas: await metricasDe(db, f.zona_id),
    restaurantes: restaurantes.map((r) => ({ ...r, abierto: Boolean(r.abierto) })),
    repartidores: repartidores.map((r) => ({
      nombre: r.nombre.split(' ')[0],
      conectado: Boolean(r.conectado),
      puntos: Number(r.puntos),
    })),
    quejas,
  });
});
