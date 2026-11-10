import { Alert, Platform } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import {
  type CamaraApp,
  type OrigenFoto,
  capturasDe,
  fotoDe,
  preguntarOrigen,
} from './camaraLogica';

export * from './camaraLogica';

/**
 * C-CAMARA-EN-TODA-SUBIDA: la parte nativa de la pieza única. Pregunta con la ventanita del
 * teléfono «Tomar foto» o «Subir desde archivos» (la lógica vive en camaraLogica.ts, que se prueba
 * sola). Toda casilla de imagen de las apps pasa por `fotoConCamara` o `capturasConCamara`.
 */
export const preguntarOrigenFoto = (idioma: Idioma): Promise<OrigenFoto> =>
  preguntarOrigen(idioma, Platform.OS, (titulo, mensaje, botones, opciones) =>
    Alert.alert(titulo, mensaje, botones, opciones),
  );

/** Una foto: de la cámara o de los archivos (la apertura de la galería de siempre). */
export function fotoConCamara<F extends { uri: string; fileName?: string | null }>(
  idioma: Idioma,
  camara: CamaraApp<F>,
  deArchivos: () => Promise<F | null>,
): Promise<F | null> {
  return fotoDe(idioma, camara, deArchivos, preguntarOrigenFoto);
}

/** Varias capturas (casos de ayuda): el selector de siempre, ahora con «Tomar foto». */
export function capturasConCamara(
  deArchivos: (maximo: number) => Promise<{ uri: string; nombre: string }[]>,
  camara: CamaraApp,
  idioma: Idioma,
) {
  return capturasDe(deArchivos, camara, idioma, preguntarOrigenFoto);
}
