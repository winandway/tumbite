# Tumbite — Publicación en App Store y Google Play

> Estado (12 oct 2026, noche): 🟡 **todo listo de nuestro lado**. Bloqueado solo por las cuentas de desarrollador de Apple y Google a nombre de Windoce LLC y la cuenta de Expo (EAS) de la empresa. El día que existan, se compila y se sube el mismo día.

## Las tres apps

| App         | Nombre en la tienda | Identificador (no se cambia nunca) | Para quién                                      | Tablet |
| ----------- | ------------------- | ---------------------------------- | ----------------------------------------------- | ------ |
| Cliente     | Tumbite             | `com.windoce.tumbite`              | quien pide comida                               | No     |
| Repartidor  | Tumbite Driver      | `com.windoce.tumbite.driver`       | repartidores                                    | No     |
| Restaurante | Tumbite Restaurants | `com.windoce.tumbite.restaurants`  | el mostrador del restaurante (tablet o celular) | Sí     |

Versión de tienda: **1.0.0** el primer envío (en `app.json` dice 0.1.0; se sube a 1.0.0 al compilar para la tienda).

## Direcciones que piden las tiendas (ya están en vivo)

Todas en inglés, que es el idioma principal y el que rige en los textos legales. La misma página en español está bajo `/es` (por ejemplo `https://tumbite.com/es/privacy`). A las tiendas se les dan las de abajo.

- Política de privacidad: `https://tumbite.com/privacy`
- Términos: `https://tumbite.com/terms`
- Términos para restaurantes: `https://tumbite.com/restaurant-terms`
- Términos para repartidores: `https://tumbite.com/driver-terms`
- Borrar la cuenta (Google Play → Seguridad de los datos → «enlace para borrar la cuenta»): `https://tumbite.com/delete-account`
- Soporte: `https://tumbite.com/support`
- Guías públicas (sirven de «marketing URL»): `https://tumbite.com/docs`
- Sitio: `https://tumbite.com`

## Permisos: cada app pide solo lo que usa (candado C-TIENDAS-PERMISOS)

Comprobado el 12 oct 2026 con la configuración final de Expo (lo que de verdad va dentro de la app):

| App         | iPhone pide                        | Android pide                     | Para qué (texto que ve la persona, en inglés y en español)                                    |
| ----------- | ---------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| Cliente     | Ubicación mientras se usa          | Ubicación                        | Mostrar los restaurantes cercanos y entregar el pedido                                        |
| Repartidor  | Ubicación mientras se usa · Cámara | Ubicación · Cámara               | Ofrecer pedidos cercanos y mostrar la ruta · Foto del documento y de la cara para verificarse |
| Restaurante | Nada                               | Nada (solo el volumen del aviso) | —                                                                                             |

- Se apagaron los textos genéricos que meten las librerías sin preguntar (Face ID, ubicación siempre, movimiento, micrófono) y los permisos de almacenamiento y grabación de Android. Apple rechaza los textos genéricos y Google pregunta por cada permiso de más.
- La app del restaurante no suena con la pantalla bloqueada (eso pediría «audio en segundo plano», que Apple revisa con lupa): con la app cerrada, el pedido llega como notificación con sonido.
- Los textos de los permisos están en español en `apps/<app>/idiomas/es.json`.

## Fichas de la tienda

Límites: Apple, nombre y subtítulo 30 caracteres, texto promocional 170, palabras clave 100; Google, descripción corta 80. Todo lo de abajo cabe.

### Tumbite (cliente)

