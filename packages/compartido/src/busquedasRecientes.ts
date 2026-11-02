import type { Almacen } from './borrador';
import { normalizar } from './filtrosComida';

/**
 * Búsquedas recientes del buscador del cliente (C-BUSQUEDAS-RECIENTES), como DoorDash y Uber Eats:
 * bajo la casilla salen las últimas búsquedas, se tocan para repetirlas y se borran una o todas.
 * Viven solo en el teléfono de esa persona y la llave lleva su cuenta, para que en un teléfono
 * compartido no aparezcan las de otro. Lógica pura: la pantalla solo la usa.
 */
export const MAX_BUSQUEDAS_RECIENTES = 8;

/** Llave del almacén: una por cuenta (o «invitado» si nadie entró). */
export const llaveBusquedas = (usuarioId?: string | null) =>
  `divoox:busquedas-recientes:${usuarioId || 'invitado'}`;

/** Lee la lista; si está rota o no es una lista de textos, devuelve vacía (nunca rompe la pantalla). */
export async function leerBusquedas(almacen: Almacen, llave: string): Promise<string[]> {
  try {
    const crudo = await almacen.leer(llave);
    if (!crudo) return [];
    const lista: unknown = JSON.parse(crudo);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((x): x is string => typeof x === 'string' && x.trim().length >= 2)
      .slice(0, MAX_BUSQUEDAS_RECIENTES);
  } catch (e) {
    console.warn('busquedas recientes: no se pudo leer', e);
    return [];
  }
}

/**
 * Suma una búsqueda arriba de todo. Si ya estaba (sin importar mayúsculas ni acentos) se sube en
 * vez de repetirse, y la lista nunca pasa de ocho. Menos de dos letras no cuenta como búsqueda.
 */
export function sumarBusqueda(lista: string[], texto: string): string[] {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (t.length < 2) return lista;
  const n = normalizar(t);
  return [t, ...lista.filter((x) => normalizar(x) !== n)].slice(0, MAX_BUSQUEDAS_RECIENTES);
}

/** Quita una búsqueda de la lista (la «×» de cada fila). */
export const quitarBusqueda = (lista: string[], texto: string) =>
  lista.filter((x) => normalizar(x) !== normalizar(texto));

/** Guarda la lista; vacía, borra la llave para no dejar basura en el teléfono. */
export async function guardarBusquedas(
  almacen: Almacen,
  llave: string,
  lista: string[],
): Promise<void> {
  try {
    if (!lista.length) await almacen.borrar(llave);
    else await almacen.guardar(llave, JSON.stringify(lista.slice(0, MAX_BUSQUEDAS_RECIENTES)));
  } catch (e) {
    console.warn('busquedas recientes: no se pudo guardar', e);
  }
}
