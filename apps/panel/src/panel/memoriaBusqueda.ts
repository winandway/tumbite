/**
 * C-BUSCADOR-INSTANTANEO (16 nov 2026, pedido de Richard: «sé muy exigente en el buscador porque va
 * a ser la mano derecha de nosotros cuando tengamos miles de facturas»). Todos los países.
 *
 * Lo ya buscado se guarda en la memoria de esta pestaña (nunca en el disco ni en el servidor): al
 * borrar una letra o volver a escribir lo mismo, la respuesta sale al instante sin pedir nada. Pasada
 * la vigencia se muestra igual lo guardado y se pide de nuevo por detrás (los estados cambian).
 */

/** La pausa entre teclas antes de pedir: corta, para que sugiera mientras se escribe. */
export const PAUSA_TECLAS_MS = 120;
/** Cuánto tiempo una respuesta guardada se usa sin volver a pedir. */
export const VIGENCIA_MEMORIA_MS = 15_000;
/** Cuántas búsquedas distintas se guardan como mucho (las más viejas salen primero). */
export const TOPE_MEMORIA = 60;

export type Memoria<T> = {
  /** Lo guardado para esa búsqueda y si todavía está vigente; null si no hay nada. */
  leer: (clave: string) => { valor: T; vigente: boolean } | null;
  guardar: (clave: string, valor: T) => void;
  limpiar: () => void;
};

/** Todas las memorias creadas, para vaciarlas juntas (entre una prueba y otra). */
const TODAS: Memoria<unknown>[] = [];
export function olvidarTodasLasBusquedas() {
  for (const m of TODAS) m.limpiar();
}

export function crearMemoria<T>(ahora: () => number = () => Date.now()): Memoria<T> {
  const guardadas = new Map<string, { en: number; valor: T }>();
  const memoria: Memoria<T> = {
    leer(clave) {
      const x = guardadas.get(clave);
      return x ? { valor: x.valor, vigente: ahora() - x.en < VIGENCIA_MEMORIA_MS } : null;
    },
    guardar(clave, valor) {
      guardadas.delete(clave);
      guardadas.set(clave, { en: ahora(), valor });
      while (guardadas.size > TOPE_MEMORIA) {
        const vieja = guardadas.keys().next().value;
        if (vieja === undefined) break;
        guardadas.delete(vieja);
      }
    },
    limpiar() {
      guardadas.clear();
    },
  };
  TODAS.push(memoria as Memoria<unknown>);
  return memoria;
}
