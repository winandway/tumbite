import { anotarEvento } from './manager';

/**
 * Disputas (contracargos) de Stripe. Cada aviso charge.dispute.* deja o actualiza su fila y anota el
 * evento en la bitácora del pedido. Devuelve `nueva: true` solo la primera vez (para avisar una vez).
 */
export async function registrarDisputa(
  db: D1Database,
  tipo: string,
  obj: Record<string, unknown>,
): Promise<{
  nueva: boolean;
  monto: number;
  motivo: string;
  pedidoId: string | null;
  venceEn: string | null;
} | null> {
  const id = String(obj.id ?? '');
  if (!id) return null;
  const pi = obj.payment_intent ? String(obj.payment_intent) : null;
  const monto = Number(obj.amount ?? 0);
  const motivo = String(obj.reason ?? '');
  const estado = String(obj.status ?? '');
  const due = (obj.evidence_details as { due_by?: number } | undefined)?.due_by;
  const venceEn = due
    ? new Date(Number(due) * 1000).toISOString().replace('T', ' ').slice(0, 19)
    : null;
  const pedido = pi
    ? await db
        .prepare('SELECT id FROM pedidos WHERE stripe_pago = ?')
        .bind(pi)
        .first<{ id: string }>()
    : null;
  const r = await db
    .prepare(
      `INSERT INTO disputas (id, pedido_id, stripe_pago, monto, motivo, estado, vence_en) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, monto = excluded.monto, vence_en = COALESCE(excluded.vence_en, disputas.vence_en), actualizado_en = datetime('now')`,
    )
    .bind(id, pedido?.id ?? null, pi, monto, motivo, estado, venceEn)
    .run();
  const nueva =
    tipo === 'charge.dispute.created' ||
    (Number(r.meta.changes) === 1 && tipo === 'charge.dispute.created');
  if (pedido?.id) {
    if (tipo === 'charge.dispute.created')
      await anotarEvento(db, pedido.id, 'disputa_abierta', `${monto} · ${motivo}`);
    else if (tipo === 'charge.dispute.closed')
      await anotarEvento(db, pedido.id, 'disputa_cerrada', estado);
  }
  return { nueva, monto, motivo, pedidoId: pedido?.id ?? null, venceEn };
}

/** Pieza «disputas» de la salud: error si hay una disputa sin responder que vence en menos de 2 días. */
export async function saludDisputas(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM disputas WHERE estado IN ('needs_response', 'warning_needs_response')
         AND (vence_en IS NULL OR vence_en < datetime('now', '+2 days'))`,
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0) > 0 ? 'error' : 'ok';
}
