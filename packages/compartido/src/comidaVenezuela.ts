import type { ConfigDinero } from './bolsillos';
import { type Referencia, equivalenteLocal } from './tasaReferencia';

/**
 * C-COMIDA-VENEZUELA (13 nov 2026, Venezuela): la comida en Venezuela se cobra en DÓLARES, como el
 * mercado local (Yummy y PedidosYa muestran el precio en dólares con su equivalente en bolívares
 * [OBS]). Ficha: docs/investigaciones-rea/2026-11-13-comida-venezuela-tarifas.md.
 *
 * Estas cifras son el punto de partida que propone el panel al abrir Comida en una ciudad de
 * Venezuela; el equipo las cambia desde el panel (configuración del país, o la palanca «¿Quién paga
 * qué en la comida?»). Todo en centavos de dólar. Estados Unidos NO usa nada de este archivo.
 *
 * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026, modelo aprobado por Richard): con el pago directo al
 * restaurante el cliente paga SOLO la comida al precio de la carta (al restaurante) y el envío (al
 * conductor): tarifa de servicio y cargo por pedido pequeño en 0. La comisión de Divoox la paga el
 * restaurante de su saldo prepago (ver `COMISION_RESTAURANTE_VE_*`), no el cliente ni el conductor.
 * `comisionPb` (10 % parejo) es la comisión del cobro en mano de siempre (países sin la bandera).
 */
export const TARIFAS_COMIDA_VENEZUELA: ConfigDinero = {
  // Comisión al restaurante por la venta: 10 % parejo en Venezuela (reemplaza el 15/18/20 por plan).
  comisionPb: { inicial: 1000, crece: 1000, elite: 1000 },
  // Envío por distancia, como Yummy y PedidosYa [DOC/OBS]: 1,50 hasta 3 km, 0,30 el km extra, tope 4.
  envioBase: 150,
  envioKmIncluidos: 3,
  envioPorKm: 30,
  envioMaximo: 400,
  // El cliente no paga tarifa de servicio ni cargo por pedido pequeño (C-COMIDA-VE-QUIEN-PAGA).
  servicioPb: 0,
  servicioMinimo: 0,
  servicioMaximo: 0,
  pedidoMinimo: 0,
  cargoPedidoPequeno: 0,
  // Lo mínimo que gana el repartidor por un pedido [INF].
  pagoMinimoRepartidor: 100,
  impuestoPb: 0,
};

/**
 * C-COMIDA-VE-QUIEN-PAGA: la comisión de Divoox que paga el RESTAURANTE de su saldo prepago, en
 * puntos base sobre la comida. El valor preparado es 10 %; arranca en 0 % (con saldo de regalo).
 * Se cambia desde la palanca del panel (crea o cierra la política del restaurante): estas cifras son
 * solo lo que el panel propone, nunca deciden un cobro.
 */
export const COMISION_RESTAURANTE_VE_PREPARADA_PB = 1000;
export const COMISION_RESTAURANTE_VE_ARRANQUE_PB = 0;
/**
 * C-COMIDA-VE-QUIEN-PAGA: la comisión de Divoox sobre el ENVÍO que se le aparta al conductor en un
 * pedido de pago directo (puntos base). De fábrica 0: el conductor cobra el envío entero. Vive en la
 * configuración del país (`comidaComisionEnvioPb`).
 */
export const COMISION_ENVIO_COMIDA_VE_PB = 0;

/** La ciudad de pruebas de Venezuela desde el 13 nov 2026: El Vigía, estado Mérida (en dólares). */
export const CIUDAD_PRUEBAS_EL_VIGIA = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  pais: 'VE',
  moneda: 'USD',
  zonaHoraria: 'America/Caracas',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
} as const;

/** Topes en centavos de dólar (los mismos campos que el resto de países). */
export const TOPES_COMIDA_VENEZUELA = {
  bonoOfertaAbierta: 50,
  opcionPrecioMax: 10_000,
  propinaMax: 5_000,
  propinaExtraMin: 50,
  propinaExtraMax: 2_000,
  cuponMontoMax: 100_000,
  quejaReembolsoMax: 2_000,
} as const;

/** Propinas sugeridas en el carrito, en puntos base. Venezuela: 0, 5, 10 y 15 % [INF]. */
export const PROPINAS_VENEZUELA_PB = [0, 500, 1000, 1500] as const;
/** Las de siempre (Estados Unidos y todo país sin las suyas): 0, 15, 20 y 25 %. */
export const PROPINAS_PB_INICIALES = [0, 1500, 2000, 2500] as const;

/** La tasa del día que manda el servidor junto a las tarifas (sin el monto: lo calcula la app). */
export type TasaDelDia = Omit<Referencia, 'monto'>;

/** El equivalente en bolívares de un monto en dólares con la tasa del día; null si no hay tasa. */
export function referenciaConTasa(
  centavosUsd: number,
  tasa: TasaDelDia | null | undefined,
): Referencia | null {
  if (!tasa || !Number.isSafeInteger(centavosUsd) || centavosUsd < 0) return null;
  return { ...tasa, monto: equivalenteLocal(centavosUsd, tasa.tasa) };
}
