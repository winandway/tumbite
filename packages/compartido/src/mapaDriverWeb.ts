import type { OrigenPunto } from './mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB en Divoox Driver (Flex Fase 7, 13 nov 2026) — todos los países. De dónde viene
 * cada punto de los mapas web del conductor, para elegir Google (con llave) o Leaflet:
 * - la ubicación del conductor es GPS;
 * - el restaurante, la casa del cliente y los restaurantes cercanos salen de direcciones elegidas
 *   con Google Places (pieza única `CampoDireccion`);
 * - en una ruta Flex, el centro y las paradas también salen de direcciones de Google Places
 *   (panel de la empresa); sin saber la fuente exacta de cada una, se toma la prudente: Google.
 * Sin puntos de Google, Leaflet; sin llave, Leaflet como siempre.
 */
export function origenesMapaDriver(p: {
  yo?: unknown;
  restaurante?: unknown;
  casa?: unknown;
  marcadores?: unknown[];
}): OrigenPunto[] {
  const o: OrigenPunto[] = [];
  if (p.yo) o.push('gps');
  if (p.restaurante || p.casa || (p.marcadores?.length ?? 0) > 0) o.push('google');
  return o;
}

export function origenesMapaRutaFlex(p: { paradas: number; yo?: unknown }): OrigenPunto[] {
  return [...(p.yo ? (['gps'] as const) : []), ...(p.paradas > 0 ? (['google'] as const) : [])];
}
