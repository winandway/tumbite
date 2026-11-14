import { type ExecutionContext, Hono } from 'hono';
import { z } from 'zod';
import {
  JUEGO,
  ROBOTS_TOTAL,
  apagar,
  encender,
  filasDeSesion,
  latido,
  soloPruebas,
} from '../ciudadJuego';
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
 * - C-CIUDAD-JUEGO (SIM-7): `POST /admin/ciudad-pruebas/encender`, `/latido` y `/apagar`
 *   (superadmin): el modo juego, con robots que mueve la pantalla abierta (ver ciudadJuego.ts).
 */
export const ciudadPruebas = new Hono<{ Bindings: Env; Variables: Variables }>();

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
/** Todos los estados de un pedido (el CHECK de `pedidos.estado`). */
const TODOS = [...ACTIVOS, 'entregado', 'cancelado'];
const lit = (xs: readonly string[]) => xs.map((x) => `'${x}'`).join(', ');
/**
 * C-LECTURAS-CIUDAD (13 nov 2026): los pedidos de la sesión por el índice que ya existe
 * `pedidos_zona_estado (zona_id, estado, creado_en)`, con el rango desde el inicio de la sesión.
 * Antes iban por el índice del restaurante, que no tiene la fecha: cada refresco de la pantalla
 * (cada 4 a 5 segundos) leía TODOS los pedidos de la historia de los restaurantes robot, que se
 * reutilizan de una sesión a otra (tres consultas por refresco). Ahora lee solo los pedidos de su
 * zona creados durante la sesión.
 */
const DE_LA_SESION = (zonas: number, rids: number, estados: readonly string[]) =>
  `FROM pedidos p INDEXED BY pedidos_zona_estado
   WHERE p.zona_id IN (${marcas(zonas)}) AND p.estado IN (${lit(estados)}) AND p.creado_en >= ?
     AND p.restaurante_id IN (${marcas(rids)})`;

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
  const { results: conZona } = rids.length
    ? await db
        .prepare(
          `SELECT id, nombre, lat, lng, abierto, zona_id FROM restaurantes WHERE id IN (${marcas(rids.length)})`,
        )
        .bind(...rids)
        .all<{
          id: string;
          nombre: string;
          lat: number;
          lng: number;
          abierto: number;
          zona_id: string;
        }>()
    : { results: [] };
  const restaurantes = conZona.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    lat: r.lat,
    lng: r.lng,
    abierto: r.abierto,
  }));
  const zonas = [...new Set(conZona.map((r) => r.zona_id))];
  const { results: pedidos } = zonas.length
    ? await db
        .prepare(
          `SELECT p.id, p.estado, p.total, p.moneda, p.restaurante_id AS restauranteId, p.cliente_id AS clienteId,
             p.repartidor_id AS repartidorId, p.creado_en AS creadoEn, p.entregado_en AS entregadoEn
           ${DE_LA_SESION(zonas.length, rids.length, TODOS)}
           ORDER BY p.creado_en DESC LIMIT 200`,
        )
        .bind(...zonas, sesion.inicio, ...rids)
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
  const juego = sesion.destino === 'juego' ? await vistaJuego(db, sesion, rids, zonas) : null;
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
      // C-CIUDAD-JUEGO: la meta del juego lleva las sesiones cifradas de los robots: no sale.
      meta:
        sesion.destino === 'juego'
          ? {}
          : (JSON.parse(String(sesion.meta)) as Record<string, number>),
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
    ...(juego ?? {}),
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

// ------------------------------------------------------------------ C-CIUDAD-JUEGO (SIM-7)

/** El «contexto de ejecución» de la petición (en las pruebas no hay: se sigue sin él). */
function ejecucion(c: { executionCtx: ExecutionContext }): ExecutionContext | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

ciudadPruebas.post('/admin/ciudad-pruebas/encender', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  return c.json(await encender(c.env, c.req.url, ejecucion(c)));
});

ciudadPruebas.post('/admin/ciudad-pruebas/latido', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  const { sesion } = await leerCuerpo(c, z.object({ sesion: ID }));
  return c.json(await latido(c.env, c.req.url, sesion, ejecucion(c)));
});

ciudadPruebas.post('/admin/ciudad-pruebas/apagar', async (c) => {
  soloPruebas(c.req.url);
  exigir(c, 'admin');
  const { sesion } = await leerCuerpo(c, z.object({ sesion: ID }));
  return c.json(await apagar(c.env, c.req.url, sesion, 'la apagó el superadmin', ejecucion(c)));
});

type FilaJugador = {
  id: string;
  estado: string;
  total: number;
  moneda: string;
  metodoPago: string;
  lineas: string;
  creadoEn: string;
  entregadoEn: string | null;
  clienteId: string;
  nombre: string;
  restaurante: string;
};

/**
 * Lo que la pantalla del juego necesita además de la foto de siempre (solo lee): el estado de la
 * ciudad, las filas gastadas, los pedidos en curso con su destino (para el mapa grande), los
 * jugadores con lo que compraron y los errores del servidor durante la sesión.
 */
