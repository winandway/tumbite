import type { Idioma } from '@tumbite/compartido';

/**
 * El título de la pestaña, con la misma regla que usa el prerender (scripts/prerender.mjs): la
 * portada tiene el suyo y las demás páginas usan su encabezado principal. Así, al navegar dentro
 * del sitio o del panel, la pestaña cambia con la página y con el idioma, y nunca se queda en
 * inglés en una pantalla en español. Candado C-TITULO-IDIOMA.
 */
export const TITULO_PORTADA: Record<Idioma, string> = {
  en: 'Divoox · Food, stores and packages delivered',
  es: 'Divoox · Comida, tiendas y paquetes a domicilio',
};

/** El panel sin encabezado (por ejemplo, Pedidos) no se presenta como la portada pública. */
export const TITULO_PANEL: Record<Idioma, string> = {
  en: 'Business panel · Divoox',
  es: 'Panel de tu negocio · Divoox',
};

export function tituloPagina(
  encabezado: string,
  portada: boolean,
  idioma: Idioma,
  panel = false,
): string {
  const h1 = encabezado.replace(/\s+/g, ' ').trim();
  if (!h1 && panel && !portada) return idioma === 'en' ? TITULO_PANEL.en : TITULO_PANEL.es;
  if (portada || !h1) return idioma === 'en' ? TITULO_PORTADA.en : TITULO_PORTADA.es;
  return /divoox/i.test(h1) ? h1 : `${h1} · Divoox`;
}
