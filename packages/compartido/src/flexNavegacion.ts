/**
 * C-FLEX-NAVEGAR-RUTA (Flex Fase 7, 13 nov 2026). Todos los países.
 *
 * «Navegar la ruta» en Mi ruta del conductor: abre Google Maps con las PRÓXIMAS paradas en orden
 * usando el enlace universal de direcciones (Maps URLs, `https://www.google.com/maps/dir/?api=1`).
 * Sin origen: Google parte de donde está el celular. Google admite hasta 9 puntos intermedios
 * cuando el enlace abre en la app o en la computadora (3 en un navegador de celular), así que un
 * tramo lleva como mucho 10 paradas (9 intermedias + el destino); el resto queda para el siguiente
 * tramo, que se abre al volver a tocar el botón cuando esas paradas ya se resolvieron.
 * Waze y Apple Maps no admiten varias paradas en su enlace: para ellos sigue la siguiente parada.
 */
export const MAX_INTERMEDIOS_ENLACE_GOOGLE = 9;

type ParadaNav = { lat: number | null; lng: number | null; direccion?: string };

/** Seis decimales (unos 10 cm) bastan y dejan el enlace corto. */
const seis = (n: number) => String(Math.round(n * 1e6) / 1e6);
const punto = (p: ParadaNav) =>
  p.lat != null && p.lng != null ? `${seis(p.lat)},${seis(p.lng)}` : (p.direccion ?? '').trim();

/**
 * Enlace de Google Maps con hasta 10 próximas paradas (las que ya se resolvieron no deben venir).
 * Devuelve null si no hay ninguna parada con coordenadas o dirección.
 */
export function enlaceRutaGoogle(
  proximas: ParadaNav[],
  maxIntermedios = MAX_INTERMEDIOS_ENLACE_GOOGLE,
): { url: string; paradas: number; quedan: number } | null {
  const validas = proximas.filter((p) => punto(p));
  if (!validas.length) return null;
  const tramo = validas.slice(0, maxIntermedios + 1);
  const destino = tramo[tramo.length - 1]!;
  const intermedios = tramo.slice(0, -1);
  const q = new URLSearchParams({ api: '1', destination: punto(destino), travelmode: 'driving' });
  if (intermedios.length) q.set('waypoints', intermedios.map(punto).join('|'));
  return {
    url: `https://www.google.com/maps/dir/?${q.toString()}`,
    paradas: tramo.length,
    quedan: validas.length - tramo.length,
  };
}
