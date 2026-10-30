# Calificación pública del restaurante (30 oct 2026) — todos los países

## 1. Referencias y evidencia

- [REA] Uber Eats, página de Miami como visitante: la página respondió con una verificación contra robots
  (evidencia `ev_022c95e3f091a64c1477ba087d4eb0e2b73ace7ee2973642e20e074c8658edbb`). No se salta: regla de Windoce.
- [REA] DoorDash, página de restaurantes de Miami como visitante: respondió «We're having trouble loading the page»
  (evidencia `ev_c7d3ee1c2b118c587533ea8ca7ceeeb3e96c74a2bc9c4e32840262b2da11ba3a`). Paquete
  `evidencia-rea-2026-10-30-calificacion.json` (huella `bb99e66b774ff84a…`).
- [DOC] Centro de ayuda de DoorDash para comercios («How are customer reviews collected and displayed»): solo cuentan
  calificaciones de pedidos verificados, una por pedido; con menos de 10 calificaciones de DoorDash la tienda puede
  mostrar otra fuente; desde 10 se muestra solo la de DoorDash; la tienda muestra una calificación de 1 a 5.
- [DOC] Uber, «Ratings and reviews on Uber Eats» (Irlanda, 2022): el promedio que se muestra en la app y en la web sale
  de un mínimo de 10 calificaciones; las calificaciones individuales no se muestran.
- [OBS] En las dos apps la tarjeta del restaurante lleva estrellas y número de opiniones, y la ficha trae reseñas con
  comentario y la respuesta del comercio.
- [INF] La ventana de tiempo exacta y el peso de las opiniones recientes no son verificables ([NV]); usamos el promedio
  de todas las opiniones verificadas.

## 2. Comparación con Divoox

| Pieza                                                      | Antes                                     | Ahora                                      |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| Calificación del restaurante al terminar el pedido         | Sí                                        | Sí                                         |
| Promedio y reseñas para el dueño (panel, respuestas)       | Sí                                        | Sí                                         |
| Estrellas y número de opiniones en la lista y el buscador  | **No** (solo estrellas falsas de ejemplo) | Sí, desde 10 opiniones; antes «Nuevo»      |
| Reseñas con comentario y respuesta en la ficha del cliente | **No**                                    | Sí, las 20 más nuevas, solo nombre de pila |

## 3. Decisión

Como DoorDash y Uber: promedio con un decimal y número de opiniones, solo de pedidos verificados, y solo desde 10
opiniones (`MIN_OPINIONES_PUBLICAS`). Con menos, «Nuevo». Las reseñas públicas solo con comentario, nombre de pila y
la respuesta del restaurante; nada del pedido.

## 4. Pruebas de aceptación

- Servidor: `apps/servidor/src/rutas/calificacionPublica.test.ts` (lista, ficha, buscador, reseñas, menos de 10).
- Regla: `packages/compartido/src/calificacionPublica.test.ts`.
- App: `e2e/recorrido/calificacion.spec.ts` (en rojo con la versión anterior, en verde con la nueva).
