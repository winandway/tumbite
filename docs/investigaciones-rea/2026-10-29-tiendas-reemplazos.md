# Tiendas: reemplazos propuestos por la tienda (29 oct 2026) — todos los países

## Referencias

Instacart (reemplazos del comprador) y DoorDash (Shop & Deliver, pedidos de mercado).

## Evidencia y límites

- [REA] Captura como visitante del centro de ayuda de DoorDash («DoorDash Grocery Orders») y de la página de Instacart para compradores («Providing a more straightforward replacements experience»). Paquete: `evidencia-rea-2026-10-29-tiendas-reemplazos.json` (evidencia `ev_350bd5f986860be35f4cd50fab6fe87b3bf72d4983078a41b891d5f5d8ab59bb`, escenario `71ef4a036dc6bcb7f943a6336eab9e95cc634e2ea4060666f7a8806d37361d42`).
- [REA/DOC] Instacart: el comprador escanea hasta tres opciones; «with a simple tap, customers can easily approve the replacement or refund». Por defecto, «Best Match»: el comprador elige.
- [DOC] DoorDash: si el cliente ya aprobó un sustituto, aparece al tocar «Item unavailable»; si no, el Dasher ofrece opciones y, sin respuesta, reembolsa.
- [NV] Reglas internas de precio de los grandes. Decisión propia, ya vigente en Divoox: nunca se cobra más que el original.
- No se analizaron sus apps (de terceros): solo páginas públicas como visitante.

## Comparación con Divoox (antes de este trabajo)

| Pieza                                  | Grandes                  | Divoox antes                | Divoox ahora                        |
| -------------------------------------- | ------------------------ | --------------------------- | ----------------------------------- |
| Preferencia por producto               | Sí                       | Sí                          | Sí                                  |
| La tienda propone reemplazos concretos | Sí (hasta 3, escaneados) | No                          | Sí, hasta 3 de su catálogo          |
| El cliente aprueba con un toque        | Sí                       | No (solo quitar o cancelar) | Sí                                  |
| «Uno parecido» lo elige la tienda      | Sí («Best Match»)        | Se reembolsaba              | Va el primero propuesto             |
| Precio del reemplazo                   | [NV]                     | —                           | El menor entre original y reemplazo |

## Brechas que quedan (en orden)

1. Foto del producto propuesto en la propuesta (hoy nombre y precio).
2. Chat de reemplazos con foto durante la compra (el chat del pedido ya existe).
3. Límites de horario para licores por estado (DoorDash: el comercio solo manda pedidos de alcohol en horas legales). Necesita las horas de cada estado: va con el país que elija Richard.

## Decisión

Candado C-TIENDAS-REEMPLAZOS: `POST /datos/restaurante/pedidos/:id/falta` acepta `propuestas` (hasta 3, del catálogo de la tienda, disponibles); `POST /datos/pedidos/:id/ajuste` acepta `reemplazar` con `platoId`. Panel, app del restaurante, app del cliente y Docs.
