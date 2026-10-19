# Tumbite — Estado del circuito de pagos

> **Estado vigente:** el registro único es `docs/RECONCILIACION-FASE-2.md` (fallos F5–F20, puntos 1–67, compuerta del MVP y estado por país y método). Si este documento dice otra cosa, manda el registro.

> **19 oct (tarde), publicado en 26649f68:** cobro en mano (efectivo y transferencia al repartidor) probado de punta a punta en staging con las cuentas de la corrida y en simulación; bandeja de soporte del cobro en mano; recarga que no cuadra abre incidencia. **Nada de esto se probó con dinero real** y el cobro en mano sigue **apagado** en todos los países. La tarjeta en EE. UU. sigue sin compra real (`docs/SOLICITUD-AUTORIZACIONES-2026-10-19.md`, fila 8).

> 🟡 **Tarjeta con Stripe real (modo live): PROBADA una vez con Checkout** (pedido de $7.18, 10 oct 2026, pago `pi_3UPZrOLDByFATg8R2eLasrcQ`).
> 🔴 **El pago DENTRO de la app (sin salto) NO está probado con dinero real todavía.** No se anuncia hasta hacer la compra de $1 por la app web.
> Regla global: no se dice «listo» hasta una compra de punta a punta por cada método.

Actualizado: 12 de octubre de 2026. El formulario de tarjeta dentro del carrito se vio funcionando en local (candado C-PAGO-FORMULARIO); falta la compra real de $1.

## Cómo funciona (construido)

1. La app manda qué platos y cuántos. **El servidor pone los precios** desde la base y calcula los cuatro bolsillos (`packages/compartido/src/bolsillos.ts`).
2. El servidor crea el pedido en `pago_pendiente`, busca o crea el **cliente de Stripe** de la persona (`usuarios.stripe_cliente`), abre un **PaymentIntent** por el total exacto y una **CustomerSession** (para mostrar y guardar tarjetas).
3. **El cobro es dentro de la app, sin salto:** en la web, el formulario `PaymentElement` va dentro del carrito (`apps/cliente/src/PagoTarjeta.web.tsx`, `redirect: 'if_required'`); en el celular, la hoja de pago de Stripe (`PagoTarjeta.tsx`). Al pagar, la app lleva directo al pedido.
4. Stripe avisa a `POST https://tumbite.com/datos/stripe/aviso` con `payment_intent.succeeded` (y sigue aceptando `checkout.session.completed` de pedidos viejos). Sin **firma válida** no se procesa nada. Cada aviso se procesa **una sola vez**. Si el monto o el intento no cuadran con el pedido, no se marca pagado.
5. Pedido pagado → lo ve el restaurante y salen los correos.
6. Billetera: restaurantes y repartidores se dan de alta en **Stripe Connect Express**. El saldo es un libro de movimientos.

## Estado por pieza

