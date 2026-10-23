import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { URL_SERVIDOR, leerTokenGuardado } from '@tumbite/movil';

/**
 * GPS en segundo plano (auditoría final, punto 23; Fase 2 del repartidor «como los grandes»):
 * mientras el repartidor está conectado, el celular sigue mandando su posición aunque la pantalla
 * esté apagada o la app detrás de Google Maps. Android lo muestra como servicio en primer plano
 * (notificación fija); iOS pide el permiso «Siempre». Sin permiso, sigue funcionando solo con la
 * app abierta, como antes.
 */
export const TAREA_UBICACION = 'tumbite-ubicacion-fondo';

TaskManager.defineTask(TAREA_UBICACION, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const ultima = locations.at(-1);
  if (!ultima) return;
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
      }),
    });
    if (r.status === 401) await detenerUbicacionFondo();
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
    const fondo = await Location.requestBackgroundPermissionsAsync();
    if (fondo.status !== 'granted') return false;
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) return true;
    await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 30,
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
