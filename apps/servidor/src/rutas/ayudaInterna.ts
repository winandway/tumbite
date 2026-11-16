import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, exigir } from '../sesion';
import { AYUDA_INTERNA, CAPTURAS_AYUDA } from '../ayudaInterna/guias';

/**
 * C-AYUDA-INTERNA (16 nov 2026, Richard) — todos los países. La ayuda del equipo («?» del
 * superadmin): solo con la sesión de una cuenta del equipo (rol admin; el mapa de permisos la marca
 * `libre`: cualquier persona activa del equipo). Nunca se guarda en cachés compartidas ni la indexa
 * ningún buscador. Solo lee: no escribe nada en la base.
 */
export const ayudaInterna = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Cabeceras de todo lo de la ayuda: privada, sin caché compartida y fuera de los buscadores. */
function privada(h: Headers, cache: string) {
  h.set('cache-control', cache);
  h.set('x-robots-tag', 'noindex, nofollow, noarchive');
  h.set('x-content-type-options', 'nosniff');
}

/** Lleva cada captura a su dirección privada (la ruta de abajo). */
const conDireccion = (idioma: 'es' | 'en') =>
  (idioma === 'en' ? AYUDA_INTERNA.en : AYUDA_INTERNA.es).map((s) => ({
    ...s,
    guias: s.guias.map((g) => ({
      ...g,
      capturas: (g.capturas ?? []).map((c) => ({
        src: `/datos/admin/ayuda/captura/${c.archivo}`,
        alt: c.alt,
        pie: c.pie,
      })),
    })),
  }));

const SECCIONES = { es: conDireccion('es'), en: conDireccion('en') };

ayudaInterna.get('/admin/ayuda', (c) => {
  exigir(c, 'admin');
  const idioma = c.req.query('idioma') === 'en' ? 'en' : 'es';
  const res = c.json({ secciones: idioma === 'en' ? SECCIONES.en : SECCIONES.es });
  privada(res.headers, 'private, no-store');
  return res;
});

ayudaInterna.get('/admin/ayuda/captura/:archivo', async (c) => {
  exigir(c, 'admin');
  const { archivo } = c.req.param();
  // Solo las capturas que la ayuda usa: el resto del almacén no se abre por aquí.
  if (!CAPTURAS_AYUDA.has(archivo) || !c.env.BUCKET) return c.text('No encontrado', 404);
  const obj = await c.env.BUCKET.get(`ayuda-interna/${archivo}`);
  if (!obj) {
    console.error(`ayuda interna: falta la captura ${archivo} en el almacén`);
    return c.text('No encontrado', 404);
  }
  const headers = new Headers();
  headers.set('content-type', 'image/webp');
  headers.set('etag', obj.httpEtag);
  privada(headers, 'private, max-age=3600');
  return new Response(obj.body, { headers });
});