| Pieza                                                                                     | Construida                                    | Pruebas automáticas                                                                                        | Probada con Stripe real                             |
| ----------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Cálculo de bolsillos                                                                      | ✅                                            | ✅ cuadra al centavo                                                                                       | ✅ (pedido de $7.18)                                |
| Pago con salto (Checkout, ya retirado)                                                    | ✅                                            | ✅                                                                                                         | ✅ 10 oct 2026                                      |
| Pago dentro de la app, web (PaymentElement)                                               | ✅                                            | ✅ candado C-PAGO-SIN-SALTO                                                                                | 🔴 NO — falta la compra de $1                       |
| Pago dentro de la app, celular (hoja de pago)                                             | ✅                                            | ✅ candado                                                                                                 | 🔴 NO — falta la app en el celular                  |
| Tarjetas guardadas (CustomerSession)                                                      | ✅                                            | ✅ cliente se crea una vez                                                                                 | 🔴 NO — se ve en la segunda compra                  |
| Aviso `payment_intent.succeeded`                                                          | ✅                                            | ✅ monto e intento en rojo                                                                                 | 🔴 NO                                               |
| Apple Pay / Google Pay                                                                    | ✅ (Stripe)                                   | —                                                                                                          | 🔴 NO                                               |
| Alta de billetera (Connect Express)                                                       | ✅                                            | ✅ (simulado)                                                                                              | 🔴 NO                                               |
| Retiro a banco (Fase 0: sin doble pago, publicado 17 oct)                                 | ✅                                            | ✅ (22 pruebas, Stripe simulado; S2/S3/S5/S7 en la base real de pruebas)                                   | 🔴 NO                                               |
| Devolución al rechazar (restaurante)                                                      | ✅                                            | ✅                                                                                                         | 🔴 NO                                               |
| Cancelación del cliente antes de que acepten                                              | ✅ 12 oct                                     | ✅ dinero vuelve; Stripe falla → no cancela                                                                | 🔴 NO                                               |
| Cancelación sola del Manager (10 min)                                                     | ✅ 12 oct                                     | ✅ una sola devolución                                                                                     | 🔴 NO                                               |
| Webhook de cuentas conectadas (segundo secreto, F10)                                      | ✅ 18 oct                                     | ✅ `fallosDinero.test.ts`                                                                                  | 🔴 NO — 👤 crear el endpoint                        |
| Total del carrito = total del servidor (F6/F8)                                            | ✅ 18 oct                                     | ✅ `fallosDinero.test.ts`                                                                                  | — (staging, recorrido)                              |
| Cambio de dirección actualiza el cobro antes de pagar (F7)                                | ✅ 18 oct                                     | ✅ `fallosDinero.test.ts`                                                                                  | 🔴 NO                                               |
| Impuesto de ventas (A.12)                                                                 | ✅ 18 oct                                     | ✅ `bolsillos.test.ts`, `devolucionesDisputas.test.ts`                                                     | 👤 tasa y registro con el contador                  |
| Devolución después de entregar (A.12)                                                     | ✅ 18 oct                                     | ✅ reembolso parcial con clave, movimiento compensatorio                                                   | 🔴 NO                                               |
| Disputas por webhook + canario (A.12)                                                     | ✅ 18 oct                                     | ✅ firma, bitácora, correo, salud                                                                          | 🔴 NO                                               |
| Cobros en revisión: reintentar / confirmar (superadmin)                                   | ✅ 18 oct                                     | ✅ `superDinero.test.ts`                                                                                   | 🔴 NO                                               |
| Cobro directo (B): reserva al aceptar, cobro al entregar, liberación al soltar o cancelar | ✅ 18 oct                                     | ✅ `internacional.test.ts`, `operacion.test.ts` (concurrencia, idempotencia)                               | — no usa Stripe; 👤 piloto por país (E.3)           |
| Saldo prepago del repartidor: sin negativo, sin crédito (`descontarSiAlcanza`)            | ✅ 18 oct                                     | ✅ `internacional.test.ts` (dos reservas a la vez, una sola pasa)                                          | —                                                   |
| Recargas por código (punto de venta): canje único, atómico, auditado                      | ✅ 18 oct                                     | ✅ `internacional.test.ts` (canje doble simultáneo → uno solo)                                             | 👤 piloto con un punto real                         |
| Recargas con tarjeta (Stripe, `metadata.tipo = recarga`)                                  | ✅ 18 oct                                     | ✅ webhook simulado                                                                                        | 🔴 NO — Stripe de prueba en staging                 |
| Cuentas de cobro del repartidor (beneficiario, historial, confirmación manual, disputa)   | ✅ 18 oct                                     | ✅ `cuentasCobro.test.ts`                                                                                  | —                                                   |
| Fondo de puntos de venta (comprobante registrado) y países del superadmin                 | ✅ 18 oct                                     | ✅ `ControlDinero.test.tsx`; probado a mano en local el 18 oct (CO encendido, punto creado, fondo cargado) | —                                                   |
| Pago de la comida en el local por el repartidor (monto, ticket, efectivo o su tarjeta)    | ✅ 18 oct                                     | ✅ `internacional.test.ts` (C-COBRO-DIRECTO-LOCAL, rojo comprobado) y recorrido en staging                 | — no pasa por Tumbite; 👤 piloto                    |
| Transferencia por verificar, excedente del cliente y comida comprada sin entregar         | ✅ 18 oct                                     | ✅ `internacional.test.ts`                                                                                 | — confirmación **manual** del repartidor; 👤 piloto |
| Devolución en un pedido pagado en mano                                                    | ✅ 18 oct (rechazada: no hay cobro de Stripe) | ✅                                                                                                         | — soporte coordina con repartidor o restaurante     |

