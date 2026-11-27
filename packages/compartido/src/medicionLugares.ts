/**
 * C-ESTOY-AQUI (27 nov 2026, Gerencia con luz verde de Richard) — todas las ciudades. Las reglas de la
 * medición de un lugar propio en la calle, en UNA pieza: la usan el servidor (que las hace cumplir),
 * la app Driver (que guía al conductor) y el panel (que muestra la medición).
 */

/** La peor precisión del GPS que se acepta, en metros. Peor que esto, la app pide esperar o acercarse. */
export const PRECISION_MEDICION_M = 15;

/**
 * Lo más que una medición puede mover un lugar, en kilómetros. Medir corrige un punto; nunca lo lleva a
 * otra parte (ni a otra ciudad). Más lejos, el equipo lo cambia a mano en «Lugares propios».
 */
export const TOPE_MOVIMIENTO_KM = 5;

/** Una medición nueva no puede tener la hora del teléfono más de esto en el futuro (reloj mal puesto). */
export const HOLGURA_RELOJ_MS = 10 * 60_000;

export type EstadoMedicion = 'pendiente' | 'aprobada' | 'rechazada';

/** ¿La precisión sirve? (un número válido, mayor que cero y no peor que el tope). */
export function precisionSirve(precisionM: number | null | undefined): boolean {
  return (
    typeof precisionM === 'number' &&
    Number.isFinite(precisionM) &&
    precisionM > 0 &&
    precisionM <= PRECISION_MEDICION_M
  );
}

/** «140 m» o «2,3 km» (cómo se dice cuánto se movió un punto). */
export function distanciaLegible(metros: number, idioma: 'es' | 'en'): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  const km = (Math.round(metros / 100) / 10).toFixed(1);
  return `${idioma === 'es' ? km.replace('.', ',') : km} km`;
}
