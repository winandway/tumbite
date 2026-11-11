import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { URL_SERVIDOR, leerTokenGuardado } from '@tumbite/movil';
import { tocaMandarUbicacion } from '@tumbite/compartido';

/**
 * GPS en segundo plano (auditoría final, punto 23; Fase 2 del repartidor «como los grandes»):
 * mientras el repartidor está conectado, el celular sigue mandando su posición aunque la pantalla
 * esté apagada o la app detrás de Google Maps. Android lo muestra como servicio en primer plano
 * (notificación fija); iOS pide el permiso «Siempre». Sin permiso, sigue funcionando solo con la
 * app abierta, como antes.
 *
 * Android, versión 1 de las tiendas (27 oct 2026): la app NO pide el permiso de ubicación «todo el
 * tiempo» (ACCESS_BACKGROUND_LOCATION), que Google Play solo aprueba con un video de demostración.
 * No hace falta: el servicio en primer plano con notificación, iniciado con la app abierta, sigue
 * mandando la posición con la pantalla apagada (así lo permite expo-location y Android 10+).
 */
export const TAREA_UBICACION = 'tumbite-ubicacion-fondo';

/** C-LATIDO-UBICACION: el último envío desde la tarea (para mandar cada 2 minutos o al moverse). */
let ultimoEnvio: { lat: number; lng: number; en: number } | null = null;

TaskManager.defineTask(TAREA_UBICACION, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const ultima = locations.at(-1);
  if (!ultima) return;
  const punto = { lat: ultima.coords.latitude, lng: ultima.coords.longitude };
  // C-LATIDO-UBICACION: Android entrega una lectura cada 15 s aunque esté quieto; se manda solo si
  // se movió 25 m o pasaron 2 minutos (el latido que lo mantiene disponible).
  if (!tocaMandarUbicacion(ultimoEnvio, punto)) return;
  const token = await leerTokenGuardado();
  // Sin sesión (cerró sesión o venció): el servicio se apaga solo; no sigue gastando batería ni
  // queda la notificación fija.
  if (!token) return detenerUbicacionFondo();
  try {
    const r = await fetch(`${URL_SERVIDOR}/datos/repartidor/ubicacion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        lat: ultima.coords.latitude,
        lng: ultima.coords.longitude,
        precision: ultima.coords.accuracy ?? null,
        simulada: ultima.mocked === true,
      }),
    });
    if (r.status === 401) await detenerUbicacionFondo();
    else if (r.ok) ultimoEnvio = { ...punto, en: Date.now() };
  } catch {
    // Sin señal: la próxima lectura lo intenta otra vez.
  }
});

export async function iniciarUbicacionFondo(textos: {
  titulo: string;
  cuerpo: string;
}): Promise<boolean> {
  try {
    const primer = await Location.requestForegroundPermissionsAsync();
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
