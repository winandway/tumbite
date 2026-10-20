# Decisiones preparadas para Richard — 19 oct 2026

**Qué es esto:** cinco decisiones de dinero preparadas para que Richard diga «sí» o cambie una cifra. Nada de esto está decidido. **Las recomendaciones de `docs/DECISIONES-RICHARD-FASE-2.md` no son decisiones**, y las de este documento tampoco, hasta que Richard las apruebe por escrito. No se implementa nada hasta entonces.

**Dependencias, dichas una vez:**

- **El efectivo** en cualquier país depende de la **decisión 20**.
- **La transferencia al repartidor** depende de la **decisión 20** y **además** de la **decisión 22**.
- **Colombia y Venezuela** no reciben pedidos hasta tener **tarifas** y **topes** escritos (el servidor responde 409 sin ellos: C-TARIFAS-PAIS).
- **La recarga con tarjeta** del saldo prepago depende de la decisión sobre la **recarga disputada**.

**Lo que ya está aprobado (no se vuelve a preguntar):** el modelo de cobro directo (el cliente paga al repartidor), el saldo prepago solo para comisiones, sin crédito ni saldos negativos, y los retiros apagados hasta su orden.

**Lo que NO está aprobado (todo lo de este documento):** ninguna de las cinco decisiones, ninguna cifra, ningún plazo, ninguna penalización y ningún diseño. Tampoco la tasa de Venezuela (`docs/DISENO-TASA-VES.md`). Una línea modelo del tipo «Autorizo…» o la «respuesta modelo» del final **no es una aprobación**: hace falta que Richard la escriba él. La tabla «Qué cambia en el producto si Richard decide cada cosa», al final, resume el efecto de cada opción.

**Revisión del 19 oct 2026 (noche):** se corrigieron cuatro puntos de la versión anterior: (A) devolver «al prepago» es crédito, no reponer el efectivo; (B) que pase el tiempo sin confirmar una transferencia no prueba que el cliente no pagó; (C) la tabla de la recarga disputada mezclaba caja con contabilidad; (D) en Venezuela se separan las tarifas fijas en bolívares (ya existen) del precio en dólares con tasa por pedido (no existe; diseño en `docs/DISENO-TASA-VES.md`). Las fuentes oficiales nuevas están al final.

**Etiquetas de las referencias de mercado:** salen solo de las fichas existentes en `docs/investigaciones-rea/` y conservan su etiqueta: [DOC] documentación oficial, [DOC-índice] texto oficial leído por el índice del buscador, [OBS] observación pública (prensa, foros), [INF] inferencia nuestra, [NV] no verificado. Ninguna de estas referencias se obtuvo observando las apps de los competidores con REA.

**Supuestos de los ejemplos:** son cifras redondas para medir el tamaño del riesgo, no datos de Tumbite (no hay pedidos fuera de EE. UU.). Para comparar con dólares se usa **1 USD ≈ 4.000 COP** como número redondo, **no** una tasa oficial consultada.

---

## 1. Decisión 20 — Quién absorbe la comida comprada y no entregada (cobro en mano)

### Situación hoy en Tumbite

- En el cobro en mano, el repartidor paga la comida en el local con su dinero: lo esperado es lo que le toca al restaurante (`pago_restaurante`, la comida menos la comisión del restaurante) (`internacional/pagoLocal.ts`).
- Si el pedido no llega al cliente después de esa compra (el cliente no paga o no aparece, soporte cancela, soporte suelta al repartidor), `registrarPerdidaComida` escribe en el libro, en el bolsillo **`directo`** del repartidor (el informativo, el que registra dinero que nunca pasa por Tumbite), un movimiento negativo `comida_comprada_sin_entregar` por lo que pagó, y un evento «pérdida pendiente de decisión». **No toca su saldo prepago y nadie se lo devuelve.**
- La bandeja de soporte lo muestra como caso «comida pagada y no entregada» con la marca **«espera decisión 20»**; soporte solo puede tomar, anotar y cerrar (C-BANDEJA-DINERO). Cerrar el caso **no** paga nada.
- Si el cliente no pagó, además queda su deuda (`deuda_cliente`), que le impide pedir otra vez.
- **Tumbite no tiene hoy ningún medio para pagarle dinero a un repartidor fuera de EE. UU.** (no hay entidad ni cuenta local; decisión 8 y punto B.7 de la solicitud de autorizaciones).

### Qué está aprobado y qué no

- Aprobado: que se registre, que no haya saldos negativos ni crédito, que nada se compense solo.
- **No aprobado:** quién paga esa comida, cómo se le paga al repartidor y qué cuenta como «pagado».

### Referencias de mercado (de las fichas)

- DoorDash le reembolsa al repartidor lo que pagó de su bolsillo, con foto del recibo y revisión en 48 horas; sin recibo, solo el subtotal [DOC] (cruce de procesos MVP). Es un reembolso, no un crédito para comisiones.
- Rappi Colombia: si el pedido se cancela y el repartidor ya tiene los productos, los devuelve en puntos habilitados en 24 horas (12 si son perecederos) y sube el certificado para que se borre su deuda [DOC-índice]; otras páginas de Rappi dan plazos distintos [DOC-índice].
- DiDi Food Colombia: si cancela el repartidor o el cliente, «la orden será pagada de manera regular» al repartidor [DOC].
- Repartidores en México muestran que se quedan con la comida no recibida; no es una regla publicada [OBS].

