import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
export type Punto = { lat: number; lng: number };

/**
 * Mapa para la versión web de la app (tumbite.com/app): Leaflet con OpenStreetMap, gratis y de
 * código abierto, sin llave. En el celular se usa el mapa nativo (Apple / Google).
 * Ojo: los mosaicos de openstreetmap.org son para poco tráfico; si la web crece, se cambia la
 * dirección de los mosaicos aquí por un proveedor propio.
 */
export const COLORES = { restaurante: '#191919', casa: '#FF3008', repartidor: '#FF3008' };

export function crearMapa(div: HTMLDivElement, centro: Punto, zoom = 15): L.Map {
  const mapa = L.map(div, { zoomControl: false, attributionControl: true }).setView(
    [centro.lat, centro.lng],
    zoom,
  );
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(mapa);
  return mapa;
}

/** Punto redondo (sin imágenes, que en la web se rompen): relleno de color y borde blanco. */
export function punto(p: Punto, color: string, radio = 9, etiqueta?: string): L.CircleMarker {
  const m = L.circleMarker([p.lat, p.lng], {
    radius: radio,
    color: '#FFFFFF',
    weight: 3,
    fillColor: color,
    fillOpacity: 1,
  });
  if (etiqueta) m.bindTooltip(etiqueta);
  return m;
}
