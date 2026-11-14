import type { OrigenPunto } from './mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB en Divoox Driver — todos los países. De dónde viene cada punto de los mapas web
 * del conductor (la ubicación del conductor es GPS; el restaurante, la casa, los restaurantes
 * cercanos y las paradas de Flex salen de direcciones de Google Places). Desde el 14 nov 2026 el
 * origen ya no decide el proveedor (con llave, siempre Google), pero se sigue informando.
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

/**
 * Con un pedido activo (hay restaurante o casa) el mapa del conductor es de viaje: se abre solo y va
 * inclinado hacia el destino. Sin pedido (conectado esperando ofertas), plano y con el botón
 * «Ver en el mapa» para no gastar cargas por mirar.
 */
export function vistaMapaDriver(p: {
  restaurante?: unknown;
  casa?: unknown;
  yo?: unknown;
  marcadores?: unknown[];
}): 'viaje' | 'plano' {
  return p.restaurante || p.casa ? 'viaje' : 'plano';
}

/** Hacia dónde mira el mapa en viaje: la casa si ya la lleva; si no, el restaurante. */
export function destinoMapaDriver<T>(p: { restaurante?: T | null; casa?: T | null }): T | null {
  return p.casa ?? p.restaurante ?? null;
}
