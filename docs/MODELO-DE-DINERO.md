# Modelo de dinero: punto de equilibrio desde el primer pedido

Aplicado el 13 oct 2026 por pedido de Richard («punto de equilibrio económico donde ganamos, todo el mundo gana y competimos a la vez»). Calculado con la misma calculadora de la app (`packages/compartido/src/bolsillos.ts`). Candado: `packages/compartido/src/equilibrio.test.ts` (C-EQUILIBRIO).

## Lo que quedó aplicado

| Concepto                  | Antes                                         | Ahora                                                    |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Envío (cliente)           | desde 2,99                                    | **desde 3,99** (+0,50 por km después de 3 km, tope 7,99) |
| Servicio (cliente)        | 5 %, mínimo 0,99, máximo 4,99                 | 5 %, **mínimo 1,99**, máximo 4,99                        |
| Pedido pequeño (cliente)  | 2,00 bajo 10 dólares                          | igual                                                    |
| Comisión al restaurante   | 7,5 % / 12,5 % / 15 %                         | igual                                                    |
| Pago mínimo al repartidor | 5,00 por entrega, propina aparte y 100 % suya | igual                                                    |

Cómo llegó a producción: son los nuevos valores de fábrica, y una actualización segura al arrancar el servidor pasa la configuración guardada a estos valores **solo si era exactamente la de fábrica anterior** (si alguien la cambió a mano en el superadmin, se respeta). Se cambian cuando se quiera desde el superadmin, sección Dinero, sin publicar.

## La competencia (fuentes oficiales, consultadas el 13 oct 2026)

|                                     | Tumbite                                       | DoorDash                                                                     | Uber Eats                                                             |
| ----------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Comisión al restaurante (domicilio) | 7,5 / 12,5 / 15 %                             | 15 / 25 / 30 % (Basic, Plus, Premier)                                        | 20 / 25 / 30 % (Lite —desde 15 % en algunas ciudades—, Plus, Premium) |
| Comisión por recoger en el local    | todavía no hay recogida                       | 6 %                                                                          | 7 % (10 % sin precios del local validados)                            |
| Servicio al cliente                 | 5 %, mín. 1,99, máx. 4,99                     | 15 % del pedido en varias ciudades; variable en el resto; puede haber mínimo | porcentaje del pedido con mínimo y máximo según la región             |
| Envío al cliente                    | desde 3,99 según distancia                    | fijo por pedido, varía por restaurante                                       | dinámico, según zona y repartidores                                   |
| Pedido pequeño                      | 2,00 bajo 10 dólares                          | «puede cobrarse» bajo cierto monto (sin cifra oficial)                       | varía por ciudad                                                      |
| Repartidor                          | mínimo 5,00 por entrega + 100 % de la propina | pago base de 2 a más de 10 por oferta + 100 % de la propina                  | (no consultado)                                                       |

**Grubhub:** no publica una página oficial de precios legible; las fuentes de terceros no coinciden (marketing del 5 al 20 % más cerca del 10 % por usar sus repartidores). Queda fuera de la comparación pública hasta tener un dato oficial.

## Cuánto gana cada uno, con los precios nuevos

Restando a Tumbite el cobro de la tarjeta de Stripe (2,9 % + 30 centavos).

| Pedido                                     | Plan    | Cliente paga | Restaurante | Repartidor | **Tumbite neto** |
| ------------------------------------------ | ------- | ------------ | ----------- | ---------- | ---------------- |
| Prueba: comida 18,50, 2 km, propina 20 %   | Inicial | 28,18        | 17,11       | 8,70       | **1,25**         |
|                                            | Crece   | 28,18        | 16,19       | 8,70       | **2,17**         |
| Chico: comida 8,00, 2 km, propina 15 %     | Inicial | 17,18        | 7,40        | 6,20       | **2,78**         |
| Mediano: comida 30,00, 5 km, propina 20 %  | Inicial | 42,98        | 27,75       | 11,00      | **2,68**         |
| Familiar: comida 60,00, 4 km, propina 15 % | Inicial | 76,49        | 55,50       | 14,00      | **4,47**         |

Con los precios anteriores, el pedido de la prueba dejaba a Tumbite en **−0,69** y 307 combinaciones de pedido (de 10 a 150 dólares, cualquier distancia y propina, los tres planes) quedaban en pérdida. Con los nuevos, **ninguna**: lo comprueba el candado en cada publicación.

**Todos ganan:** el restaurante se queda con más que en DoorDash o Uber Eats (en 30 dólares: 27,75 frente a 25,50 o 24,00); el repartidor tiene un mínimo de 5 dólares y la propina entera; el cliente paga un servicio del 5 % (con mínimo de 1,99) frente al 15 % que DoorDash publica en varias ciudades.

## Costos de pagarles a todos (Stripe Connect, «tú manejas los precios»)

- 2 dólares al mes por cada cuenta que recibe dinero ese mes. Con 20 restaurantes y 40 repartidores activos: unos 120 dólares al mes.
- 0,25 % + 25 centavos por retiro. Hoy se puede retirar desde 1 dólar: un retiro de 1 dólar le cuesta a Tumbite 25 centavos.
- **Pendiente de Richard:** retiro mínimo (recomendado 10 dólares) o un retiro gratis por semana.

## Fuentes

- Stripe, precios: https://stripe.com/pricing — Connect: https://stripe.com/connect/pricing
- DoorDash para restaurantes: https://merchants.doordash.com/en-us/pricing
- DoorDash, tarifas al cliente: https://help.doordash.com/en-us/consumers/article/what-fees-do-i-pay
- DoorDash, pago a repartidores: https://dasher.doordash.com/en-us/about/pay
- Uber Eats para restaurantes: https://merchants.ubereats.com/us/en/pricing/
- Uber Eats, tarifas al cliente: https://help.uber.com/ubereats/restaurants/article/what-fees-might-my-order-include?nodeId=2d43ee3b-6c5f-4501-a28d-6cc229428efb
