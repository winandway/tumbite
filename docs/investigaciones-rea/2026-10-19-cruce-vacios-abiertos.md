# Cruce de los vacíos abiertos (5 a 15) frente a los grandes

**Fecha:** 19 de octubre de 2026. **Tipo:** investigación (no se tocó código, no hubo commits ni publicación). **Método:** `docs/METODOLOGIA-INGENIERIA-REA.md`. **Código leído:** `main` en `eeeb90c9` (`apps/servidor/src/internacional/*.ts`, `rutas/operacion.ts`, `rutas/internacional.ts`, `schema.sql`, `apps/repartidor/src`). **Continúa:** `2026-10-19-cruce-procesos-mvp.md` (en adelante **CP**); lo que CP ya comprobó no se repite, se cita.

> **Aclaración (19 oct, noche):** esta ficha no usó REA directamente. Su única etiqueta [REA] viene de la ficha anterior y es una lectura de una página pública de ayuda hecha con la herramienta REA, no una observación de la app de la competencia. Ninguna afirmación de esta ficha describe el funcionamiento interno de esas apps.

**Etiquetas:** [REA] observado con herramienta REA · [DOC] documentación oficial publicada · [DOC-índice] texto oficial que solo se pudo leer a través del índice del buscador (la página se dibuja con JavaScript y no se dejó leer directamente; ver «Límites») · [OBS] observación pública (prensa, foros, publicaciones) · [INF] inferencia nuestra · [NV] no verificado · [TUMBITE] lo que hace hoy Tumbite según su código (archivo:línea). «No encontramos documentación» significa solo eso: no que ninguna plataforma lo tenga.

**Clasificación para el MVP:** **(a)** requisito antes de encender el cobro en mano en un país · **(b)** no bloquea · **(c)** decisión comercial de Richard.

## Límites de esta ronda

- No se descompiló ni analizó ninguna app de terceros; no se usó ninguna cuenta; no se capturó tráfico ajeno.
- No se usó REA en esta ronda: sus herramientas de página exigen un navegador conectado por depuración, y la evidencia REA útil de SoyRappi y DoorDash ya está en CP. Se leyeron páginas públicas de ayuda con WebFetch y con descarga directa como visitante.
- Las páginas de SoyRappi (`/preguntanos`, `/devoluciones`, `/soporte`, Argentina `/deuda`) se dibujan con JavaScript: ni la descarga directa ni Chrome sin interfaz devolvieron su texto. Del archivo público de la página sí se leyó una respuesta incrustada («¿Necesito dinero para conectarme?»). Lo demás de Rappi se toma del texto que muestra el buscador y queda como [DOC-índice].
- **Trabajo en paralelo:** al cerrar esta ficha, el árbol de trabajo tiene sin commit una bandeja de soporte en construcción (`apps/servidor/src/internacional/bandeja.ts`, tablas `casos_dinero`, `casos_dinero_historial` e `incidencias_dinero` en `schema.sql`). No se toca; la sección del vacío 5 dice qué le falta frente a la referencia.

## Resumen

1. Solo dos vacíos son requisito técnico antes de encender un país: la **bandeja de soporte** (5) y la **comisión que no se recalcula tras quitar un plato** (8), porque cobra de más al repartidor.
2. Dos son decisión de Richard que también bloquean encender: **quién absorbe la comida comprada y no entregada** (11) y, solo si se enciende la transferencia, **el plazo de la transferencia por verificar** (6).
3. La tolerancia del ticket (14) es decisión de Richard pero no bloquea: la bandeja la sustituye mientras tanto.
4. Los demás (7, 9, 10, 12, 13, 15) no bloquean; cuatro de ellos caben en la bandeja como casos visibles en vez de lógica nueva.
5. Corrección a CP: la ventana de disputa de DoorDash para comercios es hoy de **14 días** (página oficial leída el 19 oct), no 72 horas.
6. Hallazgo nuevo con respaldo oficial: Uber Eats manda el **excedente del cliente a su billetera** (o lo deja como propina); Rappi pide **devolver la comida de un pedido cancelado en 24 horas (12 si es perecedera) con certificado** para borrar la deuda.

---

## Vacío 5. Bandeja de soporte para diferencias, pérdidas, excedentes y transferencias por verificar

**Qué hacen los grandes (recorrido y excepciones).**

