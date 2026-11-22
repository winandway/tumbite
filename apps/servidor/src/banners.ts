import type { Env } from './env';
import { nuevoId } from './cripto';
import { guardarFoto } from './fotoLimpia';
import { MODELO_BANNERS, asegurarModeloBarato } from './modeloGuard';
import { tipoReal } from './rutas/fotos';
import { ErrorDatos } from './validar';

/**
 * C-BANNERS (17 nov 2026, Richard, vía Gerencia) — todos los países.
 *
 * El administrador de banners del inicio de la app del cliente. Dos lugares:
 *  - «cabecera»: el banner grande de arriba (fondo oscuro, titular grande, producto a la derecha).
 *    Sale UNO cada vez que se abre o se refresca el inicio, elegido al azar por su peso.
 *  - «promociones»: el carrusel de tarjetas rojas con titular y código. Sale la lista entera, en orden.
 *
 * Reglas que no se tocan:
 *  - Al público solo llega lo «publicado» (lo aprobó una persona con «Aprobar y publicar»), vigente por
 *    fecha y de esa ciudad o país. Un borrador o un pausado NUNCA sale por la ruta pública.
 *  - Mirar no escribe (regla de la nube): la ruta pública solo lee, y lo que lee se guarda 60 segundos
 *    en la memoria del aislado, así mil aperturas del inicio son una sola lectura por minuto.
 *  - Las imágenes con IA salen SOLO del modelo barato aprobado (modeloGuard) y con tope diario.
 */
export const LUGARES = ['cabecera', 'promociones'] as const;
export type Lugar = (typeof LUGARES)[number];
export const ESTADOS = ['borrador', 'publicado', 'pausado'] as const;
export type EstadoBanner = (typeof ESTADOS)[number];
export const DESTINOS = ['servicio', 'restaurante', 'tienda', 'cupon'] as const;
export type TipoDestino = (typeof DESTINOS)[number];
/** Los servicios que pueden ser destino de un banner (los del catálogo de servicios). */
export const SERVICIOS_DESTINO = [
  'comida',
  'moto',
  'carro',
  'mercado',
  'envios',
  'farmacia',
  'licores',
] as const;

