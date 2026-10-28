import { type ServicioFinanciero, calcularComision } from '@tumbite/compartido';
import {
  CUENTA_TUMBITE,
  saldoLibro,
  sentenciaDescontar,
  sentenciaLibro,
} from '../internacional/libro';
import { saldoRetirable } from '../retiros';
import { politicaVigente } from './politicas';

/**
 * Divoox · Fase 4: modalidad PREPAGO de conductores, reutilizable por cualquier servicio
 * (C-FIN-CONDUCTOR). No se enchufa a Food (Food sigue con su cobro de siempre): queda lista para
 * que un servicio la use cuando su mercado la active.
 *
 * - Solo rige si hay una política del servicio y del mercado con la revisión legal y comercial
 *   APROBADA (sin eso, `politicaVigente` no la elige y no se cobra nada).
 * - Se cobra por operación realizada (nunca por ver pedidos), del bolsillo `prepago` del libro.
 * - El prepago está separado de las ganancias: las ganancias viven en `movimientos` (lo único que se
 *   puede retirar) y el prepago en el libro (nunca se retira como ganancia).
 */

export type ContextoConductor = {
  servicio: ServicioFinanciero;
  pais: string;
  ciudad?: string | null;
  moneda: string;
};

/** Cuánto cobraría Divoox por una operación de `valor` (0 si no hay política que rija). */
export async function comisionConductor(
  db: D1Database,
  c: ContextoConductor & { valor: number },
): Promise<{ politicaId: string; monto: number } | null> {
  const pol = await politicaVigente(db, {
    servicio: c.servicio,
    tipoCuenta: 'conductor',
    pais: c.pais,
    ciudad: c.ciudad ?? null,
    moneda: c.moneda,
  });
  if (!pol || pol.modalidad !== 'prepago') return null;
  return {
    politicaId: pol.id,
    monto: calcularComision(pol.regla, {
      unidades: 1,
      valor: c.valor,
      descuentoPb: pol.descuentoPb,
    }),
  };
}

/**
 * Cobra la comisión de UNA operación al prepago del conductor: solo si alcanza (nunca negativo) y una
 * sola vez por operación (referencia única). Devuelve si se cobró y cuánto.
 */
export async function cobrarComisionConductor(
  db: D1Database,
  p: ContextoConductor & { conductorId: string; operacionRef: string; valor: number },
): Promise<{
  cobrado: boolean;
  monto: number;
  motivo?: 'sin_politica' | 'saldo_insuficiente' | 'ya_cobrada';
}> {
  const ref = `comision_conductor:${p.servicio}:${p.operacionRef}`;
  const ya = await db
    .prepare('SELECT 1 FROM libro WHERE referencia = ?')
    .bind(`${ref}:prepago`)
    .first();
  const c = await comisionConductor(db, p);
  if (!c || c.monto <= 0) return { cobrado: false, monto: 0, motivo: 'sin_politica' };
  if (ya) return { cobrado: true, monto: c.monto, motivo: 'ya_cobrada' };
  await db.batch([
    sentenciaDescontar(db, {
      cuentaId: p.conductorId,
      bolsillo: 'prepago',
      pais: p.pais,
      moneda: p.moneda,
      monto: c.monto,
      concepto: `comision_conductor:${p.servicio}`,
      referencia: `${ref}:prepago`,
    }),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
         SELECT ?, ?, 'comisiones', ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM libro WHERE referencia = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        CUENTA_TUMBITE,
        p.pais,
        p.moneda,
        c.monto,
        `comision_conductor:${p.servicio}`,
        `${ref}:divoox`,
        `${ref}:prepago`,
      ),
  ]);
  const ok = await db
    .prepare('SELECT 1 FROM libro WHERE referencia = ?')
    .bind(`${ref}:prepago`)
    .first();
  return ok
    ? { cobrado: true, monto: c.monto }
    : { cobrado: false, monto: c.monto, motivo: 'saldo_insuficiente' };
}

/** Los saldos del conductor, SEPARADOS: lo que paga comisiones y lo que puede retirar. */
export async function saldosConductor(
  db: D1Database,
  conductorId: string,
  pais: string,
  moneda: string,
) {
  const [prepago, reservado, retirable, ganado] = await Promise.all([
    saldoLibro(db, conductorId, 'prepago', pais, moneda),
    saldoLibro(db, conductorId, 'reservado', pais, moneda),
    saldoRetirable(db, conductorId),
    db
      .prepare('SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos WHERE usuario_id = ?')
      .bind(conductorId)
      .first<{ s: number }>(),
  ]);
  return {
    /** Para pagar comisiones de Divoox; no se retira. */
    prepago,
    /** Comisión apartada de operaciones en curso. */
    reservado,
    /** Ganancias que ya se pueden retirar. */
    gananciasDisponibles: retirable,
    /** Ganancias de operaciones cuyo cobro todavía no se confirmó. */
    gananciasPendientes: Math.max(0, Number(ganado?.s ?? 0) - retirable),
  };
}

export { sentenciaLibro };

/*
 * Divoox Moto · M7 (C-VIAJE-COMISION): la comisión de un VIAJE se aparta del prepago al aceptar,
 * se cobra al terminar y se devuelve si el viaje no se hace (cancelado, soltado, sin señal, no se
 * presentó). Igual que Food en cobro directo, pero por referencia (un viaje no es un pedido, y
 * `libro.pedido_id` apunta a pedidos). Cada pata lleva su referencia única: repetir no duplica.
 */