- DoorDash, comercios: Merchant Portal → Financials → Transactions → filtro «Error charge» → número de pedido → «Dispute Charge» → artículos → motivo de una lista. Estados con etiqueta de color: **«Dispute under review»** (amarillo), **«approved»** (verde, con el monto devuelto sumado al pago estimado) y **«denied»** (rojo). Respuesta en unas horas. Solo **Admin o Store Manager**; ventana de **14 días** (más viejo, por soporte); botón deshabilitado por exceso de disputas, vuelve en 72 horas; el ajuste aprobado aparece en la columna **«Adjustments»**. Cargo al comercio del 25 % al 100 % del artículo más impuesto; ninguno si el reporte es fraudulento o la falla no es del comercio [DOC, DoorDash «Understanding Error Charges and Disputes», leída 19 oct 2026].
- Uber Eats Manager: pestaña Pedidos → filtros «Store refunded» o «Potential Deduction» → Disputar con formulario y foto o video; estado seguible en el tablero; caso por caso, sin garantía de reverso; 30 días desde el pedido [DOC, Uber «How to dispute an order error adjustment», leída 19 oct 2026] (ya en CP §6). Un tercero dice que los términos del Reino Unido dan 14 días [OBS, Bronze Vision].
- Uber, socios de flota con efectivo: «Saldo» negativo = adeudo; por conductor, **Ganancias totales + Reembolsos y gastos − Pagos**; límite de adeudo por ciudad (sin cifra pública); aviso por correo o en la app con **monto, días para pagar y cómo**; restricción de viajes en efectivo de los conductores vinculados; pago mínimo o total; el pago se refleja en **hasta 72 horas**; si no aparece, Ayuda [DOC, Uber México blog del 6 abr 2022 y FAQ de flotas]. En el tablero de flota: tarifas brutas, netas, incentivos, pagos varios, **efectivo cobrado** y pago neto; reportes descargables [DOC, Uber «Fleet Dashboard» y API de reportes de flota].
- Herramientas de reparto propio (no plataformas de comida): el efectivo pasa por **«por cobrar → cobrado (con el repartidor) → con el cajero → en el banco»**, filtrable por repartidor y con cambio de estado en lote [OBS, Shipox]; la deuda queda con el repartidor hasta que quien recibe confirma la entrega del dinero; las fuentes de diferencia típicas son cobro parcial, entrega fallida y devolución [OBS, guías de conciliación de contra entrega].
- DiDi Food: el repartidor reporta desde Ayuda («Dinero insuficiente para pagar el pedido» → «Aún necesito ayuda») y **soporte revisa la solicitud**; en disputas entre tienda y cliente, DiDi revisa comunicaciones y evidencias y fija responsable y proporción de compensación [DOC, DiDi México y Perú; DiDi Colombia, política de reembolsos].
- Rappi: la deuda por un pedido cancelado se borra cuando el repartidor **sube al Centro de Ayuda el certificado de devolución** que entrega el hub o la fundación [DOC-índice, SoyRappi Colombia].
- Verificación de transferencias en Venezuela (Cashea, no es reparto): para verificar un pago móvil pide **banco emisor, monto en bolívares, referencia, fecha y captura del comprobante**; si no se verifica por un dato mal escrito, se reintenta a la media hora; pagos de terceros aumentan el riesgo; el excedente se aplica a la siguiente cuota o se devuelve por transferencia «en algunos días» [DOC, Cashea preguntas frecuentes].
- No encontramos documentación pública de la herramienta interna de soporte de DoorDash, Uber, Rappi o DiDi para casos de efectivo de un pedido [NV]: lo de arriba es lo que esas plataformas muestran a comercios, flotas y repartidores, que es el reflejo público de esa herramienta.

**Qué tiene Tumbite hoy (en `main`).** Los casos existen como datos pero sin bandeja: `pedidos.conciliacion_estado = 'con_diferencia'` (`cobroDirecto.ts:283-284`, `:232`), `pagos_local.diferencia_pago / diferencia_ticket` (`pagoLocal.ts:128-129`), pérdida de comida en el libro con concepto `comida_comprada_sin_entregar` (`pagoLocal.ts:183-206`), excedente `excedente_cliente_por_devolver` (`cobroDirecto.ts:313`), transferencia por verificar **solo como evento** del pedido, sin estado propio (`rutas/internacional.ts:348-363`), y la disputa de cobro del cliente como ticket de queja (`rutas/internacional.ts:454-488`). Soporte solo tiene el libro por pedido (`/admin/libro/pedido/:id`) y el total de comisiones. En el árbol de trabajo hay una bandeja en construcción (ver «Límites»).

**Clasificación: (a).** Sin bandeja, cada diferencia, pérdida o excedente queda escrita y nadie la ve.

**Mínimo para el MVP:** una lista única en el panel de soporte que salga de esos estados (sin contabilidad aparte), con responsable, estado e historial, y las acciones de la tabla de abajo. Detalle en «Lo que recomendamos para la bandeja».

**Prueba de aceptación.** En staging, un pedido de cada tipo (diferencia de ticket, pago incompleto, excedente, comida sin entregar, transferencia por verificar, pago en el local sin confirmar) aparece una sola vez en la bandeja con sus montos en su moneda; «tomar» lo pone «en revisión» con el responsable; «resolver» exige un motivo de cierre; repetir la misma acción no duplica nada; ningún caso desaparece del libro. Primero en rojo.

