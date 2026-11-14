/**
 * C-CONTROL-DUAL (SIG-4x, 3 nov 2026): `aprobaciones_dinero` nació con una lista cerrada de tipos
 * (CHECK). La revisión pidió que también pasen por la segunda firma «excedente devuelto» de la
 * bandeja de casos y subir un límite («umbral»). SQLite no cambia un CHECK: si la tabla es la vieja,
 * se rehace con los tipos nuevos sin perder filas (una sola vez; después ya no coincide).
 */
const TIPOS_NUEVOS = "'excedente_devuelto', 'umbral', 'excusa_conciliacion', 'recarga_local'";

export const APROBACIONES_DINERO_DDL = `CREATE TABLE IF NOT EXISTS aprobaciones_dinero (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('devolucion_pedido', 'reembolso_recarga', 'ajuste_billetera', 'fondo_punto', 'confirmar_liquidacion', ${TIPOS_NUEVOS})),
  objeto TEXT NOT NULL,
  monto INTEGER NOT NULL,
  moneda TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  datos TEXT NOT NULL,
  pedido_por TEXT NOT NULL REFERENCES usuarios(id),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'ejecutando', 'aprobada', 'rechazada', 'fallida')),
  revisado_por TEXT REFERENCES usuarios(id),
  revisado_en TEXT,
  nota TEXT,
  resultado TEXT,
  error TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (revisado_por IS NULL OR revisado_por <> pedido_por OR estado = 'rechazada')
)`;

const COLUMNAS =
  'id, tipo, objeto, monto, moneda, motivo, datos, pedido_por, estado, revisado_por, revisado_en, nota, resultado, error, creado_en';

/** ¿La tabla existe y todavía no acepta los tipos nuevos? */
export function aprobacionesViejas(sql: string | null): boolean {
  // ETP-3 (3 nov 2026): también se rehace la de SIG-4x, que no acepta «excusa_conciliacion».
  // Flex Fase 7 (13 nov 2026): también la que no acepta «recarga_local» (C-FLEX-RECARGA-LOCAL).
  return Boolean(sql) && !String(sql).includes("'recarga_local'");
}

export async function rehacerAprobacionesDinero(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'aprobaciones_dinero'")
    .first<{ sql: string }>();
  if (!aprobacionesViejas(f?.sql ?? null)) return false;
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    db.prepare('DROP TABLE IF EXISTS aprobaciones_dinero_nueva'),
    db.prepare(
      APROBACIONES_DINERO_DDL.replace(
        'IF NOT EXISTS aprobaciones_dinero',
        'aprobaciones_dinero_nueva',
      ),
    ),
    db.prepare(
      `INSERT INTO aprobaciones_dinero_nueva (${COLUMNAS}) SELECT ${COLUMNAS} FROM aprobaciones_dinero`,
    ),
    db.prepare('DROP TABLE aprobaciones_dinero'),
    db.prepare('ALTER TABLE aprobaciones_dinero_nueva RENAME TO aprobaciones_dinero'),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS aprobaciones_dinero_estado ON aprobaciones_dinero(estado, creado_en)',
    ),
  ]);
  console.warn('esquema: aprobaciones_dinero rehecha con los tipos del control dual de SIG-4x');
  return true;
}
