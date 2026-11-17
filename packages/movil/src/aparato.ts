import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { llavero } from './llavero';

/**
 * C-CUPON-DIVOOX (17 nov 2026): la huella del aparato para el antifraude de los regalos de Divoox
 * (un regalo por teléfono, aunque la persona abra otra cuenta). Como Uber y DiDi: en Android el
 * identificador de la app en ese teléfono (sobrevive a reinstalar); en iPhone, el identificador del
 * fabricante para la app; si el sistema no lo da, uno al azar guardado en el llavero (que en iPhone
 * también sobrevive a reinstalar). El servidor solo guarda su huella (sha-256), nunca el valor.
 */
const LLAVE = 'divoox-aparato';
let actual: string | null = null;
let preparando: Promise<string | null> | null = null;

/** El identificador ya preparado (null hasta que `prepararAparato` termine). */
export const idAparato = () => actual;

function alAzar() {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function prepararAparato(): Promise<string | null> {
  if (actual) return Promise.resolve(actual);
  preparando ??= (async () => {
    try {
      if (Platform.OS === 'android') {
        const id = Application.getAndroidId();
        if (id) return (actual = `and-${id}`);
      } else if (Platform.OS === 'ios') {
        const id = await Application.getIosIdForVendorAsync();
        if (id) return (actual = `ios-${id}`);
      }
      const guardado = await llavero.leer(LLAVE);
      if (guardado) return (actual = guardado);
      const nuevo = `${Platform.OS}-${alAzar()}`;
      await llavero.guardar(LLAVE, nuevo);
      return (actual = nuevo);
    } catch (e) {
      console.error('aparato: no se pudo leer el identificador', e);
      preparando = null;
      return null;
    }
  })();
  return preparando;
}
