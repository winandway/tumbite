# Resultados: los cinco fallos críticos

**Fecha:** 16 de octubre de 2026. **Rama:** `fallos-criticos` (sale de `main`, versión publicada `36f4e35`). Commit `6054c6d3`. **Solo en la rama y en el sitio de pruebas. No fusionado a `main`. No publicado. Stripe simulado en las pruebas y en modo prueba en el sitio de pruebas. Ningún dinero real.**

Regla seguida: **ningún fallo se dio por cierto por la lectura del código.** Cada uno se reprodujo primero con una prueba que falla (rojo), se corrigió, y la misma prueba quedó como candado (`apps/servidor/src/fallosCriticos.test.ts`, C-FALLOS-CRITICOS).

## Resumen

| #   | Fallo                                               | ¿Se reprodujo?                           | Arreglo                                                                  | Estado |
| --- | --------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------ |
| 1   | Aviso de Stripe procesado a medias se pierde        | **Sí** (rojo: el reintento no aplicó)    | Si el aviso falla, se suelta su marca y el reintento de Stripe lo aplica | ✅     |
| 2   | Autorización retenida al cancelar en pago pendiente | **Sí** (rojo: nunca se llamó a cancelar) | Cancelar antes del aviso anula el PaymentIntent de `stripe_sesion`       | ✅     |
| 3   | Propina anotada sin cobro confirmado                | **Sí** (rojo: 200 con `requires_action`) | Solo se anota con `status = succeeded`; si no, 409 y nada en la base     | ✅     |
| 4   | Pedido activo no determinista con agrupados         | **Sí, como riesgo** (ver detalle)        | Orden determinista: la oferta aceptada primero                           | ✅     |
| 5   | Grupo inconsistente al soltar                       | **Sí** (rojo: la fila del grupo quedó)   | Soltar borra la fila de `grupos_pedido`                                  | ✅     |

## Detalle por fallo

### 1. Webhook procesado a medias

- **Hipótesis (lectura):** `INSERT OR IGNORE INTO avisos_stripe` ocurre antes de procesar; si algo falla después, el reintento de Stripe responde «repetido».
- **Prueba en rojo:** se hace fallar la base una sola vez justo en el `UPDATE pedidos SET estado = 'pagado'`; se reenvía el mismo aviso (mismo `id` de evento). Salida: `AssertionError: expected 'pago_pendiente' to be 'pagado'`.
- **Arreglo:** `apps/servidor/src/rutas/pedidos.ts`: todo el procesamiento va dentro de un `try`; en el `catch` se borra la fila de `avisos_stripe`, se registra en el log y se relanza (Stripe recibe 5xx y reintenta).
- **Idempotencia:** los avisos repetidos **con éxito** siguen respondiendo `repetido: true` (prueba existente en `pedidos.test.ts`). Un aviso cuyo procesamiento falló deja la base como estaba (cada tipo de aviso escribe en un `batch` o en una sola sentencia).
- **Concurrencia [INF]:** dos entregas simultáneas del mismo aviso siguen chocando en la clave primaria de `avisos_stripe`; solo una procesa.

### 2. Autorización retenida al cancelar

- **Hipótesis:** al crear el pedido solo se guarda `stripe_sesion`; `cancelarConReembolso` miraba `stripe_pago`, vacío hasta el aviso; la tarjeta quedaba autorizada hasta vencer sola (Stripe: 7 días).
- **Prueba en rojo:** pedido creado, cliente cancela en `pago_pendiente`. Salida: `expected false to be true` (ninguna llamada a `/payment_intents/pi_sesion/cancel`).
- **Arreglo:** `apps/servidor/src/manager.ts`: `intento = stripe_pago || (pago_pendiente && Stripe configurado ? stripe_sesion : null)`; se anula con la misma clave de idempotencia `anular-{id}` y la misma verificación C-ANULACION-VERIFICADA (si la respuesta se pierde, se pregunta a Stripe si quedó `canceled` antes de revivir el pedido).
- **Aviso tardío:** la prueba también manda el aviso de autorización después de cancelar: el pedido sigue `cancelado` y no nace un cobro. **[INF]** Si Stripe aceptó la anulación, no manda ese aviso; si llegara, se ignora porque el estado ya no es `pago_pendiente`.
- **Sin Stripe configurado** (pruebas locales sin clave): se cancela sin llamar a nadie, como antes.

### 3. Propina sin cobro confirmado

