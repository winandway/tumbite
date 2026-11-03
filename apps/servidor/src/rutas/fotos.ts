import { SUFIJO_TAMANO, TAMANOS_FOTO, medidasWebp } from '@tumbite/compartido';
import { guardarFoto } from '../fotoLimpia';
import { Hono } from 'hono';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * Fotos de restaurantes y platos. Se guardan en el almacén del sitio (env.BUCKET) y se sirven
 * desde /media/fotos/<restaurante>/<archivo>. El panel y la app del restaurante las mandan ya
 * convertidas a WebP (C-FOTOS-LIVIANAS, NXT-7): primero la completa y después, con
 * `?de=<id>&tam=tarjeta|miniatura`, sus tamaños chicos, que se guardan como `<id>-m.webp` y
 * `<id>-s.webp`. Si un tamaño no existe (foto vieja), /media entrega la completa.
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

  // NXT-7: un tamaño chico de una foto que ya subió este restaurante. Solo WebP, con su lado y su
  // peso máximos (una miniatura que pesa como la completa no ahorra nada).
  const de = c.req.query('de');
  const tam = c.req.query('tam');
  if (de !== undefined || tam !== undefined) {
    if (!de || !NOMBRE_SEGURO.test(de) || (tam !== 'tarjeta' && tam !== 'miniatura'))
      throw new ErrorDatos('Ese tamaño de foto no existe.', 'foto', 400);
    if (!(await almacen(c.env).head(`fotos/${rest.id}/${de}.webp`)))
      throw new ErrorDatos('Primero sube la foto completa.', 'foto', 404);
    const medidas = tipo === 'image/webp' ? medidasWebp(bytes) : null;
    const regla = tam === 'tarjeta' ? TAMANOS_FOTO.tarjeta : TAMANOS_FOTO.miniatura;
    if (
      !medidas ||
      Math.max(medidas.ancho, medidas.alto) > regla.lado ||
      bytes.byteLength > regla.maxBytes
    )
      throw new ErrorDatos('Ese tamaño de foto no cumple las medidas.', 'foto', 422);
    const claveTam = `fotos/${rest.id}/${de}-${tam === 'tarjeta' ? SUFIJO_TAMANO.tarjeta : SUFIJO_TAMANO.miniatura}.webp`;
    await guardarFoto(almacen(c.env), claveTam, bytes, tipo, {
      cacheControl: 'public, max-age=31536000, immutable',
    });
    return c.json({ url: `/media/${claveTam}` }, 201);
  }

  const clave = `fotos/${rest.id}/${nuevoId()}.${EXTENSION.get(tipo) ?? 'bin'}`;
  await guardarFoto(almacen(c.env), clave, bytes, tipo, {
    cacheControl: 'public, max-age=31536000, immutable',
  });
  return c.json({ url: `/media/${clave}` }, 201);
});

const NOMBRE_SEGURO = /^[a-z0-9-]{1,64}$/;
const ARCHIVO_SEGURO = /^[a-z0-9-]{1,64}\.(webp|jpg|png)$/;

media.get('/media/fotos/:restaurante/:archivo', async (c) => {
  const { restaurante, archivo } = c.req.param();
  if (!NOMBRE_SEGURO.test(restaurante) || !ARCHIVO_SEGURO.test(archivo))
    return c.text('No encontrado', 404);
  let obj = await almacen(c.env).get(`fotos/${restaurante}/${archivo}`);
  // NXT-7: una foto vieja sin su tamaño chico entrega la completa (sin caché larga, por si se
  // vuelve a subir con sus tamaños).
  const tamano = /^([a-z0-9-]+)-(s|m)\.webp$/.exec(archivo);
  let respaldo = false;
  if (!obj && tamano) {
    for (const ext of ['webp', 'jpg', 'png']) {
      obj = await almacen(c.env).get(`fotos/${restaurante}/${tamano[1]}.${ext}`);
      if (obj) break;
    }
    respaldo = Boolean(obj);
  }
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  if (respaldo) headers.set('cache-control', 'public, max-age=300');
  else if (!headers.has('cache-control'))
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
});
