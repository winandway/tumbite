-- Cierre del pedido de prueba del 12 oct 2026 (7,18 USD, «Restaurante el Beef USA").
-- PREPARADO, NO EJECUTADO. Solo con la autorización explícita de Richard y DESPUÉS de que el pago
-- pi_3UPZrOLDByFATg8R2eLasrcQ figure «Reembolsado» en Stripe.
-- Dos sentencias, cada una condicionada: si el pedido ya no está en «listo» o tiene repartidor,
-- no cambian nada.

-- 1) El pedido pasa a «cancelado».
UPDATE pedidos SET estado = 'cancelado', cancelado_en = datetime('now')
 WHERE id = '95fce528-11b2-427e-946a-b4f8a7fd0033' AND estado = 'listo' AND repartidor_id IS NULL;

-- 2) Queda en su historial (actor: nuestro equipo, sin usuario).
INSERT INTO historial_estados (pedido_id, estado, actor_id)
SELECT '95fce528-11b2-427e-946a-b4f8a7fd0033', 'cancelado', NULL
 WHERE EXISTS (SELECT 1 FROM pedidos WHERE id = '95fce528-11b2-427e-946a-b4f8a7fd0033' AND estado = 'cancelado')
   AND NOT EXISTS (SELECT 1 FROM historial_estados WHERE pedido_id = '95fce528-11b2-427e-946a-b4f8a7fd0033' AND estado = 'cancelado');

-- Comprobación (solo lectura): debe decir «cancelado» y 0 pedidos activos.
SELECT estado, cancelado_en FROM pedidos WHERE id = '95fce528-11b2-427e-946a-b4f8a7fd0033';
SELECT COUNT(*) AS activos FROM pedidos WHERE estado IN ('pagado', 'aceptado', 'listo', 'en_camino');
