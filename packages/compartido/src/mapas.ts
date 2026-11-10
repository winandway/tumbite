/**
 * C-ELEGIR-MAPAS (10 nov 2026, punto D2) — todos los países. Las apps de mapas que se le ofrecen
 * al repartidor al tocar «Cómo llegar», en comida, viajes y Flex (como Amazon Flex, Uber Driver y
 * Dasher: cada uno navega con la app que prefiere). Una sola lista para todas las pantallas.
 */
export type AppDeMapa = { id: 'apple' | 'google' | 'waze'; nombre: string; url: string };

export function appsDeMapa(
  plataforma: string,
  destino: { lat: number | null; lng: number | null; direccion?: string },
): AppDeMapa[] {
  const conPunto = destino.lat != null && destino.lng != null;
  const d = conPunto
    ? `${destino.lat},${destino.lng}`
    : encodeURIComponent(destino.direccion ?? '');
  const apps: AppDeMapa[] = [
    {
      id: 'google',
      nombre: 'Google Maps',
      url: `https://www.google.com/maps/dir/?api=1&destination=${d}`,
    },
    {
      id: 'waze',
      nombre: 'Waze',
      url: `https://waze.com/ul?${conPunto ? `ll=${d}` : `q=${d}`}&navigate=yes`,
    },
  ];
  // Apple Maps solo existe en el iPhone, y ahí va primero.
  return plataforma === 'ios'
    ? [{ id: 'apple', nombre: 'Apple Maps', url: `http://maps.apple.com/?daddr=${d}` }, ...apps]
    : apps;
}
