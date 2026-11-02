-- Divoox · Progreso: lo que Richard y su equipo marcan como «Ya lo hice».
CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  hecho INTEGER NOT NULL DEFAULT 0,
  nota TEXT NOT NULL DEFAULT '',
  quien TEXT NOT NULL DEFAULT '',
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
