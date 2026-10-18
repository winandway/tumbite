import { porcentajeDe } from '@tumbite/compartido';
import { anotarEvento } from '../manager';
import { ErrorDatos } from '../validar';
import { anotarLibro, cobrarReserva, liberarReserva, reservarComision, saldoLibro } from './libro';
import { leerConfigPais, paisDeZona, type ConfigPais } from './paises';

export type MetodoPago = 'tarjeta' | 'efectivo' | 'transferencia_repartidor';

type FilaPedidoDirecto = {
  id: string;
  estado: string;
  zona_id: string;
  subtotal: number;
  total: number;
  propina: number;
  ganancia: number;
  pago_restaurante: number;
  cliente_id: string;
  repartidor_id: string | null;
  metodo_pago: string;
  cobro_estado: string;
  monto_recibido: number | null;
  conciliacion_estado: string;
  entregado_en: string | null;
};

async function filaDirecta(db: D1Database, pedidoId: string) {
  return db
    .prepare(
      'SELECT id, estado, zona_id, subtotal, total, propina, ganancia, pago_restaurante, cliente_id, repartidor_id, metodo_pago, cobro_estado, monto_recibido, conciliacion_estado, entregado_en FROM pedidos WHERE id = ?',
    )
    .bind(pedidoId)
    .first<FilaPedidoDirecto>();
}

/** Lo que el cliente debe por pedidos que no pagó (unidad menor de esa moneda). */
export async function deudaCliente(
  db: D1Database,
  clienteId: string,
  pais: string,
  moneda: string,
) {
  return saldoLibro(db, clienteId, 'deuda_cliente', pais, moneda);
}

/**
 * Comisión que Tumbite cobra en un pedido de cobro directo: la del país (porcentaje sobre la comida
 * más cargo fijo) o, sin cifra fijada, la ganancia que ya calculó el desglose.
 */
export function comisionDirecta(p: { subtotal: number; ganancia: number }, cfg: ConfigPais) {
  if (cfg.comisionPb == null) return Math.max(0, p.ganancia) + cfg.cargoFijo;
  return porcentajeDe(p.subtotal, cfg.comisionPb) + cfg.cargoFijo;
}

/**
 * Convierte un pedido recién creado (pago_pendiente) en un pedido de cobro directo: el cliente paga
 * al repartidor al recibir. Exige el interruptor del país y que el cliente no tenga deuda.
 * El pedido pasa a «pagado» (= confirmado para el restaurante) sin tocar Stripe.
 */
