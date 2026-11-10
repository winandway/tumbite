# Lo que falta para lanzar Divoox en producción (10 nov 2026)

Lista pedida por Richard el 10 nov 2026. Sale de FILA.md, PENDIENTES.md, VERIFICAR-PAGOS.md y la prueba de las tres apps del 8 nov.
Leyenda: **IA** = lo hace la IA sin esperar a nadie · **Richard** = solo él puede · **Tercero** = espera a Google, Apple, Stripe o Twilio.

## A. Lo que bloquea el lanzamiento

| #   | Qué falta                                                                                                                                                                          | Quién                                   | Países  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------- |
| A1  | Prueba completa de un pedido de comida con las tres apps nativas en Android (cliente, restaurante, repartidor) con tarjeta de prueba. Descargas en divoox-progreso.sitios.dev/apps | Richard prueba, IA arregla lo que salga | Todos   |
| A2  | Circuito de pagos probado de punta a punta en el sitio de pruebas (cobro, cobro al entregar, reembolso, pago al restaurante y al repartidor) y anotado en VERIFICAR-PAGOS.md       | IA, con Stripe de prueba                | EE. UU. |
| A3  | Stripe: confirmar las cuentas, activar Connect y poner el nombre «Divoox» en el tablero                                                                                            | Richard                                 | EE. UU. |
| A4  | Twilio: verificación del número gratuito reenviada el 9 nov con la casilla de consentimiento; esperar aprobación                                                                   | Tercero (Twilio)                        | EE. UU. |
| A5  | Google Play: que aprueben la revisión en curso de las tres apps; después subir todo lo acumulado en una sola versión                                                               | Tercero, luego IA                       | Todos   |
| A6  | Apple: revisión de la app del cliente (compilación 30 congelada); Driver y Restaurants después                                                                                     | Tercero                                 | Todos   |
| A7  | Reloj de producción: GitHub deja huecos de horas; encender el reloj de Cloudflare en producción (pedidos abandonados, recordatorios, cobros al entregar)                           | Richard dice sí, IA lo hace             | Todos   |
| A8  | Accesos de revisión de Google: abrir la sesión de administrador una vez para preparar las tres cuentas de revisión                                                                 | Richard (una vez)                       | Todos   |

## B. Disponible en todo el mundo (pedido de Richard del 10 nov)

| #   | Qué falta                                                                                                                                                                                                                                                                 | Quién                                         | Países        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------- |
| B1  | Las tres apps disponibles en todos los países en Google Play y en el App Store (hoy solo EE. UU.). Se cambia apenas Google apruebe la revisión en curso, para no reiniciarla; en Apple, con la próxima versión                                                            | IA (con el auditor de tiendas)                | Todos         |
| B2  | Dentro de la app, al crear la cuenta o poner la dirección: decir en qué países y ciudades ya funciona, y si el suyo todavía no, ofrecer «Avísame cuando llegue» y, a los restaurantes, «Quiero traer Divoox a mi ciudad»                                                  | IA                                            | Todos         |
| B3  | Modo «flota propia» para un restaurante grande (caso Chile: un local con 14 repartidores propios y muchos clientes): sus repartidores reciben solo sus pedidos, con la app Driver. Primero la ficha REA de cómo lo hacen los grandes (DoorDash Drive, Uber Direct, Rappi) | IA                                            | Chile y todos |
| B4  | Perfil de país de Chile: moneda CLP, cómo se cobra allí y qué documentos se piden. Se estudia con REA el software más usado en Chile                                                                                                                                      | IA (estudio), Richard (cuenta de cobro local) | Chile         |

## C. Funciones que esperan una decisión de dinero o legal de Richard

| #   | Qué falta                                                                         | Quién             |
| --- | --------------------------------------------------------------------------------- | ----------------- |
| C1  | Suscripción tipo DashPass: precio y beneficios                                    | Richard           |
| C2  | Impuesto de ventas por condado y con promociones                                  | Contador          |
| C3  | Tarjetas de regalo y regalar un pedido                                            | Richard           |
| C4  | Ganar por tiempo: pago por minuto y por milla                                     | Richard           |
| C5  | Anuncios pagados de restaurantes: precio                                          | Richard           |
| C6  | Divoox Rewards fase 3: presupuesto por ciudad                                     | Richard           |
| C7  | Moto y Carro con pasajeros: aprobación legal y seguro                             | Richard y abogado |
| C8  | Comparación de caras con IA: proveedor, costo y consentimiento                    | Richard y abogado |
| C9  | Varios locales en una sola cuenta: cambiar la tabla de restaurantes en producción | Richard dice sí   |
| C10 | Mapa moderno en la web con Google Maps: tope de gasto                             | Richard dice sí   |
| C11 | Traducción automática de instrucciones: proveedor de IA y tope                    | Richard           |

## D. Lo que la IA hace sin esperar a nadie

| #   | Qué falta                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| D1  | El restaurante no puede cancelar un pedido ya «listo»: copiar cómo lo resuelven DoorDash y Uber (pasa por soporte, con motivo) |
| D2  | Elegir la app de mapas (Google Maps, Waze, Apple Maps) en la comida, como ya existe en Flex                                    |
| D3  | Sonido de la oferta con la app nativa abierta (entra en la próxima compilación)                                                |
| D4  | GPS en segundo plano en Driver durante un pedido (después de la aprobación de Google, con su declaración y video)              |
| D5  | Revisión de calidad de la comanda e impresora (pendiente en la fila)                                                           |
| D6  | Rediseño del panel con shadcn para que se vea como los grandes (espera el sí de Richard)                                       |
| D7  | Correo de contacto de las fichas de las tiendas al buzón de soporte de cada app (después de las revisiones)                    |
| D8  | Las casillas de subir imagen con «Tomar foto» (regla nueva del 9 nov), con su candado                                          |
