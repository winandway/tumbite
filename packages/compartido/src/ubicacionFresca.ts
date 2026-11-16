/**
 * C-FLEX-UBICACION-FRESCA (16 nov 2026, hallado al probar el bloque de punta a punta): en la web,
 * `expo-location` pide la posición con `maximumAge: Infinity`, así que el navegador devuelve la
 * PRIMERA que tuvo (la del centro) aunque el conductor ya esté en la puerta. La entrega decía «Estás
 * fuera del área de entrega (a 4.2 mi)» estando en la dirección, y la llegada se guardaba en otro
 * sitio. En la web se pide al navegador una posición nueva (`maximumAge: 0`); en el celular sigue
 * expo-location, que sí mide de nuevo. Todos los países.
 */
type Geo = {
  getCurrentPosition: (
    ok: (p: { coords: { latitude: number; longitude: number } }) => void,
    mal: (e: unknown) => void,
    op: { enableHighAccuracy: boolean; maximumAge: number; timeout: number },
  ) => void;
};

export function posicionFrescaWeb(
  geo: Geo | undefined,
  topeMs = 10_000,
): Promise<{ lat: number; lng: number } | null> {
  if (!geo) return Promise.resolve(null);
  return new Promise((listo) => {
    geo.getCurrentPosition(
      (p) => listo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => listo(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: topeMs },
    );
  });
}
