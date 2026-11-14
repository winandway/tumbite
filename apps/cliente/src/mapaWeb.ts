import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LADO_MARCA_ISOTIPO, urlMarcaIsotipo } from '@tumbite/compartido/src/mapaWebGoogle';
import { seguirTemaEnLeaflet } from '@tumbite/compartido/src/temaMapa';
import type { Punto } from './ubicacion';

/**
 * Mapa para la versión web de la app (tumbite.com/app): Leaflet con OpenStreetMap, gratis y de
 * código abierto, sin llave. En el celular se usa el mapa nativo (Apple / Google).
 * Es el mapa de respaldo: con la llave del navegador el mapa es el de Google (C-MAPA-GOOGLE-WEB).
 * Ojo: los mosaicos de openstreetmap.org son para poco tráfico; si la web crece, se cambia la
 * dirección de los mosaicos aquí por un proveedor propio.
 */
export const COLORES = { restaurante: '#101010', casa: '#F20D20', repartidor: '#F20D20' };

export function crearMapa(div: HTMLDivElement, centro: Punto, zoom = 15): L.Map {
  const mapa = L.map(div, { zoomControl: true, attributionControl: true }).setView(
    [centro.lat, centro.lng],
    zoom,
  );
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(mapa);
  // C-MAPA-DIA-NOCHE: el mapa de respaldo sigue el mismo ajuste (de noche se oscurecen los mosaicos).
  mapa.on('unload', seguirTemaEnLeaflet(mapa, centro));
  return mapa;
}

/**
 * C-MAPA-ISOTIPO: la marca del repartidor o conductor es el isotipo de Divoox (disco blanco con el
 * isotipo, el mismo dibujo que en el mapa de Google); `apagado` cuando no hay señal reciente.
 */
export function isotipo(p: Punto, etiqueta?: string, apagado = false): L.Marker {
  const m = L.marker([p.lat, p.lng], {
    icon: L.icon({
      iconUrl: urlMarcaIsotipo(apagado),
      iconSize: [LADO_MARCA_ISOTIPO, LADO_MARCA_ISOTIPO],
      iconAnchor: [LADO_MARCA_ISOTIPO / 2, LADO_MARCA_ISOTIPO / 2],
    }),
    zIndexOffset: 1000,
    keyboard: false,
  });
  if (etiqueta) m.bindTooltip(etiqueta);
  return m;
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
