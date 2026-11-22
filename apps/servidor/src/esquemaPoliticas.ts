/**
 * C-SALDO-RESTAURANTE (22 nov 2026) — Venezuela y todos los países. `politicas_financieras` nació con
 * una lista cerrada de a quién se le cobra (CHECK de `tipo_cuenta`: empresa o conductor). El
 * restaurante ahora tiene su saldo prepago y su comisión configurable desde el panel. SQLite no cambia
 * un CHECK: si la tabla es la vieja, se rehace con la lista nueva sin perder filas (una sola vez;
 * después ya no coincide). Mismo patrón que `rehacerCuentasCobro`: las filas se guardan aparte, se
 * suelta la tabla, se crea la nueva CON EL MISMO NOMBRE y se devuelven las filas, todo en un lote con
 * las llaves foráneas revisadas al final (`cobros` apunta a una política por id). Los disparadores de
 * inmutabilidad se van con la tabla vieja (DROP no los dispara) y `asegurarFase3` los vuelve a crear
 * justo después en la migración. No se siembra ninguna política de restaurantes: sin política, Divoox
 * no le cobra nada al restaurante (0 %, «gratis para empezar»). Encender una comisión es decisión de
 * Richard y se hace creando la política desde el panel (y solo rige con la revisión legal aprobada).
 */
export const POLITICAS_FINANCIERAS_DDL = `CREATE TABLE IF NOT EXISTS politicas_financieras (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL DEFAULT '',
  servicio TEXT NOT NULL CHECK (servicio IN ('flex', 'express', 'food', 'ride', 'car', 'grocery')),
  tipo_cuenta TEXT NOT NULL CHECK (tipo_cuenta IN ('empresa', 'conductor', 'restaurante')),
  pais TEXT NOT NULL,
  ciudad TEXT,
  empresa_id TEXT REFERENCES empresas(id),
  modalidad TEXT NOT NULL CHECK (modalidad IN ('prepago', 'connect', 'sin_cobro')),
  moneda TEXT NOT NULL,
  regla_json TEXT NOT NULL,
  descuento_pb INTEGER NOT NULL DEFAULT 0 CHECK (descuento_pb BETWEEN 0 AND 10000),
  vigente_desde TEXT NOT NULL,
  vigente_hasta TEXT,
  prioridad INTEGER NOT NULL DEFAULT 0,
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  revision_legal_aprobada INTEGER NOT NULL DEFAULT 0 CHECK (revision_legal_aprobada IN (0, 1)),
  revision_legal_nota TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT '',
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  cerrada_por TEXT REFERENCES usuarios(id),
  cerrada_en TEXT,
  CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
)`;

const COLUMNAS =
  'id, nombre, servicio, tipo_cuenta, pais, ciudad, empresa_id, modalidad, moneda, regla_json, descuento_pb, vigente_desde, vigente_hasta, prioridad, activa, revision_legal_aprobada, revision_legal_nota, motivo, creado_por, creado_en, cerrada_por, cerrada_en';

/** ¿La tabla existe y todavía no acepta restaurantes? */
export function politicasViejas(sql: string | null): boolean {
  return Boolean(sql) && !String(sql).includes("'restaurante'");
}

export async function rehacerPoliticasFinancieras(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'politicas_financieras'",
    )
    .first<{ sql: string }>();
  if (!politicasViejas(f?.sql ?? null)) return false;
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    db.prepare('DROP TABLE IF EXISTS politicas_financieras_guardadas'),
    db.prepare(
      `CREATE TABLE politicas_financieras_guardadas AS SELECT ${COLUMNAS} FROM politicas_financieras`,
    ),
    db.prepare('DROP TABLE politicas_financieras'),
    db.prepare(
      POLITICAS_FINANCIERAS_DDL.replace(
        'IF NOT EXISTS politicas_financieras',
        'politicas_financieras',
      ),
    ),
    db.prepare(
      `INSERT INTO politicas_financieras (${COLUMNAS}) SELECT ${COLUMNAS} FROM politicas_financieras_guardadas`,
    ),
    db.prepare('DROP TABLE politicas_financieras_guardadas'),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS politicas_financieras_busqueda ON politicas_financieras(servicio, tipo_cuenta, pais, activa)',
    ),
  ]);
  console.warn('esquema: politicas_financieras rehecha con los restaurantes (C-SALDO-RESTAURANTE)');
  return true;
}
