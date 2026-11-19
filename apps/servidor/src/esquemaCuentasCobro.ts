/**
 * C-PAGO-A-CELULAR (19 nov 2026) — Perú. `cuentas_cobro` nació con una lista cerrada de tipos (CHECK)
 * que no conocía Yape ni Plin. SQLite no cambia un CHECK: si la tabla es la vieja, se rehace con la
 * lista nueva sin perder filas (una sola vez; después ya no coincide). El historial
 * (`cuentas_cobro_historial`) la referencia por id y no se toca: los ids son los mismos.
 */
export const TIPOS_CUENTA_COBRO =
  "'banco', 'nequi', 'daviplata', 'pago_movil', 'zelle', 'yape', 'plin', 'otro'";

export const CUENTAS_COBRO_DDL = `CREATE TABLE IF NOT EXISTS cuentas_cobro (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (${TIPOS_CUENTA_COBRO})),
  banco TEXT NOT NULL DEFAULT '',
  titular TEXT NOT NULL,
  identificador TEXT NOT NULL,
  verificacion TEXT NOT NULL DEFAULT 'declarada' CHECK (verificacion IN ('declarada', 'confirmada')),
  activa INTEGER NOT NULL DEFAULT 1,
  activa_desde TEXT NOT NULL DEFAULT (datetime('now')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const COLUMNAS =
  'id, usuario_id, pais, moneda, tipo, banco, titular, identificador, verificacion, activa, activa_desde, creado_en';

/** ¿La tabla existe y todavía no acepta Yape? */
export function cuentasCobroViejas(sql: string | null): boolean {
  return Boolean(sql) && !String(sql).includes("'yape'");
}

export async function rehacerCuentasCobro(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cuentas_cobro'")
    .first<{ sql: string }>();
  if (!cuentasCobroViejas(f?.sql ?? null)) return false;
  // El orden importa: el historial apunta a `cuentas_cobro` por nombre. Las filas se guardan aparte, se
  // suelta la tabla vieja, se crea la nueva CON EL MISMO NOMBRE y se devuelven las filas: así cada fila
  // del historial vuelve a encontrar su cuenta antes de cerrar el lote (las llaves foráneas se revisan
  // al final). Rehacerla con otro nombre y renombrarla deja el historial huérfano y el lote falla.
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    db.prepare('DROP TABLE IF EXISTS cuentas_cobro_guardadas'),
    db.prepare(`CREATE TABLE cuentas_cobro_guardadas AS SELECT ${COLUMNAS} FROM cuentas_cobro`),
    db.prepare('DROP TABLE cuentas_cobro'),
    db.prepare(CUENTAS_COBRO_DDL.replace('IF NOT EXISTS cuentas_cobro', 'cuentas_cobro')),
    db.prepare(
      `INSERT INTO cuentas_cobro (${COLUMNAS}) SELECT ${COLUMNAS} FROM cuentas_cobro_guardadas`,
    ),
    db.prepare('DROP TABLE cuentas_cobro_guardadas'),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS cuentas_cobro_usuario ON cuentas_cobro(usuario_id, activa)',
    ),
  ]);
  console.warn('esquema: cuentas_cobro rehecha con Yape y Plin (C-PAGO-A-CELULAR)');
  return true;
}
