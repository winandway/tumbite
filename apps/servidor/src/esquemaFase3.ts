/**
 * Fase 3 · Exclusividad y asignación (docs/FASE-3-EXCLUSIVIDAD-ASIGNACION.md, candado
 * C-EXCLUSIVIDAD). Disparadores, vistas y el cuadre de la ocupación. Los crea esquema.ts al
 * arrancar, en este orden y una sentencia a la vez (todas idempotentes), DESPUÉS de las columnas
 * nuevas. No van en schema.sql: el divisor de sentencias de la plataforma corta mal los
 * disparadores con CASE y la publicación se detenía a mitad (sitio de pruebas, 16 oct 2026).
 *
 * Orden que importa: primero los disparadores, después el cuadre. Así un pedido que se tome justo
 * en medio ya queda contado y el cuadre fija el número real (idempotente en cada arranque).
 */
export const ESQUEMA_FASE3: readonly string[] = [
  // El vehículo activo no cambia con un pedido u operación en curso (aunque llegue a la vez).
  `CREATE TRIGGER IF NOT EXISTS repartidores_vehiculo_fijo_en_operacion
BEFORE UPDATE OF vehiculo_activo_id ON repartidores
WHEN NEW.vehiculo_activo_id IS NOT OLD.vehiculo_activo_id
 AND EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.usuario_id)
BEGIN
  SELECT RAISE(ABORT, 'no_se_cambia_vehiculo_en_operacion');
END`,
  // Quién puede recibir una operación de cada servicio (servicio, zona, vehículo aprobado con
  // documentos vigentes, habilitación, requisitos, preferencia, sin bloqueo y conectado).
  `CREATE VIEW IF NOT EXISTS conductores_elegibles AS
SELECT d.usuario_id AS conductor_id, s.id AS servicio_id, v.id AS vehiculo_id, d.zona_id,
       d.lat, d.lng, d.ubicacion_en, d.puntos
  FROM repartidores d
  JOIN usuarios u              ON u.id = d.usuario_id AND u.activo = 1 AND u.rol = 'repartidor'
  JOIN vehiculos v             ON v.id = d.vehiculo_activo_id AND v.conductor_id = d.usuario_id
                              AND v.estado = 'aprobado'
  JOIN servicios_zona sz       ON sz.zona_id = d.zona_id AND sz.estado = 'disponible'
                              AND (sz.activo_desde IS NULL OR sz.activo_desde <= datetime('now'))
                              AND (sz.activo_hasta IS NULL OR sz.activo_hasta > datetime('now'))
  JOIN servicios s             ON s.id = sz.servicio_id AND s.estado = 'disponible'
  JOIN servicios_implementados si ON si.servicio_id = s.id
  JOIN servicio_vehiculos sv   ON sv.servicio_id = s.id AND sv.vehiculo_tipo = v.tipo
                              AND (sv.anio_minimo IS NULL OR v.anio >= sv.anio_minimo)
  JOIN habilitaciones h        ON h.conductor_id = d.usuario_id AND h.servicio_id = s.id
                              AND h.estado = 'aprobada'
                              AND (h.vence_en IS NULL OR h.vence_en > datetime('now'))
  JOIN preferencias_servicio p ON p.conductor_id = d.usuario_id AND p.servicio_id = s.id AND p.activa = 1
 WHERE d.conectado = 1
   AND NOT EXISTS (
         SELECT 1 FROM conductor_bloqueos b
          WHERE b.conductor_id = d.usuario_id AND b.levantado_en IS NULL
            AND (b.servicio_id IS NULL OR b.servicio_id = s.id)
            AND (b.hasta IS NULL OR b.hasta > datetime('now')))
   AND (v.tipo NOT IN ('carro', 'moto', 'scooter') OR (
         SELECT COUNT(DISTINCT tipo) FROM vehiculo_documentos
          WHERE vehiculo_id = v.id AND estado = 'aprobado' AND tipo IN ('registro', 'seguro')
            AND (vence_en IS NULL OR vence_en > datetime('now'))) = 2)
   AND (s.transporta_personas = 0 OR EXISTS (
         SELECT 1 FROM vehiculo_documentos
          WHERE vehiculo_id = v.id AND estado = 'aprobado' AND tipo = 'seguro_pasajeros'
            AND (vence_en IS NULL OR vence_en > datetime('now'))))
   AND NOT EXISTS (
         SELECT 1 FROM servicio_requisitos sr
           JOIN requisitos_def rd ON rd.requisito = sr.requisito
          WHERE sr.servicio_id = s.id AND sr.obligatorio = 1
            AND NOT EXISTS (
                  SELECT 1 FROM cumplimientos c
                   WHERE c.conductor_id = d.usuario_id
                     AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN v.id ELSE '' END
                     AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                     AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))`,
  `CREATE TRIGGER IF NOT EXISTS viajes_transicion_valida
BEFORE UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_viaje_no_permitida')
   WHERE NOT EXISTS (SELECT 1 FROM transiciones_viaje
                      WHERE desde = OLD.estado AND hacia = NEW.estado AND actor = NEW.ultimo_actor);
  SELECT RAISE(ABORT, 'transicion_sin_clave_nueva')
   WHERE NEW.ultima_clave IS OLD.ultima_clave;
END`,
  `CREATE TRIGGER IF NOT EXISTS viajes_actor_solo_con_transicion
BEFORE UPDATE OF ultimo_actor, ultimo_actor_id, ultima_clave ON viajes
WHEN NEW.estado = OLD.estado
 AND (NEW.ultimo_actor IS NOT OLD.ultimo_actor OR NEW.ultimo_actor_id IS NOT OLD.ultimo_actor_id
      OR NEW.ultima_clave IS NOT OLD.ultima_clave)
BEGIN
  SELECT RAISE(ABORT, 'actor_sin_transicion');
END`,
  `CREATE TRIGGER IF NOT EXISTS operaciones_estado_coherente
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
END`,
  `CREATE TRIGGER IF NOT EXISTS operaciones_conductor_coherente
BEFORE UPDATE OF conductor_id ON operaciones
WHEN NEW.conductor_id IS NOT OLD.conductor_id
BEGIN
  SELECT RAISE(ABORT, 'cambio_de_conductor_no_permitido')
   WHERE NOT (
     (OLD.conductor_id IS NULL AND NEW.conductor_id IS NOT NULL AND OLD.estado_general = 'buscando')
     OR (OLD.conductor_id IS NOT NULL AND NEW.conductor_id IS NULL AND NEW.estado_general = 'buscando'));
  SELECT RAISE(ABORT, 'aceptacion_sin_clave_nueva')
   WHERE NEW.conductor_id IS NOT NULL AND (NEW.ultima_clave IS NULL OR NEW.ultima_clave IS OLD.ultima_clave);
END`,
  `CREATE TRIGGER IF NOT EXISTS operaciones_ocupa_conductor
AFTER UPDATE OF conductor_id ON operaciones
WHEN NEW.conductor_id IS NOT NULL AND OLD.conductor_id IS NULL
BEGIN
  INSERT INTO conductor_ocupacion (conductor_id, tipo, operacion_id) VALUES (NEW.conductor_id, 'operacion', NEW.id);
END`,
  `CREATE TRIGGER IF NOT EXISTS operaciones_al_asignar
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
  UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
   WHERE conductor_id = NEW.conductor_id AND operacion_id <> NEW.id AND estado = 'ofrecida';
  UPDATE ofertas SET estado = 'vencida' WHERE repartidor_id = NEW.conductor_id AND estado = 'ofrecida';
END`,
  `CREATE TRIGGER IF NOT EXISTS operaciones_libera_conductor
AFTER UPDATE OF conductor_id ON operaciones
WHEN OLD.conductor_id IS NOT NULL AND (NEW.conductor_id IS NULL OR NEW.conductor_id <> OLD.conductor_id)
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.conductor_id AND operacion_id = OLD.id;
END`,
  `CREATE TRIGGER IF NOT EXISTS operaciones_libera_al_terminar
AFTER UPDATE OF estado_general ON operaciones
WHEN NEW.estado_general IN ('terminada', 'cancelada', 'sin_conductor')
BEGIN
  DELETE FROM conductor_ocupacion WHERE operacion_id = NEW.id;
END`,
  `CREATE TRIGGER IF NOT EXISTS viajes_al_cambiar_estado
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
  UPDATE viajes SET llego_en = datetime('now') WHERE operacion_id = NEW.operacion_id AND NEW.estado = 'conductor_llego';
  UPDATE viajes SET iniciado_en = datetime('now') WHERE operacion_id = NEW.operacion_id AND NEW.estado = 'en_curso';
  UPDATE viajes SET terminado_en = datetime('now')
   WHERE operacion_id = NEW.operacion_id AND NEW.estado IN ('terminado', 'cancelado', 'no_show', 'sin_conductor');
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
  UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
   WHERE operacion_id = NEW.operacion_id AND estado = 'ofrecida'
     AND NEW.estado IN ('cancelado', 'sin_conductor');
  UPDATE operaciones SET conductor_id = NULL, vehiculo_id = NULL
   WHERE id = NEW.operacion_id
     AND NEW.estado = 'buscando' AND OLD.estado IN ('asignado', 'conductor_llego');
END`,
  `CREATE TRIGGER IF NOT EXISTS pedidos_ocupa_conductor
AFTER UPDATE OF repartidor_id ON pedidos
WHEN NEW.repartidor_id IS NOT NULL AND OLD.repartidor_id IS NULL
 AND NEW.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion
                  WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1
   WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
  UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
   WHERE conductor_id = NEW.repartidor_id AND estado = 'ofrecida';
END`,
  `CREATE TRIGGER IF NOT EXISTS pedidos_libera_por_estado
AFTER UPDATE OF estado ON pedidos
WHEN NEW.repartidor_id IS NOT NULL
 AND OLD.estado IN ('aceptado', 'listo', 'en_camino') AND NEW.estado NOT IN ('aceptado', 'listo', 'en_camino')
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
END`,
  `CREATE TRIGGER IF NOT EXISTS pedidos_libera_al_soltar
AFTER UPDATE OF repartidor_id ON pedidos
WHEN OLD.repartidor_id IS NOT NULL AND NEW.repartidor_id IS NULL
 AND OLD.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida';
END`,
  `CREATE TRIGGER IF NOT EXISTS pedidos_reactiva_ocupa
AFTER UPDATE OF estado ON pedidos
WHEN NEW.repartidor_id IS NOT NULL
 AND OLD.estado NOT IN ('aceptado', 'listo', 'en_camino') AND NEW.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
END`,
  `CREATE TRIGGER IF NOT EXISTS pedidos_reasigna_ocupa
AFTER UPDATE OF repartidor_id ON pedidos
WHEN OLD.repartidor_id IS NOT NULL AND NEW.repartidor_id IS NOT NULL
 AND OLD.repartidor_id <> NEW.repartidor_id AND NEW.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida';
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
END`,
  `INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
SELECT repartidor_id, 'comida', COUNT(*) FROM pedidos
 WHERE repartidor_id IS NOT NULL AND estado IN ('aceptado', 'listo', 'en_camino')
 GROUP BY repartidor_id
ON CONFLICT(conductor_id) DO UPDATE SET pedidos = excluded.pedidos
 WHERE conductor_ocupacion.tipo = 'comida' AND conductor_ocupacion.pedidos <> excluded.pedidos`,
  `DELETE FROM conductor_ocupacion
 WHERE tipo = 'comida' AND NOT EXISTS (
   SELECT 1 FROM pedidos p WHERE p.repartidor_id = conductor_ocupacion.conductor_id
     AND p.estado IN ('aceptado', 'listo', 'en_camino'))`,
  `CREATE VIEW IF NOT EXISTS inconsistencias_operaciones_viajes AS
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
SELECT 'buscando_con_conductor', o.id FROM operaciones o WHERE o.estado_general = 'buscando' AND o.conductor_id IS NOT NULL`,
  `CREATE VIEW IF NOT EXISTS inconsistencias_operaciones_ocupacion AS
SELECT 'operacion_activa_sin_ocupacion' AS problema, o.id AS referencia FROM operaciones o
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
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = p.repartidor_id AND c.tipo = 'comida')`,
  // D1 acepta como máximo 5 partes por consulta compuesta: la vista se arma con dos de 4.
  `CREATE VIEW IF NOT EXISTS inconsistencias_operaciones AS
SELECT problema, referencia FROM inconsistencias_operaciones_viajes
UNION ALL
SELECT problema, referencia FROM inconsistencias_operaciones_ocupacion`,
];
