/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela): los disparadores del libro del Saldo Divoox. Los crea
 * esquema.ts al arrancar (idempotentes), como los del Agente Divoox: no van en schema.sql porque el
 * divisor de sentencias de la plataforma corta mal los disparadores.
 *
 * - El libro es INMUTABLE: ningún movimiento se cambia ni se borra (lo dicho, dicho está; una
 *   corrección es otro movimiento).
 * - Segunda llave contra el saldo negativo: la sentencia que aparta ya comprueba que alcanza; esto
 *   frena cualquier otro camino que intentara dejarlo por debajo de cero.
 */
export const ESQUEMA_SALDO_CLIENTE: readonly string[] = [
  `CREATE TRIGGER IF NOT EXISTS saldo_cliente_sin_cambios
BEFORE UPDATE ON saldo_cliente_movimientos
BEGIN
  SELECT RAISE(ABORT, 'el libro del saldo del cliente no se cambia');
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_cliente_sin_borrar
BEFORE DELETE ON saldo_cliente_movimientos
BEGIN
  SELECT RAISE(ABORT, 'el libro del saldo del cliente no se borra');
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_cliente_nunca_negativo
BEFORE INSERT ON saldo_cliente_movimientos
WHEN NEW.monto < 0 AND (SELECT COALESCE(SUM(monto), 0) FROM saldo_cliente_movimientos WHERE cliente_id = NEW.cliente_id AND moneda = NEW.moneda) + NEW.monto < 0
BEGIN
  SELECT RAISE(ABORT, 'saldo_insuficiente');
END`,
];
