import { Hono } from 'hono';
import { barraActivacion } from '../activacion';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * C-BARRA-ACTIVACION (23 nov 2026) — todos los países. La barra de activación de un conductor para el
 * panel (Verificaciones y su ficha): los pasos mínimos para recibir carreras, de quién depende cada uno
 * y la frase final, con el veredicto de la MISMA vista del reparto. Mirar no escribe.
 */
export const activacion = new Hono<{ Bindings: Env; Variables: Variables }>();

activacion.get('/admin/conductores/:id/activacion', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const persona = await db
    .prepare("SELECT 1 AS si FROM usuarios WHERE id = ? AND rol = 'repartidor'")
    .bind(id)
    .first<{ si: number }>();
  if (!persona) throw new ErrorDatos('No encontramos a ese conductor.', undefined, 404);
  // C-PERMISOS-FINOS: el alcance (su zona de trabajo) lo aplica el mapa de rutas (ficha del conductor).
  c.header('cache-control', 'private, no-store');
  return c.json(await barraActivacion(db, id, c.env));
});
