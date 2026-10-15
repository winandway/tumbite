-- FASE 1 · M5: todos los repartidores actuales quedan habilitados para Comida, con Comida activa
-- en sus preferencias, su vehículo copiado como vehículo activo y su identidad aprobada (KYC) como
-- requisito cumplido. PREPARADA, NO EJECUTADA sobre datos reales. Idempotente.
-- Comida NO lee estas tablas todavía (eso es M6, en código y con bandera): correr M5 no cambia
-- quién recibe pedidos.
INSERT OR IGNORE INTO habilitaciones (conductor_id, servicio_id, estado, motivo, aprobado_en, origen)
SELECT u.id, 'comida', 'aprobada', 'Repartidor existente (Fase 1)', datetime('now'), 'migracion'
  FROM usuarios u WHERE u.rol = 'repartidor';

INSERT OR IGNORE INTO preferencias_servicio (conductor_id, servicio_id, activa)
SELECT u.id, 'comida', 1 FROM usuarios u WHERE u.rol = 'repartidor';

INSERT OR IGNORE INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, fuente_id, vence_en)
SELECT k.usuario_id, '', 'identidad', 'aprobado', 'kyc', 'kyc:' || k.usuario_id, datetime('now', '+365 days')
  FROM kyc k JOIN usuarios u ON u.id = k.usuario_id AND u.rol = 'repartidor'
 WHERE k.estado = 'aprobado';

INSERT OR IGNORE INTO repartidores (usuario_id)
SELECT v.conductor_id FROM vehiculos v WHERE v.origen = 'migracion' AND v.estado = 'aprobado';

UPDATE repartidores SET vehiculo_activo_id = 'mig-' || usuario_id
 WHERE vehiculo_activo_id IS NULL
   AND EXISTS (SELECT 1 FROM vehiculos v WHERE v.id = 'mig-' || repartidores.usuario_id AND v.estado = 'aprobado');