- **Subtítulo** EN: Local food, delivered fast · ES: Comida local, rápido a tu puerta
- **Texto promocional** EN: Order from local restaurants, see the full price before you pay, and follow your driver live. Changed your mind? Cancel before it’s cooking and get it all back.
- **Texto promocional** ES: Pide a restaurantes locales, ve el precio completo antes de pagar y sigue a tu repartidor en vivo. ¿Cambiaste de idea? Cancela antes de que cocinen y te devolvemos todo.
- **Descripción corta (Google)** EN: Local restaurants, honest prices, and live tracking to your door. · ES: Restaurantes locales, precios claros y seguimiento en vivo hasta tu puerta.
- **Descripción** EN:
  Tumbite brings you the best local restaurants with prices you can trust.
  • See every cost before you pay: food, delivery, service, and tip. No surprises.
  • Pay with your card, Apple Pay, or Google Pay right inside the app.
  • Follow your order live: in the kitchen, on the way, and on the map until it reaches your door.
  • 100% of your tip goes to your driver.
  • Changed your mind? Cancel before the restaurant accepts and get a full refund. If a restaurant doesn’t confirm within 10 minutes, we cancel and refund you automatically.
  • Every restaurant and driver is identity-verified by our team.
  • Rewards for coming back: birthday gifts, punch cards, and welcome-back offers.
  • In English and Spanish.
- **Descripción** ES:
  Tumbite te trae los mejores restaurantes locales con precios en los que puedes confiar.
  • Ves cada costo antes de pagar: comida, envío, servicio y propina. Sin sorpresas.
  • Pagas con tarjeta, Apple Pay o Google Pay dentro de la app.
  • Sigues tu pedido en vivo: en la cocina, en camino y en el mapa hasta tu puerta.
  • El 100 % de la propina es para tu repartidor.
  • ¿Cambiaste de idea? Cancela antes de que el restaurante acepte y te devolvemos todo. Si un restaurante no confirma en 10 minutos, lo cancelamos y te devolvemos el dinero solos.
  • Cada restaurante y cada repartidor está verificado por nuestro equipo.
  • Premios por volver: regalo de cumpleaños, tarjeta de sellos y ofertas de bienvenida.
  • En inglés y en español.
- **Palabras clave** EN: food delivery,restaurants,takeout,order food,pizza,local,dinner,lunch,delivery app,Miami
- **Palabras clave** ES: comida a domicilio,restaurantes,pedir comida,delivery,pizza,cena,almuerzo,local,Miami
- **Categoría:** Food & Drink · **Clasificación:** 4+ / Everyone (ver respuestas abajo)

### Tumbite Driver

- **Subtítulo** EN: Deliver on your schedule · ES: Reparte a tu ritmo
- **Texto promocional** EN: See what you earn before you accept, keep 100% of your tips, and cash out to your bank. Declining an order never lowers your level.
- **Texto promocional** ES: Ves cuánto ganas antes de aceptar, el 100 % de la propina es tuyo y retiras a tu banco. Rechazar un pedido nunca te baja de nivel.
- **Descripción corta (Google)** EN: Deliver with Tumbite: clear pay, full tips, and cash out anytime. · ES: Reparte con Tumbite: pago claro, propina completa y retiros cuando quieras.
- **Descripción** EN:
  Deliver with Tumbite whenever you want.
  • See the pay and distance of every order before you accept.
  • Keep 100% of your tips. They never top up your base pay.
  • A bank-style wallet: balance, earnings, tips, and every movement. Cash out to your bank anytime.
  • Declining an order never hurts your level. Levels unlock perks as you grow.
  • Your ID is verified once, right from the app, so customers know who’s at their door.
  • Report a problem in one tap and a real person answers.
  • In English and Spanish.
- **Descripción** ES:
  Reparte con Tumbite cuando quieras.
  • Ves el pago y la distancia de cada pedido antes de aceptar.
  • El 100 % de la propina es tuyo. Nunca se usa para completar tu pago.
  • Una billetera como la de un banco: saldo, ganancias, propinas y cada movimiento. Retiras a tu banco cuando quieras.
  • Rechazar un pedido nunca te baja de nivel. Los niveles te dan beneficios a medida que creces.
  • Verificas tu identidad una sola vez desde la app, para que el cliente sepa quién toca su puerta.
  • Reportas un problema con un toque y te contesta una persona.
  • En inglés y en español.
