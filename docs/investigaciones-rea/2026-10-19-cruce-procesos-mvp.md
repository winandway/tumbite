# Cruce de procesos para el MVP: siete recorridos frente a Tumbite

**Fecha:** 19 de octubre de 2026. **Tipo:** investigación (no se tocó código, no hubo commits ni publicación). **Método:** `docs/METODOLOGIA-INGENIERIA-REA.md` (metodología permanente del 18 oct). **Rama de lectura:** `main` en `67367696`.

**Etiquetas:** [REA] observado con una herramienta REA (se indica herramienta, página, fecha y evidencia) · [DOC] documentación oficial (URL en «Fuentes») · [INF] inferencia nuestra · [NV] no verificado · [TUMBITE] lo que hace hoy Tumbite según su código (archivo:línea) o decisión propia de Tumbite. Una inferencia nunca se presenta como regla interna de un competidor. Nada de lo que hacen otros implica que su modelo laboral o contractual aplique a Tumbite.

**Límite legal respetado:** no se descompiló ni analizó ninguna app o paquete de terceros; no se usó ninguna cuenta; no se capturó tráfico ajeno. REA (`mcp__rea__inspect_web_page`, versión del proveedor 2) se usó solo sobre: (a) el sitio de pruebas de Tumbite, y (b) páginas públicas de ayuda de DoorDash y SoyRappi abiertas como visitante en un Chrome sin cuenta de esta computadora. **Limitación de REA:** la herramienta no hace clic ni navega; en las preguntas frecuentes de SoyRappi solo se vieron las preguntas (las respuestas están plegadas y no se pudieron leer); la app nativa del repartidor de los grandes no es observable (exige cuenta) y queda [NV].

**Lecturas previas que esta ficha reutiliza (no se repite su evidencia, se cita):** `COMPARACION-CICLO-PEDIDO.md` (14 oct), `2026-10-16-transiciones-pedido.md`, `2026-10-18-repartidor.md`, `2026-10-18-cobro-directo-tumbite.md`, `2026-10-18-stripe-internacional-y-cobro-directo.md` (en adelante **SI**), `2026-10-18-pagos-colombia.md` (**PC**), `2026-10-18-pagos-venezuela.md` (**PV**), y los estudios de Richard: **E1** «Del primer registro a la entrega» (40 p.) y **E2** «Estudio delivery — Tumbite» (15 p.).

## Resumen en ocho líneas

1. El ciclo con tarjeta en EE.UU. ya está al nivel de DoorDash en lo esencial; no aparece ningún vacío nuevo que bloquee el lanzamiento en EE.UU.
2. El cobro directo (efectivo o transferencia al repartidor) está bien diseñado en el servidor, pero la app del repartidor **convierte y muestra todo como dólares**: en pesos colombianos cobraría y registraría cien veces de más.
3. La oferta al repartidor **no dice que el pedido es en efectivo ni cuánto tendrá que adelantar en el local**; Uber muestra la insignia «Cash» antes de aceptar y Glovo avisa si hay que pagar al comercio.
4. En un pedido en efectivo el repartidor **puede dejarlo «en lugar seguro»** tras el aviso de cliente ausente; DoorDash en efectivo no entrega sin cobro.
5. La conciliación diaria **no distingue pedidos directos ni monedas**: el primer día con un pedido en efectivo dirá «no cuadra».
6. Transferencia directa al repartidor como método oficial: **ninguna de las grandes lo documenta**; la referencia más cercana es Yummy (Venezuela, pago móvil, por prensa). En Colombia el riel sería Bre-B (irreversible, 24/7).
7. Soporte no tiene una bandeja de pedidos «con diferencia», pérdidas de comida pendientes ni transferencias por verificar; el restaurante no tiene cómo disputar un cargo (Uber da 30 días).
8. Cuatro decisiones comerciales siguen siendo de Richard (20 a 23 de `DECISIONES-RICHARD-FASE-2.md`) y cambian textos y plazos, no la arquitectura.

---

## 1. Pedido, recogida, entrega y cancelación

**Problema.** Que cada estado del pedido tenga dueño, que nadie pueda saltarse uno y que cada excepción (no hay repartidor, el repartidor se baja, el cliente no aparece, se cancela tarde) tenga salida sin perder dinero ni comida.

**Referencia principal:** DoorDash (Drive API, ayuda de Dashers y de comercios). **Secundaria:** Uber Eats.

**Recorrido de la referencia y sus excepciones.**

- Estados: creado → confirmado → en camino al local → llegó al local → recogido → en camino al cliente → llegó → entregado / cancelado; si el Dasher se desasigna antes de recoger, la entrega vuelve a «creado» [DOC] (ficha de transiciones, fuente 1). La API rechaza cambios que no corresponden con 409 [DOC].
- Despacho contra el tiempo de preparación; aviso al local a 5 minutos; espera evitable medida desde 25 m [DOC] (COMPARACION, §1-3).
- Recogida verificada con QR del ticket o los últimos 3 caracteres [DOC].
- Cliente ausente: deslizar «llegué», llamar y escribir; en EE.UU. Ayuda → «Drop-off issues» → «Can't reach customer» abre un temporizador de «unos minutos»; al vencer, «Leave the Order» en lugar seguro con foto y descripción; no seguir los pasos puede llevar a la desactivación [DOC, artículo «customer is unavailable», 19 oct]. Duración exacta del temporizador [NV].
- Uber (contraste): llamar al menos tres veces y esperar 10 minutos; con eso se cobra la tarifa completa; muchas cancelaciones antes del temporizador se tratan como posible fraude [DOC] (ficha del repartidor §2.6).
- Cancelación por el cliente después de que el restaurante empezó: [NV] en fuentes públicas de DoorDash para EE.UU.

**Tumbite hoy.**

