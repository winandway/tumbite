/**
 * C-QUIEN-PAGA-SERVICIO (25 nov 2026, devolución del revisor de C-TABULADOR-VIGIA) — todos los países.
 * `quien_paga_viajes` nació con la clave (país, ciudad): una regla valía para Moto y Carro a la vez.
 * El Vigía necesita «conductor» SOLO en Moto (Carro sigue como estaba). La clave pasa a (país, ciudad,
 * servicio), con servicio vacío = todos. SQLite no cambia una clave primaria: si la tabla es la vieja,
 * se rehace sin perder filas (todas quedan con servicio vacío, como valían). Una sola vez.
 */
export const QUIEN_PAGA_DDL = `CREATE TABLE IF NOT EXISTS quien_paga_viajes (
  pais TEXT NOT NULL,
  ciudad TEXT NOT NULL DEFAULT '',
  servicio TEXT NOT NULL DEFAULT '',
  valor TEXT NOT NULL CHECK (valor IN ('conductor', 'cliente', 'mitad')),
  cambiado_por TEXT,
  cambiado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pais, ciudad, servicio)
)`;

/** ¿La tabla existe con la clave vieja (sin el servicio)? */
export function quienPagaVieja(sql: string | null): boolean {
  return Boolean(sql) && !/PRIMARY KEY \(pais, ciudad, servicio\)/.test(String(sql));
}

export async function rehacerQuienPaga(db: D1Database): Promise<boolean> {
  const f = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quien_paga_viajes'")
    .first<{ sql: string }>();
  if (!quienPagaVieja(f?.sql ?? null)) return false;
  await db.batch([
    db.prepare('DROP TABLE IF EXISTS quien_paga_viajes_guardadas'),
    db.prepare(
      'CREATE TABLE quien_paga_viajes_guardadas AS SELECT pais, ciudad, valor, cambiado_por, cambiado_en FROM quien_paga_viajes',
    ),
    db.prepare('DROP TABLE quien_paga_viajes'),
    db.prepare(QUIEN_PAGA_DDL.replace('IF NOT EXISTS quien_paga_viajes', 'quien_paga_viajes')),
    db.prepare(
      `INSERT INTO quien_paga_viajes (pais, ciudad, servicio, valor, cambiado_por, cambiado_en)
       SELECT pais, ciudad, '', valor, cambiado_por, cambiado_en FROM quien_paga_viajes_guardadas`,
    ),
    db.prepare('DROP TABLE quien_paga_viajes_guardadas'),
  ]);
  console.warn('esquema: quien_paga_viajes rehecha con el servicio (C-QUIEN-PAGA-SERVICIO)');
  return true;
}
