# Decisiones preparadas para Richard — 19 oct 2026

**Qué es esto:** cinco decisiones de dinero preparadas para que Richard diga «sí» o cambie una cifra. Nada de esto está decidido. **Las recomendaciones de `docs/DECISIONES-RICHARD-FASE-2.md` no son decisiones**, y las de este documento tampoco, hasta que Richard las apruebe por escrito. No se implementa nada hasta entonces.

**Dependencias, dichas una vez:**

- **El efectivo** en cualquier país depende de la **decisión 20**.
- **La transferencia al repartidor** depende de la **decisión 20** y **además** de la **decisión 22**.
- **Colombia y Venezuela** no reciben pedidos hasta tener **tarifas** y **topes** escritos (el servidor responde 409 sin ellos: C-TARIFAS-PAIS).
- **La recarga con tarjeta** del saldo prepago depende de la decisión sobre la **recarga disputada**.

**Lo que ya está aprobado (no se vuelve a preguntar):** el modelo de cobro directo (el cliente paga al repartidor), el saldo prepago solo para comisiones, sin crédito ni saldos negativos, y los retiros apagados hasta su orden.

**Etiquetas de las referencias de mercado:** salen solo de las fichas existentes en `docs/investigaciones-rea/` y conservan su etiqueta: [DOC] documentación oficial, [DOC-índice] texto oficial leído por el índice del buscador, [OBS] observación pública (prensa, foros), [INF] inferencia nuestra, [NV] no verificado. Ninguna de estas referencias se obtuvo observando las apps de los competidores con REA.

**Supuestos de los ejemplos:** son cifras redondas para medir el tamaño del riesgo, no datos de Tumbite (no hay pedidos fuera de EE. UU.). Para comparar con dólares se usa **1 USD ≈ 4.000 COP** como número redondo, **no** una tasa oficial consultada.

---

## 1. Decisión 20 — Quién absorbe la comida comprada y no entregada (cobro en mano)

### Situación hoy en Tumbite

- En el cobro en mano, el repartidor paga la comida en el local con su dinero: lo esperado es lo que le toca al restaurante (`pago_restaurante`, la comida menos la comisión del restaurante) (`internacional/pagoLocal.ts`).
- Si el pedido no llega al cliente después de esa compra (el cliente no paga o no aparece, soporte cancela, soporte suelta al repartidor), el libro anota en la cuenta del repartidor un movimiento negativo `comida_comprada_sin_entregar` por lo que pagó, con un evento «pérdida pendiente de decisión» (`registrarPerdidaComida`). **Nadie se lo devuelve.**
- La bandeja de soporte lo muestra como caso «comida pagada y no entregada» con la marca **«espera decisión 20»**; soporte solo puede tomar, anotar y cerrar (C-BANDEJA-DINERO).
- Si el cliente no pagó, además queda su deuda, que le impide pedir otra vez.

### Qué está aprobado y qué no

- Aprobado: que se registre, que no haya saldos negativos ni crédito, que nada se compense solo.
- **No aprobado:** quién paga esa comida.

### Referencias de mercado (de las fichas)

- DoorDash le reembolsa al repartidor lo que pagó de su bolsillo, con foto del recibo y revisión en 48 horas; sin recibo, solo el subtotal [DOC] (cruce de procesos MVP).
- Rappi Colombia: si el pedido se cancela y el repartidor ya tiene los productos, los devuelve en puntos habilitados en 24 horas (12 si son perecederos) y sube el certificado para que se borre su deuda [DOC-índice]; otras páginas de Rappi dan plazos distintos [DOC-índice].
- DiDi Food Colombia: si cancela el repartidor o el cliente, «la orden será pagada de manera regular» al repartidor [DOC].
- Repartidores en México muestran que se quedan con la comida no recibida; no es una regla publicada [OBS].

### Regla recomendada

**Según la causa, y el repartidor nunca pierde su dinero sin una decisión de soporte:**

1. **El cliente no paga o no aparece:** la deuda queda del cliente (ya pasa). Tumbite le devuelve al repartidor lo que pagó en el local, **con tope por pedido** (Colombia: 100.000 COP; Estados Unidos: 25 USD; Venezuela: 25 USD o su equivalente), como **saldo en su prepago**. Si después el cliente paga su deuda, ese dinero lo recupera Tumbite.
2. **Cancela el restaurante:** el restaurante le devuelve al repartidor el dinero en el mostrador contra la comida. Si no lo hace, soporte aplica el punto 1.
3. **Cancela soporte o suelta al repartidor por una causa de Tumbite:** Tumbite le devuelve lo pagado (mismo tope).
4. **Condiciones para devolver:** foto del ticket (hoy es opcional), marca de llegada a la dirección del cliente cuando la causa es «no aparece», y como máximo dos devoluciones por repartidor al mes sin revisión de soporte (a partir de la tercera, soporte revisa caso por caso).

