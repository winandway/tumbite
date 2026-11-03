import { Hono } from 'hono';
import { z } from 'zod';
import { type LineaPesable, aplicarPesoReal, formatearPeso } from '@tumbite/compartido';
import type { Env } from '../env';
import { ajustarReservaDirecta } from '../internacional/cobroDirecto';
import { anotarEvento } from '../manager';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  CON_AJUSTE,
  type FilaPedido,
  lineasDe,
  recalcularLineas,
  sentenciasRecalculo,
} from './pedidos';
import { mio } from './restauranteMas';

/**
 * C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026). La tienda escribe el peso real de cada producto por peso
 * mientras prepara el pedido; el total se recalcula con ese peso y al entregar se captura el total
 * real (nunca más de lo autorizado: el total al pedir más el margen del 15 % de los pesables).
 * Fuentes: Instacart («Authorization holds and adjusted totals») y DoorDash para tiendas («weighted
 * items», ajuste con tolerancia) [DOC]; ficha en docs/investigaciones-rea/2026-11-02-tiendas-peso-real.md.
 */
export const tiendasPeso = new Hono<{ Bindings: Env; Variables: Variables }>();

tiendasPeso.post('/restaurante/pedidos/:id/pesos', async (c) => {
  const db = base(c);
  const r = await mio(c, db);
  const id = c.req.param('id');
  const { pesos } = await leerCuerpo(
    c,
    z.object({
      pesos: z
        .array(
          z.object({ platoId: z.string().min(1).max(64), peso: z.number().positive().max(10_000) }),
        )
        .min(1)
        .max(50),
    }),
  );
  const f = await db
    .prepare(
      `SELECT p.*, ${CON_AJUSTE}, r.tipo_comercio AS tipo_comercio,
         (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id) AS recogida,
         (SELECT a.autorizado FROM autorizaciones_pedido a WHERE a.pedido_id = p.id) AS autorizado
         FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.id = ? AND p.restaurante_id = ?`,
    )
    .bind(id, r.id)
    .first<FilaPedido>();
  if (!f) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  if (String(f.tipo_comercio ?? 'restaurante') === 'restaurante')
    throw new ErrorDatos('El peso real es solo para pedidos de tiendas.', undefined, 409);
  if (!['pagado', 'aceptado'].includes(String(f.estado)))
    throw new ErrorDatos(
      'Este pedido ya está listo o cambió de estado: el peso ya no se puede cambiar.',
      undefined,
      409,
    );
  if (f.aj_estado === 'pendiente')
    throw new ErrorDatos(
      'Espera a que el cliente decida sobre el producto que falta.',
      undefined,
      409,
    );
  let lineas = lineasDe(f) as (ReturnType<typeof lineasDe>[number] & LineaPesable)[];
  for (const { platoId, peso } of pesos) {
    const linea = lineas.find((l) => l.platoId === platoId);
    if (!linea) throw new ErrorDatos('Ese producto no está en este pedido.', 'platoId', 404);
    const r2 = aplicarPesoReal(linea, peso);
    if (!r2.ok) {
      if (r2.motivo === 'tope')
        throw new ErrorDatos(
          `Ese peso pasa del 15 % sobre lo que pidió el cliente (máximo ${[formatearPeso(r2.pesoMaximo ?? 0), linea.unidadPeso].filter(Boolean).join(' ')}). Quita un poco o márcalo como faltante.`,
          'peso',
          409,
        );
      throw new ErrorDatos(
        r2.motivo === 'peso' ? 'Escribe un peso válido.' : 'Ese producto no se vende por peso.',
        'peso',
        422,
      );
    }
    lineas = lineas.map((l) => (l === linea ? r2.linea : l));
  }
  // Nunca más de lo autorizado; sin autorización guardada (pedidos viejos), nunca más del total.
  const autorizado = Number(f.autorizado ?? f.total);
  const descuentos = await recalcularLineas(db, f, lineas, autorizado);
  await db.batch([
    ...sentenciasRecalculo(db, id, lineas, descuentos),
    db
      .prepare("UPDATE autorizaciones_pedido SET pesado_en = datetime('now') WHERE pedido_id = ?")
      .bind(id),
  ]);
  await anotarEvento(
    db,
    id,
    'peso_real',
    `${descuentos.desglose.totalCliente} centavos (antes ${Number(f.total)})`,
  );
  // Pedido en mano: la comisión apartada sigue al total nuevo (C-RESERVA-AJUSTE).
  await ajustarReservaDirecta(db, id);
  return c.json({
    ok: true,
    total: descuentos.desglose.totalCliente,
    totalAntes: Number(f.total),
    autorizado,
    lineas,
  });
});
