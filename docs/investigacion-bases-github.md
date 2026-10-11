# Tumbite — Bases de código en GitHub para una app de reparto de comida

Investigación del 10 de octubre de 2026. Sin código todavía: solo opciones y requisitos a discutir.

## Requisito fijo

App nativa publicada en Google Play y App Store. No se acepta solo navegador.

## Opciones encontradas

| #   | Proyecto                                                                            | Estrellas | Licencia             | Tecnología                                         | Qué trae                                                                   | El problema                                                                                 |
| --- | ----------------------------------------------------------------------------------- | --------- | -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | enatega/food-delivery-multivendor                                                   | 1.390     | MIT (solo pantallas) | Expo / React Native, React, GraphQL, Node, MongoDB | App cliente, app repartidor, app restaurante, panel admin, Stripe y PayPal | **El servidor (el corazón) es privado y se paga aparte.** Lo gratis son solo las pantallas. |
| 2   | enatega/food-delivery-singlevendor                                                  | 677       | MIT (solo pantallas) | Igual que el 1                                     | Versión de un solo restaurante                                             | Mismo problema: servidor de pago.                                                           |
| 3   | helloharendra/Complete-Food-Delivery-App-Flutter                                    | 66        | MIT                  | Flutter + Firebase                                 | App usuario, vendedor, repartidor y panel admin                            | Proyecto pequeño, nivel estudiante; sin pagos serios ni pruebas.                            |
| 4   | sergeyCodenameOne/UberEatsClone                                                     | 547       | Apache 2.0           | Java (Codename One)                                | Plantilla de app de comida                                                 | Tecnología poco común; difícil contratar o mantener.                                        |
| 5   | theunstopabble/SwadKart                                                             | 17        | MIT                  | MERN (web), Socket.io, Razorpay                    | Multi-restaurante con seguimiento en vivo                                  | Es web, no app de tiendas; pagos de India.                                                  |
| 6   | andresmichel/react-native-uber-eats                                                 | 50        | MIT                  | Expo / React Native                                | Clon visual de Uber Eats                                                   | Solo diseño, sin servidor.                                                                  |
| —   | Repos tipo "doordash-clone-app", "wolt-app", "react-native-based-food-delivery-app" | 10–50     | MIT                  | —                                                  | —                                                                          | Son copias de marketing de Enatega con el mismo servidor de pago. Descartados.              |

## Conclusión recomendada

No existe en GitHub un núcleo completo, gratis y serio (con servidor incluido). El que más se acerca es Enatega, pero cobra el servidor, que es justo la parte difícil: pedidos, asignación de repartidores, pagos y seguimiento.

Recomendación: construir el núcleo propio con **Expo (React Native)** — un solo código para iPhone y Android — y usar las pantallas de Enatega (licencia MIT) como **referencia de flujos y diseño**, no como base.

Piezas: app cliente, app repartidor, app/tablet del restaurante, panel web de administración, servidor con base de datos, seguimiento en tiempo real y pagos con reparto de dinero (marketplace).

## Requisitos a decidir con Richard

1. Modelo: varios restaurantes (marketplace tipo DoorDash) o una sola marca.
2. Mercado inicial: país y ciudades; moneda.
3. Repartidores: flota propia, contratistas independientes, o apoyarse en un servicio externo de reparto al inicio.
4. Cobro: comisión al restaurante, tarifa de envío al cliente, propina, suscripción tipo DashPass.
5. Pagos: procesador y cómo se le paga al restaurante y al repartidor.
6. Restaurante: app propia, tablet, o panel web.
7. Idiomas: español e inglés desde el día uno.
8. Cuentas de desarrollador de Apple y Google a nombre de la empresa.

## Fuentes

- https://github.com/enatega/food-delivery-multivendor
- https://github.com/enatega/food-delivery-singlevendor
- https://github.com/helloharendra/Complete-Food-Delivery-App-Flutter
- https://github.com/sergeyCodenameOne/UberEatsClone
- https://github.com/theunstopabble/SwadKart
- https://github.com/andresmichel/react-native-uber-eats
- https://github.com/marthaegrimaldi/wolt-app
- https://dev.to/qasim_ninjascode/enatega-open-source-food-delivery-app-solution-now-available-599j

---

# Decisiones de Richard (10 oct 2026)

- **Modelo:** marketplace de muchos restaurantes, tipo DoorDash.
- **Mercado inicial:** Estados Unidos, Miami. Bilingüe español/inglés obligatorio.
- **Repartidores:** los dos tipos, propios (empleados) e independientes.
- **Ingreso de la app:** comisión al restaurante.
- **Procesador:** Stripe.
- **Billetera:** restaurante y repartidor ven su saldo, historial y retiran a su banco con un toque.
- **Restaurante recibe pedidos:** de la forma más fácil y usada.
- **Planes para restaurantes:** tres planes con nombres propios, a la mitad de la comisión de DoorDash, con editor de porcentajes en el panel admin.

## Referencia DoorDash (captura de Richard) → nuestra propuesta (50% menos)

| DoorDash | Comisión | Nuestro plan (propuesta) | Comisión |
| -------- | -------- | ------------------------ | -------- |
| Basic    | 15%      | Starter / Inicial        | 7,5%     |
| Plus     | 25%      | Growth / Crece           | 12,5%    |
| Premier  | 30%      | Pro / Élite              | 15%      |

Los porcentajes, nombres y beneficios se editan desde el panel admin, sin publicar la app.

## Recomendaciones técnicas

1. **Billetera = Stripe Connect (cuentas Express).** Stripe guarda los datos bancarios, verifica identidad y emite los formularios de impuestos de los independientes. Nosotros nunca tocamos un número de cuenta. En la app se ve el saldo, el historial y el botón «Retirar». Pago automático semanal gratis + retiro instantáneo a tarjeta de débito con una pequeña tarifa de Stripe (se confirma el monto en la doc oficial antes de construir), igual que hace DoorDash.
2. **Repartidores empleados:** usan la misma app, ven sus ganancias, pero se les paga por nómina, no por la billetera. La billetera es para independientes.
3. **Restaurante:** app propia que corre en tablet o celular (Android o iPad), con alarma sonora fuerte al entrar un pedido y botón aceptar / listo. Es como lo hace DoorDash con su tablet. Panel web para menú, horarios, reportes y billetera. Fase 2: conectar con los sistemas de caja más usados en EE.UU. (Toast, Square, Clover) e impresora de cocina.

## ALERTA de negocio (decisión de Richard)

Si la app solo gana comisión al restaurante, **con 7,5% no alcanza para pagarle al repartidor** (pedido de 30 dólares = 2,25 de comisión). DoorDash le cobra al cliente tarifa de envío + tarifa de servicio + propina, y de ahí sale el pago del repartidor.
Recomendación: el cliente paga tarifa de envío + propina (100% para el repartidor); la comisión al restaurante es nuestra ganancia. Opcional después: tarifa de servicio pequeña y suscripción para clientes tipo DashPass.

## Pendiente de verificar con el contador

Impuesto de ventas en Florida para plataformas de pedidos, y la clasificación legal de repartidores empleados vs independientes.
