import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

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