- Siete estados forzados por la base con la tabla `transiciones_pedido` y el disparador (candado C-TRANSICIONES) [TUMBITE].
- El cliente solo cancela en `pago_pendiente` o `pagado` (`operacion.ts:1984`); el restaurante rechaza en `pagado` o `aceptado` (`operacion.ts:607`); el Manager cancela a los 10 minutos [TUMBITE].
- Despacho con reloj, llegada por GPS con dos lecturas, QR o código de 4 caracteres, foto de recogida confirmada por el restaurante, entrega con foto, en mano con PIN, «no aparece» con 5 minutos y lugar seguro (`operacion.ts:2314` y `:1737`), soltar con motivo y reasignación (`operacion.ts:2345`) [TUMBITE].
- En un pedido directo, después de pagar la comida en el local el repartidor ya no puede soltarlo solo; debe ir a soporte (`operacion.ts:2360`) [TUMBITE].

**Diferencias.**

| #   | Diferencia                                                                                                                                                                                         | Evidencia                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1.1 | En un pedido **en efectivo o por transferencia**, el modo «lugar seguro» sigue permitido tras el aviso de cliente ausente: se puede dejar la comida sin cobrar. DoorDash, en efectivo, no entrega. | `operacion.ts:1737` no mira `metodo_pago` [TUMBITE]; DoorDash Cash on Delivery [DOC] (SI §2.2) |
| 1.2 | El temporizador de cliente ausente es de 5 minutos; DoorDash dice «unos minutos» y Uber 10 minutos con tres llamadas.                                                                              | [TUMBITE] / [DOC]; cifra de DoorDash [NV]                                                      |
| 1.3 | Lo demás coincide con el estándar o lo supera (foto de recogida confirmada por el local, E2 la llama diferenciador).                                                                               | COMPARACION §5, E2 p.6 [DOC]                                                                   |

**Recomendación.**

- 1.1 **[TUMBITE, decisión propia]**: en pedidos directos, al vencer el temporizador de cliente ausente no se ofrece «lugar seguro»; se ofrece «El cliente no aparece y no pagó», que usa la ruta existente `no-pago` (la comida queda como pérdida pendiente y el cliente con deuda). Es el estándar de DoorDash y no cambia ninguna decisión de Richard.
- 1.2 Se mantienen 5 minutos [TUMBITE]: está dentro del rango observado y ya tiene candado.

**Prueba de aceptación.** Pedido en efectivo en `en_camino`, hito «no aparece» con más de 5 minutos: `POST /entregado?modo=seguro` responde 409 con el texto «En un pedido en efectivo no se deja sin cobrar»; `POST /no-pago` con motivo «cliente ausente» lo cancela, libera la reserva, anota la pérdida y la deuda. La misma prueba con tarjeta sigue permitiendo el lugar seguro. Primero en rojo.

---

## 2. Pago en efectivo y compra adelantada de la comida por el repartidor

**Problema.** El cliente paga al recibir; el restaurante tiene que cobrar su comida antes de soltarla; alguien tiene que poner ese dinero en el mostrador.

**Referencia principal:** DiDi Food Colombia (el repartidor paga en la tienda y cobra al cliente). **Secundaria:** Rappi Colombia. **Contraste:** DoorDash Red Card.

**Recorrido de la referencia y sus excepciones.**

- DiDi Food Colombia: en efectivo el repartidor **paga el pedido en el restaurante** y cobra al cliente; si la billetera del repartidor alcanza, DiDi paga directo a la tienda; si no, paga en efectivo; no se puede rechazar el método («misma proporción»); con cupón puede cobrar menos y DiDi le deposita la diferencia [DOC] (PC §2.7, SI §2.2). México: «Efectivo insuficiente» en la tienda → **reasignación automática**; cliente sin cambio → ruta «Dinero insuficiente»; esperas de 10 minutos en tienda y 10 minutos con dos llamadas donde el cliente [DOC] (SI §2.2).
- Rappi Colombia: Rappi **paga por adelantado al restaurante** y el efectivo que cobra el repartidor queda como deuda [DOC] (T&C Soy Rappi; E2, tabla de Sudamérica). Restaurante: 7 minutos para aceptar o se rechaza solo [DOC] (E2, tabla de restaurantes). La ayuda pública de SoyRappi tiene preguntas «¿Necesito dinero para conectarme con Soy Rappi?», «¿Retiraste los productos y el pedido fue cancelado?» y «¿Cuánto tiempo tengo para devolver un pedido?» [REA, `inspect_web_page`, soyrappi.com.co/preguntanos, 19 oct, evidencia `ev_c7cca5fc…`]; las respuestas no se pudieron leer [NV]. [INF] Rappi tiene un protocolo de devolución de la comida retirada cuando el pedido se cancela.
- DoorDash (contraste): en pedidos que se pagan en el local el Dasher usa la **Red Card de DoorDash** (dinero de la plataforma). Si la Red Card falla o el local solo acepta efectivo, DoorDash **reembolsa** al Dasher lo que pagó con su dinero; se pide la foto del recibo por un formulario en Ayuda → Ganancias; revisión en 48 horas; sin recibo solo se reembolsa el subtotal; el reembolso entra en el depósito semanal o el siguiente Fast Pay [REA, `inspect_web_page`, help.doordash.com «Dasher Reimbursement FAQs», 19 oct, evidencia `ev_49b02140…`] [DOC, «Reimbursements for Red Card Failure»]. En efectivo al cliente (Cash on Delivery) el Dasher se queda el efectivo y se le descuenta del depósito [DOC] (SI §2.2).

**Tumbite hoy.**

