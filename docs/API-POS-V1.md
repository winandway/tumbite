# Divoox POS API v1 (29 oct 2026) — todos los países

Para el sistema de punto de venta (caja) de un restaurante. Base: `https://divoox.com/datos/v1/pos`. Cada petición lleva la cabecera `x-api-key` con la llave que el dueño crea en su panel (Mi restaurante → «Conectar tu punto de venta»). Límite: 120 peticiones por minuto por llave. Respuestas en JSON.

| Método | Ruta                    | Qué hace                                                                                                                                                                                                                                                                    |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/pedidos`              | Pedidos vivos del restaurante (pagado, aceptado, listo, en camino): id, status, items (name, nameEs, quantity, options), notes, delivery (`door` o `hand_to_me`), scheduledFor, prepMinutes, createdAt, acceptedAt, readyAt. Sin dirección, teléfono ni dinero del cliente. |
| POST   | `/pedidos/{id}/aceptar` | Cuerpo `{ "prepMinutes": 5-120 }`. Igual que tocar «Aceptar» en el panel.                                                                                                                                                                                                   |
| POST   | `/pedidos/{id}/listo`   | Igual que tocar «Listo» en el panel: avisa al cliente y al repartidor.                                                                                                                                                                                                      |

Errores: 401 sin llave o llave revocada; 409 si el pedido ya cambió de estado; 429 al pasar el límite.
