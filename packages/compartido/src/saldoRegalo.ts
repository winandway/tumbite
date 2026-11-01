/**
 * C-TARJETAS-REGALO: cuánto saldo de regalo se usa en un pedido. Cubre la comida, el envío, el
 * servicio y el impuesto (nunca la propina, que es del repartidor) y deja al menos 50 centavos a
 * cobrar con tarjeta, el mínimo de Stripe. La app y el servidor usan esta misma cuenta.
 */
export const MINIMO_COBRO_TARJETA = 50;

export function saldoAplicable(
  d: { totalCliente: number; propina: number },
  saldo: number,
): number {
  const sinPropina = Math.max(0, d.totalCliente - d.propina);
  const debeQuedar = Math.max(0, MINIMO_COBRO_TARJETA - d.propina);
  return Math.max(0, Math.min(Math.max(0, saldo), sinPropina - debeQuedar));
}
