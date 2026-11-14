import { type OrigenPunto, elegirMapaWeb } from '@tumbite/compartido/src/mapaWebGoogle';

/**
 * C-MAPA-GOOGLE-WEB en Divoox Driver (Flex Fase 7) — todos los países. La llave PÚBLICA de Maps
 * JavaScript API para la versión web de la app (restringida por dominio en Google Cloud; no es la
 * llave del servidor). Llega en la compilación como EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY. Sin ella,
 * Leaflet como siempre.
 */
export const LLAVE_MAPA_WEB = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY ?? '';

export const proveedorMapaWeb = (origenes: OrigenPunto[]) =>
  elegirMapaWeb({ llave: LLAVE_MAPA_WEB, origenes });
