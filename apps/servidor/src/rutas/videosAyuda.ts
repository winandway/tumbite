import {
  CLAVES_VIDEO_AYUDA,
  type ClaveVideoAyuda,
  PATRON_VIDEO_AYUDA,
  type VideosAyuda,
} from '@tumbite/compartido';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-VER-VIDEO (21 nov 2026, pedido de Richard) — todos los países. Los videos de ayuda que las apps
 * ofrecen con «Ver video». Nacen APAGADOS: el ajuste (una fila de `config`, clave `videos_ayuda`)
 * guarda, por pantalla y por idioma, el nombre del video en el almacén (`docs-video/<nombre>.mp4`,
 * lo sube `scripts/docs/subir-video.mjs` y lo sirve por partes `/media/docs-video/`). Sin ajuste, las
 * apps no dibujan el enlace. Encenderlo no pide compilar nada.
 * Presupuesto: leerlo es una lectura y cero escrituras (las apps lo guardan 5 minutos); cambiarlo,
 * una escritura.
 */
export const videosAyuda = new Hono<{ Bindings: Env; Variables: Variables }>();

type PorIdioma = { es?: string; en?: string };
/** Por pantalla (clave), el nombre del video de cada idioma en el almacén. */
type Guardado = Map<ClaveVideoAyuda, PorIdioma>;

const nombreValido = (x: unknown): string | undefined =>
  typeof x === 'string' && PATRON_VIDEO_AYUDA.test(x) ? x : undefined;

async function leer(db: D1Database): Promise<Guardado> {
  const guardado: Guardado = new Map();
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'videos_ayuda'")
    .first<{ valor: string }>();
  if (!f) return guardado;
  try {
    const crudo = new Map(Object.entries(JSON.parse(f.valor) as Record<string, PorIdioma>));
    for (const clave of CLAVES_VIDEO_AYUDA) {
      const es = nombreValido(crudo.get(clave)?.es);
      const en = nombreValido(crudo.get(clave)?.en);
      if (es || en) guardado.set(clave, { ...(es ? { es } : {}), ...(en ? { en } : {}) });
    }
  } catch (e) {
    // Un ajuste dañado apaga los videos (nunca rompe la pantalla) y queda en el registro.
    console.error('videos de ayuda: el ajuste no se pudo leer', e);
  }
  return guardado;
}

const direccion = (archivo: string) => `/media/docs-video/${archivo}`;
const conDirecciones = (g: Guardado): VideosAyuda =>
  Object.fromEntries(
    [...g].map(([clave, v]) => [
      clave,
      { ...(v.es ? { es: direccion(v.es) } : {}), ...(v.en ? { en: direccion(v.en) } : {}) },
    ]),
  );

videosAyuda.get('/videos-ayuda', async (c) => {
  c.header('cache-control', 'public, max-age=300');
  return c.json({ videos: conDirecciones(await leer(base(c))) });
});

videosAyuda.get('/admin/videos-ayuda', async (c) => {
  exigir(c, 'admin');
  return c.json({ videos: Object.fromEntries(await leer(base(c))), claves: CLAVES_VIDEO_AYUDA });
});

const archivo = z
  .string()
  .regex(PATRON_VIDEO_AYUDA, { error: 'Ese no es el nombre de un video del almacén.' })
  .nullable()
  .optional();

videosAyuda.put('/admin/videos-ayuda', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      clave: z.enum(CLAVES_VIDEO_AYUDA, { error: 'Esa pantalla no tiene video de ayuda.' }),
      es: archivo,
      en: archivo,
    }),
  );
  const db = base(c);
  const guardado = await leer(db);
  const antes = guardado.get(d.clave) ?? {};
  /** undefined = ese idioma no se toca; null = apagarlo; un nombre = encenderlo (si ya está subido). */
  const resolver = async (
    idioma: 'es' | 'en',
    pedido: string | null | undefined,
    actual?: string,
  ) => {
    if (pedido === undefined) return actual;
    if (pedido === null) return undefined;
    // No se enciende un enlace que no reproduce nada: el video tiene que estar ya en el almacén.
    if (!c.env.BUCKET || !(await c.env.BUCKET.head(`docs-video/${pedido}`)))
      throw new ErrorDatos(
        'Ese video todavía no está en el almacén. Súbelo primero y vuelve a intentarlo.',
        idioma,
        422,
      );
    return pedido;
  };
  const es = await resolver('es', d.es, antes.es);
  const en = await resolver('en', d.en, antes.en);
  if (es || en) guardado.set(d.clave, { ...(es ? { es } : {}), ...(en ? { en } : {}) });
  else guardado.delete(d.clave);
  const videos = Object.fromEntries(guardado);
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES ('videos_ayuda', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(JSON.stringify(videos))
    .run();
  return c.json({ ok: true, videos });
});
