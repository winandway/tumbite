import { ErrorDatos } from './validar';

/** Equivocaciones permitidas antes de bloquear el PIN de un pedido (F19 de la auditoría). */
export const MAX_INTENTOS_PIN = 5;

/**
 * Verifica el PIN de entrega de un pedido (en mano o recogida en el local). Si el pedido no tiene
 * PIN, pasa. Cada equivocación cuenta; a la quinta el PIN queda bloqueado aunque después llegue
 * el correcto: el cliente confirma desde su app o el equipo lo resuelve. C-INTENTOS.
 */
export async function verificarPinEntrega(
  db: D1Database,
  pedidoId: string,
  pin: string | null | undefined,
  mensajeIncorrecto: string,
): Promise<void> {
  const fila = await db
    .prepare('SELECT pin, intentos FROM pines_entrega WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ pin: string; intentos: number | null }>();
  if (!fila) return;
  if (Number(fila.intentos ?? 0) >= MAX_INTENTOS_PIN)
    throw new ErrorDatos(
      'Demasiados intentos con el PIN. Pídele al cliente que confirme la entrega desde su app o escribe a soporte.',
      'pin',
      409,
    );
  if (!pin || pin !== fila.pin) {
    await db
      .prepare('UPDATE pines_entrega SET intentos = COALESCE(intentos, 0) + 1 WHERE pedido_id = ?')
      .bind(pedidoId)
      .run();
    throw new ErrorDatos(mensajeIncorrecto, 'pin', 409);
  }
  await db
    .prepare("UPDATE pines_entrega SET usado_en = datetime('now') WHERE pedido_id = ?")
    .bind(pedidoId)
    .run();
}