---

## Vacío 6. Plazo de la transferencia por verificar

**Referencia.** No encontramos ninguna plataforma de reparto que documente un pago del cliente directo a la cuenta del repartidor con «verificar después» (CP §3 ya lo dijo; búsqueda nueva del 19 oct sobre Yummy, Ridery y Cashea, sin política pública) [NV]. Lo más cercano:

- Yummy: la comisión del viaje pagado por pago móvil queda como deuda del conductor [OBS, Chofer Venezuela]; la recarga de la billetera por pago móvil se acredita al reportarla en un formulario [OBS, publicación en X de 2021].
- Cashea: verificación con referencia, banco, monto y fecha; reintento a los 30 minutos si un dato estaba mal; soporte si el banco no está en la lista [DOC].
- Uber: los pagos de un adeudo se reflejan en hasta 72 horas; si no, Ayuda [DOC].

**Tumbite hoy.** «Transferencia por verificar» deja entregar con el cobro `pendiente` y la comisión apartada, sin plazo (`rutas/internacional.ts:348-363`); el pedido no se concilia hasta que el repartidor confirma (`cobroDirecto.ts:259-272`). La recomendación escrita es aviso a soporte a las 2 horas y «no pagado» con deuda a las 24 (decisión 22).

**Clasificación: (c)**, y requisito **solo** si se enciende la transferencia al repartidor en un país (el efectivo no lo necesita).

**Mínimo para el MVP:** que el caso aparezca en la bandeja con su antigüedad visible desde el primer minuto, y que soporte pueda llamar al repartidor y dejar nota. El pase automático a «no pagado» espera la cifra de Richard. Como la marca hoy es solo un evento, la bandeja la tiene que leer de `eventos` o el servidor tiene que guardar la hora en el pedido [INF].

---

## Vacío 7. Pago en el local sin confirmar cuando la recogida es por QR y foto

**Referencia.** En DiDi Food el repartidor paga en la tienda y recién entonces recibe el pedido; no hay un paso documentado en que la tienda «confirme el pago» en la app [DOC, DiDi Food México y Colombia]. En DoorDash el Dasher paga con la Red Card de la plataforma, así que la tienda no confirma nada [DOC] (CP §2). No encontramos documentación de una confirmación del cobro en el mostrador por parte del restaurante en ninguna plataforma [NV]. [INF] El control real es físico: el restaurante no suelta la bolsa sin cobrar.

**Tumbite hoy.** La recogida por QR y foto hace salir el pedido sin `confirmarPagoLocalRestaurante` (`operacion.ts:1511`, `:1610`); solo la confirmación del restaurante la llena (`operacion.ts:1573`). El dato `confirmado_restaurante_en` queda vacío y la conciliación no lo mira (`cobroDirecto.ts:259-284`).

**Clasificación: (b).**

**Mínimo para el MVP:** que esos pedidos aparezcan en la bandeja como «pago en el local sin confirmar» con la acción de soporte «el restaurante confirmó por teléfono». No hace falta cambiar el camino del QR.

---

## Vacío 8. La comisión reservada no se recalcula al quitar un plato agotado

**Referencia.** DiDi: cuando un cupón hace que el cliente pague menos de lo que el repartidor pagó en la tienda, «lo restante se deposita en tu billetera» y no afecta sus ganancias [DOC, DiDi Perú y Colombia]. No encontramos documentación específica de cómo recalculan la comisión al quitar un artículo [NV]; el principio público es que el repartidor no pierde por un cambio del pedido.

**Tumbite hoy.** Al quitar el plato, `rutas/pedidos.ts:189-205` recalcula subtotal, total, pago al restaurante y `ganancia`; la reserva de comisión no se toca (`libro.ts:103-150`) y la conciliación cobra la reserva vigente (`libro.ts:214-225`, llamada en `cobroDirecto.ts:292`). La comisión del directo depende del subtotal (`cobroDirecto.ts:52-55`). Resultado: se cobra la comisión sobre el pedido viejo [INF, sin ejecutar].

**Clasificación: (a).** Es un cobro de más al repartidor, pequeño pero real, y la regla es que un error de dinero nuestro no se lanza.

**Mínimo para el MVP:** al aplicar el ajuste en un pedido directo con reserva, recalcular `comisionDirecta` y devolver la diferencia al prepago en el mismo lote (nunca subir la reserva sin saldo). Prueba en rojo: plato de 10.000 quitado de un pedido de 50.000 en zona CO; la comisión cobrada al conciliar es la del pedido de 40.000.

---

## Vacío 9. Motivos al cobrar («sin cambio» y los demás)

**Referencia.**

