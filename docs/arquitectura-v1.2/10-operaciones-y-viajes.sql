-- V1.2 · Operaciones y viajes. Principio: UNA ACCIÓN = UNA SENTENCIA. Lo que acompaña a cada
-- cambio (estado derivado, evento, asignación, ofertas, ocupación) lo hacen disparadores DENTRO
-- de esa misma sentencia: o pasa todo o no pasa nada, sin depender de cómo se agrupe un batch.
-- Reemplaza: `operaciones` y `viajes` de V1/V1.1 y elimina `contexto_transicion` de V1.1.

CREATE TABLE IF NOT EXISTS operaciones (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN ('viaje_pasajero', 'envio_paquete', 'compra_encargo', 'pedido_comercio')),
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  conductor_id TEXT REFERENCES usuarios(id),
  vehiculo_id TEXT REFERENCES vehiculos(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  cotizacion_id TEXT UNIQUE REFERENCES cotizaciones(id),
  estado_general TEXT NOT NULL CHECK (estado_general IN
    ('pago_pendiente', 'buscando', 'asignada', 'en_curso', 'terminada', 'cancelada', 'sin_conductor')),
  ultima_clave TEXT,                         -- clave de idempotencia de la última aceptación
  version INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (estado_general NOT IN ('asignada', 'en_curso') OR (conductor_id IS NOT NULL AND vehiculo_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS operaciones_cliente ON operaciones(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS operaciones_busqueda ON operaciones(zona_id, servicio_id, creado_en) WHERE estado_general = 'buscando';
CREATE UNIQUE INDEX IF NOT EXISTS operaciones_una_activa ON operaciones(conductor_id) WHERE estado_general IN ('asignada', 'en_curso');

CREATE TABLE IF NOT EXISTS viajes (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso',
    'terminado', 'cancelado', 'no_show', 'sin_conductor')),
  -- Quién hizo el último cambio y con qué clave: viajan EN la misma sentencia que el cambio.
  ultimo_actor TEXT NOT NULL CHECK (ultimo_actor IN ('cliente', 'conductor', 'soporte', 'sistema')),
  ultimo_actor_id TEXT REFERENCES usuarios(id),
  ultima_clave TEXT NOT NULL,
  motivo_transicion TEXT NOT NULL DEFAULT '',
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  pasajeros INTEGER NOT NULL DEFAULT 1 CHECK (pasajeros BETWEEN 1 AND 6),
  pin_recogida TEXT NOT NULL CHECK (length(pin_recogida) = 4),
  liberaciones INTEGER NOT NULL DEFAULT 0 CHECK (liberaciones >= 0),
  distancia_m_real INTEGER, duracion_s_real INTEGER, total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT
);

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

CREATE TABLE IF NOT EXISTS asignaciones_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  clave TEXT NOT NULL UNIQUE,                 -- la clave de la aceptación: no hay dos registros por la misma
  inicio TEXT NOT NULL DEFAULT (datetime('now')),
  fin TEXT,
  resultado TEXT CHECK (resultado IS NULL OR resultado IN
    ('completada', 'liberada_conductor', 'liberada_sistema', 'reasignada_soporte', 'cancelada', 'no_show')),
  motivo TEXT NOT NULL DEFAULT '',
  CHECK ((fin IS NULL) = (resultado IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_una_abierta ON asignaciones_operacion(operacion_id) WHERE fin IS NULL;
CREATE INDEX IF NOT EXISTS asignaciones_conductor ON asignaciones_operacion(conductor_id, inicio);

-- ---------- Guardas de coherencia ----------

-- Cada cambio de estado del viaje: transición permitida para ESE actor, y clave NUEVA.
-- (Sin clave nueva no hay cambio: un actor viejo no puede «colarse» en el cambio siguiente.)
CREATE TRIGGER IF NOT EXISTS viajes_transicion_valida
BEFORE UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_viaje_no_permitida')
   WHERE NOT EXISTS (SELECT 1 FROM transiciones_viaje
                      WHERE desde = OLD.estado AND hacia = NEW.estado AND actor = NEW.ultimo_actor);
  SELECT RAISE(ABORT, 'transicion_sin_clave_nueva')
   WHERE NEW.ultima_clave IS OLD.ultima_clave;
END;
-- Cambiar actor o clave sin cambiar el estado no sirve para nada: se prohíbe.
CREATE TRIGGER IF NOT EXISTS viajes_actor_solo_con_transicion
BEFORE UPDATE OF ultimo_actor, ultimo_actor_id, ultima_clave ON viajes
WHEN NEW.estado = OLD.estado
 AND (NEW.ultimo_actor IS NOT OLD.ultimo_actor OR NEW.ultimo_actor_id IS NOT OLD.ultimo_actor_id
      OR NEW.ultima_clave IS NOT OLD.ultima_clave)
BEGIN
  SELECT RAISE(ABORT, 'actor_sin_transicion');
END;

-- La cabecera nunca contradice al viaje (si alguien la escribe a mano, la base aborta).
CREATE TRIGGER IF NOT EXISTS operaciones_estado_coherente
BEFORE UPDATE OF estado_general ON operaciones
WHEN EXISTS (SELECT 1 FROM viajes WHERE operacion_id = NEW.id)
 AND NEW.estado_general IS NOT (SELECT CASE estado
       WHEN 'pago_pendiente' THEN 'pago_pendiente' WHEN 'buscando' THEN 'buscando'
       WHEN 'asignado' THEN 'asignada' WHEN 'conductor_llego' THEN 'asignada'
       WHEN 'en_curso' THEN 'en_curso' WHEN 'terminado' THEN 'terminada' WHEN 'no_show' THEN 'terminada'
       WHEN 'cancelado' THEN 'cancelada' WHEN 'sin_conductor' THEN 'sin_conductor' END
     FROM viajes WHERE operacion_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'estado_general_incoherente');
END;

-- El conductor solo entra cuando la operación busca (con clave nueva) y solo sale para volver a buscar.
CREATE TRIGGER IF NOT EXISTS operaciones_conductor_coherente
BEFORE UPDATE OF conductor_id ON operaciones
WHEN NEW.conductor_id IS NOT OLD.conductor_id
BEGIN
  SELECT RAISE(ABORT, 'cambio_de_conductor_no_permitido')
   WHERE NOT (
     (OLD.conductor_id IS NULL AND NEW.conductor_id IS NOT NULL AND OLD.estado_general = 'buscando')
     OR (OLD.conductor_id IS NOT NULL AND NEW.conductor_id IS NULL AND NEW.estado_general = 'buscando'));
  SELECT RAISE(ABORT, 'aceptacion_sin_clave_nueva')
   WHERE NEW.conductor_id IS NOT NULL AND (NEW.ultima_clave IS NULL OR NEW.ultima_clave IS OLD.ultima_clave);
END;

-- ---------- Efectos de cada cambio (dentro de la misma sentencia) ----------

-- Aceptar = la sentencia pone conductor y vehículo. Esto hace el resto.
CREATE TRIGGER IF NOT EXISTS operaciones_al_asignar
AFTER UPDATE OF conductor_id ON operaciones
WHEN OLD.conductor_id IS NULL AND NEW.conductor_id IS NOT NULL
BEGIN
  UPDATE viajes SET estado = 'asignado', asignado_en = datetime('now'),
         ultimo_actor = 'conductor', ultimo_actor_id = NEW.conductor_id,
         ultima_clave = NEW.ultima_clave, motivo_transicion = ''
   WHERE operacion_id = NEW.id AND estado = 'buscando';
  INSERT INTO asignaciones_operacion (operacion_id, conductor_id, vehiculo_id, clave)
  VALUES (NEW.id, NEW.conductor_id, NEW.vehiculo_id, NEW.ultima_clave);
  UPDATE ofertas_operacion SET estado = 'aceptada', respondida_en = datetime('now')
   WHERE operacion_id = NEW.id AND conductor_id = NEW.conductor_id;
  UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
   WHERE operacion_id = NEW.id AND conductor_id <> NEW.conductor_id AND estado = 'ofrecida';
END;

-- Todo cambio de estado del viaje: cabecera derivada, evento, cierre de la asignación y,
-- si vuelve a buscar, el conductor sale.
CREATE TRIGGER IF NOT EXISTS viajes_al_cambiar_estado
AFTER UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  UPDATE operaciones
     SET estado_general = CASE NEW.estado
           WHEN 'pago_pendiente' THEN 'pago_pendiente' WHEN 'buscando' THEN 'buscando'
           WHEN 'asignado' THEN 'asignada' WHEN 'conductor_llego' THEN 'asignada'
           WHEN 'en_curso' THEN 'en_curso' WHEN 'terminado' THEN 'terminada' WHEN 'no_show' THEN 'terminada'
           WHEN 'cancelado' THEN 'cancelada' WHEN 'sin_conductor' THEN 'sin_conductor' END,
         version = version + 1, actualizado_en = datetime('now')
   WHERE id = NEW.operacion_id;
  INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, idempotencia, datos_json)
  VALUES (NEW.operacion_id, 'transicion', OLD.estado, NEW.estado, NEW.ultimo_actor_id, NEW.ultimo_actor,
          NEW.ultima_clave, json_object('motivo', NEW.motivo_transicion));
  UPDATE asignaciones_operacion
     SET fin = datetime('now'), motivo = NEW.motivo_transicion,
         resultado = CASE
           WHEN NEW.estado = 'buscando' THEN CASE NEW.ultimo_actor
                WHEN 'conductor' THEN 'liberada_conductor' WHEN 'soporte' THEN 'reasignada_soporte'
                ELSE 'liberada_sistema' END
           WHEN NEW.estado = 'terminado' THEN 'completada'
           WHEN NEW.estado = 'no_show' THEN 'no_show'
           ELSE 'cancelada' END
   WHERE operacion_id = NEW.operacion_id AND fin IS NULL
     AND NEW.estado IN ('buscando', 'terminado', 'no_show', 'cancelado', 'sin_conductor');
  UPDATE ofertas_operacion SET estado = 'rechazada'
   WHERE operacion_id = NEW.operacion_id AND estado = 'aceptada'
     AND NEW.estado = 'buscando' AND OLD.estado IN ('asignado', 'conductor_llego');
  UPDATE operaciones SET conductor_id = NULL, vehiculo_id = NULL
   WHERE id = NEW.operacion_id
     AND NEW.estado = 'buscando' AND OLD.estado IN ('asignado', 'conductor_llego');
END;

-- Invariantes (el Manager las consulta cada minuto; en un sistema sano devuelve cero filas).
CREATE VIEW IF NOT EXISTS inconsistencias_operaciones AS
SELECT 'estado_general' AS problema, o.id AS referencia FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
 WHERE o.estado_general IS NOT CASE v.estado
       WHEN 'pago_pendiente' THEN 'pago_pendiente' WHEN 'buscando' THEN 'buscando'
       WHEN 'asignado' THEN 'asignada' WHEN 'conductor_llego' THEN 'asignada'
       WHEN 'en_curso' THEN 'en_curso' WHEN 'terminado' THEN 'terminada' WHEN 'no_show' THEN 'terminada'
       WHEN 'cancelado' THEN 'cancelada' WHEN 'sin_conductor' THEN 'sin_conductor' END
UNION ALL
SELECT 'asignada_sin_asignacion_abierta', o.id FROM operaciones o
 WHERE o.estado_general IN ('asignada', 'en_curso')
   AND NOT EXISTS (SELECT 1 FROM asignaciones_operacion a WHERE a.operacion_id = o.id AND a.fin IS NULL AND a.conductor_id = o.conductor_id)
UNION ALL
SELECT 'asignacion_abierta_sin_operacion_activa', a.operacion_id FROM asignaciones_operacion a
  JOIN operaciones o ON o.id = a.operacion_id
 WHERE a.fin IS NULL AND (o.estado_general NOT IN ('asignada', 'en_curso') OR o.conductor_id IS NOT a.conductor_id)
UNION ALL
SELECT 'buscando_con_conductor', o.id FROM operaciones o WHERE o.estado_general = 'buscando' AND o.conductor_id IS NOT NULL
UNION ALL
SELECT 'operacion_activa_sin_ocupacion', o.id FROM operaciones o
 WHERE o.estado_general IN ('asignada', 'en_curso')
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.operacion_id = o.id AND c.conductor_id = o.conductor_id)
UNION ALL
SELECT 'ocupacion_de_operacion_inactiva', c.conductor_id FROM conductor_ocupacion c
 WHERE c.tipo = 'operacion'
   AND NOT EXISTS (SELECT 1 FROM operaciones o WHERE o.id = c.operacion_id AND o.estado_general IN ('asignada', 'en_curso') AND o.conductor_id = c.conductor_id)
UNION ALL
SELECT 'conteo_de_comida', c.conductor_id FROM conductor_ocupacion c
 WHERE c.tipo = 'comida'
   AND c.pedidos <> (SELECT COUNT(*) FROM pedidos p WHERE p.repartidor_id = c.conductor_id AND p.estado IN ('aceptado', 'listo', 'en_camino'))
UNION ALL
SELECT 'repartidor_con_pedido_sin_ocupacion', p.repartidor_id FROM pedidos p
 WHERE p.repartidor_id IS NOT NULL AND p.estado IN ('aceptado', 'listo', 'en_camino')
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = p.repartidor_id AND c.tipo = 'comida');
