-- Divoox · Progreso: lo que Richard y su equipo marcan como «Ya lo hice».
CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  hecho INTEGER NOT NULL DEFAULT 0,
  nota TEXT NOT NULL DEFAULT '',
  quien TEXT NOT NULL DEFAULT '',
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Las cuentas demo del sitio de pruebas (14 nov 2026, pedido de Richard). Se guardan AQUÍ y no en
-- el repositorio, que es público; solo se entregan con la clave del equipo.
CREATE TABLE IF NOT EXISTS cuentas_demo (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  contenido TEXT NOT NULL,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS historial_marcas (
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  hecho INTEGER NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  quien TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