- DoorDash: «Issue Collecting Cash Payment» con cuatro motivos (corto de efectivo, **no tengo cambio**, cliente no disponible, se niega a pagar). Con «no tengo cambio» **se entrega sin cobrar**; en los otros tres, no se cobra y se desecha; el Dasher cobra su pago base y su tasa de finalización no cambia [DOC, DoorDash «Cash on Delivery Overview and FAQ»]. En DoorDash Drive, entregar sin cobrar por falta de cambio es para el comercio una entrega exitosa, aunque DoorDash lo cuenta por dentro como abandono [DOC, DoorDash Drive «Deliver cash orders»].
- Uber Eats: el repartidor **no está obligado a llevar cambio**; el cliente «paga lo que puede», el repartidor anota el monto exacto y la diferencia queda como saldo pendiente del cliente; **lo pagado de más va a la billetera de Uber del cliente**, o es propina si el cliente así lo quiere; el saldo pendiente bloquea nuevos pedidos hasta pagarlo [DOC, Uber «How do I use Cash as a payment method?»].
- DiDi: sin cambio, no entregar hasta tenerlo y pedir el monto exacto; si no se resuelve, Ayuda → «Dinero insuficiente para pagar el pedido»; «no afecta tus ganancias» [DOC, DiDi México y Perú].

**Tumbite hoy.** «El cliente no pagó» manda siempre el mismo texto como motivo (`apps/repartidor/src/Inicio.tsx:768-770`) y cancela (`cobroDirecto.ts:217-257`). «Cobré» con menos deja `parcial` y la diferencia como deuda del cliente (`cobroDirecto.ts:179-181`, `:286-296`), que es justo el «paga lo que puede» de Uber. Con más, queda excedente que el repartidor le debe al cliente (`cobroDirecto.ts:313`).

**Clasificación: (b).** El caso «sin cambio» ya tiene salida («Cobré» con lo recibido); falta que quede dicho por qué.

**Mínimo para el MVP:** que «El cliente no pagó» mande uno de tres motivos codificados (corto, no está, se niega) y que el texto de «Cobré» diga «si no tienes cambio, anota lo que recibiste: la diferencia queda a cuenta del cliente». Los motivos alimentan la bandeja. La billetera del cliente para el excedente (Uber) no es MVP: hoy el excedente lo devuelve el repartidor (decisión 21).

---

## Vacío 10. «No tengo con qué pagar en el local»

**Referencia.** DiDi Food México y Perú: en el detalle del viaje, triángulo de alerta → **«Efectivo insuficiente»** → el pedido **se reasigna automáticamente** a otro repartidor [DOC]. No encontramos documentación de si eso cuenta en su tasa [NV]. DoorDash: si la Red Card falla, el Dasher puede pagar con su dinero y se le reembolsa con recibo [DOC] (CP §2).

**Tumbite hoy.** Antes de registrar el pago, «soltar» devuelve el pedido a la fila y libera la reserva, pero anota un abandono para la tasa de finalización (`operacion.ts:150-186`, `:2370-2394`). Después de pagar, solo soporte puede soltarlo (`operacion.ts:2382-2389`).

**Clasificación: (b).** El camino existe; lo que falta es que no castigue.

**Mínimo para el MVP:** motivo fijo «no tengo con qué pagar en el local» en «soltar», que no cuente en la tasa la primera vez del día (más veces sí, para no abrir un hueco). No hace falta reasignación nueva: soltar ya vuelve a ofrecer.

---

## Vacío 11. Comida comprada y no entregada

**Referencia.**

- DoorDash: reembolsa al Dasher lo que pagó de su bolsillo, con foto del recibo, revisión en 48 horas; sin recibo, solo el subtotal [REA y DOC] (CP §2).
- Rappi: si el pedido se cancela y el repartidor ya tiene los productos, **los devuelve en los puntos habilitados** (hub o fundación) y **sube el certificado de devolución** al Centro de Ayuda para que se borre la deuda; plazo de **24 horas, o 12 si son perecederos** [DOC-índice, SoyRappi Colombia «Pregúntanos»]. Otra página de Colombia da 18 y 72 horas, México 12 y 72, Argentina 12 y 48 [DOC-índice]; las cifras no coinciden entre páginas.
- DiDi Food Colombia: si la cancelación la hace el repartidor o el cliente, «la orden será pagada de manera regular» al repartidor; si la tienda cancela por causas ajenas, reembolso del 100 % al cliente [DOC, DiDi Colombia política de reembolsos].
- Prensa: repartidores de Uber y DiDi en México muestran que se quedan con la comida que el cliente no recibe [OBS, Infobae, 22 may 2024]. No es una regla publicada.

**Tumbite hoy.** La compra queda en el libro como `comida_comprada_sin_entregar`, «pendiente de decisión» (`pagoLocal.ts:183-206`), al no pagar el cliente (`cobroDirecto.ts:217-257`) o al soltar soporte el pedido (`operacion.ts:184-185`). Nadie la reembolsa. Recomendación escrita (decisión 20): depende de la causa; si el cliente no paga o no aparece, Tumbite devuelve al repartidor hasta 25 dólares desde sus comisiones y la deuda queda del cliente; si cancela el restaurante o soporte, el restaurante devuelve el dinero contra la comida.

