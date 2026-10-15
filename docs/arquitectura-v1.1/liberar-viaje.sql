-- El conductor se baja ANTES de iniciar: el viaje NO se cancela, vuelve a buscar.
-- ?1 operación · ?2 conductor · ?3 motivo · ?4 idempotencia
INSERT INTO contexto_transicion (operacion_id, actor, actor_id, idempotencia)
SELECT ?1, 'conductor', ?2, ?4 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE viajes SET estado = 'buscando', liberaciones = liberaciones + 1
 WHERE operacion_id = ?1 AND estado IN ('asignado', 'conductor_llego')
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE asignaciones_operacion SET fin = datetime('now'), resultado = 'liberada_conductor', motivo = ?3
 WHERE operacion_id = ?1 AND conductor_id = ?2 AND fin IS NULL
   AND EXISTS (SELECT 1 FROM viajes WHERE operacion_id = ?1 AND estado = 'buscando');
UPDATE operaciones SET conductor_id = NULL, vehiculo_id = NULL
 WHERE id = ?1 AND conductor_id = ?2 AND estado_general = 'buscando';
UPDATE ofertas_operacion SET estado = 'rechazada' WHERE operacion_id = ?1 AND conductor_id = ?2;