async function vistaJuego(
  db: D1Database,
  sesion: Record<string, string | number | null>,
  rids: string[],
  zonas: string[],
) {
  const id = String(sesion.id);
  const inicio = String(sesion.inicio);
  const actualizada = Date.parse(`${String(sesion.actualizada_en).replace(' ', 'T')}Z`);
  const segundos = Number.isFinite(actualizada)
    ? Math.round((Date.now() - actualizada) / 1000)
    : null;
  const meta = JSON.parse(String(sesion.meta)) as {
    motivoFin?: string;
    centro?: unknown;
    robots?: unknown[];
  };
  const filas = await filasDeSesion(db, id);
  const fallos = JSON.parse(String(sesion.fallos)) as z.infer<typeof FALLO>[];
  const { results: filasJ } = zonas.length
    ? await db
        .prepare(
          `SELECT p.id, p.estado, p.total, p.moneda, COALESCE(p.metodo_pago, 'tarjeta') AS metodoPago, p.lineas_json AS lineas,
             p.creado_en AS creadoEn, p.entregado_en AS entregadoEn, p.cliente_id AS clienteId, u.nombre, r.nombre AS restaurante
            ${DE_LA_SESION(zonas.length, rids.length, TODOS).replace('WHERE', 'JOIN usuarios u ON u.id = p.cliente_id JOIN restaurantes r ON r.id = p.restaurante_id WHERE')}
              AND u.correo NOT LIKE '%@simulador.test'
           ORDER BY p.creado_en LIMIT 200`,
        )
        .bind(...zonas, inicio, ...rids)
        .all<FilaJugador>()
    : { results: [] as FilaJugador[] };
  const porJugador = new Map<
    string,
    {
      nombre: string;
      pedidos: unknown[];
      gastado: number;
      moneda: string;
      fallos: z.infer<typeof FALLO>[];
    }
  >();
  const fecha = (x: string | null) => (x ? Date.parse(`${x.replace(' ', 'T')}Z`) : NaN);
  for (const p of filasJ) {
    const j = porJugador.get(p.clienteId) ?? {
      nombre: p.nombre,
      pedidos: [],
      gastado: 0,
      moneda: p.moneda,
      fallos: [],
    };
    let platos: string[];
    try {
      platos = (JSON.parse(p.lineas) as { nombreEs?: string; cantidad?: number }[]).map(
        (l) => `${l.cantidad ?? 1} × ${l.nombreEs ?? ''}`,
      );
    } catch {
      platos = [];
    }
    const ms = fecha(p.entregadoEn) - fecha(p.creadoEn);
    j.pedidos.push({
      id: p.id,
      estado: p.estado,
      total: p.total,
      moneda: p.moneda,
      metodoPago: p.metodoPago,
      restaurante: p.restaurante,
      platos,
      creadoEn: p.creadoEn,
      minutos: Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60_000)) : null,
    });
    if (p.estado === 'entregado') j.gastado += Number(p.total);
    j.fallos.push(...fallos.filter((f) => f.pedido === p.id));
    porJugador.set(p.clienteId, j);
  }
  const { results: enCurso } = zonas.length
    ? await db
        .prepare(
          `SELECT p.id, p.estado, p.lat, p.lng, p.restaurante_id AS restauranteId, p.repartidor_id AS repartidorId, u.nombre AS cliente
             ${DE_LA_SESION(zonas.length, rids.length, ['pagado', 'aceptado', 'listo', 'en_camino']).replace('WHERE', 'JOIN usuarios u ON u.id = p.cliente_id WHERE')}
            ORDER BY p.creado_en LIMIT 30`,
        )
        .bind(...zonas, inicio, ...rids)
        .all<{
          id: string;
          estado: string;
          lat: number | null;
          lng: number | null;
          restauranteId: string;
          repartidorId: string | null;
          cliente: string;
        }>()
    : { results: [] };
  const { results: errores } = await db
    .prepare(
      'SELECT metodo, ruta, mensaje, creado_en AS creadoEn FROM errores_servidor WHERE creado_en >= ? ORDER BY id DESC LIMIT 20',
    )
    .bind(inicio)
    .all<{ metodo: string; ruta: string; mensaje: string; creadoEn: string }>();
  return {
    juego: {
      encendida: sesion.estado === 'corriendo',
      segundosSinLatido: segundos,
      quieta: sesion.estado === 'corriendo' && segundos != null && segundos > JUEGO.segundosQuieta,
      filas: { sesion: filas.sesion, tope: JUEGO.topeFilasSesion },
      minutosMax: JUEGO.minutosMax,
      robots: { listos: meta.robots?.length ?? 0, total: ROBOTS_TOTAL },
      motivoFin: meta.motivoFin ?? null,
      centro: meta.centro ?? null,
    },
    enCurso: enCurso.map((p) => ({ ...p, cliente: p.cliente.split(' ')[0] ?? '' })),
    jugadores: [...porJugador.values()],
    erroresServidor: errores,
  };
}
