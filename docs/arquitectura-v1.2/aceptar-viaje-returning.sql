-- Aceptar con RETURNING (confirmado por YaDominios): UNA ida a la base. Si devuelve una fila,
-- esta solicitud tomó el viaje; si no devuelve nada, se decide con respuesta-aceptar.sql.
UPDATE operaciones
   SET conductor_id = ?2, vehiculo_id = ?3, ultima_clave = ?4, actualizado_en = datetime('now')
 WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
   AND EXISTS (SELECT 1 FROM ofertas_operacion o
                WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                  AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
   AND EXISTS (SELECT 1 FROM conductores_elegibles e
                WHERE e.conductor_id = ?2 AND e.vehiculo_id = ?3
                  AND e.servicio_id = operaciones.servicio_id AND e.zona_id = operaciones.zona_id)
RETURNING id, conductor_id, vehiculo_id, estado_general, version;