export async function abrirPedidoDirecto(
  db: D1Database,
  p: {
    pedidoId: string;
    zonaId: string;
    clienteId: string;
    metodo: Exclude<MetodoPago, 'tarjeta'>;
  },
) {
  const { pais, moneda } = await paisDeZona(db, p.zonaId);
  const cfg = await leerConfigPais(db, pais);
  if (p.metodo === 'efectivo' && !cfg.efectivoActivo)
    throw new ErrorDatos('Este país todavía no acepta pago en efectivo.', 'metodoPago', 409);
  if (p.metodo === 'transferencia_repartidor' && !cfg.transferenciaRepartidorActiva)
    throw new ErrorDatos(
      'Este país todavía no acepta transferencia al repartidor.',
      'metodoPago',
      409,
    );
  const deuda = await deudaCliente(db, p.clienteId, pais, moneda);
  if (deuda > cfg.umbralDeudaCliente)
    throw new ErrorDatos(
      'Tienes un saldo pendiente con Tumbite. Escríbenos a soporte para resolverlo antes de pedir.',
      undefined,
      409,
    );
  const r = await db
    .prepare(
      `UPDATE pedidos SET metodo_pago = ?, cobro_estado = 'pendiente', conciliacion_estado = 'pendiente', estado = 'pagado', pagado_en = datetime('now')
        WHERE id = ? AND estado = 'pago_pendiente'`,
    )
    .bind(p.metodo, p.pedidoId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Este pedido ya cambió de estado.', undefined, 409);
  await anotarEvento(db, p.pedidoId, 'cobro_directo', p.metodo);
  return { pais, moneda };
}

/** ¿Este pedido se cobra en mano (efectivo o transferencia al repartidor)? */
export const esDirecto = (metodo: string | null | undefined) =>
  metodo === 'efectivo' || metodo === 'transferencia_repartidor';

/**
 * Antes de ofrecer o aceptar un pedido directo: el repartidor necesita saldo prepago para la
 * comisión y no haber pasado el tope de efectivo sin conciliar del país.
 */
export async function puedeTomarDirecto(
  db: D1Database,
  pedidoId: string,
  repartidorId: string,
): Promise<
  | { ok: true; comision: number; pais: string; moneda: string }
  | { ok: false; motivo: 'saldo' | 'tope' }
> {
  const f = await filaDirecta(db, pedidoId);
  if (!f || !esDirecto(f.metodo_pago)) return { ok: true, comision: 0, pais: 'US', moneda: 'USD' };
  const { pais, moneda } = await paisDeZona(db, f.zona_id);
  const cfg = await leerConfigPais(db, pais);
  const comision = comisionDirecta(f, cfg);
  const saldo = await saldoLibro(db, repartidorId, 'prepago', pais, moneda);
  if (saldo < comision) return { ok: false, motivo: 'saldo' };
  if (cfg.topeEfectivoDiario != null) {
    const enMano = await db
      .prepare(
        `SELECT COALESCE(SUM(monto_recibido), 0) AS m FROM pedidos WHERE repartidor_id = ? AND metodo_pago = 'efectivo'
           AND cobro_estado IN ('confirmado','parcial') AND conciliacion_estado <> 'conciliado' AND cobro_confirmado_en > datetime('now', '-1 day')`,
      )
      .bind(repartidorId)
      .first<{ m: number }>();
    if (Number(enMano?.m ?? 0) >= cfg.topeEfectivoDiario) return { ok: false, motivo: 'tope' };
  }
  return { ok: true, comision, pais, moneda };
}

/** Al aceptar: aparta la comisión. Lanza 409 si no alcanza (y el llamador suelta el pedido). */
export async function reservarAlAceptar(db: D1Database, pedidoId: string, repartidorId: string) {
  const p = await puedeTomarDirecto(db, pedidoId, repartidorId);
  if (!p.ok)
    throw new ErrorDatos(
      p.motivo === 'saldo'
        ? 'Te falta saldo para la comisión de este pedido. Recarga y vuelve a intentar.'
        : 'Llegaste al tope de efectivo del día. Concilia o recarga para seguir con pedidos en efectivo.',
      undefined,
      409,
    );
  if (p.comision <= 0) return;
  const ok = await reservarComision(db, {
    pedidoId,
    repartidorId,
    pais: p.pais,
    moneda: p.moneda,
    monto: p.comision,
  });
  if (!ok)
    throw new ErrorDatos(
      'Te falta saldo para la comisión de este pedido. Recarga y vuelve a intentar.',
      undefined,
      409,
    );
}

/** El repartidor confirma lo que recibió del cliente (efectivo o transferencia que vio en su banco). */
export async function confirmarCobro(
  db: D1Database,
  p: { pedidoId: string; repartidorId: string; montoRecibido: number; nota: string },
) {
  const f = await filaDirecta(db, p.pedidoId);
  if (!f || f.repartidor_id !== p.repartidorId || !esDirecto(f.metodo_pago))
    throw new ErrorDatos('Ese pedido no se cobra en mano.', undefined, 409);
  if (f.cobro_estado !== 'pendiente')
    throw new ErrorDatos('Ya confirmaste el cobro de este pedido.', undefined, 409);
  if (!['en_camino', 'entregado'].includes(f.estado))
    throw new ErrorDatos('Confirma el cobro cuando estés con el cliente.', undefined, 409);
  if (!Number.isSafeInteger(p.montoRecibido) || p.montoRecibido < 0)
    throw new ErrorDatos('El monto no es válido.', 'montoRecibido', 400);
  // La propina en efectivo es del repartidor y no entra aquí: se compara contra el total sin propina.
  const esperado = f.total - f.propina;
  const estado =
    p.montoRecibido >= esperado ? 'confirmado' : p.montoRecibido > 0 ? 'parcial' : 'no_pagado';
  const r = await db
    .prepare(
      "UPDATE pedidos SET cobro_estado = ?, monto_recibido = ?, cobro_confirmado_en = datetime('now'), cobro_nota = ? WHERE id = ? AND cobro_estado = 'pendiente'",
    )
    .bind(estado, p.montoRecibido, p.nota.slice(0, 300), p.pedidoId)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Ya confirmaste el cobro de este pedido.', undefined, 409);
  await anotarEvento(
    db,
    p.pedidoId,
    'cobro_confirmado',
    `${estado} · ${p.montoRecibido} · ${f.metodo_pago}`,
  );
  const { pais, moneda } = await paisDeZona(db, f.zona_id);
  // Informativo: ese dinero fue del cliente al repartidor, nunca pasó por Tumbite.
  await anotarLibro(db, {
    cuentaId: p.repartidorId,
    bolsillo: 'directo',
    pais,
    moneda,
    monto: p.montoRecibido,
    concepto: `cobro_${f.metodo_pago}`,
    pedidoId: p.pedidoId,
    referencia: `directo:${p.pedidoId}`,
    autorId: p.repartidorId,
  });
  await conciliarPedidoDirecto(db, p.pedidoId);
  return estado;
}

/**
 * El cliente no pagó: el pedido no se entrega, se cancela, la comisión reservada vuelve al prepago
 * y el cliente queda con deuda (no puede pedir hasta resolverla). Quién absorbe la comida es
 * decisión de Richard: aquí queda registrado, no decidido.
 */
export async function clienteNoPago(
  db: D1Database,
  p: { pedidoId: string; repartidorId: string; motivo: string },
) {
  const f = await filaDirecta(db, p.pedidoId);
  if (!f || f.repartidor_id !== p.repartidorId || !esDirecto(f.metodo_pago))
    throw new ErrorDatos('Ese pedido no se cobra en mano.', undefined, 409);
  if (f.estado !== 'en_camino')
    throw new ErrorDatos('Confirma el cobro cuando estés con el cliente.', undefined, 409);
  const { pais, moneda } = await paisDeZona(db, f.zona_id);
  const r = await db
    .prepare(
      "UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now'), cobro_estado = 'no_pagado', monto_recibido = 0, cobro_confirmado_en = datetime('now'), cobro_nota = ?, conciliacion_estado = 'con_diferencia' WHERE id = ? AND estado = 'en_camino'",
    )
    .bind(p.motivo.slice(0, 300), p.pedidoId)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Este pedido ya cambió de estado.', undefined, 409);
  await liberarReserva(db, p.pedidoId, p.repartidorId, 'cliente_no_pago');
  await anotarLibro(db, {
    cuentaId: f.cliente_id,
    bolsillo: 'deuda_cliente',
    pais,
    moneda,
    monto: f.total - f.propina,
    concepto: 'cliente_no_pago',
    pedidoId: p.pedidoId,
    referencia: `deuda:${p.pedidoId}`,
    autorId: p.repartidorId,
  });
  await anotarEvento(db, p.pedidoId, 'cliente_no_pago', p.motivo);
}

/**
 * Conciliación de un pedido directo: corre cuando la entrega Y el cobro están cerrados. Cobra la
 * comisión reservada, anota la diferencia como deuda del cliente si pagó de menos, y deja el pago
 * al restaurante como hecho en el local por el repartidor (modelo aprobado). Idempotente.
 */
export async function conciliarPedidoDirecto(db: D1Database, pedidoId: string) {
  const f = await filaDirecta(db, pedidoId);
  if (!f || !esDirecto(f.metodo_pago) || f.conciliacion_estado !== 'pendiente') return null;
  if (
    f.estado !== 'entregado' ||
    !['confirmado', 'parcial', 'no_pagado'].includes(f.cobro_estado) ||
    !f.repartidor_id
  )
    return null;
  const { pais, moneda } = await paisDeZona(db, f.zona_id);
  const esperado = f.total - f.propina;
  const recibido = Number(f.monto_recibido ?? 0);
  const diferencia = esperado - recibido;
  const estado = diferencia > 0 ? 'con_diferencia' : 'conciliado';
  const r = await db
    .prepare(
      "UPDATE pedidos SET conciliacion_estado = ? WHERE id = ? AND conciliacion_estado = 'pendiente'",
    )
    .bind(estado, pedidoId)
    .run();
  if (!r.meta.changes) return null;
  await cobrarReserva(db, pedidoId, f.repartidor_id);
  if (diferencia > 0)
    await anotarLibro(db, {
      cuentaId: f.cliente_id,
      bolsillo: 'deuda_cliente',
      pais,
      moneda,
      monto: diferencia,
      concepto: 'pago_incompleto',
      pedidoId,
      referencia: `deuda:${pedidoId}`,
    });
  // Informativo: el restaurante recibió su parte en el local, de manos del repartidor.
  await anotarLibro(db, {
    cuentaId: `restaurante-de:${pedidoId}`,
    bolsillo: 'directo',
    pais,
    moneda,
    monto: f.pago_restaurante,
    concepto: 'pagado_en_local_por_repartidor',
    pedidoId,
    referencia: `local:${pedidoId}`,
  });
  await anotarEvento(db, pedidoId, 'conciliado', `${estado} · recibido ${recibido} de ${esperado}`);
  return estado;
}
