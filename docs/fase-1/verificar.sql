-- FASE 1 · Verificación. SOLO LECTURA: se puede correr antes y después de M4/M5.
-- 1) Repartidores con vehículo declarado frente a vehículos copiados.
SELECT (SELECT COUNT(*) FROM repartidor_datos d JOIN usuarios u ON u.id = d.usuario_id AND u.rol = 'repartidor'
         WHERE d.vehiculo_tipo != '') AS declarados,
       (SELECT COUNT(*) FROM vehiculos WHERE origen = 'migracion') AS copiados,
       (SELECT COUNT(*) FROM vehiculos WHERE origen = 'migracion' AND estado = 'aprobado') AS aprobados;
-- 2) Placas repetidas entre cuentas (no se copian; se revisan a mano).
SELECT upper(trim(placa)) AS placa, COUNT(*) AS cuentas, group_concat(usuario_id) AS usuarios
  FROM repartidor_datos WHERE trim(placa) != '' GROUP BY upper(trim(placa)) HAVING COUNT(*) > 1;
-- 3) Ningún repartidor actual se queda sin Comida.
SELECT COUNT(*) AS sin_comida FROM usuarios u
 WHERE u.rol = 'repartidor'
   AND NOT EXISTS (SELECT 1 FROM habilitaciones h WHERE h.conductor_id = u.id AND h.servicio_id = 'comida' AND h.estado = 'aprobada');
-- 4) Moto y Carro siguen apagados.
SELECT id, estado FROM servicios WHERE transporta_personas = 1;
SELECT servicio_id FROM servicios_implementados;
