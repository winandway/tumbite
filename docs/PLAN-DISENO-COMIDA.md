# Plan — rediseño de las pantallas de Comida de Tumbite Cliente

Fecha: 14 de octubre de 2026. Referencia: la imagen de diez pantallas (Inicio, Restaurantes, Menú, Detalle del producto, Carrito y pago, Confirmación, Seguimiento, Detalle del pedido, Chat, Pedido entregado). Solo frontend en `apps/cliente`. No se tocan servidor, base, rutas del servidor, sesión, pagos, ni las apps del restaurante y del repartidor. El inicio aprobado no cambia.

## Fase 1 — Lo que hay hoy (auditoría)

| Ruta               | Archivo                           | Qué hace hoy                                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `src/Inicio.tsx` + `src/inicio/*` | Inicio aprobado. Restaurantes cercanos en fila horizontal. El ícono «Comida» no hacía nada.                                                                                                                                                                                                         |
| `/restaurant/[id]` | `src/app/restaurant/[id].tsx`     | Menú: foto, aviso de cerrado, platos por categoría con «+ Agregar», ventana de opciones (tamaño, extras).                                                                                                                                                                                           |
| `/cart`            | `src/app/cart.tsx`                | Carrito y pago en una sola pantalla: líneas con − / +, mapa con pin, dirección, indicaciones al repartidor, puerta / en mano / recoger, PIN, propina 0/15/20/25 % u otra, regalos, resumen, formulario de tarjeta de Stripe dentro de la app.                                                       |
| `/order/[id]`      | `src/app/order/[id].tsx`          | Seguimiento cada 5 s: estado, barra de pasos, minutos, «a más tardar», faltante, PIN, mapa en vivo, repartidor, foto sellada, foto de entrega, recoger en el local, cambiar dirección, llamada con número oculto, chat, líneas y total, propina después, calificación, cancelar, reportar problema. |
| `/account`         | `src/app/account.tsx`             | Cuenta y mis pedidos.                                                                                                                                                                                                                                                                               |

Datos que da el servidor: restaurantes con nombre, categoría, foto, distancia, tiempo de preparación, horarios y abierto; platos con foto, descripción, precio, categoría y grupos de opciones; seguimiento con estado, líneas, total, dirección, repartidor (nombre y ubicación), fotos, PIN y tiempos.

## Fase 2 — Qué funciona, qué se rediseña y qué falta

| #   | Pantalla del diseño  | Estado                            | Qué se hace                                                                                                                                                                                |
| --- | -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Inicio               | Aprobado                          | No se toca. Solo «Comida» abre la lista de restaurantes.                                                                                                                                   |
| 2   | Restaurantes         | Existía solo como fila del inicio | Pantalla nueva `/restaurants` con buscador, botones de categoría sacados de los restaurantes reales, tarjetas grandes y barra inferior.                                                    |
| 3   | Menú del restaurante | Funciona                          | Foto grande con flecha, nombre, distancia y tiempo, «Abierto»; pestañas Menú e Información (dirección, teléfono, horario: datos reales); botones de categoría; platos con botón + redondo. |
| 4   | Detalle del producto | Funciona como ventana de opciones | Pantalla completa con foto, descripción, precio, tamaños en losetas, extras con casillas, cantidad − / + y «Agregar al carrito · $». Se abre al tocar cualquier plato.                     |
| 5   | Carrito y pago       | Funciona                          | Líneas con foto, tipo de entrega con íconos, propina en botones, resumen y botón rojo. Mapa, PIN, regalos y tarjeta se conservan.                                                          |
| 6   | Confirmación         | No existía como pantalla          | Al pagar, el pedido abre con «¡Pedido realizado!», número y total, con «Ver seguimiento» y «Volver al inicio».                                                                             |
| 7   | Seguimiento          | Funciona                          | Cuatro pasos (Confirmado, En preparación, En camino, Entregado), mapa, tarjeta del repartidor con llamar (número oculto) y mensaje.                                                        |
| 8   | Detalle del pedido   | Funciona en parte                 | Líneas con precio, total, dirección y tipo de entrega.                                                                                                                                     |
| 9   | Chat                 | Funciona                          | Se conserva el chat del pedido dentro de la tarjeta del repartidor.                                                                                                                        |
| 10  | Pedido entregado     | Funciona                          | «¡Pedido entregado!» con la foto real de la entrega, estrellas para la comida y el repartidor, «Enviar calificación» y «Volver al inicio».                                                 |

### Lo que el diseño muestra y NO existe (no se inventa; se reporta)

| Qué                                                          | Por qué no está                                       | Qué haría falta                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Estrellas y número de opiniones de cada restaurante          | El servidor no publica el promedio al cliente         | Que la lista de restaurantes devuelva el promedio (cambio de servidor, necesita tu sí) |
| Pestaña «Opiniones»                                          | No hay lista pública de opiniones                     | Igual que arriba, más las reseñas escritas                                             |
| Favoritos (corazón)                                          | No existe                                             | Tabla de favoritos y su ruta. Mientras: «Muy pronto»                                   |
| «10 % OFF» en la foto                                        | No hay promociones por restaurante                    | Módulo de promociones                                                                  |
| Foto y estrellas del repartidor                              | El seguimiento manda solo el nombre                   | Que el seguimiento mande foto y promedio (servidor)                                    |
| Instrucciones para el restaurante                            | El pedido solo guarda indicaciones para el repartidor | Campo nuevo en el pedido (servidor y app del restaurante)                              |
| Desglose (envío, servicio, propina) en el detalle del pedido | El seguimiento manda solo el total                    | Que el seguimiento mande el desglose                                                   |
| Adjuntar en el chat                                          | No existe                                             | Fotos en el chat                                                                       |

Ninguno de estos se dibuja como si funcionara: lo que no hay no se muestra, y el corazón abre «Muy pronto», como en el inicio.

## Lo que NO cambia

Servidor, base, rutas del servidor, sesión, carrito guardado, Stripe, mapas, chat, seguimiento cada 5 segundos, apps de restaurante y repartidor, paquetes compartidos. Mercado, Envíos, Farmacia, Moto, Carro y Más siguen con «Muy pronto».

## Verificación

`npm run verify`, recorrido ES/EN de punta a punta (restaurante, producto, carrito, pago, seguimiento, chat, entrega, calificación) con capturas nuevas para Docs, y comparación pantalla por pantalla con la imagen.
