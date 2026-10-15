-- El tiempo real manda cada 15 s, por zona, UN lote con la última posición de cada conductor.
-- Dos sentencias en un batch (atómico, confirmado por YaDominios): registrar el lote (auditoría)
-- y actualizar todas las fichas en UNA sentencia. Nunca retrocede en el tiempo.
-- ?1 lote_id · ?2 zona · ?3 JSON [{"c":"<conductor>","lat":..,"lng":..,"t":"<ISO>"}, …]
INSERT INTO lotes_ubicacion (lote_id, zona_id, muestras)
SELECT ?1, ?2, json_array_length(?3)
 WHERE NOT EXISTS (SELECT 1 FROM lotes_ubicacion WHERE lote_id = ?1);
UPDATE repartidores
   SET lat = m.lat, lng = m.lng, ubicacion_en = m.t
  FROM (SELECT json_extract(value, '$.c') AS c, json_extract(value, '$.lat') AS lat,
               json_extract(value, '$.lng') AS lng, json_extract(value, '$.t') AS t
          FROM json_each(?3)) AS m
 WHERE repartidores.usuario_id = m.c AND repartidores.zona_id = ?2
   AND (repartidores.ubicacion_en IS NULL OR m.t > repartidores.ubicacion_en)
   AND m.lat BETWEEN -90 AND 90 AND m.lng BETWEEN -180 AND 180;
-- Repetir un lote no cambia nada: cada muestra trae su hora y nunca se aplica una más vieja.
