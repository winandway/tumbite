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
  recarga: { id: string; repartidorId: string } | null;
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
  // Una recarga del saldo prepago pagada con tarjeta también puede disputarse.
  const recarga =
    pi && !pedido
      ? await db
          .prepare("SELECT id, usuario_id FROM recargas WHERE canal = 'stripe' AND referencia = ?")
          .bind(pi)
          .first<{ id: string; usuario_id: string }>()
      : null;
  // C-STRIPE-AVISOS: la cuenta de Stripe es COMPARTIDA con otros negocios de Windoce. Una disputa
  // que no es de un pedido ni de una recarga de Divoox no se guarda, no avisa y no toca la salud.
  if (!pedido && !recarga) return null;
  const r = await db
    .prepare(
      `INSERT INTO disputas (id, pedido_id, stripe_pago, monto, motivo, estado, vence_en, recarga_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, monto = excluded.monto, vence_en = COALESCE(excluded.vence_en, disputas.vence_en), actualizado_en = datetime('now')`,
    )
    .bind(id, pedido?.id ?? null, pi, monto, motivo, estado, venceEn, recarga?.id ?? null)
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
  return {
    nueva,
    monto,
    motivo,
    pedidoId: pedido?.id ?? null,
    venceEn,
    // El saldo de esa recarga NO se toca solo (no hay saldos negativos ni compensaciones
    // automáticas): qué hacer con él es decisión de Richard. Aquí queda escrito y se avisa.
    recarga: recarga ? { id: recarga.id, repartidorId: recarga.usuario_id } : null,
  };
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

/**
 * C-DISPUTAS-PRUEBAS (29 oct 2026): las pruebas del pedido para responder un contracargo, con los
 * nombres de campo de Stripe y en inglés (lo lee el banco del cliente). Solo hechos guardados:
 * quién pidió, qué, a dónde, cuándo se entregó, a cuántos metros por GPS, la foto y la calificación.
 */
export async function pruebasDisputa(
  db: D1Database,
  disputaId: string,
): Promise<Record<string, string> | null> {
  const f = await db
    .prepare(
      `SELECT p.id, p.direccion, p.lineas_json, p.total, p.moneda, p.pagado_en, p.entregado_en, p.estado,
              u.nombre, u.correo, r.nombre AS restaurante,
              e.distancia_m, e.modo, e.clave AS foto, e.nota,
              c.estrellas_restaurante, c.estrellas_repartidor,
              (SELECT COALESCE(SUM(monto), 0) FROM devoluciones dv WHERE dv.pedido_id = p.id) AS devuelto
         FROM disputas d JOIN pedidos p ON p.id = d.pedido_id
         JOIN usuarios u ON u.id = p.cliente_id JOIN restaurantes r ON r.id = p.restaurante_id
         LEFT JOIN evidencias e ON e.pedido_id = p.id AND e.tipo = 'entrega'
         LEFT JOIN calificaciones c ON c.pedido_id = p.id
        WHERE d.id = ?`,
    )
    .bind(disputaId)
    .first<Record<string, unknown>>();
  if (!f) return null;
  const lineas = JSON.parse(String(f.lineas_json ?? '[]')) as {
    nombreEs: string;
    nombreEn?: string;
    cantidad: number;
  }[];
  const platos = lineas.map((l) => `${l.cantidad} × ${l.nombreEn || l.nombreEs}`).join(', ');
  const modo =
    f.modo === 'mano' ? 'handed to the customer' : f.modo ? 'left at the door' : 'delivered';
  const hechos = [
    `Food delivery order ${String(f.id).slice(0, 8)} from ${String(f.restaurante)} placed through Divoox by the cardholder's account (${String(f.correo)}).`,
    f.pagado_en ? `Paid on ${String(f.pagado_en)} UTC.` : '',
    f.entregado_en
      ? `Delivered on ${String(f.entregado_en)} UTC, ${modo}${f.nota ? ` (${String(f.nota)})` : ''}.`
      : `Order status: ${String(f.estado)}.`,
    f.distancia_m != null
      ? `The driver's GPS confirmed the delivery ${Number(f.distancia_m)} m from the customer's address.`
      : '',
    f.foto ? 'A delivery photo was taken by the driver and is kept on file.' : '',
    f.estrellas_restaurante
      ? `The customer rated the order ${Number(f.estrellas_restaurante)}/5 after delivery.`
      : '',
    Number(f.devuelto) > 0
      ? `Part of the order was already refunded (${Number(f.devuelto)} ${String(f.moneda)} minor units).`
      : '',
  ].filter(Boolean);
  return {
    customer_name: String(f.nombre),
    customer_email_address: String(f.correo),
    product_description: platos,
    shipping_address: String(f.direccion),
    ...(f.entregado_en ? { shipping_date: String(f.entregado_en).slice(0, 10) } : {}),
    uncategorized_text: hechos.join(' '),
  };
}