- Modelo aprobado por Richard: el repartidor paga la comida con su dinero (efectivo o su tarjeta), registra monto pagado e importe del ticket, foto opcional del ticket; sin ese registro el pedido no sale (`pagoLocal.ts:107-162`, `operacion.ts:1485`, `:1559`) [TUMBITE].
- La guía pública del repartidor en staging lo explica así: «es tu capital de trabajo: Tumbite no lo presta» y «Sin ese registro el pedido no sale» [REA, `inspect_web_page`, staging.tumbite.com/es/docs/drivers/cash-orders-and-top-ups, 19 oct, evidencia `ev_4dac0dbd…`].
- El restaurante ve «Cobra al repartidor» con el monto [REA, misma página, texto alternativo de la captura] y confirma el pago al confirmar la recogida (`operacion.ts:1562`) [TUMBITE].
- Interruptores por país apagados de fábrica; staging y producción responden `efectivoActivo: false` para la zona de EE.UU. [TUMBITE, consulta pública a `/datos/pais` en los dos sitios, 19 oct].

**Diferencias.**

| #   | Diferencia                                                                                                                                                                                             | Evidencia                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **La app del repartidor multiplica por 100 y muestra dólares** en el cobro, el pago en el local y el saldo prepago. Con pesos colombianos (0 decimales) «60000» se guarda como 6.000.000.              | `Inicio.tsx:744` (`* 100`), `:1683` y `:1068` (`formatearDolares`); `PagoEnLocal.tsx:20-21`; `paises.ts` (COP con 0 decimales) [TUMBITE]. `formatearMonto` ya existe en `packages/compartido/src/dinero.ts:39` y no se usa |
| 2.2 | **La oferta no dice que es en efectivo ni cuánto hay que adelantar** en el local. Uber muestra la insignia «Cash» antes de aceptar; Glovo avisa si hay que pagar al comercio en efectivo.              | `grandes/Oferta.tsx` sin `metodoPago` [TUMBITE]; Uber blog julio 2026 [DOC]; Glovo [OBS] (SI §2.2)                                                                                                                         |
| 2.3 | No hay «No tengo con qué pagar en el local» con reasignación sin castigo (DiDi). Hoy, una vez pagado, solo soporte suelta; antes de pagar, «soltar» funciona pero cuenta para la tasa de finalización. | `operacion.ts:150-186` (abandonos), `:2360` [TUMBITE]; DiDi México [DOC]                                                                                                                                                   |
| 2.4 | Si el repartidor confirma la recogida por **QR + foto** (sin que el restaurante toque «confirmar»), el pago en el local nunca queda confirmado por el restaurante.                                     | `operacion.ts:1506` y `:1599` llaman `salirEnCamino` sin `confirmarPagoLocalRestaurante` (solo lo hace `:1562`) [TUMBITE]                                                                                                  |
| 2.5 | Plato agotado aceptado por el cliente después de que el repartidor aceptó: el total baja, pero la comisión reservada no se recalcula y se cobra la reserva vieja.                                      | `pedidos.ts:134-205` recalcula `ganancia`; `libro.ts:191` cobra `reservaVigente` sin recalcular [TUMBITE]; efecto de dinero [INF]                                                                                          |
| 2.6 | Reembolso al repartidor de la comida que pagó y no entregó: DoorDash lo hace con recibo y 48 horas; Tumbite lo deja «pendiente de decisión».                                                           | `pagoLocal.ts:183-212` [TUMBITE]; decisión 20 de Richard                                                                                                                                                                   |

**Recomendación.**

- 2.1 **[TUMBITE]**: usar `formatearMonto` con la moneda y los decimales que ya manda `/datos/repartidor/saldo-prepago` y `/datos/pais`, y convertir lo escrito a la unidad menor con esos decimales. Sin esto no se puede encender ningún país fuera de EE.UU.
- 2.2 **[TUMBITE]**: la oferta trae `metodoPago` y `montoEnLocal` (= `pago_restaurante`) y muestra «Efectivo · Pagas $X en el local» antes de aceptar.
- 2.3 **[TUMBITE]**: botón «No tengo con qué pagar» antes de registrar el pago: suelta con motivo `sin_capital`, no cuenta para la finalización la primera vez del día.
- 2.4 **[TUMBITE]**: en pedidos directos, el camino QR + foto también exige que el restaurante confirme el pago (o se marca «pago sin confirmar» para soporte).
- 2.5 **[TUMBITE]**: al aplicar el ajuste, recalcular la comisión y liberar la diferencia de la reserva.
- 2.6 **Decisión de Richard** (20): la recomendación ya escrita (reembolso con tope cuando el cliente no paga o no aparece) encaja con DoorDash; falta su «sí».

**Prueba de aceptación.** (a) Zona CO en staging: el repartidor escribe 60000 en «Recibí» y el servidor recibe `montoRecibido: 60000`; la pantalla muestra «$ 60.000» y no «$600.00». (b) La oferta de un pedido en efectivo muestra «Efectivo» y el monto a pagar en el local; la de tarjeta no. (c) Pedido directo recogido por QR + foto: `pagos_local.confirmado_restaurante_en` queda lleno o el pedido aparece como «pago sin confirmar». (d) Ajuste de plato tras aceptar: la comisión cobrada al conciliar es la recalculada. Cada una primero en rojo.

---

## 3. Transferencia directa al repartidor

**Problema.** El cliente paga por transferencia a la cuenta del repartidor (Nequi, Daviplata, Bre-B, pago móvil). La plataforma no ve ese dinero.

**Referencia real más cercana:** Yummy (Venezuela, pago móvil directo al conductor y al repartidor) [OBS] (SI §2.2, PV). **No existe en los grandes:** DoorDash, Uber Eats, Rappi, DiDi Food y Glovo solo documentan efectivo o pago digital a la plataforma [DOC/INF] (SI, «Lo que ninguna plataforma hace»). Búsqueda nueva del 19 oct en apps de domicilio de Colombia: sin política oficial de transferencia al repartidor [NV].

**Recorrido de la referencia y sus excepciones.**

