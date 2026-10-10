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

CREATE TABLE IF NOT EXISTS restaurantes (
  id TEXT PRIMARY KEY,
  dueno_id TEXT NOT NULL UNIQUE REFERENCES usuarios(id),
  nombre TEXT NOT NULL,
  descripcion_es TEXT NOT NULL DEFAULT '',
  descripcion_en TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  imagen TEXT,
  plan TEXT NOT NULL DEFAULT 'inicial' CHECK (plan IN ('inicial', 'crece', 'elite')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'pausado', 'rechazado')),
  abierto INTEGER NOT NULL DEFAULT 0,
  tiempo_prep_min INTEGER NOT NULL DEFAULT 20,
  regalos_pb INTEGER NOT NULL DEFAULT 300,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS restaurantes_estado ON restaurantes(estado);

CREATE TABLE IF NOT EXISTS platos (
  id TEXT PRIMARY KEY,
  restaurante_id TEXT NOT NULL REFERENCES restaurantes(id),
  nombre_es TEXT NOT NULL,
  nombre_en TEXT NOT NULL DEFAULT '',
  descripcion_es TEXT NOT NULL DEFAULT '',
  descripcion_en TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  precio_centavos INTEGER NOT NULL CHECK (precio_centavos >= 0),
  imagen TEXT,
  disponible INTEGER NOT NULL DEFAULT 1,
  eliminado INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS platos_restaurante ON platos(restaurante_id);