- **Palabras clave** EN: delivery driver,courier,gig work,earn money,flexible job,food delivery,tips,side income
- **Palabras clave** ES: repartidor,trabajo flexible,ganar dinero,delivery,propinas,reparto,ingreso extra
- **Categoría:** Business · **Clasificación:** 4+ / Everyone

### Tumbite Restaurants

- **Subtítulo** EN: Orders for your restaurant · ES: Pedidos para tu restaurante
- **Texto promocional** EN: A loud alarm for every new order, a traffic light that shows what’s late, and a clear breakdown of what you earn. Lower commissions, no lock-in.
- **Texto promocional** ES: Una alarma fuerte para cada pedido nuevo, un semáforo que muestra lo atrasado y el desglose claro de lo que ganas. Comisiones más bajas, sin permanencia.
- **Descripción corta (Google)** EN: Receive Tumbite orders with an alarm, a traffic light, and clear payouts. · ES: Recibe pedidos de Tumbite con alarma, semáforo y pagos claros.
- **Descripción** EN:
  Run your Tumbite orders from a tablet or phone at the counter.
  • A loud alarm until someone accepts the order. Choose the prep time in one tap.
  • A traffic light on every order: green on time, yellow running late, red needs attention.
  • Mark orders ready and we send the closest driver.
  • Your dashboard: orders, sales, top dishes, real kitchen time vs. promised, and ratings.
  • Rewards your regulars love: birthday gifts, punch cards, and welcome-back offers.
  • Lower commissions and a full breakdown of every order. No lock-in contracts.
  • In English and Spanish.
- **Descripción** ES:
  Maneja los pedidos de Tumbite desde una tablet o un celular en el mostrador.
  • Una alarma fuerte hasta que alguien acepta el pedido. Eliges el tiempo de preparación con un toque.
  • Un semáforo en cada pedido: verde a tiempo, amarillo atrasándose, rojo necesita atención.
  • Marcas el pedido listo y enviamos al repartidor más cercano.
  • Tu tablero: pedidos, ventas, platos más vendidos, tiempo real de cocina contra el prometido y calificación.
  • Premios que tus clientes fieles valoran: cumpleaños, tarjeta de sellos y bienvenida.
  • Comisiones más bajas y el desglose de cada pedido. Sin contratos de permanencia.
  • En inglés y en español.
- **Palabras clave** EN: restaurant orders,order manager,tablet POS,delivery orders,kitchen,restaurant app,merchant
- **Palabras clave** ES: pedidos restaurante,tablet,delivery,cocina,app restaurante,comercio,gestión de pedidos
- **Categoría:** Business · **Clasificación:** 4+ / Everyone

## Respuestas de los cuestionarios

### Clasificación por edad (Apple y Google, las tres apps)

Sin violencia, sin contenido sexual, sin apuestas, sin compras de alcohol o tabaco dentro de la app (si un restaurante vende alcohol más adelante, se revisa esta respuesta antes), sin chat abierto entre desconocidos. Resultado esperado: **4+ / Everyone**.

### Privacidad de Apple («App Privacy») y Seguridad de los datos de Google

Datos que se recogen, todos **ligados a la cuenta**, **ninguno para rastrear** ni para publicidad de terceros:

| Dato                                             | Cliente                                                | Repartidor       | Restaurante        | Para qué                                           |
| ------------------------------------------------ | ------------------------------------------------------ | ---------------- | ------------------ | -------------------------------------------------- |
| Nombre, correo, teléfono                         | Sí                                                     | Sí               | Sí                 | La cuenta y el soporte                             |
| Dirección de entrega                             | Sí                                                     | —                | Sí (local)         | Entregar el pedido                                 |
| Ubicación precisa (solo con la app abierta)      | Sí                                                     | Sí               | —                  | Restaurantes cercanos, ruta                        |
| Historial de compras                             | Sí                                                     | —                | Sí (ventas)        | El servicio y los recibos                          |
| Pagos                                            | Lo maneja Stripe; Tumbite no guarda números de tarjeta | Banco por Stripe | Banco por Stripe   | Cobrar y pagar                                     |
| Fotos (documento y cara)                         | —                                                      | Sí               | Sí (dueño y local) | Verificar la identidad; las ve solo nuestro equipo |
| Identificadores del dispositivo (notificaciones) | Sí                                                     | Sí               | Sí                 | Avisos del pedido                                  |
| Mensajes de soporte                              | Sí                                                     | Sí               | Sí                 | Atender quejas                                     |

