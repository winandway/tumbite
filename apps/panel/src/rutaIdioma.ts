import type { Idioma } from '@tumbite/compartido';

/**
 * El inglés es el idioma principal (regla de Richard, 13 oct 2026): las páginas públicas sin
 * prefijo están en inglés y la misma página en español vive bajo /es. El panel y las apps no
 * llevan prefijo: cambian de idioma solos. Candado C-INGLES-PRINCIPAL.
 */
const SIN_PREFIJO = /^\/(panel|app|driver|repartidor|datos|es|t)(\/|$|#|\?)/;

export const enEspanol = (ruta: string) => ruta === '/es' || ruta.startsWith('/es/');

/** /es/country/brazil → /country/brazil ; /es → / */
export const sinIdioma = (ruta: string) => (enEspanol(ruta) ? ruta.slice(3) || '/' : ruta);

/** La misma página en el idioma pedido: /country/brazil + es → /es/country/brazil */
export function conIdioma(ruta: string, idioma: Idioma): string {
  const base = sinIdioma(ruta);
  if (idioma !== 'es' || !base.startsWith('/') || SIN_PREFIJO.test(base)) return base;
  return base === '/' ? '/es' : `/es${base}`;
}
