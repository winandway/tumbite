/** Anota un cambio de estado del pedido: quién y a qué estado. Nunca frena el flujo si falla. */
export function anotarEstado(
  db: D1Database,
  pedidoId: string,
  estado: string,
  actorId: string | null,
) {
  // C-RASTRO: la misma fila lleva dónde estaba el repartidor del pedido (si su posición es reciente).
  return db
    .prepare(
      `INSERT INTO historial_estados (pedido_id, estado, actor_id, lat, lng)
       SELECT ?1, ?2, ?3, r.lat, r.lng
         FROM (SELECT 1) LEFT JOIN pedidos p ON p.id = ?1
         LEFT JOIN repartidores r ON r.usuario_id = p.repartidor_id
              AND r.ubicacion_en >= datetime('now', '-5 minutes')`,
    )
    .bind(pedidoId, estado, actorId);
}

export async function anotar(
  db: D1Database,
  pedidoId: string,
  estado: string,
  actorId: string | null,
): Promise<void> {
  try {
    await anotarEstado(db, pedidoId, estado, actorId).run();
  } catch (e) {
    console.error('historial: no se pudo anotar', pedidoId, estado, e);
  }
}
