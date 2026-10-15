-- Si la aceptación afectó 0 filas, el servidor decide la respuesta con UNA lectura:
--   ya_es_tuya (200, mismo cuerpo que el éxito) · otro_conductor (409) · no_disponible (409)
SELECT CASE
         WHEN o.conductor_id = ?2 AND o.estado_general IN ('asignada', 'en_curso') THEN 'ya_es_tuya'
         WHEN o.conductor_id IS NOT NULL THEN 'otro_conductor'
         ELSE 'no_disponible' END AS resultado,
       o.ultima_clave = ?4 AS misma_solicitud
  FROM operaciones o WHERE o.id = ?1;