- Yummy: el pasajero paga por pago móvil al conductor, que recibe el viaje completo; la comisión queda como deuda hasta −10 dólares; al tope se bloquean los viajes con pago móvil [OBS]. En 2025 los repartidores dijeron que pagar el pedido antes de que se liberara «no es viable» [OBS]. Verificación: el repartidor ve el pago en su banco; la plataforma no [OBS/INF].
- Riel colombiano: Bre-B es del Banco de la República, funciona con llaves o QR, 24/7, solo nacional [DOC]; Nequi permite hasta 3.000.000 COP por transacción con llaves [DOC]; una transferencia procesada **no se puede cancelar** [DOC, BBVA Colombia].

**Tumbite hoy.**

- Cuentas de cobro del repartidor (banco, Nequi, Daviplata, pago móvil, Zelle) con contraseña, vigencia a las 24 horas, historial y correo (`cuentasCobro.ts:81-165`) [TUMBITE].
- Cobro confirmado **a mano** por el repartidor, anotado como «confirmación manual» (`cobroDirecto.ts:163-215`); «transferencia por verificar» deja entregar con el cobro pendiente (`internacional.ts:341`); el cliente puede abrir una disputa de cobro que crea un ticket (`internacional.ts:447`) [TUMBITE].
- Excedente (transferencia repetida) queda como deuda del repartidor con el cliente (`cobroDirecto.ts`, conciliación) [TUMBITE].

**Diferencias.**

| #   | Diferencia                                                                                                                          | Evidencia                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 3.1 | No hay plazo para la «transferencia por verificar»: puede quedar pendiente para siempre con la comisión apartada.                   | `internacional.ts:341-356` solo anota el evento [TUMBITE]; decisión 22 |
| 3.2 | El cliente no ve en su app a qué cuenta transferir con el titular enmascarado y el monto exacto (o no se encontró en esta lectura). | [NV] en la app del cliente; no se leyó `apps/cliente` completo         |
| 3.3 | Como Bre-B es irreversible, un pago a la cuenta equivocada no tiene vuelta; el estándar no existe para copiarlo.                    | [DOC] BBVA; [INF]                                                      |

**Recomendación.**

- 3.1 **Decisión de Richard** (22): la recomendación de aviso a soporte a las 2 horas y «no pagado» a las 24 horas se puede construir en el reloj apenas diga sí.
- 3.2 **[TUMBITE]**: mostrar al cliente la cuenta vigente del repartidor (tipo, titular enmascarado, llave) y el monto, solo después de que el repartidor esté en camino.
- 3.3 **Decisión de Richard** (7 de SI y 14 de decisiones): mantener el método apagado hasta que un abogado y el piloto lo validen; no hay referencia grande que lo respalde.

**Prueba de aceptación.** Pedido con transferencia marcado «por verificar» hace 25 horas: el reloj lo pasa a `no_pagado`, libera la reserva y crea la deuda del cliente con su ticket; a las 2 horas, aviso a soporte. Con tarjeta, nada cambia.

---

## 4. Recargas y saldo para comisiones

**Problema.** Tumbite cobra su comisión de un saldo del repartidor porque el dinero del pedido no pasa por Tumbite.

**Referencia principal:** DiDi Food (billetera, tope por ciudad y nivel, recargas por OXXO, SPEI y tarjeta, límite de tres pagos en línea al día, 48 horas para reflejarse) [DOC] (SI §2.2). **Secundarias:** Rappi (balance = ganancias − deuda al corte semanal [REA, `inspect_web_page`, soyrappi.com.co/mis-finanzas, 19 oct, evidencia `ev_6b949f3d…`]; dos topes escalonados [DOC*]; no pagar más que la deuda, control antilavado [DOC]); inDrive (prepago puro, recarga por «Top up», 24 horas para reflejarse [DOC]; 20 recargas por semana [OBS]); Yango (tope −20 y comprobante manual en flotas de Perú [OBS]).

**Recorrido y excepciones de la referencia.** Recordatorio al acercarse al tope; bloqueo temporal al llegar; recarga con referencia de la app; espera de confirmación; soporte si no se refleja [DOC]. En Rappi la deuda se descuenta del pago semanal [REA].

**Tumbite hoy.** Prepago que nunca queda negativo; reserva al aceptar, cobro al conciliar, liberación al soltar o cancelar (`libro.ts:100-219`); sin saldo o pasado el tope de efectivo no se ofrece ni se acepta (`operacion.ts:967`, `:1301`); códigos de punto de venta con hash, canje atómico, 10 intentos fallidos por hora, máximo semanal (`recargas.ts:130-199`); recarga por Stripe pendiente hasta el aviso (`recargas.ts:201-260`); canario `libro` [TUMBITE]. La guía de staging dice «Sin saldo no te llegan ofertas de pedidos en efectivo (las de tarjeta sí)» [REA, `ev_4dac0dbd…`].

**Diferencias.**

| #   | Diferencia                                                                                                                            | Evidencia                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 4.1 | No hay aviso «te queda saldo para N pedidos» antes de quedarse sin ofertas en efectivo (DiDi recuerda antes del tope).                | [TUMBITE] búsqueda en `Inicio.tsx`; DiDi [DOC]     |
| 4.2 | Tumbite es más estricto que todos (prepago puro, sin negativo); coincide con inDrive. Es decisión ya tomada por Richard.              | `cobro-directo-tumbite.md` §3 [TUMBITE]            |
| 4.3 | El canje no limita el monto por código (lo limita el punto al emitir); la recarga máxima por día de la decisión 10 no existe todavía. | `recargas.ts:130-199`; decisión 10 [TUMBITE]       |
| 4.4 | Montos del saldo mostrados como dólares en la billetera.                                                                              | `Inicio.tsx:1068-1074` (mismo vacío 2.1) [TUMBITE] |

