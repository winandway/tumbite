-- Aceptación atómica de un viaje (un solo db.batch = una transacción).
-- ?1 operación · ?2 conductor · ?3 vehículo · ?4 clave de idempotencia
-- 1) Toma la operación SOLO si sigue buscando, la oferta es suya y vigente, y el conductor es
--    elegible AHORA MISMO (misma vista que al ofrecer: requisitos, vehículo activo, habilitación,
--    preferencia, bloqueos, zona, versión, conexión). El disparador de ocupación hace el resto.
UPDATE operaciones
   SET conductor_id = ?2, vehiculo_id = ?3, actualizado_en = datetime('now')
 WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
   AND EXISTS (SELECT 1 FROM ofertas_operacion o
                WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                  AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
   AND EXISTS (SELECT 1 FROM conductores_elegibles e
                WHERE e.conductor_id = ?2 AND e.vehiculo_id = ?3
                  AND e.servicio_id = (SELECT servicio_id FROM operaciones WHERE id = ?1)
                  AND e.zona_id = (SELECT zona_id FROM operaciones WHERE id = ?1));
-- 2) Lo demás solo actúa si (1) la tomó.
INSERT INTO contexto_transicion (operacion_id, actor, actor_id, idempotencia)
SELECT ?1, 'conductor', ?2, ?4 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE viajes SET estado = 'asignado', asignado_en = datetime('now')
 WHERE operacion_id = ?1 AND estado = 'buscando'
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
INSERT INTO asignaciones_operacion (operacion_id, conductor_id, vehiculo_id)
SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE ofertas_operacion SET estado = 'aceptada', respondida_en = datetime('now')
 WHERE operacion_id = ?1 AND conductor_id = ?2
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
 WHERE operacion_id = ?1 AND conductor_id <> ?2 AND estado = 'ofrecida'
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