### Corrección: el crédito en el prepago no le devuelve el efectivo

La versión anterior proponía «devolver al saldo prepago no retirable». Eso **no es una devolución**: es **crédito** que solo sirve para pagar comisiones futuras de Tumbite. El repartidor sacó **efectivo** de su bolsillo para comprar la comida, y el crédito no le devuelve ese efectivo.

**Con números (Colombia, supuestos de la sección 3; no son datos de Tumbite):** comida de 30.000 COP; el repartidor paga **25.500 COP en efectivo** en el local; en cada pedido en mano Tumbite le descuenta de su prepago **6.000 COP** (4.500 de comisión + 1.500 de servicio).

| Pregunta                                          | Con crédito de 25.500 en el prepago                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ¿Cuánto efectivo pierde el repartidor al momento? | **25.500 COP**, completos. El crédito no se retira ni sirve para pagarle al restaurante del siguiente pedido: para su próximo pedido en mano tiene que volver a poner 25.500 de su bolsillo                                    |
| ¿Cuánto vale el crédito?                          | Lo que le ahorra en comisiones que **igual** tendría que pagar: 25.500 ÷ 6.000 = **4,25 pedidos**. Deja de comprar recargas por esa cifra, y solo si sigue trabajando                                                          |
| ¿A qué ritmo lo recupera?                         | Al ritmo de sus pedidos en mano: con 8 al día, en el mismo día; con 2 a la semana, en unas **2 semanas y media**; con 0, **nunca**                                                                                             |
| ¿Qué pasa si deja Tumbite?                        | Lo que no gastó se pierde: el crédito vale **cero** fuera de la plataforma                                                                                                                                                     |
| ¿Cuánto le cuesta a Tumbite y cuándo?             | No sale efectivo. Tumbite deja de cobrar en efectivo hasta 25.500 en comisiones futuras (menos recargas vendidas), repartido en el tiempo, y **menos** si el repartidor se va. El costo real depende de que el repartidor siga |

Conclusión: el crédito traslada el riesgo al repartidor (si trabaja poco o se va, pierde) y no le devuelve su capital de trabajo. **No puede cerrar la obligación como «pagada»** salvo que Richard apruebe por escrito una regla que diga que el crédito es una forma válida de pago (y en qué casos), y que un abogado del país la valide.

### Alternativas, con costo, riesgo y requisitos

| Alternativa                                                                                | Quién paga y desde qué cuenta                                                                                                    | Costo para Tumbite (caso de 25.500 COP)                                        | Riesgo                                                                                                                                                     | Requisitos y qué valida un abogado                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1. Reembolso en dinero a cargo de Tumbite** (transferencia real o efectivo)             | Tumbite, desde una **cuenta en el país** (Bre-B, Nequi, banco) o por un franquiciado o empresa local con cuenta                  | 25.500 en efectivo, de inmediato; recupera lo que el cliente pague de su deuda | Fraude repartidor–cliente si no hay pruebas y topes; sin cuenta local no se puede hacer (enviar 25.500 COP desde EE. UU. no tiene sentido económico [INF]) | Entidad o socio con cuenta en Colombia (decisión 8). Abogado y contador: si es **reembolso de gastos** o pago al repartidor (afecta la base de la seguridad social de la Ley 2466; ver la pregunta abierta en `DECISIONES-RICHARD-FASE-2.md`), soporte contable, retenciones |
| **A2. Devolución en el mostrador a cargo del restaurante** (cuando cancela el restaurante) | El restaurante, en efectivo, contra la comida                                                                                    | 0                                                                              | El restaurante se niega o no está; hace falta un respaldo (A1 o A3)                                                                                        | Cláusula en los términos para restaurantes; abogado: que la devolución contra la comida sea exigible                                                                                                                                                                         |
| **A3. Crédito en el prepago**                                                              | Tumbite, sin mover efectivo (deja de cobrar comisiones futuras)                                                                  | 0 al momento; hasta 25.500 de comisiones no cobradas, en el tiempo             | El repartidor pierde efectivo y, si se va, pierde todo; la obligación queda abierta mientras no se apruebe que el crédito la salda                         | Regla escrita de Richard + abogado: si Tumbite puede **emitir** saldo prepago que nadie pagó (la norma de prepago de servicios), y si un crédito puede saldar una deuda con el repartidor sin su aceptación                                                                  |
| **A4. Mixto**                                                                              | Crédito inmediato **solo si el repartidor lo elige**, y pago en dinero (A1) si no lo elige o si el crédito no se usa en un plazo | Igual que A1 o A3, según lo que elija                                          | Más trabajo de soporte; necesita A1 para funcionar                                                                                                         | Los de A1 y A3; registro de la elección del repartidor                                                                                                                                                                                                                       |
| La absorbe siempre el repartidor                                                           | Él                                                                                                                               | 0                                                                              | Nadie pone su capital para pedidos en efectivo; los grandes protegen al repartidor (DoorDash, DiDi [DOC])                                                  | Abogado: si es válido trasladarle esa pérdida                                                                                                                                                                                                                                |
| Tumbite sin tope ni foto                                                                   | Tumbite                                                                                                                          | Sin techo                                                                      | Invita al fraude                                                                                                                                           | Igual que A1                                                                                                                                                                                                                                                                 |
| Modelo Rappi: devolver la comida a un punto                                                | —                                                                                                                                | 0                                                                              | Exige puntos físicos; la comida caliente se tira                                                                                                           | Puntos de recepción                                                                                                                                                                                                                                                          |

