# Incidencia: la app del cliente se quedó en la pantalla de carga (sitio de pruebas)

Registrada el 16 de octubre de 2026. **Solo registro: no se investigó la causa, no se supone ninguna y no se modificó la app.** Se investigará junto con la corrección del catálogo.

## Qué se vio (hechos)

- **Dónde:** sitio de pruebas, `https://staging.tumbite.com/app/`, app del cliente en la web.
- **Cuándo:** corrida 38898083294 de `pruebas-rama`, primer intento, rama `fase-3-exclusividad`, versión `4f530e1` (la Fase 3), 16 oct 2026, corrida empezada a las 12:05 UTC. Recorrido en **español**, paso 13 («el cliente paga y se arrepiente»).
- **Qué hizo la prueba:** volvió al inicio de la app (`/app/`) para elegir el restaurante «Pizza Bella xl23u» y esperó 15 segundos.
- **Qué mostró la pantalla:** **la pantalla de carga de la app: fondo escarlata con el círculo de carga girando, sin ningún texto ni botón.** No es una pantalla blanca: en los informes anteriores la llamé «en blanco» porque el texto de la página estaba vacío; la captura muestra la pantalla de carga.
  - Captura: `docs/incidencias/2026-10-16-pantalla-de-carga.png`. Las otras capturas y el rastro completo están en la carpeta local `registros/`.
- **Qué pasó después:**
  - en esa misma corrida, el recorrido en inglés pasó entero;
  - al repetir la corrida, el segundo intento pasó en los dos idiomas;
  - el mismo paso había pasado en las 7 corridas completas anteriores del 16 de octubre (de la 38837721721 a la 38896272717), todas en verde.
- **No afectó a producción:** fue en el sitio de pruebas.

## Registros conservados

| Archivo                            | Dónde                                                                                              | Qué es                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `2026-10-16-pantalla-de-carga.png` | `docs/incidencias/` (en el repositorio)                                                            | La captura del momento del fallo                                                                                                     |
| `depurar-inicio.png`               | `registros/2026-10-16-pantalla-de-carga/` (solo en esta computadora, fuera de git por peso: 37 MB) | La captura que toma el propio recorrido al fallar                                                                                    |
| `test-failed-1..4.png`             | igual                                                                                              | Capturas de las otras pantallas abiertas en ese momento (panel, repartidor, cliente)                                                 |
| `error-context.md`                 | igual                                                                                              | El error exacto: «locator.click: Timeout 15000ms exceeded — waiting for getByText('Pizza Bella xl23u')» y el estado de las pantallas |
| `trace.zip`                        | igual                                                                                              | El rastro completo de Playwright: red, consola y cada paso. Se abre con `npx playwright show-trace`                                  |
| Paquete original                   | GitHub, corrida 38898083294, «recorrido-staging»                                                   | Se borra solo el **23 de octubre de 2026**; la copia local ya está hecha                                                             |

En la consola del rastro aparecen errores de **toda** la corrida, no solo de ese momento:

- el bloqueo del script de estadísticas de Cloudflare por la política de seguridad de la página;
- respuestas 400, 401, 404 y 409 de pasos que se prueban a propósito;
- «sin conexión», del paso que corta internet a propósito.

**No se determinó cuál, si alguno, tiene relación con la pantalla de carga.**

## Qué hará falta al investigarla (con el catálogo)

1. Abrir el rastro en el minuto del fallo. Ver qué peticiones hizo la app al cargar el inicio y cuáles quedaron sin respuesta.
2. Repetir el recorrido varias veces en el sitio de pruebas para medir cuántas veces se repite.
3. Recién con eso, decidir la causa y la corrección, con su prueba en rojo comprobado.

## Investigación del 16 de octubre (sin tocar la app)

### 1. Qué dice el rastro (`trace.zip`, registro de la app del cliente)

- En la última carga del inicio, la app descargó su página y su código (respuestas 200 y 304) y pidió **`GET /datos/cuentas/yo`**, la comprobación de la sesión guardada, a las **12:17:09.212 UTC**.
- **Esa petición no recibió respuesta** en los más de 15 segundos que esperó la prueba. Fue la última petición del registro.
- La app **no llegó a pedir los restaurantes**: no hay ningún `GET /datos/restaurantes` después de esa carga.
- Las 5 comprobaciones de sesión anteriores de ese mismo cliente, entre las 12:16:08 y las 12:17:07, respondieron 200 en 74 a 82 milisegundos.
- La consola de esa última carga no tiene errores propios. Los errores de consola del registro son de otros pasos de la corrida.

