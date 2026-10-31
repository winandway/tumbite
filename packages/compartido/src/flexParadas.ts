/**
 * C-FLEX-FILTROS (30 oct 2026, como el mapa de Amazon Flex): filtros del mapa de la ruta. Un
 * apartamento se reconoce por la dirección; prioridad es tener hora límite de entrega.
 */
export type FiltroParadas = 'apartamentos' | 'prioridad';
export function cumpleFiltro(
  p: { direccion: string; ventanaHasta: string | null },
  f: FiltroParadas,
): boolean {
  if (f === 'prioridad') return Boolean(p.ventanaHasta);
  return /(\b(apt|apto|apartamento|unit|unidad|suite|ste)\b\.?|#\s*\w+)/i.test(p.direccion);
}