## Lo que falta para probar (en orden)

0. (18 oct 2026) Regresión del circuito de EE.UU. en staging: S2–S5, S7, S11 y el recorrido completo con Stripe de prueba pasaron en verde con la rama `fase-2-bloque-b` (flujo `pruebas-rama` 39159020361) y producción sirve esa misma versión (`b7031f4c`, flujo `publicar` 39161756749, verificador «despues» en verde). El bloque C (`fase-2-bloque-c`, desde 9cc605ba) repite la misma batería antes de pasar a producción.

1. Compra de $1 (Carne Asada, Restaurante el Beef USA, zona Novi) desde `https://tumbite.com/app/`: el formulario de tarjeta tiene que salir dentro del carrito, cobrar, y llevar solo al pedido. Mirar en Stripe el cobro y en el panel del restaurante el pedido.
2. Segunda compra: la tarjeta guardada tiene que aparecer sola.
3. Cancelar un pedido pagado de $1 desde la app antes de que el restaurante lo acepte: en Stripe tiene que aparecer la devolución completa y el pedido como «Cancelado».
4. Alta de billetera y retiro (prueba en la calle, `docs/PLAN-DE-PRUEBA-EN-CALLE.md`).

## Configuración en vivo

- Endpoint del aviso en Stripe: `we_1UPXJsLDByFATg8RGREKxPll`, eventos `checkout.session.completed`, `account.updated` y `payment_intent.succeeded` (agregado el 11 oct 2026).
- Variables en YaDominios (los dos sitios): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`.

## Canario

`GET /datos/salud` → `stripe` y `webhookStripe` dicen `ok` o `pendiente`; `base` dice `ok`/`error`.

## 🔴 Sin probar en real (14 oct 2026): devolución parcial por plato agotado

- Qué es: cuando el restaurante marca un plato que no tiene y el cliente lo quita, Tumbite recalcula el pedido y le devuelve la diferencia con un reembolso parcial en Stripe (`POST /refunds` con `amount`), con clave de idempotencia `ajuste-<pedido>`.
- Estado: construido y probado con Stripe simulado (`operacion.test.ts`, «algo agotado»). **NO probado con una compra real.** Antes de anunciarlo: una compra de prueba con dos platos, marcar uno como agotado desde el panel, quitarlo desde la app, y ver en Stripe el reembolso parcial por la diferencia exacta.
- Cómo se prueba: igual que la compra real con tarjeta pendiente (autoriza 4,99, devuelve 1,00; `docs/PRUEBA-REAL-1-DOLAR.md`), pero con dos platos.

## 🔴 CIRCUITO CAMBIADO el 14 oct 2026: autorizar al pedir, capturar al entregar — SIN PROBAR EN REAL

- Qué cambió: el intento de pago se crea con `capture_method: manual`. El pedido pasa a «pagado» con el aviso `payment_intent.amount_capturable_updated` (la tarjeta autorizada por el total). Al entregar, el servidor captura por el total vigente (`/payment_intents/:id/capture` con `amount_to_capture`); si se quitó un plato, captura menos (ya no hay reembolso parcial). Cancelar antes de entregar anula la autorización (`/payment_intents/:id/cancel`): sin reembolso y sin comisión de Stripe. Tabla `cobros` lleva autorizado / capturado / cancelado.
- Estado: probado con Stripe simulado (`operacion.test.ts`, «cobrar al entregar y PIN en mano») y con el recorrido completo. **NO probado con una compra real.** Antes de anunciar nada: una compra real con tarjeta (plato de 1,00; la tarjeta autoriza 4,99) y verla en Stripe como «sin capturar» al pedir, «capturada» al entregar; otra cancelada por el restaurante que quede «cancelada» sin reembolso; y una con dos platos quitando uno, capturada por el total nuevo.
- Ojo: una autorización vence a los 7 días; los pedidos nuestros se entregan en la hora. Apple Pay/Google Pay con captura manual: validar cuando se activen.
- El webhook de Stripe en el panel debe incluir el evento `payment_intent.amount_capturable_updated` (además de `payment_intent.succeeded`). Sin ese evento, los pedidos se quedan en «esperando el pago».

## 🔴 Apple Pay y Google Pay (14 oct 2026): construidos, SIN probar en real

- Web: el formulario de Stripe muestra Apple Pay / Google Pay solo cuando el método está encendido en el panel de Stripe y el dominio está registrado (`POST /datos/admin/stripe/dominio`, botón del superadmin). No probado con una compra real.
- App: la hoja de pago nativa lleva `applePay` y `googlePay`; Apple Pay requiere el identificador de comercio en la cuenta de Apple (pendiente de Richard). No probado.
- Conciliación diaria y abono fallido: probados solo con Stripe simulado (`operacion.test.ts`, C-DINERO-VIGILADO); el aviso real `payout.failed` llega por el webhook de cuentas conectadas, que hay que tener activo en Stripe (evento `payout.failed` marcado).
- **Webhook de cuentas conectadas (18 oct 2026, F10 de la auditoría):** Stripe firma esos avisos (`account.updated`, `payout.failed`) con OTRO secreto. El servidor acepta `STRIPE_WEBHOOK_SECRET` y `STRIPE_WEBHOOK_SECRET_CONECTADAS` (canario `webhookStripeConectadas`). 👤 Richard: en Stripe → Developers → Webhooks, crear un segundo endpoint a `https://tumbite.com/datos/stripe/aviso` marcando «Listen to events on Connected accounts», con `account.updated` y `payout.failed`, y pegar su secreto en YaDominios Cloud → sitio tumbite → Variables → `STRIPE_WEBHOOK_SECRET_CONECTADAS` (y lo mismo en el sitio de pruebas con la cuenta de prueba). Sin eso, `pagos_activos` del restaurante no se activa solo. Probado con Stripe simulado (`fallosDinero.test.ts`).