**Clasificación: (c)**, y bloquea encender el efectivo: sin una regla, el repartidor arriesga su capital sin garantía (lo que dicen DoorDash, Rappi y DiDi, cada uno a su manera, es que el repartidor no pierde).

**Mínimo para el MVP:** que Richard elija la regla; la bandeja lista cada caso con la foto del ticket y el monto, y la acción de soporte aplica lo que él decida. Si elige el camino de Rappi (devolver la comida), la evidencia mínima es una foto o un comprobante de devolución subido al caso.

---

## Vacío 12. El restaurante disputa un cargo

**Referencia.** DoorDash: 14 días, solo Admin o Store Manager, motivo de una lista, estados amarillo, verde y rojo, ajuste en la columna «Adjustments» (vacío 5) [DOC]. Uber Eats: 30 días, formulario con foto o video, caso por caso [DOC]. DiDi Colombia: la tienda tiene 24 horas para responder una solicitud de reembolso del cliente; si no responde, se aprueba sola [DOC, DiDi Colombia «Cómo funcionan los reembolsos»].

**Tumbite hoy.** Las devoluciones de tarjeta se pueden cargar al restaurante como movimiento «ajuste» (`devoluciones.ts`, `superadmin.ts`); por defecto las absorbe Tumbite (decisión 2). La app del restaurante no tiene disputa [TUMBITE, CP §6]. En el cobro en mano no hay cargos al restaurante: el dinero no pasa por Tumbite.

**Clasificación: (b).** Mientras Tumbite absorba, no hay nada que disputar; y no toca el cobro en mano.

**Mínimo para el MVP:** nada. Cuando se cargue el primer ajuste a un restaurante, «Disputar» en los tres puntos del movimiento, con motivo y foto, que abre un ticket ligado; plazo de 14 días como DoorDash (el más corto de los dos grandes) salvo que Richard diga otro.

---

## Vacío 13. Aviso de saldo bajo

**Referencia.**

- DiDi Food Colombia: el límite de saldo negativo depende de la ciudad y del nivel; **la app avisa al acercarse** para recargar; pasarse puede bloquear la cuenta por un tiempo [DOC, «Evita acumular saldo negativo»].
- Bolt: notificaciones en la app como recordatorio; al llegar al límite negativo **se pausan solo los viajes en efectivo**, los de tarjeta siguen; **se reactivan solos** al pagar [DOC, Bolt «Cash debt»].
- Uber: aviso con monto, días para pagar y forma de pago [DOC].

**Tumbite hoy.** Prepago sin negativos: sin saldo para la comisión, no se ofrece ni se acepta el pedido en efectivo (`cobroDirecto.ts:107-160`); los de tarjeta siguen; al recargar vuelven. Es el mismo diseño de Bolt. No hay aviso previo (búsqueda en `apps/repartidor/src` sin resultado).

**Clasificación: (b).**

**Mínimo para el MVP:** una línea en la billetera y una campana cuando el saldo disponible no cubra dos comisiones del país, en su moneda, con el botón de recargar. Nada más.

---

## Vacío 14. Tolerancia del ticket

**Referencia.** No encontramos ninguna cifra pública de tolerancia entre el ticket del comercio y lo esperado en DoorDash, Uber, Rappi, DiDi ni Instacart [NV]. Lo publicado: Instacart retiene un poco más que el estimado y cobra al final el valor real [DOC, Instacart «View receipts and charges»]; DoorDash pide el recibo y, sin él, reembolsa solo el subtotal [DOC] (CP §2); un blog de repartidores dice que unos pocos dólares de diferencia no suelen frenar la Red Card [OBS, 2019].

**Tumbite hoy.** Cualquier diferencia de pago o de ticket deja la conciliación «con diferencia» (`cobroDirecto.ts:259-284`). Recomendación escrita (decisión 23): sin revisión hasta 0,50 dólares o el 2 %.

**Clasificación: (c)**, no bloquea.

**Mínimo para el MVP:** nada nuevo. La bandeja muestra la diferencia en su moneda y soporte la cierra con un toque; cuando Richard dé la cifra, la conciliación la aplica.

---

## Vacío 15. Ganancias sin tiempo conectado ni «cobrado en mano»

**Referencia.**

