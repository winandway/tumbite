-- Tumbite: tablas de la base. DDL idempotente: corre en cada publicación.
-- Las tablas de negocio se agregan en el paso 2 (cuentas) en adelante.
CREATE TABLE IF NOT EXISTS trabajos_en_proceso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajo TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('en_proceso', 'terminado', 'apagado')),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  fecha_nacimiento TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('cliente', 'repartidor', 'restaurante', 'admin')),
  idioma TEXT NOT NULL DEFAULT 'es',
  clave_hash TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(usuario_id);
