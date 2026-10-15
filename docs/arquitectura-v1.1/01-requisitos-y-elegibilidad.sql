-- PUNTO 1: requisitos completos (no solo vencimientos)
CREATE TABLE IF NOT EXISTS requisitos_def (
  requisito TEXT PRIMARY KEY,
  nivel TEXT NOT NULL CHECK (nivel IN ('conductor', 'vehiculo')),
  verifica TEXT NOT NULL CHECK (verifica IN ('kyc', 'antecedentes', 'documento', 'edad', 'revision_manual')),
  doc_tipo TEXT,
  vigencia_max_dias INTEGER CHECK (vigencia_max_dias IS NULL OR vigencia_max_dias > 0),
  CHECK (verifica != 'documento' OR doc_tipo IS NOT NULL)
);
INSERT OR IGNORE INTO requisitos_def (requisito, nivel, verifica, doc_tipo, vigencia_max_dias) VALUES
  ('identidad',              'conductor', 'kyc',             NULL,               365),
  ('antecedentes',           'conductor', 'antecedentes',    NULL,               365),
  ('antecedentes_pasajeros', 'conductor', 'antecedentes',    NULL,               365),
  ('historial_manejo',       'conductor', 'antecedentes',    NULL,               365),
  ('licencia',               'conductor', 'documento',       'licencia',         NULL),
  ('licencia_moto',          'conductor', 'documento',       'licencia_moto',    NULL),
  ('edad_minima_21',         'conductor', 'edad',            NULL,               NULL),
  ('capacitacion',           'conductor', 'revision_manual', NULL,               NULL),
  ('seguro_vehiculo',        'vehiculo',  'documento',       'seguro',           NULL),
  ('seguro_pasajeros',       'vehiculo',  'documento',       'seguro_pasajeros', NULL),
  ('inspeccion_vehiculo',    'vehiculo',  'documento',       'inspeccion',       365),
  ('casco_pasajero',         'vehiculo',  'revision_manual', NULL,               NULL);

-- Cada requisito cumplido, con su origen y su vencimiento. Lo escribe el servidor cuando se
-- aprueba la fuente (KYC, Checkr, documento, revisión). vehiculo_id = '' en los de la persona.
CREATE TABLE IF NOT EXISTS cumplimientos (
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL DEFAULT '',
  requisito TEXT NOT NULL REFERENCES requisitos_def(requisito),
  estado TEXT NOT NULL CHECK (estado IN ('aprobado', 'rechazado', 'pendiente', 'vencido', 'revocado')),
  fuente TEXT NOT NULL CHECK (fuente IN ('kyc', 'checkr', 'documento_conductor', 'documento_vehiculo', 'sistema', 'revision_manual')),
  fuente_id TEXT NOT NULL DEFAULT '',
  vence_en TEXT,
  aprobado_por TEXT REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conductor_id, vehiculo_id, requisito),
  CHECK (estado != 'aprobado' OR fuente IN ('kyc', 'checkr', 'sistema') OR aprobado_por IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS cumplimientos_vence ON cumplimientos(vence_en) WHERE estado = 'aprobado';

-- Un servicio que lleva personas no puede encenderse sin su piso mínimo de requisitos.
CREATE TRIGGER IF NOT EXISTS servicios_zona_piso_pasajeros
BEFORE UPDATE OF estado ON servicios_zona
WHEN NEW.estado = 'disponible'
  AND (SELECT transporta_personas FROM servicios WHERE id = NEW.servicio_id) = 1
  AND (SELECT COUNT(*) FROM servicio_requisitos
        WHERE servicio_id = NEW.servicio_id AND obligatorio = 1
          AND requisito IN ('identidad', 'antecedentes_pasajeros', 'historial_manejo', 'seguro_pasajeros')) < 4
BEGIN
  SELECT RAISE(ABORT, 'servicio_pasajeros_sin_requisitos_minimos');
END;

-- Versión de la app del conductor (número comparable: mayor*1000000 + menor*1000 + parche).
CREATE TABLE IF NOT EXISTS conductor_app (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  version TEXT NOT NULL,
  version_num INTEGER NOT NULL,
  visto_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS servicios_version_num (
  servicio_id TEXT PRIMARY KEY REFERENCES servicios(id),
  min_cliente_num INTEGER NOT NULL DEFAULT 0,
  min_driver_num INTEGER NOT NULL DEFAULT 0
);

-- PUNTO 1 y 2: UNA definición de elegibilidad, usada al ofrecer Y al aceptar.
-- Es una vista (no se materializa): se evalúa dentro de la misma sentencia que la usa.
CREATE VIEW IF NOT EXISTS conductores_elegibles AS
SELECT d.usuario_id AS conductor_id, s.id AS servicio_id, v.id AS vehiculo_id, d.zona_id
  FROM repartidores d
  JOIN usuarios u              ON u.id = d.usuario_id AND u.activo = 1 AND u.rol = 'repartidor'
  JOIN vehiculos v             ON v.id = d.vehiculo_activo_id AND v.conductor_id = d.usuario_id
                              AND v.estado = 'aprobado'
  JOIN servicios_zona sz       ON sz.zona_id = d.zona_id AND sz.estado = 'disponible'
                              AND (sz.activo_desde IS NULL OR sz.activo_desde <= datetime('now'))
                              AND (sz.activo_hasta IS NULL OR sz.activo_hasta > datetime('now'))
  JOIN servicios s             ON s.id = sz.servicio_id AND s.estado = 'disponible'
  JOIN servicios_implementados si ON si.servicio_id = s.id
  JOIN servicio_vehiculos sv   ON sv.servicio_id = s.id AND sv.vehiculo_tipo = v.tipo
                              AND (sv.anio_minimo IS NULL OR v.anio >= sv.anio_minimo)
  JOIN habilitaciones h        ON h.conductor_id = d.usuario_id AND h.servicio_id = s.id
                              AND h.estado = 'aprobada'
                              AND (h.vence_en IS NULL OR h.vence_en > datetime('now'))
  JOIN preferencias_servicio p ON p.conductor_id = d.usuario_id AND p.servicio_id = s.id AND p.activa = 1
  LEFT JOIN servicios_version_num svn ON svn.servicio_id = s.id
  LEFT JOIN conductor_app ca   ON ca.conductor_id = d.usuario_id
 WHERE d.conectado = 1 AND d.lat IS NOT NULL
   AND d.ubicacion_en > datetime('now', '-2 minutes')
   AND COALESCE(ca.version_num, 0) >= COALESCE(svn.min_driver_num, 0)
   AND NOT EXISTS (
         SELECT 1 FROM conductor_bloqueos b
          WHERE b.conductor_id = d.usuario_id AND b.levantado_en IS NULL
            AND (b.servicio_id IS NULL OR b.servicio_id = s.id)
            AND (b.hasta IS NULL OR b.hasta > datetime('now')))
   -- TODOS los requisitos obligatorios del servicio, de la persona y del vehículo activo.
   AND NOT EXISTS (
         SELECT 1 FROM servicio_requisitos sr
           JOIN requisitos_def rd ON rd.requisito = sr.requisito
          WHERE sr.servicio_id = s.id AND sr.obligatorio = 1
            AND NOT EXISTS (
                  SELECT 1 FROM cumplimientos c
                   WHERE c.conductor_id = d.usuario_id
                     AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN v.id ELSE '' END
                     AND c.requisito = sr.requisito
                     AND c.estado = 'aprobado'
                     AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))));

