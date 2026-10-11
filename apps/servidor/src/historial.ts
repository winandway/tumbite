/** Anota un cambio de estado del pedido: quién y a qué estado. Nunca frena el flujo si falla. */
export function anotarEstado(
  db: D1Database,
  pedidoId: string,
  estado: string,
  actorId: string | null,
) {
  return db
    .prepare('INSERT INTO historial_estados (pedido_id, estado, actor_id) VALUES (?, ?, ?)')
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
