# Niveles, calificación y premios del repartidor (30 oct 2026) — todos los países

Estudio para el plan «Divoox Rewards». PDF para Richard: `docs/PLAN-NIVELES-Y-PREMIOS.pdf`.

## 1. Evidencia

Paquete REA `evidencia-rea-2026-10-30-niveles-repartidor.json`. Páginas públicas de DoorDash vistas como visitante:

- [REA] «Dasher Ratings Explained», centro de ayuda de DoorDash (evidencia `ev_2fbb8360…`).
- [REA] «Overall Dasher Rating», centro de ayuda de DoorDash (evidencia `ev_fedd0d0a…`).
- [REA] «How Our Latest Pilot Aims to Make Our Rewards Program Even More Flexible», noticia de DoorDash del 16 dic 2024 (evidencia `ev_680b4404…`).
- [DOC] Uber Pro, términos del programa y preguntas frecuentes (por búsqueda; los puntos exactos cambian por ciudad).
- [NV] El peso exacto de cada factor dentro del despacho no es público.

## 2. Cómo lo hace DoorDash [REA]

### Calificaciones, todas «móviles» sobre las últimas 100

| Calificación                  | Qué mide                                                      | Mínimo                                       |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Clientes                      | Estrellas de 1 a 5, últimas 100 calificaciones                | 4.2                                          |
| Finalización                  | % de lo aceptado que se entrega, últimos 100                  | 90 %                                         |
| Aceptación                    | % de ofertas aceptadas, últimas 100                           | sin mínimo                                   |
| Puntualidad                   | % entregado antes de la hora mostrada al aceptar, últimas 100 | violaciones repetidas → desactivación        |
| Calidad (piloto)              | % sin problemas verificados; menor −1 %, mayor −3 %           | violaciones repetidas → desactivación        |
| Pedidos 30 días / de por vida | volumen                                                       | sin mínimo; el de por vida nunca se reinicia |

- **Cómo se borra una mala nota:** no se borra a mano. Cada calificación nueva empuja fuera a la más vieja de las 100. Un rechazo tarda 100 ofertas en salir.
- **Protecciones automáticas:** se quitan solas las notas de menos de 5 cuando hubo larga espera en el restaurante, el pedido ya iba tarde al aceptarlo, otros repartidores lo soltaron antes, pedidos agrupados, clima extremo, protestas o caídas del sistema. Los problemas de la comida no cuentan para el repartidor. Las quejas de calidad se verifican antes de contar (hasta 12 horas).
- Un cliente que no califica no afecta. Dejar vencer una oferta cuenta como rechazo. Después de 100 pedidos, cada pedido mueve como máximo 1 % la finalización.

### Puntaje general de 0 a 100 y niveles

- Aceptación 25 puntos, finalización 35, puntualidad 30, estrellas 10 (piloto anunciado el 16 dic 2024). Hoy suma también calidad y pedidos de los últimos 30 días.
- Plata 60 a 64, Oro 65 a 74, Platino 75 a 100.
- **No hay reinicio por trimestre:** el nivel sube y baja en vivo con el puntaje. Si baja del mínimo, **se sigue trabajando**; solo se pierden los premios.
- Hace falta haber hecho 50 entregas; las primeras 50 traen beneficios especiales para todos.

### Qué da cada nivel (no da dinero directo)

- Prioridad en pedidos de mayor pago (más alta cuanto más alto el nivel) y en las ofertas en general: Platino espera menos, luego Oro y luego Plata.
- Prioridad para conectarse cuando la zona está llena. En las zonas del puntaje nuevo, **todos pueden conectarse a cualquier hora**.
- Pausar ofertas de tiendas (Oro: 1 tienda, Platino: 3, por dos semanas).
- Pase Platino: 200 entregas seguidas en Platino dan una semana de Platino garantizada, aunque baje. Si baja antes de 200, el progreso vuelve a cero. Vence al año.
- Soporte VIP y descuentos en DoorDash para Platino.

### Uber Pro [DOC]

- Puntos por cada viaje o entrega (más en horas pico). Se reinician a cero cada tres meses; los puntos de un trimestre fijan el nivel del siguiente.
- Para Oro o más: estrellas 4.85 o más y cancelación menor a 4 % (puede variar por ciudad).
- Los premios son ventajas y descuentos, no bonos por nivel.

## 3. Lo que Divoox ya tiene

| Pieza                                                                                      | Estado                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Estrellas, aceptación, finalización y puntualidad sobre las últimas 100                    | Sí (`metricasRepartidor`)           |
| Notas que fueron culpa del restaurante no cuentan                                          | Sí                                  |
| Repartidor destacado (copia del viejo Top Dasher) y prioridad en ofertas a igual distancia | Sí                                  |
| Niveles Bronce, Plata, Oro y Diamante por puntos (10 por entrega, nunca bajan)             | Sí, pero solo miden volumen         |
| Puntaje general de 0 a 100 con pesos                                                       | **No**                              |
| Niveles por calidad que suben y bajan en vivo                                              | **No**                              |
| Exclusiones automáticas (espera en el restaurante, agrupados, clima)                       | Solo la culpa del restaurante       |
| Pausar tiendas, pase de nivel, soporte prioritario                                         | **No**                              |
| Primeras 50 entregas con beneficios                                                        | **No**                              |
| Premio en dinero                                                                           | **No** (los grandes tampoco lo dan) |

## 4. Números de Divoox

Margen neto por entrega (lo que queda después de pagar al restaurante, al repartidor y a Stripe), con la tarifa actual y 3 dólares de propina:

| Pedido           | Plan del restaurante | Margen neto |
| ---------------- | -------------------- | ----------- |
| 20 dólares, 3 km | Inicial              | 1,34        |
| 30 dólares, 4 km | Inicial              | 2,29        |
| 30 dólares, 4 km | Crece                | 3,79        |
| 25 dólares, 3 km | Élite                | 3,44        |
| 45 dólares, 6 km | Crece                | 5,96        |

Para las cuentas se usa 2,29 dólares por entrega, el pedido típico con el plan más barato. No incluye soporte, seguros, reembolsos ni publicidad: por eso se propone repartir entre 10 y 15 % y no más.

## 5. Decisión propuesta

Copiar el sistema de DoorDash completo y agregar lo que DoorDash no tiene: un premio en dinero por hitos de entregas, pagado como un porcentaje del margen real que generó el repartidor, y solo si llega con buen nivel. Ver el PDF para las tablas y las fases.