### Regla recomendada (no aprobada)

1. **Según la causa:** cliente que no paga o no aparece, o causa de Tumbite → **A1, reembolso en dinero** a cargo de Tumbite, con tope por pedido (Colombia: 100.000 COP; EE. UU.: 25 USD; Venezuela: no aplica hasta la decisión 8), foto del ticket obligatoria, marca de llegada a la dirección cuando la causa es «no aparece», y revisión de soporte desde la tercera vez en el mes. Cancela el restaurante → **A2**, y si no devuelve, A1.
2. **Mientras no exista un medio de pago en el país, el efectivo no se enciende en ese país.** Si Richard quiere encenderlo antes, la alternativa es **A4 (crédito solo si el repartidor lo elige)**, con el caso abierto como «pendiente de pago en dinero» hasta que lo use o se le pague; nunca se marca «pagado» por emitir crédito.
3. Si el cliente paga después su deuda, ese dinero es una **recuperación** de Tumbite cuando entra, no antes.

### Impacto económico (Colombia, supuestos explícitos)

- Supuestos: 1.000 pedidos en mano al mes en una ciudad; comida de 30.000 COP (estimación [INF] de la ficha de mercado: 25.000 a 35.000); comisión al restaurante del 15 %, así que el repartidor paga 25.500 en el local; el 1 % se cae después de la compra (10 al mes): 7 por cliente que no paga o no aparece y 3 por el restaurante.
- **A1:** salen de caja 7 × 25.500 = **178.500 COP al mes** (unos 45 USD con 1 USD ≈ 4.000 COP), más el costo de cada transferencia (Bre-B no cobra al usuario según los bancos [OBS]). Las deudas de clientes se cuentan **solo cuando se cobran**: si algún día se recupera, por ejemplo, el 30 %, el neto baja a unos 125.000, pero eso no se da por hecho.
- **A3:** no sale caja; Tumbite deja de cobrar hasta 178.500 en comisiones futuras, y los repartidores pierden 178.500 en efectivo hasta que lo compensen trabajando.
- Frente a lo que deja la ciudad (6.000 COP por pedido × 1.000 = 6.000.000 al mes, antes de costos), A1 cuesta cerca del **3 %** sin recuperaciones.

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- La bandeja gana la acción «aplicar la regla 20» en el caso de comida pagada y no entregada, con la opción que Richard apruebe:
  - **A1:** registra un «reembolso por pagar» al repartidor y solo lo marca **pagado** cuando soporte escribe la referencia de la transferencia real (con referencia única, una vez).
  - **A3 o A4:** escribe el crédito en el prepago (referencia única, una vez) y, salvo regla aprobada que diga lo contrario, deja el caso como «saldado con crédito, pendiente de validación».
- La foto del ticket pasa a ser obligatoria para pedir el reembolso.
- El cobro de la deuda del cliente, cuando llegue, se anota como recuperación.
- Tope por pedido y máximo mensual por repartidor como cifras del país (panel de Países).
- Guía pública en Docs (repartidor y soporte), en español e inglés.
- Recién entonces se puede encender el efectivo en un país (con la compuerta de `docs/PILOTO-POR-PAIS.md`).

---

## 2. Decisión 22 — Plazo de una transferencia pendiente de verificar

### Situación hoy en Tumbite

- Con «transferencia al repartidor», el repartidor puede entregar marcando «transferencia por verificar» (`POST /datos/repartidor/pedidos/:id/transferencia-pendiente`): el cobro queda `pendiente`, la comisión queda apartada, y el pedido no se concilia hasta que él confirme cuánto le llegó (o 0) (`rutas/internacional.ts`, `cobroDirecto.ts`).
- **No hay plazo:** el caso puede quedar abierto para siempre. La marca es solo un evento del pedido.
- **El cliente no tiene dónde dejar su comprobante ni la referencia** de la transferencia: el único «comprobante» del servidor es el del fondeo de los puntos de venta.
- La cuenta que ve el cliente se calcula en el momento (`cuentaVigente`); **el pedido no guarda cuál le mostró**. Se puede reconstruir con el historial de cuentas del repartidor, pero no queda en el pedido.
- La bandeja lo muestra como «transferencia por verificar», con su antigüedad y la marca **«espera decisión 22»**.

### Qué está aprobado y qué no

- Aprobado: que el repartidor confirme a mano (no hay lector bancario contratado; decisión 14 aparte).
- **No aprobado:** ningún plazo, ninguna deuda automática, ningún bloqueo.

