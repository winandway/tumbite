# Elogios y motivos al calificar (BRE-3) y pedido de prueba del restaurante (BRE-4) — 2 nov 2026, todos los países

## 1. Referencia y evidencia

- [REA] Escenario de navegador sobre dos páginas públicas, como visitante, sin cuentas ni cookies: la ayuda de DoorDash para restaurantes «How Do I Create a Test Order on My DoorDash Tablet?» y la página legal de Uber «Reviews and ratings on Uber Eats» (Irlanda, modificada el 10 jun 2022). Paquete `evidencia-rea-2026-11-02-elogios-y-pedido-prueba.json`, guardado fuera del repositorio en `~/Divoox-privado/estudios/rea/` (igual que BRE-2); sha256 `3f274cbf485ec6b936b747271f2ab7df4e4576e0ce2d75f721703d7d38d2e338`, cuatro registros de accesibilidad y dirección.
- [REA][DOC] Uber Eats, repartidor: tras una nota positiva el cliente elige entre elogios ya escritos, que se publican en el perfil del repartidor, del más elegido al menos; tras una nota negativa elige un motivo ya escrito, que NO se publica y solo lo ve Uber.
- [REA][DOC] Uber Eats, restaurante: el cliente puede dar pulgar arriba o abajo al plato y elegir elogios ya escritos; eso se comparte solo con el restaurante.
- [DOC] DoorDash: tras una mala calificación pide el motivo (ayuda pública del cliente; no se capturó con REA).
- [REA][DOC] DoorDash Merchant: «Settings → Create test order» para comprobar que la tienda está bien configurada y conocer el flujo del pedido. [DOC] (búsqueda en su ayuda): no se manda repartidor y no se puede contactar a un cliente; arma el pedido con artículos del menú.
- [NV] La lista exacta de elogios y motivos de cada app hoy (cambia por país y versión); si un pedido de prueba de DoorDash entra en sus informes.
- Límite: no se analizaron apps de terceros ni se usaron cuentas.

## 2. Comparación y decisión — BRE-3

| Pieza                      | Los grandes               | Divoox antes     | Divoox ahora                                          |
| -------------------------- | ------------------------- | ---------------- | ----------------------------------------------------- |
| Elogios al repartidor      | Con nota buena, en perfil | No               | Con 5 estrellas; en «Mis calificaciones» y «Mi nivel» |
| Motivo de mala nota (rep.) | Solo lo ve la plataforma  | No               | Con 3 o menos; solo en la ficha del superadmin        |
| Elogios/motivos del local  | Solo al restaurante       | Pulgar por plato | Conteo y por reseña en Reseñas (panel y app)          |

Una pieza (`packages/compartido/src/etiquetasCalificacion.ts`) con los códigos y textos en dos idiomas; tabla nueva `calificaciones_etiquetas` en `schema.sql` (tabla nueva, no columnas: no hace falta migración). Con 4 estrellas no se abre nada (decisión nuestra para no pedir de más; [INF]).

## 3. Comparación y decisión — BRE-4

Ver la sección del pedido de prueba más abajo (se completa con BRE-4).

## 4. Pruebas de aceptación (BRE-3)

- `apps/servidor/src/elogiosMotivos.test.ts`: elogios con 5, motivos con 3 o menos, el repartidor nunca ve los motivos, calificar otra vez reemplaza y sin repartidor no se guardan los suyos.
- `packages/compartido/src/etiquetasCalificacion.test.ts`: reglas de la pieza y que cliente, Driver, restaurante y panel la usan.
