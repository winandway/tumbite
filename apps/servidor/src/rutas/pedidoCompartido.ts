import { Hono } from 'hono';
import type { Env } from '../env';
import { nuevoToken, sha256 } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * C-SEGUIMIENTO-COMPARTIDO (29 oct 2026), como «Share delivery status» de Uber Eats y el viaje
 * compartido de Moto: el cliente comparte un enlace largo y secreto; quien lo abre ve el estado,
 * el restaurante, la hora estimada y al repartidor solo mientras va en camino. Nunca la dirección,
 * el nombre del cliente ni el dinero. Se apaga al entregar o cancelar.
 */
export const pedidoCompartido = new Hono<{ Bindings: Env; Variables: Variables }>();

const TERMINADOS = ['entregado', 'cancelado'];

pedidoCompartido.post('/pedidos/:id/compartir', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await db
    .prepare('SELECT cliente_id, estado FROM pedidos WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ cliente_id: string; estado: string }>();
  if (!f || f.cliente_id !== u.id) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (TERMINADOS.includes(f.estado))
    throw new ErrorDatos('Este pedido ya terminó.', undefined, 409);
  const codigo = nuevoToken();
  await db
    .prepare('INSERT INTO pedidos_compartidos (huella, pedido_id, creado_por) VALUES (?, ?, ?)')
    .bind(await sha256(codigo), c.req.param('id'), u.id)
    .run();
  const sitio = (c.env.SITIO_URL ?? new URL(c.req.url).origin).replace(/\/$/, '');
  return c.json({ url: `${sitio}/order-status/${codigo}` }, 201);
});

pedidoCompartido.get('/publico/pedido/:codigo', async (c) => {
  const codigo = c.req.param('codigo');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(codigo))
    throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  const f = await base(c)
    .prepare(
      `SELECT p.estado, p.aceptado_en, p.tiempo_prep_min, r.nombre AS restaurante,
              u.nombre AS repartidor, d.lat, d.lng
         FROM pedidos_compartidos s JOIN pedidos p ON p.id = s.pedido_id
         JOIN restaurantes r ON r.id = p.restaurante_id
         LEFT JOIN usuarios u ON u.id = p.repartidor_id
         LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
        WHERE s.huella = ?`,
    )
    .bind(await sha256(codigo))
    .first<Record<string, unknown>>();
  if (!f) throw new ErrorDatos('Este enlace no existe.', undefined, 404);
  c.header('x-robots-tag', 'noindex, nofollow');
  const estado = String(f.estado);
  if (TERMINADOS.includes(estado))
    return c.json({ pedido: { estado, terminado: true, restaurante: String(f.restaurante) } });
  const enCamino = estado === 'en_camino';
  return c.json({
    pedido: {
      estado,
      terminado: false,
      restaurante: String(f.restaurante),
      repartidor: f.repartidor ? String(f.repartidor).split(' ')[0] : null,
      ubicacion:
        enCamino && f.lat != null && f.lng != null
          ? { lat: Number(f.lat), lng: Number(f.lng) }
          : null,
    },
  });
});
