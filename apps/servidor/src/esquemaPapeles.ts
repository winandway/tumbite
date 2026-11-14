/**
 * C-CARRO-PAPELES-PAIS (13 nov 2026) — Venezuela. `conductor_documentos` nació (C-PAPELES-CONDUCTOR) con
 * una lista cerrada de tipos (CHECK) que solo conocía los papeles del mototaxista. El taxista sube
 * también su licencia de conducir (`licencia_conducir`). SQLite no cambia un CHECK: si la tabla es la
 * vieja, se rehace con la lista nueva sin perder filas (una sola vez; después ya no coincide).
 */
export const TIPOS_DOCUMENTO_CONDUCTOR =
  "'licencia_moto', 'antecedentes_penales', 'licencia_conducir'";

export const CONDUCTOR_DOCUMENTOS_DDL = `CREATE TABLE IF NOT EXISTS conductor_documentos (
  id TEXT PRIMARY KEY,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN (${TIPOS_DOCUMENTO_CONDUCTOR})),
  clave TEXT NOT NULL,
  vence_en TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reemplazado')),
  motivo TEXT NOT NULL DEFAULT '',
  revisado_por TEXT REFERENCES usuarios(id),
  revisado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const COLUMNAS =
  'id, conductor_id, tipo, clave, vence_en, estado, motivo, revisado_por, revisado_en, creado_en';

/** ¿La tabla existe y todavía no acepta la licencia de conducir? */
export function papelesViejos(sql: string | null): boolean {
  return Boolean(sql) && !String(sql).includes("'licencia_conducir'");
}

export async function rehacerConductorDocumentos(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'conductor_documentos'")
    .first<{ sql: string }>();
  if (!papelesViejos(f?.sql ?? null)) return false;
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    db.prepare('DROP TABLE IF EXISTS conductor_documentos_nueva'),
    db.prepare(
      CONDUCTOR_DOCUMENTOS_DDL.replace(
        'IF NOT EXISTS conductor_documentos',
        'conductor_documentos_nueva',
      ),
    ),
    db.prepare(
      `INSERT INTO conductor_documentos_nueva (${COLUMNAS}) SELECT ${COLUMNAS} FROM conductor_documentos`,
    ),
    db.prepare('DROP TABLE conductor_documentos'),
    db.prepare('ALTER TABLE conductor_documentos_nueva RENAME TO conductor_documentos'),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS conductor_documentos_conductor ON conductor_documentos(conductor_id, tipo, estado)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS conductor_documentos_revision ON conductor_documentos(estado, creado_en)',
    ),
  ]);
  console.warn(
    'esquema: conductor_documentos rehecha con la licencia de conducir (C-CARRO-PAPELES-PAIS)',
  );
  return true;
}