**Importante:** devolver «al prepago» significa crédito para comisiones futuras, no dinero en efectivo (el saldo prepago no se retira). El repartidor recupera su dinero a medida que trabaja. Si Richard quiere que se le pague en efectivo, hace falta un medio de pago a repartidores en ese país, que hoy no existe (B.7). Que Tumbite meta saldo propio en el prepago lo debe mirar el abogado de cada país (prepago de servicios).

### Impacto económico (Colombia, supuestos explícitos)

- Supuestos: una ciudad con 1.000 pedidos en mano al mes; comida de 30.000 COP (la ficha de mercado estima un ticket de 25.000 a 35.000 [INF]); comisión al restaurante del 15 %, así que el repartidor paga 25.500 en el local; el 1 % de los pedidos se cae después de la compra (10 al mes); de esos, 7 son de cliente que no paga o no aparece y 3 de cancelación del restaurante.
- Con la regla: Tumbite devuelve 7 × 25.500 = 178.500 COP al mes; si recupera el 30 % de las deudas de clientes, el costo neto es unos **125.000 COP al mes (unos 31 USD)**. Los 3 del restaurante no le cuestan a Tumbite si el restaurante devuelve.
- Comparado con lo que deja la ciudad: con 6.000 COP de ganancia de Tumbite por pedido (ver tarifas, sección 3), son 6.000.000 COP al mes; la regla cuesta cerca del **2 %**.

### Alternativas y su riesgo

| Alternativa                                  | Riesgo                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La absorbe siempre el repartidor             | Nadie pone su capital para pedidos en efectivo; los grandes protegen al repartidor (DoorDash, DiDi [DOC]); se pierde la oferta en efectivo, que en Colombia pesa [OBS] |
| La absorbe siempre el restaurante            | Solo es justo si recibe la comida de vuelta; con comida preparada casi nunca sirve; choca con la promesa de comisión baja                                              |
| Solo deuda del cliente, sin devolución       | El repartidor pierde hasta que el cliente pague, que puede ser nunca                                                                                                   |
| Tumbite la absorbe siempre, sin tope ni foto | Invita al fraude entre repartidor y cliente (pedido inventado, comida para él); costo sin techo                                                                        |
| Modelo Rappi: devolver la comida a un punto  | Exige puntos físicos y plazo de horas; con comida caliente casi siempre se tira                                                                                        |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- La bandeja gana la acción «aplicar la regla 20» en el caso de comida pagada y no entregada: escribe en el libro la devolución al prepago (con referencia única, una sola vez), respetando el tope del país, y deja el caso resuelto.
- La foto del ticket pasa a ser obligatoria para pedir la devolución.
- El cobro de la deuda del cliente, cuando llegue, se anota como recuperación de Tumbite.
- Tope por pedido y máximo mensual por repartidor como cifras del país (panel de Países).
- Guía pública en Docs (repartidor y soporte), en español e inglés.
- Recién entonces se puede encender el efectivo en un país (con la compuerta de `docs/PILOTO-POR-PAIS.md`).

---

## 2. Decisión 22 — Plazo de una transferencia pendiente de verificar

### Situación hoy en Tumbite

- Con «transferencia al repartidor», el repartidor puede entregar marcando «transferencia por verificar»: el cobro queda `pendiente`, la comisión queda apartada, y el pedido no se concilia hasta que él confirme que le llegó (o diga que no) (`rutas/internacional.ts`, `cobroDirecto.ts`).
- **No hay plazo:** el caso puede quedar abierto para siempre. La marca hoy es un evento del pedido.
- La bandeja lo muestra como caso «transferencia por verificar», con su antigüedad, y la marca **«espera decisión 22»**.
- Si la transferencia nunca llega, el cliente ya tiene la comida y el repartidor ya la pagó en el local: es el caso «cliente que no paga», que se resuelve con la **decisión 20**. Por eso la transferencia depende de las dos.

### Qué está aprobado y qué no

- Aprobado: que el repartidor confirme a mano (no hay lector bancario contratado; decisión 14 aparte).
- **No aprobado:** el plazo y qué pasa al vencer.

