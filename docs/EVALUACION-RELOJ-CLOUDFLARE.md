# Evaluación del reloj de Cloudflare para producción

Fecha: 16 de octubre de 2026, 11:40 UTC. **Solo evaluación: no se cambió nada en producción, ni en Cloudflare ni en el código.**

## Veredicto

**Es seguro activarlo, con dos condiciones previas:** dos cambios pequeños de código (§A.4 y §A.6) y un trabajador aparte para producción, que es un recurso nuevo y necesita su sí. Todo lo que hace el reloj ya lo hace hoy el de GitHub. Lo único que cambia es la frecuencia: de cada 2 a 5 horas a cada minuto.

## A. Evaluación de seguridad

### 1. Qué tareas ejecuta (en este orden, en cada vuelta)

`correrReloj` en `apps/servidor/src/rutas/operacion.ts`:

1. **Ofrecer pedidos** sin repartidor (`repartirOfertas`).
2. **Operaciones de la Fase 3** (`repartirOperaciones`). Solo cuando la Fase 3 esté publicada; en producción no hay operaciones.
3. **El Manager** (`vigilarPedidos`): avisos, pone en rojo y **cancela con devolución** los pedidos que nadie confirma.
4. **Conciliación del día anterior** (`conciliarAyer`): una vez al día.
5. **Retiros dudosos** (`procesarRetirosPendientes`) y su conciliación diaria.
6. **Borrar fotos de más de 30 días** (`depurarFotos`).
7. Limpieza de sus propios registros (vueltas de más de 7 días, firmas de más de 10 minutos).

El **respaldo diario** NO está en esta lista: es un paso aparte del flujo de GitHub. Se queda en GitHub, que lo pide en cada vuelta y solo lo hace si ese día todavía no hay respaldo. Alcanza con que GitHub corra una vez al día.

### 2. Cuáles pueden cambiar pedidos, estados o dinero

| Tarea           | Qué puede cambiar                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Ofrecer pedidos | Crea ofertas. No toca el pedido ni el dinero                                                                             |
| Manager         | **Cancela pedidos y anula o devuelve el pago en Stripe**                                                                 |
| Conciliación    | Escribe la fila del día. No mueve dinero; si no cuadra, manda un correo al equipo                                        |
| Retiros         | Podría transferir dinero, pero solo de retiros ya pedidos. Hoy no hay ninguno y nadie puede pedir uno (retiros apagados) |
| Fotos           | Borra archivos viejos del almacén y lo anota                                                                             |
| Operaciones     | Crea ofertas de viaje. No hay viajes                                                                                     |

### 3. El candado contra vueltas duplicadas (C-RELOJ-UNA-VEZ)

- Los dos relojes entran por `correrRelojUnaVez`: GitHub por `/datos/reloj`, Cloudflare por `/datos/interno/reloj`, con firma.
- Cada vuelta tiene una llave: el minuto, por ejemplo `reloj:2026-10-16T11:40`.
- La primera sentencia es `INSERT OR IGNORE` en `tareas_programadas` con esa llave. Si ya existe, esa vuelta responde «ya hecho» y no corre nada.
- Es una sola sentencia en la base: dos llamadas en el mismo minuto nunca corren las dos.
- Además, el servidor solo acepta la llamada de Cloudflare con firma válida, dentro de 60 segundos y con un número de un solo uso.

### 4. ¿Aguantan reintentos y fallos a medias?

| Tarea           | Si se repite                                                                                                                                                                                                  | Si falla a mitad                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ofrecer pedidos | Sin efecto: no ofrece lo que ya tiene oferta abierta                                                                                                                                                          | Lo que no se ofreció se ofrece en la vuelta siguiente                                 |
| Manager         | **Sí aguanta:** cancelar es una sentencia condicionada al estado. Stripe recibe siempre la misma clave (`anular-<pedido>`, `reembolso-<pedido>`), así que nunca hay dos devoluciones (C-ANULACION-VERIFICADA) | Si Stripe no contesta, antes de revivir el pedido se le pregunta a Stripe si devolvió |
| Conciliación    | Sin efecto: si ya está la fila del día, no hace nada                                                                                                                                                          | La vuelta siguiente la vuelve a intentar                                              |
| Retiros         | Probado: misma clave en Stripe y un solo dueño por retiro (S11 en el sitio de pruebas)                                                                                                                        | Un resultado dudoso nunca devuelve saldo; pasa a revisión                             |
| Fotos           | Sin efecto                                                                                                                                                                                                    | Sigue en la vuelta siguiente                                                          |

**⚠️ Punto débil encontrado hoy (condición 1):** si una tarea lanza un error, las tareas que vienen después **no corren en esa vuelta**. Ofrecer pedidos va primero y no está protegida: si fallara cada minuto, el Manager y la conciliación quedarían parados mientras dure el fallo. Pasó en el sitio de pruebas de 00:39 a 00:50 UTC de hoy, durante mi primera subida de la Fase 3 con el esquema roto: 11 vueltas con error, seguidas. **Antes de activar,** cada tarea debe ir aislada con su propio manejo de errores y quedar anotada en el resultado de la vuelta. Es un cambio pequeño.

### 5. Si los dos relojes corren a la vez

