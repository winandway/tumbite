import type { Env } from './env';
import { enviarCorreo } from './correo';

/**
 * Dinero vigilado (de los estudios de Richard): cada día se suma lo vendido, lo cobrado en Stripe,
 * lo devuelto y lo abonado a restaurantes y repartidores, y se comprueba que cuadre. Si no cuadra,
 * se avisa al equipo y el canario de salud se pone en rojo. También se borran las fotos de
 * evidencia de más de 30 días (salvo pedidos con un reclamo abierto).
 */
export const DIAS_FOTOS = 30;

export type Conciliacion = {
  dia: string;
  pedidos: number;
  vendido: number;
  capturado: number;
  devuelto: number;
  abonado: number;
  retirado: number;
  cuadra: boolean;
  detalle: Record<string, number | string>;
};

const n = (v: unknown) => Number(v ?? 0);

export async function conciliar(db: D1Database, dia: string): Promise<Conciliacion> {
  // Pedidos entregados ese día y lo que les corresponde a cada bolsillo.
  const p = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total, COALESCE(SUM(pago_restaurante),0) AS rest,
        COALESCE(SUM(pago_repartidor),0) AS rep, COALESCE(SUM(propina),0) AS prop,
        COALESCE(SUM((SELECT b.centavos FROM bonos_pedido b WHERE b.pedido_id = pedidos.id)),0) AS bonos,
        COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM cobros c WHERE c.pedido_id = pedidos.id) THEN total ELSE 0 END),0) AS total_con_cobro
       FROM pedidos WHERE estado = 'entregado' AND date(entregado_en) = ?`,
    )
    .bind(dia)
    .first<Record<string, unknown>>();
  // Lo capturado en Stripe ese día (cobros autorizados al pedir y capturados al entregar).
  const cap = await db
    .prepare(
      `SELECT COALESCE(SUM(c.capturado),0) AS capturado FROM cobros c JOIN pedidos p ON p.id = c.pedido_id
       WHERE p.estado = 'entregado' AND date(p.entregado_en) = ? AND c.capturado_en IS NOT NULL`,
    )
    .bind(dia)
    .first<{ capturado: number }>();
  // Lo devuelto: pedidos cancelados ese día (devolución completa) y ajustes por plato agotado.
  const dev = await db
    .prepare(
      `SELECT COALESCE(SUM(p.total),0) AS total FROM pedidos p
       WHERE p.estado = 'cancelado' AND p.pagado_en IS NOT NULL
       AND date((SELECT MAX(h.creado_en) FROM historial_estados h WHERE h.pedido_id = p.id AND h.estado = 'cancelado')) = ?`,
    )
    .bind(dia)
    .first<{ total: number }>();
  // El libro de los bolsillos (movimientos) de ese día, por concepto.
  const { results: mov } = await db
    .prepare(
      `SELECT concepto, COALESCE(SUM(monto),0) AS monto FROM movimientos WHERE date(creado_en) = ? GROUP BY concepto`,
    )
    .bind(dia)
    .all<{ concepto: string; monto: number }>();
  const por = new Map(mov.map((m) => [m.concepto, Number(m.monto)]));
  const venta = por.get('venta') ?? 0;
  const entrega = por.get('entrega') ?? 0;
  const propina = por.get('propina') ?? 0;
  const retirado = -(por.get('retiro') ?? 0);
  // Reglas que tienen que cuadrar:
  // 1) lo abonado a restaurantes = la suma de pago_restaurante de lo entregado ese día;
  // 2) lo abonado a repartidores (entrega + propina) = pago_repartidor + bonos de lo entregado;
  // 3) lo capturado en Stripe = el total de los pedidos entregados que tenían cobro autorizado.
  const cuadraRest = venta === n(p?.rest);
  const cuadraRep = entrega + propina === n(p?.rep) + n(p?.bonos);
  const cuadraStripe = n(cap?.capturado) === n(p?.total_con_cobro);
  const r: Conciliacion = {
    dia,
    pedidos: n(p?.n),
    vendido: n(p?.total),
    capturado: n(cap?.capturado),
    devuelto: n(dev?.total),
    abonado: venta + entrega + propina,
    retirado,
    cuadra: cuadraRest && cuadraRep && cuadraStripe,
    detalle: {
      restaurantesEsperado: n(p?.rest),
      restaurantesAbonado: venta,
      repartidoresEsperado: n(p?.rep) + n(p?.bonos),
      repartidoresAbonado: entrega + propina,
      stripeEsperado: n(p?.total_con_cobro),
      stripeCapturado: n(cap?.capturado),
      cuadraRestaurantes: cuadraRest ? 'sí' : 'NO',
      cuadraRepartidores: cuadraRep ? 'sí' : 'NO',
      cuadraStripe: cuadraStripe ? 'sí' : 'NO',
    },
  };
  await db
    .prepare(
      `INSERT OR REPLACE INTO conciliaciones (dia, pedidos, vendido, capturado, devuelto, abonado, retirado, cuadra, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      dia,
      r.pedidos,
      r.vendido,
      r.capturado,
      r.devuelto,
      r.abonado,
      r.retirado,
      r.cuadra ? 1 : 0,
      JSON.stringify(r.detalle),
    )
    .run();
  return r;
}

/** La fecha UTC de ayer, como la guarda la base (YYYY-MM-DD). */
export const ayer = (ahora = Date.now()) => new Date(ahora - 86_400_000).toISOString().slice(0, 10);

/** El reloj llama aquí: concilia ayer si todavía no se hizo y avisa al equipo si no cuadra. */
export async function conciliarAyer(env: Env, db: D1Database): Promise<Conciliacion | null> {
  const dia = ayer();
  const hecha = await db.prepare('SELECT 1 FROM conciliaciones WHERE dia = ?').bind(dia).first();
  if (hecha) return null;
  const r = await conciliar(db, dia);
  if (!r.cuadra)
    for (const para of (env.ADMIN_CORREOS ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean))
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Conciliación del ${dia}: NO cuadra`,
        texto: `La conciliación diaria del ${dia} no cuadra.\n\n${JSON.stringify(r.detalle, null, 2)}\n\nRevísala en el superadmin antes de que se acumule.`,
      }).catch((e: unknown) => console.error('conciliación: correo', e));
  return r;
}

/** La última conciliación, para el canario de salud. */
export async function ultimaConciliacion(db: D1Database) {
  return db
    .prepare('SELECT dia, cuadra FROM conciliaciones ORDER BY dia DESC LIMIT 1')
    .first<{ dia: string; cuadra: number }>();
}

/**
 * Retención de fotos: a los 30 días se borra el archivo de la recogida y la entrega, salvo que el
 * pedido tenga un reclamo (ticket) sin cerrar. Queda la fila con la fecha en que se borró.
 */
export async function depurarFotos(db: D1Database, almacen: R2Bucket): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT e.pedido_id, e.tipo, e.clave FROM evidencias e
       WHERE e.clave != '' AND e.borrada_en IS NULL AND e.creada_en < datetime('now', ?)
       AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.pedido_id = e.pedido_id AND t.estado != 'cerrado')
       LIMIT 200`,
    )
    .bind(`-${DIAS_FOTOS} days`)
    .all<{ pedido_id: string; tipo: string; clave: string }>();
  let borradas = 0;
  for (const e of results) {
    await almacen.delete(e.clave);
    await db
      .prepare(
        "UPDATE evidencias SET clave = '', borrada_en = datetime('now') WHERE pedido_id = ? AND tipo = ?",
      )
      .bind(e.pedido_id, e.tipo)
      .run();
    borradas++;
  }
  return borradas;
}