**Recomendación.** 4.1 y 4.4 **[TUMBITE]**: aviso en la billetera y en la campana cuando el saldo no cubra dos comisiones promedio, con la moneda del país. 4.3 **Decisión de Richard** (10): con su cifra, tope diario por repartidor en `canjearCodigo`.

**Prueba de aceptación.** Repartidor con saldo para una sola comisión: la app muestra el aviso; al aceptar ese pedido, deja de recibir ofertas en efectivo y sigue recibiendo de tarjeta; canjea un código y vuelve a recibirlas. Con la cifra de Richard, la recarga que pasa el tope diario responde 409.

---

## 5. Ticket, diferencias, cliente ausente, impago y disputas

**Referencia principal:** DoorDash (Cash on Delivery, cliente ausente, error charges). **Secundaria:** Rappi.

**Recorrido de la referencia y sus excepciones.**

- DoorDash, cobro en efectivo: «Issue Collecting Cash Payment» con cuatro motivos (corto, sin cambio, no disponible, se niega); si no paga, **no se entrega y se desecha**; el Dasher cobra su pago base y su tasa no se afecta [DOC] (SI §2.2).
- Uber, cliente que paga de menos: la diferencia queda como «arrears» del cliente; con arrears sobre un umbral no puede pedir [DOC] (SI §2.2).
- Ticket: DoorDash pide la foto del recibo para reembolsar lo pagado de su bolsillo; sin recibo, solo el subtotal [REA, `ev_49b02140…`].
- Disputas con tarjeta (EE.UU.): 7 a 21 días para responder, una sola oportunidad, 15 dólares por disputa [DOC] (SI §2.1 H).
- Rappi: deber de no pagar una deuda por encima de lo debido; suspensión por no devolver pedidos cancelados [DOC] (SI §2.2).

**Tumbite hoy.** Cobro con «Cobré» (monto recibido) y «El cliente no pagó» (`cobroDirecto.ts:163-254`); el cliente con deuda no puede pedir en efectivo (`cobroDirecto.ts`, `abrirPedidoDirecto`); diferencias de ticket y de pago dejan la conciliación «con diferencia» (`cobroDirecto.ts:256-327`); propina en efectivo fuera del cobro; disputa de cobro del cliente como ticket (`internacional.ts:447`); devoluciones de tarjeta con cargo a Tumbite, restaurante o repartidor (`devoluciones.ts`, `superadmin.ts:1030`); conector de evidencia para disputas de Stripe (`disputas.ts`) [TUMBITE].

**Diferencias.**

| #   | Diferencia                                                                                                                                                                                                                                     | Evidencia                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 5.1 | «El cliente no pagó» manda siempre el mismo texto como motivo; no hay los cuatro motivos de DoorDash (corto, sin cambio, no está, se niega). «Sin cambio» en DoorDash sí permite entregar.                                                     | `Inicio.tsx:759-762` (`motivo: tg.pedido.noPago`) [TUMBITE]                                          |
| 5.2 | **La conciliación diaria suma los pedidos directos** en lo esperado para restaurantes y repartidores, pero sus abonos no existen en `movimientos`; además suma todas las monedas juntas. El primer día con un pedido en efectivo: «no cuadra». | `conciliacion.ts:29-34` y `:69-71` frente a `operacion.ts:1772` [TUMBITE]; efecto sin ejecutar [INF] |
| 5.3 | No hay bandeja para soporte con pedidos «con diferencia», pérdidas de comida pendientes, excedentes por devolver ni transferencias por verificar. Solo existe el libro por pedido (API) y el total de comisiones en el panel.                  | `internacional.ts:136-160`, `ControlDinero.tsx:378` [TUMBITE]                                        |
| 5.4 | Sin tolerancia de ticket: cualquier redondeo manda el pedido a revisión.                                                                                                                                                                       | Decisión 23 [TUMBITE]                                                                                |

**Recomendación.** 5.1 **[TUMBITE]**: cuatro motivos; «sin cambio» no cancela (se cobra lo posible y la diferencia queda como deuda, igual que hoy con «parcial»). 5.2 **[TUMBITE]**: la conciliación diaria filtra `metodo_pago = 'tarjeta'` y agrupa por moneda; la de directos ya vive en el libro. 5.3 **[TUMBITE]**: bandeja «Cobro directo» en el panel con esas cuatro listas y su acción. 5.4 **Decisión de Richard** (23).

**Prueba de aceptación.** (a) Un día con un pedido de tarjeta y uno en efectivo en zona CO: `conciliar(dia)` devuelve `cuadra: true` y no mezcla COP con USD. (b) «Sin cambio» con 50.000 de 52.000: `parcial`, entrega permitida, deuda de 2.000. (c) La bandeja lista un pedido con diferencia de ticket y una pérdida pendiente. Primero en rojo.

---

## 6. Operación del restaurante y resolución por soporte

**Referencia principal:** DoorDash Merchant (tableta, error charges). **Secundaria:** Uber Eats Manager.

**Recorrido de la referencia y sus excepciones.**

- DoorDash: confirmar con tiempo de preparación, cocina ocupada, aviso del Dasher a 5 minutos, «listo» sin esperar al Dasher [DOC] (COMPARACION §1-3). Si se reporta un faltante o error, DoorDash reembolsa al cliente y puede cobrar al local del 25 % al 100 % del artículo más impuesto, descontado del pago; lo que no depende del local (retraso, no-show, temperatura) no se le cobra; se disputa en el Merchant Portal (solo Admin o Store Manager) y la respuesta llega «en unas horas»; errores reportados 72 horas o más después de entregar los absorbe DoorDash (página antigua) [DOC, «Understanding Error Charges and Disputes», 19 oct].
- Uber Eats Manager: pestaña Pedidos → filtro «Store refunded» o «Potential Deduction» → Disputar con motivo, descripción y foto o video; solo administradores y gerentes; **30 días desde la fecha del pedido**; caso por caso [DOC, «order errors», 19 oct].
- DiDi Food Colombia: CashBlock (solo pagos virtuales) que DiDi activa si el restaurante acumula comisiones pendientes por efectivo [DOC] (PC §2.7).

