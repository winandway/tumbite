import { TOPES_BANNER } from '@tumbite/compartido';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { guardarFoto } from '../fotoLimpia';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  type Banner,
  DESTINOS,
  LUGARES,
  type Lugar,
  SERVICIOS_DESTINO,
  abiertosDeZona,
  azarBanners,
  elegirPorPeso,
  filaABanner,
  generarOpciones,
  necesitaServicios,
  imagenesDeHoy,
  olvidarCacheBanners,
  ordenarPromociones,
  paisDeZona,
  paraLaApp,
  publicadosDe,
  reservarImagenes,
  segunServicio,
  topeImagenes,
  visiblesPara,
} from '../banners';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import { serviciosPublicosEnZona } from './servicios';

/**
 * C-BANNERS (17 nov 2026) — todos los países. La ruta pública que lee la app y el administrador del
 * superadmin. Lógica y reglas en `../banners.ts`.
 */
export const banners = new Hono<{ Bindings: Env; Variables: Variables }>();

const ZONA = /^[A-Za-z0-9-]{2,60}$/;
const ARCHIVO_IMAGEN = /^[a-z0-9-]{1,80}\.(?:webp|jpg|png)$/;
const PREFIJO_IMAGEN = '/media/fotos/banners/';
const imagenDeBanners = (v: string) =>
  v === '' || (v.startsWith(PREFIJO_IMAGEN) && ARCHIVO_IMAGEN.test(v.slice(PREFIJO_IMAGEN.length)));
const PAIS = /^[A-Z]{2}$/;

// ───────────────────────────── Pública: lo que lee la app ─────────────────────────────

/**
 * GET /datos/banners?lugar=cabecera|promociones&ciudad=<zona>&pais=<XX>&idioma=es|en&excluir=<id>
 * Solo lee (mirar no escribe) y lo leído se recuerda 60 s en memoria. La cabecera elige uno por peso
 * en cada llamada (por eso no se guarda en cachés compartidas); el carrusel se puede guardar 60 s.
 */
banners.get('/banners', async (c) => {
  const lugar = c.req.query('lugar');
  if (!(LUGARES as readonly string[]).includes(lugar ?? ''))
    throw new ErrorDatos('Ese lugar de banners no existe.', 'lugar', 400);
  const zonaQ = c.req.query('ciudad') ?? c.req.query('zona') ?? '';
  const paisQ = (c.req.query('pais') ?? '').toUpperCase();
  const zona = ZONA.test(zonaQ) ? zonaQ : null;
  const ahora = Date.now();
  const db = base(c);
  const pais = PAIS.test(paisQ) ? paisQ : zona ? await paisDeZona(db, zona, ahora) : null;
  // El inglés es el idioma principal (EE. UU.); el español, cuando la app lo pide.
  const idioma = c.req.query('idioma') === 'es' ? 'es' : 'en';
  const origen = new URL(c.req.url).origin;
  const porCiudad = visiblesPara(
    await publicadosDe(db, lugar as Lugar, ahora),
    { zona, pais },
    ahora,
  );
  // C-BANNER-SEGUN-SERVICIO: el anuncio de un servicio solo donde ese servicio se puede pedir.
  const visibles = necesitaServicios(porCiudad)
    ? segunServicio(
        porCiudad,
        zona ? await abiertosDeZona(zona, ahora, (z) => serviciosPublicosEnZona(db, z)) : null,
      )
    : porCiudad;
  if (lugar === 'cabecera') {
    const elegido = elegirPorPeso(visibles, azarBanners.siguiente(), c.req.query('excluir'));
    const res = c.json({
      lugar,
      banner: elegido ? paraLaApp(elegido, idioma, origen) : null,
      candidatos: visibles.length,
    });
    res.headers.set('cache-control', 'no-store');
    return res;
  }
  const res = c.json({
    lugar,
    banners: ordenarPromociones(visibles).map((b) => paraLaApp(b, idioma, origen)),
  });
  res.headers.set('cache-control', 'public, max-age=60');
  return res;
});

// ───────────────────────────── Superadmin ─────────────────────────────

const fecha = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const esquemaBanner = z.object({
  lugar: z.enum(LUGARES),
  // Vacía, o una imagen guardada por el administrador de banners en el almacén del sitio.
  imagen: z.string().max(300).refine(imagenDeBanners),
  tituloEs: z
    .string()
    .trim()
    .max(TOPES_BANNER.titulo, {
      error: `El titular puede tener hasta ${TOPES_BANNER.titulo} caracteres para que quepa en el teléfono.`,
    }),
  tituloEn: z
    .string()
    .trim()
    .max(TOPES_BANNER.titulo, {
      error: `El titular puede tener hasta ${TOPES_BANNER.titulo} caracteres para que quepa en el teléfono.`,
    }),
  textoEs: z
    .string()
    .trim()
    .max(TOPES_BANNER.texto, {
      error: `El texto puede tener hasta ${TOPES_BANNER.texto} caracteres para que quepa en el teléfono.`,
    }),
  textoEn: z
    .string()
    .trim()
    .max(TOPES_BANNER.texto, {
      error: `El texto puede tener hasta ${TOPES_BANNER.texto} caracteres para que quepa en el teléfono.`,
    }),
  destinoTipo: z.enum(DESTINOS),
  destinoValor: z.string().trim().max(80),
  codigo: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9_-]*$/),
  zonas: z.array(z.string().regex(ZONA)).max(200),
  paises: z.array(z.string().regex(PAIS)).max(60),
  inicio: fecha,
  fin: fecha,
  peso: z.number().int().min(1).max(100),
  orden: z.number().int().min(0).max(1000),
  idea: z.string().trim().max(500).optional().default(''),
});
type DatosBanner = z.infer<typeof esquemaBanner>;

