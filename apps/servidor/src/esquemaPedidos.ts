/**
 * C-TRANSICIONES-PEDIDO (16 oct 2026): la base rechaza cualquier cambio de estado de un pedido de
 * Comida que no esté en transiciones_pedido (la tabla y sus filas viven en schema.sql). Ficha:
 * docs/investigaciones-rea/2026-10-16-transiciones-pedido.md.
 *
 * Igual que los disparadores de la Fase 3, NO va en schema.sql (la plataforma parte mal los
 * disparadores): esquema.ts lo crea al arrancar, en un lote y solo si falta.
 *
 * Las filas con reversion = 1 son la vuelta atrás del Manager cuando Stripe falla al devolver el
 * dinero (manager.ts): solo valen si el mismo UPDATE borra cancelado_en y la cancelación tiene
 * 2 minutos o menos. Los INSERT no pasan por aquí.
 */
export const DISPARADOR_TRANSICIONES = 'pedidos_transicion_valida';

export const ESQUEMA_PEDIDOS: readonly string[] = [
  `CREATE TRIGGER IF NOT EXISTS pedidos_transicion_valida
BEFORE UPDATE OF estado ON pedidos
WHEN NEW.estado <> OLD.estado
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_pedido_no_permitida')
   WHERE NOT EXISTS (
     SELECT 1 FROM transiciones_pedido t
      WHERE t.desde = OLD.estado AND t.hacia = NEW.estado
        AND (t.reversion = 0
             OR (NEW.cancelado_en IS NULL AND OLD.cancelado_en IS NOT NULL
                 AND OLD.cancelado_en >= datetime('now', '-2 minutes'))));
END`,
];

/** Pieza «transiciones» de la salud: ok si el disparador existe y la tabla tiene sus filas. */
export async function saludTransiciones(db: D1Database): Promise<'ok' | 'error'> {
  const f = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = ?) AS disparador,
              (SELECT COUNT(*) FROM transiciones_pedido) AS filas`,
    )
    .bind(DISPARADOR_TRANSICIONES)
    .first<{ disparador: number; filas: number }>();
  return Number(f?.disparador) === 1 && Number(f?.filas) === 12 ? 'ok' : 'error';
}
