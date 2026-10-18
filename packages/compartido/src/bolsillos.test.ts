import { describe, expect, it } from 'vitest';
import { CONFIG_DINERO_INICIAL, calcularEnvio, calcularPedido } from './bolsillos';

describe('los cuatro bolsillos', () => {
  it('el ejemplo del documento: pedido de 30 dólares, plan Inicial, propina de 4', () => {
    const d = calcularPedido({
      lineas: [{ precioCentavos: 1500, cantidad: 2 }],
      plan: 'inicial',
      propina: 400,
      distanciaKm: 2,
    });
    expect(d.subtotal).toBe(3000);
    expect(d.comisionRestaurante).toBe(225);
    expect(d.pagoRestaurante).toBe(2775);
    // Servicio: el 5 % (1,50) no llega al mínimo de 1,99 (precios del 13 oct 2026, C-EQUILIBRIO).
    expect(d.servicio).toBe(199);
    expect(d.envio).toBe(399);
    expect(d.totalCliente).toBe(3000 + 399 + 199 + 400);
    // El repartidor cobra su mínimo + la propina entera.
    expect(d.pagoRepartidor).toBe(500 + 400);
    expect(d.complementoRepartidor).toBe(101);
  });

  it('todo el dinero cuadra: lo que paga el cliente = restaurante + repartidor + plataforma', () => {
    for (const plan of ['inicial', 'crece', 'elite'] as const) {
      for (const km of [0, 2, 5, 12, null]) {
        for (const propina of [0, 150, 1000]) {
          const d = calcularPedido({
            lineas: [
              { precioCentavos: 899, cantidad: 3 },
              { precioCentavos: 1250, cantidad: 1 },
            ],
            plan,
            propina,
            distanciaKm: km,
          });
          expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);
        }
      }
    }
  });

  it('la propina nunca se usa para completar el mínimo del repartidor', () => {
    const sin = calcularPedido({
      lineas: [{ precioCentavos: 2000, cantidad: 1 }],
      plan: 'inicial',
      propina: 0,
      distanciaKm: 1,
    });
    const con = calcularPedido({
      lineas: [{ precioCentavos: 2000, cantidad: 1 }],
      plan: 'inicial',
      propina: 500,
      distanciaKm: 1,
    });
    expect(con.pagoRepartidor - sin.pagoRepartidor).toBe(500);
    expect(con.complementoRepartidor).toBe(sin.complementoRepartidor);
  });

  it('los planes cobran la mitad que DoorDash', () => {
    const base = { lineas: [{ precioCentavos: 10000, cantidad: 1 }], propina: 0, distanciaKm: 1 };
    expect(calcularPedido({ ...base, plan: 'inicial' }).comisionRestaurante).toBe(750);
    expect(calcularPedido({ ...base, plan: 'crece' }).comisionRestaurante).toBe(1250);
    expect(calcularPedido({ ...base, plan: 'elite' }).comisionRestaurante).toBe(1500);
  });

  it('el envío sube con la distancia y tiene techo', () => {
    expect(calcularEnvio(CONFIG_DINERO_INICIAL, 1)).toBe(399);
    expect(calcularEnvio(CONFIG_DINERO_INICIAL, 5)).toBe(499);
    expect(calcularEnvio(CONFIG_DINERO_INICIAL, 50)).toBe(799);
    expect(calcularEnvio(CONFIG_DINERO_INICIAL, null)).toBe(399);
  });

  it('pedido pequeño lleva su cargo y la tarifa de servicio tiene mínimo y máximo', () => {
    const chico = calcularPedido({
      lineas: [{ precioCentavos: 500, cantidad: 1 }],
      plan: 'inicial',
      propina: 0,
      distanciaKm: 1,
    });
    expect(chico.cargoPedidoPequeno).toBe(200);
    expect(chico.servicio).toBe(199);
    const grande = calcularPedido({
      lineas: [{ precioCentavos: 50000, cantidad: 1 }],
      plan: 'inicial',
      propina: 0,
      distanciaKm: 1,
    });
    expect(grande.cargoPedidoPequeno).toBe(0);
    expect(grande.servicio).toBe(499);
  });

  it('un regalo del restaurante baja lo que paga el cliente y sale del pago del restaurante', () => {
    const d = calcularPedido({
      lineas: [{ precioCentavos: 1200, cantidad: 2 }],
      plan: 'inicial',
      propina: 0,
      distanciaKm: 1,
      regalo: 1200,
    });
    expect(d.subtotal).toBe(2400);
    expect(d.pagoRestaurante + d.comisionRestaurante).toBe(1200);
    expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);
  });

  it('rechaza pedidos vacíos, cantidades raras y montos con decimales', () => {
    expect(() =>
      calcularPedido({ lineas: [], plan: 'inicial', propina: 0, distanciaKm: 1 }),
    ).toThrow();
    expect(() =>
      calcularPedido({
        lineas: [{ precioCentavos: 100, cantidad: 0 }],
        plan: 'inicial',
        propina: 0,
        distanciaKm: 1,
      }),
    ).toThrow();
    expect(() =>
      calcularPedido({
        lineas: [{ precioCentavos: 10.5, cantidad: 1 }],
        plan: 'inicial',
        propina: 0,
        distanciaKm: 1,
      }),
    ).toThrow();
    expect(() =>
      calcularPedido({
        lineas: [{ precioCentavos: 100, cantidad: 1 }],
        plan: 'inicial',
        propina: -1,
        distanciaKm: 1,
      }),
    ).toThrow();
  });
});

describe('impuesto de ventas (auditoría final, A.12)', () => {
  it('apagado por defecto: nada cambia; con 7 % se cobra sobre la comida, va al total y no es ganancia', () => {
    const base = calcularPedido({
      lineas: [{ precioCentavos: 1500, cantidad: 2 }],
      plan: 'inicial',
      propina: 400,
      distanciaKm: 2,
    });
    expect(base.impuesto).toBe(0);
    const con = calcularPedido({
      lineas: [{ precioCentavos: 1500, cantidad: 2 }],
      plan: 'inicial',
      propina: 400,
      distanciaKm: 2,
      config: { ...CONFIG_DINERO_INICIAL, impuestoPb: 700 },
    });
    expect(con.impuesto).toBe(210);
    expect(con.totalCliente).toBe(base.totalCliente + 210);
    expect(con.gananciaPlataforma).toBe(base.gananciaPlataforma);
    expect(con.pagoRestaurante).toBe(base.pagoRestaurante);
    expect(con.pagoRepartidor).toBe(base.pagoRepartidor);
  });
});
