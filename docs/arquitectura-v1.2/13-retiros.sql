-- V1.2 · Retiros sin doble pago (diseño; NO cambia el sistema actual todavía).
-- Usa pagos_intentos (V1.1 · 05-pagos.sql) y el libro de partida doble (V1.1 · 06-libro.sql).
CREATE TRIGGER IF NOT EXISTS retiro_descuenta_saldo
AFTER INSERT ON pagos_intentos
WHEN NEW.accion = 'transferir' AND NEW.ambito = 'retiro'
BEGIN
  INSERT INTO asientos (id, clave_evento, tipo, intento_id, descripcion)
  VALUES ('a-' || NEW.id, 'intento:' || NEW.id || ':retiro', 'retiro', NEW.id, 'Retiro solicitado');
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('a-' || NEW.id, 'billetera', NEW.usuario_id, -NEW.monto_centavos);
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('a-' || NEW.id, 'stripe_transferido', NULL, NEW.monto_centavos);
  UPDATE asientos SET estado = 'cerrado' WHERE id = 'a-' || NEW.id;
END;

-- Solo un fallo DEFINITIVO de Stripe devuelve el saldo, y una sola vez (clave única del asiento).
CREATE TRIGGER IF NOT EXISTS retiro_fallido_devuelve
AFTER UPDATE OF estado ON pagos_intentos
WHEN NEW.estado = 'fallido' AND OLD.estado <> 'fallido' AND NEW.accion = 'transferir' AND NEW.ambito = 'retiro'
BEGIN
  INSERT INTO asientos (id, clave_evento, tipo, intento_id, reverso_de, descripcion)
  VALUES ('r-' || NEW.id, 'intento:' || NEW.id || ':revertido', 'retiro_revertido', NEW.id, NULL, 'Retiro rechazado por Stripe: el saldo vuelve');
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('r-' || NEW.id, 'billetera', NEW.usuario_id, NEW.monto_centavos);
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('r-' || NEW.id, 'stripe_transferido', NULL, -NEW.monto_centavos);
  UPDATE asientos SET estado = 'cerrado' WHERE id = 'r-' || NEW.id;
END;
-- (Un intento confirmado no vuelve atrás: lo garantiza pagos_confirmado_es_final de V1.1.)