### 2. Qué esperaba la app (comprobado en el código, `packages/movil/src/sesion.tsx`)

- Al abrir, si hay una sesión guardada, la app llama a `yo()` y **muestra la pantalla de carga hasta que esa llamada termine** (`cargando`).
- Si la llamada falla, la app sigue sin problema: pide entrar de nuevo.
- Pero **si la llamada no termina nunca, la app se queda en la pantalla de carga para siempre.**
- La llamada no tiene límite de tiempo: `crearApi` no usa `AbortSignal` ni ningún temporizador.

### 3. ¿Hay una causa comprobable?

- **Del lado de la app, sí:** la pantalla de carga depende de una sola petición sin límite de tiempo. Cualquier petición que se cuelgue deja a la persona atrapada, sin mensaje y sin «Reintentar». Esto está comprobado en el código y en el rastro.
- **Del lado del servidor, no está comprobado** por qué esa petición no respondió:
  - en el registro del sitio de pruebas no hay ningún error a esa hora;
  - la última publicación fue a las 12:11, seis minutos antes;
  - el rastro del navegador no muestra si la petición llegó o no al servidor.

  No se supone ninguna causa del servidor.

### 4. ¿Se repite?

| Medición, en el sitio de pruebas                                                                    | Resultado                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 300 comprobaciones de sesión seguidas (`/datos/cuentas/yo`)                                         | Todas respondieron. Mediana 0,23 s, el 95 % por debajo de 0,54 s, la más lenta 2,1 s. **Ninguna colgada**           |
| 100 aperturas completas de la app en un navegador real, con sesión guardada, como hace el recorrido | **100 de 100 mostraron el inicio.** Mediana 0,9 s, la más lenta 2,5 s. **Ninguna se quedó en la pantalla de carga** |
| Corridas completas del recorrido el 16 oct                                                          | 1 fallo (este). Las 7 corridas completas anteriores y la repetición pasaron                                         |

Las dos cuentas de medición se borraron del sitio de pruebas al terminar.

### 5. No es el problema del catálogo

|                         | Catálogo que aparece y desaparece                                                    | Esta pantalla de carga                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Qué se ve               | El inicio, con la lista de restaurantes que cambia o queda vacía                     | La pantalla de carga escarlata, sin inicio                                     |
| Dónde se traba          | Después: las respuestas de `/datos/restaurantes` llegan, pero en desorden y se pisan | Antes: la comprobación de la sesión no responde y la app nunca llega al inicio |
| Pedidos de restaurantes | Sí, dos o más                                                                        | Ninguno                                                                        |
| ¿Se reproduce?          | Siempre, con los datos de hoy (comprobado)                                           | 1 vez en el recorrido; 0 de 100 aperturas                                      |

**Lo que tienen en común:** en los dos casos la app confía en que cada petición responda bien y a tiempo. Por eso conviene corregirlos juntos.

### 6. La prueba de regresión preparada (se agregará con la corrección, no antes)

En `packages/movil` (pruebas de la sesión), con el servidor simulado:

1. **Comprobación de sesión colgada:** `yo()` nunca responde. A los N segundos (propuesta: 8 segundos, como la espera del GPS), la app tiene que salir de la pantalla de carga. Puede seguir con la sesión guardada, marcada «sin confirmar», o mostrar «Reintentar». No puede quedarse cargando. _Hoy esta prueba falla: así se comprueba en rojo._
2. **Respuesta lenta pero válida** (por ejemplo, 3 segundos): la app entra con la sesión, como hoy.
3. **Error de red:** como hoy, pide entrar de nuevo.

En el recorrido del sitio de pruebas: al fallar ese paso, guardar también qué peticiones quedaron pendientes. Ya se guardan en el rastro, pero hoy hay que buscarlas a mano.

**La corrección no se implementa todavía**: se decide y se hace junto con el catálogo.
