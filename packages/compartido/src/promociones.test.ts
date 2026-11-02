import { describe, expect, it } from 'vitest';
import { calcularPedido } from './bolsillos';
import { PLANES } from './catalogo';
import {
  basePromocion,
  calcularConPromocion,
  descuentoPromocion,
  insigniaPromocion,
  mejorPromocion,
} from './promociones';

/**
 * C-PROMO-RESTAURANTE (BRE-5): la promoción del restaurante sale de SU pago. Divoox no pone dinero,
 * el repartidor cobra igual y el pedido sigue cuadrando al centavo.
 */
const base = {
  lineas: [{ precioCentavos: 1500, cantidad: 2 }],
  plan: 'inicial' as const,
  propina: 300,
  distanciaKm: 2,
};
const cuadra = (d: ReturnType<typeof calcularPedido>) =>
  d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma + d.impuesto;

describe('promociones del restaurante (C-PROMO-RESTAURANTE)', () => {
  it('el descuento sale del restaurante: Divoox y el repartidor quedan igual y el pedido cuadra', () => {
    const sin = calcularPedido(base);
    const con = calcularPedido({ ...base, descuentoRestaurante: 500 });
    expect(con.descuentoRestaurante).toBe(500);
    expect(con.totalCliente).toBe(sin.totalCliente - 500);
    expect(con.pagoRestaurante).toBe(sin.pagoRestaurante - 500);
    expect(con.gananciaPlataforma).toBe(sin.gananciaPlataforma);
    expect(con.pagoRepartidor).toBe(sin.pagoRepartidor);
    expect(con.comisionRestaurante).toBe(sin.comisionRestaurante);
    expect(cuadra(con)).toBe(con.totalCliente);
  });

  it('nunca deja el pago del restaurante en negativo, ni toca la propina de la recogida', () => {
    for (const plan of PLANES)
      for (const recogida of [false, true]) {
        const d = calcularPedido({ ...base, plan, recogida, descuentoRestaurante: 1_000_000 });
        expect(d.pagoRestaurante).toBe(recogida ? base.propina : 0);
        expect(d.totalCliente).toBeGreaterThanOrEqual(base.propina);
        expect(cuadra(d)).toBe(d.totalCliente);
      }
  });

  it('con cupón de Divoox y promoción a la vez, el total nunca baja de la propina', () => {
    const d = calcularPedido({ ...base, descuento: 4000, descuentoRestaurante: 4000 });
    expect(d.totalCliente).toBe(base.propina);
    expect(cuadra(d)).toBe(d.totalCliente);
  });

  it('los tres tipos: porcentaje con tope, envío gratis y gasta X ahorra Y, con su mínimo', () => {
    const d = { subtotal: 3000, envio: 399 };
    const p = { id: 'x', minimoSubtotal: 0, topeCentavos: 0 };
    expect(descuentoPromocion({ ...p, tipo: 'porcentaje', valor: 2000 }, d)).toBe(600);
    expect(
      descuentoPromocion({ ...p, tipo: 'porcentaje', valor: 2000, topeCentavos: 400 }, d),
    ).toBe(400);
    expect(descuentoPromocion({ ...p, tipo: 'envio_gratis', valor: 0 }, d)).toBe(399);
    expect(
      descuentoPromocion({ ...p, tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 2500 }, d),
    ).toBe(500);
    expect(
      descuentoPromocion({ ...p, tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 3500 }, d),
    ).toBe(0);
    expect(descuentoPromocion({ ...p, tipo: 'porcentaje', valor: 50000 }, d)).toBe(3000);
  });

  it('calcularConPromocion: sin promoción es el pedido de siempre; con envío gratis lo paga el restaurante', () => {
    expect(calcularConPromocion(base, null)).toEqual(calcularPedido(base));
    const d = calcularConPromocion(base, {
      id: 'p',
      tipo: 'envio_gratis',
      valor: 0,
      minimoSubtotal: 0,
      topeCentavos: 0,
    });
    expect(d.descuentoRestaurante).toBe(d.envio);
    expect(d.pagoRepartidor).toBe(calcularPedido(base).pagoRepartidor);
    expect(
      calcularConPromocion(base, {
        id: 'p',
        tipo: 'gasta_ahorra',
        valor: 500,
        minimoSubtotal: 9000,
        topeCentavos: 0,
      }),
    ).toEqual(calcularPedido(base));
  });

  it('la insignia en los dos idiomas', () => {
    const pct = { tipo: 'porcentaje' as const, valor: 1500, minimoSubtotal: 0 };
    expect(insigniaPromocion(pct, 'USD', 'es')).toBe('15 % de descuento');
    expect(insigniaPromocion(pct, 'USD', 'en')).toBe('15% off');
    expect(insigniaPromocion({ ...pct, minimoSubtotal: 2000 }, 'USD', 'en')).toMatch(
      /^15% off on \$20/,
    );
    expect(insigniaPromocion({ ...pct, minimoSubtotal: 2000 }, 'USD', 'es')).toMatch(/desde/);
    expect(
      insigniaPromocion({ tipo: 'envio_gratis', valor: 0, minimoSubtotal: 0 }, 'USD', 'es'),
    ).toBe('Envío gratis');
    expect(
      insigniaPromocion({ tipo: 'envio_gratis', valor: 0, minimoSubtotal: 1500 }, 'USD', 'en'),
    ).toMatch(/^Free delivery on/);
    expect(
      insigniaPromocion({ tipo: 'envio_gratis', valor: 0, minimoSubtotal: 1500 }, 'USD', 'es'),
    ).toMatch(/^Envío gratis desde/);
    expect(
      insigniaPromocion({ tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 2500 }, 'USD', 'es'),
    ).toMatch(/^Gasta .* y ahorra/);
    expect(
      insigniaPromocion({ tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 2500 }, 'USD', 'en'),
    ).toMatch(/^Spend .*, save/);
  });
});

describe('BRE-R2: la base de la promoción', () => {
  const pct = {
    id: 'p',
    tipo: 'porcentaje' as const,
    valor: 1000,
    minimoSubtotal: 2500,
    topeCentavos: 0,
  };
  it('el porcentaje y el mínimo cuentan sin el plato que regala el restaurante', () => {
    // 30 de comida con 10 regalados: 20 que paga el cliente, no llega al mínimo de 25.
    expect(calcularConPromocion({ ...base, regalo: 1000 }, pct).descuentoRestaurante).toBe(0);
    expect(calcularConPromocion({ ...base, regalo: 400 }, pct).descuentoRestaurante).toBe(260);
    expect(mejorPromocion([pct], { subtotal: 3000, envio: 399 }, { regalo: 1000 })).toBeNull();
  });
  it('el envío ya cubierto no lo paga otra vez «envío gratis»; en un recálculo se ignora el mínimo', () => {
    const envio = {
      id: 'e',
      tipo: 'envio_gratis' as const,
      valor: 0,
      minimoSubtotal: 0,
      topeCentavos: 0,
    };
    const d = calcularPedido(base);
    expect(calcularConPromocion(base, envio, { envioCubierto: d.envio }).descuentoRestaurante).toBe(
      0,
    );
    expect(basePromocion(d, 0, d.envio + 50)).toEqual({ subtotal: d.subtotal, envio: 0 });
    const chico = { ...base, lineas: [{ precioCentavos: 2000, cantidad: 1 }] };
    expect(calcularConPromocion(chico, pct).descuentoRestaurante).toBe(0);
    expect(calcularConPromocion(chico, pct, { sinMinimo: true }).descuentoRestaurante).toBe(200);
  });
});
