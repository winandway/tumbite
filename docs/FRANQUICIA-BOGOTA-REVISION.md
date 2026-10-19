# Revisión de la propuesta de franquicia de Bogotá (19 oct 2026)

El PDF `docs/Propuesta-franquicia-Tumbite-Bogota.pdf` queda como **borrador para Richard**: lleva en la portada «Borrador para revisión de Richard · cifras propuestas, no definitivas». **No se envía al doctor Niño hasta que Richard apruebe las cifras.**

## Lo que dice la propuesta frente a lo que el sistema hace hoy

| La propuesta dice                                                       | En el sistema hoy                                                                                                     | Acción                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Cuota de 120.000 USD por toda Bogotá, 10 años, exclusividad             | Las condiciones de cada franquicia se guardan (`condiciones_json`) pero ninguna cuenta de dinero las usa              | Cifra propuesta: decide Richard                           |
| Reparto del margen 75 % franquiciado / 25 % Tumbite, liquidado cada mes | **No implementado**: no hay liquidación automática por franquicia                                                     | Página nueva «lo que falta»: se automatiza antes de abrir |
| Comisión de cerca del 15 % al restaurante                               | En EE. UU. los planes son 7,5 / 12,5 / 15 %; en cobro directo la comisión es por país y configurable                  | Se carga en el panel de Países (decisión 9)               |
| 0 % de comisión los tres primeros meses                                 | **No hay promoción automática por fechas**; se puede hacer a mano con el plan                                         | Página «lo que falta»                                     |
| Tablets para 1.000 restaurantes, 50 motos                               | Es compra del franquiciado, no del sistema                                                                            | Sin cambio                                                |
| Tarjeta, PSE y Nequi                                                    | Stripe no ofrece PSE ni Nequi; la pasarela local no está conectada (B.7)                                              | Página «lo que falta»                                     |
| Montos en pesos                                                         | La tarifa del sistema es en dólares; el formato en pesos está listo (C-MONEDA-LOCAL) pero faltan las tarifas por país | Página «lo que falta»                                     |
| Capturas de las apps                                                    | Son capturas reales del recorrido (versión de Miami, en dólares)                                                      | Lo dice el propio PDF                                     |
| Proyecciones: recuperación hacia el mes 31 en el escenario base         | Modelo en `docs/pdf/modelo-franquicia-bogota.py`, supuestos escritos                                                  | Son proyecciones, no promesas (lo dice el PDF)            |

## Lo que tiene que decidir Richard antes de enviarlo

1. La cuota (propuesta: 120.000 USD) y si se cobra en dos pagos.
2. El reparto (propuesto: 75 / 25 del margen) y si Tumbite pide además una participación en la empresa local (propuesto: no).
3. El tamaño del lanzamiento que se presenta (propuesto: 2,59 millones de USD en seis meses, con las compuertas por metas).
4. A quién va dirigido y con qué nombre (hoy: «el Dr. Niño y sus socios»).
