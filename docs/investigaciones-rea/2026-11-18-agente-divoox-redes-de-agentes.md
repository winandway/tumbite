# Agente Divoox: cómo lo resuelven las redes de agentes (fase cero)

**Fecha:** 18 de noviembre de 2026. **Puesto:** investigador. **Alcance:** solo lectura de fuentes públicas; no se tocó código, no se usaron cuentas, no se descompiló ninguna app, no se saltó ningún anti-robots. **REA:** no aplica (no hay artefacto propio ni autorizado que analizar; el tema es de procesos y reglas, y ahí la documentación pública es la evidencia). **País al que aplica:** Venezuela primero (agente con casa de cambio); el diseño sirve para todos los países, con perfil por país.

Etiquetas: [DOC] documentación publicada, [OBS] observación pública, [INF] inferencia mía, [NV] no verificable.

## 1. Referencias leídas (unas 20 lecturas)

| #   | Fuente                                                                                                        | Qué aportó                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Safaricom, preguntas frecuentes «M-PESA Agent Withdrawal» y página «Using M-PESA» (safaricom.co.ke)           | Existe el flujo oficial; la página directa dio error 403 al leerla, así que el detalle viene de las reseñas 2 y 3             |
| 2   | Standard Media (Kenia), «How to avoid losing money when withdrawing from an M-Pesa agent»                     | Número de agente + número de tienda + monto + PIN; reversos por Servicio al Cliente                                           |
| 3   | Khusoko, «Why Safaricom introduced M-Pesa agent store number» (2023)                                          | Motivo del número de tienda: retiros al agente equivocado (la página dio error 500; dato tomado del resumen de búsqueda)      |
| 4   | Safaricom, «Responsibilities of an M-PESA Agent» y The Star, «Roles and requirements of M-PESA agents» (2025) | Roles de agente, súper agente y dealer; verificación de documento del operador                                                |
| 5   | MicroSave, «The I don't have enough float quandary» y blog Mondato «How best to keep afloat»                  | Qué es el float y el rebalanceo                                                                                               |
| 6   | Business Daily Africa y Stanbic/KCB (resumen de búsqueda), compra de float                                    | Float prepagado, se compra con efectivo o referencia bancaria                                                                 |
| 7   | GSMA, «Mobile money fraud typologies and mitigation strategies» (marzo 2024)                                  | Tiene secciones de fraude de agentes (4.4.4) y arbitraje de comisiones (4.5.4); el PDF no se pudo extraer, solo los títulos   |
| 8   | GSMA / MicroSave, «Mobile money agents: sustainability in a digital era» y estudio Kenia                      | 19 % de agentes rurales rebalancea con préstamos entre agentes; riesgo de robo y fraude                                       |
| 9   | Elliptic, «Fraud patterns in agent networks»                                                                  | Colusión, abuso de float, reversos, manipulación de libro (el enlace directo dio 404; solo resumen)                           |
| 10  | bKash, «Cash Out from Agent» (bkash.com)                                                                      | Pasos: *247# o app, agente, monto, PIN; confirmación a ambos; cédula desde 5.000 taka (página directa 403; datos del resumen) |
| 11  | GCash Help Center, «How do I cash out from GCash Partner Outlets» y «How to cash in through a GPO»            | Se dice al cajero número y monto; teléfono registrado y documento                                                             |
| 12  | Nequi vía RCN, El Universal, Portafolio, Enter.co                                                             | Código de seis dígitos, 30 minutos, tope diario en cajeros 2,7 millones COP                                                   |
| 13  | Bancolombia, «Topes transacciones corresponsal bancario» (leída completa)                                     | Retiro hasta 5 millones COP al día; sujeto al efectivo del corresponsal                                                       |
| 14  | Caracol, Xataka Colombia, Cronista (Bancolombia sin tarjeta)                                                  | Código de seis dígitos, 30 minutos, de un solo uso, documento y recibo                                                        |
| 15  | Xataka México, Expansión, BBVA México (retiro en OXXO)                                                        | QR nuevo en la app; mínimo 100, máximo 3.000 y diario 9.900 pesos; el comercio cobra 20 pesos                                 |
| 16  | Spin by OXXO (Xataka México)                                                                                  | Código o QR generado en la app para retirar en tienda                                                                         |
| 17  | ARQ Finance «Qué es DiDi Pay» y Milenio                                                                       | Recarga de DiDi Pay por SPEI, depósito en OXXO o tarjeta                                                                      |
| 18  | Uber, página de la Uber Pro Card                                                                              | Pago a tarjeta tras cada viaje y retiro en cajeros; no hay efectivo en tiendas                                                |
| 19  | App Store de Zinli y CriptoNoticias                                                                           | Recarga con efectivo mencionada, sin lugares en Venezuela                                                                     |
| 20  | Bloomberg Línea, Finanzas Digital, Mastercard Venezuela (Yummy, Ridery)                                       | Nada sobre agentes de efectivo ni billeteras de conductor                                                                     |

