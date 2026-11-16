import { Hono } from 'hono';
import type { Env } from '../env';
import { fichaViaje } from '../fichaOperacion';
import { type Variables, base, exigir } from '../sesion';

/**
 * C-FICHA-OPERACION (15 nov 2026). Todos los países. La ficha de un viaje (auto, moto) o de un
 * envío de paquete en el superadmin, y la foto de recogida o entrega del paquete (los viajes de
 * personas no llevan fotos del pasajero). Va DESPUÉS de las rutas fijas `/admin/viajes/tarifas`,
 * `/admin/viajes/ajustes` y `/admin/viajes/dinamica/…`, que se registran antes en app.ts.
 */
export const fichaViajeRutas = new Hono<{ Bindings: Env; Variables: Variables }>();

fichaViajeRutas.get('/admin/viajes/:id', async (c) => {
  exigir(c, 'admin');
  return c.json({ viaje: await fichaViaje(base(c), c.req.param('id')) });
});

/**
 * La foto del paquete (solo envíos), con sesión del equipo y sin caché, como la ruta de evidencias
 * de los pedidos. PERMISOS: cuando lleguen los permisos finos, esta ruta lleva el mismo permiso y el
 * mismo registro de lecturas sensibles que `GET /datos/pedidos/:id/evidencia/:tipo`.
 */
fichaViajeRutas.get('/admin/viajes/:id/foto/:tipo', async (c) => {
  exigir(c, 'admin');
  const tipo = c.req.param('tipo');
  if (tipo !== 'recogida' && tipo !== 'entrega') return c.text('No encontrado', 404);
  const f = await base(c)
    .prepare(
      tipo === 'recogida'
        ? 'SELECT foto_recogida AS clave FROM envios_persona WHERE operacion_id = ?'
        : 'SELECT foto_entrega AS clave FROM envios_persona WHERE operacion_id = ?',
    )
    .bind(c.req.param('id'))
    .first<{ clave: string | null }>();
  if (!f?.clave || !c.env.BUCKET) return c.text('No encontrado', 404);
  const obj = await c.env.BUCKET.get(f.clave);
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
});
