import { Platform } from 'react-native';
import { alertaDivoox } from './HojaFoto';
import type { Idioma } from '@tumbite/compartido';
import {
  type CamaraApp,
  type OrigenFoto,
  capturasDe,
  fotoDe,
  preguntarOrigen,
} from './camaraLogica';
import { camaraDeComputadora } from './camaraWeb';

export * from './camaraLogica';
export { camaraDeComputadora } from './camaraWeb';

/**
 * C-CAMARA-EN-TODA-SUBIDA: la parte nativa de la pieza única. Pregunta con la ventanita del
 * teléfono «Tomar foto» o «Subir desde archivos» (la lógica vive en camaraLogica.ts, que se prueba
 * sola). Toda casilla de imagen de las apps pasa por `fotoConCamara` o `capturasConCamara`.
 */
export const preguntarOrigenFoto = (idioma: Idioma): Promise<OrigenFoto> =>
  preguntarOrigen(
    idioma,
    Platform.OS,
    // Tramo 1: la hoja propia de Divoox (no la ventana gris del sistema).
    alertaDivoox,
    // En la computadora (apps web): la ventanita propia con las dos opciones y la cámara web.
    camaraDeComputadora,
  );

/** Una foto: de la cámara o de los archivos (la apertura de la galería de siempre). */
export function fotoConCamara<F extends { uri: string; fileName?: string | null }>(
  idioma: Idioma,
  camara: CamaraApp<F>,
  deArchivos: () => Promise<F | null>,
): Promise<F | null> {
  return fotoDe(idioma, camara, deArchivos, preguntarOrigenFoto, camaraDeComputadora);
}

/**
 * Una foto con el origen ya elegido por el botón tocado (las casillas con los dos botones a la
 * vista, como la foto de la puerta). En la computadora, «Tomar foto» abre la cámara web.
 */
export function fotoConOrigen<F extends { uri: string; fileName?: string | null }>(
  idioma: Idioma,
  camara: CamaraApp<F>,
  deArchivos: () => Promise<F | null>,
  origen: 'camara' | 'archivos',
): Promise<F | null> {
  return fotoDe(idioma, camara, deArchivos, async () => origen, camaraDeComputadora);
}

/** Varias capturas (casos de ayuda): el selector de siempre, ahora con «Tomar foto». */
export function capturasConCamara(
  deArchivos: (maximo: number) => Promise<{ uri: string; nombre: string }[]>,
  camara: CamaraApp,
  idioma: Idioma,
) {
  return capturasDe(deArchivos, camara, idioma, preguntarOrigenFoto, camaraDeComputadora);
}
