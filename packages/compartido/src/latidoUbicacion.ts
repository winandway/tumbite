import { metrosEntre, type Punto } from './llegada';

/**
 * C-LATIDO-UBICACION: conectado y quieto, el repartidor manda su posición al menos cada 2 minutos.
 * El servidor solo ofrece pedidos a quien tiene una posición de los últimos 10 minutos, y el
 * Manager quita un pedido aceptado a los 10 minutos sin ubicación. El servidor ya escribe como
 * mucho una vez por latido (C-POSICION-SIN-REESCRIBIR).
 */
export const LATIDO_UBICACION_MS = 120_000;

/**
 * C-LATIDO-UBICACION (revisión del 13 nov 2026): una lectura del GPS con más de 90 segundos no
 * cuenta como señal nueva. El servidor no refresca «última señal» con ella: el cliente debe ver
 * «señal perdida», no a un repartidor quieto que parece vivo.
 */
export const LECTURA_VIEJA_MS = 90_000;

/** Más de un día de edad no es una lectura vieja: es un reloj roto. Se trata como fresca. */
export const EDAD_ABSURDA_MS = 86_400_000;

/**
 * Edad de una lectura según el propio celular. La app nueva manda `edadMs`, medida con un solo
 * reloj (Date.now() al recibir la lectura y al enviarla); la vieja, `leidaEn` y `enviadaEn`. Sin
 * datos, 0. Negativa o de más de un día: 0 (revisión 2 del 13 nov 2026: un reloj mal puesto no deja
 * a un repartidor real como «señal perdida»).
 */
export function edadLecturaMs(d: {
  leidaEn?: number | null;
  enviadaEn?: number | null;
  edadMs?: number | null;
}): number {
  const edad =
    d.edadMs != null
      ? d.edadMs
      : d.leidaEn == null || d.enviadaEn == null
        ? 0
        : d.enviadaEn - d.leidaEn;
  return Number.isFinite(edad) && edad >= 0 && edad <= EDAD_ABSURDA_MS ? edad : 0;
}

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
