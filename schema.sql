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
  stripe_cliente TEXT,
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

-- Teléfonos con avisos encendidos (token de Expo). Un token por fila; se apaga si el teléfono ya no existe.
CREATE TABLE IF NOT EXISTS dispositivos (
  token TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  plataforma TEXT NOT NULL DEFAULT 'desconocida',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  visto_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS dispositivos_usuario ON dispositivos(usuario_id, activo);

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
  categoria_en TEXT NOT NULL DEFAULT '',
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

-- Bitácora del Manager (reglas sin IA): recordatorios, cancelaciones automáticas y alertas.
-- Un evento por pedido y tipo: así un aviso no se repite aunque el reloj pase muchas veces.
CREATE TABLE IF NOT EXISTS bitacora_pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  evento TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (pedido_id, evento)
);

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

-- Tickets: cada formulario abre una conversación (como en YaDominios Cloud). La persona no necesita
-- cuenta: su llave es el código largo del enlace /t/<codigo> que recibe por correo (no se indexa).
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('espera_comensal', 'espera_restaurante', 'espera_repartidor', 'franquicia', 'queja', 'soporte')),
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'respondido', 'cerrado')),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL COLLATE NOCASE,
  telefono TEXT NOT NULL DEFAULT '',
  pais TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  idioma TEXT NOT NULL DEFAULT 'es',
  asunto TEXT NOT NULL,
  datos_json TEXT NOT NULL DEFAULT '{}',
  usuario_id TEXT REFERENCES usuarios(id),
  pedido_id TEXT REFERENCES pedidos(id),
  zona_id TEXT REFERENCES zonas(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS tickets_estado ON tickets(estado, actualizado_en);
CREATE INDEX IF NOT EXISTS tickets_zona ON tickets(zona_id, estado, actualizado_en);

CREATE TABLE IF NOT EXISTS ticket_mensajes (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  autor TEXT NOT NULL CHECK (autor IN ('persona', 'equipo')),
  texto TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ticket_mensajes_ticket ON ticket_mensajes(ticket_id, creado_en);

-- Franquicias: una por zona (ciudad). El franquiciado entra a su panel con su propia dirección
-- (/panel/franquicia-<ciudad>-<codigo>); el código es largo y no se adivina.
CREATE TABLE IF NOT EXISTS franquicias (
  id TEXT PRIMARY KEY,
  zona_id TEXT NOT NULL UNIQUE REFERENCES zonas(id),
  codigo TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'prospecto' CHECK (estado IN ('prospecto', 'vendida', 'activa', 'pausada')),
  dueno_id TEXT REFERENCES usuarios(id),
  dueno_correo TEXT NOT NULL DEFAULT '',
  motos INTEGER NOT NULL DEFAULT 0,
  notas TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  vendida_en TEXT
);

-- Datos del repartidor que pide cualquier plataforma seria (como DoorDash): vehículo, licencia,
-- seguro y verificación de antecedentes. El número de seguro social y el banco NO se guardan aquí:
-- los maneja Stripe Connect. Solo los ve el repartidor y el superadmin.
CREATE TABLE IF NOT EXISTS repartidor_datos (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  vehiculo_tipo TEXT NOT NULL DEFAULT '' CHECK (vehiculo_tipo IN ('', 'carro', 'moto', 'scooter', 'bicicleta', 'a_pie')),
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  anio INTEGER,
  color TEXT NOT NULL DEFAULT '',
  placa TEXT NOT NULL DEFAULT '',
  licencia_numero TEXT NOT NULL DEFAULT '',
  licencia_estado TEXT NOT NULL DEFAULT '',
  licencia_vence TEXT,
  seguro_aseguradora TEXT NOT NULL DEFAULT '',
  seguro_poliza TEXT NOT NULL DEFAULT '',
  seguro_vence TEXT,
  seguro_tumbite INTEGER NOT NULL DEFAULT 0,
  antecedentes TEXT NOT NULL DEFAULT 'pendiente' CHECK (antecedentes IN ('pendiente', 'aprobado', 'rechazado')),
  antecedentes_fecha TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Datos de la empresa del restaurante (como pide DoorDash al registrarse). El número fiscal y el
-- banco los pide Stripe Connect al conectar la billetera; aquí no se guardan.
CREATE TABLE IF NOT EXISTS restaurante_empresa (
  restaurante_id TEXT PRIMARY KEY REFERENCES restaurantes(id),
  nombre_legal TEXT NOT NULL DEFAULT '',
  tipo_empresa TEXT NOT NULL DEFAULT '',
  direccion_fiscal TEXT NOT NULL DEFAULT '',
  dueno_nombre TEXT NOT NULL DEFAULT '',
  dueno_telefono TEXT NOT NULL DEFAULT '',
  dueno_correo TEXT NOT NULL DEFAULT '',
  manager_nombre TEXT NOT NULL DEFAULT '',
  manager_telefono TEXT NOT NULL DEFAULT '',
  manager_correo TEXT NOT NULL DEFAULT '',
  horario TEXT NOT NULL DEFAULT '',
  sitio_web TEXT NOT NULL DEFAULT '',
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contadores por zona para los ID de repartidor (US-MIA-000123): suben de uno en uno, sin choques.
CREATE TABLE IF NOT EXISTS contadores (
  clave TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);

-- KYC (verificación de identidad): repartidores y dueños de restaurante. Las fotos van al almacén
-- en kyc/<usuario>/… y NUNCA se sirven al público: solo el superadmin las ve, por una ruta propia.
-- El restaurante además manda una foto del local con la ubicación del celular (para que no haya
-- restaurantes falsos ni mudados) y se vuelve a verificar cada año.
CREATE TABLE IF NOT EXISTS kyc (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  estado TEXT NOT NULL DEFAULT 'sin_enviar' CHECK (estado IN ('sin_enviar', 'pendiente', 'aprobado', 'rechazado')),
  motivo TEXT NOT NULL DEFAULT '',
  doc_tipo TEXT NOT NULL DEFAULT '' CHECK (doc_tipo IN ('', 'licencia', 'pasaporte', 'identificacion')),
  doc_frente TEXT,
  doc_reverso TEXT,
  selfie TEXT,
  local TEXT,
  local_lat REAL,
  local_lng REAL,
  local_distancia_m INTEGER,
  enviado_en TEXT,
  revisado_en TEXT,
  revisado_por TEXT,
  proxima_revision TEXT
);
CREATE INDEX IF NOT EXISTS kyc_estado ON kyc(estado, enviado_en);

-- Pruebas de recogida y de entrega. El repartidor toma la foto del pedido en el restaurante y el
-- restaurante la confirma en su pantalla: recién ahí el pedido sale «en camino». Al entregar, la
-- foto se toma en la puerta (a menos de 200 m de la dirección). Las fotos van al almacén en
-- evidencias/<pedido>/… y solo las ven el cliente, el restaurante, el repartidor y nuestro equipo.
CREATE TABLE IF NOT EXISTS evidencias (
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('recogida', 'entrega')),
  clave TEXT NOT NULL,
  lat REAL,
  lng REAL,
  distancia_m INTEGER,
  -- Cómo se entregó: en mano, en la puerta, o en lugar seguro (con la nota de dónde quedó).
  modo TEXT,
  nota TEXT NOT NULL DEFAULT '',
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  confirmada_en TEXT,
  PRIMARY KEY (pedido_id, tipo)
);

-- Hitos del repartidor en un pedido (los marca el servidor con la ubicación del celular, no el
-- repartidor): llegó al restaurante, llegó a la puerta del cliente, «casi llega» (aviso al cliente),
-- y la espera evitable en segundos (lo que esperó después de la hora de listo), como DoorDash.
CREATE TABLE IF NOT EXISTS hitos_pedido (
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  hito TEXT NOT NULL CHECK (hito IN ('llego_restaurante', 'casi_llega', 'llego_cliente', 'espera_evitable', 'verificado', 'no_aparece')),
  valor INTEGER,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pedido_id, hito)
);

-- Cómo quiere recibir el cliente: en la puerta (foto obligatoria) o en mano (foto opcional).
CREATE TABLE IF NOT EXISTS preferencias_entrega (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  modo TEXT NOT NULL CHECK (modo IN ('puerta', 'mano'))
);

-- Chat entre el cliente y el repartidor de un pedido, solo mientras el pedido está activo.
-- Sin números de teléfono: queda registrado y nuestro equipo puede leerlo si hay un reclamo.
CREATE TABLE IF NOT EXISTS mensajes_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  de_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS mensajes_pedido_idx ON mensajes_pedido(pedido_id, id);


-- Algo agotado: el restaurante marca el plato que no tiene; el cliente decide en su app si lo
-- quita (se le devuelve esa parte) o cancela todo. Si no responde en 5 minutos, se quita.
CREATE TABLE IF NOT EXISTS ajustes_pedido (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  plato_id TEXT NOT NULL,
  nombre_es TEXT NOT NULL DEFAULT '',
  nombre_en TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'quitado', 'cancelado')),
  devolucion INTEGER,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelto_en TEXT
);

