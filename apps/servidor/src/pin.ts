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

/**
 * C-PIN-SIN-FOTO: un pedido pedido «en mano con PIN» no se entrega con la foto (en la puerta ni en
 * lugar seguro) mientras el PIN no se haya usado. Si el PIN quedó bloqueado por intentos, sigue el
 * camino de siempre: el cliente confirma o lo resuelve soporte.
 */
export async function sinFotoConPin(db: D1Database, pedidoId: string): Promise<void> {
  const fila = await db
    .prepare('SELECT intentos, usado_en FROM pines_entrega WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ intentos: number | null; usado_en: string | null }>();
  if (!fila || fila.usado_en) return;
  if (Number(fila.intentos ?? 0) >= MAX_INTENTOS_PIN)
    throw new ErrorDatos(
      'Demasiados intentos con el PIN. Pídele al cliente que confirme la entrega desde su app o escribe a soporte.',
      'pin',
      409,
    );
  throw new ErrorDatos(
    'Este pedido se entrega en mano con el PIN del cliente. Pídeselo y escríbelo para entregar.',
    'pin',
    409,
  );
}
