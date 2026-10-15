-- PUNTO 4: estados de viaje coherentes. Cancelar TERMINA el viaje; si el conductor se baja,
-- NO es una cancelación: es «liberar», y el viaje vuelve a buscar (con su propio registro).
CREATE TABLE IF NOT EXISTS viajes (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso',
    'terminado', 'cancelado', 'no_show', 'sin_conductor')),
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  pasajeros INTEGER NOT NULL DEFAULT 1 CHECK (pasajeros BETWEEN 1 AND 6),
  pin_recogida TEXT NOT NULL CHECK (length(pin_recogida) = 4),
  liberaciones INTEGER NOT NULL DEFAULT 0 CHECK (liberaciones >= 0),
  distancia_m_real INTEGER, duracion_s_real INTEGER, total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT, cerrado_en TEXT
);

-- Transiciones permitidas: la base rechaza cualquier otra.
CREATE TABLE IF NOT EXISTS transiciones_viaje (
  desde TEXT NOT NULL, hacia TEXT NOT NULL, actor TEXT NOT NULL,
  PRIMARY KEY (desde, hacia, actor)
);
INSERT OR IGNORE INTO transiciones_viaje (desde, hacia, actor) VALUES
  ('pago_pendiente', 'buscando', 'sistema'),
  ('pago_pendiente', 'cancelado', 'cliente'), ('pago_pendiente', 'cancelado', 'sistema'),
  ('buscando', 'asignado', 'conductor'),
  ('buscando', 'sin_conductor', 'sistema'),
  ('buscando', 'cancelado', 'cliente'), ('buscando', 'cancelado', 'soporte'),
  ('asignado', 'conductor_llego', 'conductor'), ('asignado', 'conductor_llego', 'sistema'),
  ('asignado', 'buscando', 'conductor'), ('asignado', 'buscando', 'sistema'), ('asignado', 'buscando', 'soporte'),
  ('asignado', 'cancelado', 'cliente'), ('asignado', 'cancelado', 'soporte'),
  ('conductor_llego', 'en_curso', 'conductor'),
  ('conductor_llego', 'no_show', 'conductor'),
  ('conductor_llego', 'buscando', 'conductor'), ('conductor_llego', 'buscando', 'soporte'),
  ('conductor_llego', 'cancelado', 'cliente'), ('conductor_llego', 'cancelado', 'soporte'),
  ('en_curso', 'terminado', 'conductor'), ('en_curso', 'terminado', 'soporte');

-- Quién hace el cambio se pasa por una fila de contexto en la misma transacción.
CREATE TABLE IF NOT EXISTS contexto_transicion (
  operacion_id TEXT PRIMARY KEY,
  actor TEXT NOT NULL CHECK (actor IN ('cliente', 'conductor', 'soporte', 'sistema')),
  actor_id TEXT,
  idempotencia TEXT
);

CREATE TRIGGER IF NOT EXISTS viajes_transicion_valida
BEFORE UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado AND NOT EXISTS (
  SELECT 1 FROM transiciones_viaje t
   WHERE t.desde = OLD.estado AND t.hacia = NEW.estado
     AND t.actor = (SELECT actor FROM contexto_transicion WHERE operacion_id = NEW.operacion_id))
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_viaje_no_permitida');
END;

-- Un solo lugar manda el estado: el viaje. La cabecera común se deriva (nunca se escribe a mano).
CREATE TRIGGER IF NOT EXISTS viajes_deriva_estado_general
AFTER UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  UPDATE operaciones
     SET estado_general = CASE NEW.estado
           WHEN 'pago_pendiente' THEN 'pago_pendiente'
           WHEN 'buscando' THEN 'buscando'
           WHEN 'asignado' THEN 'asignada'
           WHEN 'conductor_llego' THEN 'asignada'
           WHEN 'en_curso' THEN 'en_curso'
           WHEN 'terminado' THEN 'terminada'
           WHEN 'no_show' THEN 'terminada'
           WHEN 'cancelado' THEN 'cancelada'
           WHEN 'sin_conductor' THEN 'sin_conductor' END,
         version = version + 1, actualizado_en = datetime('now')
   WHERE id = NEW.operacion_id;
  INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, idempotencia)
  SELECT NEW.operacion_id, 'transicion', OLD.estado, NEW.estado, c.actor_id, c.actor, c.idempotencia
    FROM contexto_transicion c WHERE c.operacion_id = NEW.operacion_id;
  DELETE FROM contexto_transicion WHERE operacion_id = NEW.operacion_id;
END;

-- Cada asignación (y su final) queda escrita: así «el conductor se bajó» no se confunde con
-- «se canceló el viaje».
CREATE TABLE IF NOT EXISTS asignaciones_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  inicio TEXT NOT NULL DEFAULT (datetime('now')),
  fin TEXT,
  resultado TEXT CHECK (resultado IS NULL OR resultado IN
    ('completada', 'liberada_conductor', 'liberada_sistema', 'reasignada_soporte', 'cancelada', 'no_show')),
  motivo TEXT NOT NULL DEFAULT '',
  CHECK ((fin IS NULL) = (resultado IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_una_abierta ON asignaciones_operacion(operacion_id) WHERE fin IS NULL;
CREATE INDEX IF NOT EXISTS asignaciones_conductor ON asignaciones_operacion(conductor_id, inicio);
