/**
 * C-AGENTE-DIVOOX (18 nov 2026): los disparadores que mueven el dinero del Agente Divoox. Los crea
 * esquema.ts al arrancar (todos idempotentes), igual que los de la Fase 3: no van en schema.sql
 * porque el divisor de sentencias de la plataforma corta mal los disparadores.
 *
 * Con ellos cada operación es UNA sentencia: pedir el código aparta las ganancias, vencer o cancelar
 * las devuelve una sola vez (ids fijos), pagar baja el fondo del agente, y vender saldo acredita al
 * conductor y sube la deuda del agente. Si falta uno, la pieza «agentes» de la salud se pone en rojo.
 */
export const ESQUEMA_AGENTES: readonly string[] = [
  // Apartar: al nacer el cobro, el monto sale de las ganancias en la misma sentencia.
  `CREATE TRIGGER IF NOT EXISTS cobros_efectivo_aparta
AFTER INSERT ON cobros_efectivo
BEGIN
  INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
  VALUES ('mov-cobro-' || NEW.id, NEW.conductor_id, -NEW.monto, 'retiro', 'cobro-efectivo:' || NEW.id);
END`,
  // Un cobro cerrado (pagado, vencido o cancelado) no cambia nunca más.
  `CREATE TRIGGER IF NOT EXISTS cobros_efectivo_transicion
BEFORE UPDATE OF estado ON cobros_efectivo
WHEN NEW.estado <> OLD.estado AND OLD.estado <> 'activo'
BEGIN
  SELECT RAISE(ABORT, 'cobro en efectivo: ya está cerrado');
END`,
  // Vencido o cancelado: el monto vuelve a las ganancias, una sola vez (id fijo).
  // Con el mismo concepto «retiro» (en positivo): así lo «retirado» del día en la conciliación es
  // lo que de verdad salió, sin contar lo que volvió.
  `CREATE TRIGGER IF NOT EXISTS cobros_efectivo_devuelve
AFTER UPDATE OF estado ON cobros_efectivo
WHEN OLD.estado = 'activo' AND NEW.estado IN ('vencido', 'cancelado')
BEGIN
  INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia)
  VALUES ('mov-cobro-dev-' || NEW.id, NEW.conductor_id, NEW.monto, 'retiro', 'cobro-efectivo-devuelto:' || NEW.id);
END`,
  // Pagado: baja el fondo del agente en la misma sentencia (queda en su libro).
  `CREATE TRIGGER IF NOT EXISTS cobros_efectivo_paga
AFTER UPDATE OF estado ON cobros_efectivo
WHEN OLD.estado = 'activo' AND NEW.estado = 'pagado'
BEGIN
  INSERT INTO agente_libro (id, agente_id, cuenta, monto, concepto, referencia)
  VALUES ('al-pago-' || NEW.id, NEW.agente_id, 'fondo', -NEW.monto, 'pago_conductor', 'cobro:' || NEW.id);
END`,
  // La venta acredita el saldo del conductor y sube lo que el agente le debe a Divoox, todo junto.
  `CREATE TRIGGER IF NOT EXISTS ventas_saldo_agente_acredita
AFTER INSERT ON ventas_saldo_agente
BEGIN
  INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia, autor_id)
  VALUES ('lib-venta-agente-' || NEW.id, NEW.conductor_id, 'prepago', NEW.pais, NEW.moneda, NEW.monto,
          'recarga_agente', 'venta-agente:' || NEW.id, 'agente:' || NEW.agente_id);
  INSERT INTO agente_libro (id, agente_id, cuenta, monto, concepto, referencia)
  VALUES ('al-venta-' || NEW.id, NEW.agente_id, 'deuda', NEW.monto, 'venta_saldo', 'venta:' || NEW.id);
END`,
];

export const DISPARADORES_AGENTE = ESQUEMA_AGENTES.map(
  (sql) => /CREATE TRIGGER IF NOT EXISTS (\w+)/.exec(sql)?.[1] ?? '',
);
