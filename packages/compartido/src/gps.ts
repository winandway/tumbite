import { distanciaKm } from './catalogo';
import { RADIO_LLEGADA_M } from './llegada';

/**
 * Llegada confiable (como proponen los estudios): no basta un punto en el mapa. Hacen falta dos
 * lecturas recientes, precisas y coherentes dentro del radio, y ninguna lectura con un salto
 * imposible (ubicación simulada, GPS loco).
 */
export type Muestra = { lat: number; lng: number; precisionM: number | null; en: number };

/** Precisión máxima aceptable que reporta el celular (en edificios suele ser peor). */
export const PRECISION_MAXIMA_M = 60;
/** Dos lecturas tienen que estar dentro de esta ventana para contar juntas. */
export const VENTANA_MUESTRAS_MS = 90_000;
/** Más rápido que esto entre dos lecturas no es un repartidor: es un GPS simulado o roto. */
export const VELOCIDAD_MAXIMA_MS = 50; // 180 km/h

const metros = (a: Muestra, b: Muestra) => distanciaKm(a, b) * 1000;

/** ¿La lectura nueva es un salto imposible respecto a la anterior? */
export function saltoImposible(anterior: Muestra | null, nueva: Muestra): boolean {
  if (!anterior) return false;
  const seg = Math.max(1, (nueva.en - anterior.en) / 1000);
  return metros(anterior, nueva) / seg > VELOCIDAD_MAXIMA_MS;
}

/**
 * ¿Llegó de verdad? Las dos lecturas más recientes (dentro de la ventana) tienen que ser precisas,
 * estar a menos de 100 m entre sí y las dos dentro del radio del destino.
 */
export function llegadaConfiable(
  muestras: Muestra[],
  destino: { lat: number; lng: number } | null,
  radio = RADIO_LLEGADA_M,
  ahora = Date.now(),
): { llego: boolean; motivo: 'sin-lecturas' | 'imprecisa' | 'incoherente' | 'lejos' | 'ok' } {
  if (!destino) return { llego: true, motivo: 'ok' };
  const recientes = muestras
    .filter((m) => ahora - m.en <= VENTANA_MUESTRAS_MS)
    .sort((a, b) => b.en - a.en)
    .slice(0, 2);
  if (recientes.length < 2) return { llego: false, motivo: 'sin-lecturas' };
  const [a, b] = recientes as [Muestra, Muestra];
  if ((a.precisionM ?? 0) > PRECISION_MAXIMA_M || (b.precisionM ?? 0) > PRECISION_MAXIMA_M)
    return { llego: false, motivo: 'imprecisa' };
  if (metros(a, b) > 100) return { llego: false, motivo: 'incoherente' };
  const dentro = (m: Muestra) => distanciaKm(m, destino) * 1000 <= radio;
  if (!dentro(a) || !dentro(b)) return { llego: false, motivo: 'lejos' };
  return { llego: true, motivo: 'ok' };
}