### Referencias de mercado (de las fichas)

- No encontramos ninguna plataforma de reparto que documente un pago del cliente directo a la cuenta del repartidor con «verificar después» [NV].
- Cashea (Venezuela, no es reparto) verifica con banco, monto, referencia, fecha y captura, y reintenta a los 30 minutos si un dato estaba mal [DOC].
- Uber dice que los pagos de un adeudo se reflejan en hasta 72 horas [DOC].

### Regla recomendada

- **A las 2 horas sin confirmar:** aviso a soporte y el caso se pinta en rojo en la bandeja; soporte llama al repartidor y pide al cliente el comprobante.
- **A las 24 horas sin confirmar:** el cobro pasa a «no pagado», queda la deuda del cliente (no puede pedir otra vez hasta pagar o mostrar el comprobante) y al repartidor se le aplica la regla de la decisión 20 para lo que pagó en el local.
- Mientras un repartidor tenga una transferencia vencida sin resolver, no recibe más pedidos por transferencia (sí en efectivo y con tarjeta).

### Impacto económico (supuestos explícitos)

- Supuestos: 500 pedidos por transferencia al mes en una ciudad colombiana; total de 35.500 COP por pedido (sección 3); el 0,5 % nunca llega (2 o 3 al mes).
- Con la regla: Tumbite devuelve al prepago del repartidor lo que pagó en el local (25.500 × 2,5 ≈ 64.000 COP, unos 16 USD al mes) y queda la deuda del cliente por 35.500 cada una.
- El costo del plazo en sí es de trabajo de soporte: un caso a las 2 horas por cada transferencia lenta.

### Alternativas y su riesgo

| Alternativa                               | Riesgo                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 12 horas                                  | Marca como «no pagado» transferencias que llegan tarde de noche o en fin de semana; clientes bloqueados por error               |
| 72 horas (como los adeudos de Uber [DOC]) | Tres días de dinero del repartidor en el aire; más tiempo para que un cliente desaparezca                                       |
| No entregar hasta ver la transferencia    | Lo más seguro para el repartidor; espera en la puerta, peor experiencia y más pedidos fríos; desaparece el caso «por verificar» |
| Sin plazo (como hoy)                      | Casos abiertos para siempre; el repartidor nunca sabe si va a cobrar                                                            |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- El servidor guarda la hora de la marca en el pedido (hoy solo es un evento) y una tarea del reloj aplica los dos plazos, una sola vez por pedido.
- La bandeja muestra el vencimiento en rojo y el paso automático a «no pagado» queda en el historial del caso.
- La oferta deja de mostrar «transferencia» al repartidor con una transferencia vencida.
- Guía pública en Docs para cliente, repartidor y soporte, en los dos idiomas.

---

## 3. Tarifas por país (Colombia y Venezuela)

### Situación hoy en Tumbite

- Cada pedido se calcula con las tarifas del país de la zona del restaurante y guarda su moneda (C-TARIFAS-PAIS). Estados Unidos usa la configuración global de siempre.
- Las tarifas de un país son las mismas casillas que la de EE. UU., en su moneda (unidad menor): comisión al restaurante por plan (Inicial, Crece, Élite), envío base, kilómetros incluidos, envío por kilómetro, envío máximo, servicio (porcentaje, mínimo y máximo), pedido mínimo, cargo por pedido pequeño, pago mínimo al repartidor e impuesto. Más, por país: comisión de Tumbite en el cobro directo (porcentaje sobre la comida o, si no hay, la ganancia del desglose), cargo fijo por pedido, tope de efectivo diario y deuda máxima del cliente.
- **Ningún país distinto de EE. UU. tiene tarifas**, y no existe ninguna zona de Colombia ni de Venezuela (19 oct). La tarjeta solo cobra en dólares.
- Referencia de EE. UU. hoy: comisión 7,5 / 12,5 / 15 % según plan; envío 3,99 con 3 km incluidos, 0,50 por km, máximo 7,99; servicio 5 % con mínimo 1,99 y máximo 4,99; pedido mínimo 10,00 con cargo de 2,00; pago mínimo al repartidor 5,00; impuesto apagado.
- En el cobro en mano, el repartidor paga en el local la comida menos la comisión del restaurante, cobra al cliente el total y la parte de Tumbite se descuenta de su prepago.

### Qué está aprobado y qué no

- Aprobado: el modelo (cobro directo, prepago para comisiones) y la moneda local por país.
- **No aprobado:** ninguna cifra. Las del documento de decisiones (15 % en Colombia, precios en moneda local) son recomendaciones.

