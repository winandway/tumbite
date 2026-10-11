# Investigación: ¿una app o varias? y sistema de rangos

10 de octubre de 2026. Fuentes al final. Lo que no se pudo confirmar en fuente oficial está marcado.

## 1. ¿Una sola app o varias?

### Qué hacen los grandes (hecho comprobable en las tiendas)

- **DoorDash:** tres apps. DoorDash (cliente), Dasher (repartidor), DoorDash Merchant / Order Manager (restaurante).
- **Uber:** Uber Eats (cliente), Uber Driver (repartidor y chofer en una), Uber Eats Orders (restaurante).
  Es lo normal en la industria.

### Ventajas de separar

1. **Ubicación en segundo plano.** Solo el repartidor necesita que el teléfono comparta su ubicación todo el tiempo. Apple y Google revisan ese permiso con lupa (regla 2.5.4 de Apple; política de ubicación en segundo plano de Google). Hay casos de rechazo cuando el revisor cree que la app «rastrea empleados». Si va en una app aparte, el cliente nunca ve ese permiso y la revisión es más limpia.
2. **La tienda habla con cada público.** El cliente busca «pedir comida», el repartidor busca «trabajar repartiendo». Fichas, fotos y reseñas separadas. Las malas reseñas de repartidores no le bajan la nota a la app del cliente.
3. **App más liviana y simple** para cada uno.
4. **Actualizaciones independientes:** se arregla algo del repartidor sin tocar al cliente.
5. **Seguridad:** el código del panel del restaurante no viaja en el teléfono de cada cliente.

### Desventajas de separar

1. Tres fichas en cada tienda, tres revisiones de Apple y Google por publicación.
2. Algo más de trabajo de mantenimiento.

### ¿Se puede hacer una sola app con roles?

**Sí, técnicamente se puede.** La persona se registra, elige qué es (cliente, repartidor, restaurante) y la app le muestra su sistema. El riesgo real es el permiso de ubicación permanente dentro de la app del público y una ficha de tienda confusa.

### Recomendación

**Un solo código, tres apps.** Se programa una vez (todo lo común se comparte) y de ese mismo código salen tres apps con su propio nombre en la tienda. Tenemos las ventajas de separar casi sin el costo de mantener tres proyectos. La app del restaurante, además, abre en tablet.

## 2. Rangos y reparto de pedidos

### DoorDash (fuente oficial: centro de ayuda de Dashers)

- Mínimos para no ser desactivado: **calificación de clientes 4,2** y **tasa de completados 90 %**, medidas sobre los últimos 100 pedidos u ofertas (se renuevan con el tiempo).
- **La tasa de aceptación no tiene mínimo**, pero aceptar más ayuda a recibir más pedidos.
- Hay tasa de puntualidad; llegar tarde repetidamente puede llevar a desactivación.
- Tiene proceso de apelación dentro de la app.

### DoorDash «Top Dasher» (fuentes de terceros, NO confirmado en DoorDash)

- Requisitos que se citan: calificación 4,7 o más, aceptación 70 % o más, completados 95 % o más, 100 entregas el mes anterior, 200 entregas en total.
- Beneficios que se citan: trabajar sin horario reservado, **prioridad cuando dos repartidores pueden tomar el mismo pedido**, prioridad en pedidos de 30 dólares o más.
- Blogs de repartidores dicen que en algunas ciudades fue reemplazado por «Dasher Rewards». No se encontró confirmación oficial.

### Cómo asigna DoorDash (blog de ingeniería, 2020-2021)

Un optimizador decide con: distancia, tiempo de espera hasta que la comida esté lista, tiempo de entrega al cliente y probabilidad de que el repartidor acepte. **No hay fuente pública que diga cuánto pesa la calificación** en la asignación. Que «el algoritmo le da más a los mejores» es en parte confirmado (prioridad de Top Dasher en empates) y en parte rumor.

### Uber Pro (fuente oficial: términos del programa)

- Cuatro niveles: **Azul, Oro, Platino, Diamante**. Todos empiezan en Azul.
- Se sube juntando **puntos** por viajes y entregas, y cumpliendo metas de aceptación, cancelación, estrellas y manejo seguro.
- Cada nivel trae sus premios más los del anterior.
- Los puntos exactos cambian por ciudad y no son públicos fuera de la app.

## 3. Propuesta para Tumbite

### Niveles de repartidor (nombres por definir)

Cuatro niveles, se sube por **puntos** (cada entrega suma; más en horas pico) y se mantiene por **calidad**: estrellas, completados, puntualidad. Medido sobre los últimos 100 pedidos.

### Cómo se reparte un pedido

1. **Primero cercanía y rapidez** para el cliente. La comida caliente manda.
2. **El nivel desempata**: si dos están igual de cerca, gana el de nivel más alto.
3. Niveles altos: acceso primero a pedidos grandes y libertad de horario.

### Lo que nos diferencia (justicia y transparencia)

- **Rechazar un pedido no castiga.** Así nadie se ve obligado a tomar pedidos mal pagados (queja frecuente contra DoorDash).
- **Las estrellas injustas no cuentan.** Si la queja es por algo del restaurante (comida fría por demora en cocina, pedido incompleto), no afecta al repartidor.
- **El repartidor ve exactamente** cuántos puntos tiene, cuánto le falta y por qué subió o bajó.
- **Aviso antes de bajar** de nivel o de quedar en riesgo, y apelación dentro de la app.

### Niveles también para restaurantes

Por calificación, rapidez de preparación y pocos pedidos cancelados. Alimenta el **programa de música**: los de nivel más alto son los candidatos a la banda en vivo y a la publicidad pagada por nosotros. Los clientes también suben de nivel con sus compras (fidelidad).

## Fuentes

- https://help.doordash.com/en-us/dashers/article/dasher-ratings-explained
- https://help.doordash.com/en-us/dashers/article/deactivation-policy-us-english-dx
- https://about.doordash.com/en-us/news/doordash-announces-changes-for-account-deactivations
- https://careersatdoordash.com/?p=1350
- https://careersatdoordash.com/?p=5342
- https://www.triplog.net/blog/doordash-top-dasher-requirements-everything-you-need-to-know
- https://www.ridesharingdriver.com/doordash-top-dasher/
- https://www.uber.com/us/en/legal/uber-pro-program-terms/
- https://www.uber.com/legal/rewards-program/uberpro/us-en/
- https://triplog.net/blog/uber-pro-explained-everything-drivers-need-to-know
- https://developer.apple.com/forums/thread/771202
- https://developer.apple.com/forums/thread/671943
- https://support.google.com/googleplay/android-developer/answer/9799150?hl=en
- https://hypertrack.com/docs/prepare-for-app-store-submission
