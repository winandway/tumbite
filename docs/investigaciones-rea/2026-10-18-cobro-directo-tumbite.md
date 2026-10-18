# Ficha: cobro directo, saldo prepago y recargas (Fase 2, 18 oct 2026)

Modelo aprobado por Richard (prompt del 18 oct 2026): el repartidor compra la comida con su capital, el cliente le paga al recibir (efectivo o transferencia a la cuenta del repartidor) y Tumbite cobra su comisión de un saldo prepago. Esta ficha resume la decisión de arquitectura y lo construido; la evidencia está en las tres fichas de investigación de hoy.

## 1. Referencias y evidencia

- `2026-10-18-stripe-internacional-y-cobro-directo.md`: cómo manejan efectivo y saldo DoorDash (Cash on Delivery), Uber Eats (cash trips, arrears), DiDi Food (billetera y tope negativo), Rappi, Glovo, Bolt, Yummy, inDrive y Yango [DOC]/[OBS]; qué puede y no puede hacer Stripe fuera de EE.UU. [DOC].
- `2026-10-18-pagos-colombia.md`: Wompi, dLocal, PayU, ePayco, Mercado Pago; Rappi y DiDi Food Colombia; Decreto 1692 [DOC]/[OBS].
- `2026-10-18-pagos-venezuela.md`: pago móvil, APIs de Mercantil, licencia del BCV, IGTF, Yummy/PedidosYa/Ridery [DOC]/[OBS].
- Referencia principal del proceso: **DiDi Food** (billetera + tope + recargas) combinada con **Uber Eats** (cliente que no paga → deuda) y **Yummy** (cobro directo al repartidor). Justificación: es el único conjunto con documentación pública de los tres problemas (saldo, no pago, cobro directo).

## 2. Comparación con Tumbite (antes de hoy)

Solo existía el circuito de tarjeta por Stripe (EE.UU.): autorizar al pedir, capturar al entregar, abonos en `movimientos`, retiros por Connect. Ningún método en efectivo, ningún saldo prepago, ninguna recarga, ningún registro de dinero que no pasara por Tumbite.

## 3. Decisión de arquitectura (construida hoy)

- **Tres estados independientes por pedido:** `estado` (entrega física, como siempre), `cobro_estado` (pendiente → confirmado / parcial / no_pagado; lo marca el repartidor con «Cobré» o «No pagó»), `conciliacion_estado` (pendiente → conciliado / con_diferencia; corre sola cuando entrega y cobro están cerrados). Marcar entregado NO toca el cobro.
- **Libro mayor `libro`** por país y moneda, de una sola entrada por bolsillo, inmutable, con referencia única (idempotente) y autor: `prepago`, `reservado`, `comisiones` (Tumbite), `punto` (fondo de los puntos de venta), `deuda_cliente`, `directo` (informativo: dinero que fue del cliente al repartidor o al restaurante). Nunca equivalencias de moneda: cada fila lleva su país y su moneda en la unidad menor.
- **Saldo prepago nunca negativo**: la comisión se **reserva** al aceptar (sale de `prepago` a `reservado` en una sentencia que exige saldo), se **cobra** al conciliar (`reservado` → `comisiones`) o se **libera** al soltar, cancelar o si el cliente no paga. Sin crédito, sin retiro del prepago, sin transferencias entre usuarios.
- **Despacho:** un pedido directo solo se ofrece (y solo se deja aceptar) a repartidores con saldo para la comisión y por debajo del tope de efectivo del país.
- **Cliente que no paga:** el pedido pasa a `cancelado` desde `en_camino` (transición nueva, solo por esta vía), la reserva vuelve y el cliente queda con `deuda_cliente`; con deuda no puede pedir en efectivo. Quién absorbe la comida queda **registrado, no decidido** (Richard).
- **Pago al restaurante:** modelo aprobado = el repartidor paga en el local; queda como fila informativa `pagado_en_local_por_repartidor`. La entrega de un pedido directo **no** acredita `movimientos` (venta/entrega/propina): ese dinero no pasó por Tumbite.
- **Propina en efectivo:** fuera del total a conciliar; es del repartidor.
- **Recargas:** puntos de venta con fondo prepago comprado a Tumbite (comprobante escrito); códigos de 12 caracteres sin 0/O/1/I, guardados solo como hash; emitir descuenta el fondo en la misma sentencia; canje atómico (el primero que lo marca canjeado se lo lleva), tope de 10 intentos fallidos por hora, máximo de recargas por semana del país, anulación solo de códigos no canjeados. Recarga digital por Stripe (donde esté activa): pendiente hasta el aviso `payment_intent.succeeded` con `metadata.recarga_id`, acreditada una sola vez.
- **Interruptores por país** (`config` → `pais:<ISO>`): efectivo, transferencia al repartidor, recargas en punto, recargas con tarjeta, comisión y cargo fijo, tope de efectivo, umbral de deuda, límites de recarga, comisión del punto. Todo apagado de fábrica; EE.UU. sigue con Stripe.
- **Canario `libro`:** error si algún prepago, reserva o fondo de punto queda negativo.

## 4. Lo que falta (en el plan)

- B.5 Cuentas del repartidor para transferencia (nombre del beneficiario, historial protegido, confirmación manual identificada como tal) — siguiente.
- C.6 Pantallas: «Cobré» / «No pagó» y saldo prepago con recargas en la app del repartidor; «Pago al recibir» en el carrito del cliente; ticket en la app del restaurante; guías de Docs es/en.
- Conectores reales por país (Wompi/dLocal, pago móvil) — nada real sin contrato ni decisión de Richard.
- Panel del superadmin para países, puntos de venta y libro (hoy solo API).

## 5. Pruebas de aceptación (hechas hoy, `apps/servidor/src/internacional.test.ts`)

7 (entregar no cambia el cobro), 8 (sin saldo no se ofrece ni se acepta; con recarga sí; reserva), 9 (conciliación con diferencia → deuda), 10 (cliente no paga), 12 (propina fuera), 13 (canje único, atómico, bloqueo por intentos, anulación), 15 (interruptor apagado → 409), 16 (saldo nunca negativo, canario). Pendientes: 11 (cancelado tras compra con foto del ticket), 14 (tope diario con cifra real: la lógica existe, falta la cifra de Richard).