### Corrección: el tiempo sin confirmar no prueba que el cliente no pagó

La versión anterior proponía que a las 24 horas el cobro pasara solo a «no pagado», con deuda y bloqueo del cliente. Eso castiga al cliente por cosas que no dependen de él. Un caso sin confirmar puede ser **cuatro cosas distintas**:

| Causa                                                                  | Cómo se ve                                                                                | Quién tiene la prueba                                                                  | Qué no se debe hacer                                                                                                                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. El repartidor no responde** (no revisó su banco, no abrió la app) | El dinero sí está en su cuenta                                                            | El repartidor (movimientos) y el cliente (comprobante)                                 | Cobrarle deuda al cliente                                                                                                                                                           |
| **2. Retraso bancario**                                                | El dinero va en camino                                                                    | El cliente (comprobante con fecha y referencia)                                        | Darlo por no pagado antes del plazo del canal                                                                                                                                       |
| **3. Pago a una cuenta equivocada**                                    | El cliente pagó, pero no a la cuenta que mostró la app (o la app mostró una cuenta vieja) | El comprobante dice a qué cuenta fue; el historial de cuentas dice cuál estaba vigente | Tratarlo igual en los dos sentidos: si la app mostró la cuenta equivocada, es problema de Tumbite y del repartidor; si el cliente se equivocó, es un reclamo del cliente a su banco |
| **4. Falta real de pago**                                              | No hay transferencia                                                                      | Nadie tiene comprobante                                                                | Decidirlo sin pedirle el comprobante al cliente                                                                                                                                     |

**Los tiempos de los canales no son iguales (fuentes oficiales donde las hay):**

- **Bre-B (Colombia):** el Banco de la República dice que el dinero «llega en segundos», 24 horas, 7 días, incluidos fines de semana y festivos, con un máximo de 1.000 UVB por transacción [DOC, banrep.gov.co, página modificada el 7 ene 2026]. No publica en esa página qué pasa si una transferencia no se acredita.
- **Transferencia a otro banco (ACH, Colombia):** Bancolombia dice que se hace efectiva en ciclos de días hábiles entre las 7:00 y las 17:30; lo enviado después de las 17:30 o en día no hábil se aplica «como máximo a la 1:00 p. m.» del siguiente día hábil [DOC, centro de ayuda de Bancolombia, consultado el 19 oct 2026]. **Una transferencia del viernes a las 18:00 puede llegar el lunes a la 1:00 p. m. (unas 67 horas), o el martes si el lunes es festivo.**
- **Nequi a otros bancos:** no encontramos la página oficial de Nequi; la prensa cita que llega el siguiente día hábil y que lo del fin de semana se ve el lunes [OBS]. Entre cuentas Nequi o por Bre-B es inmediato [OBS].
- **Pago Móvil (Venezuela):** no encontramos una regla oficial vigente de tiempos ni de reversos [NV]. La ficha de pagos de Venezuela cita que la clave C2P vence a los 5 minutos [DOC, Banplus], y la prensa reporta caídas del servicio y pagos revertidos por fallas de bancos [OBS].

**Con eso, la regla de «24 horas y deuda automática» marcaría como deudores a clientes que pagaron por ACH un viernes por la tarde**, y a clientes cuyo repartidor simplemente no revisó su banco.

### Referencias de mercado (de las fichas)

- No encontramos ninguna plataforma de reparto que documente un pago del cliente directo a la cuenta del repartidor con «verificar después» [NV].
- Cashea (Venezuela, no es reparto) verifica con banco, monto, referencia, fecha y captura, y reintenta a los 30 minutos si un dato estaba mal [DOC].

### Regla recomendada (no aprobada): recordatorios, evidencia de las dos partes y decisión humana

1. **Al pagar, el cliente deja su prueba:** referencia, banco de origen, hora, y opcionalmente la captura. La app guarda en el pedido **qué cuenta le mostró** (copia, no solo la vigente).
2. **Recordatorios al repartidor** para que revise su banco: a los 30 minutos y a las 2 horas (Bre-B y entre la misma billetera deberían estar). Sin penalización.
3. **Escalamiento a soporte** cuando venza el plazo **del canal**: Bre-B o mismo banco, 2 horas; ACH, 1:00 p. m. del siguiente día hábil más un margen; Pago Móvil, el que se valide en Venezuela. Las horas exactas son parámetros de Richard.
4. **Soporte pide evidencia a los dos:** comprobante del cliente (referencia, cuenta destino, monto, fecha) y movimientos o captura del repartidor del día. Clasifica en una de las cuatro causas.
5. **Decisión humana** de soporte, escrita en el caso: confirmado, pagado a cuenta equivocada (de quién es el error), sigue en camino, o **no pagado**. **Solo con «no pagado» decidido por una persona** nace la deuda del cliente. Nada pasa solo por tiempo.
6. **Mientras el caso está abierto:** sin bloqueos automáticos. Si Richard quiere una pausa preventiva (por ejemplo, que ese cliente solo pueda pagar con otro método hasta resolverlo), es una regla aparte que tiene que aprobar.
7. Lo que el repartidor pagó en el local en un caso decidido como «no pagado» va por la **decisión 20**.