## 2. Evidencia y límites (leer primero)

- **Bien documentado:** retiro en agente de M-Pesa y bKash; retiro con código de seis dígitos en Bancolombia y Nequi; retiro con QR en OXXO; el concepto de float y su recarga.
- **Poco documentado:** controles internos de los agentes (límites por agente, geolocalización, bloqueo por intentos) no están publicados con cifras. Lo que hay es lo que ve el usuario. [NV]
- **No encontrado:** Efecty como punto de retiro con código (ninguna fuente lo confirma); Daviplata (nada utilizable); recarga de conductor en puntos físicos de inDrive, Yango, Ridery o Yummy (nada oficial, una fuente contradictoria sobre inDrive); recarga por agente de Zinli en Venezuela; avisos de «fondo bajo» para el agente. Para todo esto **no hay evidencia**: no se inventa. [NV]
- DiDi: la recarga en OXXO es de la billetera de DiDi Pay en general; no hay guía oficial de «pagar la comisión del conductor en tienda». [DOC parcial]
- Las cifras de vigencia de GCash (30 minutos) y de QR (5 minutos) vienen de blogs, no de GCash. [OBS]
- Varias fuentes son prensa o blogs de marca (Safaricom publicó parte). No se trataron como reglas internas confirmadas.

## 3. Hallazgos por pregunta

### A. Nombre

- Kenia y Bangladesh: **«agent» / «agente»**. [DOC] Safaricom, bKash.
- Colombia: **«corresponsal bancario»** (término regulado: solo recibe o entrega dinero, no es sucursal). [DOC] Bancolombia.
- Filipinas: **«partner outlet»** y **«GCash Pera Outlet (GPO)»**; en español de México se oye «punto de pago» y «comercio participante». [DOC] GCash, BBVA.
- Venezuela: no se encontró un término de marca equivalente publicado por billeteras locales. [NV]
- **Veredicto:** «Agente Divoox» / «Divoox Agent» se entiende: «agente» es el nombre más repetido en el mundo del dinero móvil. [INF]
  - Riesgo: en español de algunos países «agente» también suena a representante comercial o policía; y en Venezuela «corresponsal» o «agente» puede tener peso regulatorio si se interpreta como intermediario financiero. [INF] Es tema legal: va a Richard (👤), no se decide aquí.
  - Mejor etiqueta del local para el público, en lugar del rol: **«Punto Divoox»** (como «Punto Kinko»). El rol de la persona se queda «Agente Divoox». [INF]

### B. Retiro (cash-out), usuario y agente

Paso a paso común a las referencias:

