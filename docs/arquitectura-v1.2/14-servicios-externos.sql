-- V1.2 · Integración con el Worker externo de Cloudflare (reloj y tiempo real).
-- Todo vive en la base de YaDominios (D1): el Worker externo NO tiene acceso directo a ella.

-- Cada tarea programada se ejecuta UNA vez por ventana, aunque el reloj llame dos veces
-- (Cloudflare no documenta «exactamente una vez» para Cron Triggers: se diseña para repeticiones).
CREATE TABLE IF NOT EXISTS tareas_programadas (
  clave TEXT PRIMARY KEY,                     -- '<tarea>:<ventana>', p. ej. 'pagos:2026-10-15T14:07'
  tarea TEXT NOT NULL,
  empezada_en TEXT NOT NULL DEFAULT (datetime('now')),
  terminada_en TEXT,
  resultado TEXT NOT NULL DEFAULT '',
  CHECK (terminada_en IS NULL OR terminada_en >= empezada_en)
);
CREATE INDEX IF NOT EXISTS tareas_programadas_viejas ON tareas_programadas(empezada_en);

-- Cada llamada interna firmada se acepta una sola vez (protección contra repetición).
CREATE TABLE IF NOT EXISTS peticiones_internas (
  nonce TEXT PRIMARY KEY CHECK (length(nonce) BETWEEN 16 AND 64),
  llave_id TEXT NOT NULL,
  ruta TEXT NOT NULL,
  recibida_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS peticiones_internas_viejas ON peticiones_internas(recibida_en);

-- Lotes de ubicaciones que manda el tiempo real: un lote repetido no se aplica dos veces.
CREATE TABLE IF NOT EXISTS lotes_ubicacion (
  lote_id TEXT PRIMARY KEY,
  zona_id TEXT NOT NULL,
  muestras INTEGER NOT NULL CHECK (muestras >= 0),
  recibido_en TEXT NOT NULL DEFAULT (datetime('now'))
);
