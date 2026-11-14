import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { URL_SERVIDOR, leerTokenGuardado } from '@tumbite/movil';
import {
  colaUbicacion,
  cuerpoUbicacion,
  marcarRecibida,
  modoGuardadoAlArrancar,
  paraEnviarUbicacion,
  necesitaExplicacionPrevia,
  tocaMandarSegunModo,
  type ModoRastreo,
} from '@tumbite/compartido';

/**
 * GPS con la pantalla apagada (auditoría final, punto 23; C-GPS-FONDO y C-GPS-PANTALLA-APAGADA,
 * todos los países): mientras el conductor está conectado o tiene un pedido, viaje o ruta en
 * curso, el celular sigue mandando su posición aunque la pantalla esté apagada o la app detrás de
 * Google Maps. Android lo muestra como servicio en primer plano (notificación fija); iOS pide el
 * permiso «Siempre». Sin permiso, sigue funcionando solo con la app abierta, como antes.
 *
 * Android (27 oct 2026): la app NO pide el permiso «todo el tiempo» (ACCESS_BACKGROUND_LOCATION),
 * que Google Play solo aprueba con un video. No hace falta: un servicio en primer plano de tipo
 * ubicación, iniciado con la app abierta y el permiso «mientras se usa la app», sigue recibiendo
 * la posición con la pantalla apagada (Android 10+; así lo documenta expo-location).
 */
export const TAREA_UBICACION = 'tumbite-ubicacion-fondo';

/** C-LATIDO-UBICACION: el último envío desde la tarea (para mandar cada 2 minutos o al moverse). */
let ultimoEnvio: { lat: number; lng: number; en: number } | null = null;
/**
 * C-GPS-PANTALLA-APAGADA: lo fija el inicio con modoRastreo (libre, activo o apagado) y queda
 * guardado. Arranca sin saberse (null): si el sistema relanza la tarea sin abrir la pantalla, se lee
 * el guardado (antes arrancaba en «libre» y con un pedido en curso mandaba cada 250 m).
 */
let modoActual: ModoRastreo | null = null;
const LLAVE_MODO = 'divoox.modo-rastreo';
const cola = colaUbicacion();

export function fijarModoRastreo(modo: ModoRastreo) {
  modoActual = modo;
  void AsyncStorage.setItem(LLAVE_MODO, modo).catch(() => undefined);
}

async function modoAlArrancar(): Promise<ModoRastreo> {
  if (modoActual) return modoActual;
  const [guardado, token] = await Promise.all([
    AsyncStorage.getItem(LLAVE_MODO).catch(() => null),
    leerTokenGuardado(),
  ]);
  modoActual = modoGuardadoAlArrancar(guardado, Boolean(token));
  return modoActual;
}

TaskManager.defineTask(TAREA_UBICACION, async ({ data, error }) => {
  if (error || !data) return;
  const modo = await modoAlArrancar();
  // Nunca se rastrea a alguien desconectado: si el inicio dijo «apagado», el servicio se cierra.
  if (modo === 'apagado') return detenerUbicacionFondo();
  const { locations } = data as { locations: Location.LocationObject[] };
  const ultima = locations.at(-1);
  if (!ultima) return;
  // Revisión 2: la edad se mide con el reloj del celular desde que llega aquí, no con la hora del GPS.
  const cuerpo = cuerpoUbicacion(marcarRecibida(ultima));
  const pendiente = cola.tomar();
  // C-LATIDO-UBICACION: Android entrega una lectura cada 15 s aunque esté quieto; se manda solo si
  // toca según el modo (activo cada 25 m, libre cada 250 m) o pasaron 2 minutos. Si quedó una
  // lectura sin mandar por falta de señal, la nueva la reemplaza y se intenta en seguida.
  if (!pendiente && !tocaMandarSegunModo(modo, ultimoEnvio, cuerpo)) return;
  const token = await leerTokenGuardado();
  // Sin sesión (cerró sesión o venció): el servicio se apaga solo; no sigue gastando batería ni
  // queda la notificación fija.
  if (!token) return detenerUbicacionFondo();
  try {
    const r = await fetch(`${URL_SERVIDOR}/datos/repartidor/ubicacion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      // C-LATIDO-UBICACION: con la hora de la lectura; una lectura de la cola ya vieja no cuenta.
      body: JSON.stringify(paraEnviarUbicacion(cuerpo)),
    });
    if (r.status === 401) await detenerUbicacionFondo();
    else if (r.ok) ultimoEnvio = { lat: cuerpo.lat, lng: cuerpo.lng, en: Date.now() };
    else if (r.status >= 500) cola.guardar(cuerpo);
  } catch {
    // Sin señal: se guarda la última lectura (cola corta) y la próxima la intenta otra vez.
    cola.guardar(cuerpo);
  }
});

/** Como Dasher: antes del cuadro del sistema, una explicación de para qué se usa la ubicación. */
function explicar(t: { titulo: string; cuerpo: string; seguir: string; ahoraNo: string }) {
  return new Promise<boolean>((ok) =>
    Alert.alert(t.titulo, t.cuerpo, [
      { text: t.ahoraNo, style: 'cancel', onPress: () => ok(false) },
      { text: t.seguir, onPress: () => ok(true) },
    ]),
  );
}

export async function iniciarUbicacionFondo(textos: {
  titulo: string;
  cuerpo: string;
  explicacion?: { titulo: string; cuerpo: string; seguir: string; ahoraNo: string };
}): Promise<boolean> {
  try {
    const actual = await Location.getForegroundPermissionsAsync();
    if (textos.explicacion && necesitaExplicacionPrevia(actual)) {
      if (!(await explicar(textos.explicacion))) return false;
    }
    const primer = actual.granted ? actual : await Location.requestForegroundPermissionsAsync();
    if (primer.status !== 'granted') return false;
    if (Platform.OS === 'ios') {
      const fondo = await Location.requestBackgroundPermissionsAsync();
      if (fondo.status !== 'granted') return false;
    }
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) return true;
    await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
      accuracy: Location.Accuracy.High,
      // C-LATIDO-UBICACION: en Android la lectura llega por tiempo aunque no se mueva (con 30 m
      // exigía moverse); iOS no usa el tiempo, sigue con 30 m y el latido lo da la app abierta.
      distanceInterval: Platform.OS === 'android' ? 0 : 30,
      timeInterval: 15_000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: textos.titulo,
        notificationBody: textos.cuerpo,
        notificationColor: '#F20D20',
      },
    });
    return true;
  } catch (e) {
    console.warn('ubicación en segundo plano: no se pudo iniciar', e);
    return false;
  }
}

export async function detenerUbicacionFondo(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION))
      await Location.stopLocationUpdatesAsync(TAREA_UBICACION);
  } catch {
    // ya estaba detenida
  }
}