1. **Inicia el usuario**, siempre desde su app o menú (M-Pesa *334#, bKash *247#, Bancolombia/Nequi, BBVA). [DOC]
2. **Qué identifica la operación:**
   - M-Pesa y bKash: el usuario teclea el **número de agente** (+ número de tienda en M-Pesa desde 2023), el monto y su PIN. Antes de aceptar, la pantalla muestra el **nombre del agente**. [DOC/OBS]
   - Bancolombia y Nequi: se genera un **código de seis dígitos, un solo uso, 30 minutos**; el usuario lo da al corresponsal con su documento. [DOC/OBS]
   - BBVA/OXXO y Spin: **QR** generado en la app, nuevo cada vez; el cajero lo escanea. [DOC]
   - GCash outlet: se dice al cajero número y monto; un blog describe un OTP por SMS que se comparte. [DOC/OBS]
3. **Qué verifica el agente:** documento original (M-Pesa, Bancolombia, GCash; bKash lo pide desde 5.000 taka). El agente compara nombre y documento con lo que ve en pantalla. No se encontró uso de foto del usuario. [DOC/OBS]
4. **Confirmación:** mensaje de texto a **ambos lados** (usuario y agente); solo después se entrega el efectivo, y se recomienda contarlo en el mostrador. [DOC/OBS]
5. **Recibo:** el SMS (M-Pesa, bKash) o el comprobante del corresponsal; se recomienda pedirlo. [OBS]
6. Si el código vence sin usarse, el dinero **no se descuenta** y se genera otro. [OBS] Nequi.

### C. Recarga (cash-in)

- M-Pesa: el cliente da su número de teléfono y su documento; el agente teclea el depósito y ambos reciben confirmación por SMS. [OBS, la ficha oficial no se pudo leer]
- bKash y GCash: el agente identifica por **número de teléfono** del usuario; el usuario confirma por mensaje o app. Documento al cajero en GCash. [DOC/OBS]
- Bancolombia: depósito hasta 3 millones COP al día por corresponsal. [DOC]
- No hay evidencia de que alguna de estas redes deje al usuario **comprar saldo con un código del agente**. El patrón común es que el agente cobra en efectivo y teclea el número del usuario. [INF]

### D. Fondo o «float» del agente

- El float es dinero electrónico **prepagado** que el agente compra con efectivo (banco o súper agente) y que baja con cada retiro que paga y sube con cada depósito que recibe. [DOC] Safaricom, MicroSave.
- Sin float suficiente el agente no puede cobrar un retiro; sin efectivo no puede pagarlo. Los dos extremos se rebalancean con idas al banco o a un súper agente. [DOC]
- Controladores de float en M-Pesa: «dealers» y «master agents» vigilan que los agentes tengan fondo y auditan. [DOC] The Star.
- **Aviso de fondo bajo al agente:** no se encontró documentado. [NV]
- Los agentes que quedan sin float recurren a préstamos informales (19 % en zonas rurales), donde está el mayor riesgo. [DOC] GSMA/MicroSave.

### E. Controles y fraudes

- **Documentados (con cifras):**
  - Bancolombia corresponsal: retiro máx. 5 millones COP/día; depende del efectivo del local. [DOC]
  - Nequi cajeros: mín. 10.000, máx. 2,7 millones COP/día. [DOC prensa]
  - BBVA/OXXO: mín. 100, máx. 3.000 por retiro, 9.900 por día (pesos mexicanos). [DOC prensa]
  - bKash: documento desde 5.000 taka. [DOC]
- **Fraudes y su freno:**
  - **Retiro al agente equivocado** (número mal tecleado): M-Pesa añadió **número de tienda** y pantalla con el nombre; el reverso va por Servicio al Cliente. [DOC/OBS]
  - **Agente que pide dinero extra o cobra comisión no autorizada:** no se encontró documentado cómo lo frenan; se mitiga con comisión visible en el recibo. [NV/INF]
  - **Operación fantasma** (el agente registra un retiro que no se pagó): se frena con confirmación por ambos lados y recibo al usuario. [INF a partir de DOC]
  - **Retiro partido** (el mismo monto dividido para esquivar límite o documento): Elliptic y GSMA lo clasifican dentro de abuso de agentes; el freno es límite acumulado por usuario/día. [INF; el texto GSMA no se pudo leer]
  - **Colusión y abuso de float / reversos / manipulación del libro:** lo enumera Elliptic, con auditoría y conciliación como freno. [OBS vendor]
  - **Suplantación y robo del código:** las apps piden no compartir el código con nadie (Nequi); el agente debe ver al usuario en persona. [DOC]
- **Bloqueo por intentos fallidos:** no se encontró un número público (ni para código ni para PIN) en estas referencias. [NV]

### F. Dos monedas o billetes enteros

- Ninguna referencia consultada documenta pago en dos monedas ni redondeo a billetes enteros. [NV]
- [INF] En Venezuela el efectivo en dólares viene en billetes de uno, cinco, diez, veinte, cincuenta y cien; no hay centavos prácticos. Un monto de 12,40 dólares no se puede pagar en efectivo exacto.

### G. Palabras de los botones

| Idea                     | Español visto                                               | Inglés visto                                                                                             |
| ------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sacar efectivo en agente | «Retirar», «Retiro sin tarjeta», «Generar QR para comercio» | «Withdraw Cash» → «From Agent» (M-Pesa); «Cash Out» → «From Agent» (bKash); «Cash Out» → partner (GCash) |
| Depositar                | «Consignar», «Depositar»                                    | «Cash In» (GCash, bKash), «Deposit» (M-Pesa)                                                             |
| Cargar saldo             | «Recargar saldo» (DiDi Pay, Zinli, inDrive)                 | «Top up», «Recharge»                                                                                     |
| Código                   | «Código de retiro», «Clave de retiro»                       | «Withdrawal code»                                                                                        |

## 4. Diagrama de texto del recorrido estándar

```
RETIRO (el conductor cobra sus ganancias en efectivo)

 CONDUCTOR (app)                 SERVIDOR                    AGENTE (app/panel)
 ----------------                ---------                   ------------------
 1. «Retirar en agente»
    elige monto y agente  ---->  2. reserva el monto
                                    en su billetera
                                    (queda «apartado»)
                                 3. genera código 6 dígitos,
                                    un solo uso, vence en 30 min
 4. ve el código  <------------
 5. va al Punto Divoox y
    dice el código + documento
                                                          6. teclea código
                                                          7. ve: nombre del conductor,
                                                             monto, foto de perfil
                                                          8. compara documento original
                                                          9. confirma «Entregué el efectivo»
                                 10. descuenta la billetera,
                                     descuenta del fondo del
                                     agente (suma deuda con Divoox
                                     o resta fondo), marca
                                     código usado
 11. ve «Retiro completado»  <--  12. recibo a los dos lados
                                      (número de operación)

 Si vence o se cancela: se libera el monto apartado, el código muere.

RECARGA (el conductor compra saldo con efectivo)

 CONDUCTOR                       AGENTE                     SERVIDOR
 ---------                       ------                     --------
 1. lleva efectivo y dice su
    teléfono o muestra QR
                              2. busca conductor por teléfono o QR
                              3. ve nombre y foto, confirma con él
                              4. teclea monto, cobra en efectivo
                                                    5. resta del fondo del agente,
                                                       suma a la billetera del conductor
 6. ve «Saldo recargado»  <-------------------------  7. recibo a los dos
```

## 5. Comparación con lo nuestro

- No se leyó el código del producto (fuera de alcance, y no hay Agente Divoox). Lo único relacionado que consta en las reglas del proyecto es la billetera prepago del conductor y el requisito de comisiones descontadas del saldo (documento `docs/REQUISITO-MONETIZACION-PREPAGO-MULTISERVICIO.md`). [DOC interna]
- Brecha esperada: un saldo «apartado» por código pendiente, el fondo prepago del agente y el panel del agente. [INF]

## 6. Decisiones recomendadas para Divoox

Todas son [INF] construidas sobre las referencias; las cifras de arranque son de Divoox y no de las redes.

**Nombre**

- Rol: **«Agente Divoox» / «Divoox Agent»**. Lugar: **«Punto Divoox» / «Divoox Point»**. Antes de usarlo públicamente en Venezuela, 👤 consulta legal sobre si «agente» tiene implicaciones regulatorias para quien vende saldo.

**Código de retiro**

- **Seis dígitos, un solo uso, vigencia de 30 minutos**, como Bancolombia, Nequi y GCash. Solo **un código vivo por conductor** a la vez: pedir otro cancela el anterior y libera el monto.
- Al generar el código, el monto queda **apartado** en la billetera (no se puede gastar dos veces).
- El código va ligado al agente elegido (como el número de tienda de M-Pesa), para que no sirva en otro punto.

**Intentos**

- **Tres intentos fallidos** por código y el código muere; **cinco** en un día por agente y el panel de ese agente se pone en pausa hasta que Divoox lo revise. Cifras de partida; las redes no las publican. [NV]

**Qué muestra el panel del agente**

- Al teclear el código: **nombre del conductor, foto de perfil, últimos cuatro del documento, monto en dólares y en bolívares, y cuántos minutos le quedan al código**.
- Botones: «Entregué el efectivo» y «No coincide» (este último anula y registra).
- Siempre visible: **fondo disponible**, retiros del día, recargas del día y **comisión del agente** de cada operación.
- Aviso de **fondo bajo** (debajo del 20 % del fondo asignado, y otro al 10 %) al agente y a Divoox. No hay referencia que lo documente, pero hace falta. [NV]
- Recibo con número de operación a los dos lados; sin él la operación no se da por hecha.

**Doble confirmación**

- El saldo solo se descuenta cuando el **agente confirma entrega** y el conductor ve el cierre en su app. Si el agente no confirma en 30 minutos, todo vuelve a su lugar.

**Montos y redondeo**

- Retiro **solo en billetes enteros** del dólar: el conductor elige el monto y la pantalla redondea hacia abajo al billete entero; el sobrante queda en su saldo. [INF]
- Mostrar siempre el monto en dólares como el valor que manda; el equivalente en bolívares es solo informativo. [INF]

**Límites sugeridos de arranque (por conductor y por día)**

- Por retiro: mínimo 5 dólares, máximo 100 dólares.
- Por día: 200 dólares por conductor y **500 dólares por agente**; el fondo del agente es otro tope natural.
- Recarga: mínimo 5 dólares, máximo 100 por operación y 200 por día.
- Primeros 7 días del agente: mitad de estos topes. Estas cifras son de partida, a ajustar con datos reales.

**Controles contra fraude**

- Una operación por código, sin partir un retiro en varios; acumulado diario por conductor.
- Conciliación diaria del fondo de cada agente contra recibos; alerta si hay diferencia.
- Panel del equipo con historial por agente y bloqueo manual inmediato.
- Ninguna comisión se cobra al conductor por fuera de la que el recibo muestre.

**Textos de botones**

| Dónde                       | Español                        | Inglés                         |
| --------------------------- | ------------------------------ | ------------------------------ |
| App del conductor, retirar  | **Retirar en un Punto Divoox** | **Cash out at a Divoox Point** |
| Código generado             | **Tu código de retiro**        | **Your cash-out code**         |
| App del conductor, recargar | **Recargar saldo en efectivo** | **Top up with cash**           |
| Panel del agente, retiro    | **Pagar retiro**               | **Pay out**                    |
| Panel del agente, recarga   | **Cobrar recarga**             | **Sell balance**               |
| Confirmar                   | **Entregué el efectivo**       | **Cash handed over**           |
| Rechazar                    | **No coincide**                | **Doesn't match**              |
| Fondo                       | **Fondo disponible**           | **Available float**            |

**Pendientes que no son de esta ficha**

- 👤 Legal Venezuela: qué es «agente» y vender saldo a terceros; revisar con el abogado antes de abrir.
- Ficha de seguimiento: cuando exista una pantalla, volver a comparar con REA sobre nuestras propias apps.

## 7. Pruebas de aceptación sugeridas para quien construya

1. Un código vence a los 30 minutos y libera el monto apartado.
2. Un código usado no se puede volver a usar, ni en otro agente.
3. Pedir un segundo código cancela el primero.
4. Tres intentos fallidos matan el código.
5. Sin fondo suficiente el agente no puede confirmar una recarga; sin confirmación del agente no se descuenta el retiro.
6. El retiro de un monto con centavos se redondea al billete entero y el sobrante se queda en la billetera.
7. Todo cambio de fondo del agente deja un movimiento con número de recibo.
