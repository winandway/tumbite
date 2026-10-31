import type { Idioma } from './idiomas';

/**
 * C-DISTANCIA-POR-PAIS (31 oct 2026, visto en el simulador de iPhone en Michigan): la distancia se
 * mostraba en kilómetros a quien usa la app en español en Estados Unidos. Como en DoorDash y Uber
 * Eats, la unidad la decide el país del servicio, no el idioma: millas en EE. UU. (y Puerto Rico),
 * kilómetros en el resto. Regla «cada país es su propio sistema».
 */
const PAISES_MILLAS = new Set(['US', 'PR']);

/** El país por el código de la zona («US-MI-NOVI» → «US»). */
export function paisDelCodigoZona(zonaId: string | null | undefined): string | null {
  const pais =
    String(zonaId ?? '')
      .split('-')[0]
      ?.toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(pais) ? pais : null;
}

export function usaMillas(pais: string | null | undefined, idioma: Idioma): boolean {
  // Sin país conocido (datos viejos), se mantiene lo de antes: millas en inglés.
  return pais ? PAISES_MILLAS.has(pais.toUpperCase()) : idioma === 'en';
}

/** «4.0 mi» o «6.4 km», con un decimal. */
export function textoDistancia(km: number, idioma: Idioma, pais?: string | null): string {
  return usaMillas(pais, idioma) ? `${(km * 0.621371).toFixed(1)} mi` : `${km.toFixed(1)} km`;
}