-- El cobro de cada pedido: se AUTORIZA al pedir y se CAPTURA al entregar (por el total vigente).
-- Cancelar antes de capturar anula la autorización: sin reembolso y sin comisión de Stripe.
CREATE TABLE IF NOT EXISTS cobros (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  autorizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  capturado_en TEXT,
  capturado INTEGER,
  cancelado_en TEXT
);

-- PIN de 4 dígitos para la entrega en mano, si el cliente lo pidió (lo apaga si recibe otra persona).
CREATE TABLE IF NOT EXISTS pines_entrega (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  pin TEXT NOT NULL,
  usado_en TEXT
);

-- Horarios reales del restaurante: uno o más turnos por día (0 = domingo … 6 = sábado), en la
-- hora de su zona. Si cierra después de medianoche, «cierra» es menor que «abre». Sin turnos
-- cargados, manda solo el botón de abrir/pausar (hasta que la lista de activación los exija).
CREATE TABLE IF NOT EXISTS horarios_restaurante (
  restaurante_id TEXT NOT NULL REFERENCES restaurantes(id),
  dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
  abre TEXT NOT NULL,
  cierra TEXT NOT NULL,
  PRIMARY KEY (restaurante_id, dia, abre)
);

-- Modificadores de los platos: grupos (tamaño, extras, sin…) con mínimo y máximo de elección,
-- y opciones con su precio extra. Lo elegido se guarda dentro de cada línea del pedido.
CREATE TABLE IF NOT EXISTS grupos_opciones (
  id TEXT PRIMARY KEY,
  plato_id TEXT NOT NULL REFERENCES platos(id),
  nombre_es TEXT NOT NULL,
  nombre_en TEXT NOT NULL DEFAULT '',
  minimo INTEGER NOT NULL DEFAULT 0,
  maximo INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS grupos_opciones_plato ON grupos_opciones(plato_id, orden);
CREATE TABLE IF NOT EXISTS opciones (
  id TEXT PRIMARY KEY,
  grupo_id TEXT NOT NULL REFERENCES grupos_opciones(id),
  nombre_es TEXT NOT NULL,
  nombre_en TEXT NOT NULL DEFAULT '',
  precio_centavos INTEGER NOT NULL DEFAULT 0,
  disponible INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS opciones_grupo ON opciones(grupo_id, orden);

-- Últimas ubicaciones del repartidor (con la precisión que reporta el celular): para decir «llegó»
-- hacen falta dos lecturas coherentes y precisas, no una sola. Se limpian solas (2 minutos).
CREATE TABLE IF NOT EXISTS ubicaciones_recientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  precision_m REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ubicaciones_recientes_idx ON ubicaciones_recientes(usuario_id, id);

-- «No puedo confirmar mi ubicación»: el repartidor lo pide con motivo y soporte lo autoriza
-- (queda quién y cuándo). Solo entonces se puede entregar sin la comprobación del GPS.
CREATE TABLE IF NOT EXISTS excepciones_ubicacion (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  motivo TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  autorizado_en TEXT,
  autorizado_por TEXT
);
