import * as Location from 'expo-location';

export type Punto = { lat: number; lng: number };

/** Pide la ubicación solo mientras se usa la app. Si la persona dice que no, se sigue sin ella. */
export async function miUbicacion(): Promise<Punto | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) {
    console.warn('ubicación: no disponible', e);
    return null;
  }
}
