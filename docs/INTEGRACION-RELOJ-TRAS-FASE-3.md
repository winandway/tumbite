# Integración del reloj seguro después de publicar la Fase 3

Fecha: 16 de octubre de 2026. **Plan, no ejecutado: no se fusionó ninguna rama.**

## Estado final del reloj seguro (cierre técnico)

- **Rama:** `fase-reloj-seguro` (código `16cdde4`), sale de `main` (`f5b2b1a`) y es independiente de la Fase 3. **Aprobada técnicamente por Richard el 16 oct; no autorizada para producción.**
- **Resultados conservados en `docs/RELOJ-SEGURO-RESULTADOS.md`:**
  - **521 pruebas en verde**;
  - las pruebas de concurrencia (mismo minuto, vueltas cruzadas, tarea que falla, respuesta perdida);
  - el Manager real con Stripe en modo prueba: un pedido cancelado, una sola anulación y cero devoluciones (pago de prueba `pi_3UR9kbLg6DPw4I7V3BBC1M0O`, corrida 38896272717);
  - el aislamiento de errores, la pieza `reloj` de la salud y los riesgos pendientes.
- **Candado:** C-RELOJ-AISLADO en `CANDADOS.md` de esa rama.

## Dónde se cruzan las dos ramas (comprobado con una fusión de prueba, sin escribir nada)

Ocho archivos se tocan en las dos ramas. Seis chocan: `apps/servidor/src/rutas/operacion.ts`, `apps/servidor/src/app.ts`, `apps/servidor/src/rutas/diagnostico.ts`, `apps/servidor/src/rutas/diagnostico.test.ts`, `scripts/staging/probar-staging.mjs` y `CANDADOS.md`. `schema.sql` y `esquemaColumnas.ts` se unen solos, y la lista de columnas se vuelve a generar de todas formas.

## Pasos, en orden

**1. Publicar primero la Fase 3** con su autorización, como manda el plan. `main` quedará con la Fase 3.

**2. Traer `main` a la rama del reloj:** `git checkout fase-reloj-seguro` y `git merge origin/main`. Se usa una fusión y no un rebase, para no reescribir la historia ya probada.

**3. Resolver cada choque así:**

| Archivo                              | Cómo se resuelve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rutas/operacion.ts`                 | Se queda la versión del reloj seguro (`TAREAS_RELOJ`). La llamada de la Fase 3 `repartirOperaciones(env, db).catch(...)`, con su `catch`, **se borra** y pasa a ser una tarea de la lista: `{ nombre: 'operaciones', critica: true, correr: (env, db) => repartirOperaciones(env, db) }`, justo después de `ofertas`. Sin `catch` propio: si falla, lo atrapa `correrTareas`, queda en `reloj_tareas` y la salud lo ve. La tarea de Comida `tomarPedidoComida` y las demás piezas de la Fase 3 en ese archivo se quedan tal cual |
| `app.ts`                             | Se quedan las dos piezas de la salud: `exclusividad` (Fase 3) y `reloj` (reloj seguro), con sus dos importaciones                                                                                                                                                                                                                                                                                                                                                                                                                |
| `rutas/diagnostico.ts` y su prueba   | Se quedan las dos secciones (F3 y RELOJ) y todas las importaciones                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `scripts/staging/probar-staging.mjs` | Se quedan los dos bloques, F3 y RELOJ, en ese orden                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `CANDADOS.md`                        | Se quedan las dos entradas (C-EXCLUSIVIDAD y C-RELOJ-AISLADO)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**4. La tarea `repartirOperaciones` es crítica:**

- Cambia el estado de operaciones: crea ofertas y devuelve a «buscando» un viaje cuyo conductor perdió la señal.
- Con Moto y Carro apagados, en producción no hace nada.
- Que sea crítica es exactamente lo que habría puesto la salud en rojo el 16 oct de 00:39 a 00:50 UTC, cuando faltaban las tablas de la Fase 3 en el sitio de pruebas.
- Hoy en la Fase 3 su error se traga en silencio con un `catch`; con el reloj seguro queda visible.

**5. Las migraciones son compatibles:**

- `reloj_tareas` es solo tabla e índice, sin disparadores ni `CASE`, así que el divisor de la plataforma la parte bien.
- Va junto a `tareas_programadas`, antes del bloque de la Fase 3. La prueba que exige que el bloque de la Fase 3 no traiga disparadores no se ve afectada.
- Los disparadores y vistas de la Fase 3 siguen creándose al arrancar (`esquemaFase3.ts`), sin cambios.
- La consulta de `saludReloj` no usa uniones, así que no le aplica el límite de cinco partes de D1.
- Hay que regenerar `esquemaColumnas.ts` con `node scripts/generar-columnas.mjs`.

**6. Supervisión:** la salud tendrá `exclusividad` y `reloj`.

- En producción, con solo GitHub, `reloj` estará en `ok` o en `atrasado`, y solo se pondrá en `error` si falla una tarea crítica.
- Antes de publicar se mira la salud del sitio de pruebas: las dos piezas tienen que estar en `ok`.

**7. Pruebas nuevas que se agregan al integrar** (comprobadas en rojo):

- `TAREAS_RELOJ` incluye `operaciones` y está marcada crítica;
- si `operaciones` falla, las demás tareas corren, queda registrado y la salud marca `error`;
- la vuelta del reloj ya no contiene ningún `catch` que trague el error de una tarea (prueba que lee el archivo).

**8. Regresión completa:**

- `npm run verify`: todas las pruebas de las dos ramas juntas, unas 550;
- después, un push a la rama `fase-reloj-seguro`, que publica solo en el sitio de pruebas y corre todo:
  - S2 a S5, S7 y S11 (retiros e idempotencia con Stripe de prueba);
  - F1, M4 y M5, F2 y **F3** (exclusividad con 20 conductores);
  - **RELOJ** (concurrencia y el Manager con Stripe de prueba);
  - tiempo real en vivo, el **recorrido completo de Comida en inglés y en español**, y la conciliación;
  - salud del sitio de pruebas con `exclusividad: ok` y `reloj: ok`.

**9. Después,** y con su autorización por separado:

- publicar el reloj seguro con el mismo procedimiento controlado;
- en otra decisión, activar el trabajador de reloj de producción (`docs/EVALUACION-RELOJ-CLOUDFLARE.md` §B).
