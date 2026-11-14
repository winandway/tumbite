import { type OrigenPunto, elegirMapaWeb } from '@tumbite/compartido/src/mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB (13 nov 2026) — todos los países. La llave PÚBLICA de Maps JavaScript API para
 * la versión web de la app (restringida por dominio en Google Cloud; no es la llave del servidor).
 * Llega en la compilación como EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY. Con ella, el mapa es siempre el de Google (14 nov 2026); sin ella,
 * Leaflet como siempre.
 */
export const LLAVE_MAPA_WEB = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY ?? '';

/**
 * Map ID del mapa vectorial con el estilo de Divoox (14 nov 2026). Llega como
 * EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID (variable del repositorio GOOGLE_MAPS_WEB_MAP_ID). Sin él, el
 * mapa de Google normal con el mismo estilo y sin inclinar.
 */
export const MAP_ID_MAPA_WEB = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID ?? '';

/** Qué mapa usar en la web: con llave, Google; sin llave, Leaflet (ver la pieza compartida). */
export const proveedorMapaWeb = (origenes: OrigenPunto[]) =>
  elegirMapaWeb({ llave: LLAVE_MAPA_WEB, origenes });
