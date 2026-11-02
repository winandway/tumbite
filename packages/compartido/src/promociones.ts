import { calcularPedido, type Desglose } from './bolsillos';
import { type Centavos, formatearMonto, porcentajeDe } from './dinero';
import type { Idioma } from './idiomas';

/**
 * C-PROMO-RESTAURANTE (BRE-5, 2 nov 2026), como «Promotions» de DoorDash Merchant (REA de su página
 * pública para comercios): el restaurante arma su propia promoción y la paga él. Tres tipos, los
 * mismos que muestra DoorDash: descuento en porcentaje, envío gratis y «gasta X y ahorra Y». Se
 * aplica sola (sin código) y sale de su liquidación; Divoox no pone dinero. Todos los países.
 */
export type TipoPromocion = 'porcentaje' | 'envio_gratis' | 'gasta_ahorra';
export const TIPOS_PROMOCION: readonly TipoPromocion[] = [
  'porcentaje',
  'envio_gratis',
  'gasta_ahorra',
];

export type PromocionRestaurante = {
  id: string;
  tipo: TipoPromocion;
  /** porcentaje: puntos básicos (1000 = 10 %); gasta_ahorra: centavos que ahorra; envío: 0. */
  valor: number;
  /** Mínimo de comida para que valga (en «gasta X y ahorra Y», la X). */
  minimoSubtotal: Centavos;
  /** Tope de lo que descuenta un porcentaje en un pedido (0 = sin tope). */
  topeCentavos: Centavos;
};

/** Lo que descuenta la promoción en este pedido (antes de los topes de `calcularPedido`). */
export function descuentoPromocion(
  promo: PromocionRestaurante,
  d: Pick<Desglose, 'subtotal' | 'envio'>,
): Centavos {
  if (d.subtotal < promo.minimoSubtotal) return 0;
  if (promo.tipo === 'envio_gratis') return d.envio;
  if (promo.tipo === 'gasta_ahorra') return Math.max(0, promo.valor);
  const pct = porcentajeDe(d.subtotal, Math.min(10000, Math.max(0, promo.valor)));
  return promo.topeCentavos > 0 ? Math.min(pct, promo.topeCentavos) : pct;
}

/**
 * Lo que ya cubrió otro descuento antes de la promoción, y si se respeta el mínimo.
 * - `envioCubierto` (BRE-R2): el envío que ya absorbe Divoox Plus o un cupón de envío gratis. La
 *   promoción «envío gratis» solo descuenta lo que queda del envío: nunca lo paga dos veces.
 * - `sinMinimo` (BRE-R2): en un recálculo (plato agotado) la promoción ya aplicada se mantiene
 *   aunque el subtotal baje de su mínimo, como los grandes: un recálculo nunca sube el total.
 */
export type OpcionesPromocion = { envioCubierto?: Centavos; sinMinimo?: boolean };

/**
 * La base sobre la que cuenta la promoción: la comida que paga el cliente (sin el plato regalado
 * por el restaurante) y el envío que todavía no cubrió otro descuento.
 */
export function basePromocion(
  d: Pick<Desglose, 'subtotal' | 'envio'>,
  regalo: Centavos = 0,
  envioCubierto: Centavos = 0,
): Pick<Desglose, 'subtotal' | 'envio'> {
  return {
    subtotal: Math.max(0, d.subtotal - Math.max(0, regalo)),
    envio: Math.max(0, d.envio - Math.max(0, envioCubierto)),
  };
}

/**
 * La misma cuenta en el servidor y en la app: primero el pedido sin la promoción, después con lo
 * que descuenta. Si no hay promoción, devuelve el pedido tal cual.
 */
export function calcularConPromocion(
  p: Parameters<typeof calcularPedido>[0],
  promo: PromocionRestaurante | null | undefined,
  op: OpcionesPromocion = {},
): Desglose {
  const sin = calcularPedido(p);
  if (!promo) return sin;
  const regla = op.sinMinimo ? { ...promo, minimoSubtotal: 0 } : promo;
  const descuentoRestaurante = descuentoPromocion(
    regla,
    basePromocion(sin, p.regalo, op.envioCubierto),
  );
  return descuentoRestaurante ? calcularPedido({ ...p, descuentoRestaurante }) : sin;
}

/** La insignia que ve el cliente en la lista, la ficha y el carrito. */
export function insigniaPromocion(
  promo: Pick<PromocionRestaurante, 'tipo' | 'valor' | 'minimoSubtotal'>,
  moneda: string,
  idioma: Idioma,
): string {
  const m = (c: number) => formatearMonto(c, moneda, idioma);
  const minimo = promo.minimoSubtotal > 0;
  if (idioma === 'en') {
    if (promo.tipo === 'envio_gratis')
      return minimo ? `Free delivery on ${m(promo.minimoSubtotal)}+` : 'Free delivery';
    if (promo.tipo === 'gasta_ahorra')
      return `Spend ${m(promo.minimoSubtotal)}, save ${m(promo.valor)}`;
    const pct = `${promo.valor / 100}% off`;
    return minimo ? `${pct} on ${m(promo.minimoSubtotal)}+` : pct;
  }
  if (promo.tipo === 'envio_gratis')
    return minimo ? `Envío gratis desde ${m(promo.minimoSubtotal)}` : 'Envío gratis';
  if (promo.tipo === 'gasta_ahorra')
    return `Gasta ${m(promo.minimoSubtotal)} y ahorra ${m(promo.valor)}`;
  const pct = `${promo.valor / 100} % de descuento`;
  return minimo ? `${pct} desde ${m(promo.minimoSubtotal)}` : pct;
}

/** De las vigentes, la que más le ahorra al cliente en este pedido (o null si ninguna aplica). */
export function mejorPromocion(
  lista: readonly PromocionRestaurante[] | null | undefined,
  d: Pick<Desglose, 'subtotal' | 'envio'>,
  op: { regalo?: Centavos; envioCubierto?: Centavos } = {},
): PromocionRestaurante | null {
  let mejor: PromocionRestaurante | null = null;
  let ahorro = 0;
  const b = basePromocion(d, op.regalo, op.envioCubierto);
  for (const p of lista ?? []) {
    const a = descuentoPromocion(p, b);
    if (a > ahorro) {
      mejor = p;
      ahorro = a;
    }
  }
  return mejor;
}
