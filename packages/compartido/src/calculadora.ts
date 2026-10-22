import type { Plan } from './catalogo';
import type { Centavos } from './dinero';
import { CONFIG_DINERO_INICIAL, type ConfigDinero, calcularPedido } from './bolsillos';
import { compararConOtras } from './competencia';

/**
 * La calculadora pública de Divoox (/calculator): franquicia, restaurante, repartidor y cliente.
 * Son PROYECCIONES con supuestos a la vista, no promesas. Los supuestos del mercado salen de
 * fuentes públicas (detalle y enlaces en docs/MODELO-DE-DINERO.md); cada persona los puede mover.
 */
export const SUPUESTOS_MERCADO = {
  consultado: '2026-10-13',
  /** YouGov (ene 2025): 28,2 % de los adultos de EE.UU. usa apps de comida al menos una vez por semana. */
  usuariosAppsPct: 28,
  /** DoorDash, informe anual 2025: 3.172 millones de pedidos y 56 millones de usuarios activos al mes
   *  (≈ 4,7 pedidos al mes por usuario, cifra alta porque usa los usuarios de fin de año). Se usa 4. */
  pedidosPorUsuarioMes: 4,
  /** DoorDash 2025: valor bruto de 102.018 millones en 3.172 millones de pedidos ≈ 32 dólares por
   *  pedido con tarifas, impuestos y propina. Se usa 28 dólares de comida. */
  ticketComida: 2800,
  /** Propina habitual en la app (la que viene marcada es 20 %; se usa 15 % para no inflar). */
  propinaPct: 15,
  /** Supuesto propio: un repartidor de tiempo completo hace unas 16 entregas al día (8 h a 2 por hora). */
  entregasPorRepartidorDia: 16,
} as const;

/** Lo que cobra Stripe por cada pago con tarjeta en EE.UU. (2,9 % + 30 centavos). */
export const cobroTarjeta = (total: Centavos): Centavos => Math.round(total * 0.029) + 30;

/** Un pedido promedio con los precios vigentes. */
function pedidoPromedio(
  ticket: Centavos,
  plan: Plan,
  propinaPct: number,
  km: number,
  c: ConfigDinero,
) {
  return calcularPedido({
    lineas: [{ precioCentavos: Math.max(1, Math.round(ticket)), cantidad: 1 }],
    plan,
    propina: Math.round((ticket * propinaPct) / 100),
    distanciaKm: km,
    config: c,
  });
}

export type EntradaFranquicia = {
  poblacion: number;
  restaurantes: number;
  /** Parte del mercado de apps de comida de la ciudad que logra Divoox (%). */
  cuotaPct: number;
  usuariosAppsPct?: number;
  pedidosPorUsuarioMes?: number;
  ticket?: Centavos;
  propinaPct?: number;
  plan?: Plan;
  km?: number;
};

/** El mercado de una ciudad y lo que movería Divoox en ella, al mes. */
export function proyectarCiudad(e: EntradaFranquicia, c: ConfigDinero = CONFIG_DINERO_INICIAL) {
  const s = SUPUESTOS_MERCADO;
  const usuarios = Math.round(
    (Math.max(0, e.poblacion) * (e.usuariosAppsPct ?? s.usuariosAppsPct)) / 100,
  );
  const pedidosMercado = Math.round(usuarios * (e.pedidosPorUsuarioMes ?? s.pedidosPorUsuarioMes));
  const pedidosTumbite = Math.round(
    (pedidosMercado * Math.min(100, Math.max(0, e.cuotaPct))) / 100,
  );
  const d = pedidoPromedio(
    e.ticket ?? s.ticketComida,
    e.plan ?? 'inicial',
    e.propinaPct ?? s.propinaPct,
    e.km ?? 2,
    c,
  );
  const netoPlataforma = d.gananciaPlataforma - cobroTarjeta(d.totalCliente);
  return {
    usuariosApps: usuarios,
    pedidosMercadoMes: pedidosMercado,
    pedidosTumbiteMes: pedidosTumbite,
    pedidosPorRestauranteMes: e.restaurantes > 0 ? Math.round(pedidosTumbite / e.restaurantes) : 0,
    ventasRestaurantesMes: pedidosTumbite * d.pagoRestaurante,
    pagoRepartidoresMes: pedidosTumbite * d.pagoRepartidor,
    netoPlataformaMes: pedidosTumbite * netoPlataforma,
    clientesPagan: pedidosTumbite * d.totalCliente,
    repartidoresNecesarios: Math.ceil(pedidosTumbite / 30 / s.entregasPorRepartidorDia),
    pedido: d,
  };
}

/** Restaurante: cuánto le queda de sus ventas con Divoox y con las otras apps, al mes. */
export function compararRestaurante(
  ventasMes: Centavos,
  plan: Plan,
  c: ConfigDinero = CONFIG_DINERO_INICIAL,
) {
  return compararConOtras(Math.max(0, Math.round(ventasMes)), 0, plan, c);
}

export type EntradaRepartidor = {
  horasDia: number;
  diasSemana: number;
  entregasPorHora: number;
  propina: Centavos;
  km: number;
};

/** Repartidor: cuánto gana por entrega, por día, por semana y por mes (lo que paga Divoox + propina). */
export function proyectarRepartidor(e: EntradaRepartidor, c: ConfigDinero = CONFIG_DINERO_INICIAL) {
  const d = calcularPedido({
    lineas: [{ precioCentavos: SUPUESTOS_MERCADO.ticketComida, cantidad: 1 }],
    plan: 'inicial',
    propina: Math.max(0, Math.round(e.propina)),
    distanciaKm: Math.max(0, e.km),
    config: c,
  });
  const entregasDia = Math.max(0, e.horasDia) * Math.max(0, e.entregasPorHora);
  const porEntrega = d.pagoRepartidor;
  const dia = Math.round(entregasDia * porEntrega);
  const semana = dia * Math.max(0, Math.min(7, e.diasSemana));
  return {
    porEntrega,
    sinPropina: porEntrega - d.propina,
    entregasDia,
    dia,
    semana,
    mes: Math.round((semana * 52) / 12),
    porHora: e.horasDia > 0 ? Math.round(dia / e.horasDia) : 0,
  };
}

/** Lo que DoorDash publica como tarifa de servicio en varias ciudades (15 % del pedido). */
export const SERVICIO_DOORDASH_PCT = 15;

/** Cliente: cuánto ahorra al mes y al año en la tarifa de servicio frente al 15 % publicado. */
export function ahorroCliente(
  pedidosMes: number,
  ticket: Centavos,
  c: ConfigDinero = CONFIG_DINERO_INICIAL,
) {
  const d = pedidoPromedio(ticket, 'inicial', 0, 2, c);
  const otra = Math.round((Math.max(0, ticket) * SERVICIO_DOORDASH_PCT) / 100);
  const porPedido = Math.max(0, otra - d.servicio);
  const mes = Math.round(porPedido * Math.max(0, pedidosMes));
  return { servicioTumbite: d.servicio, servicioOtra: otra, porPedido, mes, ano: mes * 12 };
}
