import type { Guia } from './guias';

/** C-DOCS-BUSCADOR (14 nov 2026): sin acentos ni mayúsculas, para que «pago movil» encuentre «pago móvil». */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Palabras de relleno que no ayudan a encontrar una guía («cómo», «de», «the»…). */
const RELLENO = new Set([
  'a',
  'al',
  'como',
  'con',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'lo',
  'los',
  'mi',
  'mis',
  'por',
  'que',
  'se',
  'un',
  'una',
  'y',
  'the',
  'an',
  'how',
  'do',
  'i',
  'my',
  'to',
  'of',
  'in',
  'on',
  'for',
]);

/** Las palabras de lo que se escribió en el buscador, sin las de relleno. */
export function palabrasDeBusqueda(texto: string): string[] {
  const todas = normalizar(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter(Boolean);
  const utiles = todas.filter((p) => !RELLENO.has(p));
  return utiles.length ? utiles : todas;
}

/** La guía coincide si cada palabra aparece en su título, resumen, preguntas, explicación o pasos. */
export function coincide(g: Guia, palabras: string[]): boolean {
  const texto = normalizar(
    [g.titulo, g.resumen, ...(g.preguntas ?? []), ...(g.explicacion ?? []), ...g.pasos].join(' '),
  );
  return palabras.every((p) => texto.includes(p));
}
