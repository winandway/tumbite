-- PUNTO 3: exclusividad atómica entre comida y operaciones.
-- Una sola fila por conductor ocupado. La clave primaria es la garantía: dos ocupaciones de
-- distinto tipo NO pueden coexistir. La comida admite varios pedidos agrupados en la misma fila.
CREATE TABLE IF NOT EXISTS conductor_ocupacion (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'operacion')),
  operacion_id TEXT REFERENCES operaciones(id),
  pedidos INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((tipo = 'comida' AND operacion_id IS NULL AND pedidos >= 1)
      OR (tipo = 'operacion' AND operacion_id IS NOT NULL AND pedidos = 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS conductor_ocupacion_operacion ON conductor_ocupacion(operacion_id) WHERE operacion_id IS NOT NULL;

-- Comida (tabla existente, SIN cambiar sus columnas ni su código de aceptación):
-- al tomar un pedido, ocupa al conductor; si está en una operación, la base aborta.
CREATE TRIGGER IF NOT EXISTS pedidos_ocupa_conductor
AFTER UPDATE OF repartidor_id ON pedidos
WHEN NEW.repartidor_id IS NOT NULL AND OLD.repartidor_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion
                  WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1
   WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
END;

-- Libera al entregar o cancelar…
CREATE TRIGGER IF NOT EXISTS pedidos_libera_por_estado
AFTER UPDATE OF estado ON pedidos
WHEN NEW.repartidor_id IS NOT NULL
 AND OLD.estado IN ('aceptado', 'listo', 'en_camino') AND NEW.estado IN ('entregado', 'cancelado')
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
END;
-- …y al soltar el pedido (soltarPedido en rutas/operacion.ts pone repartidor_id = NULL).
CREATE TRIGGER IF NOT EXISTS pedidos_libera_al_soltar
AFTER UPDATE OF repartidor_id ON pedidos
WHEN OLD.repartidor_id IS NOT NULL AND NEW.repartidor_id IS NULL
 AND OLD.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida';
END;

-- Operaciones: asignar inserta la ocupación (si ya existe CUALQUIER fila, la base aborta).
CREATE TRIGGER IF NOT EXISTS operaciones_ocupa_conductor
AFTER UPDATE OF conductor_id ON operaciones
WHEN NEW.conductor_id IS NOT NULL AND OLD.conductor_id IS NULL
BEGIN
  INSERT INTO conductor_ocupacion (conductor_id, tipo, operacion_id) VALUES (NEW.conductor_id, 'operacion', NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS operaciones_libera_conductor
AFTER UPDATE OF conductor_id ON operaciones
WHEN OLD.conductor_id IS NOT NULL AND (NEW.conductor_id IS NULL OR NEW.conductor_id <> OLD.conductor_id)
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.conductor_id AND operacion_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS operaciones_libera_al_terminar
AFTER UPDATE OF estado_general ON operaciones
WHEN NEW.estado_general IN ('terminada', 'cancelada', 'sin_conductor')
BEGIN
  DELETE FROM conductor_ocupacion WHERE operacion_id = NEW.id;
END;
-- No se cambia el vehículo activo con una operación o un pedido en curso.
CREATE TRIGGER IF NOT EXISTS repartidores_vehiculo_fijo_en_operacion
BEFORE UPDATE OF vehiculo_activo_id ON repartidores
WHEN NEW.vehiculo_activo_id IS NOT OLD.vehiculo_activo_id
 AND EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.usuario_id)
BEGIN
  SELECT RAISE(ABORT, 'no_se_cambia_vehiculo_en_operacion');
END;
