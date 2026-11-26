import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { entornoDe } from '../entorno';
import { abiertosParaLaWeb } from './servicios';
import { tarifasPublicas } from './tarifasWeb';

/**
 * F17 (29 oct 2026): el estado público de cada ciudad en la web sale del servidor. Encender una
 * ciudad («Ya estamos en Miami») es un interruptor del superadmin, sin publicar código.
 */
export const ciudadesWeb = new Hono<{ Bindings: Env; Variables: Variables }>();

const slugValido = z.string().regex(/^[a-z0-9-]{2,40}$/);

async function estados(db: D1Database) {
  const { results } = await db
    .prepare('SELECT slug, estado, actualizado_en FROM ciudades_web ORDER BY slug')
    .all<{ slug: string; estado: 'activo' | 'pronto'; actualizado_en: string }>();
  return results;
}

ciudadesWeb.get('/web/ciudades', async (c) => {
  const filas = await estados(base(c));
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({ ciudades: Object.fromEntries(filas.map((f) => [f.slug, f.estado])) });
});

/**
 * C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026): los países con al menos un servicio abierto al público,
 * con sus servicios. La web la usa para decir «Ya estamos en …» y la publicación la guarda en las
 * páginas prearmadas (título, descripción y tarjeta social). Solo lee, con caché de borde.
 */
ciudadesWeb.get('/web/paises', async (c) => {
  // C-CIUDAD-ABIERTA-SIN-PRONTO: también cada ciudad pública con lo que tiene abierto (por su clave).
  const { paises, ciudades } = await abiertosParaLaWeb(base(c), entornoDe(c.req.url));
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ paises, ciudades });
});

/**
 * C-TARIFAS-PUBLICAS (25 nov 2026, Richard: que Google diga cuánto cuesta un mototaxi en El Vigía): los
 * precios fijos de una ciudad pública, de los MISMOS datos que cobra el sistema. Solo lee, con caché.
 */
ciudadesWeb.get('/web/tarifas/:ciudad', async (c) => {
  const clave = slugValido.safeParse(c.req.param('ciudad'));
  const servicio = c.req.query('servicio') ?? 'moto';
  if (!clave.success || !/^[a-z]{2,20}$/.test(servicio))
    throw new ErrorDatos('Esa ciudad no existe.', 'ciudad', 404);
  const t = await tarifasPublicas(base(c), clave.data, servicio, entornoDe(c.req.url));
  c.header('Cache-Control', 'public, max-age=300');
  if (!t) return c.json({ error: 'Sin precios publicados en esa ciudad.' }, 404);
  return c.json(t);
});

ciudadesWeb.get('/admin/web/ciudades', async (c) => {
  exigir(c, 'admin');
  return c.json({ ciudades: await estados(base(c)) });
});

ciudadesWeb.put('/admin/web/ciudades/:slug', async (c) => {
  const u = exigir(c, 'admin');
  const v = slugValido.safeParse(c.req.param('slug'));
  if (!v.success) throw new ErrorDatos('Esa ciudad no existe.', 'slug', 400);
  const slug = v.data;
  const { estado } = await leerCuerpo(c, z.object({ estado: z.enum(['activo', 'pronto']) }));
  await base(c)
    .prepare(
      `INSERT INTO ciudades_web (slug, estado, actualizado_por) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET estado = excluded.estado, actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
    )
    .bind(slug, estado, u.id)
    .run();
  return c.json({ ok: true, slug, estado });
});