- Uber: en las ciudades con efectivo, el estado de ganancias tiene la línea **«Cash Collected»** (la diferencia entre lo ganado por viajes y el efectivo cobrado, dentro de «Payouts»), además de «Total Earnings», «Expenses and refunds» y «Events from previous weeks»; estados los lunes [DOC, Uber Israel «How to Track Your Earnings»]. Al desconectarse, resumen de la sesión con **tiempo en línea**, lo ganado y viajes ofrecidos y completados; resumen semanal con horas activas [DOC, Uber «Earnings rate card»].
- DoorDash: el tiempo activo va de aceptar a completar y es la base del mínimo de Nueva York [DOC, DoorDash «Guide to the New York City Earnings Standard»]; el tiempo conectado como métrica aparte solo lo describe un tercero [OBS].
- SoyRappi: tiempo conectado y promedio por hora en «Ganancia total» [REA sobre la página PÚBLICA de ayuda, no sobre la app; tomado de la ficha anterior] (CP §7).

**Tumbite hoy.** `apps/repartidor/src/grandes/Ganancias.tsx` no muestra horas ni pedidos cobrados en mano (búsqueda sin resultado). En un pedido directo la ganancia nunca llega como abono (`operacion.ts`, cobro directo), así que la pantalla puede parecer incompleta [INF].

**Clasificación: (b).**

**Mínimo para el MVP:** una fila «Cobrado en mano» por pedido directo en Ganancias, con lo recibido y la comisión descontada del prepago, para que no parezca que falta dinero (es la «Cash Collected» de Uber). El tiempo conectado no es MVP.

---

## Tabla de los once vacíos

| #   | Vacío                                      | Clasificación                                    | Mínimo para el MVP                                                                            | Evidencia principal                                           |
| --- | ------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 5   | Bandeja de soporte                         | (a)                                              | Lista única que sale de los estados existentes, con responsable, estado, historial y acciones | DoorDash error charges; Uber Eats Manager; Uber flotas [DOC]  |
| 6   | Plazo de la transferencia por verificar    | (c); requisito solo si se enciende transferencia | Caso en la bandeja con antigüedad visible; el pase a «no pagado» espera la cifra              | Sin referencia de reparto [NV]; Cashea y Uber 72 h [DOC]      |
| 7   | Pago en el local sin confirmar (QR)        | (b)                                              | Caso en la bandeja con «el restaurante confirmó por teléfono»                                 | DiDi y DoorDash no piden confirmación del local [DOC]         |
| 8   | Comisión no recalculada tras plato agotado | (a)                                              | Recalcular la comisión al aplicar el ajuste y devolver la diferencia al prepago               | Código (`pedidos.ts:189-205`, `libro.ts`); DiDi [DOC]         |
| 9   | Motivos al cobrar                          | (b)                                              | Tres motivos codificados en «no pagó»; «sin cambio» = «Cobré» con lo recibido                 | DoorDash cuatro motivos; Uber «paga lo que puede» [DOC]       |
| 10  | «No tengo con qué pagar»                   | (b)                                              | Motivo fijo en «soltar» que no cuenta la primera vez del día                                  | DiDi «Efectivo insuficiente» con reasignación [DOC]           |
| 11  | Comida comprada y no entregada             | (c); bloquea encender                            | Regla de Richard; caso en la bandeja con foto del ticket                                      | DoorDash reembolso con recibo; Rappi devolución 24/12 h [DOC] |
| 12  | El restaurante disputa un cargo            | (b)                                              | Nada mientras Tumbite absorba; luego «Disputar» con 14 días                                   | DoorDash 14 días; Uber 30 días [DOC]                          |
| 13  | Aviso de saldo bajo                        | (b)                                              | Línea en la billetera y campana con saldo para menos de dos comisiones                        | DiDi recordatorio; Bolt pausa solo efectivo [DOC]             |
| 14  | Tolerancia del ticket                      | (c); no bloquea                                  | Nada: la bandeja muestra la diferencia y soporte cierra                                       | Sin cifra pública [NV]                                        |
| 15  | Ganancias sin «cobrado en mano»            | (b)                                              | Fila «Cobrado en mano» por pedido directo                                                     | Uber «Cash Collected» [DOC]                                   |

---

## Lo que recomendamos para la bandeja (vacío 5)

Se arma con lo que muestran en público DoorDash, Uber, DiDi, Rappi y las herramientas de contra entrega, y con lo que Tumbite ya guarda. Nada de contabilidad aparte: cada caso sale de un estado que ya existe.

**Tipos de caso (filtro principal).**

| Tipo                           | Sale de                                                                        | Montos que muestra                                     |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Pago incompleto                | `cobro_estado = 'parcial'` o `no_pagado` con deuda del cliente                 | Esperado, recibido, deuda del cliente                  |
| Diferencia en el local         | `pagos_local.diferencia_pago` o `diferencia_ticket` distinta de 0              | Esperado, pagado, ticket, diferencias                  |
| Excedente por devolver         | Libro `excedente_cliente_por_devolver`                                         | Recibido, esperado, propina, excedente                 |
| Comida comprada sin entregar   | Libro `comida_comprada_sin_entregar`                                           | Pagado en el local, motivo de la cancelación           |
| Transferencia por verificar    | Evento `transferencia_por_verificar` con cobro todavía `pendiente`             | Total, horas que lleva                                 |
| Pago en el local sin confirmar | `pagos_local.confirmado_restaurante_en` vacío con pedido en camino o entregado | Pagado en el local                                     |
| Disputa de cobro del cliente   | Ticket de queja «Disputa de cobro directo»                                     | Lo que dice el cliente y lo que registró el repartidor |
| Recarga disputada o pendiente  | Recargas y avisos de Stripe                                                    | Monto, canal, estado                                   |

