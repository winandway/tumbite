import { PRECISION_MEDICION_M, TOPE_MOVIMIENTO_KM, distanciaKm } from '@tumbite/compartido';

/**
 * C-ESTOY-AQUI en Driver: qué le dice la pantalla al conductor según su GPS. El botón «Estoy aquí»
 * aparece SOLO con la precisión mínima; si no, se explica qué hacer (nunca un botón apagado mudo).
 */
export type EstadoGps =
  | { tipo: 'sin-permiso' }
  | { tipo: 'buscando' }
  | { tipo: 'esperar'; precisionM: number }
  | { tipo: 'lejos'; metros: number }
  | { tipo: 'listo'; precisionM: number; metros: number };

export type LecturaGps = { lat: number; lng: number; precisionM: number | null; hora: number };

/** Una lectura vale 30 s: más vieja, se espera otra. */
export const LECTURA_VIGENTE_MS = 30_000;

export function estadoGps(
  lectura: LecturaGps | null,
  lugar: { lat: number; lng: number },
  permiso: boolean,
  ahora: number,
): EstadoGps {
  if (!permiso) return { tipo: 'sin-permiso' };
  if (!lectura || ahora - lectura.hora > LECTURA_VIGENTE_MS) return { tipo: 'buscando' };
  const metros = Math.round(distanciaKm(lectura, lugar) * 1000);
  if (metros > TOPE_MOVIMIENTO_KM * 1000) return { tipo: 'lejos', metros };
  const p = lectura.precisionM;
  if (p == null || !(p > 0) || p > PRECISION_MEDICION_M)
    return { tipo: 'esperar', precisionM: p == null ? 999 : Math.round(p) };
  return { tipo: 'listo', precisionM: Math.round(p), metros };
}