**Tumbite hoy.** Aceptar con tiempo, ajustar tiempo antes de asignar, cocina ocupada (`operacion.ts:450`), plato agotado con decisión del cliente, rechazar con devolución completa, ver venir al repartidor, QR, confirmar recogida, «Cobra al repartidor» en directos, resumen del día y tablero [TUMBITE]. Las devoluciones cargadas al restaurante entran como movimiento «ajuste» [TUMBITE, `devoluciones.ts`].

**Diferencias.**

| #   | Diferencia                                                                                                                                        | Evidencia                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 6.1 | El restaurante **no tiene cómo disputar** un cargo por devolución ni ve el motivo con la evidencia; DoorDash y Uber sí, con plazo (Uber 30 días). | Sin ruta ni pantalla en `apps/restaurante/src` [TUMBITE]; [DOC] |
| 6.2 | En directos, el restaurante no puede marcar «el repartidor me pagó de menos»: solo ve lo que el repartidor registró.                              | `internacional.ts:320-339` es solo lectura [TUMBITE]            |
| 6.3 | Hoy por defecto Tumbite absorbe las devoluciones (decisión 2), así que 6.1 no le cuesta dinero al restaurante mientras no se le cargue nada.      | `DECISIONES-RICHARD-FASE-2.md` punto 2 [TUMBITE]                |

**Recomendación.** 6.1 **[TUMBITE]**: «Disputar» dentro de los tres puntos del movimiento de ajuste, con motivo y foto, que abre un ticket ligado al pedido; plazo de 30 días como Uber (si Richard quiere otro plazo, se cambia). 6.2 **[TUMBITE]**: botón «No me pagaron completo» en el pedido directo antes de confirmar la recogida; deja la conciliación «con diferencia».

**Prueba de aceptación.** Devolución cargada al restaurante: aparece en su app con motivo y evidencia; «Disputar» crea un ticket con el pedido; después de 30 días el botón no aparece y explica por qué.

---

## 7. Alta, disponibilidad, ubicación y ganancias del repartidor

**Referencia principal:** DoorDash Dasher. **Secundaria:** SoyRappi.

**Recorrido.** Ya documentado en `2026-10-18-repartidor.md` §2 [DOC]. Nuevo hoy: SoyRappi paga **semanalmente** las ganancias de la semana anterior a la cuenta registrada; «Ganancia total» muestra tiempo conectado y promedio por hora; el balance es ganancias menos deuda al corte semanal [REA, `ev_6b949f3d…`]. Sus preguntas frecuentes cubren documentos, tiempo de aprobación de la cuenta, zonas para conectarse, estados de la cuenta y «¿Necesito dinero para conectarme?» [REA, `ev_c7cca5fc…`; respuestas NV].

**Tumbite hoy.** Entrega «repartidor como los grandes» del 18 oct: oferta completa con cuenta regresiva, calificaciones, ganancias con desglose, campana, pausa, «llegué», «no está listo», alta guiada, ayuda en el pedido y emergencia [TUMBITE, ficha del repartidor §5]. GPS en segundo plano y navegación dentro de la app quedan para la fase 2 [TUMBITE].

**Diferencias.**

| #   | Diferencia                                                                                                                                                                                | Evidencia                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 7.1 | Ganancias no muestra tiempo conectado ni promedio por hora (SoyRappi sí).                                                                                                                 | [REA] / [TUMBITE] `grandes/Ganancias.tsx` |
| 7.2 | En pedidos directos, la ganancia del repartidor no llega como abono (no pasó por Tumbite); la pantalla de ganancias debería decir «cobrado en mano» para que no parezca que falta dinero. | `operacion.ts:1772` [TUMBITE]; [INF]      |
| 7.3 | La guía no le dice al repartidor que necesita capital para el local antes de activarse (SoyRappi tiene esa pregunta).                                                                     | [REA] / [TUMBITE]                         |
| 7.4 | GPS en segundo plano y ofertas con la app cerrada: pendientes de la fase 2 (ya conocido).                                                                                                 | Ficha del repartidor, brecha 10           |

**Recomendación.** 7.1 **[TUMBITE]**: tiempo en línea y promedio por hora en Ganancias. 7.2 **[TUMBITE]**: fila «Cobrado en mano» por pedido directo. 7.3 **[TUMBITE]**: paso en el alta guiada para países con efectivo. 7.4 sigue en su plan.

**Prueba de aceptación.** Repartidor con un pedido de tarjeta y uno en efectivo en la semana: Ganancias muestra los dos, el directo como «cobrado en mano», y las horas conectadas.

---

## Vacíos que afectan el MVP

«Bloquea el lanzamiento» se mide así: **EE.UU.** = el MVP con tarjeta que ya está en producción; **CO/VE** = encender efectivo o transferencia en un país.

