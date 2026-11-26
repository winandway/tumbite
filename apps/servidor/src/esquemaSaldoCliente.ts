/**
 * C-SALDO-CLIENTE (25 nov 2026, Venezuela): los disparadores del libro del Saldo Divoox. Los crea
 * esquema.ts al arrancar (idempotentes), como los del Agente Divoox: no van en schema.sql porque el
 * divisor de sentencias de la plataforma corta mal los disparadores.
 *
 * - El libro es INMUTABLE: ningún movimiento se cambia ni se borra (lo dicho, dicho está; una
 *   corrección es otro movimiento).
 * - Segunda llave contra el saldo negativo: la sentencia que aparta ya comprueba que alcanza; esto
 *   frena cualquier otro camino que intentara dejarlo por debajo de cero.
 *
 * C-SALDO-LOTES (26 nov 2026, todos los países): los lotes y sus consumos.
 * - Cada consumo mueve el `restante` de su lote (un disparador, nadie lo toca a mano) y frena el lote
 *   entero si el lote no alcanza, si es de otro cliente, si se devuelve más de lo que salió o si se
 *   quiere USAR un regalo que ya venció.
 * - Los consumos son inmutables; de un lote no cambian ni su dueño, ni su tipo, ni su monto inicial, y
 *   un lote no se borra.
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
  `CREATE TRIGGER IF NOT EXISTS saldo_consumo_valido
BEFORE INSERT ON saldo_cliente_consumos
BEGIN
  SELECT RAISE(ABORT, 'lote_inexistente')
   WHERE NOT EXISTS (SELECT 1 FROM saldo_cliente_lotes l WHERE l.id = NEW.lote_id AND l.cliente_id = NEW.cliente_id);
  SELECT RAISE(ABORT, 'lote_insuficiente')
   WHERE (SELECT l.restante FROM saldo_cliente_lotes l WHERE l.id = NEW.lote_id) - NEW.monto < 0;
  SELECT RAISE(ABORT, 'lote_devolucion_de_mas')
   WHERE (SELECT l.restante + l.vencido FROM saldo_cliente_lotes l WHERE l.id = NEW.lote_id) - NEW.monto
         > (SELECT l.monto_inicial FROM saldo_cliente_lotes l WHERE l.id = NEW.lote_id);
  SELECT RAISE(ABORT, 'lote_vencido')
   WHERE NEW.tipo = 'uso' AND EXISTS (SELECT 1 FROM saldo_cliente_lotes l WHERE l.id = NEW.lote_id
         AND l.vence_en IS NOT NULL AND l.vence_en <= datetime('now'));
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_consumo_mueve_lote
AFTER INSERT ON saldo_cliente_consumos
BEGIN
  UPDATE saldo_cliente_lotes
     SET restante = restante - NEW.monto,
         vencido = vencido + CASE WHEN NEW.tipo = 'vencimiento' THEN NEW.monto ELSE 0 END
   WHERE id = NEW.lote_id;
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_consumo_sin_cambios
BEFORE UPDATE ON saldo_cliente_consumos
BEGIN
  SELECT RAISE(ABORT, 'los consumos del saldo no se cambian');
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_consumo_sin_borrar
BEFORE DELETE ON saldo_cliente_consumos
BEGIN
  SELECT RAISE(ABORT, 'los consumos del saldo no se borran');
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_lote_fijo
BEFORE UPDATE OF cliente_id, moneda, tipo, origen, monto_inicial, movimiento_ref ON saldo_cliente_lotes
BEGIN
  SELECT RAISE(ABORT, 'el lote del saldo no cambia de dueño, tipo ni monto');
END`,
  `CREATE TRIGGER IF NOT EXISTS saldo_lote_sin_borrar
BEFORE DELETE ON saldo_cliente_lotes
BEGIN
  SELECT RAISE(ABORT, 'los lotes del saldo no se borran');
END`,
];

/** Las columnas de `saldo_cliente_movimientos` (para rehacerla sin perder filas). */
const COLUMNAS_MOVIMIENTOS =
  'id, cliente_id, monto, moneda, concepto, referencia, operacion_id, autor_id, motivo, comprobante, creado_en';

/**
 * C-SALDO-LOTES: la tabla del libro tal como la deja schema.sql hoy (con «vencimiento» entre los
 * conceptos). Se usa SOLO para rehacer una base que viene de antes.
 */
export const MOVIMIENTOS_DDL = `CREATE TABLE saldo_cliente_movimientos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  monto INTEGER NOT NULL CHECK (monto <> 0),
  moneda TEXT NOT NULL DEFAULT 'USD',
  concepto TEXT NOT NULL CHECK (concepto IN ('regalo', 'recarga', 'uso_viaje', 'devolucion', 'ajuste', 'cierre_cuenta', 'vencimiento')),
  referencia TEXT NOT NULL UNIQUE,
  operacion_id TEXT,
  autor_id TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  comprobante TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const INDICES_MOVIMIENTOS = [
  'CREATE INDEX IF NOT EXISTS saldo_cliente_movimientos_cliente ON saldo_cliente_movimientos(cliente_id, moneda, creado_en)',
  'CREATE INDEX IF NOT EXISTS saldo_cliente_movimientos_autor ON saldo_cliente_movimientos(autor_id, creado_en) WHERE autor_id IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS saldo_cliente_movimientos_concepto ON saldo_cliente_movimientos(concepto, creado_en)',
  'CREATE INDEX IF NOT EXISTS saldo_cliente_movimientos_fecha ON saldo_cliente_movimientos(creado_en)',
];

/** ¿La tabla del libro todavía no conoce el concepto «vencimiento»? */
export const movimientosViejos = (sql: string | null) =>
  sql != null && !sql.includes("'vencimiento'");

/**
 * C-SALDO-LOTES: el libro del saldo de una base de antes no acepta «vencimiento» (la regla de la tabla
 * es fija en SQLite). Se rehace UNA vez con el mismo nombre y las mismas filas, en un lote: se guardan
 * las filas, se suelta la tabla (sus disparadores se van con ella y `asegurarFase3` los vuelve a poner
 * justo después), se crea la nueva y se devuelven las filas. Sin la tabla, o ya al día, no hace nada.
 */
export async function rehacerSaldoClienteMovimientos(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'saldo_cliente_movimientos'",
    )
    .first<{ sql: string }>();
  if (!movimientosViejos(f?.sql ?? null)) return false;
  await db.batch([
    db.prepare('DROP TABLE IF EXISTS saldo_cliente_movimientos_guardados'),
    db.prepare(
      `CREATE TABLE saldo_cliente_movimientos_guardados AS SELECT ${COLUMNAS_MOVIMIENTOS} FROM saldo_cliente_movimientos`,
    ),
    // Los disparadores se van con la tabla (el «no se borra» no corre en un DROP).
    db.prepare('DROP TABLE saldo_cliente_movimientos'),
    db.prepare(MOVIMIENTOS_DDL),
    db.prepare(
      `INSERT INTO saldo_cliente_movimientos (${COLUMNAS_MOVIMIENTOS}) SELECT ${COLUMNAS_MOVIMIENTOS} FROM saldo_cliente_movimientos_guardados ORDER BY rowid`,
    ),
    db.prepare('DROP TABLE saldo_cliente_movimientos_guardados'),
    ...INDICES_MOVIMIENTOS.map((s) => db.prepare(s)),
  ]);
  console.warn('esquema: saldo_cliente_movimientos rehecha con «vencimiento» (C-SALDO-LOTES)');
  return true;
}