**Columnas de la lista.** Tipo · antigüedad («hace 3 h», y la hora exacta al pasar el dedo) · país y moneda · pedido (código corto que abre el detalle) · repartidor · restaurante · cliente · monto clave del tipo · estado · responsable. Con orden por antigüedad y filtros por tipo, país, estado, repartidor y «solo los míos». Así lo hacen el filtro «Error charge» de DoorDash, los filtros «Store refunded / Potential Deduction» de Uber y el filtro por conductor de las flotas.

**Estados.** Abierto → En revisión (al tomarlo) → Resuelto, más **«Espera decisión»** para los casos que dependen de una regla que Richard no ha dado (comida sin entregar, plazo de transferencia, tolerancia). DoorDash muestra el estado con color; en Tumbite, por la regla de colores: resuelto en verde, abierto en gris, «con problema» o vencido en rojo, nunca rojo para algo resuelto.

**Detalle del caso.** Línea de tiempo del pedido (eventos), libro del pedido (ya existe), evidencias en el mismo lugar: foto del ticket, foto de recogida y de entrega, comprobante de la transferencia si el cliente lo subió (Cashea pide banco, monto, referencia, fecha y captura), y los datos de contacto para llamar desde ahí. Historial de lo que hizo soporte, con autor y hora; nada se borra.

**Acciones.**

- Para todos: **tomar** (asigna responsable), **nota**, **pedir evidencia** al repartidor o al cliente (mensaje con el caso), **resolver** con motivo de cierre de una lista (por ejemplo: «redondeo», «el repartidor devolvió el excedente», «el restaurante confirmó», «el cliente pagó la deuda», «se aplicó la regla de Richard») y nota opcional. DoorDash también exige motivo de una lista.
- Por tipo: «el restaurante confirmó por teléfono» (pago en el local); «excedente devuelto» con cómo y cuándo (excedente); «el repartidor confirmó la transferencia» o «no llegó», registrando que lo dijo el repartidor y no un banco (transferencia por verificar); «aplicar la regla» solo cuando Richard la apruebe (comida sin entregar).
- Ninguna acción mueve dinero que no esté ya decidido, ni borra movimientos; las acciones no se repiten por un doble toque.

**Vista por repartidor.** Una fila por repartidor con: efectivo en mano sin conciliar frente al tope del país, excedentes por devolver, pérdidas pendientes, casos abiertos y saldo prepago. Es el «saldo por conductor» de las flotas de Uber y el «efectivo pendiente por repartidor» de las herramientas de contra entrega. Sirve para aplicar la decisión 21 (frenar el efectivo a quien no devuelve un excedente).

**Quién la usa.** Solo administración y el equipo de soporte; DoorDash y Uber limitan las disputas a roles de gerencia, y aquí el dinero es de terceros. Si un franquiciado ve su zona, que vea solo su zona y no pueda resolver casos de dinero sin el rol.

**Frente a la bandeja en construcción.** Por lo leído del archivo sin commit, ya trae tipos, estados (abierto, en revisión, resuelto), responsable, montos, participantes, historial con autor, idempotencia y acciones por tipo («excedente devuelto», «confirmar restaurante»). Conviene comprobar que tenga, o agregar: el estado «Espera decisión», el motivo de cierre obligatorio de una lista, las evidencias en el detalle, la antigüedad como columna ordenable, la acción «pedir evidencia», la vista por repartidor, y los filtros por país, moneda y responsable.

---

## Fuentes

Leídas el 19 de octubre de 2026 salvo que se diga otra fecha. Las de fichas anteriores están en CP y no se repiten.

**Documentación oficial**

