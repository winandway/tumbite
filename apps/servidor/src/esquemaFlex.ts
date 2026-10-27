/**
 * Divoox Flex · Fase 2: disparadores de la ruta y las migraciones que rehacen dos tablas sin
 * perder filas (C-FLEX-OCUPACION).
 *
 * Regla central: una ruta con N paquetes ocupa al conductor como UNA sola operación
 * (`conductor_ocupacion.tipo = 'ruta_flex'`). La ocupación la toma y la suelta la BASE, con
 * disparadores, en la misma sentencia que cambia el estado de la ruta: dos empresas que asignan
 * al mismo conductor a la vez no pueden ganar las dos. Los disparadores de Comida ya rechazan
 * tomar un pedido si existe una ocupación que no es de comida, así que no se tocan.
 *
 * Los disparadores van aquí (no en schema.sql) porque las tablas que vigilan se pueden rehacer al
 * arrancar y porque `asegurarFase3` ya sabe recrearlos si falta alguno.
 */

/** Estados en los que la ruta tiene al conductor ocupado. */
export const ESTADOS_RUTA_ACTIVA = ['asignada', 'aceptada', 'en_carga', 'en_curso'] as const;
const ACTIVOS = ESTADOS_RUTA_ACTIVA.map((e) => `'${e}'`).join(', ');

export const ESQUEMA_FLEX: readonly string[] = [
  `CREATE TRIGGER IF NOT EXISTS rutas_flex_transicion_valida
BEFORE UPDATE OF estado ON rutas_flex
WHEN NEW.estado <> OLD.estado
 AND NOT EXISTS (SELECT 1 FROM transiciones_ruta_flex WHERE desde = OLD.estado AND hacia = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_ruta_no_permitida');
END`,
  // Antes de ocupar: el conductor no puede tener otra ocupación (pedido de comida, operación u
  // otra ruta). El error tiene nombre propio para responder «conductor ocupado».
  `CREATE TRIGGER IF NOT EXISTS rutas_flex_conductor_libre
BEFORE UPDATE OF estado ON rutas_flex
WHEN NEW.estado IN ('asignada', 'aceptada') AND OLD.estado IN ('borrador', 'ofrecida')
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.conductor_id);
END`,
  `CREATE TRIGGER IF NOT EXISTS rutas_flex_ocupa_conductor
AFTER UPDATE OF estado ON rutas_flex
WHEN NEW.estado IN ('asignada', 'aceptada') AND OLD.estado IN ('borrador', 'ofrecida')
BEGIN
  INSERT INTO conductor_ocupacion (conductor_id, tipo, ruta_id) VALUES (NEW.conductor_id, 'ruta_flex', NEW.id);
END`,
  `CREATE TRIGGER IF NOT EXISTS rutas_flex_libera_conductor
AFTER UPDATE OF estado ON rutas_flex
WHEN OLD.estado IN (${ACTIVOS}) AND NEW.estado NOT IN (${ACTIVOS})
BEGIN
  DELETE FROM conductor_ocupacion WHERE ruta_id = OLD.id;
END`,
  // Con la ruta activa no se cambia de conductor por debajo (habría que soltarla primero).
  `CREATE TRIGGER IF NOT EXISTS rutas_flex_conductor_fijo
BEFORE UPDATE OF conductor_id ON rutas_flex
WHEN OLD.estado IN (${ACTIVOS}) AND NEW.estado IN (${ACTIVOS}) AND NEW.conductor_id IS NOT OLD.conductor_id
BEGIN
  SELECT RAISE(ABORT, 'cambio_de_conductor_en_ruta_activa');
END`,
];

// ─────────────────────────── Migraciones (rehacer sin perder filas) ───────────────────────────

