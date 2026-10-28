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
