import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * «Regalos y marketing»: cada restaurante aparta un porcentaje de sus ventas (3 % por defecto)
 * para premiar a sus clientes fieles. No se le guarda dinero: es un tope que se llena con sus
 * ventas entregadas, y cada regalo usado se descuenta de su pago en ese pedido.
 */
export const regalos = new Hono<{ Bindings: Env; Variables: Variables }>();

export type TipoRegalo = 'cumpleanos' | 'sellos' | 'vuelve';
export type RegaloDisponible = {
  tipo: TipoRegalo;
  platoId: string | null;
  valorCentavos: number;
  pb: number | null;
};

type Config = {
  cumpleanos: number;
  cumple_plato_id: string | null;
  sellos: number;
  sellos_meta: number;
  sellos_plato_id: string | null;
  vuelve: number;
  vuelve_dias: number;
  vuelve_pb: number;
};
const CONFIG_INICIAL: Config = {
  cumpleanos: 1,
  cumple_plato_id: null,
  sellos: 1,
  sellos_meta: 10,
  sellos_plato_id: null,
  vuelve: 0,
  vuelve_dias: 30,
  vuelve_pb: 1000,
};

export async function configRegalos(db: D1Database, rid: string): Promise<Config> {
  return (
    (await db
      .prepare('SELECT * FROM regalos_config WHERE restaurante_id = ?')
      .bind(rid)
      .first<Config>()) ?? CONFIG_INICIAL
  );
}

/** Presupuesto: lo acumulado con las ventas entregadas menos lo ya regalado. */
export async function presupuesto(db: D1Database, rid: string) {
  const r = await db
    .prepare('SELECT regalos_pb FROM restaurantes WHERE id = ?')
    .bind(rid)
    .first<{ regalos_pb: number }>();
  const v = await db
    .prepare(
      "SELECT COALESCE(SUM(subtotal), 0) AS ventas, COALESCE(SUM(regalo), 0) AS regalado, COUNT(CASE WHEN regalo > 0 THEN 1 END) AS usados FROM pedidos WHERE restaurante_id = ? AND estado IN ('pagado','aceptado','listo','en_camino','entregado')",
    )
    .bind(rid)
    .first<{ ventas: number; regalado: number; usados: number }>();
  const pb = Number(r?.regalos_pb ?? 300);
  const acumulado = Math.floor((Number(v?.ventas ?? 0) * pb) / 10_000);
  const regalado = Number(v?.regalado ?? 0);
  return {
    pb,
    acumulado,
    regalado,
    disponible: Math.max(0, acumulado - regalado),
    usados: Number(v?.usados ?? 0),
  };
}

function esCumpleCerca(fecha: string | null, hoy = new Date()): boolean {
  if (!fecha) return false;
  const [, mes, dia] = fecha.split('-').map(Number);
  if (!mes || !dia) return false;
  for (const delta of [-3, -2, -1, 0, 1, 2, 3]) {
    const d = new Date(hoy.getTime() + delta * 86_400_000);
    if (d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia) return true;
  }
  return false;
}

