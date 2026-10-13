import type { Idioma } from '@tumbite/compartido';

/**
 * El título de la pestaña, con la misma regla que usa el prerender (scripts/prerender.mjs): la
 * portada tiene el suyo y las demás páginas usan su encabezado principal. Así, al navegar dentro
 * del sitio o del panel, la pestaña cambia con la página y con el idioma, y nunca se queda en
 * inglés en una pantalla en español. Candado C-TITULO-IDIOMA.
 */
export const TITULO_PORTADA: Record<Idioma, string> = {
  en: 'Tumbite · Food delivery in Miami',
  es: 'Tumbite · Comida a domicilio en Miami',
};

export function tituloPagina(encabezado: string, portada: boolean, idioma: Idioma): string {
  const h1 = encabezado.replace(/\s+/g, ' ').trim();
  if (portada || !h1) return idioma === 'en' ? TITULO_PORTADA.en : TITULO_PORTADA.es;
  return /tumbite/i.test(h1) ? h1 : `${h1} · Tumbite`;
}
