-- FASE 1 · Vuelta atrás de M4 y M5. Solo toca lo que creó la migración (origen = 'migracion').
-- Se corre únicamente con la aprobación de Richard. Los historiales quedan como registro.
UPDATE repartidores SET vehiculo_activo_id = NULL WHERE vehiculo_activo_id LIKE 'mig-%';
DELETE FROM preferencias_servicio WHERE servicio_id = 'comida'
   AND conductor_id IN (SELECT conductor_id FROM habilitaciones WHERE servicio_id = 'comida' AND origen = 'migracion');
DELETE FROM habilitaciones WHERE servicio_id = 'comida' AND origen = 'migracion';
DELETE FROM cumplimientos WHERE fuente = 'kyc' AND requisito = 'identidad' AND fuente_id LIKE 'kyc:%';
UPDATE vehiculos SET estado = 'retirado', motivo = 'Migración revertida' WHERE origen = 'migracion' AND estado != 'retirado';