### Impacto (supuestos explícitos)

- Supuestos: 500 pedidos por transferencia al mes en una ciudad colombiana; total de 35.500 COP; el 0,5 % nunca llega (2 o 3 al mes).
- La regla recomendada no cambia el dinero de esos 2 o 3 casos (van por la decisión 20); cambia **quién decide**: una persona con pruebas, no el reloj.
- Costo: trabajo de soporte por cada transferencia que pase su plazo; menos casos falsos que con 24 horas fijas, porque el plazo depende del canal y el cliente ya dejó su referencia.

### Alternativas y su riesgo

| Alternativa                                              | Riesgo                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 24 horas y deuda automática (la propuesta anterior)      | Clientes que pagaron quedan como deudores (ACH de fin de semana, repartidor que no revisó); el reloj no distingue las cuatro causas |
| 72 horas fijas                                           | Cubre casi todo el ACH, pero tres días de dinero del repartidor en el aire y sigue siendo automático                                |
| No entregar hasta ver la transferencia                   | Lo más seguro para el repartidor; espera en la puerta, comida fría; con Bre-B la espera es de segundos, con ACH no sirve            |
| Aceptar solo canales inmediatos (Bre-B, misma billetera) | Reduce casi todo el problema; deja fuera a quien no tiene Bre-B                                                                     |
| Sin plazo (como hoy)                                     | Casos abiertos para siempre                                                                                                         |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- El cliente puede dejar referencia, banco, hora y captura de su transferencia; el pedido guarda la cuenta que se le mostró.
- El servidor guarda la hora de la marca «por verificar» y el canal; una tarea del reloj manda los recordatorios y escala a soporte una sola vez por pedido.
- La bandeja muestra las pruebas de las dos partes y gana la acción «decidir» con las cuatro causas; solo «no pagado» escribe la deuda del cliente (referencia única).
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

**No fijar cifras de Venezuela hasta que el abogado venezolano y el de sanciones validen el modelo (decisión 8).** Hay dos maneras técnicas de poner precios en Venezuela, y no son lo mismo:

1. **Tarifas fijas expresadas en bolívares — ya soportado.** La zona va en `VES`, y el menú, las tarifas y los topes se escriben en céntimos de bolívar (C-TARIFAS-PAIS, C-TOPES-PAIS, recorrido local en VES de C-RECORRIDO-INTERNACIONAL). Funciona hoy sin código nuevo, pero las cifras **no siguen la tasa**: quedan viejas hasta que alguien las reescriba en el panel. La ficha de pagos de Venezuela cita que la Ley de Precios Justos y la SUNDDE exigen la tasa del BCV para precios en divisas [OBS].
2. **Precio fijado en USD y cobrado en VES con la tasa guardada en cada pedido — NO construido.** Es lo que recomienda la decisión 12. El diseño técnico, sin políticas comerciales, está en **`docs/DISENO-TASA-VES.md`**: el BCV publica en su portada y en planillas trimestrales una tasa con ocho decimales y «fecha valor» del día hábil siguiente (leída hoy: 881,87690000 Bs por USD, fecha valor martes 20 oct 2026 [DOC]); no encontramos API oficial; la lectura automática choca con el certificado del sitio, así que la base es la carga manual con doble confirmación; cada pedido guarda tasa, fecha valor y fuente; sin tasa vigente no se crean pedidos en VES; e incluye las pruebas de aceptación, empezando por una en rojo. Sus parámetros (antigüedad máxima de la tasa, caducidad de la cotización, dirección del redondeo, variación anómala) son de Richard y del contador venezolano.

Cifras provisionales en USD, solo para planear [INF, sin referencia de mercado]: envío 1,50 con 3 km, 0,30 por km, máximo 4,00; servicio 5 % con mínimo 0,50 y máximo 2,00; pedido mínimo 5,00 con cargo de 1,00; comisión al restaurante 15 %. Con el modo 1 habría que traducirlas a bolívares a mano y reescribirlas con cada cambio de tasa; con el modo 2 se cargan en dólares.

### Alternativas y su riesgo

| Alternativa                              | Riesgo                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Copiar a Rappi (25 % o más)              | Se pierde la promesa de comisión baja, que es lo que atrae restaurantes       |
| Comisión de 10 %                         | Con 1,50 USD por pedido ya es poco; con 10 % la ganancia cae a unos 4.500 COP |
| Envío más bajo que el mínimo del acuerdo | El repartidor gana menos que el mínimo de referencia; nadie se conecta        |
| Venezuela con cifras fijas en bolívares  | Se desactualizan con la tasa; precios incorrectos en días                     |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- Claude carga las cifras en el panel de Países (`PUT /datos/admin/paises/CO`), con la validación de mínimos y máximos que ya existe. No hace falta código para Colombia.
- Venezuela: con el modo 1, las cifras en bolívares se cargan en el panel sin código (y se reescriben cuando cambie la tasa); con el modo 2, antes hay que construir `docs/DISENO-TASA-VES.md`. En los dos casos, después de la decisión 8.
- La calculadora pública y las guías de Docs se actualizan con las cifras aprobadas.

