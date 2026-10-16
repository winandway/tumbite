# Reloj seguro: aislamiento de errores y supervisión

Fecha: 16 de octubre de 2026. Rama: **`fase-reloj-seguro`**, que sale de `main` y es independiente de la Fase 3. **Validado solo en el sitio de pruebas. No publicado. Producción intacta. El reloj de producción no se activó.**

## A. Cambios realizados

| Pieza                                                         | Qué hace                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/servidor/src/reloj.ts` (nuevo)                          | `correrTareas`: corre cada tarea con su propio manejo de errores. Si una falla, las demás corren igual, y nunca lanza. `anotarTareas` guarda el resultado de cada tarea. `saludReloj` es la pieza nueva de la salud                                                                                |
| `rutas/operacion.ts`                                          | `TAREAS_RELOJ`: las siete tareas en orden, con las críticas marcadas (ofertas, Manager, conciliación, retiros y conciliación de retiros). `correrReloj` las corre aisladas. `correrRelojUnaVez` sigue con el mismo candado por minuto y ahora guarda «ok» o «parcial» y el resultado de cada tarea |
| `schema.sql`                                                  | Tabla nueva `reloj_tareas`: una fila por tarea y vuelta, con su resultado, su tiempo y su error. Solo tabla e índice, sin disparadores. Se borra a los 7 días                                                                                                                                      |
| `app.ts`                                                      | Pieza `reloj` en la salud                                                                                                                                                                                                                                                                          |
| `rutas/diagnostico.ts` y `scripts/staging/probar-staging.mjs` | Prueba «RELOJ» en el sitio de pruebas, con la base real y Stripe en modo prueba                                                                                                                                                                                                                    |

**Recuperación:** una tarea que falla se vuelve a intentar sola en la vuelta siguiente. Es seguro porque todas son repetibles, y lo que mueve dinero usa siempre la misma clave en Stripe.

**Cambio de comportamiento a propósito:** antes, la conciliación, los retiros y las fotos tragaban sus errores con un `catch` vacío y la vuelta salía «bien». Ahora un error se ve: queda registrado y, si la tarea es crítica, la salud lo marca.

### La pieza «reloj» de la salud

| Modo                                                 | Error cuando…                                                                                                                                                                 | Otros estados                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Con el reloj de Cloudflare configurado (cada minuto) | no hubo una vuelta buena en 5 minutos; o hubo 3 o más vueltas con error en 15 minutos; o la última vuelta tuvo una tarea crítica fallida, **aunque la vuelta haya terminado** | `ok` en cuanto llega una vuelta buena y las fallidas salen de la ventana                          |
| Solo GitHub (hoy en producción)                      | la última vuelta tuvo una tarea crítica fallida                                                                                                                               | `atrasado` si pasan 6 horas sin vuelta buena; **nunca error solo por la impuntualidad de GitHub** |
| Sin vueltas todavía                                  | —                                                                                                                                                                             | `pendiente`                                                                                       |

## B. Pruebas ejecutadas y resultados

**Local:** `npm run verify` completo con **521 pruebas en verde** (antes 506): tipos, lint, compilación, auditoría sin vulnerabilidades.

**Nuevas (`reloj.test.ts`, 14, y 1 en `diagnostico.test.ts`).** Las de aislamiento y las de fallo crítico se comprobaron en rojo, quitando la protección a propósito.

- Una tarea que falla no frena a las demás, y cada resultado queda guardado.
- `correrTareas` nunca lanza un error, aunque fallen todas las tareas.
- Las tareas de dinero están marcadas como críticas.
- GitHub y Cloudflare en el mismo minuto: corre una sola vez.
- Reintento después de una respuesta perdida, con la misma ventana: no se repite nada.
- Una vuelta lenta se cruza con la siguiente: las dos corren y el dinero se mueve una sola vez.
- Dos vueltas cruzadas, más un reintento, con el Manager real: un solo pedido cancelado, **una sola anulación en Stripe** y ninguna devolución.
- La salud, en sus cuatro situaciones: sin vuelta buena en 5 minutos, 3 fallidas en 15 minutos, fallo crítico en la última vuelta, y recuperación. También el modo solo GitHub, y la salud completa en 503 con un fallo crítico.

**Sitio de pruebas, base D1 real y Stripe en modo prueba (corrida 38896272717): todo en verde.**

| Caso                                                                                      | Resultado                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. GitHub y Cloudflare en el mismo minuto                                                 | ✅ una sola vuelta                                                          |
| 2 y 4. Una vuelta que tarda más de lo normal se cruza con la del minuto siguiente         | ✅ las dos corren; la operación de dinero de prueba se hizo **1** vez       |
| 3. Una tarea que falla a mitad                                                            | ✅ la de antes y la de después corrieron; las tres quedaron registradas     |
| 5. Reintento tras una respuesta perdida                                                   | ✅ «ya hecho»; nada se repitió                                              |
| 6. Manager real con un pago de prueba real de Stripe, dos vueltas cruzadas y un reintento | ✅ pedido cancelado una sola vez; en Stripe, «canceled»; **0 devoluciones** |
| 7. Ninguna operación de dinero dos veces                                                  | ✅ en todos los casos                                                       |
| Limpieza                                                                                  | ✅ no quedó nada temporal                                                   |
| Salud del sitio de pruebas                                                                | ✅ `reloj: ok` con el reloj de Cloudflare corriendo cada minuto             |

**Regresiones (la misma corrida):**

- S2 a S5, S7 y S11 (retiros e idempotencia con Stripe de prueba);
- F1 (catálogo, Moto y Carro bloqueados);
- M4 y M5;
- F2 (reloj y lote);
- tiempo real en vivo;
- **recorrido completo de Comida en inglés y en español**;
- conciliación de saldos contra Stripe.

Todo en verde.

Las pruebas de la Fase 3 y de la exclusividad viven en su propia rama. El sitio de pruebas se volvió a publicar con la Fase 3 para repetirlas: ver §E.

**Sobre «más de un minuto»:** en el sitio de pruebas, la vuelta lenta tardó 3 segundos, no 60. Lo que se prueba es el cruce con la vuelta siguiente, que tiene otra llave de minuto. Un minuto entero de espera dentro de una petición choca con los límites de tiempo de la plataforma. En las pruebas locales el cruce se probó igual.

## C. Riesgos pendientes

1. **Una tarea que se cuelga sin terminar** frena a las que vienen detrás en esa vuelta. No hay un tiempo máximo por tarea, porque una consulta de la base no se puede cortar a mitad. Mitigación: la vuelta siguiente, con otra llave, corre igual, y la salud lo marca en 5 minutos.
2. **Fusión con la Fase 3:** las dos ramas tocan la lista de tareas del reloj. La Fase 3 agrega «operaciones». Después de publicar la Fase 3, esta rama se actualiza y se agrega esa tarea como crítica, con las pruebas otra vez.
3. **Producción más estricta al publicar esto:** si alguna tarea crítica falla hoy en silencio en producción (antes se tragaban los errores), la salud se pondrá en rojo. Es lo correcto, pero puede frenar el semáforo de esa publicación.
4. **El respaldo diario** sigue dependiendo del reloj de GitHub, que corre una vez al día como mínimo.
5. **Pantalla de carga sin avanzar una vez** en la app del cliente del sitio de pruebas (ver §E). No se repitió; se revisará en el hito del catálogo.
6. Cuando se crucen dos vueltas, un pedido puede ofrecerse a dos repartidores a la vez. Uno solo se lo lleva. Ya pasaba antes.

## D. Producción permanece intacta

- Producción sirve `f5b2b1a`.
- `main` está en `f5b2b1a`.
- Ninguna tabla nueva en la base de producción: ni `reloj_tareas` ni las de la Fase 3.
- Moto y Carro apagados. Solo Comida implementada.
- Retiros apagados: sin bandera, 0 retiros.
- El trabajador de reloj de Cloudflare sigue apuntando **solo** al sitio de pruebas. No se creó ningún trabajador nuevo.
- No hubo ninguna operación financiera real.

## E. Conciliación del 16 y sitio de pruebas

- **Conciliación:** a las 12:05 UTC, la del 16 todavía no existe (corre después de las 00:00 UTC del 17). La del 15 sigue intacta (`cuadra = 0`). La vigilancia de solo lectura sigue activa.
- **Sitio de pruebas:** como esta rama se publicó en el sitio de pruebas, se volvió a publicar ahí la rama de la Fase 3 (corrida 38898083294), para que quede validado con lo que espera publicarse. **Resultado: en verde** en el segundo intento: F3, el tiempo real en vivo, el recorrido completo de Comida en inglés y en español, y la conciliación. En el primer intento, el recorrido en español falló una vez porque la app del cliente se quedó en una **pantalla de carga sin avanzar** (escarlata, con el círculo girando) al volver al inicio (no hubo lista vacía: la app no pasó de su pantalla de carga; registro en `docs/incidencias/2026-10-16-pantalla-de-carga.md`). El mismo paso había pasado en todas las corridas anteriores y pasó al repetir. Queda anotado como riesgo para vigilar en el hito del catálogo.
