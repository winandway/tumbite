# Resultados: los cinco fallos críticos y su cierre de seguridad

**Fecha:** 16 de octubre de 2026 (dos entregas el mismo día: la corrección y el cierre). **Rama:** `fallos-criticos` (sale de `main`, versión publicada `36f4e35`). **Commit final: `75f00f28`.** **Solo en la rama y en el sitio de pruebas. No fusionado a `main`. No publicado. Stripe simulado en las pruebas y en modo prueba en el sitio de pruebas. Ningún dinero real.**

Regla seguida: **ningún fallo se dio por cierto por la lectura del código.** Cada uno se reprodujo con una prueba que falla (rojo), se corrigió, y la prueba quedó como candado (C-FALLOS-CRITICOS en `CANDADOS.md`).

## Parte 1 · Los cinco fallos (primera entrega, commit `6054c6d3`)

| #   | Fallo                                               | ¿Se reprodujo?                           | Arreglo                                                                                          | Estado |
| --- | --------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| 1   | Aviso de Stripe procesado a medias se pierde        | **Sí** (rojo: el reintento no aplicó)    | Primero: soltar la marca si falla. **Después, en el cierre: estados persistentes** (ver Parte 2) | ✅     |
| 2   | Autorización retenida al cancelar en pago pendiente | **Sí** (rojo: nunca se llamó a cancelar) | Cancelar antes del aviso anula el PaymentIntent de `stripe_sesion`                               | ✅     |
| 3   | Propina anotada sin cobro confirmado                | **Sí** (rojo: 200 con `requires_action`) | Solo se anota con `status = succeeded`; si no, 409 y nada en la base                             | ✅     |
| 4   | Pedido activo no determinista con agrupados         | **Sí, como riesgo** (ver detalle)        | Orden determinista: la oferta aceptada primero                                                   | ✅     |
| 5   | Grupo inconsistente al soltar                       | **Sí** (rojo: la fila del grupo quedó)   | Soltar borra la fila de `grupos_pedido`                                                          | ✅     |

Detalle de cada uno (hipótesis, salida en rojo, arreglo) en la versión anterior de este documento, resumido aquí:

- **1:** la base falla una vez en el `UPDATE … 'pagado'`; reenvío del mismo aviso. Rojo: `expected 'pago_pendiente' to be 'pagado'`.
- **2:** pedido creado, cliente cancela. Rojo: `expected false to be true` (sin llamada a `/payment_intents/…/cancel`).
- **3:** Stripe responde `requires_action`. Rojo: `expected 200 not to be 200`.
- **4:** con los índices actuales D1 devuelve las filas por orden físico, así que **no se observó en producción**; la prueba fuerza el caso moviendo la fila (DELETE + INSERT con las llaves foráneas apagadas solo dentro de la prueba) y el «activo» pasó a ser el segundo. Es un **riesgo real**, no un fallo visto en vivo. Orden final: oferta aceptada más antigua, después `creado_en` e `id` (dos pedidos del mismo segundo empatan por `creado_en`).
- **5:** repartidor con dos agrupados suelta el segundo. Rojo: `expected 1 to be +0`.

## Parte 2 · Cierre de seguridad (segunda entrega, commit `75f00f28`)

### Trabajo 1 · Concurrencia de los avisos de Stripe

**Diagnóstico del diseño de la primera entrega** (`INSERT OR IGNORE` → procesar → `DELETE` si falla): con dos entregas simultáneas del mismo evento, la segunda veía la marca y respondía **«repetido» 200 mientras la primera todavía estaba procesando**. Si la primera fallaba y borraba su marca, Stripe ya tenía un 200 de la segunda: **el evento se perdía**. Además el `DELETE` no distinguía la marca propia de una ajena ya terminada. **No cumplía los criterios.**

**Diseño nuevo (idempotencia persistente, operaciones atómicas):**

- `avisos_stripe.estado`: `procesando` → `hecho`. Columna nueva por COLUMNAS (nunca `ALTER` suelto), con **`hecho` por defecto**: los avisos ya guardados en producción estaban aplicados y no se reprocesan.
- Solo quien crea la marca (`INSERT OR IGNORE … 'procesando'` con cambios) procesa.
- Marca `hecho` → `repetido` 200 sin tocar nada.
- Marca `procesando` ajena → **409 «en curso»**: Stripe reintenta más tarde; nunca un 200 con los efectos sin aplicar.
- Marca `procesando` abandonada (el servidor murió) hace más de 5 minutos → se reclama con un `UPDATE` atómico y se vuelve a procesar.
- Si el procesamiento falla → se borra **solo la marca propia** (`AND estado = 'procesando'`) y se responde 5xx.
- Al terminar → `UPDATE … 'hecho'` **antes** de responder: si la respuesta se pierde en la red, el reintento recibe «repetido».

**Pruebas nuevas** (`apps/servidor/src/avisosConcurrencia.test.ts`, 7). El doble de D1 de las pruebas es síncrono; para que dos entregas **se crucen de verdad**, la lectura del pedido dentro del aviso tarda 30 ms (como en la nube) y, si se pide, la base falla justo después.

