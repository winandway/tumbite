/**
 * C-DOMINIO-DIVOOX (23 oct 2026): divoox.com es la dirección principal. Las páginas pedidas en
 * tumbite.com, www.tumbite.com o www.divoox.com pasan para siempre (301) a https://divoox.com con
 * la misma ruta, para que Google indexe una sola dirección.
 *
 * NO se redirige lo que no es una página: `/datos/*` (las apps compiladas antes del 25 oct y los
 * avisos de los proveedores pueden seguir llamando a tumbite.com y una redirección rompería un POST),
 * `/media/*` (fotos), `/turnstile.html` (la verificación que abren por dentro las apps viejas) y
 * `/robots.txt` (Google tiene que poder leerlo en tumbite.com para seguir los 301).
 * El mapa del sitio viejo del dueño anterior de divoox.com (`/sitemap_index.xml`) lleva al nuestro.
 *
 * C-TUMBITE-REDIRIGE (27 nov 2026, Richard): el 301 solo existía en el código; la plataforma servía
 * las páginas fijas sin pasar por el servidor y tumbite.com/app seguía saliendo en Google. Ahora las
 * páginas viajan en el paquete dentro de CARPETA_PAGINAS (scripts/paginas-por-servidor.mjs) y las
 * sirve SIEMPRE el servidor, que redirige primero.
 */
export const DOMINIO_PRINCIPAL = 'divoox.com';
export const SECUNDARIOS = new Set(['tumbite.com', 'www.tumbite.com', 'www.divoox.com']);
/** Los dominios viejos de la marca anterior: todo lo que sigue respondiendo ahí va con noindex. */
export const DOMINIOS_VIEJOS = new Set(['tumbite.com', 'www.tumbite.com']);
/** Carpeta del paquete donde viajan las páginas (.html) para que la plataforma no las sirva sola. */
export const CARPETA_PAGINAS = '/_paginas';

const SIN_REDIRECCION = ['/datos', '/media'];
const ARCHIVOS_SIN_REDIRECCION = new Set(['/turnstile.html', '/robots.txt']);

export function redireccionDominio(url: URL, metodo: string): string | null {
  if (metodo !== 'GET' && metodo !== 'HEAD') return null;
  const host = url.hostname.toLowerCase();
  const esPrincipal = host === DOMINIO_PRINCIPAL;
  if (!esPrincipal && !SECUNDARIOS.has(host)) return null;
  if (SIN_REDIRECCION.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`)))
    return null;
  if (ARCHIVOS_SIN_REDIRECCION.has(url.pathname)) return null;
  // Quien llegue a la carpeta interna de páginas ve la dirección pública de esa página.
  const sinCarpeta = url.pathname.startsWith(`${CARPETA_PAGINAS}/`)
    ? url.pathname.slice(CARPETA_PAGINAS.length)
    : url.pathname;
  const ruta = sinCarpeta === '/sitemap_index.xml' ? '/sitemap.xml' : sinCarpeta;
  if (esPrincipal && ruta === url.pathname) return null;
  return `https://${DOMINIO_PRINCIPAL}${ruta}${url.search}`;
}

export const esDominioViejo = (host: string) =>
  DOMINIOS_VIEJOS.has(host.toLowerCase().split(':')[0] ?? '');
