# Comida en Venezuela: moneda, tarifas y comisión (13 nov 2026) — Venezuela

Pedido de Richard (13 nov 2026): dejar la comida lista para probar en El Vigía, estado Mérida, en el
modelo prepago (el cliente paga al recibir, en efectivo o pago móvil; la comisión sale del saldo
prepago del repartidor).

## Lo que hace el mercado

| Hallazgo                                                                                                        | Etiqueta          | Fuente                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| Yummy, PedidosYa y Ridery muestran el precio en dólares con su equivalente en bolívares a la tasa del día       | [OBS]             | Uso público de las apps; ficha de Moto `2026-11-13-moto-venezuela-tarifas.md` |
| El envío de PedidosYa Venezuela se calcula con la ubicación exacta del usuario (distancia y tiempo)             | [DOC]             | Entrevista a su director en Venezuela, DPL News                               |
| El envío de Yummy se calcula por distancia y su cargo de servicio era un porcentaje de la compra, cerca del 4 % | [DOC] (sin fecha) | Finanzas Digital, «Yummy: divide y vencerás»                                  |
| Yummy ha hecho promociones de envío en 0 y servicio en 0 %                                                      | [DOC] (sin fecha) | Perfil público de una gerente de Yummy                                        |
| Ninguna de las dos publica una tabla oficial de tarifas, comisiones al restaurante ni propinas sugeridas        | [NV]              | Búsqueda del 13 nov 2026                                                      |

## Decisión (valores de partida, editables desde el panel)

Todo en centavos de dólar, en `TARIFAS_COMIDA_VENEZUELA` (`packages/compartido/src/comidaVenezuela.ts`):

- Envío: 1,50 hasta 3 km, 0,30 por km extra, tope 4,00 (por distancia, como el mercado [DOC]; cifra [INF]).
- Cargo de servicio: 5 % con piso 0,25 y techo 1,50 (cerca del 4 % de Yummy [DOC]).
- Pedido pequeño: menos de 5,00 suma 0,50 [INF].
- Comisión al restaurante por la venta: 15 % / 18 % / 20 % según el plan [INF], la retiene el repartidor al pagar en el local (paga `pago_restaurante`, no el ticket entero).
- Pago mínimo al repartidor por pedido: 1,00 [INF].
- Propinas sugeridas: 0, 5, 10 y 15 % [INF] (en la región se deja menos propina que en EE. UU.).
- Equivalente en bolívares: la tasa que el equipo escribe a mano en el panel (C-BS-REFERENCIA), solo informativa, en el carrito, el detalle del pedido y lo que cobra el repartidor.

## Quién paga qué comisión (modelo de cobro en mano)

- El cliente le paga todo al repartidor (efectivo o pago móvil).
- El repartidor paga en el local lo que le toca al restaurante (`pago_restaurante` = comida menos la comisión del restaurante).
- Divoox cobra su parte (la ganancia del desglose: comisión del restaurante, cargo de servicio, pedido pequeño y lo que queda del envío) del saldo prepago del repartidor: se aparta al aceptar, se cobra una sola vez al conciliar la entrega y vuelve al saldo si se cancela. Es la MISMA billetera (bolsillo `prepago` del libro) y la MISMA capa de políticas (`comisionFood` consulta `politicas_financieras`; sin política de comida aprobada manda la comisión del país, C-FOOD-POLITICAS) que los viajes.
- Por eso no se crea una política nueva de comida en Venezuela: la comisión del país ya refleja el desglose. Si algún día se crea una, tiene que estar en la moneda de las ciudades (C-COMIDA-VENEZUELA lo exige y el canario lo vigila).

## Límites

Sin datos verificables de tarifas oficiales; ninguna compra en apps de terceros, ninguna cuenta. Las cifras se revisan con los primeros pedidos reales en El Vigía.
