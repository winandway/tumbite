import { correosEquipo } from './avisosEquipo';
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
       FROM pedidos WHERE estado = 'entregado' AND date(entregado_en) = ? AND metodo_pago = 'tarjeta'`,
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
      `SELECT COALESCE(SUM(p.total),0) + (SELECT COALESCE(SUM(dv.monto),0) FROM devoluciones dv WHERE date(dv.creado_en) = ?1) AS total FROM pedidos p
       WHERE p.estado = 'cancelado' AND p.pagado_en IS NOT NULL AND p.metodo_pago = 'tarjeta'
       AND date((SELECT MAX(h.creado_en) FROM historial_estados h WHERE h.pedido_id = p.id AND h.estado = 'cancelado')) = ?1`,
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
  // C-CONCILIACION-DIRECTA (19 oct 2026): los pedidos cobrados en mano (efectivo o transferencia al
  // repartidor) no pasan por Stripe ni por la billetera: se cuentan aparte y por moneda, nunca se
  // suman a lo de arriba. Cada uno tiene su propia conciliación (conciliacion_estado).
  const { results: dir } = await db
    .prepare(
      `SELECT moneda, COUNT(*) AS n, SUM(CASE WHEN conciliacion_estado = 'con_diferencia' THEN 1 ELSE 0 END) AS dif,
        SUM(CASE WHEN conciliacion_estado = 'pendiente' THEN 1 ELSE 0 END) AS pend
       FROM pedidos WHERE estado = 'entregado' AND date(entregado_en) = ? AND metodo_pago != 'tarjeta' GROUP BY moneda`,
    )
    .bind(dia)
    .all<{ moneda: string; n: number; dif: number; pend: number }>();
  const directos: Record<string, number> = {};
  for (const d of dir) {
    directos[`directos_${d.moneda}`] = n(d.n);
    directos[`directosConDiferencia_${d.moneda}`] = n(d.dif);
    directos[`directosPendientes_${d.moneda}`] = n(d.pend);
  }
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
      ...directos,
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

/** Los estados de un pedido (el CHECK de `pedidos.estado` en schema.sql). */
const ESTADOS_PEDIDO = [
  'pago_pendiente',
  'pagado',
  'aceptado',
  'listo',
  'en_camino',
  'entregado',
  'cancelado',
] as const;

/**
 * C-LECTURAS-CONCILIACION (13 nov 2026): los pedidos creados desde `desde` (los de la corrida de
 * hoy), sin recorrer la tabla. Va por el índice que ya existe `pedidos_zona_estado (zona_id,
 * estado, creado_en)`: una búsqueda por zona y estado con el rango de la fecha (`zona_id` es
 * NOT NULL y sale de `zonas`). Nada de `date(col)` (no deja usar ningún índice).
 */
export async function pedidosCreadosDesde(
  db: D1Database,
  desde: string,
  limite: number,
): Promise<string[]> {
  const estados = ESTADOS_PEDIDO.map((e) => `'${e}'`).join(', ');
  const { results } = await db
    .prepare(
      `SELECT id FROM pedidos INDEXED BY pedidos_zona_estado
        WHERE zona_id IN (SELECT id FROM zonas) AND estado IN (${estados}) AND creado_en >= ?1
        ORDER BY creado_en DESC LIMIT ?2`,
    )
    .bind(desde, limite)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/**
 * C-LECTURAS-CONCILIACION (13 nov 2026): las mismas tres reglas de `conciliar`, pero pedido por
 * pedido y solo para los pedidos dados (la conciliación de diagnóstico de las pruebas). Antes,
 * cada llamada sumaba el día entero: el movimiento de los bolsillos recorría `movimientos`
 * (`date(creado_en)` no deja usar índice) y los pedidos entregados se leían cuatro veces (unas
 * 20.000 filas por llamada con el volumen del sitio de pruebas). Ahora cada pedido va por su clave
 * y sus movimientos por el índice único `movimientos_unico (usuario_id, pedido_id, concepto)`.
 *
 * Por pedido (lo esperado es 0 si no está entregado o no se pagó con tarjeta, igual que en el
 * día: ahí esos pedidos no suman a lo esperado, pero sus movimientos sí):
 * 1) restaurante: el movimiento «venta» de su dueño = pago_restaurante;
 * 2) repartidor: «entrega» + «propina» = pago_repartidor + el bono;
 * 3) Stripe: lo capturado = el total, si el pedido tenía cobro autorizado.
 */
export async function conciliarPedidos(
  db: D1Database,
  ids: readonly string[],
): Promise<{ pedidos: number; cuadra: boolean; detalle: Record<string, number | string> }> {
  const filas: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const tanda = ids.slice(i, i + 50);
    const { results } = await db
      .prepare(
        `SELECT p.id, p.estado, p.metodo_pago, p.total, p.pago_restaurante, p.pago_repartidor,
           (SELECT b.centavos FROM bonos_pedido b WHERE b.pedido_id = p.id) AS bono,
           (SELECT 1 FROM cobros c WHERE c.pedido_id = p.id) AS con_cobro,
           (SELECT c.capturado FROM cobros c WHERE c.pedido_id = p.id AND c.capturado_en IS NOT NULL) AS capturado,
           (SELECT COALESCE(SUM(m.monto), 0) FROM movimientos m
             WHERE m.usuario_id = r.dueno_id AND m.pedido_id = p.id AND m.concepto = 'venta') AS venta,
           (SELECT COALESCE(SUM(m.monto), 0) FROM movimientos m
             WHERE m.usuario_id = p.repartidor_id AND m.pedido_id = p.id AND m.concepto IN ('entrega', 'propina')) AS al_repartidor
         FROM pedidos p LEFT JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.id IN (${tanda.map(() => '?').join(', ')})`,
      )
      .bind(...tanda)
      .all<Record<string, unknown>>();
    filas.push(...results);
  }
  const t = { rest: 0, venta: 0, rep: 0, alRep: 0, stripeEsp: 0, stripeCap: 0 };
  const difs: string[] = [];
  for (const f of filas) {
    const cuenta = f.estado === 'entregado' && f.metodo_pago === 'tarjeta';
    const rest = cuenta ? n(f.pago_restaurante) : 0;
    const rep = cuenta ? n(f.pago_repartidor) + n(f.bono) : 0;
    const stripeEsp = cuenta && f.con_cobro ? n(f.total) : 0;
    const stripeCap = f.estado === 'entregado' ? n(f.capturado) : 0;
    t.rest += rest;
    t.venta += n(f.venta);
    t.rep += rep;
    t.alRep += n(f.al_repartidor);
    t.stripeEsp += stripeEsp;
    t.stripeCap += stripeCap;
    if (rest !== n(f.venta))
      difs.push(`${String(f.id)}: restaurante ${rest} ≠ abonado ${n(f.venta)}`);
    if (rep !== n(f.al_repartidor))
      difs.push(`${String(f.id)}: repartidor ${rep} ≠ abonado ${n(f.al_repartidor)}`);
    if (stripeEsp !== stripeCap)
      difs.push(`${String(f.id)}: Stripe esperado ${stripeEsp} ≠ capturado ${stripeCap}`);
  }
  return {
    pedidos: filas.length,
    cuadra: difs.length === 0,
    detalle: {
      pedidosRevisados: filas.length,
      restaurantesEsperado: t.rest,
      restaurantesAbonado: t.venta,
      repartidoresEsperado: t.rep,
      repartidoresAbonado: t.alRep,
      stripeEsperado: t.stripeEsp,
      stripeCapturado: t.stripeCap,
      ...(difs.length ? { diferencias: difs.slice(0, 20).join(' | ') } : {}),
    },
  };
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
    for (const para of await correosEquipo(env, 'dinero'))
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Conciliación del ${dia}: NO cuadra`,
        texto: `La conciliación diaria del ${dia} no cuadra.\n\n${JSON.stringify(r.detalle, null, 2)}\n\nRevísala en el superadmin antes de que se acumule.`,
      }).catch((e: unknown) => console.error('conciliación: correo', e));
  return r;
}