function fechasBien(d: { inicio: string | null; fin: string | null }) {
  if (d.inicio && d.fin && Date.parse(d.fin) <= Date.parse(d.inicio))
    throw new ErrorDatos('La fecha de fin tiene que ser después de la de inicio.', 'fin');
}

async function leerBanner(db: D1Database, id: string): Promise<Banner> {
  const f = await db.prepare('SELECT * FROM banners WHERE id = ?').bind(id).first();
  if (!f) throw new ErrorDatos('Ese banner no existe.', undefined, 404);
  return filaABanner(f);
}

const valores = (d: DatosBanner) => [
  d.lugar,
  d.imagen,
  d.tituloEs,
  d.tituloEn,
  d.textoEs,
  d.textoEn,
  d.destinoTipo,
  d.destinoValor,
  d.codigo.toUpperCase(),
  JSON.stringify([...new Set(d.zonas)]),
  JSON.stringify([...new Set(d.paises)]),
  d.inicio,
  d.fin,
  d.peso,
  d.orden,
  d.idea,
];

banners.get('/admin/banners', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const ahora = Date.now();
  const [lista, zonas, comercios, cupones, hoy] = await Promise.all([
    db
      .prepare('SELECT * FROM banners ORDER BY lugar, orden, creado_en DESC LIMIT 500')
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT id, nombre, pais, activa FROM zonas ORDER BY pais, nombre LIMIT 500')
      .all<{ id: string; nombre: string; pais: string; activa: number }>(),
    db
      .prepare(
        `SELECT id, nombre, tipo_comercio, zona_id FROM restaurantes WHERE estado = 'aprobado'
         ORDER BY nombre LIMIT 500`,
      )
      .all<{ id: string; nombre: string; tipo_comercio: string; zona_id: string }>(),
    db
      .prepare(
        'SELECT codigo, descripcion_es, descripcion_en FROM cupones WHERE activo = 1 ORDER BY codigo LIMIT 300',
      )
      .all<{ codigo: string; descripcion_es: string; descripcion_en: string }>(),
    imagenesDeHoy(db, ahora),
  ]);
  const res = c.json({
    banners: lista.results.map(filaABanner),
    opciones: {
      zonas: zonas.results.map((z) => ({ ...z, activa: Boolean(z.activa) })),
      servicios: SERVICIOS_DESTINO,
      comercios: comercios.results.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo_comercio === 'restaurante' ? 'restaurante' : 'tienda',
        zona: r.zona_id,
      })),
      cupones: cupones.results.map((x) => ({
        codigo: x.codigo,
        descripcionEs: x.descripcion_es,
        descripcionEn: x.descripcion_en,
      })),
    },
    ia: {
      disponible: Boolean(c.env.FAL_KEY),
      hoy: hoy.imagenes,
      tope: topeImagenes(c.env),
    },
  });
  res.headers.set('cache-control', 'private, no-store');
  return res;
});

banners.post('/admin/banners', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaBanner);
  fechasBien(d);
  const id = nuevoId();
  await base(c)
    .prepare(
      `INSERT INTO banners (lugar, imagen, titulo_es, titulo_en, texto_es, texto_en, destino_tipo,
        destino_valor, codigo, zonas, paises, inicio, fin, peso, orden, idea, id, creado_por, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'borrador')`,
    )
    .bind(...valores(d), id, u.id)
    .run();
  return c.json({ banner: await leerBanner(base(c), id) }, 201);
});

/** Editar. Un banner publicado que se cambia vuelve a borrador: lo nuevo también se aprueba. */
banners.put('/admin/banners/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const antes = await leerBanner(db, id);
  const d = await leerCuerpo(c, esquemaBanner);
  fechasBien(d);
  await db
    .prepare(
      `UPDATE banners SET lugar = ?, imagen = ?, titulo_es = ?, titulo_en = ?, texto_es = ?,
        texto_en = ?, destino_tipo = ?, destino_valor = ?, codigo = ?, zonas = ?, paises = ?,
        inicio = ?, fin = ?, peso = ?, orden = ?, idea = ?,
        estado = CASE WHEN estado = 'publicado' THEN 'borrador' ELSE estado END,
        actualizado_en = datetime('now') WHERE id = ?`,
    )
    .bind(...valores(d), id)
    .run();
  if (antes.estado === 'publicado') olvidarCacheBanners();
  return c.json({ banner: await leerBanner(db, id) });
});

