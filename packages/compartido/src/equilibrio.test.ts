import { describe, expect, it } from 'vitest';
import { CONFIG_DINERO_INICIAL, calcularPedido } from './bolsillos';
import { PLANES } from './catalogo';

/**
 * Candado C-EQUILIBRIO (13 oct 2026, decisión de Richard): desde el primer pedido, Tumbite no
 * pierde dinero en ningún pedido normal. Lo que le queda (comisión + servicio + cargo por pedido
 * pequeño − lo que completa del pago del repartidor) tiene que cubrir el cobro de la tarjeta de
 * Stripe: 2,9 % + 30 centavos (stripe.com/pricing, consultado el 13 oct 2026).
 */
const cobroTarjeta = (total: number) => Math.round(total * 0.029) + 30;

describe('punto de equilibrio en cada pedido', () => {
  it('ningún pedido de 10 a 150 dólares, a cualquier distancia, con cualquier propina, deja pérdida', () => {
    const peores: string[] = [];
    for (const plan of PLANES)
      for (let subtotal = 1000; subtotal <= 15000; subtotal += 250)
        for (const km of [0.5, 1, 2, 3, 4, 6, 8, 12])
          for (const propinaPct of [0, 10, 15, 20, 25, 30]) {
            const propina = Math.round((subtotal * propinaPct) / 100);
            const d = calcularPedido({
              lineas: [{ precioCentavos: subtotal, cantidad: 1 }],
              plan,
              propina,
              distanciaKm: km,
            });
            const neto = d.gananciaPlataforma - cobroTarjeta(d.totalCliente);
            if (neto < 0) peores.push(`${plan} ${subtotal / 100} ${km}km ${propinaPct}% → ${neto}`);
          }
    expect(peores.slice(0, 5), `${peores.length} pedidos con pérdida`).toEqual([]);
  });

  it('el regalo de cumpleaños que cubre todo el plato tampoco deja pérdida', () => {
    for (const plan of PLANES) {
      const d = calcularPedido({
        lineas: [{ precioCentavos: 300, cantidad: 1 }],
        plan,
        propina: 60,
        distanciaKm: 2,
        regalo: 300,
      });
      expect(d.gananciaPlataforma - cobroTarjeta(d.totalCliente)).toBeGreaterThanOrEqual(0);
    }
  });

  it('el valor de fábrica es el aprobado (envío desde 3,99 y servicio con mínimo de 1,99)', () => {
    expect(CONFIG_DINERO_INICIAL.envioBase).toBe(399);
    expect(CONFIG_DINERO_INICIAL.servicioMinimo).toBe(199);
  });
});