### Referencias de mercado (de las fichas)

- Colombia: Rappi publica 25 % más 2 % de tasa interbancaria más IVA del 19 % sobre la comisión; en la práctica 27 a 32 % según terceros (ficha de mercado de Bogotá, con su fuente). DiDi Food no la publica; terceros dicen 22 a 28 % [OBS].
- Colombia: acuerdo Rappi–Ministerio del Trabajo (feb 2024), mínimo de 3.050 COP por pedido más 640 por km después del cuarto [OBS, prensa citada en la ficha].
- Colombia: ticket promedio no publicado [NV]; la ficha lo estima entre 25.000 y 35.000 COP [INF].
- Venezuela: comisiones y tarifas de Yummy y PedidosYa no encontradas [NV]. IGTF de 3 % sobre pagos en divisas para quien no es contribuyente especial [DOC].

### Regla recomendada — Colombia (COP, sin decimales)

| Casilla                                   | Recomendado                       | Por qué                                                                           |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Comisión al restaurante (los tres planes) | 15 % igual para todos al arrancar | La mitad de lo que se reporta de Rappi; los planes se separan cuando haya volumen |
| Envío base                                | 4.000, con 4 km incluidos         | Cubre el mínimo de 3.050 del acuerdo de 2024 con margen para el repartidor        |
| Envío por km después                      | 700                               | Por encima de los 640 del acuerdo                                                 |
| Envío máximo                              | 9.000                             | Tope para distancias largas                                                       |
| Servicio                                  | 5 %, mínimo 1.500, máximo 4.000   | Misma lógica que EE. UU.                                                          |
| Pedido mínimo y cargo por pedido pequeño  | 15.000 y 2.000                    | Evita pedidos que no pagan el viaje                                               |
| Pago mínimo al repartidor                 | 3.050                             | El mínimo del acuerdo de 2024                                                     |
| Impuesto                                  | 0 hasta que lo diga el contador   | IVA, 4x1000 y retenciones son del abogado y el contador colombiano                |

**Ejemplo con supuestos:** comida 30.000, 3 km, plan Inicial. El cliente paga 30.000 + 4.000 de envío + 1.500 de servicio = **35.500**. El repartidor paga 25.500 en el local, cobra 35.500, se queda 10.000; de eso, la parte de Tumbite (4.500 de comisión + 1.500 de servicio = 6.000) sale de su prepago; le quedan **4.000 más la propina**. Tumbite gana **6.000 COP por pedido (unos 1,50 USD)** antes de impuestos y costos.

### Regla recomendada — Venezuela

**No fijar cifras de Venezuela hasta que el abogado venezolano y el de sanciones validen el modelo (decisión 8).** Cuando se valide, la recomendación es la de la decisión 12: precios en dólares con su equivalente en bolívares a la tasa del BCV del día, guardando tasa y fecha en cada pedido. Eso **no está construido**: hoy una zona tiene una sola moneda y las tarifas son cifras fijas en esa moneda; en bolívares quedarían viejas en días. Cifras provisionales en USD, solo para planear [INF, sin referencia de mercado]: envío 1,50 con 3 km, 0,30 por km, máximo 4,00; servicio 5 % con mínimo 0,50 y máximo 2,00; pedido mínimo 5,00 con cargo de 1,00; comisión al restaurante 15 %.

### Alternativas y su riesgo

| Alternativa                              | Riesgo                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Copiar a Rappi (25 % o más)              | Se pierde la promesa de comisión baja, que es lo que atrae restaurantes       |
| Comisión de 10 %                         | Con 1,50 USD por pedido ya es poco; con 10 % la ganancia cae a unos 4.500 COP |
| Envío más bajo que el mínimo del acuerdo | El repartidor gana menos que el mínimo de referencia; nadie se conecta        |
| Venezuela con cifras fijas en bolívares  | Se desactualizan con la tasa; precios incorrectos en días                     |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- Claude carga las cifras en el panel de Países (`PUT /datos/admin/paises/CO`), con la validación de mínimos y máximos que ya existe. No hace falta código para Colombia.
- Venezuela necesita antes la conversión diaria con tasa del BCV guardada por pedido (código nuevo).
- La calculadora pública y las guías de Docs se actualizan con las cifras aprobadas.

---

## 4. Topes por país

### Situación hoy en Tumbite

