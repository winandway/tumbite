import { anotarEvento } from '../manager';
import { ErrorDatos } from '../validar';
import { anotarLibro } from './libro';
import { paisDeZona } from './paises';

/**
 * Fase 2 · cobro directo, paso 2 y 3 del recorrido aprobado (C-COBRO-DIRECTO-LOCAL): el repartidor
 * paga la comida en el mostrador con su propio dinero (efectivo o su tarjeta), recibe el ticket del
 * restaurante y lo entrega con el pedido. Tumbite NO pone ese dinero ni lo financia: solo registra
 * cuánto se pagó, cuánto decía el ticket y cuánto esperaba la app, para que la conciliación cuadre.
 */
export type MetodoLocal = 'efectivo' | 'tarjeta_propia';

export type PagoLocal = {
  montoEsperado: number;
  subtotal: number;
  montoPagado: number;
  importeTicket: number;
  metodo: MetodoLocal;
  diferenciaPago: number;
  diferenciaTicket: number;
  creadoEn: string;
  confirmadoRestauranteEn: string | null;
};

type FilaBase = {
  id: string;
  estado: string;
  zona_id: string;
  subtotal: number;
  pago_restaurante: number;
  repartidor_id: string | null;
  metodo_pago: string;
  restaurante_id: string;
};

const directo = (m: string) => m === 'efectivo' || m === 'transferencia_repartidor';

async function filaPedido(db: D1Database, pedidoId: string) {
  return db
    .prepare(
      'SELECT id, estado, zona_id, subtotal, pago_restaurante, repartidor_id, metodo_pago, restaurante_id FROM pedidos WHERE id = ?',
    )
    .bind(pedidoId)
    .first<FilaBase>();
}

function aPagoLocal(r: Record<string, unknown>, f: FilaBase): PagoLocal {
  return {
    montoEsperado: Number(f.pago_restaurante),
    subtotal: Number(f.subtotal),
    montoPagado: Number(r.monto_pagado),
    importeTicket: Number(r.importe_ticket),
    metodo: String(r.metodo) as MetodoLocal,
    diferenciaPago: Number(r.diferencia_pago),
    diferenciaTicket: Number(r.diferencia_ticket),
    creadoEn: String(r.creado_en),
    confirmadoRestauranteEn: r.confirmado_restaurante_en
      ? String(r.confirmado_restaurante_en)
      : null,
  };
}

