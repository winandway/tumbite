# Prueba de las tres apps — 8 de noviembre de 2026

Prueba real de un pedido de comida con las tres apps en el **sitio de pruebas** (staging), con la tarjeta de prueba de Stripe.

- **Restaurante:** Pizzería Demo Novi, en el panel web, en la computadora.
- **Cliente:** cuenta demo, en el navegador del celular.
- **Repartidor:** cuenta demo, en el navegador de dos teléfonos.
- **Dirección de entrega:** la casa de Richard en Novi, a unos 4 km del restaurante.

## Lo que funcionó

| Paso                                                                         | Resultado                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| El cliente pide y paga con la tarjeta de prueba                              | ✅ Pedido 407F pagado en 7 segundos                   |
| El restaurante recibe el pedido y suena la alarma                            | ✅ Sonó bien, ya con el arreglo de la alarma          |
| El restaurante acepta                                                        | ✅ Lo aceptó a los 18 segundos de pagado              |
| Se ofrece y se asigna el pedido a un repartidor                              | ✅ Llegó la oferta y quedó asignado                   |
| «Llegué» al restaurante solo cuando el repartidor está cerca                 | ✅ No deja marcar «Llegué» desde lejos, como debe ser |
| Si el restaurante no acepta en 6 minutos, se cancela y se devuelve el dinero | ✅ Pasó con el primer pedido, E140                    |
| «Cómo llegar» abre el mapa                                                   | ✅ Abre Google Maps con la dirección                  |

## Fallos encontrados y arreglados hoy

| Fallo                                                                                    | Arreglo                                                                                                                                                                | Candado                                   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| La alarma del restaurante no sonaba si nadie tocaba antes «Activar sonido» (pedido E140) | Ahora suena sola. Si el navegador la silencia, sale un aviso grande y cualquier toque la vuelve a activar                                                              | C-ALARMA-SIEMPRE                          |
| La misma cuenta de repartidor entraba en dos teléfonos y los dos recibían la oferta      | Un repartidor, un solo teléfono: al entrar en otro, el anterior se cierra (como Uber y DoorDash)                                                                       | C-REPARTIDOR-UN-TELEFONO                  |
| La oferta no sonaba en los teléfonos: solo vibraba, y Safari en el iPhone no vibra       | En la versión web la oferta suena                                                                                                                                      | C-OFERTA-SUENA                            |
| La comanda impresa salía sin el nombre del restaurante y sin detalles                    | Comanda completa: restaurante, número, cliente, horas, cada plato con sus CON y SIN, nota y alergias; ancho de 58 u 80 mm y botón «Conectar impresora» (Chrome o Edge) | C-COMANDA-COMPLETA, C-IMPRESORA-NAVEGADOR |

## Lo que falta para cerrar la prueba (tareas)

1. **Terminar el pedido 407F en la calle.** Lo hace Richard.
   - Ir en el carro al restaurante de prueba, que desde el 8 nov está en el centro comercial de 31194 Novi Rd, Novi, a 1 km de la casa.
   - Marcar «Llegué» y ver que en la computadora del restaurante aparezca que el repartidor llegó.
   - El restaurante marca «¡Listo!» y el repartidor recoge.
   - Volver a la casa y entregar.
2. **Permiso de ubicación en el iPhone.** Lo hace Richard. En la captura sale «No pudimos leer tu ubicación». En el iPhone se activa así:
   - Ajustes → Privacidad y seguridad → Localización → Sitios web de Safari → «Al usar la app».
   - Luego recargar la página del repartidor.
3. **Sonido de la oferta en las apps de las tiendas.** Lo hacemos nosotros. Con la app abierta la oferta solo vibra. El sonido va en la próxima compilación, y esa compilación necesita permiso de Gerencia.
4. **Elegir la app de mapas.** Lo hacemos nosotros. Hoy «Cómo llegar» abre Google Maps en la web y Apple Maps en el iPhone. DoorDash deja que el repartidor elija Google Maps, Waze o Apple Maps. Divoox Flex ya ofrece esa elección; falta en comida.
5. **Repetir la prueba con las apps de las tiendas** (TestFlight y Google Play). Para eso tienen que apuntar al sitio de pruebas, no al real. Necesita una compilación de pruebas con permiso de Gerencia.

## Preguntas de Richard

- **¿«Cómo llegar» le cuesta algo a Divoox?** No. Abrir Google Maps con una dirección es como si el repartidor buscara la dirección él mismo. No usa nuestra llave de Google y no se cobra. Lo que sí cuesta es el mapa que se dibuja dentro de nuestra app y la búsqueda de direcciones, que tienen sus topes diarios.
- **¿Por qué abre solo Google Maps?** En la versión web el enlace va directo a Google Maps. No pregunta qué app usar (tarea 4).
- **¿Se puede trabajar desde el navegador?** Sí. Las tres partes (cliente, restaurante y repartidor) funcionan en el navegador. Es una ventaja frente a los grandes: se puede empezar a operar aunque una app esté esperando aprobación en la tienda. El límite de la web es que con la pantalla apagada no suena ni sigue la ubicación; para eso están las apps.
