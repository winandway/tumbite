# Costo del mapa en vivo y de la hora de llegada (C-RASTREO-VIVO, C-HORA-LLEGADA)

16 nov 2026. Todos los países. Regla «la nube no se come el dinero».

## Precios vigentes de Google Maps Platform

Leídos el 16 nov 2026 en la página oficial de precios (https://developers.google.com/maps/billing-and-pricing/pricing) y en la de detalle de SKU de Routes (https://developers.google.com/maps/billing-and-pricing/sku-details/routes). La página no muestra fecha de vigencia.

| SKU                                                        | Gratis por mes | Precio cada 1.000 (hasta 100.000) |
| ---------------------------------------------------------- | -------------- | --------------------------------- |
| Routes · Compute Routes Essentials (sin tráfico)           | 10.000         | 5 USD                             |
| Routes · Compute Routes Pro (con tráfico: `TRAFFIC_AWARE`) | 5.000          | 10 USD                            |
| Maps JavaScript API · Dynamic Maps (carga de mapa)         | 10.000         | 7 USD                             |

Qué hace que una consulta sea «Pro»: `routingPreference` `TRAFFIC_AWARE` o `TRAFFIC_AWARE_OPTIMAL`, de 11 a 25 paradas intermedias, `optimizeWaypointOrder` o modificadores de lugar (lado de la calle, rumbo). Pedir la línea de la ruta (`polyline`) o los tramos (`legs`) en la máscara no figura como disparador. La hora de llegada usa `TRAFFIC_AWARE` a propósito: es la hora real con tráfico.

## Cuántas consultas hace un pedido

La llegada se calcula SOLO con una ubicación nueva del repartidor (nunca por mirar), como mucho cada 90 segundos por pedido, de inmediato al cambiar de tramo, y si no se movió 150 m, cada 5 minutos.

Pedido típico de unos 30 minutos con repartidor:

- Ida al restaurante, unos 8 minutos manejando: 1 al empezar el tramo + 5 cada 90 s = 6.
- Espera en el restaurante, unos 5 minutos quieto: 1 al llegar + 1 a los 5 minutos = 2.
- Entrega, unos 15 minutos manejando: 1 al recoger + 10 cada 90 s = 11.

Total: unas 19 consultas por pedido. Viaje de unos 20 minutos (6 a la recogida, 1 esperando, 9 a 10 en el viaje): unas 16.

## Costo por cada 1.000 pedidos

- **Hora de llegada con tráfico:** 1.000 × 19 = 19.000 consultas «Pro». Pasadas las 5.000 gratis del mes: 19 × 10 USD = **190 USD cada 1.000 pedidos (0,19 USD por pedido)**.
- **Mapa de la ficha:** una carga cada vez que alguien del equipo abre la ficha de un pedido en curso (los cerrados siguen con el botón «Ver en el mapa»). Si se abre la ficha de 1 de cada 5 pedidos: 200 cargas = **1,40 USD cada 1.000 pedidos** pasadas las 10.000 gratis del mes.
- **La consulta de posición cada 5 segundos:** solo lectura por llave en nuestra base (unas 8 filas por consulta; una ficha abierta 10 minutos lee unas 1.000 filas). Cero escrituras. Costo despreciable.

## Topes en código (lo que se gasta hoy)

- `TOPE_LLEGADA_DIA` = 160 cálculos con tráfico por día y por sitio: 160 × 31 = 4.960 al mes, dentro de las 5.000 gratis. **Costo con el tope de fábrica: 0 USD.** Pasado el tope, la hora se calcula con la fórmula de siempre (sin error para nadie), el canario `/datos/salud` pone la pieza `llegada` en `tope` y se manda un correo al equipo una vez al día.
- La cuota «Map loads per day» de Maps JavaScript API en Google Cloud (`TOPE_CARGAS_MAPA_DIA` = 320, ya existente) sigue mandando sobre los mapas.

Para dar la hora con tráfico a todos los pedidos hay que subir `TOPE_LLEGADA_DIA` (variable del sitio en YaDominios Cloud). Es una decisión de dinero: cada 1.000 cálculos de más son unos 10 USD.

## Qué no se toca

- No calcular por cada persona que mira ni en cada movimiento: una fila por pedido (`llegadas_estimadas`) que leen la ficha y el cliente.
- No bajar el intervalo de 90 s sin rehacer estas cuentas.
- La línea de la ruta solo se dibuja sobre el mapa de Google y se borra con la fila a las 24 horas.