- DoorDash, «Understanding Error Charges and Disputes» (comercios): https://help.doordash.com/en-us/merchants/article/what-are-order-error-adjustments
- DoorDash, «Cash on Delivery Overview and FAQ» (repartidores): https://help.doordash.com/en-us/dashers/article/cash-on-delivery-overview-and-faq
- DoorDash Drive, «Deliver cash orders»: https://developer.doordash.com/en-US/docs/drive/how_to/deliver_cash_orders/
- DoorDash, «Guide to the New York City Earnings Standard»: https://help.doordash.com/en-us/dashers/article/guide-to-the-new-york-city-earnings-standard
- Uber, «How do I use Cash as a payment method?» (Uber Eats): https://help.uber.com/en/ubereats/restaurants/article/how-do-i-use-cash-as-a-payment-method?nodeId=f20b5ddb-7019-4ced-97b1-25575197446d
- Uber, «How to dispute an order error adjustment»: https://www.uber.com/au/en/blog/dispute-an-order-error/
- Uber México, «Conoce todo sobre los viajes en efectivo y la gestión de adeudos para socios flotilleros» (6 abr 2022): https://www.uber.com/es-MX/blog/gestion-de-adeudos-socios-flotilleros
- Uber, «FAQ's - Cash trips and pending amounts of Fleet Partners»: https://help.uber.com/driving-and-delivering/article/faq%E2%80%99s---cash-trips-and-pending-amounts-of-fleet-partners?nodeId=248889f6-f545-4e6c-96f1-1245069f7aa8
- Uber, «Fleet Dashboard»: https://help.uber.com/driving-and-delivering/article/fleet-dashboard?nodeId=89c3cfa5-1001-4fe0-bb00-ee9c0f6a3c56
- Uber Developers, reportes de desempeño de flotas: https://developer.uber.com/docs/vehicles/references/api/v1/vehicle-suppliers/suppliers/performance-based-reports-fleet
- Uber Israel, «How to Track Your Earnings»: https://www.uber.com/il/en/earn/earnings-statements/
- Uber, «Earnings rate card»: https://www.uber.com/drive/resources/earnings-rate-card
- DiDi Food México, «Pedidos en efectivo» (repartidores): https://web.didiglobal.com/mx/food/repartidores/preguntas-frecuentes/pedidos-en-efectivo/
- DiDi Food Perú, «Pedidos en efectivo» (repartidores): https://web.didiglobal.com/pe/food/repartidores/preguntas-frecuentes/pedidos-en-efectivo/
- DiDi Food Colombia, «Evita acumular saldo negativo»: https://web.didiglobal.com/co/food/repartidores/preguntas-frecuentes/evita-acumular-saldo-negativo/
- DiDi Food Colombia, «¿Cuál es la política de reembolso de DiDi Food?» (restaurantes): https://web.didiglobal.com/co/food/restaurantes/preguntas-frecuentes/cual-es-la-politica-de-reembolso-de-didi-food/
- DiDi Food Colombia, «Cómo funcionan los reembolsos» (restaurantes): https://web.didiglobal.com/co/food/restaurantes/preguntas-frecuentes/como-funcionan-los-reembolsos/
- Bolt, «Cash debt» (Arabia Saudita): https://bolt.eu/en-sa/driver/guide/cash-debt/
- Instacart, «View receipts and charges»: https://www.instacart.com/help/section/866017999
- Cashea, «Verificación o devolución de mi pago»: https://www.cashea.app/preguntas-frecuentes/c/verificacion-o-devolucion-de-mi-pago
- SoyRappi Colombia, «Pregúntanos» (respuesta «¿Necesito dinero para conectarme?» leída del archivo público de la página; las demás por índice del buscador): https://soyrappi.com.co/preguntanos/
- SoyRappi Colombia, «¿Cómo realizo una devolución de productos?» (por índice del buscador): https://soyrappi.com.co/devoluciones/
- SoyRappi México, devoluciones al cancelar una orden (por índice del buscador): https://soyrappi.com.mx/devolucionesmx/
- SoyRappi Argentina, devoluciones de productos (por índice del buscador): https://soyrappi.com.ar/Devolucionesblogar/
- iFood, «Jeito iFood de Entregar»: https://entregador.ifood.com.br/jeito-ifood-de-entregar/

**Observación pública (no oficial)**

- Shipox, «The Benefits of COD Reconciliation in Delivery Management»: https://shipox.com/blog/the-benefits-of-cod-reconciliation-in-delivery-management/
- Routella, «Cash on Delivery (COD): Manage It Cleanly»: https://routella.app/blog/cash-on-delivery-management
- Bronze Vision, plazos de disputa por plataforma: https://bronze.vision/en/blog/refund-dispute-deadlines.html
- Infobae, repartidores de Uber y DiDi Food y la comida no recibida (22 may 2024): https://www.infobae.com/mexico/2024/05/22/repartidores-de-uber-y-didi-food-muestran-que-es-lo-que-hacen-con-la-comida-que-no-les-reciben-video/
- Chofer Venezuela, «No me caen viajes en Yummy Rides» (2026): https://chofervenezuela.com/no-me-caen-viajes-yummy-rides/
- Publicación en X sobre recargas de Yummy por pago móvil (2021): https://x.com/itcarrillob/status/1435227547353206789
- Blog de repartidor sobre la Red Card de DoorDash (ago 2019): https://doordashdriver.blogspot.com/2019/08/doordash-red-card-declined-dont-work.html
