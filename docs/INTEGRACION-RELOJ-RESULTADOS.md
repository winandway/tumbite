# Integración del reloj seguro con la Fase 3: resultados

Fecha: 16 de octubre de 2026. Rama: `fase-reloj-seguro` (commit de integración `5959c5f`). **Solo en la rama y en el sitio de pruebas. No publicado. El reloj de producción no se activó. Ninguna operación de dinero real.**

## Qué se hizo

1. Se trajo `main` (con la Fase 3 publicada, `36f4e35`) a la rama del reloj seguro con una fusión, sin reescribir la historia.
2. Se resolvieron **los mismos 6 conflictos** que preveía `docs/INTEGRACION-RELOJ-TRAS-FASE-3.md`, como estaba escrito:

| Archivo                              | Cómo quedó                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rutas/operacion.ts`                 | Se queda la lista `TAREAS_RELOJ`. **`operaciones` (Fase 3) es una tarea crítica más, justo después de `ofertas`, sin `catch` propio.** Se borró la llamada vieja que tragaba sus errores. `tomarPedidoComida` y el resto de la Fase 3 quedan intactos. El resumen de cada vuelta incluye `operaciones` |
| `app.ts`                             | La salud tiene las dos piezas: `exclusividad` (Fase 3) y `reloj` (reloj seguro)                                                                                                                                                                                                                        |
| `rutas/diagnostico.ts` y su prueba   | Las dos secciones, F3 y RELOJ, con todas sus importaciones                                                                                                                                                                                                                                             |
| `scripts/staging/probar-staging.mjs` | Corre F3 y después RELOJ                                                                                                                                                                                                                                                                               |
| `CANDADOS.md`                        | Las dos entradas: C-EXCLUSIVIDAD y C-RELOJ-AISLADO, esta última actualizada                                                                                                                                                                                                                            |

3. Se regeneró la lista de columnas (79 tablas, con `reloj_tareas`).
4. **3 pruebas nuevas de integración**, comprobadas en rojo:
   - `operaciones` está en la lista y es crítica;
   - si `operaciones` falla (sin sus tablas, como pasó en el sitio de pruebas el 16 oct), las demás tareas corren, queda registrado y la salud marca `error`;
   - la lista de tareas no tiene ningún `catch` que trague errores.

## Pruebas

**Local:** `npm run verify` completo, con **553 pruebas en verde** (521 del reloj seguro + las de la Fase 3 + 3 nuevas), tipos, lint, compilación y auditoría sin vulnerabilidades.

**Sitio de pruebas** (corrida 38923712904, base D1 real y Stripe en modo prueba): **todo en verde al primer intento.**

| Prueba                                                                                                                                                       | Resultado                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Tipos, lint, pruebas, compilación, auditoría y gitleaks                                                                                                      | ✅                                                                |
| Paquetes de pruebas y de producción revisados; semáforo del sitio de pruebas                                                                                 | ✅                                                                |
| S2 a S5, S7 y **S11** (retiros e idempotencia con Stripe de prueba)                                                                                          | ✅                                                                |
| F1 (catálogo; Moto y Carro no se pueden encender), M4 y M5                                                                                                   | ✅                                                                |
| F2 (reloj y lote)                                                                                                                                            | ✅                                                                |
| **F3** (exclusividad: 20 conductores a la vez, un ganador; reintentos; un conductor contra dos viajes y un pedido)                                           | ✅                                                                |
| **RELOJ** (mismo minuto, vueltas cruzadas, tarea que falla, reintento, Manager real con un pago de prueba de Stripe: una sola anulación y cero devoluciones) | ✅                                                                |
| Tiempo real en vivo                                                                                                                                          | ✅                                                                |
| **Recorrido completo de Comida en inglés y en español**                                                                                                      | ✅ los dos                                                        |
| Conciliación de saldos contra Stripe en modo prueba                                                                                                          | ✅                                                                |
| Salud del sitio de pruebas después de la corrida                                                                                                             | ✅ `exclusividad: ok`, `reloj: ok`, `dinero: ok`, `servicios: ok` |

## Moto y Carro, y los retiros

- La integración no cambia la lista de servicios implementados: sigue solo Comida.
- No escribe en el catálogo.
- F1 (el sitio de pruebas) comprueba otra vez que la base no deja encender Moto ni Carro.
- Los retiros no se tocan: S11 lo vuelve a comprobar con Stripe de prueba, y la bandera sigue apagada.

## Riesgos

1. **Producción más estricta al publicar:** la conciliación, los retiros, las fotos y las operaciones ya no tragan sus errores. Si alguna falla hoy en silencio, la salud se pondrá en rojo. Es lo correcto, pero puede frenar el semáforo de esa publicación.
2. **Con solo GitHub** (hoy en producción), la pieza `reloj` estará en `ok` o en `atrasado`, nunca en error por la impuntualidad. El reloj de Cloudflare de producción sigue pendiente de su autorización aparte.
3. **Una tarea que se cuelga** sin terminar sigue frenando a las de detrás en esa vuelta. La salud lo detecta en 5 minutos.
4. **La pieza «dinero»** sigue en rojo por la conciliación del 15 hasta que cuadre la del 16, esta noche.
5. La pantalla de carga sin tiempo máximo y el catálogo van en el hito 1 del cliente.

## Procedimiento de publicación (cuando lo autorice)

El mismo de la Fase 3:

1. `scripts/produccion/verificar-publicacion.mjs antes 36f4e35` en VERDE. Si para entonces la conciliación del 16 ya cuadró, la salud estará entera en verde.
2. 0 pedidos activos, 0 repartidores conectados y ningún dato cambiado desde el último respaldo.
3. Fusionar `fase-reloj-seguro` en `main`, con un commit de fusión normal (no `[skip ci]`), y dejar correr `verify` y `publicar`.
4. `verificar-publicacion.mjs despues <versión>`, al que se le agrega la pieza `reloj`, que tiene que estar en `ok` o en `atrasado`, nunca en `error`. Con VERDE se queda; con ROJO se revierte.
5. Vuelta atrás: revertir el commit de la fusión (vuelve `36f4e35`), en unos 40 minutos. La tabla `reloj_tareas` queda sin uso.