| Escenario pedido                                            | Prueba | Con el diseño anterior                                    | Con el nuevo                                                                                    |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Dos entregas simultáneas del mismo evento                | 1      | ❌ rojo: una respondió «repetido» con el pedido sin pagar | ✅ una 200, la otra 409; efectos una vez                                                        |
| 2. Una falla mientras otra intenta el mismo evento          | 2      | ❌ rojo: igual que arriba; el evento se perdía            | ✅ la que falló suelta su marca; nadie recibió «repetido» a medias; el reintento aplica una vez |
| 2b. Un fallo no borra la marca válida de otro procesamiento | 2b     | ✅                                                        | ✅ marca `hecho` intacta, «repetido»                                                            |
| 3. La primera termina bien y llega un reintento tardío      | 3      | ✅                                                        | ✅ tres reintentos «repetido», efectos una vez                                                  |
| 4. La respuesta se pierde después de aplicar bien           | 4      | ✅                                                        | ✅ marca `hecho` antes de responder                                                             |
| 4b. Marca a medias reciente (409) y abandonada (se reclama) | 4b     | ❌ rojo: 200 en vez de 409                                | ✅                                                                                              |
| Avisos viejos sin estado cuentan como hechos                | —      | —                                                         | ✅                                                                                              |

**Criterios:** ningún evento válido se pierde (1, 2, 4b); ningún efecto financiero se duplica (`cobros` = 1, `historial_estados 'pagado'` = 1 en todos); un fallo no elimina la marca de otro (2b); los reintentos son seguros (3, 4).

### Trabajo 2 · Cancelación de autorizaciones

**Qué guarda `stripe_sesion`:** el `id` del **PaymentIntent** (`pi_…`) que devuelve `POST /payment_intents` al crear el pedido (`pedidos.ts`, `UPDATE pedidos SET stripe_sesion = intento.id`). El nombre viene de la época de Checkout Sessions; el flujo actual nunca crea una sesión de Checkout. Prueba: «stripe_sesion guarda el id del PaymentIntent…» (comprueba el valor y que no hubo llamada a `/checkout/sessions`). Al llegar el aviso, `stripe_pago` recibe **el mismo id** (`obj.id`), así que antes y después del aviso se cancela el mismo PaymentIntent.

**Pruebas nuevas** (`apps/servidor/src/cancelacionAutorizaciones.test.ts`, 8; **cinco en rojo con el código de `main`**):

| Escenario pedido                      | Resultado                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Cancelación antes del webhook      | ✅ anula **exactamente** ese `pi_…` (otro pedido del mismo cliente queda intacto), clave `anular-{id}`                    |
| 2. Webhook tardío después de cancelar | ✅ el pedido sigue cancelado; no nace un cobro                                                                            |
| 3. Respuesta perdida de Stripe        | ✅ se pregunta a Stripe (`GET`), está `canceled` → cancelado; una sola llamada de cancelación                             |
| 4. Cancelación ya realizada           | ✅ Stripe la rechaza, la verificación la confirma → cancelado; sin reembolso; cancelar de nuevo → 409 sin llamar a Stripe |
| 5. Fallo temporal de Stripe           | ✅ 422, el pedido **vuelve a `pago_pendiente`** (no se marca cancelado sin verificar); el reintento cancela               |
| Después del aviso (solo autorizado)   | ✅ mismo PaymentIntent, `cobros.cancelado_en` marcado, sin reembolso                                                      |
| Cobro ya capturado                    | ✅ **un** reembolso; cancelar otra vez → 409 y ningún segundo reembolso                                                   |

**Contra Stripe en modo prueba de verdad (S12, sitio de pruebas):** se crea un PaymentIntent con captura manual y `pm_card_visa` (queda `requires_capture`, id `pi_…`); se inserta un pedido en `pago_pendiente` con ese id en `stripe_sesion`; se llama al **código real** `cancelarConReembolso`; se consulta a Stripe: `canceled`. Después: la misma clave de idempotencia devuelve la misma respuesta (no es una segunda acción); una segunda cancelación sin clave la rechaza Stripe y la verificación la confirma; cancelar el pedido ya cancelado no hace nada. Limpia todo lo que crea. Resultado en la corrida de abajo.

**Criterios:** no queda autorización retenida (1, S12); no se cancela un pago equivocado (1, S12 con el `pi_` real); no hay doble devolución (4, capturado); no se marca cancelado sin verificar (3, 5).

### Correcciones adicionales

- `avisos_stripe.estado` (esquema + COLUMNAS + lista de columnas regenerada).
- Manejador de avisos con estados (`pedidos.ts`).
- S12 en `diagnostico.ts` y `probar-staging.mjs`.
- Sin cambios en `manager.ts` respecto a la primera entrega: las ocho pruebas de cancelación pasan con ese código; las cinco que estaban en rojo lo estaban contra `main`.

### Trabajo 3 · Regresión

