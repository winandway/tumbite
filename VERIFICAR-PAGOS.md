# Tumbite — Estado del circuito de pagos

> 🔴 **EL CIRCUITO DE PAGOS NO ESTÁ PROBADO. NO SE ANUNCIA NI SE MANDAN CLIENTES.**
> Falta: las llaves de Stripe de Windoce LLC (modo prueba) puestas en el panel de YaDominios Cloud.
> Regla global: no se dice «listo» hasta una compra de punta a punta por cada método.

Actualizado: 10 de octubre de 2026.

## Cómo funciona (construido)

1. La app manda qué platos y cuántos. **El servidor pone los precios** desde la base y calcula los cuatro bolsillos (`packages/compartido/src/bolsillos.ts`).
2. El servidor crea el pedido en `pago_pendiente` y abre una **sesión de Stripe Checkout** por el total exacto. Tarjeta, Apple Pay y Google Pay los ofrece Stripe solo.
3. Stripe avisa a `POST https://tumbite.com/datos/stripe/aviso`. Sin **firma válida** (y con más de 5 minutos de diferencia) no se procesa nada. Cada aviso se procesa **una sola vez**. Si el monto o la sesión no cuadran con el pedido, no se marca pagado y queda en el registro de errores.
4. Pedido pagado → lo ve el restaurante (paso 6).
5. Billetera: restaurantes y repartidores se dan de alta en **Stripe Connect Express** (los datos bancarios los escriben en Stripe). El saldo es un libro de movimientos; el retiro hace una transferencia de Stripe y, si falla, el libro anota la devolución (nunca se borra).

## Estado por pieza

| Pieza                                             | Construida    | Pruebas automáticas           | Probada con Stripe real (modo prueba) |
| ------------------------------------------------- | ------------- | ----------------------------- | ------------------------------------- |
| Cálculo de bolsillos                              | ✅            | ✅ cuadra al centavo          | —                                     |
| Crear pedido + Checkout                           | ✅            | ✅ (Stripe simulado)          | 🔴 NO                                 |
| Aviso de Stripe (firma, una vez, monto)           | ✅            | ✅ (firma comprobada en rojo) | 🔴 NO                                 |
| Tarjeta                                           | ✅ (Checkout) | —                             | 🔴 NO                                 |
| Apple Pay                                         | ✅ (Checkout) | —                             | 🔴 NO                                 |
| Google Pay                                        | ✅ (Checkout) | —                             | 🔴 NO                                 |
| Alta de billetera (Connect Express)               | ✅            | ✅ (simulado)                 | 🔴 NO                                 |
| Retiro a banco                                    | ✅            | ✅ (simulado)                 | 🔴 NO                                 |
| Acreditar al restaurante y repartidor al entregar | paso 7        |                               | 🔴 NO                                 |

## Lo que falta para probar (en orden)

1. 👤 Richard: crear la cuenta de Stripe de Windoce LLC y activar **Connect** (plataforma tipo marketplace, cuentas Express).
2. Poner en YaDominios Cloud → tarjeta del sitio → Variables de entorno:
   - `STRIPE_SECRET_KEY` (la `sk_test_...` primero)
   - `STRIPE_WEBHOOK_SECRET` (sale al crear el endpoint del aviso en Stripe → Developers → Webhooks, apuntando a `https://tumbite.com/datos/stripe/aviso`, eventos `checkout.session.completed` y `account.updated`)
   - `SITIO_URL` = `https://tumbite.com`
3. Comprobar `https://tumbite.com/datos/salud`: `stripe` y `webhookStripe` en `ok`.
4. Compra de prueba con la tarjeta de prueba de Stripe por cada método; mirar en Stripe el cobro, en la base el pedido `pagado`, y en el panel del restaurante el pedido entrante.
5. Alta de billetera de prueba y retiro de prueba.
6. Repetir todo con las llaves `sk_live_` antes de lanzar.

## Canario

`GET /datos/salud` → `stripe` y `webhookStripe` dicen `ok` o `pendiente`; `base` dice `ok`/`error`.
