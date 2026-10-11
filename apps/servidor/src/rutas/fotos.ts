import { Hono } from 'hono';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * Fotos de restaurantes y platos. Se guardan en el almacén del sitio (env.BUCKET) y se sirven
 * desde /media/fotos/<restaurante>/<archivo>. El panel ya las manda reducidas (máx. 1200 px, WebP).
 */
export const fotos = new Hono<{ Bindings: Env; Variables: Variables }>();
export const media = new Hono<{ Bindings: Env; Variables: Variables }>();

export const MAX_FOTO_BYTES = 3 * 1024 * 1024;

type Tipo = 'image/webp' | 'image/jpeg' | 'image/png';
const EXTENSION = new Map<Tipo, string>([
  ['image/webp', 'webp'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);

/** Mira los primeros bytes: el tipo que dice el navegador no basta. */
export function tipoReal(b: Uint8Array): Tipo | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}

function almacen(env: Env): R2Bucket {
  if (!env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  return env.BUCKET;
}

fotos.post('/mi-restaurante/fotos', async (c) => {
  const u = exigir(c, 'restaurante');
  const rest = await base(c)
    .prepare('SELECT id FROM restaurantes WHERE dueno_id = ?')
    .bind(u.id)
    .first<{ id: string }>();
  if (!rest) throw new ErrorDatos('Primero guarda los datos de tu restaurante.', undefined, 422);

  const largo = Number(c.req.header('content-length') ?? 0);
  if (largo > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);

  const clave = `fotos/${rest.id}/${nuevoId()}.${EXTENSION.get(tipo) ?? 'bin'}`;
  await almacen(c.env).put(clave, bytes, {
    httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return c.json({ url: `/media/${clave}` }, 201);
});

const NOMBRE_SEGURO = /^[a-z0-9-]{1,64}$/;
const ARCHIVO_SEGURO = /^[a-z0-9-]{1,64}\.(webp|jpg|png)$/;

media.get('/media/fotos/:restaurante/:archivo', async (c) => {
  const { restaurante, archivo } = c.req.param();
  if (!NOMBRE_SEGURO.test(restaurante) || !ARCHIVO_SEGURO.test(archivo))
    return c.text('No encontrado', 404);
  const obj = await almacen(c.env).get(`fotos/${restaurante}/${archivo}`);
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  if (!headers.has('cache-control'))
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
});
