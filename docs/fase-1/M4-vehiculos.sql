-- FASE 1 · M4: copiar a «vehiculos» el vehículo que cada repartidor ya declaró en repartidor_datos.
-- PREPARADA, NO EJECUTADA sobre datos reales. Se corre solo con la aprobación de Richard, después
-- de un respaldo, primero en el sitio de pruebas. Idempotente: el id es fijo ('mig-' || usuario) y
-- se usa INSERT OR IGNORE; correrla dos veces no duplica nada.
-- Quedan «aprobado» los que ya podían repartir (bicicleta / a pie, o motorizado con placa); el resto
-- queda «registrado» para que la persona complete datos. Las placas repetidas NO se copian: salen
-- en verificar.sql para revisarlas a mano (el índice único no deja que una placa viva en dos cuentas).
INSERT OR IGNORE INTO vehiculos
  (id, conductor_id, tipo, marca, modelo, anio, color, placa, placa_estado, estado, motivo, aprobado_en, origen)
SELECT 'mig-' || d.usuario_id, d.usuario_id, d.vehiculo_tipo, d.marca, d.modelo,
       CASE WHEN d.anio BETWEEN 1980 AND 2100 THEN d.anio END, d.color, upper(trim(d.placa)), '',
       CASE WHEN d.vehiculo_tipo IN ('bicicleta', 'a_pie') OR trim(d.placa) != '' THEN 'aprobado' ELSE 'registrado' END,
       'Copiado de los datos del repartidor (Fase 1)',
       CASE WHEN d.vehiculo_tipo IN ('bicicleta', 'a_pie') OR trim(d.placa) != '' THEN datetime('now') END,
       'migracion'
  FROM repartidor_datos d
  JOIN usuarios u ON u.id = d.usuario_id AND u.rol = 'repartidor'
 WHERE d.vehiculo_tipo != ''
   AND (trim(d.placa) = '' OR (
         (SELECT COUNT(*) FROM repartidor_datos x WHERE upper(trim(x.placa)) = upper(trim(d.placa))) = 1
         AND NOT EXISTS (SELECT 1 FROM vehiculos v WHERE upper(v.placa) = upper(trim(d.placa))
                          AND v.placa_estado = '' AND v.estado NOT IN ('rechazado', 'retirado')
                          AND v.id != 'mig-' || d.usuario_id)));
