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
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
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
  ('farmacia', 'compra_encargo',  'Farmacia', 'Pharmacy', 'Productos de farmacia de venta libre.',        'Over-the-counter pharmacy products.',       'servicio-farmacia', 60, 'proximamente', 0);

INSERT OR IGNORE INTO servicios_zona (servicio_id, zona_id, estado)
  SELECT s.id, z.id, 'proximamente' FROM servicios s CROSS JOIN zonas z;

INSERT OR IGNORE INTO servicio_vehiculos (servicio_id, vehiculo_tipo) VALUES
  ('comida', 'carro'), ('comida', 'moto'), ('comida', 'scooter'), ('comida', 'bicicleta'), ('comida', 'a_pie'),
  ('moto', 'moto'),
  ('carro', 'carro'),
  ('mercado', 'carro'), ('mercado', 'moto'), ('mercado', 'scooter'), ('mercado', 'bicicleta'),
  ('envios', 'carro'), ('envios', 'moto'), ('envios', 'scooter'), ('envios', 'bicicleta'),
  ('farmacia', 'carro'), ('farmacia', 'moto'), ('farmacia', 'scooter'), ('farmacia', 'bicicleta');

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
  distancia_m_real INTEGER, duracion_s_real INTEGER, total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT
);

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
  tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'operacion')),
  operacion_id TEXT REFERENCES operaciones(id),
  pedidos INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((tipo = 'comida' AND operacion_id IS NULL AND pedidos >= 1)
      OR (tipo = 'operacion' AND operacion_id IS NOT NULL AND pedidos = 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS conductor_ocupacion_operacion ON conductor_ocupacion(operacion_id) WHERE operacion_id IS NOT NULL;
