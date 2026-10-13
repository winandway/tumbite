import * as Location from 'expo-location';
import { conLimite } from '@tumbite/compartido';

export type Punto = { lat: number; lng: number };

/** Lo que se espera a la ubicación: si el teléfono no contesta, la app sigue sin ella. */
export const ESPERA_UBICACION_MS = 8000;

/**
 * Pide la ubicación solo mientras se usa la app. Si la persona dice que no, deja el permiso sin
 * responder o el teléfono no la encuentra, se sigue sin ella (candado C-UBICACION-NO-FRENA).
 */
export function miUbicacion(): Promise<Punto | null> {
  return conLimite(
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    })().catch((e: unknown) => {
      console.warn('ubicación: no disponible', e);
      return null;
    }),
    ESPERA_UBICACION_MS,
    null,
  );
}
