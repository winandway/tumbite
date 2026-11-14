/** Tipo de entrega que ve el cliente en el detalle del pedido (C-ENTREGA-REAL):
 *  si ya se entregó, manda cómo se entregó de verdad; si no, lo que pidió. */
export function entregaMostrada(
  pedida: 'puerta' | 'mano' | 'recoger' | undefined | null,
  entregadoComo: 'puerta' | 'mano' | 'seguro' | 'ausente' | undefined | null,
): 'puerta' | 'mano' | 'recoger' | null {
  if (entregadoComo === 'mano') return 'mano';
  if (entregadoComo === 'puerta' || entregadoComo === 'seguro') return 'puerta';
  // C-CLIENTE-AUSENTE: no se entregó; se muestra lo que había pedido.
  return pedida ?? null;
}
