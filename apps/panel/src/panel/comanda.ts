import { type PedidoComanda, htmlComanda } from '@tumbite/compartido';

/**
 * C-COMANDA: la comanda del panel usa la pieza compartida (`packages/compartido/src/comanda.ts`,
 * la misma de la app del restaurante, C-COMANDA-APP) con la impresión del navegador en 80 mm.
 */
export { htmlComanda, type PedidoComanda };

/** Abre la comanda en una ventana y lanza la impresión. */
export function imprimirComanda(p: PedidoComanda, restaurante: string, idioma: 'es' | 'en') {
  const v = window.open('', '_blank', 'width=360,height=600');
  if (!v) return false;
  v.document.open();
  v.document.write(htmlComanda(p, restaurante, idioma, new Date(), { imprimirAlAbrir: true }));
  v.document.close();
  return true;
}
