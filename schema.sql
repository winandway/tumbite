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
  -- Orden de las categorías del menú (JSON de nombres), lo fija el restaurante.
  categorias_orden TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- C-TIENDAS-CATALOGO: restaurante, mercado, farmacia, licores, ferreteria… (cada uno en su servicio).
  tipo_comercio TEXT NOT NULL DEFAULT 'restaurante'
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
  -- Impuesto de ventas recaudado (dentro del total). 0 hasta que el contador fije la tasa.
  impuesto INTEGER NOT NULL DEFAULT 0,
  -- Cupón aplicado y su descuento (lo absorbe Tumbite: baja su ganancia).
  cupon TEXT,
  descuento INTEGER NOT NULL DEFAULT 0,
  -- Fase 2 · cobro directo: cómo paga el cliente y los TRES estados separados (entrega física =
  -- estado, cobro confirmado y conciliación). 'tarjeta' = Stripe como siempre.
  metodo_pago TEXT NOT NULL DEFAULT 'tarjeta' CHECK (metodo_pago IN ('tarjeta', 'efectivo', 'transferencia_repartidor')),
  cobro_estado TEXT NOT NULL DEFAULT 'no_aplica' CHECK (cobro_estado IN ('no_aplica', 'pendiente', 'confirmado', 'parcial', 'no_pagado')),
  monto_recibido INTEGER,
  cobro_confirmado_en TEXT,
  cobro_nota TEXT,
  -- Quién confirmó el cobro: 'repartidor' (confirmación manual, nunca «el banco»), 'admin' o 'api'.
  cobro_confirmado_por TEXT,
  conciliacion_estado TEXT NOT NULL DEFAULT 'no_aplica' CHECK (conciliacion_estado IN ('no_aplica', 'pendiente', 'conciliado', 'con_diferencia')),
  -- C-TARIFAS-PAIS: moneda del pedido (la de su país) y las tarifas que se le aplicaron.
  moneda TEXT NOT NULL DEFAULT 'USD',
  tarifas_json TEXT,
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
  recibido_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- 'procesando' mientras se aplica; 'hecho' al terminar (C-FALLOS-CRITICOS 1). Los avisos de
  -- antes de esta columna ya estaban aplicados: por eso el valor por defecto es 'hecho'.
  estado TEXT NOT NULL DEFAULT 'hecho' CHECK (estado IN ('procesando', 'hecho'))
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
  -- Pausa (18 oct 2026, C-REPARTIDOR-GRANDES): conectado pero sin recibir ofertas, como en Dasher.
  pausado INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pedidos que un repartidor aceptó y no entregó (soltó o se perdió), para su tasa de finalización
-- (C-REPARTIDOR-GRANDES). Se guarda aparte porque al soltar el pedido deja de llevar su id.
CREATE TABLE IF NOT EXISTS abandonos_repartidor (
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  repartidor_id TEXT NOT NULL REFERENCES usuarios(id),
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pedido_id, repartidor_id)
);
CREATE INDEX IF NOT EXISTS abandonos_repartidor_quien ON abandonos_repartidor(repartidor_id, creado_en);

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
  -- Respuesta pública del restaurante (como en DoorDash Merchant y Uber Eats Manager).
  respuesta TEXT,
  respondida_en TEXT,
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
  -- La ciudad (zona). Desde el 17 oct 2026 una ciudad puede tener VARIAS franquicias: cada una
  -- administra las áreas que se le asignan en franquicia_areas (C-TERRITORIO).
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  codigo TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'prospecto' CHECK (estado IN ('prospecto', 'vendida', 'activa', 'pausada', 'cerrada')),
  dueno_id TEXT REFERENCES usuarios(id),
  dueno_correo TEXT NOT NULL DEFAULT '',
  motos INTEGER NOT NULL DEFAULT 0,
  notas TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  vendida_en TEXT,
  nombre TEXT NOT NULL DEFAULT '',
  -- La solicitud del formulario «Quiero una franquicia» de la que salió (si salió de una).
  ticket_id TEXT REFERENCES tickets(id),
  -- Condiciones comerciales (cuota, porcentajes, derechos): JSON con valores null hasta que el
  -- negocio las defina. Ningún cálculo de dinero las lee todavía.
  condiciones_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS franquicias_zona ON franquicias(zona_id, estado);
-- Áreas de cobertura dentro de una ciudad, dibujadas como polígonos [[lng, lat], …] (C-TERRITORIO).
-- Una ciudad SIN áreas publicadas sigue con su círculo (radio_km), como Miami hasta hoy.
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'proximamente', 'activa', 'pausada', 'cerrada')),
  poligono TEXT NOT NULL,
  min_lat REAL NOT NULL,
  max_lat REAL NOT NULL,
  min_lng REAL NOT NULL,
  max_lng REAL NOT NULL,
  -- Conflicto en el borde compartido: gana la mayor prioridad, luego la más antigua.
  prioridad INTEGER NOT NULL DEFAULT 0,
  apertura_prevista TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_por TEXT REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS areas_zona_estado ON areas(zona_id, estado);