export async function leerPagoLocal(db: D1Database, pedidoId: string) {
  const f = await filaPedido(db, pedidoId);
  if (!f || !directo(f.metodo_pago)) return null;
  const r = await db
    .prepare('SELECT * FROM pagos_local WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<Record<string, unknown>>();
  return {
    pedido: f,
    // Lo que la app le dice al repartidor que pague: la comida menos la comisión de Tumbite.
    montoEsperado: Number(f.pago_restaurante),
    subtotal: Number(f.subtotal),
    registrado: r ? aPagoLocal(r, f) : null,
  };
}

/** ¿Este pedido directo ya tiene registrado el pago de la comida en el local? */
export async function exigirPagoLocal(db: D1Database, pedidoId: string) {
  const f = await filaPedido(db, pedidoId);
  if (!f || !directo(f.metodo_pago)) return;
  const r = await db
    .prepare('SELECT 1 FROM pagos_local WHERE pedido_id = ?')
    .bind(pedidoId)
    .first();
  if (!r)
    throw new ErrorDatos(
      'Primero registra lo que pagaste al restaurante y el importe del ticket.',
      undefined,
      409,
    );
}

/**
 * El repartidor registra el pago en el local. Una sola vez por pedido (la segunda vez responde 409:
 * un reintento no duplica nada). Las diferencias no frenan la entrega: quedan anotadas y la
 * conciliación las marca «con diferencia» para que soporte las revise.
 */
export async function registrarPagoLocal(
  db: D1Database,
  p: {
    pedidoId: string;
    repartidorId: string;
    montoPagado: number;
    importeTicket: number;
    metodo: MetodoLocal;
  },
) {
  const f = await filaPedido(db, p.pedidoId);
  if (!f || !directo(f.metodo_pago) || f.repartidor_id !== p.repartidorId)
    throw new ErrorDatos('Este pedido no se paga en el local.', undefined, 409);
  if (!['aceptado', 'listo'].includes(f.estado))
    throw new ErrorDatos('Registra el pago cuando estés en el restaurante.', undefined, 409);
  for (const [v, campo] of [
    [p.montoPagado, 'montoPagado'],
    [p.importeTicket, 'importeTicket'],
  ] as const)
    if (!Number.isSafeInteger(v) || v <= 0)
      throw new ErrorDatos('El monto no es válido.', campo, 400);
  const diferenciaPago = p.montoPagado - Number(f.pago_restaurante);
  const diferenciaTicket = p.importeTicket - Number(f.subtotal);
  const r = await db
    .prepare(
      `INSERT OR IGNORE INTO pagos_local (pedido_id, repartidor_id, monto_esperado, monto_pagado, importe_ticket, metodo, diferencia_pago, diferencia_ticket)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      p.pedidoId,
      p.repartidorId,
      Number(f.pago_restaurante),
      p.montoPagado,
      p.importeTicket,
      p.metodo,
      diferenciaPago,
      diferenciaTicket,
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Ya registraste el pago de este pedido.', undefined, 409);
  await anotarEvento(
    db,
    p.pedidoId,
    'pago_local',
    `${p.metodo} · pagó ${p.montoPagado} de ${Number(f.pago_restaurante)} · ticket ${p.importeTicket} de ${Number(f.subtotal)}`,
  );
  if (diferenciaPago !== 0 || diferenciaTicket !== 0)
    await anotarEvento(
      db,
      p.pedidoId,
      'pago_local_diferencia',
      `pago ${diferenciaPago > 0 ? '+' : ''}${diferenciaPago} · ticket ${diferenciaTicket > 0 ? '+' : ''}${diferenciaTicket}`,
    );
  const leido = await leerPagoLocal(db, p.pedidoId);
  return leido?.registrado ?? null;
}

/** El restaurante confirma que recibió el pago (lo marca al confirmar la recogida). */
export async function confirmarPagoLocalRestaurante(
  db: D1Database,
  pedidoId: string,
  actorId: string,
) {
  await db
    .prepare(
      "UPDATE pagos_local SET confirmado_restaurante_en = datetime('now'), confirmado_por = ? WHERE pedido_id = ? AND confirmado_restaurante_en IS NULL",
    )
    .bind(actorId, pedidoId)
    .run();
}

/**
 * El pedido no llegó al cliente (cancelado, cliente que no paga, repartidor soltado por soporte)
 * DESPUÉS de que el repartidor pagó la comida: ese dinero del repartidor queda registrado como
 * pérdida PENDIENTE DE DECISIÓN (quién la absorbe lo decide Richard, decisión 13). Idempotente.
 */
export async function registrarPerdidaComida(db: D1Database, pedidoId: string, motivo: string) {
  const r = await db
    .prepare('SELECT repartidor_id, monto_pagado FROM pagos_local WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ repartidor_id: string; monto_pagado: number }>();
  if (!r) return false;
  const f = await filaPedido(db, pedidoId);
  if (!f) return false;
  const { pais, moneda } = await paisDeZona(db, f.zona_id);
  const anotado = await anotarLibro(db, {
    cuentaId: r.repartidor_id,
    bolsillo: 'directo',
    pais,
    moneda,
    monto: -Number(r.monto_pagado),
    concepto: 'comida_comprada_sin_entregar',
    pedidoId,
    referencia: `perdida:${pedidoId}`,
  });
  // La referencia es única: la segunda vez no se anota nada (INSERT OR IGNORE).
  if (!anotado.meta.changes) return false;
  await anotarEvento(db, pedidoId, 'perdida_pendiente_decision', `${motivo} · ${r.monto_pagado}`);
  return true;
}
