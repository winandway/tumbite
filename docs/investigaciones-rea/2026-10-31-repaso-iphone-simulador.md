# Repaso de las apps nativas de iPhone en el simulador (31 oct 2026) — EE. UU., Michigan

**Cómo:** las tres apps compiladas para el simulador (`scripts/tiendas/simulador-ios.sh`) contra el
sitio de pruebas, con el simulador en Walled Lake, Michigan. Restaurante Pizzería Demo Novi
(`scripts/staging/armar-restaurante-novi.mjs`), panel del restaurante en el navegador, tarjeta de prueba 4242. Evidencia: capturas del simulador en esta sesión [OBS sobre nuestra propia app].

## Circuito completo: funciona

Entrar (cliente y repartidor) → Comida → Pizzería Demo Novi → carrito → dirección llenada sola en
Walled Lake → hoja de pago de Stripe en modo prueba → «¡Pedido realizado!» → el panel suena y acepta →
la oferta llega al Driver con ganancia, propina y distancias → aceptar → «Llegué al restaurante» →
listo → verificar el número del pedido → recogida → el cliente ve «En camino» con el mapa y la hora →
entrega con la ubicación confirmada en la puerta → «¡Pedido entregado!» con la foto → calificación.

## Fallos encontrados y arreglados (cada uno con su prueba en rojo y su candado)

| #   | Qué se veía                                                                                           | Arreglo                                                                                  | Candado                    |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| 1   | La hoja de pago no abría: «merchantIdentifier is required» (también en la versión que revisaba Apple) | Apple Pay solo con identificador de comercio; certificado de Apple Pay cargado en Stripe | C-PAGO-APPLE-PAY           |
| 2   | El carrito decía dos veces «Dirección de entrega» y el mapa no seguía a la dirección                  | «Calle y número»; el mapa se mueve y llena la casilla vacía                              | C-CARRITO-UNA-DIRECCION    |
| 3   | La casilla de correo corregía y subrayaba lo escrito                                                  | Sin corrector en toda casilla de correo                                                  | C-CORREO-SIN-AUTOCORRECTOR |
| 4   | «Abre mañana a las 12:00» de un restaurante abierto todo el día pero sin panel                        | «No recibe pedidos ahora»; el texto ya no se corta                                       | C-NO-RECIBE-AHORA          |
| 5   | El panel del restaurante en «/panel/» mostraba «Esta sección llega en el siguiente paso»              | La dirección se lee sin la barra final                                                   | C-RUTA-SIN-BARRA           |
| 6   | El recorrido automático del sitio de pruebas canceló un pedido manual y desconectó al repartidor      | Sus limpiezas solo tocan lo suyo y Miami                                                 | C-RECORRIDO-NO-PISA        |
| 7   | Distancias en kilómetros en EE. UU. (en español)                                                      | Millas o kilómetros según el país del servicio                                           | C-DISTANCIA-POR-PAIS       |
| 8   | El mapa del Driver sin pedido se quedaba en Miami                                                     | Va a la ubicación del repartidor                                                         | C-MAPA-SIGUE-AL-REPARTIDOR |
| 9   | «Pedir otra vez» llenaba el carrito y a los 5 segundos quedaba vacío                                  | La pantalla del pedido vacía el carrito una sola vez, recién pagado                      | C-CARRITO-NO-SE-BORRA-SOLO |
| 10  | «1 abiertos ahora»                                                                                    | Singular                                                                                 | —                          |

## Notas sin arreglo en código

- **La hoja de pago ofrece Klarna, Cash App, Amazon Pay y débito bancario.** Salen de los métodos
  encendidos en Stripe. DoorDash y Uber Eats no aceptan débito bancario para comida (se confirma días
  después de entregar). Decisión de Richard: apagar «Banco» (y lo que no quiera) en Stripe.
- **Stripe pide «Verifica las solicitudes de creación de cuentas conectadas»** (vencido el 27 oct);
  hoy solo pausó pagos con Cartes Bancaires. Lo completa Richard en Stripe.
- **Simulador sin cámara:** «Tomar foto del pedido» cierra la app en el simulador (iOS lanza un error
  al pedir una cámara que no existe). En un iPhone real hay cámara; la foto se probó por el servidor.
- **El simulador pierde letras al escribir muy rápido** (más de cien por segundo); una persona no.
- **Ícono de comida por defecto:** la pizzería sin foto muestra una hamburguesa en el Driver.
- **El nombre de la app de restaurantes en la pantalla de inicio sale «DivooxRest…»** (sin espacio).
