# Tumbite — Publicación en App Store y Google Play

> Estado: 🟡 todo preparado en el código. **Bloqueado** por las cuentas de desarrollador de Apple y Google a nombre de Windoce LLC.

## Las tres apps

| App         | Nombre en la tienda | Identificador (no se cambia nunca) | Para quién                                      |
| ----------- | ------------------- | ---------------------------------- | ----------------------------------------------- |
| Cliente     | Tumbite             | `com.windoce.tumbite`              | quien pide comida                               |
| Repartidor  | Tumbite Driver      | `com.windoce.tumbite.driver`       | repartidores                                    |
| Restaurante | Tumbite Restaurants | `com.windoce.tumbite.restaurants`  | el mostrador del restaurante (tablet o celular) |

## Direcciones que piden las tiendas (ya están en vivo)

- Política de privacidad: `https://tumbite.com/privacidad`
- Términos: `https://tumbite.com/terminos`
- Soporte: `https://tumbite.com/soporte`
- Sitio: `https://tumbite.com`

## Textos de la ficha (inglés de EE.UU. y español)

### Tumbite (cliente)

- Subtítulo EN: Food delivery in Miami · ES: Comida a domicilio en Miami
- Descripción EN: Order from the best local restaurants in Miami and track your driver live on the map. See the full price before you pay — no hidden fees. Your driver keeps 100% of your tip. Loyal customers get rewarded: birthday gifts, punch cards, and more.
- Descripción ES: Pide a los mejores restaurantes de Miami y sigue a tu repartidor en vivo en el mapa. Ves el precio completo antes de pagar, sin cargos escondidos. El 100 % de la propina es para tu repartidor. Premiamos tu fidelidad: regalo de cumpleaños, tarjeta de sellos y más.
- Categoría: Food & Drink · Clasificación: 4+ / Everyone

### Tumbite Driver

- Subtítulo EN: Deliver and earn · ES: Reparte y gana
- Descripción EN: Deliver with Tumbite on your own schedule. See what you earn before you accept, keep 100% of your tips, and cash out to your bank. Declining an order never lowers your level.
- Descripción ES: Reparte con Tumbite cuando quieras. Ves cuánto ganas antes de aceptar, el 100 % de la propina es tuyo y retiras a tu banco. Rechazar un pedido nunca te baja de nivel.
- Categoría: Business · Clasificación: 4+ / Everyone

### Tumbite Restaurants

- Subtítulo EN: Orders for your restaurant · ES: Pedidos para tu restaurante
- Descripción EN: Receive Tumbite orders on a tablet or phone with a loud alert, set prep times, and mark orders ready. Lower commissions and a full breakdown of every order.
- Descripción ES: Recibe los pedidos de Tumbite en una tablet o celular con alarma, fija el tiempo de preparación y marca los pedidos listos. Comisiones más bajas y el desglose de cada pedido.
- Categoría: Business · Clasificación: 4+ / Everyone

## Lo que Apple y Google revisan con lupa (ya resuelto)

- **Ubicación:** solo «mientras se usa la app» en las tres. El repartidor comparte su ubicación solo mientras está conectado con la app abierta. (La ubicación en segundo plano queda para después del lanzamiento: Apple la revisa muy duro y exige video.)
- **Pagos:** comida y entregas son bienes físicos, así que se cobran con Stripe, no con las compras dentro de la app de Apple ni de Google.
- **Borrar la cuenta:** Apple lo exige dentro de la app. ✅ Hecho: en las tres apps y en el panel, dentro de los 3 puntos, con confirmación. Borra los datos personales y deja los pedidos sin nombre para la contabilidad.
- **Cuenta de prueba para el revisor:** hace falta una de cliente, una de repartidor y una de restaurante, en un restaurante de prueba aprobado. Se crean el día del envío.

## Pasos (quién hace qué)

1. 👤 Richard: Apple Developer Program y Google Play Console a nombre de Windoce LLC (con su número D-U-N-S).
2. 👤 Richard: crear la cuenta de Expo (EAS) de la empresa e invitarme, o darme acceso.
3. Yo: `eas init` en cada app (llena el `owner` y el `projectId`), `eas build --profile production` para iOS y Android.
4. Yo: `eas submit` a TestFlight y a la prueba interna de Google Play; fichas con los textos de arriba y capturas.
5. Yo: pruebas en teléfonos reales con TestFlight; luego enviar a revisión.
