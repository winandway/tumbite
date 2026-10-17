/**
 * C-TERRITORIO (17 oct 2026): la tabla de franquicias nació con «una franquicia por ciudad»
 * (zona_id UNIQUE). SQLite no deja quitar un UNIQUE: se rehace la tabla UNA vez, copiando todas
 * sus filas, en un solo lote (una transacción). Si ya tiene la forma nueva, no se toca.
 * La definición tiene que ser IGUAL a la de schema.sql (lo vigila esquemaTerritorio.test.ts).
 */
export const FRANQUICIAS_DDL = `CREATE TABLE IF NOT EXISTS franquicias (
  id TEXT PRIMARY KEY,
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  codigo TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'prospecto' CHECK (estado IN ('prospecto', 'vendida', 'activa', 'pausada', 'cerrada')),
  dueno_id TEXT REFERENCES usuarios(id),
  dueno_correo TEXT NOT NULL DEFAULT '',
  motos INTEGER NOT NULL DEFAULT 0,
  notas TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  vendida_en TEXT,
  nombre TEXT NOT NULL DEFAULT '',
  ticket_id TEXT REFERENCES tickets(id),
  condiciones_json TEXT NOT NULL DEFAULT '{}'
)`;

const COLUMNAS_VIEJAS =
  'id, zona_id, codigo, estado, dueno_id, dueno_correo, motos, notas, creado_en, vendida_en';

/** true si la tabla todavía tiene la forma vieja (y por eso hay que rehacerla). */
export function franquiciasViejas(sql: string | null | undefined): boolean {
  if (!sql) return false;
  return /zona_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(sql) || !/condiciones_json/.test(sql);
}

export async function rehacerFranquicias(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'franquicias'")
    .first<{ sql: string }>();
  if (!franquiciasViejas(f?.sql)) return false;
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    db.prepare('DROP TABLE IF EXISTS franquicias_nueva'),
    db.prepare(FRANQUICIAS_DDL.replace('IF NOT EXISTS franquicias', 'franquicias_nueva')),
    db.prepare(
      `INSERT INTO franquicias_nueva (${COLUMNAS_VIEJAS}) SELECT ${COLUMNAS_VIEJAS} FROM franquicias`,
    ),
    db.prepare('DROP TABLE franquicias'),
    db.prepare('ALTER TABLE franquicias_nueva RENAME TO franquicias'),
    db.prepare('CREATE INDEX IF NOT EXISTS franquicias_zona ON franquicias(zona_id, estado)'),
  ]);
  console.warn('esquema: tabla de franquicias rehecha (varias franquicias por ciudad)');
  return true;
}
