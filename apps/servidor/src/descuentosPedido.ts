import {
  type Desglose,
  type PromocionRestaurante,
  type calcularPedido,
  calcularConPromocion,
  descuentoPlus,
  porcentajeDe,
  saldoAplicable,
} from '@tumbite/compartido';
import { leerPlus } from './plus';

/**
 * C-DESCUENTOS-RECALCULO (BRE-5c, 2 nov 2026). Cuando un pedido ya creado se vuelve a calcular
 * (plato agotado que se quita o reemplaza, cambio de dirección), conserva los descuentos con que
 * se cobró: el cupón, Divoox Plus y el saldo de regalo. Antes se recalculaba sin ellos: el total
 * del cliente subía por el valor del cupón y la ganancia de Divoox guardada dejaba de cuadrar.
 *
 * Cada parte sigue a su regla, igual que al pedir:
 * - cupón de monto: el mismo monto; de porcentaje: sobre el subtotal nuevo; de envío gratis: el
 *   envío nuevo (lo absorbe Divoox).
 * - Divoox Plus: envío nuevo + la parte del servicio, sin volver a exigir el mínimo (ya se ganó).
 * - saldo de regalo: el mismo apartado, salvo que el total nuevo no lo admita (se devuelve la
 *   diferencia al saldo).
 * La promoción del restaurante sigue con su propia copia (C-PROMO-RESTAURANTE). Todos los países.
 */
export type DescuentosRecalculados = {
  desglose: Desglose;
  cupon: number;
  plus: number;
  regalo: number;
};

type Guardados = {
  plus: number | null;
  regalo: number | null;
  tipo: string | null;
  valor: number | null;
};

export async function recalcularConDescuentos(
  db: D1Database,
  pedido: { id: string; cupon: unknown; descuento: unknown },
  p: Parameters<typeof calcularPedido>[0],
  promo: PromocionRestaurante | null | undefined,
): Promise<DescuentosRecalculados> {
  const g = await db
    .prepare(
      `SELECT (SELECT descuento FROM pedidos_plus WHERE pedido_id = ?1) AS plus,
        (SELECT centavos FROM pedidos_saldo_regalo WHERE pedido_id = ?1) AS regalo,
        (SELECT tipo FROM cupones WHERE codigo = ?2) AS tipo,
        (SELECT valor FROM cupones WHERE codigo = ?2) AS valor`,
    )
    .bind(pedido.id, pedido.cupon ? String(pedido.cupon) : '')
    .first<Guardados>();
  const plusAntes = Math.max(0, Number(g?.plus ?? 0));
  const regaloAntes = Math.max(0, Number(g?.regalo ?? 0));
  const cuponAntes = Math.max(0, Number(pedido.descuento ?? 0) - plusAntes - regaloAntes);
  const base = calcularConPromocion(p, promo);
  const cupon = !pedido.cupon
    ? cuponAntes
    : g?.tipo === 'envio_gratis'
      ? base.envio
      : g?.tipo === 'porcentaje'
        ? porcentajeDe(base.subtotal, Number(g.valor ?? 0))
        : cuponAntes;
  const plus = plusAntes
    ? descuentoPlus(base, {
        minimoSubtotal: 0,
        servicioDescuentoPct: (await leerPlus(db)).servicioDescuentoPct,
      })
    : 0;
  const sinRegalo = calcularConPromocion({ ...p, descuento: cupon + plus }, promo);
  const regalo = regaloAntes ? saldoAplicable(sinRegalo, regaloAntes) : 0;
  const desglose = regalo
    ? calcularConPromocion({ ...p, descuento: cupon + plus + regalo }, promo)
    : sinRegalo;
  return { desglose, cupon, plus, regalo };
}

/** Las filas al lado del pedido que guardan cada descuento, al día con el recálculo. */
export function guardarDescuentos(
  db: D1Database,
  pedidoId: string,
  r: DescuentosRecalculados,
): D1PreparedStatement[] {
  return [
    db.prepare('UPDATE pedidos_plus SET descuento = ? WHERE pedido_id = ?').bind(r.plus, pedidoId),
    db
      .prepare('UPDATE pedidos_saldo_regalo SET centavos = ? WHERE pedido_id = ?')
      .bind(r.regalo, pedidoId),
    // Como al pedir: el uso del cupón guarda el descuento total del pedido.
    db
      .prepare('UPDATE usos_cupon SET descuento = ? WHERE pedido_id = ?')
      .bind(r.desglose.descuento, pedidoId),
  ];
}
