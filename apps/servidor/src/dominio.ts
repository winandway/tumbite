/**
 * C-DOMINIO-DIVOOX (23 oct 2026): divoox.com es la dirección principal. Las páginas pedidas en
 * tumbite.com, www.tumbite.com o www.divoox.com pasan para siempre (301) a https://divoox.com con
 * la misma ruta, para que Google indexe una sola dirección.
 *
 * NO se redirige lo que no es una página: `/datos/*` (las apps compiladas y el aviso de Stripe
 * siguen llamando a tumbite.com y una redirección rompería un POST) y `/media/*` (fotos).
 * El mapa del sitio viejo del dueño anterior de divoox.com (`/sitemap_index.xml`) lleva al nuestro.
 */
export const DOMINIO_PRINCIPAL = 'divoox.com';
export const SECUNDARIOS = new Set(['tumbite.com', 'www.tumbite.com', 'www.divoox.com']);

export function redireccionDominio(url: URL, metodo: string): string | null {
  if (metodo !== 'GET' && metodo !== 'HEAD') return null;
  const host = url.hostname.toLowerCase();
  const esPrincipal = host === DOMINIO_PRINCIPAL;
  if (!esPrincipal && !SECUNDARIOS.has(host)) return null;
  if (url.pathname.startsWith('/datos') || url.pathname.startsWith('/media')) return null;
  const ruta = url.pathname === '/sitemap_index.xml' ? '/sitemap.xml' : url.pathname;
  if (esPrincipal && ruta === url.pathname) return null;
  return `https://${DOMINIO_PRINCIPAL}${ruta}${url.search}`;
}