---

## 4. Topes por país

### Situación hoy en Tumbite

- En Estados Unidos son cifras fijas en el código, en centavos: bono de la oferta abierta 100 (1 USD), precio máximo de una opción 10.000 (100 USD), propina máxima al pedir 50.000 (500 USD), propina posterior de 100 a 10.000 (1 a 100 USD), cupón de monto hasta 1.000.000 (10.000 USD), y reembolso automático por queja apagado con tope de 1.500 (15 USD).
- Con pesos colombianos esas cifras se leerían como pesos: el bono sería de 100 pesos y una opción no podría costar más de 10.000 pesos (C-MONEDA-RECORRIDO, huecos anotados).
- Ya publicado (C-TOPES-PAIS, `cfc1cec7`): los topes se leen por país, EE. UU. queda idéntico y un país sin topes escritos no se puede encender. **Las cifras siguen siendo de Richard.**
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

- Claude carga los topes del país en el panel de Países (C-TOPES-PAIS ya está publicado). Sin topes, el país sigue sin poder encenderse.
- La creación de cupones exige zona o restaurante fuera de EE. UU.

---

## 5. Recarga del saldo prepago disputada

### Situación hoy en Tumbite

- El saldo prepago solo sirve para pagar comisiones del cobro en mano; no se retira y nunca queda negativo (`internacional/libro.ts`, `cobroDirecto.ts`).
- Se recarga con un **código** comprado en un punto de venta (sin Stripe, sin contracargo de tarjeta) o con **tarjeta por Stripe**. La recarga con tarjeta está **apagada en todos los países**, y como la tarjeta solo cobra en dólares, hoy solo podría encenderse en EE. UU., donde el cobro en mano también está apagado.
- Si un repartidor disputa con su banco una recarga hecha con tarjeta, `registrarDisputa` guarda la disputa con su recarga, avisa al equipo («el saldo NO se tocó: decide qué hacer con él») y la bandeja la muestra como «recarga disputada», **«espera decisión»** (`disputas.ts`, `internacional/bandeja.ts`). **El saldo no se toca**: puede seguir gastándolo en comisiones.
- **El libro no sabe qué comisión se pagó con qué recarga:** el prepago es un solo saldo. «Lo que ya gastó de esa recarga» necesita una convención (ver abajo). Tampoco existen los bolsillos «congelado» ni «deuda del repartidor» (`Bolsillo` solo tiene `prepago`, `reservado`, `comisiones`, `punto`, `deuda_cliente`, `directo`).

### Lo que cobra Stripe (página oficial de precios, consultada el 19 oct 2026)

- Tarjeta nacional en EE. UU.: **2,9 % + 0,30 USD** por cobro [DOC].
- **Disputa recibida: 15 USD**, que **no se devuelve** aunque se gane (salvo contrato distinto) [DOC, página de precios y guía «How disputes work»].
- **Disputa contestada: 15 USD más** si se responde a mano; **se devuelve si se gana** y no si se pierde [DOC].
- Al abrirse la disputa, Stripe **retira del saldo de Windoce el monto disputado más la tarifa**, y lo retiene hasta el final (de 2 a 3 meses) [DOC].
- Ojo: la cuenta de Stripe es compartida con otros negocios de Windoce (C-STRIPE-AVISOS): el retiro sale del saldo común.

### Corrección: caja real frente a contabilidad

La versión anterior decía «pérdida de 81,75 frente a 61,75, que bajan a 31,75 si el repartidor paga». Eso **sumaba como si fuera dinero** el saldo interno que se anula y **contaba como recuperada** una deuda futura. Corregido:

**Supuestos (no son datos de Tumbite):** recarga con tarjeta de 50 USD; el repartidor ya gastó 30 en comisiones (Tumbite ya las anotó como ganadas); le quedan 20; Tumbite contesta la disputa y **pierde**.

| Concepto                                    | Caja real (igual con cualquier regla)              | Contable: «no tocar el saldo» (hoy)                                                                                    | Contable: «congelar y anular» (propuesta)                                                                                         |
| ------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Recarga cobrada                             | +50,00                                             | Pasivo de 50 con el repartidor (servicio por prestar)                                                                  | Igual                                                                                                                             |
| Tarifa de Stripe por la recarga (no vuelve) | −1,75                                              | Gasto 1,75                                                                                                             | Gasto 1,75                                                                                                                        |
| Comisiones ya ganadas con ese saldo         | 0 (no entra caja nueva: ya se contó en la recarga) | Ingreso 30 ya anotado; el dinero que lo pagaba se va con la disputa → **30 de servicio prestado que queda sin cobrar** | Igual: 30 sin cobrar                                                                                                              |
| Saldo que le queda al repartidor            | 0                                                  | Lo sigue gastando: Tumbite presta **20 más de servicio sin cobrar**                                                    | Se congela y al perder se anula: el pasivo de 20 se cancela. **No es ahorro de efectivo**: evita prestar 20 de servicio sin cobro |
| Stripe retira el monto disputado            | −50,00                                             | —                                                                                                                      | —                                                                                                                                 |
| Tarifa de disputa recibida                  | −15,00                                             | Gasto 15                                                                                                               | Gasto 15                                                                                                                          |
| Tarifa de disputa contestada (perdida)      | −15,00                                             | Gasto 15                                                                                                               | Gasto 15                                                                                                                          |
| Deuda del repartidor por lo gastado (30)    | 0                                                  | No existe                                                                                                              | Cuenta por cobrar de 30. **No es ingreso ni recuperación** hasta que entre dinero de verdad (una recarga pagada)                  |
| **Resultado**                               | **−31,75 USD en las dos reglas**                   | Costos de Stripe 31,75 + **50** de servicio sin cobrar                                                                 | Costos de Stripe 31,75 + **30** de servicio sin cobrar; posible cobro futuro de 30, sin contarlo                                  |