const refReserva = (op: string, c: string) => `reserva_viaje:${op}:${c}`;

/** Lo que el conductor tiene apartado para ese viaje (0 si nada, o si ya se cobró o se devolvió). */
export async function reservaDeViaje(db: D1Database, operacionId: string, conductorId: string) {
  const r = refReserva(operacionId, conductorId);
  const f = await db
    .prepare(
      `SELECT COALESCE(SUM(monto), 0) AS monto, MAX(pais) AS pais, MAX(moneda) AS moneda FROM libro
        WHERE cuenta_id = ? AND bolsillo = 'reservado' AND referencia IN (?, ?, ?)`,
    )
    .bind(conductorId, `${r}:reservado`, `${r}:devuelta:reservado`, `${r}:cobrada:reservado`)
    .first<{ monto: number; pais: string | null; moneda: string | null }>();
  return { monto: Number(f?.monto ?? 0), pais: f?.pais ?? 'US', moneda: f?.moneda ?? 'USD' };
}

/**
 * Aparta la comisión prevista del viaje si una política de prepago rige en ese mercado. Devuelve
 * `false` solo si rige y el saldo no alcanza (el conductor no puede aceptar). Sin política, `true`.
 */
export async function reservarComisionViaje(
  db: D1Database,
  p: ContextoConductor & { operacionId: string; conductorId: string; valor: number },
): Promise<{ ok: boolean; monto: number }> {
  const c = await comisionConductor(db, p);
  if (!c || c.monto <= 0) return { ok: true, monto: 0 };
  const r = refReserva(p.operacionId, p.conductorId);
  if ((await reservaDeViaje(db, p.operacionId, p.conductorId)).monto > 0)
    return { ok: true, monto: c.monto };
  await db.batch([
    sentenciaDescontar(db, {
      cuentaId: p.conductorId,
      bolsillo: 'prepago',
      pais: p.pais,
      moneda: p.moneda,
      monto: c.monto,
      concepto: `reserva_viaje:${p.servicio}`,
      referencia: `${r}:prepago`,
    }),
    db
      .prepare(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
         SELECT ?, ?, 'reservado', ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM libro WHERE referencia = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        p.conductorId,
        p.pais,
        p.moneda,
        c.monto,
        `reserva_viaje:${p.servicio}`,
        `${r}:reservado`,
        `${r}:prepago`,
      ),
  ]);
  const ok = Boolean(
    await db.prepare('SELECT 1 FROM libro WHERE referencia = ?').bind(`${r}:reservado`).first(),
  );
  return { ok, monto: c.monto };
}

/** Devuelve al prepago lo apartado (el viaje no se hizo). Idempotente. */
export async function devolverReservaViaje(
  db: D1Database,
  operacionId: string,
  conductorId: string,
  motivo: string,
): Promise<number> {
  const v = await reservaDeViaje(db, operacionId, conductorId);
  if (v.monto <= 0) return 0;
  const r = refReserva(operacionId, conductorId);
  await db.batch([
    sentenciaLibro(db, {
      cuentaId: conductorId,
      bolsillo: 'reservado',
      pais: v.pais,
      moneda: v.moneda,
      monto: -v.monto,
      concepto: `devolucion_viaje:${motivo}`,
      referencia: `${r}:devuelta:reservado`,
    }),
    sentenciaLibro(db, {
      cuentaId: conductorId,
      bolsillo: 'prepago',
      pais: v.pais,
      moneda: v.moneda,
      monto: v.monto,
      concepto: `devolucion_viaje:${motivo}`,
      referencia: `${r}:devuelta:prepago`,
    }),
  ]);
  return v.monto;
}

/** Devuelve lo apartado por CUALQUIER conductor para ese viaje (cancelado, sin conductor…). */
export async function devolverReservasViaje(db: D1Database, operacionId: string, motivo: string) {
  const { results } = await db
    .prepare(
      "SELECT DISTINCT cuenta_id FROM libro WHERE bolsillo = 'reservado' AND referencia LIKE ?",
    )
    .bind(`reserva_viaje:${operacionId}:%:reservado`)
    .all<{ cuenta_id: string }>();
  for (const f of results) await devolverReservaViaje(db, operacionId, f.cuenta_id, motivo);
}

/** Lo apartado se vuelve comisión de Divoox: el viaje se hizo. Idempotente. */
export async function cobrarReservaViaje(
  db: D1Database,
  operacionId: string,
  conductorId: string,
): Promise<number> {
  const v = await reservaDeViaje(db, operacionId, conductorId);
  if (v.monto <= 0) return 0;
  const r = refReserva(operacionId, conductorId);
  await db.batch([
    sentenciaLibro(db, {
      cuentaId: conductorId,
      bolsillo: 'reservado',
      pais: v.pais,
      moneda: v.moneda,
      monto: -v.monto,
      concepto: 'comision_viaje',
      referencia: `${r}:cobrada:reservado`,
    }),
    sentenciaLibro(db, {
      cuentaId: CUENTA_TUMBITE,
      bolsillo: 'comisiones',
      pais: v.pais,
      moneda: v.moneda,
      monto: v.monto,
      concepto: 'comision_viaje',
      referencia: `${r}:cobrada:divoox`,
    }),
  ]);
  return v.monto;
}
