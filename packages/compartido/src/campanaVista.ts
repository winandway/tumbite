import type { Api } from './api';

/**
 * C-CAMPANA-SE-VACIA (23 nov 2026, Richard) — la pieza ÚNICA de la campana de las apps (cliente y
 * Divoox Driver; web, Android y iPhone son el mismo código). La campana es de LECTURA: su punto o su
 * número cuenta solo lo que esa persona todavía no vio (`sinLeer`, lo calcula el servidor por cuenta).
 * Al abrir la lista de avisos, se guarda en el servidor «visto hasta» el aviso más nuevo: UNA escritura
 * como mucho, y ninguna si no había nada nuevo. Lo leído en un aparato tampoco sale nuevo en otro.
 */
export type CampanaApp = 'cliente' | 'repartidor';

type AvisoConFecha = { en?: string; leido?: boolean };

/** La fecha del aviso más nuevo de la lista («visto hasta» ahí). */
export const hastaDeAvisos = (avisos: readonly AvisoConFecha[]) =>
  avisos.reduce((h, a) => (a.en && a.en > h ? a.en : h), '');

/** ¿Hay algo que esa persona todavía no vio? (los servidores viejos no traen `leido`: nada). */
export const hayNuevos = (avisos: readonly AvisoConFecha[]) =>
  avisos.some((a) => a.leido === false);

/**
 * El gesto de abrir la campana: guarda «visto hasta» SOLO si había algo nuevo. Devuelve si escribió.
 * Un fallo de red no rompe la pantalla: se intenta la próxima vez que la abra.
 */
export async function marcarCampanaVista(
  api: Pick<Api, 'pedir'>,
  campana: CampanaApp,
  avisos: readonly AvisoConFecha[],
): Promise<boolean> {
  const hasta = hastaDeAvisos(avisos);
  if (!hasta || !hayNuevos(avisos)) return false;
  try {
    await api.pedir('POST', '/datos/campana/visto', { campana, hasta });
    return true;
  } catch (e) {
    console.warn('campana: no se pudo guardar lo visto', e);
    return false;
  }
}