Otros desenlaces, en caja real: **sin contestar**, −16,75 (no se paga la segunda tarifa, y se pierde seguro); **contestada y ganada**, +33,25 (vuelven los 50 y los 15 de la contestada; los 15 de la recibida se pierden).

**Lo que de verdad cambia entre las dos reglas no es la caja:** es cuánto servicio presta Tumbite sin cobrar (50 frente a 30) y si queda una cuenta por cobrar. Ninguna regla devuelve los 31,75 que se lleva Stripe.

### Qué está aprobado y qué no

- Aprobado: sin saldos negativos ni crédito; el saldo prepago solo para comisiones.
- **No aprobado:** qué pasa con el saldo de una recarga disputada. «No tocar el saldo» es el comportamiento provisional, no una decisión.

### Regla recomendada (no aprobada)

1. **Al abrirse la disputa:** se **congela** lo que quede sin gastar, hasta el monto de esa recarga. Convención para saber cuánto queda (Richard elige): «lo disponible en prepago al abrir la disputa, hasta el monto de la recarga» (lo más protector para Tumbite) o «la recarga disputada se gastó primero» (lo más favorable al repartidor). Las comisiones ya apartadas para pedidos en curso (`reservado`) no se tocan. Mientras esté abierta, no recarga con tarjeta; puede seguir trabajando con tarjeta y, con saldo de otras recargas, en efectivo.
2. **Si Tumbite gana:** se descongela.
3. **Si Tumbite pierde:** lo congelado se anula (sin efecto en caja). Lo que ya gastó de esa recarga queda como **deuda del repartidor** en un bolsillo aparte, sin saldo negativo; con deuda no recibe pedidos en mano hasta pagarla con una recarga. Se cuenta como recuperado solo cuando entra el dinero.
4. **Contestar o no:** contestar cuesta 15 USD solo si se pierde. Con evidencia (fecha, recarga, uso del saldo, aceptación de los términos), contestar; sin evidencia, aceptar y ahorrar esos 15.
5. **Prevención:** recarga con tarjeta solo con tarjeta a nombre del repartidor y primera recarga con tope (cifra de Richard; la anterior proponía 50 USD). Donde haya puntos de venta, el código no tiene contracargo.

### Alternativas y su riesgo

| Alternativa                              | Riesgo                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| No tocar el saldo (como hoy)             | Misma caja, pero Tumbite presta todo el saldo restante sin cobrar; invita a recargar, gastar y disputar |
| Descontar todo y dejar el saldo negativo | Rompe la regla aprobada de no tener saldos negativos                                                    |
| Bloquear la cuenta entera del repartidor | Castiga también los pedidos con tarjeta; desproporcionado si la disputa es un error del banco           |
| No ofrecer nunca la recarga con tarjeta  | Cero riesgo de disputa; quedan solo los códigos de puntos de venta (en EE. UU. no hay puntos de venta)  |

### Qué cambia en el producto cuando Richard decida (no se implementa ahora)

- Dos bolsillos nuevos en el libro: «congelado» y «deuda del repartidor» (sin negativos; la salud del libro los vigila).
- Al llegar la disputa de una recarga: movimiento de prepago a congelado según la convención elegida (referencia única).
- Al cerrarse: descongelar, o anular y escribir la deuda; la oferta en mano mira esa deuda; la recuperación se anota cuando entra el dinero.
- La bandeja gana la acción «aplicar la regla» y muestra caja real (lo que retiró Stripe y sus tarifas) separada del saldo interno; el correo al equipo cambia su texto.
- Tope de la primera recarga con tarjeta por país.
- Guía pública en Docs para el repartidor, en los dos idiomas.
- Recién entonces se puede encender la recarga con tarjeta.

---

## Qué está aprobado y qué cambia en el producto si Richard decide cada cosa

**Aprobado de este documento: nada.** Lo único aprobado es lo de siempre (cobro directo, prepago solo para comisiones, sin crédito ni saldos negativos, retiros apagados).