/** La forma nueva de conductor_ocupacion (igual que en schema.sql; lo vigila una prueba). */
export const OCUPACION_DDL = `CREATE TABLE IF NOT EXISTS conductor_ocupacion (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'operacion', 'ruta_flex')),
  operacion_id TEXT REFERENCES operaciones(id),
  pedidos INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  ruta_id TEXT REFERENCES rutas_flex(id),
  CHECK ((tipo = 'comida' AND operacion_id IS NULL AND ruta_id IS NULL AND pedidos >= 1)
      OR (tipo = 'operacion' AND operacion_id IS NOT NULL AND ruta_id IS NULL AND pedidos = 0)
      OR (tipo = 'ruta_flex' AND ruta_id IS NOT NULL AND operacion_id IS NULL AND pedidos = 0))
)`;

export const RUTAS_FLEX_DDL = `CREATE TABLE IF NOT EXISTS rutas_flex (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  centro_id TEXT REFERENCES empresa_centros(id),
  lote_id TEXT REFERENCES lotes(id),
  nombre TEXT NOT NULL DEFAULT '',
  conductor_id TEXT REFERENCES usuarios(id),
  vehiculo_id TEXT REFERENCES vehiculos(id),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN (
    'borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga', 'en_curso',
    'completada', 'con_incidencias', 'cancelada')),
  bloque_desde TEXT,
  bloque_hasta TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fase 2: cómo llegó al conductor (asignación directa a uno propio u oferta a uno de la red).
  modalidad TEXT CHECK (modalidad IS NULL OR modalidad IN ('asignacion', 'oferta')),
  oferta_vence_en TEXT,
  asignada_en TEXT,
  aceptada_en TEXT,
  carga_en TEXT,
  iniciada_en TEXT,
  cerrada_en TEXT,
  ultima_clave TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  conductor_lat REAL,
  conductor_lng REAL,
  conductor_ubicacion_en TEXT,
  resumen_json TEXT,
  CHECK ((estado = 'borrador' AND conductor_id IS NULL) OR estado = 'cancelada'
      OR (estado NOT IN ('borrador', 'cancelada') AND conductor_id IS NOT NULL))
)`;

const INDICES_RUTAS = [
  'CREATE INDEX IF NOT EXISTS rutas_flex_empresa ON rutas_flex(empresa_id, estado)',
  `CREATE UNIQUE INDEX IF NOT EXISTS rutas_flex_una_activa
  ON rutas_flex(conductor_id) WHERE estado IN ('asignada', 'aceptada', 'en_carga', 'en_curso') AND conductor_id IS NOT NULL`,
  'CREATE INDEX IF NOT EXISTS rutas_flex_conductor ON rutas_flex(conductor_id, estado)',
];
const INDICES_OCUPACION = [
  'CREATE UNIQUE INDEX IF NOT EXISTS conductor_ocupacion_operacion ON conductor_ocupacion(operacion_id) WHERE operacion_id IS NOT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS conductor_ocupacion_ruta ON conductor_ocupacion(ruta_id) WHERE ruta_id IS NOT NULL',
];

async function sqlDe(db: D1Database, tabla: string): Promise<string | null> {
  const f = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(tabla)
    .first<{ sql: string }>();
  return f?.sql ?? null;
}

/**
 * Los disparadores y vistas que mencionan una tabla (y, en cadena, las vistas que usan esas
 * vistas). Hay que soltarlos antes de rehacer la tabla: si no, el RENAME falla al revisar el
 * esquema. Después `asegurarFase3` los vuelve a crear (son todos de esquemaFase3 / esquemaFlex).
 */
async function dependientesDe(db: D1Database, tabla: string) {
  const { results } = await db
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE type IN ('trigger', 'view') AND sql IS NOT NULL",
    )
    .all<{ type: 'trigger' | 'view'; name: string; sql: string }>();
  const fuera = new Map<string, 'trigger' | 'view'>();
  const nombres = [tabla];
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const o of results)
      // eslint-disable-next-line security/detect-non-literal-regexp -- nombres de tablas y vistas propias de sqlite_master
      if (!fuera.has(o.name) && nombres.some((n) => new RegExp(`\\b${n}\\b`).test(o.sql))) {
        fuera.set(o.name, o.type);
        if (o.type === 'view') nombres.push(o.name);
        cambio = true;
      }
  }
  return [...fuera.entries()];
}

