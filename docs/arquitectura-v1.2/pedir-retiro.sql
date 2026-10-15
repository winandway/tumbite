-- Pedir el retiro = UNA sentencia: crea el intento SOLO si hay saldo; un disparador descuenta el
-- saldo en el libro en esa misma sentencia. Nada de Stripe todavía.
-- ?1 id del intento · ?2 persona · ?3 monto en centavos
-- (La clave de idempotencia y el transfer_group en Stripe son la misma: 'retiro:<id>'.)
INSERT INTO pagos_intentos (id, clave_idempotencia, ambito, usuario_id, accion, monto_centavos)
SELECT ?1, 'retiro:' || ?1, 'retiro', ?2, 'transferir', ?3
 WHERE ?3 >= 100
   AND COALESCE((SELECT saldo FROM saldos_billetera WHERE usuario_id = ?2), 0) >= ?3
   AND EXISTS (SELECT 1 FROM cuentas_stripe WHERE usuario_id = ?2 AND pagos_activos = 1);