- En Estados Unidos son cifras fijas en el código, en centavos: bono de la oferta abierta 100 (1 USD), precio máximo de una opción 10.000 (100 USD), propina máxima al pedir 50.000 (500 USD), propina posterior de 100 a 10.000 (1 a 100 USD), cupón de monto hasta 1.000.000 (10.000 USD), y reembolso automático por queja apagado con tope de 1.500 (15 USD).
- Con pesos colombianos esas cifras se leerían como pesos: el bono sería de 100 pesos y una opción no podría costar más de 10.000 pesos (C-MONEDA-RECORRIDO, huecos anotados).
- Hay trabajo en curso en el árbol de trabajo, sin publicar al escribir esto (C-TOPES-PAIS): los topes se leen por país, EE. UU. queda idéntico y un país sin topes escritos no se puede encender. **Las cifras siguen siendo de Richard.**
- Los cupones sin zona ni restaurante valen para cualquier país con un solo número.

### Qué está aprobado y qué no

- Aprobado: que EE. UU. no cambie.
- **No aprobado:** ninguna cifra para otro país, ni encender el reembolso automático por queja.

### Referencias de mercado

No hay cifras públicas de estos topes en las fichas [NV]. Solo hay un dato cercano de Colombia: Yango en Bogotá dio descuentos con tope de 7.000 COP en el lanzamiento [DOC, prensa citada en la ficha de Yango]. Lo demás se calcula a partir de las tarifas de la sección 3.

### Regla recomendada

| Tope                                | EE. UU. (hoy)    | Colombia (recomendado)                  | Venezuela (provisional, en USD) | Por qué                                                                 |
| ----------------------------------- | ---------------- | --------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Bono de la oferta abierta           | 1,00 USD         | 2.000 COP                               | 0,50                            | Un empujón cuando tres repartidores rechazaron; la mitad del envío base |
| Precio máximo de una opción         | 100 USD          | 200.000 COP                             | 50                              | Cubre extras caros sin abrir la puerta a errores de tipeo               |
| Propina máxima al pedir             | 500 USD          | 100.000 COP                             | 50                              | Más que eso suele ser error o fraude                                    |
| Propina posterior (mínimo y máximo) | 1 a 100 USD      | 1.000 a 50.000 COP                      | 0,50 a 20                       | Igual que la de EE. UU. en proporción al pedido                         |
| Cupón de monto, máximo por cupón    | 10.000 USD       | 20.000 COP                              | 5                               | Un cupón grande por error sale caro; se sube con su sí                  |
| Reembolso automático por queja      | Apagado, tope 15 | Apagado; tope 30.000 COP si se enciende | Apagado; 5 si se enciende       | En el cobro en mano no hay tarjeta que devolver: se haría como saldo    |

Además: **los cupones fuera de EE. UU. siempre con zona o restaurante** (nunca globales), para que un cupón en dólares no se aplique a un pedido en pesos.

### Impacto económico (supuestos explícitos)

- Bono: si el 5 % de 1.000 pedidos al mes llega a oferta abierta, 50 × 2.000 = **100.000 COP al mes (unos 25 USD)**, lo paga Tumbite.
- Cupones: con tope de 20.000 por cupón, un error de configuración en un cupón de 500 usos cuesta como máximo 10.000.000 COP; por eso se recomienda además limitar los usos al crearlo.
- Los demás topes no cuestan: solo cierran errores.

### Alternativas y su riesgo

| Alternativa                                 | Riesgo                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Convertir las cifras de EE. UU. por la tasa | Topes absurdos en pesos (propina de 2.000.000 COP) y cambian con la tasa |
| Sin bono en Colombia                        | Pedidos que nadie toma en hora pico                                      |
| Cupones globales en todos los países        | Un cupón en dólares descuenta como pesos o al revés                      |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- Claude carga los topes del país en el panel de Países cuando C-TOPES-PAIS esté publicado. Sin topes, el país sigue sin poder encenderse.
- La creación de cupones exige zona o restaurante fuera de EE. UU.

---

## 5. Recarga del saldo prepago disputada

### Situación hoy en Tumbite

