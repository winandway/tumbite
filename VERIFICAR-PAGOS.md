# Tumbite — Estado del circuito de pagos

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

| Pieza                                         | Construida  | Pruebas automáticas                         | Probada con Stripe real            |
| --------------------------------------------- | ----------- | ------------------------------------------- | ---------------------------------- |
| Cálculo de bolsillos                          | ✅          | ✅ cuadra al centavo                        | ✅ (pedido de $7.18)               |
| Pago con salto (Checkout, ya retirado)        | ✅          | ✅                                          | ✅ 10 oct 2026                     |
| Pago dentro de la app, web (PaymentElement)   | ✅          | ✅ candado C-PAGO-SIN-SALTO                 | 🔴 NO — falta la compra de $1      |
| Pago dentro de la app, celular (hoja de pago) | ✅          | ✅ candado                                  | 🔴 NO — falta la app en el celular |
| Tarjetas guardadas (CustomerSession)          | ✅          | ✅ cliente se crea una vez                  | 🔴 NO — se ve en la segunda compra |
| Aviso `payment_intent.succeeded`              | ✅          | ✅ monto e intento en rojo                  | 🔴 NO                              |
| Apple Pay / Google Pay                        | ✅ (Stripe) | —                                           | 🔴 NO                              |
| Alta de billetera (Connect Express)           | ✅          | ✅ (simulado)                               | 🔴 NO                              |
| Retiro a banco                                | ✅          | ✅ (simulado)                               | 🔴 NO                              |
| Devolución al rechazar (restaurante)          | ✅          | ✅                                          | 🔴 NO                              |
| Cancelación del cliente antes de que acepten  | ✅ 12 oct   | ✅ dinero vuelve; Stripe falla → no cancela | 🔴 NO                              |
| Cancelación sola del Manager (10 min)         | ✅ 12 oct   | ✅ una sola devolución                      | 🔴 NO                              |

## Lo que falta para probar (en orden)

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
- Cómo se prueba: igual que la compra real de 1 dólar pendiente, pero con dos platos.

## 🔴 CIRCUITO CAMBIADO el 14 oct 2026: autorizar al pedir, capturar al entregar — SIN PROBAR EN REAL

- Qué cambió: el intento de pago se crea con `capture_method: manual`. El pedido pasa a «pagado» con el aviso `payment_intent.amount_capturable_updated` (la tarjeta autorizada por el total). Al entregar, el servidor captura por el total vigente (`/payment_intents/:id/capture` con `amount_to_capture`); si se quitó un plato, captura menos (ya no hay reembolso parcial). Cancelar antes de entregar anula la autorización (`/payment_intents/:id/cancel`): sin reembolso y sin comisión de Stripe. Tabla `cobros` lleva autorizado / capturado / cancelado.
- Estado: probado con Stripe simulado (`operacion.test.ts`, «cobrar al entregar y PIN en mano») y con el recorrido completo. **NO probado con una compra real.** Antes de anunciar nada: una compra real de 1 dólar y verla en Stripe como «sin capturar» al pedir, «capturada» al entregar; otra cancelada por el restaurante que quede «cancelada» sin reembolso; y una con dos platos quitando uno, capturada por el total nuevo.
- Ojo: una autorización vence a los 7 días; los pedidos nuestros se entregan en la hora. Apple Pay/Google Pay con captura manual: validar cuando se activen.
- El webhook de Stripe en el panel debe incluir el evento `payment_intent.amount_capturable_updated` (además de `payment_intent.succeeded`). Sin ese evento, los pedidos se quedan en «esperando el pago».