| #   | Vacío                                                                                    | Proceso | Evidencia                                                             | ¿Bloquea el lanzamiento?                            | Prueba de aceptación propuesta                                                                  |
| --- | ---------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | La app del repartidor convierte ×100 y muestra dólares en cobro, pago en local y saldo   | 2, 4    | `Inicio.tsx:744`, `:1068`, `:1683`; `PagoEnLocal.tsx:20-21` [TUMBITE] | EE.UU. no · **CO/VE sí**                            | En zona CO, «60000» llega como 60000 y se ve «$ 60.000»                                         |
| 2   | La conciliación diaria mezcla pedidos directos y monedas                                 | 5       | `conciliacion.ts:29-34`, `:69-71` [TUMBITE] [INF]                     | EE.UU. no · **CO/VE sí**                            | Día con tarjeta + efectivo CO: `cuadra: true`, totales por moneda                               |
| 3   | La oferta no dice «efectivo» ni el monto a adelantar en el local                         | 2       | `grandes/Oferta.tsx` [TUMBITE]; Uber [DOC]                            | EE.UU. no · **CO/VE sí**                            | Oferta en efectivo muestra la insignia y el monto; la de tarjeta no                             |
| 4   | «Lugar seguro» permitido en pedidos en efectivo o transferencia                          | 1, 5    | `operacion.ts:1737` [TUMBITE]; DoorDash [DOC]                         | EE.UU. no · **CO/VE sí**                            | `modo=seguro` en pedido directo responde 409; `no-pago` sí cierra                               |
| 5   | Bandeja de soporte para diferencias, pérdidas, excedentes y transferencias por verificar | 5, 6    | `internacional.ts:136-160` [TUMBITE]                                  | EE.UU. no · **CO/VE sí**                            | La bandeja lista un pedido de cada tipo con su acción                                           |
| 6   | Plazo de la transferencia por verificar                                                  | 3       | `internacional.ts:341` [TUMBITE]; decisión 22                         | EE.UU. no · CO/VE sí (si se enciende transferencia) | A las 24 h pasa a «no pagado» con deuda y ticket                                                |
| 7   | Pago en el local sin confirmar cuando la recogida es por QR + foto                       | 2       | `operacion.ts:1506`, `:1599` [TUMBITE]                                | EE.UU. no · CO/VE no (queda rastro; soporte lo ve)  | Recogida por QR en directo deja `confirmado_restaurante_en` o la marca «sin confirmar»          |
| 8   | Comisión reservada no se recalcula tras quitar un plato agotado                          | 2       | `pedidos.ts:134-205`, `libro.ts:191` [TUMBITE] [INF]                  | EE.UU. no · CO/VE no                                | La comisión cobrada es la recalculada; la diferencia vuelve al prepago                          |
| 9   | Cuatro motivos al cobrar («sin cambio» permite entregar)                                 | 5       | `Inicio.tsx:759-762` [TUMBITE]; DoorDash [DOC]                        | EE.UU. no · CO/VE no                                | «Sin cambio» deja `parcial` y entrega; los otros tres cancelan                                  |
| 10  | «No tengo con qué pagar en el local» con reasignación sin castigo                        | 2       | `operacion.ts:150-186` [TUMBITE]; DiDi [DOC]                          | EE.UU. no · CO/VE no                                | Primera vez del día no cuenta en la finalización; el pedido vuelve a ofrecerse                  |
| 11  | Reembolso de la comida comprada y no entregada                                           | 2, 5    | `pagoLocal.ts:183-212` [TUMBITE]; DoorDash [REA]; decisión 20         | EE.UU. no · **CO/VE sí** (decisión de Richard)      | Con la regla de Richard, cancelación tras compra abona al repartidor con tope y foto del ticket |
| 12  | El restaurante no puede disputar un cargo por devolución                                 | 6       | `apps/restaurante/src` [TUMBITE]; Uber 30 días [DOC]                  | No (hoy Tumbite absorbe)                            | «Disputar» crea ticket ligado; vence a los 30 días                                              |
| 13  | Aviso de saldo bajo antes de quedarse sin ofertas en efectivo                            | 4       | [TUMBITE]; DiDi [DOC]                                                 | No                                                  | Con saldo para una comisión aparece el aviso                                                    |
| 14  | Tolerancia del ticket                                                                    | 5       | Decisión 23                                                           | No                                                  | Diferencia dentro de la tolerancia: «conciliado»; fuera: «con diferencia»                       |
| 15  | Ganancias sin tiempo conectado ni «cobrado en mano»                                      | 7       | [REA] SoyRappi; [TUMBITE]                                             | No                                                  | Ganancias muestra horas, promedio y el directo como «cobrado en mano»                           |

## Conclusiones

1. Para EE.UU. no aparece ningún vacío nuevo que frene el MVP con tarjeta; lo pendiente son decisiones ya listadas (impuesto, retiros, compra real de un dólar).
2. Para Colombia y Venezuela hay seis vacíos que bloquean encender el efectivo: los números 1 a 6 de la tabla, más la decisión 11 de Richard sobre la comida perdida.
3. El más grave es la moneda en la app del repartidor: un error de cien veces en cada cobro en pesos.
4. El segundo es la conciliación diaria, que daría alarmas falsas desde el primer pedido en efectivo y mezclaría monedas.
5. La arquitectura del servidor (tres estados, libro, reserva, prepago sin negativo) coincide con DiDi e inDrive y no hay que rehacerla.
6. La transferencia directa al repartidor no tiene respaldo en ninguna plataforma grande; la única referencia es Yummy, por prensa, y Bre-B es irreversible.
7. Lo que falta en restaurante y soporte (disputar cargos, bandeja de cobro directo) es copia directa de DoorDash y Uber, sin decisiones comerciales nuevas.
8. Los siguientes pasos de código son decisiones propias de Tumbite y caben en una sola entrega con pruebas en rojo; los plazos y cifras (20 a 23, 10, 11) esperan a Richard.

---

## Fuentes

Leídas el 19 de octubre de 2026 salvo que se indique otra fecha.

**Observación con REA (como visitante, sin cuenta)**

