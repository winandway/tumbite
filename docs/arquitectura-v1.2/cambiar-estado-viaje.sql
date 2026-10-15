-- Cualquier otra transición (llegó, inició, terminó, canceló, no se presentó, sin conductor):
-- UNA sentencia. ?1 operación · ?2 estado nuevo · ?3 actor · ?4 actor_id · ?5 clave · ?6 motivo · ?7 estado esperado.
-- La base rechaza lo no permitido (transiciones_viaje) y lo hecho sin clave nueva.
UPDATE viajes
   SET estado = ?2, ultimo_actor = ?3, ultimo_actor_id = ?4, ultima_clave = ?5, motivo_transicion = ?6
 WHERE operacion_id = ?1 AND estado = ?7;