/** rutas_flex de la Fase 1 (estados borrador/lista/…): se rehace con los estados de la Fase 2. */
export const rutasFlexViejas = (sql: string | null) =>
  Boolean(sql) && !/'ofrecida'/.test(sql ?? '');
/** conductor_ocupacion sin el tipo ruta_flex. */
export const ocupacionVieja = (sql: string | null) =>
  Boolean(sql) && !/'ruta_flex'/.test(sql ?? '');

export async function rehacerFlex(db: D1Database): Promise<{ rutas: boolean; ocupacion: boolean }> {
  const hecho = { rutas: false, ocupacion: false };
  if (rutasFlexViejas(await sqlDe(db, 'rutas_flex'))) {
    const fuera = await dependientesDe(db, 'rutas_flex');
    await db.batch([
      db.prepare('PRAGMA defer_foreign_keys = ON'),
      ...fuera.map(([nombre, tipo]) =>
        db.prepare(`DROP ${tipo === 'view' ? 'VIEW' : 'TRIGGER'} IF EXISTS ${nombre}`),
      ),
      db.prepare('DROP TABLE IF EXISTS rutas_flex_nueva'),
      db.prepare(RUTAS_FLEX_DDL.replace('IF NOT EXISTS rutas_flex', 'rutas_flex_nueva')),
      // En la Fase 1 ninguna ruta tenía conductor: todo vuelve a «borrador» (o sigue «cancelada»).
      db.prepare(
        `INSERT INTO rutas_flex_nueva (id, empresa_id, centro_id, lote_id, nombre, conductor_id, vehiculo_id,
           estado, bloque_desde, bloque_hasta, creado_en, actualizado_en)
         SELECT id, empresa_id, centro_id, lote_id, nombre, NULL, NULL,
           CASE estado WHEN 'cancelada' THEN 'cancelada' ELSE 'borrador' END,
           bloque_desde, bloque_hasta, creado_en, actualizado_en FROM rutas_flex`,
      ),
      db.prepare('DROP TABLE rutas_flex'),
      db.prepare('ALTER TABLE rutas_flex_nueva RENAME TO rutas_flex'),
      ...INDICES_RUTAS.map((sql) => db.prepare(sql)),
    ]);
    console.warn('esquema: rutas_flex rehecha con los estados de la Fase 2 de Flex');
    hecho.rutas = true;
  }
  if (ocupacionVieja(await sqlDe(db, 'conductor_ocupacion'))) {
    const fuera = await dependientesDe(db, 'conductor_ocupacion');
    await db.batch([
      db.prepare('PRAGMA defer_foreign_keys = ON'),
      ...fuera.map(([nombre, tipo]) =>
        db.prepare(`DROP ${tipo === 'view' ? 'VIEW' : 'TRIGGER'} IF EXISTS ${nombre}`),
      ),
      db.prepare('DROP TABLE IF EXISTS conductor_ocupacion_nueva'),
      db.prepare(
        OCUPACION_DDL.replace('IF NOT EXISTS conductor_ocupacion', 'conductor_ocupacion_nueva'),
      ),
      db.prepare(
        `INSERT INTO conductor_ocupacion_nueva (conductor_id, tipo, operacion_id, pedidos, desde)
         SELECT conductor_id, tipo, operacion_id, pedidos, desde FROM conductor_ocupacion`,
      ),
      db.prepare('DROP TABLE conductor_ocupacion'),
      db.prepare('ALTER TABLE conductor_ocupacion_nueva RENAME TO conductor_ocupacion'),
      ...INDICES_OCUPACION.map((sql) => db.prepare(sql)),
    ]);
    console.warn('esquema: conductor_ocupacion rehecha con el tipo ruta_flex (Flex, Fase 2)');
    hecho.ocupacion = true;
  }
  // Siempre (barato, idempotente): el índice único de la ocupación por ruta. No va en schema.sql.
  await db.batch(INDICES_OCUPACION.map((sql) => db.prepare(sql)));
  return hecho;
}