/** Qué regalos puede usar este cliente en este restaurante HOY, con el carrito que trae. */
export async function regalosDisponibles(
  db: D1Database,
  rid: string,
  clienteId: string,
  subtotal: number,
  platosEnCarrito: Map<string, number>,
): Promise<RegaloDisponible[]> {
  const cfg = await configRegalos(db, rid);
  const caja = await presupuesto(db, rid);
  const cliente = await db
    .prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
    .bind(clienteId)
    .first<{ fecha_nacimiento: string | null }>();
  const hist = await db
    .prepare(
      `SELECT COUNT(*) AS n, MAX(entregado_en) AS ultimo,
      SUM(CASE WHEN regalo_tipo = 'cumpleanos' AND strftime('%Y', creado_en) = strftime('%Y','now') THEN 1 ELSE 0 END) AS cumple_usado,
      MAX(CASE WHEN regalo_tipo = 'sellos' THEN creado_en END) AS ultimo_sello
      FROM pedidos WHERE restaurante_id = ? AND cliente_id = ? AND estado = 'entregado'`,
    )
    .bind(rid, clienteId)
    .first<{
      n: number;
      ultimo: string | null;
      cumple_usado: number;
      ultimo_sello: string | null;
    }>();
  const lista: RegaloDisponible[] = [];
  const platoGratis = (platoId: string | null) =>
    platoId ? (platosEnCarrito.get(platoId) ?? 0) : 0;

  // Cumpleaños: a quien ya le compró antes, una vez al año, con el plato de regalo en el carrito.
  if (
    cfg.cumpleanos &&
    Number(hist?.n) > 0 &&
    !Number(hist?.cumple_usado) &&
    esCumpleCerca(cliente?.fecha_nacimiento ?? null)
  ) {
    const valor = platoGratis(cfg.cumple_plato_id);
    if (valor > 0)
      lista.push({
        tipo: 'cumpleanos',
        platoId: cfg.cumple_plato_id,
        valorCentavos: valor,
        pb: null,
      });
  }
  // Tarjeta de sellos: al llegar a la meta de pedidos entregados desde el último sello cobrado.
  if (cfg.sellos) {
    const desde = hist?.ultimo_sello ?? '0000';
    const n = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM pedidos WHERE restaurante_id = ? AND cliente_id = ? AND estado = 'entregado' AND creado_en > ?",
      )
      .bind(rid, clienteId, desde)
      .first<{ n: number }>();
    const valor = platoGratis(cfg.sellos_plato_id);
    if (Number(n?.n) >= cfg.sellos_meta && valor > 0)
      lista.push({ tipo: 'sellos', platoId: cfg.sellos_plato_id, valorCentavos: valor, pb: null });
  }
  // Cliente que vuelve: si su último pedido entregado fue hace más de N días, un descuento.
  if (cfg.vuelve && hist?.ultimo) {
    const dias = (Date.now() - new Date(`${hist.ultimo}Z`).getTime()) / 86_400_000;
    if (dias >= cfg.vuelve_dias)
      lista.push({
        tipo: 'vuelve',
        platoId: null,
        valorCentavos: Math.floor((subtotal * cfg.vuelve_pb) / 10_000),
        pb: cfg.vuelve_pb,
      });
  }
  return lista.filter(
    (r) => r.valorCentavos > 0 && r.valorCentavos <= caja.disponible && r.valorCentavos <= subtotal,
  );
}

// ---------- Restaurante: pantalla «Regalos y marketing» ----------

async function rid(c: Ctx): Promise<string> {
  const u = exigir(c, 'restaurante');
  const f = await base(c)
    .prepare('SELECT id FROM restaurantes WHERE dueno_id = ?')
    .bind(u.id)
    .first<{ id: string }>();
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  return f.id;
}

regalos.get('/mi-restaurante/regalos', async (c) => {
  const id = await rid(c);
  const db = base(c);
  const cfg = await configRegalos(db, id);
  return c.json({
    presupuesto: await presupuesto(db, id),
    config: {
      cumpleanos: cfg.cumpleanos === 1,
      cumplePlatoId: cfg.cumple_plato_id,
      sellos: cfg.sellos === 1,
      sellosMeta: cfg.sellos_meta,
      sellosPlatoId: cfg.sellos_plato_id,
      vuelve: cfg.vuelve === 1,
      vueltaDias: cfg.vuelve_dias,
      vueltaPb: cfg.vuelve_pb,
    },
  });
});