/** Lo que tiene que estar completo para salir al público. */
async function revisarParaPublicar(db: D1Database, b: Banner) {
  if (!b.imagen) throw new ErrorDatos('Falta la imagen del banner.', 'imagen', 422);
  if (!b.tituloEs || !b.tituloEn)
    throw new ErrorDatos('Falta el titular en español y en inglés.', 'tituloEs', 422);
  if (b.fin && Date.parse(b.fin) <= Date.now())
    throw new ErrorDatos('La fecha de fin ya pasó. Cámbiala para publicarlo.', 'fin', 422);
  if (!b.destinoValor)
    throw new ErrorDatos('Elige a dónde lleva el banner al tocarlo.', 'destinoValor', 422);
  if (
    b.destinoTipo === 'servicio' &&
    !(SERVICIOS_DESTINO as readonly string[]).includes(b.destinoValor)
  )
    throw new ErrorDatos('Ese servicio no existe.', 'destinoValor', 422);
  if (b.destinoTipo === 'restaurante' || b.destinoTipo === 'tienda') {
    const r = await db
      .prepare("SELECT tipo_comercio FROM restaurantes WHERE id = ? AND estado = 'aprobado'")
      .bind(b.destinoValor)
      .first<{ tipo_comercio: string }>();
    const tipo = r ? (r.tipo_comercio === 'restaurante' ? 'restaurante' : 'tienda') : null;
    if (tipo !== b.destinoTipo)
      throw new ErrorDatos('Ese comercio no existe o no está aprobado.', 'destinoValor', 422);
  }
  if (b.destinoTipo === 'cupon') {
    const r = await db
      .prepare('SELECT 1 FROM cupones WHERE codigo = ? AND activo = 1')
      .bind(b.destinoValor)
      .first();
    if (!r) throw new ErrorDatos('Ese cupón no existe o está apagado.', 'destinoValor', 422);
  }
  if (b.zonas.length) {
    const r = await db
      .prepare(`SELECT COUNT(*) AS n FROM zonas WHERE id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(b.zonas))
      .first<{ n: number }>();
    if (Number(r?.n ?? 0) !== b.zonas.length)
      throw new ErrorDatos('Alguna de las ciudades elegidas ya no existe.', 'zonas', 422);
  }
}

/** «Aprobar y publicar»: lo único que manda un banner al público. */
banners.post('/admin/banners/:id/publicar', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  await revisarParaPublicar(db, await leerBanner(db, id));
  await db
    .prepare(
      `UPDATE banners SET estado = 'publicado', aprobado_por = ?, aprobado_en = datetime('now'),
        actualizado_en = datetime('now') WHERE id = ?`,
    )
    .bind(u.id, id)
    .run();
  olvidarCacheBanners();
  return c.json({ banner: await leerBanner(db, id) });
});

banners.post('/admin/banners/:id/pausar', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const b = await leerBanner(db, id);
  if (b.estado !== 'publicado')
    throw new ErrorDatos('Solo se pausa un banner publicado.', undefined, 409);
  await db
    .prepare("UPDATE banners SET estado = 'pausado', actualizado_en = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
  olvidarCacheBanners();
  return c.json({ banner: await leerBanner(db, id) });
});

banners.delete('/admin/banners/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  await leerBanner(db, id);
  await db.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();
  olvidarCacheBanners();
  return c.json({ ok: true });
});

/** La imagen del banner (subida o elegida de las opciones con IA, ya pasada a WebP en el panel). */
banners.post('/admin/banners/imagen', limiteIntentos(30, 60_000), async (c) => {
  exigir(c, 'admin');
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  const ext = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  const clave = `fotos/banners/${nuevoId()}.${ext}`;
  await guardarFoto(c.env.BUCKET, clave, bytes, tipo, {
    cacheControl: 'public, max-age=31536000, immutable',
  });
  return c.json({ url: `/media/${clave}` }, 201);
});

/** «Generar con IA»: 2 o 3 opciones con el modelo barato aprobado, dentro del tope diario. */
banners.post('/admin/banners/generar', limiteIntentos(10, 60_000), async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      idea: z.string().trim().min(8).max(500),
      lugar: z.enum(LUGARES),
      cantidad: z.number().int().min(2).max(3).optional().default(3),
    }),
  );
  if (!c.env.FAL_KEY)
    throw new ErrorDatos(
      'La creación de imágenes con IA no está conectada en este sitio. Sube la imagen desde archivos.',
      undefined,
      409,
    );
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const db = base(c);
  const ahora = Date.now();
  const tope = topeImagenes(c.env);
  if (!(await reservarImagenes(db, d.cantidad, tope, ahora)))
    throw new ErrorDatos(
      'Ya se usaron todas las imágenes con IA de hoy. Mañana hay más, o sube la imagen desde archivos.',
      undefined,
      429,
    );
  const opciones = await generarOpciones(
    c.env,
    db,
    c.env.BUCKET,
    d.idea,
    d.lugar,
    d.cantidad,
    ahora,
  );
  const hoy = await imagenesDeHoy(db, ahora);
  return c.json({ opciones, hoy: hoy.imagenes, tope });
});
