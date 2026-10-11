-- Tumbite: tablas de la base. DDL idempotente: corre en cada publicación.
-- OJO: aquí solo CREATE ... IF NOT EXISTS. Las columnas nuevas de tablas que ya existen en
-- producción (y sus índices) las agrega apps/servidor/src/esquema.ts al arrancar.

-- Zonas («pueblo en pueblo»): cada ciudad donde opera Tumbite. Todo lo operativo lleva zona_id.
CREATE TABLE IF NOT EXISTS zonas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'USD',
  zona_horaria TEXT NOT NULL DEFAULT 'America/New_York',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radio_km REAL NOT NULL DEFAULT 40,
  activa INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
  VALUES ('US-FL-MIAMI', 'Miami', 'US', 'USD', 'America/New_York', 25.7617, -80.1918, 40, 1);

-- Las tablas de negocio se agregan en el paso 2 (cuentas) en adelante.
CREATE TABLE IF NOT EXISTS trabajos_en_proceso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajo TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('en_proceso', 'terminado', 'apagado')),
  activo INTEGER NOT NULL DEFAULT 1,
  correo_confirmado_en TEXT,
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
  zona_id TEXT,
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

-- Enlaces de un solo uso para confirmar el correo al registrarse (se guarda el hash).
CREATE TABLE IF NOT EXISTS confirmaciones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL,
  usada_en TEXT
);

-- Enlaces de un solo uso para recuperar la contraseña (se guarda el hash, nunca el token).
CREATE TABLE IF NOT EXISTS recuperaciones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL,
  usada_en TEXT
);
CREATE INDEX IF NOT EXISTS recuperaciones_usuario ON recuperaciones(usuario_id, creada_en);

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
  zona_id TEXT NOT NULL DEFAULT 'US-FL-MIAMI',
  geohash TEXT,
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

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  restaurante_id TEXT NOT NULL REFERENCES restaurantes(id),
  repartidor_id TEXT REFERENCES usuarios(id),
  estado TEXT NOT NULL CHECK (estado IN ('pago_pendiente', 'pagado', 'aceptado', 'listo', 'en_camino', 'entregado', 'cancelado')),
  lineas_json TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  envio INTEGER NOT NULL,
  servicio INTEGER NOT NULL,
  cargo_pequeno INTEGER NOT NULL,
  propina INTEGER NOT NULL,
  regalo INTEGER NOT NULL DEFAULT 0,
  regalo_tipo TEXT,
  zona_id TEXT NOT NULL DEFAULT 'US-FL-MIAMI',
  total INTEGER NOT NULL,
  comision INTEGER NOT NULL,
  pago_restaurante INTEGER NOT NULL,
  pago_repartidor INTEGER NOT NULL,
  complemento INTEGER NOT NULL,
  ganancia INTEGER NOT NULL,
  plan TEXT NOT NULL,
  direccion TEXT NOT NULL,
  notas TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  distancia_km REAL,
  tiempo_prep_min INTEGER,
  stripe_sesion TEXT,
  stripe_pago TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  pagado_en TEXT,
  aceptado_en TEXT,
  listo_en TEXT,
  recogido_en TEXT,
  entregado_en TEXT,
  cancelado_en TEXT
);
CREATE INDEX IF NOT EXISTS pedidos_cliente ON pedidos(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS pedidos_restaurante ON pedidos(restaurante_id, estado);
CREATE INDEX IF NOT EXISTS pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS pedidos_sesion ON pedidos(stripe_sesion);

-- Libro de la billetera: cada entrada es dinero que entra (+) o sale (-) de una cuenta.
CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  pedido_id TEXT REFERENCES pedidos(id),
  monto INTEGER NOT NULL,
  concepto TEXT NOT NULL CHECK (concepto IN ('venta', 'entrega', 'propina', 'retiro', 'ajuste', 'regalo')),
  referencia TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS movimientos_usuario ON movimientos(usuario_id, creado_en);
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_unico ON movimientos(usuario_id, pedido_id, concepto) WHERE pedido_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cuentas_stripe (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  stripe_cuenta TEXT NOT NULL,
  pagos_activos INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Avisos de Stripe ya procesados: el mismo aviso nunca se procesa dos veces.
CREATE TABLE IF NOT EXISTS avisos_stripe (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  recibido_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repartidores (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  tipo TEXT NOT NULL DEFAULT 'independiente' CHECK (tipo IN ('independiente', 'empleado')),
  conectado INTEGER NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  ubicacion_en TEXT,
  puntos INTEGER NOT NULL DEFAULT 0,
  zona_id TEXT NOT NULL DEFAULT 'US-FL-MIAMI',
  geohash TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cada oferta de un pedido a un repartidor. Rechazar NO castiga: solo pasa al siguiente.
CREATE TABLE IF NOT EXISTS ofertas (
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  repartidor_id TEXT NOT NULL REFERENCES usuarios(id),
  estado TEXT NOT NULL CHECK (estado IN ('ofrecida', 'aceptada', 'rechazada', 'vencida')),
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pedido_id, repartidor_id)
);
CREATE INDEX IF NOT EXISTS ofertas_repartidor ON ofertas(repartidor_id, estado);

-- Calificaciones: al restaurante y al repartidor por separado.
CREATE TABLE IF NOT EXISTS calificaciones (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  estrellas_restaurante INTEGER CHECK (estrellas_restaurante BETWEEN 1 AND 5),
  estrellas_repartidor INTEGER CHECK (estrellas_repartidor BETWEEN 1 AND 5),
  culpa_restaurante INTEGER NOT NULL DEFAULT 0,
  comentario TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS regalos_config (
  restaurante_id TEXT PRIMARY KEY REFERENCES restaurantes(id),
  cumpleanos INTEGER NOT NULL DEFAULT 1,
  cumple_plato_id TEXT,
  sellos INTEGER NOT NULL DEFAULT 1,
  sellos_meta INTEGER NOT NULL DEFAULT 10,
  sellos_plato_id TEXT,
  vuelve INTEGER NOT NULL DEFAULT 0,
  vuelve_dias INTEGER NOT NULL DEFAULT 30,
  vuelve_pb INTEGER NOT NULL DEFAULT 1000
);

-- Cada cambio de estado de un pedido queda anotado: quién, cuándo y a qué estado.
CREATE TABLE IF NOT EXISTS historial_estados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  estado TEXT NOT NULL,
  actor_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS historial_pedido ON historial_estados(pedido_id, creado_en);

-- Lista de espera de la landing: comensales, restaurantes y repartidores.
CREATE TABLE IF NOT EXISTS lista_espera (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('comensal', 'restaurante', 'repartidor')),
  zona_id TEXT REFERENCES zonas(id),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL COLLATE NOCASE,
  telefono TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  codigo_postal TEXT NOT NULL DEFAULT '',
  negocio TEXT NOT NULL DEFAULT '',
  vehiculo TEXT NOT NULL DEFAULT '',
  idioma TEXT NOT NULL DEFAULT 'es',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tipo, correo)
);
