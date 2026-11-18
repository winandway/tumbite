import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { conLimite, direccionDelSitio } from '@tumbite/compartido';
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

/**
 * C-CALLE-CON-LIMITE (18 nov 2026, revisor): la calle legible de un punto (calle, sector, ciudad),
 * con el geocodificador del teléfono y un TOPE de tiempo. En Android sin red el geocodificador puede
 * no contestar nunca: sin tope, «leyendo la calle» quedaba para siempre y el pedido no cotizaba.
 * Si tarda, falla o no hay calle, devuelve '' y cada pantalla usa su texto de siempre. Es la ÚNICA
 * forma de leer una calle en la app (ninguna pantalla llama a reverseGeocodeAsync directo).
 */
export const ESPERA_CALLE_MS = 4000;
export async function calleDelPunto(p: Punto): Promise<string> {
  const leida = await conLimite<string | null>(
    Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng }).then(
      ([sitio]) => direccionDelSitio(sitio),
      (e: unknown) => {
        console.warn('ubicación: no se pudo leer la calle del punto', e);
        return '';
      },
    ),
    ESPERA_CALLE_MS,
    null,
  );
  if (leida === null) console.warn(`ubicación: la calle no llegó en ${ESPERA_CALLE_MS} ms`);
  return leida ?? '';
}

/**
 * C-ABRIR-AJUSTES (18 nov 2026, revisor): en qué quedó el permiso de ubicación. «bloqueado» es
 * cuando la persona lo negó y el teléfono ya no deja volver a preguntar (Android, dos «No»): la
 * pantalla ofrece «Abrir ajustes» en vez de solo decirlo.
 */
export async function permisoUbicacion(): Promise<'concedido' | 'preguntar' | 'bloqueado'> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.status === 'granted') return 'concedido';
    return p.canAskAgain === false ? 'bloqueado' : 'preguntar';
  } catch (e) {
    console.warn('ubicación: no se pudo mirar el permiso', e);
    return 'preguntar';
  }
}

/**
 * C-PEDIR-OTRA-VEZ (18 nov 2026): la última ubicación que el teléfono ya conoce, AL INSTANTE (sin
 * esperar una lectura nueva del GPS, que tarda unos segundos). Solo con el permiso ya dado; si no
 * hay o es de hace más de 10 minutos, null. Después se afina con `miUbicacion`.
 */
export async function ultimaUbicacionConocida(): Promise<Punto | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
  } catch (e) {
    console.warn('ubicación: no hay una última conocida', e);
    return null;
  }
}
