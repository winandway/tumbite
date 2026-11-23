import { type QuienPaga, esQuienPaga, repartirComision } from '@tumbite/compartido';
import { comisionConductor, servicioFinancieroViaje } from './conductor';

/**
 * C-QUIEN-PAGA-VIAJES (23 nov 2026): la palanca de quién paga la comisión de Divoox en los viajes.
 * La ciudad manda sobre el país; sin fila, «conductor» (lo de siempre).
 */
export async function quienPagaViaje(
  db: D1Database,
  pais: string,
  ciudad: string | null,
): Promise<QuienPaga> {
  const f = await db
    .prepare(
      `SELECT valor FROM quien_paga_viajes WHERE pais = ?1 AND ciudad IN ('', ?2)
        ORDER BY ciudad = '' LIMIT 1`,
    )
    .bind(pais, ciudad ?? '')
    .first<{ valor: string }>();
  return esQuienPaga(f?.valor) ? f.valor : 'conductor';
}

export type TarifaServicioViaje = {
  quienPaga: QuienPaga;
  /** La comisión entera de Divoox sobre el precio del viaje (0 donde no rige el prepago). */
  comision: number;
  /** Lo que se le suma al pasajero, en una línea aparte. */
  tarifaServicio: number;
};

/**
 * La tarifa de servicio de un viaje de precio `precio` (sin la tarifa). Solo hay tarifa donde rige
 * una política de comisión en prepago (Venezuela hoy); en EE. UU. (Stripe Connect) siempre es 0.
 */
export async function tarifaServicioViaje(
  db: D1Database,
  p: {
    servicioId: string;
    pais: string;
    ciudad: string;
    moneda: string;
    precio: number;
    quienPaga: QuienPaga;
  },
): Promise<TarifaServicioViaje> {
  if (p.quienPaga === 'conductor' || p.precio <= 0)
    return { quienPaga: p.quienPaga, comision: 0, tarifaServicio: 0 };
  const c = await comisionConductor(db, {
    servicio: servicioFinancieroViaje(p.servicioId),
    pais: p.pais,
    ciudad: p.ciudad,
    moneda: p.moneda,
    valor: p.precio,
  });
  const comision = c?.monto ?? 0;
  return {
    quienPaga: p.quienPaga,
    comision,
    tarifaServicio: repartirComision(comision, p.quienPaga).tarifaServicio,
  };
}

/**
 * La tarifa de servicio que quedó guardada en la cotización de un viaje (0 en los viajes de antes de
 * la palanca). El precio del viaje, sobre el que se calcula la comisión, es `q.total` menos esto.
 */
export const SQL_TARIFA_SERVICIO =
  "COALESCE(CAST(json_extract(q.desglose_json, '$.tarifaServicio') AS INTEGER), 0)";
export const SQL_QUIEN_PAGA = "COALESCE(json_extract(q.desglose_json, '$.quienPaga'), 'conductor')";

/** Lo de la cotización de un viaje: su tarifa de servicio y quién paga (para el libro y las apps). */
export async function tarifaDeOperacion(
  db: D1Database,
  operacionId: string,
): Promise<{ tarifaServicio: number; quienPaga: QuienPaga }> {
  const f = await db
    .prepare(
      `SELECT ${SQL_TARIFA_SERVICIO} AS t, ${SQL_QUIEN_PAGA} AS q
         FROM viajes v JOIN cotizaciones_viaje q ON q.id = v.cotizacion_id WHERE v.operacion_id = ?`,
    )
    .bind(operacionId)
    .first<{ t: number; q: string }>();
  return {
    tarifaServicio: Math.max(0, Number(f?.t ?? 0)),
    quienPaga: esQuienPaga(f?.q) ? f.q : 'conductor',
  };
}