- Tumbite staging, portada de Docs, 19 oct 2026, evidencia `ev_4717e78f6e714b9adbc28109c70118d5cf5a79f599590fd2645eeecb428c75b7`: https://staging.tumbite.com/es/docs
- Tumbite staging, guía «Pedidos en efectivo y recargas» del repartidor, 19 oct 2026, evidencia `ev_4dac0dbd435a9b4a14707f478a04b383fdeab399c858d96f2f1ac4edf604faed`: https://staging.tumbite.com/es/docs/drivers/cash-orders-and-top-ups
- SoyRappi Colombia, «Mis finanzas», 19 oct 2026, evidencia `ev_6b949f3d3cd1a5c0f0676a917bdbaef511fb6b829e12b49f8d5d4ecf80e07c09`: https://soyrappi.com.co/mis-finanzas
- SoyRappi Colombia, «Pregúntanos» (solo preguntas visibles), 19 oct 2026, evidencia `ev_c7cca5fc614ac3f8aba2b388dfef9f55810dfd487179723d5cc6a5bc7c708acb`: https://soyrappi.com.co/preguntanos/
- DoorDash, «Dasher Reimbursement FAQs», 19 oct 2026, evidencia `ev_49b02140311c79232f24122940867116299ce81fde4dfcf7594876df6afffdc3`: https://help.doordash.com/en-us/dashers/article/dasher-reimbursement-faqs
- Tumbite, país y métodos de pago públicos (consulta directa, no REA), 19 oct 2026: https://staging.tumbite.com/datos/pais y https://tumbite.com/datos/pais

**Documentación oficial (nueva en esta ficha)**

- DoorDash, «My Dasher Red Card was declined»: https://help.doordash.com/en-us/dashers/article/my-dasher-red-card-was-declined
- DoorDash, «Reimbursements for Red Card Failure»: https://help.doordash.com/en-ca/dashers/article/reimbursements-for-red-card-failure
- DoorDash, «How do I complete a delivery or task if the customer is unavailable?»: https://help.doordash.com/en-us/dashers/article/how-to-complete-a-delivery-when-the-customer-is-unavailable
- DoorDash, «Understanding Error Charges and Disputes»: https://help.doordash.com/en-us/merchants/article/what-are-order-error-adjustments
- DoorDash, «Understanding Error Charges and the Dispute Process»: https://help.doordash.com/merchants/s/article/How-Do-I-Dispute-Error-Charges
- Uber Eats, «Order errors» (centro de aprendizaje para comercios): https://merchants.ubereats.com/gb/en/resources/learning-center/order-errors
- Uber, «Dispute an order error»: https://www.uber.com/en-AU/blog/dispute-an-order-error/
- Banco de la República, preguntas frecuentes de Bre-B: https://www.banrep.gov.co/es/bre-b/preguntas-frecuentes
- Nequi, Bre-B: https://www.nequi.com.co/personas/paga-con-nequi/bre-b
- BBVA Colombia, transferencias a Nequi (irreversibilidad): https://www.bbva.com.co/personas/blog/educacion-financiera/cuentas/transferencia-nequi.html
- Rappi, pagos digitales para comercios en Colombia: https://merchants.rappi.com/es-co/pagos-digitales-envios-domicilio

**Reutilizadas de fichas anteriores (18 oct 2026; las direcciones completas están en esas fichas)**

- DoorDash, Cash on Delivery Overview and FAQ: https://help.doordash.com/dashers/s/article/Cash-on-Delivery-Overview-and-FAQ
- Uber, términos de pago en efectivo (EE.UU.): https://www.uber.com/us/en/legal/consumer-cash-payment-terms/
- Uber, «Introducing cash payment for deliveries» (julio 2026): https://www.uber.com/us/en/blog/introducing-cash-payment-for-deliveries/
- Rappi, T&C Soy Rappi Colombia: https://legal.rappi.com.co/colombia/terminos-y-condiciones-de-uso-de-plataforma-virtual-rappitendero/
- DiDi Food México, preguntas frecuentes de repartidores: https://web.didiglobal.com/mx/food/repartidores/preguntas-frecuentes/
- DiDi Food Colombia, métodos de pago (repartidores): https://web.didiglobal.com/co/food/repartidores/preguntas-frecuentes/metodos-de-pago-en-didi-food/
- DiDi Food Colombia, pagos en efectivo (repartidores): https://web.didiglobal.com/co/food/repartidores/preguntas-frecuentes/pagos-en-efectivo/
- DiDi Food Colombia, habilitar pago en efectivo (restaurantes): https://web.didiglobal.com/co/food/restaurantes/guias/paso-a-paso-para-habiliar-el-pago-en-efecitvo-para-tus-pedidos/
- inDrive, recargar la cuenta (Colombia): https://indrive.com/en-co/help/drivers/how-to-top-up-your-indrive-account
- Bolt, deuda en efectivo: https://bolt.eu/en-sa/driver/guide/cash-debt/
- Yango Colombia (conductores): https://yango.com/es_co/driver/
- Crónica.Uno, cambios de pago en Yummy (2025): https://cronica.uno/cambios-en-formas-de-pago-de-yummy-complican-a-usuarios-conductores-y-repartidores/
- Chofer Venezuela, Yummy Rides (28 sep 2026): https://chofervenezuela.com/cuanto-se-gana-yummy-rides-venezuela/
- DoorDash Drive, estados de la entrega: https://developer.doordash.com/en-US/docs/drive/reference/delivery_statuses/
- DoorDash, tableta del comercio: https://help.doordash.com/en-us/merchants/article/tablet-order-manager-overview

**Estudios de Richard** (carpeta «Proyectos Para estudiar y copiar clonar ideas », consultados el 19 oct 2026)

- E1 «Del primer registro a la entrega | DoorDash, Uber Eats y Rappi», 40 p., consulta del 14 oct 2026: p.19 (excepciones), p.29 (efectivo: «saldo de efectivo, tope de exposición por repartidor, confirmación de cobro, conciliación y bloqueo»), p.30 (pagos internacionales).
- E2 «Estudio delivery — Tumbite», 15 p.: tabla de restaurantes (Rappi 7 minutos), efectivo contra entrega en Rappi, disputas con evidencia.
