# Modelo de dinero: cuánto gana cada uno por pedido (para aprobar)

Hecho el 13 oct 2026 con la misma calculadora que usa la app (`packages/compartido/src/bolsillos.ts`) y el costo oficial de Stripe. Todos los montos en dólares. Es una decisión de Richard: aquí van los números y una recomendación.

## Lo que cobra Stripe (fuente oficial, consultada el 13 oct 2026)

- Cada pago con tarjeta en EE.UU.: **2,9 % + 30 centavos** (stripe.com/pricing).
- Pagarles a restaurantes y repartidores (Connect, «tú manejas los precios»): **2 dólares al mes por cada cuenta que recibe dinero ese mes** y **0,25 % + 25 centavos por cada retiro** (stripe.com/connect/pricing).
- Esos costos los paga Tumbite. En la tabla se resta solo el del cobro con tarjeta; los de Connect van aparte, abajo.

## Hoy (valores iniciales: envío desde 2,99, servicio 5 % con mínimo 0,99, repartidor con mínimo garantizado de 5,00)

| Pedido                                     | Plan          | Cliente paga | Restaurante | Repartidor | Tumbite antes de Stripe | Stripe (tarjeta) | **Tumbite neto** |
| ------------------------------------------ | ------------- | ------------ | ----------- | ---------- | ----------------------- | ---------------- | ---------------- |
| Prueba: comida 18,50, 2 km, propina 20 %   | Inicial 7,5 % | 26,18        | 17,11       | 8,70       | 0,37                    | 1,06             | **−0,69**        |
|                                            | Crece 12,5 %  | 26,18        | 16,19       | 8,70       | 1,29                    | 1,06             | **0,23**         |
|                                            | Élite 15 %    | 26,18        | 15,72       | 8,70       | 1,76                    | 1,06             | **0,70**         |
| Chico: comida 8,00, 2 km, propina 15 %     | Inicial       | 15,18        | 7,40        | 6,20       | 1,58                    | 0,74             | **0,84**         |
| Mediano: comida 30,00, 5 km, propina 20 %  | Inicial       | 41,49        | 27,75       | 11,00      | 2,74                    | 1,50             | **1,24**         |
|                                            | Crece         | 41,49        | 26,25       | 11,00      | 4,24                    | 1,50             | **2,74**         |
| Familiar: comida 60,00, 4 km, propina 15 % | Inicial       | 75,49        | 55,50       | 14,00      | 5,99                    | 2,49             | **3,50**         |
|                                            | Crece         | 75,49        | 52,50       | 14,00      | 8,99                    | 2,49             | **6,50**         |

**Lo que dice la tabla:** con el plan Inicial, en un pedido normal de unos 18 dólares de comida, **Tumbite pierde 69 centavos**. La razón: el repartidor tiene un pago mínimo de 5 dólares; el envío que paga el cliente (2,99) no llega, y la diferencia (2,01) la pone Tumbite. Lo que queda de la comisión y el servicio no alcanza para el cobro de Stripe.

## Recomendación: dos ajustes chicos, los dos ya se cambian desde el panel sin publicar

1. **Envío desde 3,99** en vez de 2,99 (DoorDash y Uber Eats cobran entre 0,99 y 5,99 según la distancia y el restaurante).
2. **Servicio con mínimo de 1,99** en vez de 0,99 (se queda el 5 %; en pedidos grandes no cambia nada).

| Pedido                 | Plan    | Cliente paga  | Restaurante | Repartidor | **Tumbite neto** |
| ---------------------- | ------- | ------------- | ----------- | ---------- | ---------------- |
| Prueba: comida 18,50   | Inicial | 28,18 (+2,00) | 17,11       | 8,70       | **1,25**         |
|                        | Crece   | 28,18         | 16,19       | 8,70       | **2,17**         |
| Chico: comida 8,00     | Inicial | 17,18 (+2,00) | 7,40        | 6,20       | **2,78**         |
| Mediano: comida 30,00  | Inicial | 42,98 (+1,49) | 27,75       | 11,00      | **2,68**         |
| Familiar: comida 60,00 | Inicial | 76,49 (+1,00) | 55,50       | 14,00      | **4,47**         |

Al restaurante y al repartidor no se les toca nada: el ajuste lo paga el cliente, y sigue por debajo de lo que cobran los grandes.

## Costos fijos de pagarles a todos (Connect)

- 2 dólares al mes por cada restaurante o repartidor que retire dinero ese mes. Con 20 restaurantes y 40 repartidores activos: unos 120 dólares al mes.
- Por cada retiro, 0,25 % + 25 centavos. Un repartidor que retira 300 dólares: 1 dólar.
- Hoy la app permite retirar desde 1 dólar: muchos retiros chicos suben ese costo. A decidir: retiro mínimo de 10 o 20 dólares, o un retiro gratis por semana.

## Decisiones para Richard

1. Aprobar o cambiar el envío desde 3,99 y el servicio con mínimo de 1,99.
2. Retiro mínimo (hoy 1 dólar).
3. El regalo que cubre todo el plato: ¿se perdona el cargo por pedido pequeño? (anotado en PENDIENTES.md).
