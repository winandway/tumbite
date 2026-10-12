import type { Idioma } from '@tumbite/compartido';

/**
 * Versión en inglés de las páginas públicas bajo /en (para que Google indexe el inglés: el
 * mercado es Estados Unidos). El panel y las apps no llevan prefijo: cambian de idioma solos.
 */
const SIN_PREFIJO = /^\/(panel|app|repartidor|datos|en)(\/|$|#|\?)/;

export const enIngles = (ruta: string) => ruta === '/en' || ruta.startsWith('/en/');

/** /en/pais/brasil → /pais/brasil ; /en → / */
export const sinIdioma = (ruta: string) => (enIngles(ruta) ? ruta.slice(3) || '/' : ruta);

/** La misma página en el idioma pedido: /pais/brasil + en → /en/pais/brasil */
export function conIdioma(ruta: string, idioma: Idioma): string {
  const base = sinIdioma(ruta);
  if (idioma !== 'en' || !base.startsWith('/') || SIN_PREFIJO.test(base)) return base;
  return base === '/' ? '/en' : `/en${base}`;
}
