import { distanciaKm } from './catalogo';

/**
 * Qué tan cerca hay que estar para recoger en el restaurante y para entregar en la puerta.
 * 200 metros: el GPS del celular en la ciudad se equivoca de 10 a 50 m, y en edificios un poco
 * más; con menos, un repartidor parado en la puerta podría quedar «lejos» por culpa del GPS.
 */
export const RADIO_LLEGADA_M = 200;

export type Punto = { lat: number; lng: number };

/** Metros entre dos puntos, redondeados. */
export function metrosEntre(a: Punto, b: Punto): number {
  return Math.round(distanciaKm(a, b) * 1000);
}

/** ¿Está dentro del radio? Si el destino no tiene coordenadas, no se puede exigir (se deja). */
export function llego(donde: Punto | null, destino: Punto | null, radio = RADIO_LLEGADA_M) {
  if (!destino) return true;
  if (!donde) return false;
  return metrosEntre(donde, destino) <= radio;
}
