import type { Api } from '@tumbite/compartido';

/**
 * C-MENU-RAPIDO (4 nov 2026, Richard: «la pantalla queda en blanco 3 a 5 segundos»). La ficha de un
 * restaurante (menú, horarios, promociones) se guarda en memoria y se pide ANTES de tocarla para los
 * restaurantes que se ven en la portada, como hacen las apps grandes. Al abrirla sale al instante y se
 * refresca sola si ya tiene más de un minuto. Lo que se cobra lo vuelve a comprobar el servidor.
 */
const VIGENCIA_MS = 60_000;
/** Cuántas fichas se piden por adelantado (las primeras de la portada). */
export const FICHAS_ADELANTADAS = 6;

type Entrada = { en: number; promesa: Promise<unknown>; datos?: unknown };
const guardadas = new Map<string, Entrada>();

export function pedirFicha<T>(api: Api, id: string): Promise<T> {
  const ya = guardadas.get(id);
  if (ya && Date.now() - ya.en < VIGENCIA_MS) return ya.promesa as Promise<T>;
  const promesa = api.pedir<T>('GET', `/datos/restaurantes/${id}`).then((datos) => {
    const e = guardadas.get(id);
    if (e) e.datos = datos;
    return datos;
  });
  guardadas.set(id, { en: Date.now(), promesa, datos: ya?.datos });
  // Si falla, no se queda guardado el error: la próxima vez se vuelve a pedir.
  promesa.catch(() => {
    if (guardadas.get(id)?.promesa === promesa) guardadas.delete(id);
  });
  return promesa;
}

/** La última ficha que llegó, para pintarla al instante (o null si nunca se pidió). */
export function fichaGuardada<T>(id: string | undefined): T | null {
  if (!id) return null;
  return (guardadas.get(id)?.datos as T | undefined) ?? null;
}

/** Pide por adelantado las fichas de los primeros restaurantes que ve la persona. */
export function adelantarFichas(api: Api, ids: string[]): void {
  for (const id of ids.slice(0, FICHAS_ADELANTADAS))
    pedirFicha(api, id).catch((e: unknown) => console.warn('ficha adelantada', id, e));
}

/** Solo para pruebas. */
export function olvidarFichas() {
  guardadas.clear();
}