CREATE INDEX IF NOT EXISTS areas_caja ON areas(min_lat, max_lat, min_lng, max_lng);
-- Cada área la administra UNA sola franquicia (clave primaria = área).
CREATE TABLE IF NOT EXISTS franquicia_areas (
  area_id TEXT PRIMARY KEY REFERENCES areas(id),
  franquicia_id TEXT NOT NULL REFERENCES franquicias(id),
  asignada_en TEXT NOT NULL DEFAULT (datetime('now')),
  asignada_por TEXT REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS franquicia_areas_franquicia ON franquicia_areas(franquicia_id);
-- Quién entra al panel de una franquicia: su dueño y sus managers. Se asigna por correo; si la
-- cuenta todavía no existe, queda esperando y vale apenas la persona se registre con ese correo.
CREATE TABLE IF NOT EXISTS franquicia_miembros (
  franquicia_id TEXT NOT NULL REFERENCES franquicias(id),
  correo TEXT NOT NULL COLLATE NOCASE,
  rol TEXT NOT NULL CHECK (rol IN ('dueno', 'manager')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  creado_por TEXT REFERENCES usuarios(id),
  PRIMARY KEY (franquicia_id, correo)
);
CREATE INDEX IF NOT EXISTS franquicia_miembros_correo ON franquicia_miembros(correo);

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

-- C-COBRO-AL-ENTREGAR (16 oct 2026, Entrega 1b): la liquidación de cada entrega. Nace en el MISMO
-- lote que pasa el pedido a «entregado» y anota los abonos; su clave primaria impide entregar (y
-- abonar) dos veces. Guarda el estado de la captura en Stripe para reintentarla con seguridad.
CREATE TABLE IF NOT EXISTS liquidaciones (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'capturando', 'capturada', 'reintentar', 'revision', 'no_aplica')),
  pi TEXT,
  monto INTEGER NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  proximo_en TEXT,
  error TEXT,
  capturado_en TEXT,
  -- Cuándo se avisó al equipo de que quedó en revisión (una sola vez; la resuelve un administrador).
  alertado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS liquidaciones_por_cobrar ON liquidaciones(estado, proximo_en);

-- PIN de 4 dígitos para la entrega en mano, si el cliente lo pidió (lo apaga si recibe otra persona).
CREATE TABLE IF NOT EXISTS pines_entrega (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  pin TEXT NOT NULL,
  usado_en TEXT,
  -- Equivocaciones acumuladas: a la quinta el PIN se bloquea (F19, C-INTENTOS).
  intentos INTEGER NOT NULL DEFAULT 0
);

-- Devoluciones DESPUÉS de entregar (queja atendida por soporte): reembolso parcial o total en
-- Stripe con quién la asume. Auditoría final, punto A.12. Nunca se borra: cuadra la conciliación.
CREATE TABLE IF NOT EXISTS devoluciones (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  monto INTEGER NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  cargar_a TEXT NOT NULL DEFAULT 'tumbite' CHECK (cargar_a IN ('tumbite', 'restaurante', 'repartidor')),
  actor_id TEXT REFERENCES usuarios(id),
  stripe_reembolso TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS devoluciones_pedido ON devoluciones(pedido_id);

-- Disputas (contracargos) que Stripe avisa por webhook. La evidencia se manda desde el panel de
-- Stripe; aquí se ve cuáles hay, cuánto y hasta cuándo responder.
CREATE TABLE IF NOT EXISTS disputas (
  id TEXT PRIMARY KEY,
  pedido_id TEXT REFERENCES pedidos(id),
  stripe_pago TEXT,
  monto INTEGER NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT '',
  vence_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Recarga del saldo prepago disputada (si la disputa no es de un pedido).
  recarga_id TEXT,
  -- Flex · Fase 4: recarga de la billetera de una empresa disputada.
  recarga_empresa_id TEXT
);

-- Estado anterior de cada pieza del canario, para avisar UNA vez al pasar a rojo (F11).
CREATE TABLE IF NOT EXISTS alertas_canario (
  pieza TEXT PRIMARY KEY,
  estado TEXT NOT NULL,
  cambiado_en TEXT NOT NULL DEFAULT (datetime('now')),
  avisado_en TEXT
);

-- Límite de intentos por IP y ruta que sobrevive al aislado (entrar, registro, recuperar).
CREATE TABLE IF NOT EXISTS intentos_limite (
  llave TEXT PRIMARY KEY,
  cuenta INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now'))
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

-- Oferta abierta con bono: cuando tres repartidores rechazaron (o dejaron vencer) un pedido, se
-- ofrece a todos a la vez con un bono que paga Tumbite. Se acredita al entregar.
CREATE TABLE IF NOT EXISTS bonos_pedido (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  centavos INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- «Cocina ocupada»: minutos extra que el restaurante suma al tiempo sugerido de los pedidos nuevos.
CREATE TABLE IF NOT EXISTS cocina_ocupada (
  restaurante_id TEXT PRIMARY KEY REFERENCES restaurantes(id),
  extra_min INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SMS de respaldo (Twilio): el push no garantiza sonido. Queda cada envío con su resultado.
CREATE TABLE IF NOT EXISTS sms_enviados (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  pedido_id TEXT REFERENCES pedidos(id),
  tipo TEXT NOT NULL,
  estado TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Llamadas con número oculto entre repartidor y cliente (Twilio puentea con el número de Tumbite).
CREATE TABLE IF NOT EXISTS llamadas (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  de_usuario TEXT NOT NULL REFERENCES usuarios(id),
  estado TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Avisos por tiempo al cliente (llega en 5, sal a recibir): uno por pedido y tipo. Tabla aparte de
-- hitos_pedido porque esa tiene lista cerrada de valores y ya existe en producción.
CREATE TABLE IF NOT EXISTS avisos_pedido (
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  aviso TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pedido_id, aviso)
);

-- Conciliación diaria del dinero (como piden los estudios): por día, lo que se vendió, se cobró,
-- se devolvió y se abonó a restaurantes y repartidores; «cuadra» = 1 si todo coincide.
CREATE TABLE IF NOT EXISTS conciliaciones (
  dia TEXT PRIMARY KEY,
  pedidos INTEGER NOT NULL,
  vendido INTEGER NOT NULL,
  capturado INTEGER NOT NULL,
  devuelto INTEGER NOT NULL,
  abonado INTEGER NOT NULL,
  retirado INTEGER NOT NULL,
  cuadra INTEGER NOT NULL,
  detalle TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Abonos (payouts) de Stripe que fallaron: se avisa al dueño del dinero y al equipo.
CREATE TABLE IF NOT EXISTS abonos_fallidos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  stripe_cuenta TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Cuándo lo dio por resuelto un administrador desde el panel (superadmin → Dinero).
  resuelto_en TEXT
);

-- Antecedentes con proveedor (Checkr): el repartidor recibe una invitación de Checkr, llena sus
-- datos allá (nunca aquí) y el resultado llega por aviso firmado.
CREATE TABLE IF NOT EXISTS antecedentes_checkr (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  candidato_id TEXT NOT NULL,
  invitacion_id TEXT NOT NULL DEFAULT '',
  invitacion_url TEXT NOT NULL DEFAULT '',
  reporte_id TEXT NOT NULL DEFAULT '',
  resultado TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'invitado',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cuentas de los revisores de las tiendas (Apple y Google): las crea el superadmin con un botón
-- (27 oct 2026). Al repartidor revisor no se le exige la distancia al recoger ni al entregar.
CREATE TABLE IF NOT EXISTS revisores (
  correo TEXT PRIMARY KEY COLLATE NOCASE,
  rol TEXT NOT NULL CHECK (rol IN ('cliente', 'repartidor', 'restaurante')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Selfie de control (identidad continua): al conectarse, a algunos repartidores se les pide una
-- foto de la cara al azar y el equipo la compara con la del registro.
CREATE TABLE IF NOT EXISTS selfies_control (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  clave TEXT NOT NULL DEFAULT '',
  pedida_en TEXT NOT NULL DEFAULT (datetime('now')),
  tomada_en TEXT,
  revisada_en TEXT,
  resultado TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS selfies_control_usuario ON selfies_control(usuario_id, pedida_en);

-- Recogida en el local (pickup): sin repartidor; el cliente pasa a buscarlo y el restaurante marca
-- la entrega. La comisión es menor (5 %).
CREATE TABLE IF NOT EXISTS recogidas (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Propina agregada después de la entrega (cobro aparte con la tarjeta guardada).
CREATE TABLE IF NOT EXISTS propinas_extra (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  centavos INTEGER NOT NULL,
  stripe_pago TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pedidos agrupados: dos pedidos del mismo restaurante que lleva el mismo repartidor en un viaje.
CREATE TABLE IF NOT EXISTS grupos_pedido (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  grupo_id TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS grupos_pedido_grupo ON grupos_pedido(grupo_id);

-- ===================== Fase 0 · Retiros sin doble pago (15 oct 2026) =====================
-- Cada retiro es una fila con su estado. Pedir el retiro es UNA sentencia: crea la fila solo si
-- hay saldo y un disparador descuenta el saldo en ese mismo instante. Stripe se llama DESPUÉS,
-- siempre con la misma clave (retiro:<id>), que es también su transfer_group. Un resultado
-- incierto (red caída, 5xx, 429…) NUNCA devuelve el saldo: se verifica en Stripe y se reintenta.
-- Solo un rechazo comprobado de Stripe lo devuelve, una sola vez. Candado C-RETIROS-SEGUROS.
CREATE TABLE IF NOT EXISTS retiros (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  stripe_cuenta TEXT NOT NULL,
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 100),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN
    ('pendiente', 'enviando', 'confirmado', 'reintentar', 'fallido', 'revision')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  proximo_intento_en TEXT NOT NULL DEFAULT (datetime('now')),
  enviando_desde TEXT,
  stripe_transferencia TEXT,
  ultimo_error TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (estado != 'confirmado' OR stripe_transferencia IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS retiros_usuario ON retiros(usuario_id, creado_en);
CREATE INDEX IF NOT EXISTS retiros_por_procesar ON retiros(proximo_intento_en) WHERE estado IN ('pendiente', 'reintentar', 'enviando');
CREATE UNIQUE INDEX IF NOT EXISTS retiros_transferencia ON retiros(stripe_transferencia) WHERE stripe_transferencia IS NOT NULL;
-- La devolución de un retiro rechazado existe UNA sola vez en el libro.
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_retiro_revertido ON movimientos(referencia) WHERE referencia LIKE 'retiro-revertido:%';

-- Pedir el retiro descuenta el saldo en la misma sentencia (el libro de siempre: movimientos).
CREATE TRIGGER IF NOT EXISTS retiros_descuenta_saldo
AFTER INSERT ON retiros
BEGIN
  INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
  VALUES ('mov-retiro-' || NEW.id, NEW.usuario_id, -NEW.monto_centavos, 'retiro', 'retiro:' || NEW.id);
END;

-- Solo un rechazo comprobado devuelve el saldo, una vez (índice único de arriba).
CREATE TRIGGER IF NOT EXISTS retiros_fallido_devuelve
AFTER UPDATE OF estado ON retiros
WHEN NEW.estado = 'fallido' AND OLD.estado <> 'fallido'
BEGIN
  INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
  VALUES ('mov-revertido-' || NEW.id, NEW.usuario_id, NEW.monto_centavos, 'ajuste', 'retiro-revertido:' || NEW.id);
END;

-- Estados permitidos. Un retiro confirmado no vuelve atrás; uno fallido solo pasa a revisión
-- (si Stripe avisa que sí transfirió, el equipo lo revisa).
CREATE TRIGGER IF NOT EXISTS retiros_transicion_valida
BEFORE UPDATE OF estado ON retiros
WHEN NEW.estado <> OLD.estado AND NOT (
     (OLD.estado = 'pendiente'  AND NEW.estado IN ('enviando', 'revision'))
  OR (OLD.estado = 'enviando'   AND NEW.estado IN ('confirmado', 'reintentar', 'fallido', 'revision'))
  OR (OLD.estado = 'reintentar' AND NEW.estado IN ('enviando', 'confirmado', 'revision'))
  OR (OLD.estado = 'revision'   AND NEW.estado IN ('confirmado', 'fallido'))
  OR (OLD.estado = 'fallido'    AND NEW.estado = 'revision'))
BEGIN
  SELECT RAISE(ABORT, 'retiro_transicion_no_permitida');
END;

-- =====================================================================================
-- FASE 1 · MULTISERVICIO (15 oct 2026, rama multiservicio-fase-1). Diseño: docs/ARQUITECTURA-
-- MULTISERVICIO-V1.md §8 y V1.1 punto 1. Solo tablas NUEVAS: Comida no lee ninguna todavía.
-- Moto y Carro existen en el catálogo pero NO se pueden encender: el código solo declara Comida
-- como implementada (servicios_implementados) y los disparadores lo exigen.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS servicios (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 2 AND 32 AND id = lower(id)),
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN
    ('pedido_comercio', 'viaje_pasajero', 'envio_paquete', 'compra_encargo', 'enlace')),
  nombre_es TEXT NOT NULL,
  nombre_en TEXT NOT NULL,
  descripcion_es TEXT NOT NULL DEFAULT '',
  descripcion_en TEXT NOT NULL DEFAULT '',
  icono TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 100,
  estado TEXT NOT NULL DEFAULT 'proximamente'
    CHECK (estado IN ('disponible', 'proximamente', 'suspendido', 'oculto')),
  transporta_personas INTEGER NOT NULL DEFAULT 0 CHECK (transporta_personas IN (0, 1)),
  version_min_cliente TEXT NOT NULL DEFAULT '0.0.0',
  version_min_driver TEXT NOT NULL DEFAULT '0.0.0',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_por TEXT REFERENCES usuarios(id)
);

-- Lo que el CÓDIGO desplegado sabe atender. Lo escribe el servidor al arrancar (esquema.ts,
-- SERVICIOS_IMPLEMENTADOS); ninguna ruta del panel lo toca.
CREATE TABLE IF NOT EXISTS servicios_implementados (
  servicio_id TEXT PRIMARY KEY REFERENCES servicios(id),
  contrato INTEGER NOT NULL CHECK (contrato >= 1),
  desplegado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servicios_zona (
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  estado TEXT NOT NULL DEFAULT 'proximamente'
    CHECK (estado IN ('disponible', 'proximamente', 'suspendido', 'no_disponible')),
  activo_desde TEXT,
  activo_hasta TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_por TEXT REFERENCES usuarios(id),
  PRIMARY KEY (servicio_id, zona_id),
  CHECK (activo_hasta IS NULL OR activo_desde IS NULL OR activo_hasta > activo_desde)
);
CREATE INDEX IF NOT EXISTS servicios_zona_zona ON servicios_zona(zona_id, estado);

CREATE TABLE IF NOT EXISTS requisitos_def (
  requisito TEXT PRIMARY KEY,
  nivel TEXT NOT NULL CHECK (nivel IN ('conductor', 'vehiculo')),
  verifica TEXT NOT NULL CHECK (verifica IN ('kyc', 'antecedentes', 'documento', 'edad', 'revision_manual')),
  doc_tipo TEXT,
  vigencia_max_dias INTEGER CHECK (vigencia_max_dias IS NULL OR vigencia_max_dias > 0),
  CHECK (verifica != 'documento' OR doc_tipo IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS servicio_requisitos (
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  requisito TEXT NOT NULL REFERENCES requisitos_def(requisito),
  obligatorio INTEGER NOT NULL DEFAULT 1 CHECK (obligatorio IN (0, 1)),
  PRIMARY KEY (servicio_id, requisito)
);

CREATE TABLE IF NOT EXISTS servicio_vehiculos (
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  vehiculo_tipo TEXT NOT NULL CHECK (vehiculo_tipo IN ('carro', 'moto', 'scooter', 'bicicleta', 'a_pie')),
  anio_minimo INTEGER,
  PRIMARY KEY (servicio_id, vehiculo_tipo)
);

-- Un servicio (o su zona) solo pasa a «disponible» si el código lo declara implementado.
CREATE TRIGGER IF NOT EXISTS servicios_exige_implementado
BEFORE UPDATE OF estado ON servicios
WHEN NEW.estado = 'disponible'
  AND NOT EXISTS (SELECT 1 FROM servicios_implementados WHERE servicio_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'servicio_no_implementado');
END;
CREATE TRIGGER IF NOT EXISTS servicios_exige_implementado_alta
BEFORE INSERT ON servicios
WHEN NEW.estado = 'disponible'
  AND NOT EXISTS (SELECT 1 FROM servicios_implementados WHERE servicio_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'servicio_no_implementado');
END;
CREATE TRIGGER IF NOT EXISTS servicios_zona_exige_implementado
BEFORE UPDATE OF estado ON servicios_zona
WHEN NEW.estado = 'disponible'
  AND NOT EXISTS (SELECT 1 FROM servicios_implementados WHERE servicio_id = NEW.servicio_id)
BEGIN
  SELECT RAISE(ABORT, 'servicio_no_implementado');
END;
CREATE TRIGGER IF NOT EXISTS servicios_zona_exige_implementado_alta
BEFORE INSERT ON servicios_zona
WHEN NEW.estado = 'disponible'
  AND NOT EXISTS (SELECT 1 FROM servicios_implementados WHERE servicio_id = NEW.servicio_id)
BEGIN
  SELECT RAISE(ABORT, 'servicio_no_implementado');
END;
-- Un servicio que lleva personas no se enciende sin su piso mínimo de requisitos (V1.1).
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

-- ----- Catálogo inicial (INSERT OR IGNORE: lo que el admin cambie después no se pisa) -----
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

-- Comida nace «próximamente» en la tabla y el servidor la pasa a «disponible» al arrancar, después
-- de declararla implementada (los disparadores de arriba no dejan hacerlo al revés).
INSERT OR IGNORE INTO servicios (id, tipo_operacion, nombre_es, nombre_en, descripcion_es, descripcion_en, icono, orden, estado, transporta_personas) VALUES
  ('comida',   'pedido_comercio', 'Comida',   'Food',     'Pide a tus restaurantes favoritos.',           'Order from your favorite restaurants.',     'servicio-comida',   10, 'proximamente', 0),
  ('moto',     'viaje_pasajero',  'Moto',     'Moto',     'Viajes rápidos en moto.',                       'Quick rides by motorcycle.',                'servicio-moto',     20, 'proximamente', 1),
  ('carro',    'viaje_pasajero',  'Carro',    'Car',      'Viajes en carro a donde necesites.',           'Car rides wherever you need to go.',        'servicio-carro',    30, 'proximamente', 1),
  ('mercado',  'compra_encargo',  'Mercado',  'Grocery',  'El mercado de la semana, sin salir de casa.',  'Your weekly groceries, without leaving home.', 'servicio-mercado', 40, 'proximamente', 0),
  ('envios',   'envio_paquete',   'Envíos',   'Delivery', 'Envía paquetes por la ciudad.',                'Send packages across town.',                'servicio-envios',   50, 'proximamente', 0),
  ('farmacia', 'compra_encargo',  'Farmacia', 'Pharmacy', 'Productos de farmacia de venta libre.',        'Over-the-counter pharmacy products.',       'servicio-farmacia', 60, 'proximamente', 0),
  ('licores',  'compra_encargo',  'Licores',  'Liquor',   'Bebidas para mayores de 21 años, con verificación de edad.', 'Drinks for ages 21+, with age verification.', 'servicio-licores', 70, 'proximamente', 0),
  ('mas',      'enlace',          'Más',      'More',     'Todo lo que viene en Tumbite.',                'Everything coming to Tumbite.',             'servicio-mas',      80, 'proximamente', 0);

INSERT OR IGNORE INTO servicios_zona (servicio_id, zona_id, estado)
  SELECT s.id, z.id, 'proximamente' FROM servicios s CROSS JOIN zonas z;

INSERT OR IGNORE INTO servicio_vehiculos (servicio_id, vehiculo_tipo) VALUES
  ('comida', 'carro'), ('comida', 'moto'), ('comida', 'scooter'), ('comida', 'bicicleta'), ('comida', 'a_pie'),
  ('moto', 'moto'),
  ('carro', 'carro'),
  ('mercado', 'carro'), ('mercado', 'moto'), ('mercado', 'scooter'), ('mercado', 'bicicleta'),
  ('envios', 'carro'), ('envios', 'moto'), ('envios', 'scooter'), ('envios', 'bicicleta'),
  ('farmacia', 'carro'), ('farmacia', 'moto'), ('farmacia', 'scooter'), ('farmacia', 'bicicleta'),
  ('licores', 'carro'), ('licores', 'moto'), ('licores', 'scooter'), ('licores', 'bicicleta');

-- Comida: la identidad es informativa (obligatoria = 0) para no cambiar quién reparte hoy.
INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES
  ('comida', 'identidad', 0),
  ('moto', 'identidad', 1), ('moto', 'antecedentes_pasajeros', 1), ('moto', 'historial_manejo', 1),
  ('moto', 'licencia_moto', 1), ('moto', 'edad_minima_21', 1), ('moto', 'seguro_pasajeros', 1),
  ('moto', 'casco_pasajero', 1),
  ('carro', 'identidad', 1), ('carro', 'antecedentes_pasajeros', 1), ('carro', 'historial_manejo', 1),
  ('carro', 'licencia', 1), ('carro', 'edad_minima_21', 1), ('carro', 'seguro_pasajeros', 1),
  ('carro', 'inspeccion_vehiculo', 1),
  ('mercado', 'identidad', 1), ('mercado', 'antecedentes', 1),
  ('envios', 'identidad', 1), ('envios', 'antecedentes', 1),
  ('farmacia', 'identidad', 1), ('farmacia', 'antecedentes', 1);

-- Una ciudad nueva nace con todo el catálogo «próximamente» y con Comida abierta si la ciudad
-- está activa (como funciona Comida hoy). Prender una ciudad abre Comida, salvo que una persona
-- del equipo ya haya decidido otra cosa para esa ciudad (actualizado_por con valor).
CREATE TRIGGER IF NOT EXISTS zonas_catalogo_alta
AFTER INSERT ON zonas
BEGIN
  INSERT OR IGNORE INTO servicios_zona (servicio_id, zona_id, estado)
  SELECT s.id, NEW.id,
         CASE WHEN s.id = 'comida' AND NEW.activa = 1
                   AND EXISTS (SELECT 1 FROM servicios_implementados i WHERE i.servicio_id = 'comida')
              THEN 'disponible' ELSE 'proximamente' END
    FROM servicios s;
END;
CREATE TRIGGER IF NOT EXISTS zonas_catalogo_activa
AFTER UPDATE OF activa ON zonas
WHEN NEW.activa = 1 AND OLD.activa != 1
BEGIN
  INSERT OR IGNORE INTO servicios_zona (servicio_id, zona_id, estado)
  SELECT s.id, NEW.id, 'proximamente' FROM servicios s;
  UPDATE servicios_zona SET estado = 'disponible', actualizado_en = datetime('now')
   WHERE servicio_id = 'comida' AND zona_id = NEW.id AND estado = 'proximamente' AND actualizado_por IS NULL
     AND EXISTS (SELECT 1 FROM servicios_implementados i WHERE i.servicio_id = 'comida');
END;

-- ----- Vehículos -----
CREATE TABLE IF NOT EXISTS vehiculos (
  id TEXT PRIMARY KEY,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('carro', 'moto', 'scooter', 'bicicleta', 'a_pie')),
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  anio INTEGER CHECK (anio IS NULL OR anio BETWEEN 1980 AND 2100),
  color TEXT NOT NULL DEFAULT '',
  placa TEXT NOT NULL DEFAULT '',
  placa_estado TEXT NOT NULL DEFAULT '',
  plazas INTEGER CHECK (plazas IS NULL OR plazas BETWEEN 1 AND 8),
  estado TEXT NOT NULL DEFAULT 'registrado' CHECK (estado IN
    ('registrado', 'en_revision', 'aprobado', 'rechazado', 'suspendido', 'vencido', 'retirado')),
  motivo TEXT NOT NULL DEFAULT '',
  aprobado_en TEXT,
  aprobado_por TEXT REFERENCES usuarios(id),
  origen TEXT NOT NULL DEFAULT 'app' CHECK (origen IN ('app', 'migracion')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (estado != 'aprobado' OR tipo IN ('bicicleta', 'a_pie') OR placa != '')
);
CREATE INDEX IF NOT EXISTS vehiculos_conductor ON vehiculos(conductor_id, estado);
CREATE INDEX IF NOT EXISTS vehiculos_revision ON vehiculos(estado, actualizado_en);
CREATE UNIQUE INDEX IF NOT EXISTS vehiculos_placa_unica
  ON vehiculos(placa_estado, upper(placa))
  WHERE placa != '' AND estado NOT IN ('rechazado', 'retirado');

CREATE TABLE IF NOT EXISTS vehiculo_documentos (
  id TEXT PRIMARY KEY,
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  tipo TEXT NOT NULL CHECK (tipo IN
    ('registro', 'seguro', 'seguro_pasajeros', 'inspeccion', 'foto_frente', 'foto_lado', 'foto_placa', 'foto_interior')),
  clave TEXT NOT NULL,
  vence_en TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'vencido', 'reemplazado')),
  motivo TEXT NOT NULL DEFAULT '',
  revisado_por TEXT REFERENCES usuarios(id),
  revisado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS vehiculo_documentos_vehiculo ON vehiculo_documentos(vehiculo_id, tipo, estado);
CREATE INDEX IF NOT EXISTS vehiculo_documentos_vence ON vehiculo_documentos(vence_en) WHERE estado = 'aprobado';
-- Un documento nuevo del mismo tipo reemplaza al anterior (queda el historial, no se borra).
CREATE TRIGGER IF NOT EXISTS vehiculo_documentos_reemplaza
AFTER INSERT ON vehiculo_documentos
BEGIN
  UPDATE vehiculo_documentos SET estado = 'reemplazado'
   WHERE vehiculo_id = NEW.vehiculo_id AND tipo = NEW.tipo AND id != NEW.id
     AND estado IN ('pendiente', 'aprobado', 'rechazado');
END;

CREATE TABLE IF NOT EXISTS vehiculo_revisiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  estado_anterior TEXT NOT NULL,
  estado_nuevo TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id),
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS vehiculo_revisiones_vehiculo ON vehiculo_revisiones(vehiculo_id, id);

-- Cada cambio de estado de un vehículo queda en su historial, en la misma sentencia.
CREATE TRIGGER IF NOT EXISTS vehiculos_historial
AFTER UPDATE OF estado ON vehiculos
WHEN NEW.estado != OLD.estado
BEGIN
  INSERT INTO vehiculo_revisiones (vehiculo_id, estado_anterior, estado_nuevo, actor_id, motivo)
  VALUES (NEW.id, OLD.estado, NEW.estado, NEW.aprobado_por, NEW.motivo);
END;
-- Transiciones permitidas de un vehículo.
CREATE TRIGGER IF NOT EXISTS vehiculos_transicion_valida
BEFORE UPDATE OF estado ON vehiculos
WHEN NEW.estado != OLD.estado AND NOT (
     (OLD.estado = 'registrado'  AND NEW.estado IN ('en_revision', 'retirado'))
  OR (OLD.estado = 'en_revision' AND NEW.estado IN ('aprobado', 'rechazado', 'retirado'))
  OR (OLD.estado = 'rechazado'   AND NEW.estado IN ('en_revision', 'retirado'))
  OR (OLD.estado = 'aprobado'    AND NEW.estado IN ('suspendido', 'vencido', 'retirado'))
  OR (OLD.estado = 'suspendido'  AND NEW.estado IN ('aprobado', 'retirado'))
  OR (OLD.estado = 'vencido'     AND NEW.estado IN ('en_revision', 'retirado')))
BEGIN
  SELECT RAISE(ABORT, 'vehiculo_transicion_invalida');
END;
-- Un vehículo motorizado no se aprueba sin su registro y su seguro aprobados.
CREATE TRIGGER IF NOT EXISTS vehiculos_aprobar_exige_documentos
BEFORE UPDATE OF estado ON vehiculos
WHEN NEW.estado = 'aprobado' AND OLD.estado = 'en_revision'
  AND NEW.tipo IN ('carro', 'moto', 'scooter')
  AND (SELECT COUNT(DISTINCT tipo) FROM vehiculo_documentos
        WHERE vehiculo_id = NEW.id AND estado = 'aprobado' AND tipo IN ('registro', 'seguro')
          AND (vence_en IS NULL OR vence_en > datetime('now'))) < 2
BEGIN
  SELECT RAISE(ABORT, 'vehiculo_sin_documentos_aprobados');
END;

-- ----- Requisitos cumplidos (V1.1 punto 1) -----
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
-- La identidad solo se aprueba con una verificación REAL (Fase 2, 15 oct 2026): fuente «kyc» y, en
-- la tabla kyc, aprobada por una persona admin, con foto del documento y selfie, y sin vencer.
-- Vale para la migración M5 y para cualquier otro camino: nadie la escribe a mano.
CREATE TRIGGER IF NOT EXISTS cumplimientos_identidad_exige_kyc
BEFORE INSERT ON cumplimientos
WHEN NEW.requisito = 'identidad' AND NEW.estado = 'aprobado' AND (NEW.fuente != 'kyc' OR NOT EXISTS (
  SELECT 1 FROM kyc k JOIN usuarios a ON a.id = k.revisado_por AND a.rol = 'admin'
   WHERE k.usuario_id = NEW.conductor_id AND k.estado = 'aprobado'
     AND k.doc_frente IS NOT NULL AND k.selfie IS NOT NULL AND k.revisado_en IS NOT NULL
     AND (k.proxima_revision IS NULL OR k.proxima_revision >= date('now'))))
BEGIN
  SELECT RAISE(ABORT, 'identidad_sin_verificacion');
END;
CREATE TRIGGER IF NOT EXISTS cumplimientos_identidad_exige_kyc_cambio
BEFORE UPDATE ON cumplimientos
WHEN NEW.requisito = 'identidad' AND NEW.estado = 'aprobado' AND (NEW.fuente != 'kyc' OR NOT EXISTS (
  SELECT 1 FROM kyc k JOIN usuarios a ON a.id = k.revisado_por AND a.rol = 'admin'
   WHERE k.usuario_id = NEW.conductor_id AND k.estado = 'aprobado'
     AND k.doc_frente IS NOT NULL AND k.selfie IS NOT NULL AND k.revisado_en IS NOT NULL
     AND (k.proxima_revision IS NULL OR k.proxima_revision >= date('now'))))
BEGIN
  SELECT RAISE(ABORT, 'identidad_sin_verificacion');
END;

-- ----- Habilitaciones, preferencias y bloqueos -----
CREATE TABLE IF NOT EXISTS habilitaciones (
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN
    ('pendiente', 'aprobada', 'rechazada', 'suspendida', 'vencida')),
  motivo TEXT NOT NULL DEFAULT '',
  aprobado_por TEXT REFERENCES usuarios(id),
  aprobado_en TEXT,
  vence_en TEXT,
  origen TEXT NOT NULL DEFAULT 'app' CHECK (origen IN ('app', 'migracion')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conductor_id, servicio_id),
  CHECK (estado != 'aprobada' OR aprobado_por IS NOT NULL OR servicio_id = 'comida')
);
CREATE INDEX IF NOT EXISTS habilitaciones_servicio ON habilitaciones(servicio_id, estado);

CREATE TABLE IF NOT EXISTS habilitaciones_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  estado_anterior TEXT NOT NULL,
  estado_nuevo TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id),
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS habilitaciones_historial_conductor ON habilitaciones_historial(conductor_id, id);

CREATE TRIGGER IF NOT EXISTS habilitaciones_historial_alta
AFTER INSERT ON habilitaciones
BEGIN
  INSERT INTO habilitaciones_historial (conductor_id, servicio_id, estado_anterior, estado_nuevo, actor_id, motivo)
  VALUES (NEW.conductor_id, NEW.servicio_id, '', NEW.estado, NEW.aprobado_por, NEW.motivo);
END;
CREATE TRIGGER IF NOT EXISTS habilitaciones_historial_cambio
AFTER UPDATE OF estado ON habilitaciones
WHEN NEW.estado != OLD.estado
BEGIN
  INSERT INTO habilitaciones_historial (conductor_id, servicio_id, estado_anterior, estado_nuevo, actor_id, motivo)
  VALUES (NEW.conductor_id, NEW.servicio_id, OLD.estado, NEW.estado, NEW.aprobado_por, NEW.motivo);
END;
-- Nadie aprueba una habilitación si a la persona le falta un requisito obligatorio de nivel
-- «conductor» (los del vehículo se comprueban con el vehículo activo al ofrecer y al aceptar).
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

CREATE TABLE IF NOT EXISTS preferencias_servicio (
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conductor_id, servicio_id)
);

CREATE TABLE IF NOT EXISTS conductor_bloqueos (
  id TEXT PRIMARY KEY,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT REFERENCES servicios(id),
  motivo TEXT NOT NULL,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  hasta TEXT,
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  levantado_en TEXT,
  levantado_por TEXT REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS conductor_bloqueos_vivos ON conductor_bloqueos(conductor_id) WHERE levantado_en IS NULL;

-- ----- Auditoría de los cambios del panel sobre el catálogo, vehículos y habilitaciones -----
-- C-ROLES-INTERNOS (29 oct 2026): perfil de cada cuenta del equipo (rol admin). Sin fila = total,
-- así ninguna cuenta existente pierde acceso. Solo una cuenta «total» cambia estos perfiles.
CREATE TABLE IF NOT EXISTS perfiles_internos (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  perfil TEXT NOT NULL CHECK (perfil IN ('total', 'soporte', 'finanzas', 'lectura')),
  actualizado_por TEXT REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Registro de toda acción del equipo que cambia algo (quién, qué, cuándo y cómo terminó).
CREATE TABLE IF NOT EXISTS acciones_equipo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id TEXT NOT NULL,
  perfil TEXT NOT NULL,
  metodo TEXT NOT NULL,
  ruta TEXT NOT NULL,
  estado INTEGER NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS acciones_equipo_usuario ON acciones_equipo(usuario_id, id);

CREATE TABLE IF NOT EXISTS auditoria_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  objeto TEXT NOT NULL,
  antes_json TEXT,
  despues_json TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS auditoria_admin_objeto ON auditoria_admin(objeto, id);

-- =====================================================================================
-- FASE 2 · TIEMPO REAL (15 oct 2026, rama multiservicio-fase-2). Diseño: ARQUITECTURA-
-- MULTISERVICIO-V1.2 §3.6 y §4. Los Workers externos NO tocan la base: todo pasa por las rutas
-- /datos/interno/* con firma. Estas tablas solo sirven para que nada se haga dos veces.
-- =====================================================================================

-- Cada tarea programada corre UNA vez por ventana, aunque el reloj llame dos veces.
CREATE TABLE IF NOT EXISTS tareas_programadas (
  clave TEXT PRIMARY KEY,
  tarea TEXT NOT NULL,
  empezada_en TEXT NOT NULL DEFAULT (datetime('now')),
  terminada_en TEXT,
  resultado TEXT NOT NULL DEFAULT '',
  CHECK (terminada_en IS NULL OR terminada_en >= empezada_en)
);
CREATE INDEX IF NOT EXISTS tareas_programadas_viejas ON tareas_programadas(empezada_en);

-- Reloj seguro (16 oct 2026, C-RELOJ-AISLADO): el resultado de CADA tarea de cada vuelta. Una tarea
-- que falla no frena a las demás y queda aquí; la pieza «reloj» de la salud lo lee.
CREATE TABLE IF NOT EXISTS reloj_tareas (
  clave TEXT NOT NULL,
  tarea TEXT NOT NULL,
  critica INTEGER NOT NULL DEFAULT 0 CHECK (critica IN (0, 1)),
  ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
  ms INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (clave, tarea)
);
CREATE INDEX IF NOT EXISTS reloj_tareas_fallidas ON reloj_tareas(creado_en) WHERE ok = 0;

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
CREATE INDEX IF NOT EXISTS lotes_ubicacion_viejos ON lotes_ubicacion(recibido_en);

-- =====================================================================================
-- DIVOOX FLEX · FASE 1 (27 oct 2026, rama fase-flex-1). Logística empresarial de paquetes.
-- Auditoría: docs/AUDITORIA-DIVOOX-FLEX-2026.md. Solo tablas NUEVAS: Comida, pedidos, dinero,
-- conductor_ocupacion y operaciones no se tocan. Sin cobros, sin despacho, sin rutas en vivo.
-- Las mismas entidades (envios, paquetes) servirán a Divoox Express (un paquete, una parada).
-- =====================================================================================

-- Empresa cliente de Flex: su dueño es una cuenta normal (usuarios). Una persona puede
-- pertenecer a varias empresas con roles distintos (empresa_miembros).
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  razon_social TEXT NOT NULL DEFAULT '',
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada', 'cerrada')),
  dueno_id TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fase 2: pruebas de entrega que exige la empresa ({foto, pin, firma, sinContacto, reintentoEnRuta}).
  config_entrega_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS empresas_dueno ON empresas(dueno_id);

-- Miembros con permisos comprobados en el servidor. Nunca se entra por correo: solo por fila aquí.
CREATE TABLE IF NOT EXISTS empresa_miembros (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  rol TEXT NOT NULL CHECK (rol IN ('dueno', 'operaciones', 'operador', 'finanzas', 'api')),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'retirado')),
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (empresa_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS empresa_miembros_usuario ON empresa_miembros(usuario_id, estado);

-- Invitación segura: token aleatorio del que solo se guarda el hash; vence; se usa una vez;
-- la acepta una cuenta con el MISMO correo, confirmado. Se puede revocar. Todo queda auditado.
CREATE TABLE IF NOT EXISTS empresa_invitaciones (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  correo TEXT NOT NULL COLLATE NOCASE,
  rol TEXT NOT NULL CHECK (rol IN ('operaciones', 'operador', 'finanzas', 'api')),
  token_hash TEXT NOT NULL UNIQUE,
  expira_en TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'revocada')),
  emisor_id TEXT NOT NULL REFERENCES usuarios(id),
  aceptada_por TEXT REFERENCES usuarios(id),
  aceptada_en TEXT,
  revocada_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS empresa_invitaciones_empresa ON empresa_invitaciones(empresa_id, estado);

-- Centros de distribución de la empresa (donde se reciben y cargan los paquetes).
CREATE TABLE IF NOT EXISTS empresa_centros (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  pais TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  lat REAL,
  lng REAL,
  zona_horaria TEXT NOT NULL DEFAULT 'America/New_York',
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS empresa_centros_empresa ON empresa_centros(empresa_id, estado);

-- Conductores vinculados a la empresa: propios, de la red Divoox o híbridos. Solo cuentas con
-- rol repartidor. La asignación de rutas y la ocupación quedan para la Fase 2.
CREATE TABLE IF NOT EXISTS empresa_conductores (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  vinculo TEXT NOT NULL CHECK (vinculo IN ('propio', 'red', 'hibrido')),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'retirado')),
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (empresa_id, usuario_id)
);

-- Claves de integración (API empresarial): se guarda SOLO el hash; el prefijo sirve para
-- reconocerla en pantalla. Permisos acotados (nunca miembros ni dinero). Revocables. Uso contado.
CREATE TABLE IF NOT EXISTS empresa_claves (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  prefijo TEXT NOT NULL,
  clave_hash TEXT NOT NULL UNIQUE,
  permisos TEXT NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'revocada')),
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  revocada_en TEXT,
  ultimo_uso_en TEXT,
  usos INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS empresa_claves_empresa ON empresa_claves(empresa_id, estado);

-- Auditoría de la empresa: quién hizo qué (miembros, invitaciones, claves, centros, importaciones).
-- Inmutable: ni UPDATE ni DELETE.
CREATE TABLE IF NOT EXISTS empresa_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  actor_id TEXT,
  actor_tipo TEXT NOT NULL DEFAULT 'usuario' CHECK (actor_tipo IN ('usuario', 'api', 'sistema')),
  accion TEXT NOT NULL,
  objeto TEXT NOT NULL DEFAULT '',
  detalle_json TEXT NOT NULL DEFAULT 'null',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS empresa_auditoria_empresa ON empresa_auditoria(empresa_id, creado_en);
CREATE TRIGGER IF NOT EXISTS empresa_auditoria_inmutable_update
BEFORE UPDATE ON empresa_auditoria
BEGIN
  SELECT RAISE(ABORT, 'auditoria_inmutable');
END;
CREATE TRIGGER IF NOT EXISTS empresa_auditoria_inmutable_delete
BEFORE DELETE ON empresa_auditoria
BEGIN
  SELECT RAISE(ABORT, 'auditoria_inmutable');
END;

-- Envío: un destino con uno o varios paquetes. Sirve a Flex (ruta con muchas paradas) y, más
-- adelante, a Express (un envío suelto). Datos personales mínimos: nombre y teléfono del que recibe.
CREATE TABLE IF NOT EXISTS envios (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  centro_id TEXT REFERENCES empresa_centros(id),
  referencia_externa TEXT,
  remitente_nombre TEXT NOT NULL DEFAULT '',
  destinatario_nombre TEXT NOT NULL,
  destinatario_telefono TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL,
  lat REAL,
  lng REAL,
  instrucciones TEXT NOT NULL DEFAULT '',
  ventana_desde TEXT,
  ventana_hasta TEXT,
  estado TEXT NOT NULL DEFAULT 'creado'
    CHECK (estado IN ('creado', 'en_proceso', 'entregado', 'parcial', 'fallido', 'devuelto', 'cancelado')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fase 2: pruebas exigidas para ESTE envío (manda sobre las de la empresa); null = las de la empresa.
  config_entrega_json TEXT,
  -- Fase 5 (28 oct 2026, C-FLEX-UBICACION): el destinatario y su ubicación EXACTA. En Venezuela
  -- un envío no entra a una ruta sin ubicación confirmada (por la app o por el enlace).
  destinatario_correo TEXT NOT NULL DEFAULT '',
  destinatario_documento TEXT NOT NULL DEFAULT '',
  referencias TEXT NOT NULL DEFAULT '',
  ubicacion_estado TEXT NOT NULL DEFAULT 'sin_coordenadas',
  ubicacion_fuente TEXT NOT NULL DEFAULT '',
  ubicacion_confirmada_en TEXT,
  destinatario_usuario_id TEXT,
  enlace_ubicacion_huella TEXT,
  enlace_ubicacion_vence TEXT,
  -- Fase 6 (28 oct 2026, C-FLEX-COBRO): cobro contra entrega (Venezuela). Divoox no mueve ese
  -- dinero: registra lo que el conductor cobró, lo que tiene en la mano y cuándo la empresa lo recibió.
  cobro_monto INTEGER,
  cobro_moneda TEXT,
  cobro_estado TEXT NOT NULL DEFAULT 'sin_cobro',
  cobro_metodo TEXT,
  cobro_monto_recibido INTEGER,
  cobro_moneda_recibida TEXT,
  cobro_referencia TEXT,
  cobro_conductor_id TEXT,
  cobro_ruta_id TEXT,
  cobrado_en TEXT,
  liquidado_en TEXT,
  liquidado_por TEXT,
  recibio_documento TEXT NOT NULL DEFAULT '',
  recibio_relacion TEXT NOT NULL DEFAULT '',
  -- C-FLEX-RETIRO: «domicilio» (la ruta lo lleva) o «punto» (se retira en un centro, con plazo).
  entrega_tipo TEXT NOT NULL DEFAULT 'domicilio',
  punto_centro_id TEXT,
  retiro_disponible_en TEXT,
  retiro_vence TEXT
);
CREATE INDEX IF NOT EXISTS envios_empresa ON envios(empresa_id, creado_en);
-- La referencia propia de la empresa (su número de orden) no se repite dentro de la misma empresa.
CREATE UNIQUE INDEX IF NOT EXISTS envios_referencia_unica
  ON envios(empresa_id, referencia_externa) WHERE referencia_externa IS NOT NULL;

-- Paquete: unidad física con su código de seguimiento (público, opaco) y su código de etiqueta
-- (el que va en el QR y el código de barras; opaco: el servidor lo resuelve tras validar permisos).
CREATE TABLE IF NOT EXISTS paquetes (
  id TEXT PRIMARY KEY,
  envio_id TEXT NOT NULL REFERENCES envios(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  codigo_seguimiento TEXT NOT NULL UNIQUE,
  codigo_etiqueta TEXT NOT NULL UNIQUE,
  peso_g INTEGER CHECK (peso_g IS NULL OR peso_g >= 0),
  largo_cm INTEGER CHECK (largo_cm IS NULL OR largo_cm >= 0),
  ancho_cm INTEGER CHECK (ancho_cm IS NULL OR ancho_cm >= 0),
  alto_cm INTEGER CHECK (alto_cm IS NULL OR alto_cm >= 0),
  descripcion TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'creado' CHECK (estado IN (
    'creado', 'registrado_centro', 'preparado', 'asignado', 'cargado', 'en_transito',
    'entregado', 'entrega_fallida', 'en_devolucion', 'devuelto', 'cancelado')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS paquetes_envio ON paquetes(envio_id);
CREATE INDEX IF NOT EXISTS paquetes_empresa_estado ON paquetes(empresa_id, estado, creado_en);

-- Máquina de estados del paquete: la base rechaza cualquier salto que no esté aquí.
CREATE TABLE IF NOT EXISTS transiciones_paquete (
  desde TEXT NOT NULL,
  hacia TEXT NOT NULL,
  PRIMARY KEY (desde, hacia)
);
INSERT OR IGNORE INTO transiciones_paquete (desde, hacia) VALUES
  ('creado', 'registrado_centro'), ('creado', 'preparado'), ('creado', 'cancelado'),
  ('registrado_centro', 'preparado'), ('registrado_centro', 'cancelado'),
  ('preparado', 'asignado'), ('preparado', 'cancelado'),
  ('asignado', 'cargado'), ('asignado', 'preparado'), ('asignado', 'cancelado'),
  ('cargado', 'en_transito'), ('cargado', 'preparado'),
  ('en_transito', 'entregado'), ('en_transito', 'entrega_fallida'),
  ('entrega_fallida', 'en_transito'), ('entrega_fallida', 'en_devolucion'),
  ('en_devolucion', 'devuelto'), ('en_devolucion', 'en_transito');
-- Fase 2: la ruta toma paquetes del centro; lo no entregado vuelve al centro (y puede salir otra vez).
INSERT OR IGNORE INTO transiciones_paquete (desde, hacia) VALUES
  ('creado', 'asignado'), ('registrado_centro', 'asignado'),
  ('en_transito', 'en_devolucion'), ('en_devolucion', 'registrado_centro');
-- C-FLEX-RETIRO (28 oct 2026): el centro como punto de retiro (la «agencia» de MRW o Zoom): el
-- destinatario lo retira en el mostrador, o vence el plazo y se devuelve al remitente.
INSERT OR IGNORE INTO transiciones_paquete (desde, hacia) VALUES
  ('registrado_centro', 'entregado'), ('registrado_centro', 'devuelto');
CREATE TRIGGER IF NOT EXISTS paquetes_transicion_valida
BEFORE UPDATE OF estado ON paquetes
WHEN NEW.estado <> OLD.estado
 AND NOT EXISTS (SELECT 1 FROM transiciones_paquete WHERE desde = OLD.estado AND hacia = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_paquete_no_permitida');
END;

-- Custodia: cada cambio queda como evento inmutable, con su clave de idempotencia única.
CREATE TABLE IF NOT EXISTS paquete_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paquete_id TEXT NOT NULL REFERENCES paquetes(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL,
  actor_id TEXT,
  actor_tipo TEXT NOT NULL DEFAULT 'usuario' CHECK (actor_tipo IN ('usuario', 'api', 'sistema')),
  lat REAL,
  lng REAL,
  operacion_ref TEXT,
  idempotencia TEXT NOT NULL UNIQUE,
  metadatos_json TEXT NOT NULL DEFAULT 'null',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS paquete_eventos_paquete ON paquete_eventos(paquete_id, id);
CREATE TRIGGER IF NOT EXISTS paquete_eventos_inmutable_update
BEFORE UPDATE ON paquete_eventos
BEGIN
  SELECT RAISE(ABORT, 'evento_inmutable');
END;
CREATE TRIGGER IF NOT EXISTS paquete_eventos_inmutable_delete
BEFORE DELETE ON paquete_eventos
BEGIN
  SELECT RAISE(ABORT, 'evento_inmutable');
END;

-- Idempotencia de la API: la misma clave en la misma empresa devuelve la MISMA respuesta.
-- Con otro cuerpo, 409. Se guarda la huella del cuerpo, nunca secretos.
CREATE TABLE IF NOT EXISTS idempotencia_flex (
  empresa_id TEXT NOT NULL,
  clave TEXT NOT NULL,
  ruta TEXT NOT NULL,
  cuerpo_hash TEXT NOT NULL,
  estado INTEGER NOT NULL,
  respuesta_json TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (empresa_id, clave)
);

-- Importación por CSV: se previsualiza (filas válidas y errores), se confirma y se procesa en
-- lotes pequeños; se puede reanudar (cada fila guarda el envío que creó).
CREATE TABLE IF NOT EXISTS importaciones (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  centro_id TEXT REFERENCES empresa_centros(id),
  nombre_archivo TEXT NOT NULL DEFAULT '',
  huella TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'previsualizada'
    CHECK (estado IN ('previsualizada', 'confirmada', 'terminada', 'cancelada')),
  total INTEGER NOT NULL DEFAULT 0,
  validas INTEGER NOT NULL DEFAULT 0,
  procesadas INTEGER NOT NULL DEFAULT 0,
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS importaciones_empresa ON importaciones(empresa_id, creado_en);
CREATE TABLE IF NOT EXISTS importacion_filas (
  importacion_id TEXT NOT NULL REFERENCES importaciones(id),
  numero INTEGER NOT NULL,
  datos_json TEXT NOT NULL,
  error TEXT,
  envio_id TEXT REFERENCES envios(id),
  PRIMARY KEY (importacion_id, numero)
);

-- Lotes y rutas (solo estructura en la Fase 1; el despacho, la aceptación y la ocupación del
-- conductor son de la Fase 2). REGLA: una ruta Flex = UNA operación activa del conductor.
CREATE TABLE IF NOT EXISTS lotes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  centro_id TEXT REFERENCES empresa_centros(id),
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'terminado')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lotes_empresa ON lotes(empresa_id, estado);
-- Un paquete pertenece como mucho a un lote.
CREATE TABLE IF NOT EXISTS lote_paquetes (
  paquete_id TEXT PRIMARY KEY REFERENCES paquetes(id),
  lote_id TEXT NOT NULL REFERENCES lotes(id),
  agregado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lote_paquetes_lote ON lote_paquetes(lote_id);
CREATE TABLE IF NOT EXISTS rutas_flex (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  centro_id TEXT REFERENCES empresa_centros(id),
  lote_id TEXT REFERENCES lotes(id),
  nombre TEXT NOT NULL DEFAULT '',
  conductor_id TEXT REFERENCES usuarios(id),
  vehiculo_id TEXT REFERENCES vehiculos(id),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN (
    'borrador', 'ofrecida', 'asignada', 'aceptada', 'en_carga', 'en_curso',
    'completada', 'con_incidencias', 'cancelada')),
  bloque_desde TEXT,
  bloque_hasta TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fase 2: cómo llegó al conductor (asignación directa a uno propio u oferta a uno de la red).
  modalidad TEXT CHECK (modalidad IS NULL OR modalidad IN ('asignacion', 'oferta')),
  oferta_vence_en TEXT,
  asignada_en TEXT,
  aceptada_en TEXT,
  carga_en TEXT,
  iniciada_en TEXT,
  cerrada_en TEXT,
  ultima_clave TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  conductor_lat REAL,
  conductor_lng REAL,
  conductor_ubicacion_en TEXT,
  resumen_json TEXT,
  CHECK ((estado = 'borrador' AND conductor_id IS NULL) OR estado = 'cancelada'
      OR (estado NOT IN ('borrador', 'cancelada') AND conductor_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS rutas_flex_empresa ON rutas_flex(empresa_id, estado);
-- Fase 2 activará la ocupación; desde ya la base impide dos rutas activas del mismo conductor.
CREATE UNIQUE INDEX IF NOT EXISTS rutas_flex_una_activa
  ON rutas_flex(conductor_id) WHERE estado IN ('asignada', 'aceptada', 'en_carga', 'en_curso') AND conductor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rutas_flex_conductor ON rutas_flex(conductor_id, estado);
CREATE TABLE IF NOT EXISTS ruta_paradas (
  id TEXT PRIMARY KEY,
  ruta_id TEXT NOT NULL REFERENCES rutas_flex(id),
  orden INTEGER NOT NULL CHECK (orden >= 1),
  envio_id TEXT NOT NULL REFERENCES envios(id),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'llegada', 'entregada', 'fallida', 'omitida')),
  ventana_desde TEXT,
  ventana_hasta TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fase 2: cuándo llegó el conductor y cuándo quedó resuelta la parada.
  llegada_en TEXT,
  resuelta_en TEXT,
  UNIQUE (ruta_id, orden),
  UNIQUE (ruta_id, envio_id)
);
CREATE TABLE IF NOT EXISTS ruta_asignaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ruta_id TEXT NOT NULL REFERENCES rutas_flex(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  clave TEXT NOT NULL UNIQUE,
  inicio TEXT NOT NULL DEFAULT (datetime('now')),
  fin TEXT,
  resultado TEXT CHECK (resultado IS NULL OR resultado IN
    ('completada', 'liberada_conductor', 'liberada_sistema', 'reasignada', 'cancelada')),
  CHECK ((fin IS NULL) = (resultado IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ruta_asignaciones_una_abierta ON ruta_asignaciones(ruta_id) WHERE fin IS NULL;

-- ───────────── DIVOOX FLEX · FASE 2 (27 oct 2026, rama fase-flex-2): rutas operativas ─────────────
-- Estados de la ruta. La base rechaza cualquier salto que no esté aquí (disparador en esquemaFlex.ts).
CREATE TABLE IF NOT EXISTS transiciones_ruta_flex (
  desde TEXT NOT NULL,
  hacia TEXT NOT NULL,
  PRIMARY KEY (desde, hacia)
);
INSERT OR IGNORE INTO transiciones_ruta_flex (desde, hacia) VALUES
  ('borrador', 'ofrecida'), ('borrador', 'asignada'), ('borrador', 'cancelada'),
  ('ofrecida', 'aceptada'), ('ofrecida', 'borrador'), ('ofrecida', 'cancelada'),
  ('asignada', 'aceptada'), ('asignada', 'borrador'), ('asignada', 'cancelada'),
  ('aceptada', 'en_carga'), ('aceptada', 'borrador'), ('aceptada', 'cancelada'),
  ('en_carga', 'en_curso'), ('en_carga', 'cancelada'),
  ('en_curso', 'completada'), ('en_curso', 'con_incidencias');

-- Qué paquetes lleva la ruta. Un paquete está como mucho en UNA ruta activa a la vez.
CREATE TABLE IF NOT EXISTS ruta_paquetes (
  ruta_id TEXT NOT NULL REFERENCES rutas_flex(id),
  paquete_id TEXT NOT NULL REFERENCES paquetes(id),
  parada_id TEXT NOT NULL REFERENCES ruta_paradas(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  cargado_en TEXT,
  excluido_en TEXT,
  excluido_motivo TEXT,
  devuelto_centro_en TEXT,
  recibido_en TEXT,
  recibido_por TEXT REFERENCES usuarios(id),
  PRIMARY KEY (ruta_id, paquete_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ruta_paquetes_activo ON ruta_paquetes(paquete_id) WHERE activo = 1;
CREATE INDEX IF NOT EXISTS ruta_paquetes_parada ON ruta_paquetes(parada_id);

-- Pruebas de entrega (foto, firma, foto de incidencia): el archivo vive en el almacén privado (R2);
-- aquí solo la referencia. Nunca hay enlaces públicos: se sirven a la empresa dueña con permiso.
CREATE TABLE IF NOT EXISTS flex_pruebas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  ruta_id TEXT NOT NULL REFERENCES rutas_flex(id),
  parada_id TEXT REFERENCES ruta_paradas(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'firma', 'incidencia')),
  clave TEXT NOT NULL,
  lat REAL,
  lng REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fase 3: cuándo se borró el archivo por una política de retención APROBADA (la fila queda).
  purgada_en TEXT
);
CREATE INDEX IF NOT EXISTS flex_pruebas_ruta ON flex_pruebas(ruta_id, parada_id);

-- PIN del destinatario: se muestra una vez a la empresa (para que lo comunique) y aquí solo queda
-- el hash con su sal. Se verifica en el servidor; cinco intentos fallidos lo bloquean.
CREATE TABLE IF NOT EXISTS flex_pines (
  envio_id TEXT PRIMARY KEY REFERENCES envios(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  pin_hash TEXT NOT NULL,
  sal TEXT NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  usado_en TEXT
);

-- Entregas fallidas con su motivo y la próxima acción. Nunca se marcan entregadas solas.
CREATE TABLE IF NOT EXISTS flex_incidencias (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  ruta_id TEXT NOT NULL REFERENCES rutas_flex(id),
  parada_id TEXT REFERENCES ruta_paradas(id),
  paquete_id TEXT NOT NULL REFERENCES paquetes(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  motivo TEXT NOT NULL CHECK (motivo IN ('ausente', 'direccion_incorrecta', 'acceso_imposible',
    'rechazada', 'danado', 'seguridad', 'no_encontrado_centro', 'otro')),
  observaciones TEXT NOT NULL DEFAULT '',
  prueba_id TEXT REFERENCES flex_pruebas(id),
  proxima_accion TEXT NOT NULL CHECK (proxima_accion IN ('reintentar', 'reprogramar', 'devolver')),
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'reintentada', 'resuelta')),
  -- La empresa autoriza un reintento aunque su configuración no los permita en ruta.
  reintento_autorizado INTEGER NOT NULL DEFAULT 0 CHECK (reintento_autorizado IN (0, 1)),
  idempotencia TEXT NOT NULL UNIQUE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelta_en TEXT
);
CREATE INDEX IF NOT EXISTS flex_incidencias_ruta ON flex_incidencias(ruta_id, estado);
CREATE INDEX IF NOT EXISTS flex_incidencias_empresa ON flex_incidencias(empresa_id, creado_en);

-- ───────────── DIVOOX FLEX · FASE 3 (27 oct 2026, rama fase-flex-3): automatización e integraciones ─────────────
-- Bandeja de eventos de salida. La llenan DISPARADORES (esquemaFlex.ts) en la misma transacción que
-- el cambio de custodia, de ruta o la incidencia: si el cambio se deshace, el evento tampoco existe.
-- `evento_id` es el id único que recibe la empresa (protección contra repeticiones).
CREATE TABLE IF NOT EXISTS flex_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id TEXT NOT NULL UNIQUE,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL,
  objeto_id TEXT NOT NULL,
  ruta_id TEXT,
  datos_json TEXT NOT NULL DEFAULT '{}',
  repartido_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS flex_eventos_sin_repartir ON flex_eventos(repartido_en, id);
CREATE INDEX IF NOT EXISTS flex_eventos_empresa ON flex_eventos(empresa_id, id);

-- Destinos de integración (avisos firmados al sistema de la empresa). El secreto se guarda CIFRADO
-- (se muestra una sola vez); al rotarlo, el anterior sigue firmando durante el periodo de gracia.
CREATE TABLE IF NOT EXISTS flex_webhooks (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  url TEXT NOT NULL,
  eventos_json TEXT NOT NULL DEFAULT '[]',
  descripcion TEXT NOT NULL DEFAULT '',
  secreto_cifrado TEXT NOT NULL,
  secreto_prefijo TEXT NOT NULL,
  secreto_anterior_cifrado TEXT,
  secreto_anterior_vence_en TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'desactivado')),
  fallos_seguidos INTEGER NOT NULL DEFAULT 0,
  ultimo_exito_en TEXT,
  desactivado_en TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS flex_webhooks_empresa ON flex_webhooks(empresa_id, estado);

-- Cola de entrega: un evento por destino, una sola vez (UNIQUE). Reintentos con espera creciente.
CREATE TABLE IF NOT EXISTS flex_webhook_entregas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT NOT NULL REFERENCES flex_webhooks(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  evento_id TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviando', 'entregado', 'fallido', 'descartado')),
  intentos INTEGER NOT NULL DEFAULT 0,
  proximo_en TEXT NOT NULL DEFAULT (datetime('now')),
  tomado_en TEXT,
  ultimo_http INTEGER,
  ultimo_error TEXT NOT NULL DEFAULT '',
  entregado_en TEXT,
  es_prueba INTEGER NOT NULL DEFAULT 0 CHECK (es_prueba IN (0, 1)),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (webhook_id, evento_id)
);
CREATE INDEX IF NOT EXISTS flex_webhook_entregas_cola ON flex_webhook_entregas(estado, proximo_en);
CREATE INDEX IF NOT EXISTS flex_webhook_entregas_destino ON flex_webhook_entregas(webhook_id, id);

-- Registro de cada intento (para la empresa y para soporte). Nunca guarda el cuerpo ni el secreto.
CREATE TABLE IF NOT EXISTS flex_webhook_intentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entrega_id INTEGER NOT NULL REFERENCES flex_webhook_entregas(id),
  webhook_id TEXT NOT NULL REFERENCES flex_webhooks(id),
  numero INTEGER NOT NULL,
  http_estado INTEGER,
  error TEXT NOT NULL DEFAULT '',
  duracion_ms INTEGER,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS flex_webhook_intentos_destino ON flex_webhook_intentos(webhook_id, id);

-- Avisos al celular de Flex: la clave única evita mandar el mismo aviso dos veces.
CREATE TABLE IF NOT EXISTS flex_avisos (
  clave TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL,
  ruta_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Retención por país y servicio. Lo sensible (fotos, firmas, pruebas) NUNCA se borra sin una
-- política aprobada por una persona; sin fila aquí, rige la de fábrica (que no borra pruebas).
CREATE TABLE IF NOT EXISTS flex_retencion (
  pais TEXT NOT NULL,
  servicio TEXT NOT NULL,
  categoria TEXT NOT NULL,
  dias INTEGER NOT NULL CHECK (dias >= 1),
  aprobada INTEGER NOT NULL DEFAULT 0 CHECK (aprobada IN (0, 1)),
  aprobada_por TEXT REFERENCES usuarios(id),
  aprobada_en TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pais, servicio, categoria)
);
CREATE TABLE IF NOT EXISTS flex_limpiezas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modo TEXT NOT NULL CHECK (modo IN ('simulacion', 'ejecucion')),
  origen TEXT NOT NULL DEFAULT 'reloj',
  resultado_json TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Capacidad de un vehículo para Flex (la pone la empresa). No toca `vehiculos` de Comida.
CREATE TABLE IF NOT EXISTS flex_capacidad_vehiculo (
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  max_paquetes INTEGER CHECK (max_paquetes IS NULL OR max_paquetes BETWEEN 1 AND 1000),
  max_peso_g INTEGER CHECK (max_peso_g IS NULL OR max_peso_g BETWEEN 1 AND 5000000),
  max_volumen_cm3 INTEGER CHECK (max_volumen_cm3 IS NULL OR max_volumen_cm3 BETWEEN 1 AND 50000000),
  -- Restricción por paquete: el lado más largo que cabe (cm). NULL = sin dato.
  max_lado_cm INTEGER CHECK (max_lado_cm IS NULL OR max_lado_cm BETWEEN 1 AND 1000),
  actualizado_por TEXT REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (vehiculo_id, empresa_id)
);

-- ───────────── DIVOOX · FASE 4 DE FLEX (27 oct 2026, rama fase-flex-4): dinero ─────────────
-- El dinero vive en el LIBRO (tabla `libro`, cuenta `empresa:<id>`, bolsillos prepago/reservado/
-- deuda_cliente; Divoox en `tumbite`/comisiones). Estas tablas solo explican y ordenan esos
-- movimientos: nunca son la fuente del saldo. Todo en la unidad menor de la moneda (centavos).

-- Políticas financieras (capa común de todos los servicios). Ninguna cifra vive en el código. Una
-- política no se edita: se cierra (vigente_hasta) y se crea otra; lo ya cobrado nunca cambia.
CREATE TABLE IF NOT EXISTS politicas_financieras (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL DEFAULT '',
  servicio TEXT NOT NULL CHECK (servicio IN ('flex', 'express', 'food', 'ride', 'car', 'grocery')),
  tipo_cuenta TEXT NOT NULL CHECK (tipo_cuenta IN ('empresa', 'conductor')),
  pais TEXT NOT NULL,
  ciudad TEXT,
  empresa_id TEXT REFERENCES empresas(id),
  modalidad TEXT NOT NULL CHECK (modalidad IN ('prepago', 'connect', 'sin_cobro')),
  moneda TEXT NOT NULL,
  regla_json TEXT NOT NULL,
  descuento_pb INTEGER NOT NULL DEFAULT 0 CHECK (descuento_pb BETWEEN 0 AND 10000),
  vigente_desde TEXT NOT NULL,
  vigente_hasta TEXT,
  prioridad INTEGER NOT NULL DEFAULT 0,
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  -- Prepago de conductores: no rige sin la revisión legal y comercial del mercado aprobada.
  revision_legal_aprobada INTEGER NOT NULL DEFAULT 0 CHECK (revision_legal_aprobada IN (0, 1)),
  revision_legal_nota TEXT NOT NULL DEFAULT '',
  motivo TEXT NOT NULL DEFAULT '',
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  cerrada_por TEXT REFERENCES usuarios(id),
  cerrada_en TEXT,
  CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);
CREATE INDEX IF NOT EXISTS politicas_financieras_busqueda
  ON politicas_financieras(servicio, tipo_cuenta, pais, activa);

-- Interruptor público de lanzamiento por ciudad (F17): la web dice «Ya estamos» o «Muy pronto»
-- según esta tabla. Sin fila, manda la lista de la web (todas «muy pronto»).
CREATE TABLE IF NOT EXISTS ciudades_web (
  slug TEXT PRIMARY KEY,
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'pronto')),
  actualizado_por TEXT REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Política de cancelaciones por servicio y país (C-CANCELACION-POLITICA): qué parte de la comisión
-- apartada se queda Divoox si la operación se cancela. Sin fila vigente, todo vuelve al conductor.
-- No se edita: se cierra (vigente_hasta) y se crea otra.
CREATE TABLE IF NOT EXISTS politicas_cancelacion (
  id TEXT PRIMARY KEY,
  servicio TEXT NOT NULL CHECK (servicio IN ('flex', 'express', 'food', 'ride', 'car', 'grocery')),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  regla_json TEXT NOT NULL,
  vigente_desde TEXT NOT NULL DEFAULT (datetime('now')),
  vigente_hasta TEXT,
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  revision_legal_aprobada INTEGER NOT NULL DEFAULT 0 CHECK (revision_legal_aprobada IN (0, 1)),
  motivo TEXT NOT NULL DEFAULT '',
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS politicas_cancelacion_busqueda
  ON politicas_cancelacion(servicio, pais, activa);

-- Auditoría financiera (políticas, límites, ajustes manuales, reembolsos). Inmutable (disparadores).
CREATE TABLE IF NOT EXISTS finanzas_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  actor_tipo TEXT NOT NULL DEFAULT 'usuario' CHECK (actor_tipo IN ('usuario', 'sistema')),
  accion TEXT NOT NULL,
  objeto TEXT NOT NULL DEFAULT '',
  empresa_id TEXT,
  detalle_json TEXT NOT NULL DEFAULT 'null',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS finanzas_auditoria_empresa ON finanzas_auditoria(empresa_id, id);

-- Cobro de una ruta: la tarifa CONGELADA al salir del borrador y su reserva. Un ciclo por cada vez
-- que la ruta se asigna u ofrece; solo uno abierto a la vez por ruta.
CREATE TABLE IF NOT EXISTS flex_cobros_ruta (
  id TEXT PRIMARY KEY,
  ruta_id TEXT NOT NULL REFERENCES rutas_flex(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  politica_id TEXT REFERENCES politicas_financieras(id),
  regla_json TEXT NOT NULL,
  tarifa_unitaria INTEGER NOT NULL DEFAULT 0,
  descuento_pb INTEGER NOT NULL DEFAULT 0,
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  paquetes_estimados INTEGER NOT NULL DEFAULT 0,
  reservado INTEGER NOT NULL DEFAULT 0,
  cobrado INTEGER NOT NULL DEFAULT 0,
  liberado INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'reservada' CHECK (estado IN ('reservada', 'liberada', 'cerrada')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  cerrado_en TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS flex_cobros_ruta_abierto ON flex_cobros_ruta(ruta_id) WHERE estado = 'reservada';
CREATE INDEX IF NOT EXISTS flex_cobros_ruta_empresa ON flex_cobros_ruta(empresa_id, creado_en);

-- Recargas de la billetera de una empresa (Stripe en modo prueba). El saldo solo se acredita con el
-- aviso FIRMADO de Stripe, una vez (referencia única en el libro).
CREATE TABLE IF NOT EXISTS recargas_empresa (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  monto INTEGER NOT NULL CHECK (monto > 0),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'acreditada', 'fallida', 'cancelada')),
  automatica INTEGER NOT NULL DEFAULT 0 CHECK (automatica IN (0, 1)),
  stripe_pi TEXT UNIQUE,
  idempotencia TEXT UNIQUE,
  creado_por TEXT REFERENCES usuarios(id),
  reembolsado INTEGER NOT NULL DEFAULT 0,
  disputado INTEGER NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  acreditada_en TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS recargas_empresa_empresa ON recargas_empresa(empresa_id, creado_en);
CREATE INDEX IF NOT EXISTS recargas_empresa_pendientes ON recargas_empresa(estado, creado_en);

-- Comprobantes (no son facturas fiscales): recarga, reembolso, comisiones de una ruta, ajuste.
CREATE TABLE IF NOT EXISTS comprobantes (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('recarga', 'reembolso', 'comisiones_ruta', 'ajuste')),
  monto INTEGER NOT NULL,
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  referencia TEXT NOT NULL UNIQUE,
  datos_json TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS comprobantes_empresa ON comprobantes(empresa_id, creado_en);

-- Configuración financiera de cada empresa: alertas, recarga automática y su método guardado en
-- Stripe (solo el id y la marca con los 4 últimos dígitos; nunca el número de la tarjeta).
CREATE TABLE IF NOT EXISTS empresa_finanzas (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id),
  alerta_saldo INTEGER CHECK (alerta_saldo IS NULL OR alerta_saldo >= 0),
  avisos_correo INTEGER NOT NULL DEFAULT 1 CHECK (avisos_correo IN (0, 1)),
  recarga_auto_activa INTEGER NOT NULL DEFAULT 0 CHECK (recarga_auto_activa IN (0, 1)),
  recarga_auto_umbral INTEGER CHECK (recarga_auto_umbral IS NULL OR recarga_auto_umbral >= 0),
  recarga_auto_monto INTEGER CHECK (recarga_auto_monto IS NULL OR recarga_auto_monto > 0),
  stripe_cliente TEXT,
  stripe_metodo TEXT,
  metodo_resumen TEXT NOT NULL DEFAULT '',
  alerta_enviada_en TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================================================
-- FASE 3 · EXCLUSIVIDAD Y ASIGNACIÓN (16 oct 2026, rama fase-3-exclusividad). Diseño:
-- docs/ARQUITECTURA-MULTISERVICIO-V1.2.md §3.1–§3.4 y §5. Aquí solo van TABLAS e ÍNDICES.
-- Los disparadores, las vistas y el cuadre de la ocupación los crea el servidor al arrancar
-- (apps/servidor/src/esquemaFase3.ts), una sentencia a la vez: el divisor de sentencias de la
-- plataforma corta mal los disparadores con CASE y la publicación se detenía (16 oct 2026).
-- Moto y Carro siguen apagados: ninguna ruta pública crea operaciones.
-- =====================================================================================

-- ----- Operaciones y viajes (V1.2 §3.1). Una acción = una sentencia; el resto, disparadores -----
CREATE TABLE IF NOT EXISTS operaciones (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN ('viaje_pasajero', 'envio_paquete', 'compra_encargo', 'pedido_comercio')),
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  conductor_id TEXT REFERENCES usuarios(id),
  vehiculo_id TEXT REFERENCES vehiculos(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  estado_general TEXT NOT NULL CHECK (estado_general IN
    ('pago_pendiente', 'buscando', 'asignada', 'en_curso', 'terminada', 'cancelada', 'sin_conductor')),
  ultima_clave TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (estado_general NOT IN ('asignada', 'en_curso') OR (conductor_id IS NOT NULL AND vehiculo_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS operaciones_cliente ON operaciones(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS operaciones_busqueda ON operaciones(zona_id, servicio_id, creado_en) WHERE estado_general = 'buscando';
CREATE UNIQUE INDEX IF NOT EXISTS operaciones_una_activa ON operaciones(conductor_id) WHERE estado_general IN ('asignada', 'en_curso');

CREATE TABLE IF NOT EXISTS viajes (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso',
    'terminado', 'cancelado', 'no_show', 'sin_conductor')),
  ultimo_actor TEXT NOT NULL CHECK (ultimo_actor IN ('cliente', 'conductor', 'soporte', 'sistema')),
  ultimo_actor_id TEXT REFERENCES usuarios(id),
  ultima_clave TEXT NOT NULL,
  motivo_transicion TEXT NOT NULL DEFAULT '',
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  pasajeros INTEGER NOT NULL DEFAULT 1 CHECK (pasajeros BETWEEN 1 AND 6),
  pin_recogida TEXT NOT NULL CHECK (length(pin_recogida) = 4),
  liberaciones INTEGER NOT NULL DEFAULT 0 CHECK (liberaciones >= 0),
  intentos_pin INTEGER NOT NULL DEFAULT 0,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
  cotizacion_id TEXT,
  distancia_m_real INTEGER, duracion_s_real INTEGER, total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT
);

-- C-TRANSICIONES-PEDIDO (16 oct 2026): las transiciones de estado permitidas de un pedido de
-- Comida. El disparador que las hace cumplir NO va aquí: lo crea esquema.ts al arrancar
-- (esquemaPedidos.ts). reversion = 1: vuelta atrás del Manager si Stripe falla (≤ 2 minutos).
CREATE TABLE IF NOT EXISTS transiciones_pedido (
  desde TEXT NOT NULL, hacia TEXT NOT NULL, reversion INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (desde, hacia)
);
INSERT OR IGNORE INTO transiciones_pedido (desde, hacia, reversion) VALUES
  ('pago_pendiente', 'pagado', 0),
  ('pago_pendiente', 'cancelado', 0),
  ('pagado', 'aceptado', 0),
  ('pagado', 'cancelado', 0),
  ('aceptado', 'listo', 0),
  ('aceptado', 'cancelado', 0),
  ('listo', 'en_camino', 0),
  ('listo', 'entregado', 0),
  ('en_camino', 'entregado', 0),
  ('cancelado', 'pago_pendiente', 1),
  ('cancelado', 'pagado', 1),
  ('cancelado', 'aceptado', 1);

CREATE TABLE IF NOT EXISTS transiciones_viaje (
  desde TEXT NOT NULL, hacia TEXT NOT NULL, actor TEXT NOT NULL,
  PRIMARY KEY (desde, hacia, actor)
);
INSERT OR IGNORE INTO transiciones_viaje (desde, hacia, actor) VALUES
  ('pago_pendiente', 'buscando', 'sistema'),
  ('pago_pendiente', 'cancelado', 'cliente'), ('pago_pendiente', 'cancelado', 'sistema'),
  ('buscando', 'asignado', 'conductor'),
  ('buscando', 'sin_conductor', 'sistema'),
  ('buscando', 'cancelado', 'cliente'), ('buscando', 'cancelado', 'soporte'),
  ('asignado', 'conductor_llego', 'conductor'), ('asignado', 'conductor_llego', 'sistema'),
  ('asignado', 'buscando', 'conductor'), ('asignado', 'buscando', 'sistema'), ('asignado', 'buscando', 'soporte'),
  ('asignado', 'cancelado', 'cliente'), ('asignado', 'cancelado', 'soporte'),
  ('conductor_llego', 'en_curso', 'conductor'),
  ('conductor_llego', 'no_show', 'conductor'),
  ('conductor_llego', 'buscando', 'conductor'), ('conductor_llego', 'buscando', 'soporte'),
  ('conductor_llego', 'cancelado', 'cliente'), ('conductor_llego', 'cancelado', 'soporte'),
  ('en_curso', 'terminado', 'conductor'), ('en_curso', 'terminado', 'soporte');

CREATE TABLE IF NOT EXISTS ofertas_operacion (
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  estado TEXT NOT NULL CHECK (estado IN ('ofrecida', 'aceptada', 'rechazada', 'vencida', 'retirada')),
  ganancia_centavos INTEGER NOT NULL DEFAULT 0 CHECK (ganancia_centavos >= 0),
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL,
  respondida_en TEXT,
  PRIMARY KEY (operacion_id, conductor_id)
);
CREATE INDEX IF NOT EXISTS ofertas_operacion_conductor ON ofertas_operacion(conductor_id, estado);
CREATE INDEX IF NOT EXISTS ofertas_operacion_vencer ON ofertas_operacion(expira_en) WHERE estado = 'ofrecida';

CREATE TABLE IF NOT EXISTS eventos_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  tipo TEXT NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  actor_id TEXT REFERENCES usuarios(id),
  actor_rol TEXT NOT NULL CHECK (actor_rol IN ('cliente', 'conductor', 'soporte', 'sistema')),
  datos_json TEXT NOT NULL DEFAULT '{}',
  idempotencia TEXT UNIQUE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS eventos_operacion_op ON eventos_operacion(operacion_id, id);

CREATE TABLE IF NOT EXISTS asignaciones_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  clave TEXT NOT NULL UNIQUE,
  inicio TEXT NOT NULL DEFAULT (datetime('now')),
  fin TEXT,
  resultado TEXT CHECK (resultado IS NULL OR resultado IN
    ('completada', 'liberada_conductor', 'liberada_sistema', 'reasignada_soporte', 'cancelada', 'no_show')),
  motivo TEXT NOT NULL DEFAULT '',
  CHECK ((fin IS NULL) = (resultado IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_una_abierta ON asignaciones_operacion(operacion_id) WHERE fin IS NULL;
CREATE INDEX IF NOT EXISTS asignaciones_conductor ON asignaciones_operacion(conductor_id, inicio);

-- ----- Exclusividad (V1.2 §3.4): UNA fila por conductor ocupado -----
CREATE TABLE IF NOT EXISTS conductor_ocupacion (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'operacion', 'ruta_flex')),
  operacion_id TEXT REFERENCES operaciones(id),
  pedidos INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  ruta_id TEXT REFERENCES rutas_flex(id),
  CHECK ((tipo = 'comida' AND operacion_id IS NULL AND ruta_id IS NULL AND pedidos >= 1)
      OR (tipo = 'operacion' AND operacion_id IS NOT NULL AND ruta_id IS NULL AND pedidos = 0)
      OR (tipo = 'ruta_flex' AND ruta_id IS NOT NULL AND operacion_id IS NULL AND pedidos = 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS conductor_ocupacion_operacion ON conductor_ocupacion(operacion_id) WHERE operacion_id IS NOT NULL;
-- Divoox Flex · Fase 2: una ruta (con todos sus paquetes) ocupa al conductor como UNA sola operación.
-- El índice único por ruta_id lo crea el servidor al arrancar (esquemaFlex.ts): aquí rompería la
-- publicación en una base donde la tabla todavía no tiene la columna (schema.sql corre antes).

-- ───────────── Fase 2 · Modelo internacional (18 oct 2026) ─────────────
-- Libro mayor por país y moneda. Cada fila es un movimiento de UN bolsillo; nunca se borra ni se
-- edita: los ajustes dejan filas compensatorias con autor. Bolsillos:
--   prepago      saldo del repartidor para pagar comisiones (nunca negativo, sin retiro)
--   reservado    comisión apartada al aceptar un pedido en efectivo (se cobra o se libera)
--   comisiones   lo que Tumbite cobró (cuenta_id = 'tumbite')
--   punto        fondo prepago de un punto de venta (cuenta_id = 'punto:<id>')
--   deuda_cliente lo que un cliente dejó sin pagar (positivo = debe)
--   directo      informativo: dinero que fue directo del cliente al repartidor o al restaurante
CREATE TABLE IF NOT EXISTS libro (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL,
  bolsillo TEXT NOT NULL CHECK (bolsillo IN ('prepago', 'reservado', 'comisiones', 'punto', 'deuda_cliente', 'directo')),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  monto INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  pedido_id TEXT REFERENCES pedidos(id),
  referencia TEXT,
  autor_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS libro_cuenta ON libro(cuenta_id, bolsillo, pais, moneda);
CREATE INDEX IF NOT EXISTS libro_pedido ON libro(pedido_id);
CREATE UNIQUE INDEX IF NOT EXISTS libro_referencia_unica ON libro(referencia) WHERE referencia IS NOT NULL;

-- Puntos de venta de recargas: compran saldo a Tumbite por adelantado y lo venden en códigos.
CREATE TABLE IF NOT EXISTS puntos_venta (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  usuario_id TEXT REFERENCES usuarios(id),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS codigos_recarga (
  id TEXT PRIMARY KEY,
  codigo_hash TEXT NOT NULL UNIQUE,
  punto_id TEXT NOT NULL REFERENCES puntos_venta(id),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  monto INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'canjeado', 'anulado')),
  emitido_por TEXT,
  canjeado_por TEXT,
  canjeado_en TEXT,
  anulado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS codigos_recarga_punto ON codigos_recarga(punto_id, estado);
-- Intentos fallidos de canje por repartidor (tope por hora contra adivinar códigos).
CREATE TABLE IF NOT EXISTS intentos_canje (
  usuario_id TEXT PRIMARY KEY,
  fallidos INTEGER NOT NULL DEFAULT 0,
  ultimo_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS recargas (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  monto INTEGER NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('codigo', 'stripe')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'acreditada', 'fallida')),
  referencia TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  acreditada_en TEXT
);
CREATE INDEX IF NOT EXISTS recargas_usuario ON recargas(usuario_id, creado_en);
-- Cobro directo: un cliente que no paga al recibir deja el pedido cancelado aunque ya iba en camino.
INSERT OR IGNORE INTO transiciones_pedido (desde, hacia, reversion) VALUES ('en_camino', 'cancelado', 0);
-- Soporte cancela un pedido ya listo (el superadmin lo ofrecía y la base lo rechazaba con un error
-- interno; 18 oct 2026). En cobro directo, si el repartidor ya pagó la comida queda la pérdida escrita.
INSERT OR IGNORE INTO transiciones_pedido (desde, hacia, reversion) VALUES ('listo', 'cancelado', 0);

-- Cuentas a las que el cliente le transfiere al repartidor (cobro directo por transferencia). Se
-- muestran con el nombre del beneficiario; un cambio exige la contraseña, queda en el historial,
-- avisa por correo y entra en vigor a las 24 horas (o antes si el equipo la confirma).
CREATE TABLE IF NOT EXISTS cuentas_cobro (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  pais TEXT NOT NULL,
  moneda TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('banco', 'nequi', 'daviplata', 'pago_movil', 'zelle', 'otro')),
  banco TEXT NOT NULL DEFAULT '',
  titular TEXT NOT NULL,
  identificador TEXT NOT NULL,
  -- 'declarada' = la escribió el repartidor; 'confirmada' = el equipo la revisó (nunca «verificada por el banco»).
  verificacion TEXT NOT NULL DEFAULT 'declarada' CHECK (verificacion IN ('declarada', 'confirmada')),
  activa INTEGER NOT NULL DEFAULT 1,
  activa_desde TEXT NOT NULL DEFAULT (datetime('now')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cuentas_cobro_usuario ON cuentas_cobro(usuario_id, activa);
CREATE TABLE IF NOT EXISTS cuentas_cobro_historial (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL REFERENCES cuentas_cobro(id),
  usuario_id TEXT NOT NULL,
  cambio TEXT NOT NULL,
  autor_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Favoritos del cliente (auditoría final, punto 13): restaurantes guardados con el corazón.
CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  restaurante_id TEXT NOT NULL REFERENCES restaurantes(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, restaurante_id)
);

-- Direcciones guardadas del cliente (auditoría final, punto 14): casa, trabajo… con instrucciones.
CREATE TABLE IF NOT EXISTS direcciones_cliente (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  etiqueta TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL,
  lat REAL,
  lng REAL,
  instrucciones TEXT NOT NULL DEFAULT '',
  entrega TEXT NOT NULL DEFAULT 'puerta' CHECK (entrega IN ('puerta', 'mano')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  usada_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS direcciones_cliente_usuario ON direcciones_cliente(usuario_id, usada_en);

-- Cupones (auditoría final, punto 15). Quién los paga (Tumbite o el restaurante) lo fija cada cupón;
-- de fábrica los paga Tumbite (baja su ganancia), decisión de Richard por cupón.
CREATE TABLE IF NOT EXISTS cupones (
  codigo TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('monto', 'porcentaje', 'envio_gratis')),
  valor INTEGER NOT NULL DEFAULT 0,
  descripcion_es TEXT NOT NULL DEFAULT '',
  descripcion_en TEXT NOT NULL DEFAULT '',
  minimo_subtotal INTEGER NOT NULL DEFAULT 0,
  usos_max INTEGER,
  usos_por_cliente INTEGER NOT NULL DEFAULT 1,
  solo_primer_pedido INTEGER NOT NULL DEFAULT 0,
  restaurante_id TEXT REFERENCES restaurantes(id),
  zona_id TEXT,
  destacado INTEGER NOT NULL DEFAULT 0,
  vence_en TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS usos_cupon (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  codigo TEXT NOT NULL REFERENCES cupones(codigo),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  descuento INTEGER NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS usos_cupon_codigo ON usos_cupon(codigo, usuario_id);

-- Restaurante como los grandes (auditoría final, puntos 19 a 21): equipo, festivos y orden de categorías.
CREATE TABLE IF NOT EXISTS miembros_restaurante (
  restaurante_id TEXT NOT NULL REFERENCES restaurantes(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  rol TEXT NOT NULL DEFAULT 'staff' CHECK (rol IN ('manager', 'staff')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (restaurante_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS miembros_restaurante_usuario ON miembros_restaurante(usuario_id);
-- Una persona pertenece a UN solo equipo (19 oct 2026): la base lo garantiza aunque dos altas lleguen
-- a la vez. Comprobado antes de agregarlo: ninguna persona estaba en dos equipos (producción y pruebas).
CREATE UNIQUE INDEX IF NOT EXISTS miembros_restaurante_una_persona ON miembros_restaurante(usuario_id);
CREATE TABLE IF NOT EXISTS cierres_restaurante (
  id TEXT PRIMARY KEY,
  restaurante_id TEXT NOT NULL REFERENCES restaurantes(id),
  fecha TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (restaurante_id, fecha)
);

-- Fase 2 · cobro directo (C-COBRO-DIRECTO-LOCAL): el repartidor paga la comida en el mostrador con su
-- propio dinero y registra cuánto pagó y cuánto decía el ticket. Tumbite no financia esa compra.
CREATE TABLE IF NOT EXISTS pagos_local (
  pedido_id TEXT PRIMARY KEY REFERENCES pedidos(id),
  repartidor_id TEXT NOT NULL,
  monto_esperado INTEGER NOT NULL,
  monto_pagado INTEGER NOT NULL CHECK (monto_pagado > 0),
  importe_ticket INTEGER NOT NULL CHECK (importe_ticket > 0),
  metodo TEXT NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta_propia')),
  diferencia_pago INTEGER NOT NULL DEFAULT 0,
  diferencia_ticket INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  confirmado_restaurante_en TEXT,
  confirmado_por TEXT,
  -- Foto del ticket del restaurante (opcional), en el almacén privado de evidencias.
  ticket_clave TEXT
);

-- C-BANDEJA-DINERO (19 oct 2026): incidencias de dinero que nadie debe acreditar ni cerrar solo
-- (por ejemplo, una recarga cuyo monto en Stripe no coincide). Una por referencia.
CREATE TABLE IF NOT EXISTS incidencias_dinero (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  referencia TEXT NOT NULL UNIQUE,
  pedido_id TEXT,
  recarga_id TEXT,
  cuenta_id TEXT,
  pais TEXT,
  moneda TEXT,
  monto_esperado INTEGER,
  monto_recibido INTEGER,
  detalle TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'resuelta')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelta_en TEXT
);
-- Seguimiento de los casos de la bandeja de soporte del cobro en mano. Los casos SALEN de los
-- estados del pedido y del libro (no hay contabilidad aparte); aquí solo vive quién lo lleva, en
-- qué estado está y el historial de lo que hizo soporte. Nada se borra.
CREATE TABLE IF NOT EXISTS casos_dinero (
  clave TEXT PRIMARY KEY,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_revision', 'resuelto')),
  responsable_id TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS casos_dinero_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT NOT NULL,
  accion TEXT NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  autor_id TEXT NOT NULL,
  idempotencia TEXT NOT NULL UNIQUE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS casos_dinero_historial_clave ON casos_dinero_historial(clave, creado_en);

-- C-ERRORES-VISIBLES (20 oct 2026): cada error no controlado (500) queda escrito con su ruta y su
-- mensaje. Antes solo iba a la consola del momento y no se podía diagnosticar después.
CREATE TABLE IF NOT EXISTS errores_servidor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metodo TEXT NOT NULL,
  ruta TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  pila TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS errores_servidor_creado ON errores_servidor(creado_en);

-- Divoox Moto · Fase M1 (28 oct 2026, C-VIAJE-PRECIO-FIJO): tarifa de un servicio de pasajeros por
-- ciudad, versionada (una sola activa; cambiar = cerrar la vieja y abrir otra, nunca editar), y la
-- cotización con PRECIO FIJO que el pasajero acepta al pedir. Montos en la unidad menor, enteros.
CREATE TABLE IF NOT EXISTS tarifas_viaje (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  moneda TEXT NOT NULL,
  base INTEGER NOT NULL CHECK (base >= 0),
  por_km INTEGER NOT NULL CHECK (por_km >= 0),
  por_minuto INTEGER NOT NULL CHECK (por_minuto >= 0),
  minimo INTEGER NOT NULL CHECK (minimo >= 0),
  espera_gratis_s INTEGER NOT NULL CHECK (espera_gratis_s >= 0),
  por_minuto_espera INTEGER NOT NULL CHECK (por_minuto_espera >= 0),
  cancelacion_gratis_s INTEGER NOT NULL CHECK (cancelacion_gratis_s >= 0),
  cargo_cancelacion INTEGER NOT NULL CHECK (cargo_cancelacion >= 0),
  cargo_no_se_presento INTEGER NOT NULL CHECK (cargo_no_se_presento >= 0),
  tope_dinamico_pb INTEGER NOT NULL CHECK (tope_dinamico_pb BETWEEN 10000 AND 30000),
  redondeo INTEGER NOT NULL CHECK (redondeo >= 1),
  cargo_fijo INTEGER NOT NULL DEFAULT 0 CHECK (cargo_fijo >= 0),
  factor_calle_pb INTEGER NOT NULL DEFAULT 13000,
  velocidad_kmh INTEGER NOT NULL DEFAULT 24,
  de_prueba INTEGER NOT NULL DEFAULT 1 CHECK (de_prueba IN (0, 1)),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  motivo TEXT NOT NULL DEFAULT '',
  creada_por TEXT REFERENCES usuarios(id),
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  cerrada_en TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS tarifas_viaje_una_activa ON tarifas_viaje(servicio_id, zona_id) WHERE activa = 1;

CREATE TABLE IF NOT EXISTS cotizaciones_viaje (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  tarifa_id TEXT NOT NULL REFERENCES tarifas_viaje(id),
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  distancia_m INTEGER NOT NULL CHECK (distancia_m >= 0),
  duracion_s INTEGER NOT NULL CHECK (duracion_s >= 0),
  multiplicador_pb INTEGER NOT NULL DEFAULT 10000,
  desglose_json TEXT NOT NULL,
  -- Copia de la tarifa con que se cotizó: la espera y la cancelación usan ESA, aunque cambie después.
  tarifa_json TEXT NOT NULL DEFAULT '{}',
  total INTEGER NOT NULL CHECK (total >= 0),
  moneda TEXT NOT NULL,
  vence_en TEXT NOT NULL,
  usada_en TEXT,
  operacion_id TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cotizaciones_viaje_cliente ON cotizaciones_viaje(cliente_id, creado_en);

-- Divoox Moto · M2 (28 oct 2026): lo que el pasajero debe por cancelar tarde o no presentarse en un
-- viaje en efectivo. No se puede cobrar en el momento: se suma a su siguiente viaje (como Namma
-- Yatri). Una sola deuda por viaje y motivo.
CREATE TABLE IF NOT EXISTS deudas_pasajero (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  motivo TEXT NOT NULL CHECK (motivo IN ('cancelacion', 'no_se_presento')),
  monto INTEGER NOT NULL CHECK (monto > 0),
  moneda TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrada', 'perdonada')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelta_en TEXT,
  -- El viaje en el que se cobró (M7): se suma a la cuenta final de ese viaje.
  cobrada_en TEXT,
  UNIQUE (operacion_id, motivo)
);
CREATE INDEX IF NOT EXISTS deudas_pasajero_cliente ON deudas_pasajero(cliente_id, estado);

-- Divoox Moto · M6 (28 oct 2026): seguridad del viaje. Cada toque del botón de emergencia queda
-- aquí (con la ubicación) y le llega al equipo; el enlace para compartir el viaje se guarda solo
-- como huella (nunca el código) y deja de servir cuando el viaje termina.
CREATE TABLE IF NOT EXISTS emergencias_viaje (
  id TEXT PRIMARY KEY,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  actor_id TEXT NOT NULL REFERENCES usuarios(id),
  rol TEXT NOT NULL CHECK (rol IN ('pasajero', 'conductor')),
  lat REAL, lng REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  atendida_en TEXT,
  atendida_por TEXT REFERENCES usuarios(id),
  nota TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS emergencias_viaje_abiertas ON emergencias_viaje(atendida_en, creado_en);
CREATE TABLE IF NOT EXISTS viajes_compartidos (
  huella TEXT PRIMARY KEY,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Divoox Moto · M8 (28 oct 2026): cada lado califica al otro al terminar el viaje (como Uber e
-- inDrive). Una sola calificación por lado y viaje. La del pasajero cuenta en el promedio del
-- conductor junto con las de Comida.
CREATE TABLE IF NOT EXISTS calificaciones_viaje (
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  de TEXT NOT NULL CHECK (de IN ('pasajero', 'conductor')),
  autor_id TEXT NOT NULL REFERENCES usuarios(id),
  estrellas INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (operacion_id, de)
);

-- Flex · C-FLEX-TASA (28 oct 2026, Venezuela): la tasa del día (bolívares por dólar). Una fila por
-- día y fuente: «bcv» (la oficial, leída de su página pública) o la de una empresa («empresa:<id>»).
CREATE TABLE IF NOT EXISTS tasas_cambio (
  pais TEXT NOT NULL,
  fecha TEXT NOT NULL,
  fuente TEXT NOT NULL,
  tasa REAL NOT NULL CHECK (tasa > 0),
  creado_por TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pais, fecha, fuente)
);

-- Tiendas · C-TIENDAS-CATALOGO (28 oct 2026, todos los países): la FICHA del producto (una vez) y la
-- OFERTA de cada tienda (precio, si hay, existencias, pasillo), como DoorDash, Uber Eats, Rappi e
-- Instacart. Hoy cada comercio es su propia tienda; la ficha queda lista para cadenas. Nunca se borra
-- un producto: se agota (`disponible = 0` o `agotado_hasta`).
CREATE TABLE IF NOT EXISTS catalogo_productos (
  id TEXT PRIMARY KEY,
  comercio_id TEXT NOT NULL REFERENCES restaurantes(id),
  sku TEXT NOT NULL,
  codigo_barras TEXT NOT NULL DEFAULT '',
  nombre_es TEXT NOT NULL DEFAULT '',
  nombre_en TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  tamano REAL,
  unidad_tamano TEXT NOT NULL DEFAULT 'each',
  unidades INTEGER NOT NULL DEFAULT 1 CHECK (unidades >= 1),
  categoria1 TEXT NOT NULL,
  categoria2 TEXT NOT NULL DEFAULT '',
  imagen TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  vendido_por TEXT NOT NULL DEFAULT 'each' CHECK (vendido_por IN ('each', 'weight')),
  peso_promedio REAL,
  unidad_peso TEXT NOT NULL DEFAULT '',
  restriccion TEXT NOT NULL DEFAULT '' CHECK (restriccion IN ('', 'alcohol', 'tobacco', 'otc_medicine', 'prescription')),
  abv REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (comercio_id, sku)
);
CREATE INDEX IF NOT EXISTS catalogo_productos_barras ON catalogo_productos(comercio_id, codigo_barras);
CREATE INDEX IF NOT EXISTS catalogo_productos_categoria ON catalogo_productos(comercio_id, categoria1);
CREATE TABLE IF NOT EXISTS catalogo_ofertas (
  comercio_id TEXT NOT NULL REFERENCES restaurantes(id),
  producto_id TEXT NOT NULL REFERENCES catalogo_productos(id),
  precio INTEGER NOT NULL CHECK (precio >= 0),
  precio_oferta INTEGER CHECK (precio_oferta IS NULL OR precio_oferta >= 0),
  disponible INTEGER NOT NULL DEFAULT 1 CHECK (disponible IN (0, 1)),
  existencias INTEGER CHECK (existencias IS NULL OR existencias >= 0),
  pasillo TEXT NOT NULL DEFAULT '',
  agotado_hasta TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comercio_id, producto_id)
);