- **En el mismo minuto:** corre uno solo. Probado en la base real de pruebas (F2) y en las pruebas automáticas: dos relojes a la vez dieron una sola transferencia de retiro.
- **En minutos distintos, solapados** (GitHub entra a las 11:40:59 y Cloudflare a las 11:41:00): corren las dos vueltas a la vez. No hay riesgo de dinero, por lo del punto 4.
  - Lo peor que puede pasar es que un pedido quede ofrecido a dos repartidores a la vez. La aceptación es atómica: uno se lo lleva y el otro ve «Otro repartidor ya tomó este pedido». Esto ya puede pasar hoy, porque cada repartidor con la app abierta también dispara el reparto.

### 6. Cómo se vigila

**Lo que hay:**

- cada vuelta queda en `tareas_programadas`, con su origen y su resultado;
- el trabajador tiene registro activo en Cloudflare;
- la conciliación avisa por correo si no cuadra.

**⚠️ Lo que falta (condición 2):** la salud no mira el reloj de producción. La pieza `tiempoReal` mira cuándo EMPEZÓ la última vuelta, no si TERMINÓ bien: las 11 vueltas con error de hoy no la habrían puesto en rojo.

**Antes de activar:** una pieza `reloj` en la salud, que diga:

- `error` si la última vuelta terminada con éxito tiene más de 5 minutos;
- `error` si hubo 3 o más vueltas con error en los últimos 15 minutos.

El semáforo y cualquier monitor la verían.

### 7. Cómo se apaga de inmediato

Tres caminos, sin borrar datos. GitHub sigue como respaldo en los tres:

1. **El más rápido, en segundos:** en Cloudflare, quitar el disparador por minuto del trabajador de producción (`wrangler triggers deploy` sin horarios, o desde el panel).
2. **En uno o dos minutos:** borrar la variable `INTERNO_LLAVE_ID` del sitio tumbite y republicar. La ruta interna desaparece y el trabajador recibe «no encontrado».
3. Borrar el trabajador de producción.

### 8. ¿Se puede activar con Moto y Carro apagados y retiros apagados?

**Sí.**

- Ninguna tarea del reloj enciende servicios: el código solo declara Comida y la base no deja encender otro.
- Los retiros siguen apagados: el reloj solo procesa retiros ya pedidos (hoy, cero), y sin la bandera `retiros_activos` nadie puede pedir uno.
- Activar el reloj no cambia ninguna de las dos cosas.

### 9. Qué pruebas del sitio de pruebas lo respaldan

| Prueba                                                                                                  | Resultado                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Reloj de Cloudflare funcionando en el sitio de pruebas desde el 15 oct, 18:22 UTC                       | **1.025 vueltas en 17 horas** (una por minuto); 11 con error, todas del rato con el esquema roto de hoy |
| F2: GitHub y Cloudflare en el mismo minuto                                                              | Una sola vuelta (D1 real)                                                                               |
| Prueba en vivo: «nunca dos vueltas en el mismo minuto»                                                  | Verde en cada corrida                                                                                   |
| `retiros.test.ts`: dos relojes a la vez                                                                 | Una sola transferencia (comprobada en rojo)                                                             |
| Recorrido completo de Comida con el reloj activo, incluido el Manager cancelando a tiempo y devolviendo | Verde en inglés y en español                                                                            |
| S11: dos procesos sobre el mismo retiro con Stripe de prueba                                            | Una sola transferencia                                                                                  |

## B. Plan de activación y reversión (cuando se autorice)

**Antes, en el código** (una rama nueva, validada en el sitio de pruebas como siempre):

1. Cada tarea del reloj aislada, con su error anotado (condición 1).
2. Pieza `reloj` en la salud (condición 2).

**Cambios exactos en producción:**

1. **Un trabajador nuevo, `tumbite-reloj-produccion`**, en la cuenta de Cloudflare de Tumbite. Va separado del de pruebas, para poder apagar uno sin tocar el otro. **Es un recurso nuevo: necesita su sí explícito**, porque el perímetro de hoy solo incluye `tumbite-tiempo-real` y `tumbite-reloj`. Cuesta cero en el plan gratuito.
2. Una llave interna NUEVA de producción, distinta de la de pruebas. Se genera aquí, se guarda en el archivo privado y se carga con la herramienta de secretos en el trabajador y en las variables del sitio tumbite (`INTERNO_LLAVE_ID`, `INTERNO_SECRETO_ACTUAL`). Nadie la ve; no pasa por el chat.
3. Republicar el sitio tumbite para que lea las variables.
4. Comprobar durante 30 minutos: una vuelta por minuto con origen «externo», ninguna con error, salud `reloj: ok`, y que GitHub, cuando llegue, responda «ya hecho» si cae en el mismo minuto.

**Reversión:** quitar el disparador del trabajador (segundos), borrar las dos variables del sitio y republicar. Todo vuelve exactamente a hoy (solo GitHub). No hay datos que deshacer.

**Orden recomendado:** publicar la Fase 3 → la rama con las dos condiciones → activar el reloj de producción → el catálogo. Así el catálogo se prueba ya con el Manager puntual.

## C. Estado de la conciliación (11:36 UTC)

- La del 15 de octubre sigue intacta (`cuadra = 0`); no se tocó.
- La del 16 todavía no existe, lo normal: solo puede correr después de las 00:00 UTC del 17.
- La vigilancia de solo lectura sigue activa, revisando cada 10 minutos.
- No se lanzó el reloj a mano.

## D. Estado de preparación de la Fase 3

- Sin cambios: lista en la rama `fase-3-exclusividad`, el sitio de pruebas en verde.
- **No está en `main` ni en producción** (producción sirve `f5b2b1a`).
- Bloqueada solo por la conciliación del 16 (salud `dinero: error` hasta entonces).
