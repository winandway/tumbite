/**
 * Azar con semilla: la misma semilla repite la misma corrida (mismos nombres, mismas rutas de GPS,
 * mismas «manías»). Generador mulberry32: pequeño, rápido y suficiente para pruebas (no es
 * criptográfico ni lo necesita).
 */
export type Azar = {
  semilla: number;
  /** Número entre 0 (incluido) y 1 (excluido). */
  numero(): number;
  /** Entero entre min y max, los dos incluidos. */
  entero(min: number, max: number): number;
  elegir<T>(opciones: readonly T[]): T;
  /** Verdadero con esa probabilidad (0 a 1). */
  moneda(probabilidad?: number): boolean;
  /** Texto corto de letras y números (para correos y nombres de la corrida). */
  id(largo?: number): string;
};

export function crearAzar(semilla: number): Azar {
  let s = semilla >>> 0;
  const numero = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number) => min + Math.floor(numero() * (max - min + 1));
  return {
    semilla: semilla >>> 0,
    numero,
    entero,
    elegir: <T>(opciones: readonly T[]) => {
      if (!opciones.length) throw new Error('azar: no hay opciones para elegir');
      return opciones[entero(0, opciones.length - 1)] as T;
    },
    moneda: (probabilidad = 0.5) => numero() < probabilidad,
    id: (largo = 6) => {
      const letras = 'abcdefghijkmnpqrstuvwxyz23456789';
      let x = '';
      for (let i = 0; i < largo; i++) x += letras[entero(0, letras.length - 1)];
      return x;
    },
  };
}

/** Semilla a partir de un texto (o una nueva si no hay): así «--semilla 123» o «--semilla abc» repiten. */
export function semillaDe(texto?: string | null): number {
  if (texto == null || texto === '') return Math.floor(Math.random() * 2 ** 31);
  if (/^\d+$/.test(texto)) return Number(texto) >>> 0;
  let h = 2166136261;
  for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
