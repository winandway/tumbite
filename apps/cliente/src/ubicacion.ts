import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { conLimite } from '@tumbite/compartido';
import {
  type EstadoReintento,
  SIN_FALLOS,
  debePedirPermiso,
  despuesDeIntentar,
  puedeIntentar,
} from './ubicacionReintento';

export type Punto = { lat: number; lng: number };

/** Lo que se espera a la ubicación: si el teléfono no contesta, la app sigue sin ella. */
export const ESPERA_UBICACION_MS = 8000;

/**
 * C-UBICACION-SIN-BUCLE (18 nov 2026): una sola espera para toda la app. Sin GPS, los intentos
 * automáticos esperan cada vez más (5 s, 10 s… hasta 5 min) en vez de repetirse sin pausa; un
 * toque de la persona (`aMano`) intenta enseguida.
 */
let reintento: EstadoReintento = SIN_FALLOS;

async function leerPosicion(): Promise<Punto | null> {
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    reintento = despuesDeIntentar(reintento, true, Date.now());
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) {
    reintento = despuesDeIntentar(reintento, false, Date.now());
    console.warn(
      `ubicación: no disponible (intento ${reintento.fallos}; el próximo automático en ${Math.round(
        (reintento.proximo - Date.now()) / 1000,
      )} s)`,
      e,
    );
    return null;
  }
}

/**
 * La ubicación SOLO si la persona ya dio permiso antes: no dispara la pregunta del permiso (abrir un
 * mapa no debe hacerlo). Con el mismo límite de espera que `miUbicacion`.
 */
export function ubicacionSiHayPermiso(opciones: { aMano?: boolean } = {}): Promise<Punto | null> {
  if (!puedeIntentar(reintento, Date.now(), opciones.aMano)) return Promise.resolve(null);
  return conLimite(
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      return leerPosicion();
    })().catch((e: unknown) => {
      console.warn('ubicación: no se pudo mirar el permiso', e);
      return null;
    }),
    ESPERA_UBICACION_MS,
    null,
  );
}

/**
 * Pide la ubicación solo mientras se usa la app. Si la persona dice que no, deja el permiso sin
 * responder o el teléfono no la encuentra, se sigue sin ella (candado C-UBICACION-NO-FRENA).
 *
 * C-UBICACION-SIN-BUCLE: primero se MIRA el permiso; la pantalla del permiso se abre solo si falta,
 * se puede preguntar y la app está a la vista (Android bloquea y apila las que se abren desde
 * segundo plano). Pasa `{ aMano: true }` cuando la persona tocó «Usar mi ubicación».
 */
export function miUbicacion(opciones: { aMano?: boolean } = {}): Promise<Punto | null> {
  if (!puedeIntentar(reintento, Date.now(), opciones.aMano)) return Promise.resolve(null);
  return conLimite(
    (async () => {
      const ahora = await Location.getForegroundPermissionsAsync();
      let concedido = ahora.status === 'granted';
      if (
        debePedirPermiso({
          concedido,
          sePuedePreguntar: ahora.canAskAgain !== false,
          appActiva: AppState.currentState === 'active',
        })
      )
        concedido = (await Location.requestForegroundPermissionsAsync()).status === 'granted';
      if (!concedido) return null;
      return leerPosicion();
    })().catch((e: unknown) => {
      console.warn('ubicación: no se pudo pedir el permiso', e);
      return null;
    }),
    ESPERA_UBICACION_MS,
    null,
  );
}
