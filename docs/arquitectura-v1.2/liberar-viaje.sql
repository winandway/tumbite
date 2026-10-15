-- El conductor se baja antes de iniciar: UNA sentencia. ?1 operación · ?2 conductor · ?3 motivo · ?4 clave.
UPDATE viajes
   SET estado = 'buscando', liberaciones = liberaciones + 1,
       ultimo_actor = 'conductor', ultimo_actor_id = ?2, ultima_clave = ?4, motivo_transicion = ?3
 WHERE operacion_id = ?1 AND estado IN ('asignado', 'conductor_llego')
   AND (SELECT conductor_id FROM operaciones WHERE id = ?1) = ?2;
