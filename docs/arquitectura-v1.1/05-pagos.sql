-- PUNTO 5: cada llamada a Stripe nace como una fila en la base ANTES de llamar (bandeja de salida).
-- La transacción de la base nunca espera a Stripe; Stripe nunca se llama sin su fila.
CREATE TABLE IF NOT EXISTS pagos_intentos (
  id TEXT PRIMARY KEY,
  clave_idempotencia TEXT NOT NULL UNIQUE,     -- la misma que se manda a Stripe
  ambito TEXT NOT NULL CHECK (ambito IN ('pedido', 'operacion', 'retiro')),
  pedido_id TEXT REFERENCES pedidos(id),
  operacion_id TEXT REFERENCES operaciones(id),
  usuario_id TEXT REFERENCES usuarios(id),
  accion TEXT NOT NULL CHECK (accion IN ('autorizar', 'capturar', 'anular', 'reembolsar', 'transferir', 'cobro_extra')),
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN
    ('pendiente', 'enviando', 'confirmado', 'reintentar', 'fallido', 'revision')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  proximo_intento_en TEXT NOT NULL DEFAULT (datetime('now')),
  enviando_desde TEXT,
  stripe_objeto TEXT,                           -- pi_…, re_…, tr_…
  ultimo_error TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((ambito = 'pedido') = (pedido_id IS NOT NULL)),
  CHECK ((ambito = 'operacion') = (operacion_id IS NOT NULL)),
  CHECK (ambito != 'retiro' OR usuario_id IS NOT NULL),
  CHECK (estado != 'confirmado' OR stripe_objeto IS NOT NULL)
);
-- Una sola captura y una sola anulación por pedido u operación (reembolsos parciales sí pueden ser varios).
CREATE UNIQUE INDEX IF NOT EXISTS pagos_una_captura_pedido ON pagos_intentos(pedido_id, accion)
  WHERE pedido_id IS NOT NULL AND accion IN ('autorizar', 'capturar', 'anular');
CREATE UNIQUE INDEX IF NOT EXISTS pagos_una_captura_operacion ON pagos_intentos(operacion_id, accion)
  WHERE operacion_id IS NOT NULL AND accion IN ('autorizar', 'capturar', 'anular');
CREATE INDEX IF NOT EXISTS pagos_por_procesar ON pagos_intentos(proximo_intento_en)
  WHERE estado IN ('pendiente', 'reintentar');
CREATE INDEX IF NOT EXISTS pagos_atascados ON pagos_intentos(enviando_desde) WHERE estado = 'enviando';

-- Un intento confirmado no vuelve atrás.
CREATE TRIGGER IF NOT EXISTS pagos_confirmado_es_final
BEFORE UPDATE OF estado ON pagos_intentos
WHEN OLD.estado = 'confirmado' AND NEW.estado <> 'confirmado'
BEGIN
  SELECT RAISE(ABORT, 'pago_confirmado_no_cambia');
END;
