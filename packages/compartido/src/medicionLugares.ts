/**
 * C-ESTOY-AQUI (27 nov 2026, Gerencia con luz verde de Richard) — todas las ciudades. Las reglas de la
 * medición de un lugar propio en la calle, en UNA pieza: la usan el servidor (que las hace cumplir),
 * la app Driver (que guía al conductor) y el panel (que muestra la medición).
 */

/** La peor precisión del GPS que se acepta, en metros. Peor que esto, la app pide esperar o acercarse. */
export const PRECISION_MEDICION_M = 15;

/**
 * C-ESTOY-AQUI-300 (Richard, 27 nov 2026): «Estoy aquí» se activa SOLO a menos de esto del punto
 * guardado (y con la precisión de arriba). Es también lo más que una medición puede mover un lugar:
 * medir corrige un punto; nunca lo lleva a otra parte. Más lejos, el equipo lo cambia a mano en
 * «Lugares propios». La misma regla en Driver (botón gris), el servidor (lo rechaza) y al aprobar.
 */
export const RADIO_ESTOY_AQUI_M = 300;

/**
 * C-TRES-FOTOS (Richard, 27 nov 2026): cada medición lleva tres fotos OBLIGATORIAS, tomadas con la
 * cámara en el lugar, cada una con su hora y su GPS. Sin las tres, el equipo no puede aprobarla.
 */
export const FOTOS_MEDICION = ['entrada', 'letrero', 'calle'] as const;
export type TipoFotoMedicion = (typeof FOTOS_MEDICION)[number];

/** Las fotos que faltan, en el orden de FOTOS_MEDICION. */
export function fotosQueFaltan(tiene: readonly string[]): TipoFotoMedicion[] {
  return FOTOS_MEDICION.filter((x) => !tiene.includes(x));
}

/** Cómo se llama cada foto en pantalla (Driver, panel y la app de clientes). */
export const NOMBRE_FOTO_MEDICION: Record<'es' | 'en', Record<TipoFotoMedicion, string>> = {
  es: {
    entrada: 'Entrada o fachada',
    letrero: 'Letrero o algo reconocible',
    calle: 'Vista desde la calle',
  },
  en: {
    entrada: 'Entrance or front',
    letrero: 'Sign or a landmark',
    calle: 'View from the street',
  },
};

/** El nombre de una foto en pantalla, sin índice libre (solo los tres tipos conocidos). */
export function nombreFotoMedicion(tipo: TipoFotoMedicion, idioma: 'es' | 'en'): string {
  const n = idioma === 'en' ? NOMBRE_FOTO_MEDICION.en : NOMBRE_FOTO_MEDICION.es;
  switch (tipo) {
    case 'letrero':
      return n.letrero;
    case 'calle':
      return n.calle;
    default:
      return n.entrada;
  }
}

/** Una foto pública de un lugar se muestra si su lugar propio queda a esto o menos del punto del viaje. */
export const RADIO_FOTOS_LUGAR_M = 40;

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
