/**
 * C-CUENTA-UNICA (24 nov 2026, Richard; todos los países). Frenos de la base para el día en que una
 * misma persona tenga los dos papeles (cliente y conductor) en una sola cuenta:
 *
 * - Nadie recibe la oferta de su propio pedido, viaje, envío o encargo (la fila de la oferta no se
 *   crea: RAISE(IGNORE), así el reparto sigue con el siguiente conductor sin error).
 * - Nadie queda asignado a lo suyo (pedido u operación): la base lo rechaza.
 * - Nadie se califica a sí mismo ni es su propio conductor de confianza.
 * - Un conductor con el papel suspendido no se conecta.
 *
 * Hoy ninguna cuenta tiene los dos papeles, así que nada de esto cambia lo que pasa: protege el día
 * en que exista. Cada disparador lee una sola fila por su clave (sin recorrer tablas).
 */
export const ESQUEMA_CUENTA_UNICA: readonly string[] = [
  `CREATE TRIGGER IF NOT EXISTS cu_oferta_pedido_no_propia BEFORE INSERT ON ofertas
     WHEN NEW.repartidor_id = (SELECT cliente_id FROM pedidos WHERE id = NEW.pedido_id)
   BEGIN SELECT RAISE(IGNORE); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_oferta_operacion_no_propia BEFORE INSERT ON ofertas_operacion
     WHEN NEW.conductor_id = (SELECT cliente_id FROM operaciones WHERE id = NEW.operacion_id)
   BEGIN SELECT RAISE(IGNORE); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_pedido_no_propio BEFORE UPDATE OF repartidor_id ON pedidos
     WHEN NEW.repartidor_id IS NOT NULL AND NEW.repartidor_id = NEW.cliente_id
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: nadie lleva su propio pedido'); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_operacion_no_propia BEFORE UPDATE OF conductor_id ON operaciones
     WHEN NEW.conductor_id IS NOT NULL AND NEW.conductor_id = NEW.cliente_id
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: nadie lleva su propio viaje'); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_operacion_nueva_no_propia BEFORE INSERT ON operaciones
     WHEN NEW.conductor_id IS NOT NULL AND NEW.conductor_id = NEW.cliente_id
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: nadie lleva su propio viaje'); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_calificacion_viaje_no_propia BEFORE INSERT ON calificaciones_viaje
     WHEN (SELECT conductor_id = cliente_id FROM operaciones WHERE id = NEW.operacion_id)
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: nadie se califica a sí mismo'); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_calificacion_cliente_no_propia BEFORE INSERT ON calificaciones_cliente
     WHEN NEW.repartidor_id = NEW.cliente_id
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: nadie se califica a sí mismo'); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_confianza_no_propia BEFORE INSERT ON conductores_confianza
     WHEN NEW.cliente_id = NEW.conductor_id
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: nadie es su propio conductor de confianza'); END`,
  `CREATE TRIGGER IF NOT EXISTS cu_conectar_papel_suspendido BEFORE UPDATE OF conectado ON repartidores
     WHEN NEW.conectado = 1 AND EXISTS (SELECT 1 FROM usuario_papeles p
       WHERE p.usuario_id = NEW.usuario_id AND p.papel = 'repartidor' AND p.estado = 'suspendido')
   BEGIN SELECT RAISE(ABORT, 'cuenta_unica: el papel de conductor está suspendido'); END`,
];