| Prueba                                                                                      | Resultado                          |
| ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Las cinco pruebas de fallos críticos                                                        | ✅                                 |
| Avisos bajo concurrencia (7) y cancelación (8)                                              | ✅                                 |
| Toda la suite del servidor en la rama                                                       | ✅ 338                             |
| `npm run verify` completo en `fallos-criticos`                                              | ✅ 555 pruebas, 0 vulnerabilidades |
| Suite del servidor en la integración temporal (reloj seguro + Hito 1 + versionado + fallos) | ✅ 363                             |
| Sitio de pruebas, corrida `38953203296` (Stripe TEST, D1 real)                              | ✅ todo en verde (detalle abajo)   |

## Resultado completo de staging

Corrida anterior (`38946418138`, primera entrega): ✅ todo en verde (S2–S7, S11, F1, M4, M5, F2, F3, RELOJ, tiempo real, recorrido en inglés y español, conciliación).

Corrida de cierre (`38953203296`, con el diseño nuevo de avisos y S12, Stripe en modo prueba, D1 real): **✅ todo en verde.**

| Prueba del sitio de pruebas                                                      | Resultado |
| -------------------------------------------------------------------------------- | --------- |
| Paquetes de pruebas y de producción revisados; semáforo del sitio de pruebas     | ✅        |
| S2, S5 y el resto de la Fase 0; **S11** (retiros e idempotencia con Stripe TEST) | ✅        |
| **S12** (cancelación contra Stripe TEST, cinco casos, ver abajo)                 | ✅        |
| F1, M4 y M5 (catálogo y migraciones)                                             | ✅        |
| F2 (reloj y lote)                                                                | ✅        |
| **F3** (exclusividad de la Fase 3, 20 conductores a la vez)                      | ✅        |
| **RELOJ** (reloj seguro)                                                         | ✅        |
| Tiempo real en vivo                                                              | ✅        |
| **Recorrido completo de Comida en inglés y en español** (Stripe TEST)            | ✅        |
| Conciliación de saldos contra Stripe TEST                                        | ✅        |

Casos de S12, tal como los devolvió el sitio de pruebas:

1. ✅ El PaymentIntent queda autorizado (`requires_capture`) con id `pi_…`.
2. ✅ Cancelar en `pago_pendiente` deja el pedido cancelado y el PaymentIntent `canceled` en Stripe.
3. ✅ La misma clave de idempotencia no es una segunda cancelación.
4. ✅ Una segunda cancelación la rechaza Stripe y la verificación la confirma como hecha.
5. ✅ Cancelar un pedido ya cancelado no hace nada.

## Riesgos pendientes

1. **Ventana de 5 minutos para reclamar una marca abandonada.** Si un procesamiento legítimo tardara más de 5 minutos (hoy un Worker no pasa de 30 s), otra entrega podría reprocesar. Mitigado por el tope del Worker; vigilar en la salud si aparecen reclamos (`console.error` «abandonado»).
2. **Stripe reintenta con horas de separación.** Un 409 «en curso» hace que el aviso llegue más tarde; el pedido queda en `pago_pendiente` hasta entonces. Aceptable: solo ocurre si dos entregas del mismo evento se cruzan, que Stripe documenta como raro.
3. **Fallo 4 no observado en producción**: candado por determinismo, no por un incidente.
4. **Cambio de dirección con el monto ya autorizado** (autorización incremental) sigue sin probar contra Stripe: Entrega 1b del plan v2.
5. **Clave de idempotencia de la propina** (`propina-{id}`): un reintento en 24 h devuelve el mismo intento; la protección «una propina por pedido» se mantiene. Entrega 1b.
6. **La columna nueva llega a producción por COLUMNAS al publicar**: la salud la exige (`esquema`); si faltara, el semáforo frena la publicación (C-ESQUEMA-COMPLETO).

## Ramas y commits

- `fallos-criticos` ← `main` (`408d3a52`): `6054c6d3` (cinco fallos) · `ecb19858` (candado) · **`75f00f28`** (cierre: avisos con estado, cancelación, S12). Sin fusionar.
- `fase-integracion-hito1` (temporal, solo staging): `08a1154a`, fusión de `fallos-criticos` encima del reloj seguro, el Hito 1 y el versionado. Nunca va a `main`.
- `fase-reloj-seguro`: **sin tocar** (`7ba6ed1e`).

## ¿Está la rama preparada para publicarse?

**Sí, técnicamente.** `fallos-criticos` (`75f00f28`) pasa la verificación completa (555 pruebas), las pruebas nuevas se comprobaron en rojo contra el código anterior, y el sitio de pruebas dio todo en verde con las Fases 0 y 3, el reloj seguro, el recorrido en los dos idiomas y la cancelación contra Stripe TEST.

**Condiciones para publicarla** (orden aprobado): después del reloj seguro; antes, devolver el sitio de pruebas a la rama que se publica y repetir sus pruebas; `verificar-publicacion.mjs antes` en verde; y la autorización expresa de Richard.
