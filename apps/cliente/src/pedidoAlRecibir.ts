/**
 * C-PAGO-AL-RECIBIR-TEXTO (18 nov 2026, todos los países): con pago al recibir (efectivo o
 * transferencia al repartidor) el estado «pagado» del pedido solo significa que se envió; todavía no
 * se pagó nada. Devuelve el texto propio, o null para seguir con el texto de siempre.
 */
const TEXTOS = {
  es: {
    restaurante: 'Pedido enviado. Esperando que el restaurante lo acepte.',
    tienda: 'Pedido enviado. Esperando que la tienda lo acepte.',
  },
  en: {
    restaurante: 'Order sent. Waiting for the restaurant to accept.',
    tienda: 'Order sent. Waiting for the store to accept.',
  },
};

export function textoPedidoSinCobrar(
  estado: string,
  metodoPago: string | undefined,
  esTienda: boolean,
  idioma: 'es' | 'en',
): string | null {
  if (estado !== 'pagado' || !metodoPago || metodoPago === 'tarjeta') return null;
  const t = idioma === 'en' ? TEXTOS.en : TEXTOS.es;
  return esTienda ? t.tienda : t.restaurante;
}
