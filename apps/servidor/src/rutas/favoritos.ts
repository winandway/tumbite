import { Hono } from 'hono';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/** Favoritos del cliente: los ids; la app los cruza con el catálogo de su ciudad (que ya sabe si están abiertos). */
export const favoritos = new Hono<{ Bindings: Env; Variables: Variables }>();

favoritos.get('/favoritos', async (c) => {
  const u = exigir(c, 'cliente');
  const { results } = await base(c)
    .prepare('SELECT restaurante_id FROM favoritos WHERE usuario_id = ? ORDER BY creado_en DESC')
    .bind(u.id)
    .all<{ restaurante_id: string }>();
  return c.json({ ids: results.map((r) => r.restaurante_id) });
});

favoritos.put('/favoritos/:restauranteId', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const id = c.req.param('restauranteId');
  const existe = await db
    .prepare("SELECT 1 FROM restaurantes WHERE id = ? AND estado = 'aprobado'")
    .bind(id)
    .first();
  if (!existe) throw new ErrorDatos('Ese restaurante no existe.', undefined, 404);
  await db
    .prepare('INSERT OR IGNORE INTO favoritos (usuario_id, restaurante_id) VALUES (?, ?)')
    .bind(u.id, id)
    .run();
  return c.json({ favorito: true });
});

favoritos.delete('/favoritos/:restauranteId', async (c) => {
  const u = exigir(c, 'cliente');
  await base(c)
    .prepare('DELETE FROM favoritos WHERE usuario_id = ? AND restaurante_id = ?')
    .bind(u.id, c.req.param('restauranteId'))
    .run();
  return c.json({ favorito: false });
});
