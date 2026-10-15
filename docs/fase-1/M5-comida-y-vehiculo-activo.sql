-- FASE 1 · M5: todos los repartidores actuales quedan habilitados para Comida, con Comida activa
-- en sus preferencias, su vehículo copiado como vehículo activo y su identidad aprobada (KYC) como
-- requisito cumplido solo si hay evidencia de verificación real. PREPARADA, NO EJECUTADA sobre datos reales. Idempotente.
-- Comida NO lee estas tablas todavía (eso es M6, en código y con bandera): correr M5 no cambia
-- quién recibe pedidos.
INSERT OR IGNORE INTO habilitaciones (conductor_id, servicio_id, estado, motivo, aprobado_en, origen)
SELECT u.id, 'comida', 'aprobada', 'Repartidor existente (Fase 1)', datetime('now'), 'migracion'
  FROM usuarios u WHERE u.rol = 'repartidor';

INSERT OR IGNORE INTO preferencias_servicio (conductor_id, servicio_id, activa)
SELECT u.id, 'comida', 1 FROM usuarios u WHERE u.rol = 'repartidor';

-- Identidad: SOLO con evidencia de verificación real (corregido el 15 oct 2026 a pedido de Richard).
-- Aprobada por una persona admin, con foto del documento y selfie guardadas, y sin vencer. El
-- vencimiento sale de la propia revisión, nunca de «hoy». Sin evidencia, no se escribe nada: la
-- persona pasa por la verificación normal. El disparador cumplimientos_identidad_exige_kyc lo
-- vuelve a comprobar en la base.
INSERT OR IGNORE INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, fuente_id, vence_en, aprobado_por)
SELECT k.usuario_id, '', 'identidad', 'aprobado', 'kyc', 'kyc-mig:' || k.usuario_id || ':' || k.revisado_en,
       COALESCE(k.proxima_revision, date(k.revisado_en, '+365 days')), k.revisado_por
  FROM kyc k
  JOIN usuarios u ON u.id = k.usuario_id AND u.rol = 'repartidor'
  JOIN usuarios a ON a.id = k.revisado_por AND a.rol = 'admin'
 WHERE k.estado = 'aprobado'
   AND k.doc_frente IS NOT NULL AND k.selfie IS NOT NULL AND k.revisado_en IS NOT NULL
   AND (k.proxima_revision IS NULL OR k.proxima_revision >= date('now'));

INSERT OR IGNORE INTO repartidores (usuario_id)
SELECT v.conductor_id FROM vehiculos v WHERE v.origen = 'migracion' AND v.estado = 'aprobado';

UPDATE repartidores SET vehiculo_activo_id = 'mig-' || usuario_id
 WHERE vehiculo_activo_id IS NULL
   AND EXISTS (SELECT 1 FROM vehiculos v WHERE v.id = 'mig-' || repartidores.usuario_id AND v.estado = 'aprobado');