- El saldo prepago solo sirve para pagar comisiones del cobro en mano; no se retira y nunca queda negativo (`internacional/libro.ts`, `cobroDirecto.ts`).
- Se recarga de dos maneras: con un **código** comprado en un punto de venta (sin Stripe, así que no hay contracargo de tarjeta) o con **tarjeta por Stripe**. La recarga con tarjeta está **apagada en todos los países**, y como la tarjeta solo cobra en dólares, hoy solo podría encenderse en EE. UU., donde el cobro en mano también está apagado.
- Si un repartidor disputa con su banco una recarga hecha con tarjeta, el servidor guarda la disputa con su recarga, avisa al equipo por correo («el saldo NO se tocó: decide qué hacer con él») y la muestra en la bandeja como «recarga disputada» con la marca **«espera decisión»**; soporte solo puede tomar, anotar y cerrar (`disputas.ts`, `internacional/bandeja.ts`). **El saldo no se toca**: puede seguir gastándolo en comisiones.
- Stripe cobra 15 USD al recibir la disputa y otros 15 si se contesta a mano (se devuelven si se gana) [DOC, página de precios de Stripe].

### Qué está aprobado y qué no

- Aprobado: sin saldos negativos ni crédito; el saldo prepago solo para comisiones.
- **No aprobado:** qué pasa con el saldo de una recarga disputada. «No tocar el saldo» es el comportamiento provisional, no una decisión.

### Regla recomendada

1. **Al abrirse la disputa:** se **congela** lo que quede sin gastar de esa recarga (hasta su monto). El repartidor no puede usarlo ni recargar con tarjeta mientras la disputa esté abierta. Puede seguir trabajando con tarjeta y, si tiene saldo de otras recargas, en efectivo.
2. **Si Tumbite gana:** se descongela.
3. **Si Tumbite pierde:** lo congelado se anula. Lo que ya gastó de esa recarga queda como **deuda del repartidor** en un bolsillo aparte (igual que la deuda del cliente, sin saldo negativo). Con deuda, no recibe pedidos en mano hasta pagarla con una recarga.
4. **Prevención:** la primera recarga con tarjeta de cada repartidor, como máximo 50 USD, y con una tarjeta a su nombre.

### Impacto económico (supuestos explícitos)

Supuestos: recarga con tarjeta de 50 USD; el repartidor ya gastó 30 en comisiones cuando abre la disputa; Stripe cobró 2,9 % + 0,30 = 1,75 por la recarga; Tumbite contesta la disputa y pierde.

| Concepto                                   | Como hoy (no tocar el saldo) | Con la regla recomendada                                        |
| ------------------------------------------ | ---------------------------- | --------------------------------------------------------------- |
| Monto que Stripe le quita a Windoce        | 50                           | 50                                                              |
| Tarifas de la disputa                      | 15 + 15 = 30                 | 15 + 15 = 30                                                    |
| Comisión de la recarga (no vuelve)         | 1,75                         | 1,75                                                            |
| Saldo que el repartidor todavía puede usar | 20 (lo sigue gastando)       | 0 (se congeló y se anuló)                                       |
| Lo que Tumbite puede recuperar             | Nada                         | Deuda de 30 del repartidor                                      |
| **Pérdida de Tumbite**                     | **81,75 USD**                | **61,75 USD**, que bajan a 31,75 si el repartidor paga la deuda |

Si Tumbite no contesta la disputa, se ahorra los segundos 15 en los dos casos.

### Alternativas y su riesgo

| Alternativa                              | Riesgo                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| No tocar el saldo (como hoy)             | Cada disputa perdida cuesta la recarga completa más 30 USD; invita a recargar, gastar y disputar       |
| Descontar todo y dejar el saldo negativo | Rompe la regla aprobada de no tener saldos negativos                                                   |
| Bloquear la cuenta entera del repartidor | Castiga también los pedidos con tarjeta; desproporcionado si la disputa es un error del banco          |
| No ofrecer nunca la recarga con tarjeta  | Cero riesgo de disputa; quedan solo los códigos de puntos de venta (en EE. UU. no hay puntos de venta) |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- Al llegar la disputa de una recarga: un movimiento de congelado en el libro (referencia única) y el saldo disponible baja en esa cifra.
- Al cerrarse: descongelar o anular, y escribir la deuda del repartidor en su bolsillo; la oferta en mano mira esa deuda.
- La bandeja gana la acción «aplicar la regla» para este tipo; el correo al equipo cambia su texto.
- Tope de la primera recarga con tarjeta por país.
- Guía pública en Docs para el repartidor (qué pasa si disputa una recarga), en los dos idiomas.
- Recién entonces se puede encender la recarga con tarjeta.

---

## Respuesta modelo

> Decisión 20: sí, con tope de 100.000 COP. Decisión 22: sí, 2 y 24 horas. Tarifas de Colombia: sí. Topes de Colombia: sí. Recarga disputada: sí, con primera recarga de 50 USD. Venezuela: esperar al abogado.

Cualquier cifra se puede cambiar en esa misma línea.
