import { CAJAS_ESTADOS } from './cajasEstados';
import type { LugarCuenta } from './lugarCuenta';

/**
 * C-REGISTRO-TODO-EL-PAIS (26 nov 2026; Venezuela y Estados Unidos). El punto que llega con un lugar
 * tiene que caer dentro de la caja de SU estado (la de todos sus lugares del catálogo, más un margen
 * de unos 5 km). Así nadie dice «Maracaibo, Zulia» con el punto de Miami para caer en una zona ajena.
 * Barato y sin base de datos: 75 cajas generadas con el catálogo (scripts/lugares/cajas.mjs).
 */
export const MARGEN_CAJA_ESTADO = 0.05;

export function lugarEnSuEstado(l: Pick<LugarCuenta, 'pais' | 'estado' | 'lat' | 'lng'>): boolean {
  const caja = CAJAS_ESTADOS[`${l.pais}-${l.estado}`];
  if (!caja) return false;
  const [minLat, maxLat, minLng, maxLng] = caja;
  const m = MARGEN_CAJA_ESTADO;
  return l.lat >= minLat - m && l.lat <= maxLat + m && l.lng >= minLng - m && l.lng <= maxLng + m;
}
