import { metrosEntre, type Punto } from './llegada';

/**
 * C-LATIDO-UBICACION: conectado y quieto, el repartidor manda su posición al menos cada 2 minutos.
 * El servidor solo ofrece pedidos a quien tiene una posición de los últimos 10 minutos, y el
 * Manager quita un pedido aceptado a los 10 minutos sin ubicación. El servidor ya escribe como
 * mucho una vez por latido (C-POSICION-SIN-REESCRIBIR).
 */
export const LATIDO_UBICACION_MS = 120_000;

/** Metros desde el último envío a partir de los cuales se manda en seguida. */
export const MOVIDO_LATIDO_M = 25;

/** ¿Toca mandar esta lectura? Sí si nunca se mandó, si pasó el latido o si se movió 25 m. */
export function tocaMandarUbicacion(
  ultimo: (Punto & { en: number }) | null,
  lectura: Punto,
  ahora = Date.now(),
): boolean {
  if (!ultimo) return true;
  if (ahora - ultimo.en >= LATIDO_UBICACION_MS) return true;
  return metrosEntre(ultimo, lectura) >= MOVIDO_LATIDO_M;
}
