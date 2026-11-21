import { SUFIJO_TAMANO, TAMANOS_FOTO, medidasWebp } from '@tumbite/compartido';
import { guardarFoto } from '../fotoLimpia';
import { Hono } from 'hono';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { exigirMiRestaurante } from './catalogo';
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
  // NXT-8: el dueño o un manager del equipo (como en DoorDash Merchant, el manager edita el menú y
  // los productos de la tienda); el staff no.
  const tiene = await base(c)
    .prepare(
      'SELECT 1 FROM restaurantes WHERE dueno_id = ?1 OR id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1)',
    )
    .bind(u.id)
    .first();
  if (!tiene) throw new ErrorDatos('Primero guarda los datos de tu restaurante.', undefined, 422);
  const rest = { id: await exigirMiRestaurante(c, 'manager') };

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

/**
 * C-DOCS-LUPA (15 nov 2026): la versión nítida de cada captura de Docs, para la lupa. Vive en el
 * almacén del sitio (`docs-grande/<nombre>-<huella>.webp`), no en el paquete: con ellas adentro, el
 * paquete pasó de 112 a 146 MB y la plataforma no lo pudo publicar («Memory limit exceeded»).
 * Las sube `scripts/docs/subir-capturas-grandes.mjs`. Solo lee: no escribe nada en la base.
 */
const CAPTURA_GRANDE = /^[a-z0-9-]{1,120}-[0-9a-f]{8}\.webp$/;

/**
 * C-AYUDA-INTERNA (16 nov 2026): las capturas del panel de operaciones (el superadmin) que alguna vez
 * estuvieron en Docs. Ya no se sirven al público (410): viven solo en la ayuda interna «?».
 */
export const CAPTURA_INTERNA =
  /^(monitoreo-|recorrido-moderacion-computadora-bandeja-|doble-firma-)/;

media.get('/media/docs-grande/:archivo', async (c) => {
  const { archivo } = c.req.param();
  if (!CAPTURA_GRANDE.test(archivo)) return c.text('No encontrado', 404);
  // C-AYUDA-INTERNA: las capturas del panel interno ya no son de Docs: no se sirven al público.
  if (CAPTURA_INTERNA.test(archivo))
    return c.text('Esta captura ya no existe.', 410, { 'X-Robots-Tag': 'noindex, nofollow' });
  const obj = await almacen(c.env).get(`docs-grande/${archivo}`);
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  headers.set('content-type', 'image/webp');
  headers.set('etag', obj.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  // La huella va en el nombre: si la captura cambia, cambia la dirección.
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
});

/**
 * C-PAQUETE-DIETA (21 nov 2026): las presentaciones en PDF de Docs. Viven en el almacén del sitio
 * (`docs-pdf/<nombre>.pdf`), no en el paquete: eran 14 MB de los 120 que admite la plataforma y el
 * paquete se quedó sin publicar. La dirección es la de siempre (/docs/presentaciones/<nombre>.pdf),
 * así ningún enlace compartido se rompe. Las sube `scripts/docs/subir-presentaciones.mjs`. Solo lee.
 */
const PDF_DOCS = /^[a-z0-9-]{1,100}\.pdf$/;

media.on(['GET', 'HEAD'], '/docs/presentaciones/:archivo', async (c) => {
  const { archivo } = c.req.param();
  if (!PDF_DOCS.test(archivo)) return c.text('No encontrado', 404);
  const clave = `docs-pdf/${archivo}`;
  const headers = new Headers({
    'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${archivo}"`,
    'x-content-type-options': 'nosniff',
    // El nombre no lleva huella: una hora de caché y la etiqueta para revalidar.
    'cache-control': 'public, max-age=3600',
  });
  if (c.req.method === 'HEAD') {
    const dato = await almacen(c.env).head(clave);
    if (!dato) return c.text('No encontrado', 404);
    if (typeof dato.size === 'number') headers.set('content-length', String(dato.size));
    headers.set('etag', dato.httpEtag);
    return new Response(null, { headers });
  }
  const obj = await almacen(c.env).get(clave);
  if (!obj) return c.text('No encontrado', 404);
  headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
});

/**
 * C-DOCS-VIDEO (19 nov 2026): los videos de Docs. Viven en el almacén del sitio
 * (`docs-video/<nombre>-<huella>.mp4`), nunca en el paquete; los sube `scripts/docs/subir-video.mjs`.
 * Se sirven por PARTES (cabecera Range): el iPhone no reproduce un video si el servidor no las
 * entiende, y con internet lento se baja solo lo que se va viendo. Solo lee: no escribe en la base.
 */
const VIDEO_DOCS = /^[a-z0-9-]{1,100}-[0-9a-f]{8}\.mp4$/;

/** Lee «bytes=a-b», «bytes=a-» o «bytes=-n» contra el tamaño del archivo. `null` = no se entiende. */
export function rangoPedido(cabecera: string, tamano: number) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let desde: number;
  let hasta: number;
  if (m[1] === '') {
    // Los últimos n bytes.
    const n = Number(m[2]);
    if (!n) return null;
    desde = Math.max(0, tamano - n);
    hasta = tamano - 1;
  } else {
    desde = Number(m[1]);
    hasta = m[2] === '' ? tamano - 1 : Math.min(Number(m[2]), tamano - 1);
  }
  if (desde >= tamano || desde > hasta) return null;
  return { desde, hasta };
}

media.on(['GET', 'HEAD'], '/media/docs-video/:archivo', async (c) => {
  const { archivo } = c.req.param();
  if (!VIDEO_DOCS.test(archivo)) return c.text('No encontrado', 404);
  const clave = `docs-video/${archivo}`;
  const dato = await almacen(c.env).head(clave);
  if (!dato) return c.text('No encontrado', 404);
  const tamano = dato.size;
  const headers = new Headers({
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    etag: dato.httpEtag,
    'x-content-type-options': 'nosniff',
    // La huella va en el nombre: si el video cambia, cambia la dirección.
    'cache-control': 'public, max-age=31536000, immutable',
  });
  const pedido = c.req.header('range');
  const rango = pedido ? rangoPedido(pedido, tamano) : null;
  if (pedido && !rango) {
    headers.set('content-range', `bytes */${tamano}`);
    return new Response(null, { status: 416, headers });
  }
  const largo = rango ? rango.hasta - rango.desde + 1 : tamano;
  headers.set('content-length', String(largo));
  if (rango) headers.set('content-range', `bytes ${rango.desde}-${rango.hasta}/${tamano}`);
  if (c.req.method === 'HEAD') return new Response(null, { status: rango ? 206 : 200, headers });
  const obj = await almacen(c.env).get(
    clave,
    rango ? { range: { offset: rango.desde, length: largo } } : undefined,
  );
  if (!obj) return c.text('No encontrado', 404);
  return new Response(obj.body, { status: rango ? 206 : 200, headers });
});