| Decisión           | Si Richard decide…                             | Qué cambia en el producto                                                                                                                                                                          | Qué sigue bloqueado mientras no decida                                                  |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 20, comida perdida | A1 (dinero)                                    | Acción «reembolso por pagar» en la bandeja; «pagado» solo con la referencia de la transferencia real; foto del ticket obligatoria; topes por país                                                  | El efectivo en todos los países. Además, A1 necesita una cuenta en el país (decisión 8) |
| 20                 | A3 o A4 (crédito)                              | Crédito en el prepago con referencia única; el caso queda «saldado con crédito, pendiente de validación» salvo regla aprobada y validada por un abogado                                            | Igual                                                                                   |
| 22, transferencia  | Recordatorios + escalamiento + decisión humana | Comprobante y referencia del cliente; copia de la cuenta mostrada; recordatorios y escalamiento por canal; acción «decidir» con cuatro causas; deuda solo con «no pagado» decidido por una persona | La transferencia al repartidor (que además depende de la 20)                            |
| 22                 | Alguna penalización automática                 | Solo si la aprueba por escrito, con su plazo por canal                                                                                                                                             | —                                                                                       |
| Tarifas Colombia   | Las cifras                                     | Se cargan en el panel de Países, sin código                                                                                                                                                        | Pedidos en Colombia (409)                                                               |
| Venezuela modo 1   | Tarifas fijas en bolívares                     | Se cargan en el panel, sin código; hay que reescribirlas cada vez que cambie la tasa                                                                                                               | Pedidos en Venezuela; además, la decisión 8 (abogados)                                  |
| Venezuela modo 2   | Precio en USD cobrado en VES                   | Construir `docs/DISENO-TASA-VES.md` (tabla de tasas, doble confirmación, columnas del pedido, pruebas) y fijar sus parámetros                                                                      | Igual                                                                                   |
| Topes              | Las cifras                                     | Se cargan en el panel de Países (C-TOPES-PAIS ya publicado en `cfc1cec7`)                                                                                                                          | Encender cualquier método de pago en ese país                                           |
| Recarga disputada  | Congelar y anular (o no tocar)                 | Bolsillos «congelado» y «deuda del repartidor», convención de cuánto queda, acción en la bandeja                                                                                                   | Encender la recarga con tarjeta                                                         |

## Respuesta modelo (no es una aprobación)

Esto es solo un ejemplo de cómo podría responder Richard. **No vale como aprobación** hasta que él la escriba con sus propias cifras:

> Decisión 20: opción A1 (o A4), tope de ___ COP. Decisión 22: recordatorios y decisión de soporte, plazos por canal ___. Tarifas de Colombia: sí / con cambios. Topes de Colombia: sí / con cambios. Recarga disputada: congelar y anular, convención ___, primera recarga de ___ USD. Venezuela: esperar al abogado; cuando se valide, modo 1 o modo 2.

---

## Fuentes (consultadas el 19 oct 2026)

- Stripe, «Pricing & fees» (EE. UU.), sección de disputas: 15 USD por disputa recibida, 15 USD por disputa contestada (se devuelve si se gana), 2,9 % + 0,30 USD por tarjeta nacional. La página no muestra fecha de vigencia. https://stripe.com/pricing
- Stripe Docs, «How disputes work»: retiro del monto más la tarifa al abrirse, tarifa recibida no reembolsable fuera de México, tarifa contestada devuelta si se gana, plazos de 7 a 21 días para responder y de 2 a 3 meses en total. https://docs.stripe.com/disputes/how-disputes-work
- Banco de la República, «Conozca Bre-B» (página modificada el 7 ene 2026): el dinero llega en segundos, 24/7/365, máximo de 1.000 UVB por transacción. https://www.banrep.gov.co/es/bre-b/que-es
- Bancolombia, centro de ayuda, «¿Cuánto se demora una transferencia Bancolombia?»: ciclos en días hábiles de 7:00 a 17:30; lo enviado después o en día no hábil se aplica como máximo a la 1:00 p. m. del siguiente día hábil. https://www.bancolombia.com/centro-de-ayuda/preguntas-frecuentes/cuanto-demora-una-transferencia-bancolombia
- Banco Central de Venezuela, portada con el tipo de cambio de referencia y su fecha valor. https://www.bcv.org.ve/
- Banco Central de Venezuela, «Tipo de cambio de referencia del SMC» (planillas trimestrales con fecha de operación y fecha valor). https://www.bcv.org.ve/estadisticas/tipo-cambio-de-referencia-smc
- No oficiales, solo como referencia [OBS]: Valora Analitik, «¿Cuánto se demora una transferencia de Nequi a otros bancos?» https://www.valoraanalitik.com/nequi-transferencia-a-otros-bancos-cuanto-tiempo-se-demora/ ; DPL News sobre transferencias inmediatas en Venezuela (2022) https://dplnews.com/?p=161495 ; Bloomberg Línea sobre la falla de Banesco con pagos revertidos (29 jul 2022) https://www.bloomberglinea.com/2022/07/29/banesco-sufre-incidencia-con-operaciones-moviles-y-usuarios-entran-en-incertidumbre/
- No encontrado: página oficial de Nequi con tiempos de transferencia; regla oficial vigente de tiempos y reversos de Pago Móvil en Venezuela; API oficial del BCV.