/** La última conciliación (la pieza «dinero» del canario ya no la usa sola: ver saludDinero). */
export async function ultimaConciliacion(db: D1Database) {
  return db
    .prepare('SELECT dia, cuadra FROM conciliaciones ORDER BY dia DESC LIMIT 1')
    .first<{ dia: string; cuadra: number }>();
}

/**
 * C-DINERO-30-DIAS (NXT-1, 3 nov 2026): cuántos días mira el canario. Antes solo miraba la última
 * conciliación y un día que no cuadró desaparecía al día siguiente.
 */
export const DIAS_VIGILADOS = 30;

export type DiaSinCuadrar = {
  dia: string;
  pedidos: number;
  vendido: number;
  capturado: number;
  detalle: Record<string, unknown>;
  excusado: boolean;
  motivo: string | null;
  excusadoPor: string | null;
  excusadoPorNombre: string | null;
  excusadoEn: string | null;
  /** ETP-3: la segunda firma (otra cuenta Total o Finanzas). Null en las excusas viejas. */
  aprobadoPorNombre: string | null;
};

/**
 * Los días de los últimos 30 que no cuadraron, cada uno con su excepción si la tiene. Una excepción
 * vale solo para las cifras que se excusaron (pedidos, vendido y detalle iguales): si el día se
 * vuelve a calcular con otra diferencia, vuelve el rojo hasta que alguien la excuse.
 */