-- Qué le falta a una persona para un servicio (para mostrarlo en Preferencias y en el panel).
-- Se usa con: SELECT requisito FROM requisitos_faltantes WHERE conductor_id = ? AND servicio_id = ?
CREATE VIEW IF NOT EXISTS requisitos_faltantes AS
SELECT d.usuario_id AS conductor_id, sr.servicio_id, sr.requisito, rd.nivel
  FROM repartidores d
  JOIN servicio_requisitos sr ON sr.obligatorio = 1
  JOIN requisitos_def rd ON rd.requisito = sr.requisito
 WHERE NOT EXISTS (
         SELECT 1 FROM cumplimientos c
          WHERE c.conductor_id = d.usuario_id
            AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN COALESCE(d.vehiculo_activo_id, '-') ELSE '' END
            AND c.requisito = sr.requisito AND c.estado = 'aprobado'
            AND (c.vence_en IS NULL OR c.vence_en > datetime('now')));

-- Nadie aprueba una habilitación si a la persona le falta un requisito de nivel «conductor».
-- (Los del vehículo se comprueban en cada oferta y en cada aceptación, con el vehículo activo.)
CREATE TRIGGER IF NOT EXISTS habilitaciones_exigen_requisitos
BEFORE UPDATE OF estado ON habilitaciones
WHEN NEW.estado = 'aprobada' AND EXISTS (
  SELECT 1 FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
   WHERE sr.servicio_id = NEW.servicio_id AND sr.obligatorio = 1 AND rd.nivel = 'conductor'
     AND NOT EXISTS (SELECT 1 FROM cumplimientos c
                      WHERE c.conductor_id = NEW.conductor_id AND c.vehiculo_id = ''
                        AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                        AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))
BEGIN
  SELECT RAISE(ABORT, 'habilitacion_con_requisitos_faltantes');
END;
CREATE TRIGGER IF NOT EXISTS habilitaciones_exigen_requisitos_alta
BEFORE INSERT ON habilitaciones
WHEN NEW.estado = 'aprobada' AND EXISTS (
  SELECT 1 FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
   WHERE sr.servicio_id = NEW.servicio_id AND sr.obligatorio = 1 AND rd.nivel = 'conductor'
     AND NOT EXISTS (SELECT 1 FROM cumplimientos c
                      WHERE c.conductor_id = NEW.conductor_id AND c.vehiculo_id = ''
                        AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                        AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))
BEGIN
  SELECT RAISE(ABORT, 'habilitacion_con_requisitos_faltantes');
END;
