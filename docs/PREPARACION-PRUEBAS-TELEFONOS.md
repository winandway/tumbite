# Preparación de una prueba con teléfonos (31 oct 2026) — EE. UU., Michigan

Para Richard. Qué se prepara antes de probar, con uno o dos iPhone y la computadora, y qué prueba
se puede hacer en cada caso. Todo en Michigan, cerca de Novi.

## 1. Primero: qué se actualiza solo y qué necesita una versión nueva de la app

- **Se actualiza solo, al momento, sin tocar las tiendas:** todo lo que vive en el servidor de Divoox.
  Precios, tarifas, restaurantes, menús, zonas, reglas del pedido, ofertas al repartidor, textos que
  vienen del servidor, la web y los paneles. Lo publicamos y la app instalada ya lo usa.
- **Necesita una versión nueva de la app:** lo que está dibujado dentro de la app (una pantalla, un
  botón, un texto de la pantalla, el mapa). Esos arreglos se juntan y salen en la siguiente versión.
- **Apple:** subir una compilación nueva a TestFlight NO cancela la revisión de la tienda. La revisión
  es de la versión 1.0 con su compilación fija; no se toca. Las compilaciones nuevas sirven para probar
  en TestFlight, y cuando Apple apruebe la 1.0 se manda la 1.0.1 con todos los arreglos juntos.
- **Google Play:** subir una versión nueva SÍ cancela la revisión en curso. Por eso no se sube nada a
  Google mientras revisa (hay un candado que lo impide). Al aprobarse, se sube todo lo acumulado en una
  sola versión.

## 2. Dos mundos para probar

|                         | Sitio de pruebas                                                                                | Divoox real                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Dónde                   | En Safari: la app del cliente, la de repartidor y el panel del restaurante del sitio de pruebas | Las apps de TestFlight que ya tienes instaladas                                                                                           |
| Dinero                  | Gratis: tarjeta de prueba 4242 4242 4242 4242, cualquier fecha futura y cualquier código        | Dinero real. **Prohibido pagar** salvo la compra real de un dólar autorizada                                                              |
| Restaurante en Michigan | Pizzería Demo Novi (6 km de Walled Lake)                                                        | Cinco restaurantes de prueba en Novi (Café Fountain Walk, Tacos Twelve Oaks, Pizzería Novi, Burger Town Center y Restaurante el Beef USA) |
| Para qué sirve          | El circuito completo: pedir, pagar, aceptar, repartir, entregar, cobrar                         | Ver que las apps de verdad funcionan en el iPhone: entrar, mapa, ubicación, avisos, cámara, menús                                         |

Las cuentas del sitio de pruebas están en el archivo de cuentas de prueba (fuera de git). Las de la
Divoox real son las de los revisores de las tiendas: **no se les cambia nada mientras Apple y Google
revisan**, porque las usan sus revisores (están armadas en Miami a propósito).

## 3. Con UN iPhone y la computadora (prueba completa, gratis)

1. **Computadora:** el panel del restaurante del sitio de pruebas, con la cuenta de Pizzería Demo Novi.
   Se deja abierto: así el restaurante «está escuchando» y suena cuando entra un pedido.
2. **iPhone, en Safari:** la app del cliente del sitio de pruebas. Pide a tu dirección real de
   Michigan, paga con la tarjeta 4242.
3. **Computadora:** acepta el pedido y márcalo listo.
4. **iPhone, otra pestaña de Safari:** la app del repartidor del sitio de pruebas, con la cuenta demo de
   repartidor. Conéctate, acepta la oferta, recoge y entrega.
5. Al final: el cliente califica y el dinero aparece en las billeteras del restaurante y del repartidor.

Limitación: con un solo teléfono no se ve al repartidor moverse en el mapa del cliente mientras maneja.

## 4. Con DOS iPhone y la computadora (lo ideal)

- **iPhone 1:** cliente. **iPhone 2:** repartidor (va en el carro o caminando hasta tu puerta).
- **Computadora:** restaurante.
- Así se prueba lo que no se ve con uno: la oferta que suena en el teléfono del repartidor, el mapa del
  cliente siguiendo al repartidor en vivo, la foto de entrega y el aviso «Llegó tu pedido».

## 5. Con las apps reales (TestFlight), sin pagar

- **Cliente:** entra, mira los restaurantes de Novi, arma un carrito, revisa dirección, mapa y propina.
  No pagues.
- **Driver:** entra, revisa la verificación, la pantalla de ganancias y el mapa. Con la cuenta de
  revisión no llegan ofertas en Michigan (está en Miami a propósito).
- **Restaurants:** entra y revisa la pantalla de pedidos y el menú de la cocina de revisión.
- Todo lo raro: captura y me la pasas. Lo que sea del servidor se arregla al momento; lo de la pantalla
  va en la siguiente versión.

## 6. Antes de salir a probar (lista)

- Batería llena en los teléfonos y en la computadora.
- Ubicación encendida y permitida «Mientras se usa» en el navegador o la app.
- Avisos permitidos.
- La dirección de entrega real en Michigan, a pocas cuadras si se quiere ver el recorrido.
- Para la prueba con dinero real (cuando la autorices): seguir la guía de la compra real de un dólar.