Google, además: los datos viajan cifrados; la persona puede pedir borrarlos (botón dentro de la app y en `https://tumbite.com/delete-account`).

### Notas para el revisor (se pegan en «App Review Information»)

EN: Tumbite is a food delivery marketplace. Payments are for physical goods (food and delivery) and use Stripe, not in-app purchases. Location is only used while the app is open. To test: sign in with the demo account below; a demo restaurant is open and approved in the test area. Account deletion: three-dot menu → “Delete my account.”

Cuentas de prueba para el revisor: una de cliente, una de repartidor y una de restaurante, con un restaurante de prueba aprobado. **Se crean el día del envío** con contraseñas nuevas que van solo en el formulario de Apple y Google, nunca en el repositorio.

## Capturas de pantalla de la tienda

Tamaños: iPhone 6.9" (1320 × 2868) obligatoria; iPad 13" (2064 × 2752) solo para Tumbite Restaurants; Google, celular (mínimo 1080 de ancho) y, para el restaurante, tablet de 10". Se sacan del simulador con la app compilada para la tienda, en inglés y en español, con datos neutros (como «Pizzería Napoli»).

| App         | Capturas (en este orden)                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente     | Inicio con restaurantes cercanos · Menú de un restaurante · Carrito con el desglose · Pago dentro de la app · Pedido en vivo con el mapa |
| Repartidor  | Conectado recibiendo pedidos · Oferta con el pago antes de aceptar · Billetera · Verificación de identidad                               |
| Restaurante | Pedidos con el semáforo y la alarma · Tablero del día · Menú con «agotado» · Regalos                                                     |

Las de Docs (`apps/panel/public/docs/`) sirven de referencia del encuadre.

## Lo que Apple y Google revisan con lupa (ya resuelto)

- **Ubicación:** solo «mientras se usa la app» en las tres. (La ubicación en segundo plano queda para después del lanzamiento: Apple la revisa muy duro y exige video.)
- **Permisos con su motivo:** ver la tabla de arriba; textos genéricos eliminados.
- **Pagos:** comida y entregas son bienes físicos, así que se cobran con Stripe, no con las compras dentro de la app de Apple ni de Google.
- **Borrar la cuenta:** dentro de la app (menú de 3 puntos → «Borrar mi cuenta») y página web `/delete-account`. Borra también las fotos de verificación (candado C-BORRADO-COMPLETO).
- **Cancelar y devolver:** el cliente cancela antes de que acepten y recibe todo; a los 10 minutos sin respuesta se cancela solo (candado C-MANAGER-1). Coincide con los términos publicados.
- **Cuenta de prueba para el revisor:** se crea el día del envío.

## Pasos (quién hace qué)

1. 👤 Richard: Apple Developer Program y Google Play Console a nombre de Windoce LLC (con su número D-U-N-S).
2. 👤 Richard: crear la cuenta de Expo (EAS) de la empresa e invitarme, o darme acceso.
3. 👤 Richard: llave de Google Maps para Android (sin ella el mapa del cliente solo se ve en iPhone).
4. Yo: `eas init` en cada app (llena el `owner` y el `projectId`), versión 1.0.0, `eas build --profile production` para iOS y Android.
5. Yo: capturas desde el simulador, fichas con los textos de arriba, cuestionarios con las respuestas de arriba, cuentas de prueba del revisor.
6. Yo: `eas submit` a TestFlight y a la prueba interna de Google Play; pruebas en teléfonos reales; enviar a revisión.
