/**
 * Niveles de repartidor (docs/investigacion-apps-y-rangos.md). Se sube con puntos
 * (10 por entrega) y se mantiene con calidad. Los nombres son provisionales hasta que Richard elija.
 */
export const NIVELES = [
  { clave: 'bronce', minimo: 0, es: 'Bronce', en: 'Bronze' },
  { clave: 'plata', minimo: 500, es: 'Plata', en: 'Silver' },
  { clave: 'oro', minimo: 1500, es: 'Oro', en: 'Gold' },
  { clave: 'diamante', minimo: 4000, es: 'Diamante', en: 'Diamond' },
] as const;

export type Nivel = {
  clave: (typeof NIVELES)[number]['clave'];
  indice: number;
  es: string;
  en: string;
  puntos: number;
  siguiente: { es: string; en: string; faltan: number } | null;
  /** Cuánto lleva del camino al siguiente nivel, de 0 a 1 (1 en el nivel más alto). */
  avance: number;
};

export function nivelDe(puntos: number): Nivel {
  const p = Math.max(0, Math.floor(puntos));
  let indice = 0;
  NIVELES.forEach((n, i) => {
    if (p >= n.minimo) indice = i;
  });
  const actual = NIVELES.at(indice) ?? NIVELES[0];
  const sig = NIVELES.at(indice + 1);
  return {
    clave: actual.clave,
    indice,
    es: actual.es,
    en: actual.en,
    puntos: p,
    siguiente: sig ? { es: sig.es, en: sig.en, faltan: sig.minimo - p } : null,
    avance: sig ? (p - actual.minimo) / (sig.minimo - actual.minimo) : 1,
  };
}