export type Banner = {
  id: string;
  lugar: Lugar;
  estado: EstadoBanner;
  imagen: string;
  tituloEs: string;
  tituloEn: string;
  textoEs: string;
  textoEn: string;
  destinoTipo: TipoDestino;
  destinoValor: string;
  codigo: string;
  zonas: string[];
  paises: string[];
  inicio: string | null;
  fin: string | null;
  peso: number;
  orden: number;
  idea: string;
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

const lista = (v: unknown): string[] => {
  try {
    const x: unknown = JSON.parse(String(v ?? '[]'));
    return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

export function filaABanner(f: Record<string, unknown>): Banner {
  return {
    id: String(f.id),
    lugar: f.lugar === 'promociones' ? 'promociones' : 'cabecera',
    estado: (ESTADOS as readonly string[]).includes(String(f.estado))
      ? (f.estado as EstadoBanner)
      : 'borrador',
    imagen: String(f.imagen ?? ''),
    tituloEs: String(f.titulo_es ?? ''),
    tituloEn: String(f.titulo_en ?? ''),
    textoEs: String(f.texto_es ?? ''),
    textoEn: String(f.texto_en ?? ''),
    destinoTipo: (DESTINOS as readonly string[]).includes(String(f.destino_tipo))
      ? (f.destino_tipo as TipoDestino)
      : 'servicio',
    destinoValor: String(f.destino_valor ?? ''),
    codigo: String(f.codigo ?? ''),
    zonas: lista(f.zonas),
    paises: lista(f.paises),
    inicio: f.inicio ? String(f.inicio) : null,
    fin: f.fin ? String(f.fin) : null,
    peso: Number(f.peso ?? 1),
    orden: Number(f.orden ?? 0),
    idea: String(f.idea ?? ''),
    aprobadoPor: f.aprobado_por ? String(f.aprobado_por) : null,
    aprobadoEn: f.aprobado_en ? String(f.aprobado_en) : null,
    creadoEn: String(f.creado_en ?? ''),
    actualizadoEn: String(f.actualizado_en ?? ''),
  };
}

/** Vigente por fecha: ya empezó (o no tiene inicio) y todavía no terminó (o no tiene fin). */
export function vigente(b: Pick<Banner, 'inicio' | 'fin'>, ahoraMs: number): boolean {
  const ini = b.inicio ? Date.parse(b.inicio) : NaN;
  const fin = b.fin ? Date.parse(b.fin) : NaN;
  if (!Number.isNaN(ini) && ahoraMs < ini) return false;
  if (!Number.isNaN(fin) && ahoraMs >= fin) return false;
  return true;
}

/**
 * ¿Sale en esta ciudad? Sin ciudades ni países = en todas partes. Con ciudades, en esas ciudades;
 * con países, en cualquier ciudad de esos países. Sin ciudad ni país en la petición, solo los globales.
 */
export function aplicaA(
  b: Pick<Banner, 'zonas' | 'paises'>,
  donde: { zona: string | null; pais: string | null },
): boolean {
  if (b.zonas.length === 0 && b.paises.length === 0) return true;
  if (donde.zona && b.zonas.includes(donde.zona)) return true;
  if (donde.pais && b.paises.includes(donde.pais)) return true;
  return false;
}

/** Lo que el público puede ver: publicado, vigente y de esa ciudad o país. */
export function visiblesPara(
  todos: Banner[],
  donde: { zona: string | null; pais: string | null },
  ahoraMs: number,
): Banner[] {
  return todos.filter((b) => b.estado === 'publicado' && vigente(b, ahoraMs) && aplicaA(b, donde));
}

/**
 * C-BANNER-SEGUN-SERVICIO (22 nov 2026, Richard vía Gerencia) — todos los países. Un banner que lleva
 * a un servicio (moto, carro, envíos…) solo sale donde ese servicio está abierto al público: nunca se
 * anuncia el mototaxi en una ciudad donde no se puede pedir. Comida queda fuera de la regla, igual
 * que en el inicio de la app (es la puerta de entrada de la portada). `abiertos` es null cuando no se
 * pudo saber (sin ciudad): entonces solo pasan los que no llevan a un servicio con regla.
 */
export function segunServicio<T extends Pick<Banner, 'destinoTipo' | 'destinoValor'>>(
  l: T[],
  abiertos: Set<string> | null,
): T[] {
  return l.filter(
    (b) =>
      b.destinoTipo !== 'servicio' ||
      b.destinoValor === 'comida' ||
      Boolean(abiertos?.has(b.destinoValor)),
  );
}

/** ¿Hace falta mirar los servicios de la ciudad? Solo si algún banner lleva a uno con regla. */
export const necesitaServicios = (l: Pick<Banner, 'destinoTipo' | 'destinoValor'>[]) =>
  l.some((b) => b.destinoTipo === 'servicio' && b.destinoValor !== 'comida');

/**
 * Rotación de la cabecera: uno al azar según su peso (peso 3 sale tres veces más que peso 1). Si hay
 * más de uno, nunca repite el que se mostró la vez anterior (`excluir`), así cada apertura cambia.
 * `azar` es un número en [0, 1).
 */
export function elegirPorPeso<T extends { id: string; peso: number }>(
  candidatos: T[],
  azar: number,
  excluir?: string | null,
): T | null {
  const pool =
    excluir && candidatos.length > 1 ? candidatos.filter((c) => c.id !== excluir) : candidatos;
  const total = pool.reduce((s, c) => s + Math.max(1, c.peso), 0);
  if (!pool.length || total <= 0) return null;
  let punto = Math.min(Math.max(azar, 0), 0.999999) * total;
  for (const c of pool) {
    punto -= Math.max(1, c.peso);
    if (punto < 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}

/** El carrusel de promociones: por orden (menor primero) y, a igual orden, el de más peso. */
export function ordenarPromociones<T extends { orden: number; peso: number; id: string }>(
  l: T[],
): T[] {
  return [...l].sort((a, b) => a.orden - b.orden || b.peso - a.peso || a.id.localeCompare(b.id));
}

// ───────────────────────────── Lectura pública con caché en memoria ─────────────────────────────

export const CACHE_BANNERS_MS = 60_000;
const cachePublicos = new Map<Lugar, { hasta: number; banners: Banner[] }>();
const cacheZonas = new Map<string, { hasta: number; pais: string | null }>();
const cacheServicios = new Map<string, { hasta: number; abiertos: Set<string> }>();

/** Los servicios abiertos al público en una ciudad, recordados 60 s (mirar no escribe y casi no lee). */
export async function abiertosDeZona(
  zona: string,
  ahoraMs: number,
  leer: (zona: string) => Promise<Set<string>>,
) {
  const g = cacheServicios.get(zona);
  if (g && g.hasta > ahoraMs) return g.abiertos;
  const abiertos = await leer(zona);
  if (cacheServicios.size > 500) cacheServicios.clear();
  cacheServicios.set(zona, { hasta: ahoraMs + CACHE_BANNERS_MS, abiertos });
  return abiertos;
}

/** Al aprobar, pausar o borrar se olvida lo guardado en ESTE aislado (los demás esperan su minuto). */
export function olvidarCacheBanners() {
  cachePublicos.clear();
  cacheServicios.clear();
}

/** Los publicados de un lugar, con una lectura por minuto como mucho. */
export async function publicadosDe(db: D1Database, lugar: Lugar, ahoraMs: number) {
  const guardado = cachePublicos.get(lugar);
  if (guardado && guardado.hasta > ahoraMs) return guardado.banners;
  const { results } = await db
    .prepare(
      `SELECT id, lugar, estado, imagen, titulo_es, titulo_en, texto_es, texto_en, destino_tipo,
         destino_valor, codigo, zonas, paises, inicio, fin, peso, orden
       FROM banners WHERE lugar = ? AND estado = 'publicado' LIMIT 200`,
    )
    .bind(lugar)
    .all<Record<string, unknown>>();
  const banners = results.map(filaABanner);
  cachePublicos.set(lugar, { hasta: ahoraMs + CACHE_BANNERS_MS, banners });
  return banners;
}

/** El país de una ciudad (zona), recordado 10 minutos: las zonas casi nunca cambian. */
export async function paisDeZona(db: D1Database, zona: string, ahoraMs: number) {
  const g = cacheZonas.get(zona);
  if (g && g.hasta > ahoraMs) return g.pais;
  const f = await db
    .prepare('SELECT pais FROM zonas WHERE id = ?')
    .bind(zona)
    .first<{ pais: string }>();
  const pais = f?.pais ?? null;
  if (cacheZonas.size > 500) cacheZonas.clear();
  cacheZonas.set(zona, { hasta: ahoraMs + 600_000, pais });
  return pais;
}

/** El banner tal como lo lee la app: en su idioma (con el otro de respaldo) y la imagen completa. */
export function paraLaApp(b: Banner, idioma: 'es' | 'en', origen: string) {
  const en = idioma === 'en';
  const imagen = b.imagen ? new URL(b.imagen, origen).toString() : '';
  return {
    id: b.id,
    lugar: b.lugar,
    titulo: (en ? b.tituloEn : b.tituloEs) || b.tituloEs || b.tituloEn,
    texto: (en ? b.textoEn : b.textoEs) || b.textoEs || b.textoEn,
    imagen,
    destino: { tipo: b.destinoTipo, valor: b.destinoValor },
    codigo: b.codigo || null,
    peso: b.peso,
    orden: b.orden,
    fin: b.fin,
  };
}

// ───────────────────────────── Generar con IA (tope diario) ─────────────────────────────

/** Tope diario de imágenes generadas para banners, por proyecto (unos 90 centavos al día como mucho). */
export const TOPE_IMAGENES_DIA = 30;
export const USO_BANNERS = 'banners';

export const topeImagenes = (env: Env) => {
  const n = Number(env.TOPE_BANNERS_IA_DIA ?? '');
  return Number.isInteger(n) && n > 0 && n <= TOPE_IMAGENES_DIA ? n : TOPE_IMAGENES_DIA;
};

export const diaUtc = (ahoraMs: number) => new Date(ahoraMs).toISOString().slice(0, 10);

/**
 * El conteo del día vive en la tabla `config` (una fila por día: `ia_banners:<día>`) y el último error
 * en `ia_banners_error:<día>`. Sin tabla propia: cada tabla nueva es una fila más que el canario
 * recorre en sqlite_master (C-LECTURAS-SALUD).
 */
const claveDia = (ahoraMs: number) => `ia_${USO_BANNERS}:${diaUtc(ahoraMs)}`;
const claveError = (ahoraMs: number) => `ia_${USO_BANNERS}_error:${diaUtc(ahoraMs)}`;

/** Cuántas imágenes van hoy y el último error de hoy (una lectura por clave primaria). */
export async function imagenesDeHoy(db: D1Database, ahoraMs: number) {
  const { results } = await db
    .prepare('SELECT clave, valor FROM config WHERE clave IN (?1, ?2)')
    .bind(claveDia(ahoraMs), claveError(ahoraMs))
    .all<{ clave: string; valor: string }>();
  const de = (k: string) => results.find((r) => r.clave === k)?.valor ?? null;
  return {
    imagenes: Number(de(claveDia(ahoraMs)) ?? 0),
    ultimoError: de(claveError(ahoraMs)),
  };
}

/**
 * Aparta `n` imágenes del tope de hoy, ANTES de llamar al modelo, con un solo UPDATE condicional
 * (dos administradores a la vez no pueden pasarse). Devuelve false si no caben.
 */
export async function reservarImagenes(db: D1Database, n: number, tope: number, ahoraMs: number) {
  if (n <= 0 || n > tope) return false;
  const r = await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES (?1, CAST(?2 AS TEXT))
       ON CONFLICT(clave) DO UPDATE
         SET valor = CAST(CAST(config.valor AS INTEGER) + ?2 AS TEXT), actualizado_en = datetime('now')
       WHERE CAST(config.valor AS INTEGER) + ?2 <= ?3`,
    )
    .bind(claveDia(ahoraMs), n, tope)
    .run();
  return (r.meta.changes ?? 0) === 1;
}

const ESTILO: Record<Lugar, string> = {
  cabecera:
    'wide advertising banner photo for a delivery app, the product large and sharp on the RIGHT half, deep near-black background (#101010) with soft studio light, empty dark space on the left half for a headline',
  promociones:
    'wide advertising banner photo for a delivery app promotion, the product on the RIGHT side, solid bright red background (#F20D20), clean and modern, empty space on the left for a headline',
};
const SIN_TEXTO =
  'photorealistic, high quality, no text, no letters, no words, no numbers, no logos, no brand marks, no watermark';

export const promptBanner = (idea: string, lugar: Lugar) =>
  `${idea.trim()}. ${lugar === 'promociones' ? ESTILO.promociones : ESTILO.cabecera}. ${SIN_TEXTO}`;

/** Solo se descargan imágenes del almacén de fal.ai (nada de direcciones que mande otro). */
export function urlDeFal(u: string): boolean {
  try {
    const x = new URL(u);
    return (
      x.protocol === 'https:' && (x.hostname === 'fal.media' || x.hostname.endsWith('.fal.media'))
    );
  } catch {
    return false;
  }
}

const MAX_IMAGEN_IA = 12 * 1024 * 1024;

/**
 * Genera `cantidad` opciones con el modelo aprobado y las guarda en el almacén del sitio
 * (`fotos/banners/ia-<id>.<ext>`). El tope ya se apartó antes. Si el modelo falla, se anota el error
 * y se cae: nunca se prueba con otro modelo.
 */
export async function generarOpciones(
  env: Env,
  db: D1Database,
  bucket: R2Bucket,
  idea: string,
  lugar: Lugar,
  cantidad: number,
  ahoraMs: number,
  hacer: typeof fetch = fetch,
): Promise<string[]> {
  const modelo = MODELO_BANNERS;
  // El guard va JUSTO delante de la llamada: un modelo caro no corre nunca, ni como respaldo.
  asegurarModeloBarato(modelo);
  const anotar = (e: string) =>
    db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?1, ?2) ON CONFLICT(clave) DO UPDATE
         SET valor = excluded.valor, actualizado_en = datetime('now')`,
      )
      .bind(claveError(ahoraMs), e.slice(0, 300) || 'error')
      .run()
      .catch((x: unknown) => console.error('banners: no se anotó el error', x));
  let datos: { images?: { url?: string }[] };
  try {
    const r = await hacer(`https://fal.run/${modelo}`, {
      method: 'POST',
      headers: { authorization: `Key ${env.FAL_KEY ?? ''}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: promptBanner(idea, lugar),
        image_size: { width: 1536, height: 1024 },
        num_images: cantidad,
        enable_safety_checker: true,
      }),
    });
    if (!r.ok) throw new Error(`fal ${r.status}: ${(await r.text()).slice(0, 200)}`);
    datos = (await r.json()) as typeof datos;
  } catch (e) {
    console.error('banners: el modelo no respondió', e);
    await anotar(String(e));
    throw new ErrorDatos(
      'No se pudieron crear las imágenes en este momento. Intenta de nuevo en un rato.',
      undefined,
      503,
    );
  }
  const urls = (datos.images ?? []).map((i) => i.url ?? '').filter(urlDeFal);
  const guardadas: string[] = [];
  for (const u of urls.slice(0, cantidad)) {
    try {
      const r = await hacer(u);
      if (!r.ok) throw new Error(`descarga ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const tipo = tipoReal(bytes);
      if (!tipo || bytes.byteLength > MAX_IMAGEN_IA) throw new Error('imagen no válida');
      const ext = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
      const clave = `fotos/banners/ia-${nuevoId()}.${ext}`;
      await guardarFoto(bucket, clave, bytes, tipo, {
        cacheControl: 'public, max-age=31536000, immutable',
      });
      guardadas.push(`/media/${clave}`);
    } catch (e) {
      console.error('banners: no se guardó una opción', e);
      await anotar(`guardar: ${String(e)}`);
    }
  }
  if (!guardadas.length)
    throw new ErrorDatos(
      'No se pudieron crear las imágenes en este momento. Intenta de nuevo en un rato.',
      undefined,
      503,
    );
  // Salió bien: el canario vuelve a verde (el error anterior ya no vale).
  if (guardadas.length === Math.min(urls.length, cantidad))
    await db.prepare('DELETE FROM config WHERE clave = ?').bind(claveError(ahoraMs)).run();
  return guardadas;
}

/**
 * Canario de /datos/salud (una lectura por clave primaria): pendiente sin la llave de fal, «atrasado»
 * si la última generación de hoy falló (no es una caída: no da 503 ni frena publicaciones, como Connect), «tope» si hoy ya se usaron todas, ok en lo demás.
 */
export async function saludBanners(env: Env, db: D1Database, ahoraMs = Date.now()) {
  if (!env.FAL_KEY) return 'pendiente' as const;
  const hoy = await imagenesDeHoy(db, ahoraMs);
  if (hoy.ultimoError) return 'atrasado' as const;
  if (hoy.imagenes >= topeImagenes(env)) return 'tope' as const;
  return 'ok' as const;
}