export async function diasSinCuadrar(db: D1Database): Promise<DiaSinCuadrar[]> {
  const { results } = await db
    .prepare(
      `SELECT c.dia, c.pedidos, c.vendido, c.capturado, c.detalle,
              e.motivo, e.creado_por, e.creado_por_nombre, e.creado_en AS excusado_en,
              CASE WHEN e.id IS NOT NULL THEN (SELECT u.nombre FROM aprobaciones_dinero a JOIN usuarios u ON u.id = a.revisado_por
                 WHERE a.tipo = 'excusa_conciliacion' AND a.objeto = 'conciliacion:' || c.dia AND a.estado = 'aprobada'
                 ORDER BY a.revisado_en DESC LIMIT 1) END AS aprobado_por_nombre
         FROM conciliaciones c
         LEFT JOIN conciliacion_excepciones e
           ON e.dia = c.dia AND e.pedidos = c.pedidos AND e.vendido = c.vendido AND e.detalle = c.detalle
        WHERE c.cuadra = 0 AND c.dia >= date('now', ?)
        ORDER BY c.dia DESC LIMIT 100`,
    )
    .bind(`-${DIAS_VIGILADOS} days`)
    .all<Record<string, unknown>>();
  return results.map((r) => ({
    dia: String(r.dia),
    pedidos: n(r.pedidos),
    vendido: n(r.vendido),
    capturado: n(r.capturado),
    detalle: leerDetalle(r.detalle),
    excusado: r.motivo != null,
    motivo: r.motivo == null ? null : String(r.motivo),
    excusadoPor: r.creado_por == null ? null : String(r.creado_por),
    excusadoPorNombre: r.creado_por_nombre == null ? null : String(r.creado_por_nombre),
    excusadoEn: r.excusado_en == null ? null : String(r.excusado_en),
    aprobadoPorNombre: r.aprobado_por_nombre == null ? null : String(r.aprobado_por_nombre),
  }));
}

function leerDetalle(v: unknown): Record<string, unknown> {
  try {
    return JSON.parse(String(v ?? '{}')) as Record<string, unknown>;
  } catch {
    return { crudo: String(v) };
  }
}

/** Pieza «dinero» del canario: rojo si algún día de los últimos 30 no cuadra y no tiene excepción. */
export async function saludDinero(db: D1Database): Promise<'ok' | 'error' | 'pendiente'> {
  if (!(await ultimaConciliacion(db))) return 'pendiente';
  const dias = await diasSinCuadrar(db);
  return dias.some((d) => !d.excusado) ? 'error' : 'ok';
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
  // La foto del ticket del pago en el local (cobro directo): misma retención, pero SOLO si el pedido
  // quedó conciliado sin diferencias. Con diferencia o reclamo abierto, es evidencia y se queda.
  const { results: tickets } = await db
    .prepare(
      `SELECT l.pedido_id, l.ticket_clave FROM pagos_local l JOIN pedidos p ON p.id = l.pedido_id
       WHERE l.ticket_clave IS NOT NULL AND l.creado_en < datetime('now', ?) AND p.conciliacion_estado = 'conciliado'
       AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.pedido_id = l.pedido_id AND t.estado != 'cerrado')
       LIMIT 200`,
    )
    .bind(`-${DIAS_FOTOS} days`)
    .all<{ pedido_id: string; ticket_clave: string }>();
  for (const t of tickets) {
    await almacen.delete(t.ticket_clave);
    await db
      .prepare('UPDATE pagos_local SET ticket_clave = NULL WHERE pedido_id = ?')
      .bind(t.pedido_id)
      .run();
    borradas++;
  }
  return borradas;
}