## 🔴 Propina después de entregar y cambio de dirección (14 oct 2026): SIN probar en real

- La propina extra cobra un PaymentIntent `off_session` con la tarjeta guardada del primer pago (`POST /datos/pedidos/:id/propina`). Probado solo con Stripe simulado. En real hay que comprobar que el primer pago guardó el método (`setup_future_usage: off_session`) y que el cobro aparte sale sin pedir la tarjeta.
- El cambio de dirección actualiza el monto del PaymentIntent autorizado (`POST /payment_intents/:id {amount}`) antes de capturar. Probado solo simulado: en real, comprobar que la autorización acepta subir el monto (si el banco no lo permite, Stripe responde error y la dirección no cambia).
- La recogida en el local captura el cobro al marcar «Entregado al cliente». Mismo circuito de captura que la entrega; sin probar en real.

## 🟡 Retiros (actualizado 18 oct 2026): corrección del doble pago PUBLICADA en producción el 17 oct (d22a9a6a) — apagados por bandera, SIN probar en real

- La corrección (`docs/FASE-0-SEGURIDAD-FINANCIERA.md`, candado C-RETIROS-SEGUROS) está en producción desde el 17 oct: si Stripe transfiere y la respuesta se pierde, se consulta a Stripe antes de devolver el saldo. Probada con Stripe simulado (21 pruebas) y en staging.
- **Falta**: activar el aviso `transfer.created` en el panel de Stripe (Richard), hacer un retiro en **modo prueba de Stripe** en el sitio de pruebas cortando la respuesta a propósito (S11), y encenderlos (`PUT /datos/admin/retiros`; el superadmin ya tiene la pantalla de retiros; siguen apagados por decisión de Richard).
- Mientras tanto: no anunciar retiros. **Sin bandera los retiros nacen apagados**; la app dice «en pausa».
- S11 (retiro en modo prueba de Stripe) está programada y corre sola desde GitHub en cuanto el sitio de pruebas tenga llaves de modo prueba cargadas en su panel.
- Anulación de pedidos (15 oct): si se pierde la respuesta de Stripe, se consulta a Stripe antes de revivir el pedido (C-ANULACION-VERIFICADA). Probado con Stripe simulado.