regalos.put('/mi-restaurante/regalos', async (c) => {
  const id = await rid(c);
  const d = await leerCuerpo(
    c,
    z.object({
      pb: z
        .number()
        .int()
        .min(0, { error: 'El porcentaje va de 0 a 20.' })
        .max(2000, { error: 'El porcentaje va de 0 a 20.' }),
      cumpleanos: z.boolean(),
      cumplePlatoId: z.string().nullable(),
      sellos: z.boolean(),
      sellosMeta: z.number().int().min(3).max(50),
      sellosPlatoId: z.string().nullable(),
      vuelve: z.boolean(),
      vueltaDias: z.number().int().min(7).max(365),
      vueltaPb: z.number().int().min(100).max(5000),
    }),
  );
  const db = base(c);
  for (const pid of [d.cumplePlatoId, d.sellosPlatoId]) {
    if (
      pid &&
      !(await db
        .prepare('SELECT 1 FROM platos WHERE id = ? AND restaurante_id = ? AND eliminado = 0')
        .bind(pid, id)
        .first())
    ) {
      throw new ErrorDatos('El plato de regalo no está en tu menú.', 'plato', 400);
    }
  }
  await db.batch([
    db.prepare('UPDATE restaurantes SET regalos_pb = ? WHERE id = ?').bind(d.pb, id),
    db
      .prepare(
        `INSERT INTO regalos_config (restaurante_id, cumpleanos, cumple_plato_id, sellos, sellos_meta, sellos_plato_id, vuelve, vuelve_dias, vuelve_pb)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(restaurante_id) DO UPDATE SET cumpleanos=excluded.cumpleanos, cumple_plato_id=excluded.cumple_plato_id,
        sellos=excluded.sellos, sellos_meta=excluded.sellos_meta, sellos_plato_id=excluded.sellos_plato_id, vuelve=excluded.vuelve, vuelve_dias=excluded.vuelve_dias, vuelve_pb=excluded.vuelve_pb`,
      )
      .bind(
        id,
        d.cumpleanos ? 1 : 0,
        d.cumplePlatoId,
        d.sellos ? 1 : 0,
        d.sellosMeta,
        d.sellosPlatoId,
        d.vuelve ? 1 : 0,
        d.vueltaDias,
        d.vueltaPb,
      ),
  ]);
  return c.json({ ok: true, presupuesto: await presupuesto(db, id) });
});

// ---------- Cliente: qué regalo tengo en este carrito ----------

regalos.post('/restaurantes/:id/mis-regalos', async (c) => {
  const u = exigir(c, 'cliente');
  const { lineas } = await leerCuerpo(
    c,
    z.object({
      lineas: z
        .array(z.object({ platoId: z.string(), cantidad: z.number().int().min(1).max(99) }))
        .max(50),
    }),
  );
  const db = base(c);
  const ids = [...new Set(lineas.map((l) => l.platoId))];
  if (!ids.length) return c.json({ regalos: [] });
  const { results } = await db
    .prepare(
      `SELECT id, precio_centavos FROM platos WHERE restaurante_id = ? AND eliminado = 0 AND id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(c.req.param('id'), ...ids)
    .all<{ id: string; precio_centavos: number }>();
  const precios = new Map(results.map((p) => [p.id, Number(p.precio_centavos)]));
  const subtotal = lineas.reduce((s, l) => s + (precios.get(l.platoId) ?? 0) * l.cantidad, 0);
  return c.json({
    regalos: await regalosDisponibles(db, c.req.param('id'), u.id, subtotal, precios),
  });
});

// ---------- Admin: repartidores y niveles ----------

regalos.get('/admin/repartidores', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT u.id, u.nombre, u.correo, d.tipo, d.conectado, d.puntos,
      (SELECT COUNT(*) FROM pedidos p WHERE p.repartidor_id = u.id AND p.estado = 'entregado') AS entregas,
      (SELECT ROUND(AVG(k.estrellas_repartidor), 2) FROM calificaciones k JOIN pedidos p ON p.id = k.pedido_id
        WHERE p.repartidor_id = u.id AND k.culpa_restaurante = 0 AND k.estrellas_repartidor IS NOT NULL) AS estrellas
      FROM usuarios u LEFT JOIN repartidores d ON d.usuario_id = u.id WHERE u.rol = 'repartidor' ORDER BY d.puntos DESC`,
    )
    .all();
  return c.json({ repartidores: results });
});

regalos.patch('/admin/repartidores/:id', async (c) => {
  exigir(c, 'admin');
  const { tipo } = await leerCuerpo(c, z.object({ tipo: z.enum(['independiente', 'empleado']) }));
  const db = base(c);
  await db
    .prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)')
    .bind(c.req.param('id'))
    .run();
  await db
    .prepare('UPDATE repartidores SET tipo = ? WHERE usuario_id = ?')
    .bind(tipo, c.req.param('id'))
    .run();
  return c.json({ ok: true });
});
