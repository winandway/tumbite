import { describe, expect, it } from 'vitest';
import {
  SUPUESTOS_MERCADO,
  ahorroCliente,
  compararRestaurante,
  proyectarCiudad,
  proyectarRepartidor,
} from './calculadora';

describe('calculadora pública', () => {
  it('ciudad: 10.000 habitantes, 50 restaurantes y 10 % del mercado', () => {
    const r = proyectarCiudad({ poblacion: 10000, restaurantes: 50, cuotaPct: 10 });
    expect(r.usuariosApps).toBe(2800); // 28 % usa apps de comida
    expect(r.pedidosMercadoMes).toBe(11200); // 4 pedidos al mes cada uno
    expect(r.pedidosTumbiteMes).toBe(1120);
    expect(r.pedidosPorRestauranteMes).toBe(22);
    expect(r.repartidoresNecesarios).toBe(3);
    // El dinero cuadra: lo que pagan los clientes = restaurantes + repartidores + Tumbite (antes de la tarjeta).
    const d = r.pedido;
    expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);
    expect(r.netoPlataformaMes).toBeGreaterThan(0);
  });

  it('sin restaurantes no hay pedidos por restaurante, y la cuota no pasa del 100 %', () => {
    expect(
      proyectarCiudad({ poblacion: 1000, restaurantes: 0, cuotaPct: 5 }).pedidosPorRestauranteMes,
    ).toBe(0);
    const todo = proyectarCiudad({ poblacion: 1000, restaurantes: 1, cuotaPct: 500 });
    expect(todo.pedidosTumbiteMes).toBe(todo.pedidosMercadoMes);
  });

  it('restaurante: 10.000 dólares de ventas al mes en plan Inicial', () => {
    expect(compararRestaurante(1000000, 'inicial')).toEqual({
      ventas: 1000000,
      tumbite: 925000,
      doordash: 850000,
      ubereats: 800000,
    });
  });

  it('repartidor: 8 horas, 2 entregas por hora, 4 dólares de propina, 2 km, 5 días', () => {
    const r = proyectarRepartidor({
      horasDia: 8,
      diasSemana: 5,
      entregasPorHora: 2,
      propina: 400,
      km: 2,
    });
    expect(r.sinPropina).toBe(500); // el mínimo garantizado de 5 dólares
    expect(r.porEntrega).toBe(900);
    expect(r.entregasDia).toBe(16);
    expect(r.dia).toBe(14400);
    expect(r.semana).toBe(72000);
    expect(r.mes).toBe(312000);
    expect(r.porHora).toBe(1800);
  });

  it('cliente: 6 pedidos de 28 dólares al mes ahorran en la tarifa de servicio', () => {
    const r = ahorroCliente(6, SUPUESTOS_MERCADO.ticketComida);
    expect(r.servicioTumbite).toBe(199); // 5 % = 1,40 → mínimo 1,99
    expect(r.servicioOtra).toBe(420); // 15 % de 28
    expect(r.porPedido).toBe(221);
    expect(r.mes).toBe(1326);
    expect(r.ano).toBe(15912);
  });
});
