import type { Plan } from './catalogo';
import { type Centavos, porcentajeDe } from './dinero';

/**
 * Los cuatro bolsillos de cada pedido (docs/REQUISITOS.md, sección 3).
 * Todo en centavos enteros y puntos básicos (750 = 7,5 %). Los valores los edita el admin.
 */
export type ConfigDinero = {
  comisionPb: Record<Plan, number>;
  envioBase: Centavos;
  envioKmIncluidos: number;
  envioPorKm: Centavos;
  envioMaximo: Centavos;
  servicioPb: number;
  servicioMinimo: Centavos;
  servicioMaximo: Centavos;
  pedidoMinimo: Centavos;
  cargoPedidoPequeno: Centavos;
  pagoMinimoRepartidor: Centavos;
  /** Impuesto de ventas sobre la comida, en puntos base (700 = 7 %). 0 = apagado hasta que el contador lo fije. */
  impuestoPb?: number;
};

/**
 * Valores de fábrica, en punto de equilibrio desde el primer pedido (aprobados por Richard el
 * 13 oct 2026; números en docs/MODELO-DE-DINERO.md y candado C-EQUILIBRIO). Envío desde 3,99 y
 * servicio con mínimo de 1,99: así ningún pedido normal deja pérdida después de Stripe.
 */
export const CONFIG_DINERO_INICIAL: ConfigDinero = {
  comisionPb: { inicial: 750, crece: 1250, elite: 1500 },
  envioBase: 399,
  envioKmIncluidos: 3,
  envioPorKm: 50,
  envioMaximo: 799,
  servicioPb: 500,
  servicioMinimo: 199,
  servicioMaximo: 499,
  pedidoMinimo: 1000,
  cargoPedidoPequeno: 200,
  pagoMinimoRepartidor: 500,
  impuestoPb: 0,
};

/** Los valores de fábrica anteriores (hasta el 13 oct 2026), para la actualización segura. */
export const CONFIG_DINERO_ANTERIOR: ConfigDinero = {
  ...CONFIG_DINERO_INICIAL,
  envioBase: 299,
  servicioMinimo: 99,
};

export type LineaPedido = { precioCentavos: Centavos; cantidad: number };

export type Desglose = {
  subtotal: Centavos;
  envio: Centavos;
  servicio: Centavos;
  cargoPedidoPequeno: Centavos;
  propina: Centavos;
  /** Impuesto de ventas recaudado para el estado (Divoox lo retiene y remite; no es ganancia). */
  impuesto: Centavos;
  /** Lo que quitó el cupón (lo absorbe Divoox). */
  descuento: Centavos;
  totalCliente: Centavos;
  comisionRestaurante: Centavos;
  pagoRestaurante: Centavos;
  pagoRepartidor: Centavos;
  complementoRepartidor: Centavos;
  gananciaPlataforma: Centavos;
};

function entero(n: number, nombre: string): void {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`calcularPedido: ${nombre} inválido (${n})`);
}

export function calcularEnvio(config: ConfigDinero, distanciaKm: number | null): Centavos {
  const km =
    distanciaKm == null || !Number.isFinite(distanciaKm)
      ? config.envioKmIncluidos
      : Math.max(0, distanciaKm);
  const extra = Math.max(0, Math.ceil(km - config.envioKmIncluidos)) * config.envioPorKm;
  return Math.min(config.envioBase + extra, config.envioMaximo);
}

/**
 * La propina es 100 % del repartidor y NUNCA se usa para completar su pago mínimo:
 * el mínimo se completa con dinero de la plataforma.
 */
/** Comisión de la recogida en el local, en puntos base (5 %): sin repartidor que pagar. */
export const COMISION_RECOGIDA_PB = 500;

export function calcularPedido(p: {
  lineas: LineaPedido[];
  plan: Plan;
  propina: Centavos;
  distanciaKm: number | null;
  config?: ConfigDinero;
  /** Lo que el restaurante regala en este pedido (cumpleaños, sellos). Sale de su pago. */
  regalo?: Centavos;
  /** Recogida en el local: sin envío ni repartidor; comisión del 5 % (como los grandes). */
  recogida?: boolean;
  /** Cupón: baja el total del cliente y la ganancia de Divoox (nunca lo que recibe el restaurante o el repartidor). */
  descuento?: Centavos;
}): Desglose {
  const c = p.config ?? CONFIG_DINERO_INICIAL;
  entero(p.propina, 'propina');
  const regalo = p.regalo ?? 0;
  entero(regalo, 'regalo');
  let subtotal = 0;
  for (const l of p.lineas) {
    entero(l.precioCentavos, 'precio');
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 99)
      throw new Error('calcularPedido: cantidad inválida');
    subtotal += l.precioCentavos * l.cantidad;
  }
  if (subtotal === 0) throw new Error('calcularPedido: el pedido está vacío');
  const aCobrar = Math.max(0, subtotal - regalo);

  const envio = p.recogida ? 0 : calcularEnvio(c, p.distanciaKm);
  const servicio = Math.min(
    Math.max(porcentajeDe(aCobrar, c.servicioPb), c.servicioMinimo),
    c.servicioMaximo,
  );
  const cargoPedidoPequeno = subtotal < c.pedidoMinimo ? c.cargoPedidoPequeno : 0;
  // Impuesto de ventas (Florida: estatal + condado) solo sobre la comida cobrada. Qué más se grava
  // (envío, servicio) lo decide el contador: hasta entonces, nada más. Se suma al total y se retiene.
  const impuesto = porcentajeDe(aCobrar, c.impuestoPb ?? 0);
  // El cupón nunca descuenta más que lo que paga el cliente sin propina (la propina es del repartidor).
  const descuento = Math.min(
    p.descuento ?? 0,
    aCobrar + envio + servicio + cargoPedidoPequeno + impuesto,
  );
  entero(descuento, 'descuento');
  const totalCliente =
    aCobrar + envio + servicio + cargoPedidoPequeno + p.propina + impuesto - descuento;

  const comisionRestaurante = porcentajeDe(
    aCobrar,
    p.recogida ? COMISION_RECOGIDA_PB : c.comisionPb[p.plan],
  );
  const pagoRestaurante = aCobrar - comisionRestaurante + (p.recogida ? p.propina : 0);
  const complementoRepartidor = p.recogida ? 0 : Math.max(0, c.pagoMinimoRepartidor - envio);
  const pagoRepartidor = p.recogida ? 0 : envio + complementoRepartidor + p.propina;
  const gananciaPlataforma =
    comisionRestaurante + servicio + cargoPedidoPequeno - complementoRepartidor - descuento;

  return {
    subtotal,
    envio,
    servicio,
    cargoPedidoPequeno,
    propina: p.propina,
    impuesto,
    descuento,
    totalCliente,
    comisionRestaurante,
    pagoRestaurante,
    pagoRepartidor,
    complementoRepartidor,
    gananciaPlataforma,
  };
}
