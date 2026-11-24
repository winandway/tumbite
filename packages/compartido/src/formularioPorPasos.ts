import type { Idioma } from './idiomas';

/**
 * C-FORMULARIO-POR-PASOS (24 nov 2026, orden de Richard) — todos los países. Como Uber, DoorDash y
 * Rappi, los formularios largos de las apps son un carrusel de pasos cortos: una o pocas casillas por
 * pantalla, la barra de avance arriba (en verde), «Atrás» y «Siguiente» grandes, el error al lado de
 * la casilla que falla y, junto al botón, por qué no avanza. El paso en el que iba la persona se
 * guarda en su borrador (useBorrador) y vuelve al reabrir.
 *
 * Esta es la lógica pura (sin React) que usan la pieza `FormularioPorPasos` de las apps y sus pruebas.
 */

/** Un paso: su clave fija (la que se guarda en el borrador) y las casillas que muestra. */
export type PasoDeFormulario = { clave: string; casillas: readonly string[] };

/** El índice del paso guardado; uno que ya no existe (o vacío) vuelve al primero. */
export function indiceDePaso(
  pasos: readonly PasoDeFormulario[],
  clave: string | null | undefined,
): number {
  const i = pasos.findIndex((p) => p.clave === clave);
  return i < 0 ? 0 : i;
}

/** La clave del paso que se muestra: la guardada si existe; si no, la del primero. */
export function pasoVigente(
  pasos: readonly PasoDeFormulario[],
  clave: string | null | undefined,
): string {
  return pasos[indiceDePaso(pasos, clave)]?.clave ?? '';
}

/** El paso que muestra esa casilla (para llevar a la persona al error que dijo el servidor). */
export function pasoDeCasilla(
  pasos: readonly PasoDeFormulario[],
  casilla: string | null | undefined,
): string | null {
  if (!casilla) return null;
  return pasos.find((p) => p.casillas.includes(casilla))?.clave ?? null;
}

/** La clave del paso siguiente (o null si es el último). */
export function pasoSiguiente(pasos: readonly PasoDeFormulario[], clave: string): string | null {
  return pasos[indiceDePaso(pasos, clave) + 1]?.clave ?? null;
}

/** La clave del paso anterior (o null si es el primero). */
export function pasoAnterior(pasos: readonly PasoDeFormulario[], clave: string): string | null {
  const i = indiceDePaso(pasos, clave);
  return i > 0 ? (pasos[i - 1]?.clave ?? null) : null;
}

/** Lo lleno de la barra: el paso 1 de 4 ya muestra un cuarto (nunca una barra vacía). */
export function fraccionDeAvance(indice: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (indice + 1) / total));
}

const TEXTOS = {
  es: {
    paso: (i: number, n: number) => `Paso ${i} de ${n}`,
    siguiente: 'Siguiente',
    atras: 'Atrás',
    falta: 'Para seguir, revisa lo marcado en rojo.',
  },
  en: {
    paso: (i: number, n: number) => `Step ${i} of ${n}`,
    siguiente: 'Next',
    atras: 'Back',
    falta: 'To continue, check what’s marked in red.',
  },
} as const;

export function textosPasos(idioma: Idioma) {
  return idioma === 'en' ? TEXTOS.en : TEXTOS.es;
}
