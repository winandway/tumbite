-- Migración de la exclusividad con pedidos activos. TODO en una sola transacción y con el reparto
-- en pausa (bandera en config que lee repartirOfertas): primero la tabla, luego el llenado con los
-- pedidos activos de ese instante, luego los disparadores. Así no hay un hueco donde un pedido se
-- asigne sin quedar contado.
-- (1) la tabla — ver 11-exclusividad.sql, primera sentencia
-- (2) llenado:
INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
SELECT repartidor_id, 'comida', COUNT(*)
  FROM pedidos
 WHERE repartidor_id IS NOT NULL AND estado IN ('aceptado', 'listo', 'en_camino')
 GROUP BY repartidor_id;
-- (3) los disparadores — resto de 11-exclusividad.sql
-- (4) comprobación: debe devolver 0 filas
SELECT problema, referencia FROM inconsistencias_operaciones
 WHERE problema IN ('conteo_de_comida', 'repartidor_con_pedido_sin_ocupacion');
