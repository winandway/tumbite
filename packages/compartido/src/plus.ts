/**
 * C-PLUS (R-T3, 1 nov 2026, como DashPass de DoorDash; evidencia REA ev_2ea6a124…, ayuda pública de
 * DashPass): con la suscripción, envío en cero y cargo de servicio reducido en los pedidos que
 * llegan al mínimo. Lo absorbe Divoox como un descuento: el restaurante y el repartidor cobran
 * igual. La app y el servidor usan ESTA misma cuenta para que el total coincida.
 */
export type AjustesPlus = {
  /** Cuota mensual en centavos de dólar. En cero, Divoox Plus está apagado. */
  centavosMes: number;
  /** Subtotal mínimo del pedido para el beneficio (DashPass: el mínimo del comercio). */
  minimoSubtotal: number;
  /** Cuánto baja el cargo de servicio, en porcentaje. */
  servicioDescuentoPct: number;
};
export const PLUS_INICIAL: AjustesPlus = {
  centavosMes: 0,
  minimoSubtotal: 1200,
  servicioDescuentoPct: 50,
};

/** Lo que Divoox Plus le descuenta a este pedido (0 si no aplica). */
export function descuentoPlus(
  d: { subtotal: number; envio: number; servicio: number },
  a: Pick<AjustesPlus, 'minimoSubtotal' | 'servicioDescuentoPct'>,
): number {
  if (d.subtotal < a.minimoSubtotal) return 0;
  const pct = Math.min(100, Math.max(0, a.servicioDescuentoPct));
  return d.envio + Math.round((d.servicio * pct) / 100);
}

/**
 * C-ENVIO-UNA-VEZ (BRE-R3b): lo que descuenta un cupón cuando también aplica Plus. Plus ya deja
 * el envío en cero, así que un cupón de envío gratis no suma nada (si no, el envío se descontaría
 * dos veces); los demás cupones descuentan lo de siempre. La app del cliente y el servidor usan
 * esta misma regla.
 */
export function cuponConPlus(
  cupon: { tipo?: string; descuento: number } | null | undefined,
  plusAplica: boolean,
): number {
  if (!cupon) return 0;
  return plusAplica && cupon.tipo === 'envio_gratis' ? 0 : cupon.descuento;
}
