-- PUNTO 7: comercios y productos SOBRE las tablas de restaurantes y platos (sin duplicarlas).
-- Columna nueva en una tabla existente: va por esquema.ts (ALTER TABLE … ADD COLUMN), no por schema.sql.
ALTER TABLE restaurantes ADD COLUMN tipo_comercio TEXT NOT NULL DEFAULT 'restaurante'
  CHECK (tipo_comercio IN ('restaurante', 'mercado', 'farmacia', 'licoreria'));
CREATE INDEX IF NOT EXISTS restaurantes_tipo ON restaurantes(tipo_comercio, zona_id, estado);

-- Lo que un producto de tienda tiene y un plato no (1 a 1 con platos; un plato de restaurante no lo necesita).
CREATE TABLE IF NOT EXISTS producto_detalles (
  plato_id TEXT PRIMARY KEY REFERENCES platos(id),
  comercio_id TEXT NOT NULL REFERENCES restaurantes(id),
  sku TEXT NOT NULL DEFAULT '',
  codigo_barras TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  unidad TEXT NOT NULL DEFAULT 'unidad' CHECK (unidad IN ('unidad', 'lb', 'oz', 'kg', 'g', 'l', 'ml', 'paquete')),
  vende_por_peso INTEGER NOT NULL DEFAULT 0 CHECK (vende_por_peso IN (0, 1)),
  inventario INTEGER CHECK (inventario IS NULL OR inventario >= 0),   -- NULL = no se lleva inventario
  inventario_actualizado_en TEXT,
  restriccion TEXT NOT NULL DEFAULT 'ninguna' CHECK (restriccion IN ('ninguna', 'edad_21', 'receta', 'controlado')),
  impuesto_pb INTEGER NOT NULL DEFAULT 0 CHECK (impuesto_pb BETWEEN 0 AND 10000)
);
CREATE UNIQUE INDEX IF NOT EXISTS producto_codigo_unico ON producto_detalles(comercio_id, codigo_barras) WHERE codigo_barras != '';
CREATE UNIQUE INDEX IF NOT EXISTS producto_sku_unico ON producto_detalles(comercio_id, sku) WHERE sku != '';
-- El comercio del detalle es el mismo dueño del plato.
CREATE TRIGGER IF NOT EXISTS producto_detalles_mismo_comercio BEFORE INSERT ON producto_detalles
WHEN (SELECT restaurante_id FROM platos WHERE id = NEW.plato_id) IS NOT NEW.comercio_id
BEGIN SELECT RAISE(ABORT, 'producto_de_otro_comercio'); END;
-- Un restaurante no carga productos con receta o controlados; nadie los carga hasta que lo autorice un abogado.
CREATE TRIGGER IF NOT EXISTS producto_detalles_restringidos BEFORE INSERT ON producto_detalles
WHEN NEW.restriccion IN ('receta', 'controlado')
BEGIN SELECT RAISE(ABORT, 'productos_con_receta_no_habilitados'); END;

-- Sustituciones en pedidos de tienda (ajustes_pedido admite UNA por pedido y es para «agotado»).
CREATE TABLE IF NOT EXISTS sustituciones_pedido (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  plato_id TEXT NOT NULL REFERENCES platos(id),
  sustituto_plato_id TEXT REFERENCES platos(id),
  sustituto_texto TEXT NOT NULL DEFAULT '',
  precio_original_centavos INTEGER NOT NULL CHECK (precio_original_centavos >= 0),
  precio_sustituto_centavos INTEGER CHECK (precio_sustituto_centavos IS NULL OR precio_sustituto_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'propuesta' CHECK (estado IN ('propuesta', 'aceptada', 'rechazada', 'vencida', 'quitado')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelto_en TEXT,
  UNIQUE (pedido_id, plato_id),
  CHECK (sustituto_plato_id IS NOT NULL OR sustituto_texto != '' OR estado = 'quitado')
);

-- Compra por encargo (sin catálogo): reemplaza a «compras» de V1, con tienda libre.
CREATE TABLE IF NOT EXISTS compras (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  rubro TEXT NOT NULL CHECK (rubro IN ('mercado', 'farmacia')),
  comercio_id TEXT REFERENCES restaurantes(id),  -- si la tienda está en Tumbite
  tienda_texto TEXT NOT NULL DEFAULT '',         -- si no lo está
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'comprando', 'esperando_cliente', 'comprado',
    'en_entrega', 'entregado', 'cancelado', 'incidencia')),
  presupuesto_max_centavos INTEGER NOT NULL CHECK (presupuesto_max_centavos > 0),
  total_real_centavos INTEGER CHECK (total_real_centavos IS NULL OR total_real_centavos >= 0),
  comprobante_clave TEXT,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  CHECK (comercio_id IS NOT NULL OR tienda_texto != ''),
  CHECK (estado NOT IN ('comprado', 'en_entrega', 'entregado') OR (comprobante_clave IS NOT NULL AND total_real_centavos IS NOT NULL)),
  CHECK (total_real_centavos IS NULL OR total_real_centavos <= presupuesto_max_centavos)
);
CREATE TABLE IF NOT EXISTS compra_lineas (
  id TEXT PRIMARY KEY,
  operacion_id TEXT NOT NULL REFERENCES compras(operacion_id),
  descripcion TEXT NOT NULL CHECK (length(descripcion) >= 2),
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  unidad TEXT NOT NULL DEFAULT 'unidad',
  precio_estimado_centavos INTEGER NOT NULL CHECK (precio_estimado_centavos >= 0),
  precio_real_centavos INTEGER CHECK (precio_real_centavos IS NULL OR precio_real_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'comprado', 'sustituido', 'no_disponible', 'quitado')),
  sustituto TEXT NOT NULL DEFAULT '',
  sustitucion_aprobada INTEGER CHECK (sustitucion_aprobada IS NULL OR sustitucion_aprobada IN (0, 1)),
  CHECK (estado != 'sustituido' OR (sustituto != '' AND sustitucion_aprobada = 1))
);
CREATE INDEX IF NOT EXISTS compra_lineas_operacion ON compra_lineas(operacion_id);
