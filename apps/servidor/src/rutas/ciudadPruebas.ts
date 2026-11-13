import { Hono } from 'hono';
import { z } from 'zod';
import { entornoDe } from '../entorno';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-CIUDAD-PRUEBAS (13 nov 2026, pedido de Richard): la «ciudad de pruebas» del simulador de
 * compras. Una población falsa compra, vende y reparte durante una sesión acotada, y el superadmin la
 * ve en vivo. SOLO existe en el sitio de pruebas y en local: en producción las tres rutas responden
 * «No encontrado». Todos los países.
 *
 * - `POST /interno/ciudad/sesion` (el simulador, con el secreto del reloj): empieza, avanza y termina
 *   la sesión. Escribe UNA fila por llamada (la de la sesión).
 * - `GET /admin/ciudad-pruebas` (superadmin): la foto en vivo. Solo lee, con filtro por los ids de la
 *   sesión y con límite: nada recorre tablas enteras y mirar no escribe nada.
 * - `POST /admin/ciudad-pruebas/parar` (superadmin): pide que la sesión se detenga; el simulador lo
 *   ve en su siguiente avance y cierra.
 */
export const ciudadPruebas = new Hono<{ Bindings: Env; Variables: Variables }>();

const soloPruebas = (url: string) => {
  const e = entornoDe(url);
  if (e !== 'pruebas' && e !== 'local') throw new ErrorDatos('No encontrado.', undefined, 404);
};

async function iguales(a: string, b: string): Promise<boolean> {
  const h = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return a.length === b.length && ha.every((v, i) => v === hb.at(i));
}

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const FALLO = z.object({
  cuando: z.string().max(40),
  pedido: z.string().max(64).optional(),
  comportamiento: z.string().max(60),
  mensaje: z.string().max(500),
});
const MAX_FALLOS = 50;