- **Hipótesis:** no se revisaba `cobro.status`.
- **Prueba en rojo:** Stripe responde `status: 'requires_action'`. Salida: `expected 200 not to be 200`.
- **Arreglo:** `pedidos.ts`: si `status !== 'succeeded'` → 409 «No pudimos cobrar la propina…», sin fila en `propinas_extra` ni movimiento.
- **Limitación conocida:** la clave de idempotencia sigue siendo `propina-{id}`; durante 24 h un reintento devuelve el mismo intento de Stripe. La protección contra cobrar dos veces (una propina por pedido) se mantiene. **Queda anotado** para la Entrega 1b del plan v2 (clave con intento).

### 4. Pedido activo no determinista

- **Hipótesis:** `entregaActiva` usa `LIMIT 1` sin `ORDER BY`.
- **Honestidad sobre la reproducción:** con los índices actuales, SQLite y D1 devuelven las filas por su orden físico, así que **en producción no se observó** el fallo. La prueba lo fuerza moviendo físicamente la fila del primer pedido (DELETE + INSERT con las llaves foráneas apagadas solo dentro de la prueba): entonces el «activo» pasó a ser el segundo. Salida: `expected '3d8e…' to be '7b8a…'`. Es un **riesgo real** (una migración, un `VACUUM` o un cambio de índice lo destapan), no un fallo visto en vivo.
- **Arreglo:** `operacion.ts`: `ORDER BY (oferta aceptada más antigua del repartidor para ese pedido), creado_en, id`. Primer intento con `creado_en, id` falló: dos pedidos creados en el mismo segundo empatan y el UUID decide al azar (lo destapó la prueba existente de agrupados). La oferta aceptada primero es el criterio que corresponde a cómo lo vive el repartidor.

### 5. Grupo inconsistente al soltar

- **Hipótesis:** `soltarPedido` no borraba `grupos_pedido`.
- **Prueba en rojo:** repartidor con dos agrupados suelta el segundo. Salida: `expected 1 to be +0` (la fila del grupo seguía).
- **Arreglo:** `operacion.ts`: `DELETE FROM grupos_pedido WHERE pedido_id = ?` dentro del mismo `batch`.
- **Comprobado además:** el primero sigue activo sin «agrupados»; otro repartidor toma el suelto limpio, sin grupo heredado; la exclusividad de la Fase 3 no se toca (los disparadores actúan sobre `pedidos.repartidor_id`, no sobre `grupos_pedido`).

## Pruebas ejecutadas

| Prueba                                                                                      | Resultado                                                                                                                      |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Las 5 pruebas nuevas, antes del arreglo                                                     | ❌ 5 en rojo (salidas citadas arriba)                                                                                          |
| Las 5 pruebas nuevas, después del arreglo                                                   | ✅ 5 en verde                                                                                                                  |
| Toda la suite del servidor (Fase 0, Fase 3, reloj, recorrido simulado)                      | ✅ 323                                                                                                                         |
| `npm run verify` completo (tipos, lint, pruebas, compilación, auditoría)                    | ✅ 540 pruebas, 0 vulnerabilidades                                                                                             |
| Integración temporal `fase-integracion-hito1` (reloj seguro + Hito 1 + versionado + fallos) | ✅ 348 pruebas del servidor; corrida del sitio de pruebas 38946418138 ✅ en verde                                              |
| Garantías preservadas                                                                       | Fase 0 (S11 retiros e idempotencia) y Fase 3 (F3 exclusividad) se vuelven a correr en el sitio de pruebas en esa misma corrida |

## Ramas y commits

- `fallos-criticos` ← `main` (`408d3a52`): `6054c6d3` (pruebas + arreglos). Sin fusionar.
- `fase-integracion-hito1` (temporal, solo staging): fusión de `fallos-criticos` encima del reloj seguro, el Hito 1 y el versionado. Nunca va a `main`.
- `fase-reloj-seguro`: **sin tocar** (`7ba6ed1e`).

## Sitio de pruebas

Corrida `38946418138` de `pruebas-rama` sobre la integración temporal (Stripe en modo prueba, D1 real): **✅ todo en verde** — tipos, lint, pruebas, compilación, auditoría, paquetes revisados, semáforo del sitio de pruebas, S2–S7 y **S11** (retiros e idempotencia, Fase 0), F1, M4, M5, F2, **F3** (exclusividad, Fase 3), RELOJ, tiempo real en vivo, recorrido completo de Comida en inglés y en español, y conciliación de prueba. Las garantías de las Fases 0 y 3 se volvieron a comprobar con los arreglos puestos.
