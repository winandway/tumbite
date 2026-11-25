/**
 * C-VIAJE-LARGO-A-LA-VISTA (25 nov 2026, Richard tras la prueba de Tucaní a Caja Seca) — todos los
 * países. Desde C-DESTINO-EN-EL-PAIS el destino puede estar en cualquier punto del país, así que la
 * oferta avisa en grande, antes de aceptar, cuando el viaje es largo: la distancia total y a dónde va
 * («Viaje largo: 45 km», «Hasta: Caja Seca…»), como el aviso de viaje largo de las apps de
 * conductores. Decide el conductor.
 */
export const KM_VIAJE_LARGO = 20;

export function avisoViajeLargo(
  viajeM: number | null | undefined,
  destino: string,
  idioma: 'es' | 'en',
): { titulo: string; hasta: string } | null {
  if (viajeM == null || viajeM < KM_VIAJE_LARGO * 1000) return null;
  const lugar = destino.trim();
  if (idioma === 'en') {
    const mi = Math.round((viajeM / 1000) * 0.621371);
    return { titulo: `Long trip: ${mi} mi`, hasta: lugar ? `To: ${lugar}` : '' };
  }
  return {
    titulo: `Viaje largo: ${Math.round(viajeM / 1000)} km`,
    hasta: lugar ? `Hasta: ${lugar}` : '',
  };
}