ciudadPruebas.post('/interno/ciudad/sesion', async (c) => {
  soloPruebas(c.req.url);
  const secreto = c.env.RELOJ_SECRETO;
  if (!secreto || !(await iguales(c.req.header('x-reloj-secreto') ?? '', secreto)))
    throw new ErrorDatos('No encontrado.', undefined, 404);
  const d = await leerCuerpo(
    c,
    z.object({
      id: ID,
      accion: z.enum(['empezar', 'avance', 'terminar']),
      semilla: z.number().int().optional(),
      destino: z.string().max(120).optional(),
      restaurantes: z.array(ID).max(20).optional(),
      repartidores: z.array(ID).max(40).optional(),
      clientes: z.array(ID).max(80).optional(),
      meta: z.record(z.string(), z.number()).optional(),
      resumen: z.record(z.string(), z.number()).optional(),
      fallos: z.array(FALLO).max(MAX_FALLOS).default([]),
    }),
  );
  const db = base(c);
  if (d.accion === 'empezar') {
    await db
      .prepare(
        `INSERT OR REPLACE INTO simulador_sesiones (id, estado, semilla, destino, restaurantes, repartidores, clientes, meta)
         VALUES (?, 'corriendo', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        d.id,
        d.semilla ?? null,
        d.destino ?? '',
        JSON.stringify(d.restaurantes ?? []),
        JSON.stringify(d.repartidores ?? []),
        JSON.stringify(d.clientes ?? []),
        JSON.stringify(d.meta ?? {}),
      )
      .run();
    return c.json({ estado: 'corriendo' });
  }
  const fila = await db
    .prepare('SELECT estado, fallos FROM simulador_sesiones WHERE id = ?')
    .bind(d.id)
    .first<{ estado: string; fallos: string }>();
  if (!fila) throw new ErrorDatos('No encontrado.', undefined, 404);
  const fallos = [...(JSON.parse(fila.fallos) as unknown[]), ...d.fallos].slice(-MAX_FALLOS);
  const estado = d.accion === 'terminar' ? 'terminada' : fila.estado;
  await db
    .prepare(
      `UPDATE simulador_sesiones SET estado = ?, resumen = COALESCE(?, resumen), fallos = ?,
         fin = CASE WHEN ? = 'terminada' THEN datetime('now') ELSE fin END, actualizada_en = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      estado,
      d.resumen ? JSON.stringify(d.resumen) : null,
      JSON.stringify(fallos),
      estado,
      d.id,
    )
    .run();
  return c.json({ estado });
});

const ACTIVOS = ['pago_pendiente', 'pagado', 'aceptado', 'listo', 'en_camino'];
const lista = (s: string) => {
  try {
    return (JSON.parse(s) as unknown[]).filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
};
const marcas = (n: number) => Array.from({ length: n }, () => '?').join(',');

ciudadPruebas.get('/admin/ciudad-pruebas', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  const db = base(c);
  const pedida = c.req.query('sesion');
  const sesion = await (
    pedida
      ? db.prepare('SELECT * FROM simulador_sesiones WHERE id = ?').bind(pedida)
      : db.prepare('SELECT * FROM simulador_sesiones ORDER BY inicio DESC LIMIT 1')
  ).first<Record<string, string | number | null>>();
  if (!sesion) return c.json({ sesion: null });
  const rids = lista(String(sesion.restaurantes));
  const uids = lista(String(sesion.repartidores));
  const { results: pedidos } = rids.length
    ? await db
        .prepare(
          `SELECT p.id, p.estado, p.total, p.moneda, p.restaurante_id AS restauranteId, p.cliente_id AS clienteId,
             p.repartidor_id AS repartidorId, p.creado_en AS creadoEn, p.entregado_en AS entregadoEn
           FROM pedidos p WHERE p.restaurante_id IN (${marcas(rids.length)}) AND p.creado_en >= ?
           ORDER BY p.creado_en DESC LIMIT 200`,
        )
        .bind(...rids, sesion.inicio)
        .all<{
          id: string;
          estado: string;
          total: number;
          moneda: string;
          restauranteId: string;
          clienteId: string;
          repartidorId: string | null;
          creadoEn: string;
          entregadoEn: string | null;
        }>()
    : { results: [] };
  const { results: restaurantes } = rids.length
    ? await db
        .prepare(
          `SELECT id, nombre, lat, lng, abierto FROM restaurantes WHERE id IN (${marcas(rids.length)})`,
        )
        .bind(...rids)
        .all<{ id: string; nombre: string; lat: number; lng: number; abierto: number }>()
    : { results: [] };
  const { results: repartidores } = uids.length
    ? await db
        .prepare(
          `SELECT d.usuario_id AS id, u.nombre, d.conectado, d.lat, d.lng, d.ubicacion_en AS ubicacionEn
             FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id WHERE d.usuario_id IN (${marcas(uids.length)})`,
        )
        .bind(...uids)
        .all<{
          id: string;
          nombre: string;
          conectado: number;
          lat: number | null;
          lng: number | null;
          ubicacionEn: string | null;
        }>()
    : { results: [] };
  const activos = pedidos.filter((p) => ACTIVOS.includes(p.estado));
  const porEstado: Record<string, number> = {};
  for (const p of pedidos) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;
  const entregados = pedidos.filter((p) => p.estado === 'entregado');
  const conPedido = new Set(
    activos.filter((p) => p.repartidorId).map((p) => p.repartidorId as string),
  );
  return c.json({
    sesion: {
      id: sesion.id,
      estado: sesion.estado,
      inicio: sesion.inicio,
      fin: sesion.fin,
      semilla: sesion.semilla,
      destino: sesion.destino,
      meta: JSON.parse(String(sesion.meta)) as Record<string, number>,
      resumen: JSON.parse(String(sesion.resumen)) as Record<string, number>,
      fallos: JSON.parse(String(sesion.fallos)) as z.infer<typeof FALLO>[],
      actualizadaEn: sesion.actualizada_en,
    },
    porEstado,
    clientesComprando: new Set(activos.map((p) => p.clienteId)).size,
    restaurantesVendiendo: new Set(activos.map((p) => p.restauranteId)).size,
    ventas: {
      entregados: entregados.length,
      total: entregados.reduce((s, p) => s + Number(p.total), 0),
      moneda: pedidos[0]?.moneda ?? 'USD',
      cancelados: porEstado.cancelado ?? 0,
    },
    pedidos: pedidos.slice(0, 40).map((p) => ({
      ...p,
      restaurante: restaurantes.find((r) => r.id === p.restauranteId)?.nombre ?? '',
    })),
    restaurantes,
    repartidores: repartidores.map((r) => ({
      ...r,
      conectado: Boolean(r.conectado),
      ocupado: conPedido.has(r.id),
    })),
  });
});

ciudadPruebas.post('/admin/ciudad-pruebas/parar', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  const { sesion } = await leerCuerpo(c, z.object({ sesion: ID }));
  const r = await base(c)
    .prepare(
      "UPDATE simulador_sesiones SET estado = 'parar', actualizada_en = datetime('now') WHERE id = ? AND estado = 'corriendo'",
    )
    .bind(sesion)
    .run();
  return c.json({ ok: true, pedida: r.meta.changes > 0 });
});
