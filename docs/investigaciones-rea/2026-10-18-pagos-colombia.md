# Pagos en Colombia: cómo cobrar a clientes y pagar a restaurantes y repartidores

**Fecha:** 18 de octubre de 2026. **Quién pidió:** Richard. **Tipo:** investigación de candidatos (ningún proveedor está contratado). **Fuentes:** solo documentación pública y páginas de ayuda; no se abrió ninguna cuenta ni se usó navegador interactivo. **Dinero real:** ninguno.

**Pregunta:** ¿cómo puede Tumbite cobrar a clientes en Colombia (tarjetas, Nequi, PSE, Daviplata, efectivo, Bancolombia QR) y pagar a restaurantes y repartidores colombianos (dispersiones a Nequi, Daviplata y cuentas bancarias)?

**Respuesta corta:** Stripe, que es lo que Tumbite ya usa, **no sirve para cobrar en Colombia** (Colombia no está en su lista de países para comercios) y **tampoco sirve hoy para pagar a un repartidor colombiano desde la cuenta de Windoce con Stripe Connect** (los pagos transfronterizos de Connect solo llegan a EE.UU., Reino Unido, EEE, Canadá y Suiza). La única puerta de Stripe hacia Colombia es _Global Payouts_, que exige Treasury y, según Stripe, está pensado para empresas que ya tienen licencia de transmisor de dinero. Para Colombia hace falta un proveedor local. El candidato con más piezas verificadas en documentación oficial es **Wompi (Bancolombia)**: cobra con tarjeta, PSE, Nequi, Botón y QR Bancolombia, Daviplata y efectivo en corresponsales, y tiene una API de «Pagos a terceros» con sandbox, webhooks e idempotencia que dispersa a cualquier banco, Nequi y Daviplata. Lo que ningún proveedor resuelve sin una entidad colombiana es la contratación: todos piden NIT/RUT y cuenta bancaria en Colombia.

---

## 1. Referencias

| Candidato             | Qué se revisó                                                                                                                                                          | Etiquetas         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Wompi (Bancolombia)   | docs.wompi.co (métodos de pago, ambientes, eventos, pagos a terceros), PDF de alta empresarial, prensa sobre tarifas                                                   | [DOC] [OBS]       |
| PayU Latam Colombia   | developers.payulatam.com (sandbox, API de pagos Colombia), términos para comercios, página de tarifas (referida por resultados de búsqueda)                            | [DOC] [OBS]       |
| Mercado Pago Colombia | mercadopago.com.co (checkout, costos, Split de Pagos 1:1, PSE por Orders, IVA)                                                                                         | [DOC]             |
| ePayco                | epayco.com/tarifas, SDK oficiales, prensa sobre «Pagos Divididos»                                                                                                      | [DOC] [OBS]       |
| dLocal                | docs.dlocal.com (payins Colombia, payouts Colombia), FAQ de onboarding                                                                                                 | [DOC]             |
| Stripe                | stripe.com/global, docs de Connect cross-border payouts, Global Payouts, recipient requirements, formatos de cuenta bancaria, changelog marzo 2026, precios de Connect | [DOC]             |
| Rappi Colombia        | merchants.rappi.com, cuenta oficial de soporte en X, ayuda de Nequi                                                                                                    | [OBS]             |
| DiDi Food Colombia    | web.didiglobal.com/co/food (guías de restaurantes, repartidores y usuarios)                                                                                            | [DOC]             |
| Regulación colombiana | Decreto 1692 de 2020 (Función Pública), comunicado de la CCCE, artículos comerciales                                                                                   | [DOC] [OBS] [INF] |

Lo que **no** se pudo leer (bloqueo 403/404 al pedirlo sin navegador): la página de tarifas de Wompi, la página de tarifas de PayU, la página de costos de Mercado Pago en su sección de ayuda, la página de dispersiones en español de Wompi y la página de ayuda de Nequi sobre Rappi. Donde hubo cifras de terceros se marcan [OBS] y no se dan por oficiales.

---

## 2. Evidencia y límites

### 2.1 Wompi (Bancolombia)

**Cobros (payins)**

- **[DOC]** Métodos de pago en Colombia según la guía oficial de métodos de pago (docs.wompi.co/docs/colombia/metodos-de-pago/): tarjetas de crédito y débito Visa, Mastercard y American Express (`CARD`, con tokenización); Botón de transferencia Bancolombia (`BANCOLOMBIA_TRANSFER`, «persona natural» únicamente, admite cobros recurrentes con fuente de pago); **QR Bancolombia** (`BANCOLOMBIA_QR`, persona natural); **Nequi** (`NEQUI`, el cliente acepta una notificación push en su app; celular de 10 dígitos); **PSE** (persona natural o jurídica, requiere cédula, nombre, correo y teléfono); **efectivo en corresponsales Bancolombia** (`BANCOLOMBIA_COLLECT`, se entrega un código de convenio y referencia); Puntos Colombia; BNPL Bancolombia (desde 100.000 COP, cuatro cuotas); **Daviplata** (`DAVIPLATA`, con OTP por SMS; requiere tipo y número de documento y teléfono); SU+ Pay.
- **[DOC]** «ninguno de los métodos de pago otorga un resultado síncrono (inmediato)»: hay que consultar `GET /v1/transactions/<ID>` o esperar el evento. «¡No uses un token más de dos veces!»; para cobros repetidos se usan fuentes de pago.
- **[DOC]** Bre-B aparece solo como dispersión «Próximamente», no como método de cobro (misma guía).
- **[DOC]** Ambientes (docs.wompi.co/docs/colombia/ambientes-y-llaves/): sandbox en `https://sandbox.wompi.co/v1`, producción en `https://production.wompi.co/v1`; llaves con prefijo `pub_test_`, `prv_test_`, `test_events_`, `test_integrity_` y sus equivalentes `prod_`. «Es el ambiente de pruebas, el cual puedes utilizar para realizar transacciones» falsas, aprobadas o declinadas.
- **[DOC]** Webhooks (docs.wompi.co/docs/colombia/eventos/): eventos `transaction.updated`, `nequi_token.updated`, `bancolombia_transfer_token.updated`; cada evento trae `signature` con checksum SHA256 en el header `X-Event-Checksum`, calculado con los campos de `signature.properties`, el `timestamp` y el secreto de eventos. Si la respuesta no es 200, reintenta tres veces en 24 horas (30 min, 3 h, 24 h). Hay que registrar una URL de eventos por ambiente.
- **[DOC]** Reembolsos: el menú de docs lista «Reembolsos V2 (Sandbox)». No se pudo leer la página (404 en la URL probada). Contracargos: **[NV]** no hay página pública de Wompi Colombia sobre contracargos; un ebook de Wompi sobre fraude describe el flujo genérico (el comercio entrega pruebas en cinco días hábiles) y el reglamento de Wompi Panamá dice que reversiones y contracargos se debitan de la cuenta Wompi del comercio. **[INF]** En Colombia debe ser igual, pero no está confirmado.
- **Tarifas**: la página oficial de tarifas devolvió 403. Cifras disponibles:
  - **[OBS]** Enter.co (octubre 2026): plan general «2,65 % + $700 por transacción, más IVA»; QR «1 % por transacción exitosa» para personas naturales que pagan desde Bancolombia o Nequi; Nequi Negocios «1,99 % + IVA». El mismo artículo advierte que el 1 % del QR no es tarifa general.
  - **[OBS]** Guía de Software (comparativa del 8 de septiembre de 2026, sin fuente citada): tarjeta «2,99% + IVA + COP 600», PSE «1,49% + COP 1.200», Nequi «1,79%», abono «1-2 días hábiles si tu cuenta es Bancolombia, 2-3 días con otros bancos». **No coincide** con Enter.co; se toma solo como orden de magnitud.
  - **[NV]** Tarifa oficial por método, tarifa de PSE, de Daviplata y de efectivo.
- **[OBS]** Tiempos de abono: La República (29 de abril de 2026) y la sala de prensa de Bancolombia: el comercio puede elegir «el traslado automático al siguiente día hábil» o dejar el saldo en la cuenta Wompi «hasta por 180 días».

**Dispersiones (payouts): «Pagos a terceros»**

- **[DOC]** (docs.wompi.co/en/docs/colombia/introduccion-pagos-a-terceros/): dispersa a cuentas bancarias en Colombia, «one at a time or in bulk», con `POST /payouts` (JSON) o `POST /payouts/file`. Cuentas de origen: cuenta Wompi, cuentas Bancolombia u otros bancos autorizados. Tipos de cuenta destino `AHORROS` y `CORRIENTE`; la lista de códigos de banco **incluye NEQUI y DAVIPLATA**. Pagos inmediatos, programados o recurrentes. Idempotencia con clave que «expires in 24 hours». Sandbox que «simula pagos y respuestas» y recargas de saldo. Avisos por webhook y un depurador de eventos en el panel. Límite diario «$1,500,000,000 COP» ajustable y 3.800 lotes por día. Montos en centavos enteros. Se avisa que depende de «the ACH processing cycles and the origin account».
- **[DOC]** (docs.wompi.co/en/docs/colombia/que-es-pagos-a-terceros/): «instant payments» a cuentas Bancolombia y Nequi; doble control con roles «preparer, approver, and viewer»; «the activation request must be completed by the legal representative»; revisión «about 2 to 5 business days». Tarifas y planes solo en imagen: **[NV]** costo por dispersión.
- **[OBS]** LatamFintech: lotes programables a cualquier cuenta Bre-B. No está en la doc oficial; la doc dice «Próximamente».

**Contratación / KYC**

- **[DOC]** PDF «crear cuenta empresarial» de Wompi: la opción «Empresarial» pide **RUT de la empresa**, datos del representante legal, beneficiarios finales si el representante no es el único accionista, datos bancarios, actividad económica y canales de venta.
- **[OBS]** Varias fuentes (Shopify, LatamFintech) dicen que se necesita cuenta en Bancolombia; la doc de pagos a terceros admite «otros bancos autorizados» como origen. **[INF]** Para cobrar probablemente baste una cuenta colombiana, pero los abonos «al siguiente día hábil» e instantáneos están ligados a Bancolombia.
- **[NV]** Si Wompi acepta a una empresa extranjera sin NIT. Un concepto jurídico citado en la búsqueda dice que una sociedad extranjera sin negocio permanente en Colombia no tiene sucursal ni NIT; luego no encaja en el formulario «Empresarial» tal como está publicado.

### 2.2 PayU Latam (Colombia)

- **[DOC]** Sandbox (developers.payulatam.com, «Test your solution»): credenciales de prueba públicas (Merchant ID 508029, Account ID Colombia 512321, API Login y API Key de prueba), tarjetas de prueba por país, estados simulados por nombre del tarjetahabiente (`APPROVED` con CVV 777, `REJECTED` con CVV 666) y correos antifraude de prueba. Montos de prueba de al menos 1 USD equivalente.
- **[DOC]** API de pagos Colombia: tarjetas de crédito y débito en un paso (`AUTHORIZATION_AND_CAPTURE`; dos pasos «available on request»), **Bre-B QR** (el QR «expires 15 minutes after it is generated»), PSE (redirección al banco), Google Pay, y secciones propias de **Nequi**, **Botón Bancolombia** y **efectivo o referencia bancaria** (no se leyeron completas). Tokenización con `creditCardTokenId`. Hay API de anulaciones y reembolsos (no leída en detalle). Daviplata: **[NV]** no apareció en el tramo leído.
- **[DOC]** Términos para comercios (legal.payulatam.com): la cuenta bancaria «debe estar abierta en el domicilio del comercio»; la contraparte para pagos en Colombia es «PayU Colombia S.A.S.»; «el riesgo de fraude por suplantación de identidad de un pagador, o el de ilegalidad de una transacción son enteramente asumidos por el Comercio» (versión 2015 citada por búsqueda; **[NV]** si cambió en la versión 2024).
- **[DOC]** Política de reversiones y contracargos (PDF en latam.payu.com): en Colombia PayU «está en capacidad de reversar débitos hechos con tarjeta de crédito, pero no de reversar débitos hechos a cuentas bancarias» (PSE).
- **Tarifas**: la página oficial no se pudo leer. Un resultado de búsqueda que cita la página oficial corporativa da «3,29% más 300 COP por transacción, antes de IVA», mínimo 450 COP para PSE, Nequi, Botón Bancolombia y QR Bre-B, retiro a banco en 3 días hábiles, «3 primeras retiradas por mes gratuitas» y luego 6.500 COP más IVA, «únicamente a comerciantes locales». Se marca **[OBS]** porque no se leyó la página directamente. Guía de Software (sept. 2026) da otras cifras (2,99 % + IVA + 700; PSE 1,89 % + 1.200). **[NV]** cuál es la vigente.
- **[OBS]** Afiliación (guías de terceros y guía antigua de PayU): RUT, certificado de Cámara de Comercio, cédula del representante legal y certificación bancaria reciente a nombre de la empresa. **[NV]** lista oficial vigente.
- **Dispersión a terceros / marketplace:** **[NV]** no se encontró API pública de payouts de PayU Colombia. **[INF]** El modelo de PayU Colombia es agregador que abona al comercio; repartir a terceros tendría que hacerse por fuera (transferencias bancarias propias).
- **[OBS]** Una queja de usuario en Colombia muestra un cargo «pago a PayU DiDi»: DiDi Food parece cobrar tarjetas con PayU. Fuente no oficial.

### 2.3 Mercado Pago Colombia

- **[DOC]** Página de checkout (mercadopago.com.co/herramientas-para-vender/check-out): comisión según cuándo se libera el dinero: «En el momento 3.29% + $800 + IVA; en 7 días 2.99% + $800 + IVA; en 14 días 2.79% + $800 + IVA». Medios: tarjetas de crédito (Visa, Mastercard, Amex, Diners, Codensa), débito (Visa Electron, Mastercard Debit), **PSE**, efectivo (**Efecty**, logo de Baloto), dinero en Mercado Pago.
- **[DOC]** Changelog de desarrolladores: PSE disponible en Checkout API vía Orders desde mayo de 2026; requiere IP del comprador, callback y redirección al banco. En la lista de instituciones de PSE aparece **NEQUI** (mínimo 1.600 COP), es decir, Nequi se cobra a través de PSE, no con push propio.
- **[DOC]** IVA: si no se envía, la API aplica 19 % sobre el total; se puede enviar `net_amount` e IVA desglosados.
- **[DOC]** Split de Pagos 1:1 (docs de split-payments): «diseñada para proporcionar servicios de Proveedor de Servicios de Pago (PSP) a vendedores en modelos de marketplace»; disponible en Argentina, Brasil, Chile, **Colombia**, México, Perú y Uruguay; `marketplace_fee` en Checkout Pro y `application_fee` en Checkout API; el vendedor se vincula por OAuth. **[OBS]** En la versión de Chile de la misma guía: Split 1:1 «solo permite pagos realizados con saldo de cuenta de Mercado Pago» y los reembolsos se descuentan proporcionalmente a vendedor y marketplace. **[NV]** si esa restricción aplica igual en Colombia y si funciona con tarjeta y PSE.
- **[NV]** Dispersión a Nequi o Daviplata: no existe en la doc pública; el vendedor cobra en su cuenta de Mercado Pago y retira a su banco.
- **[OBS]** Cuenta empresa: NIT válido, representante legal y documento de identidad (fuente de terceros). **[NV]** empresa extranjera.
- **[OBS]** IsDown registra varios incidentes menores en 2026 con «high error rate in approval of Nequi transactions» vía PSE (julio, agosto, septiembre).

### 2.4 ePayco

- **[DOC]** Página de tarifas (epayco.com/tarifas): modelo **Agregador** «Desde 2.64% + $690 por transacción exitosa» con cuenta Davivienda y «3.29% + $700» con otros bancos, más IVA; instalación $0; «Empieza a cobrar inmediatamente». Modelo **Gateway**: tarifa de afiliación (1.471.700 o 1.546.700 + IVA según la versión de la página) y «Desde $142 COP por transacción exitosa + iva», dinero en «24 / 72 horas», «Empieza a cobrar de 20 a 30 días». PSE: «en transacciones menos a $60.000 Pesos es de $2.000 + IVA». Retiro de cuenta virtual a banco: «$6.500 Pesos + IVA» (clientes Davivienda, cuatro al mes sin costo). Medios: tarjetas, **Daviplata**, PayPal, PSE, SafetyPay, efectivo (Efecty, Baloto, Gana). Retenciones sobre tarjeta de crédito (IVA 15 % sobre el IVA, renta 1,5 %, ReteICA 0,2 %). «Las reversiones solo se hacen desde ePayco con tarjeta de crédito». Nequi: **[NV]** no aparece en la página de tarifas.
- **[DOC]** SDK oficiales (PHP, Node, Python en GitHub): parámetros `splitpayment`, `split_app_id`, `split_merchant_id`, `split_type`, `split_primary_receiver`, `split_primary_receiver_fee`, `split_rule: "multiple"` con `split_receivers` (id, total, iva, base_iva, fee). Los comentarios remiten a «requisitos previos» en la doc.
- **[OBS]** La República (abril 2026): ePayco lanzó «Pagos Divididos» para repartir un cobro entre varios beneficiarios sin pagar el 4x1000 en cada reparto.
- **[OBS]** Afiliación (terceros): cédula del representante legal, Cámara de Comercio no mayor a 30 días, RUT, certificación bancaria; cuenta sin validar limitada a 200.000 COP. Sandbox existe (plugin de WooCommerce). **[NV]** lista oficial, empresa extranjera, dispersión a Nequi/Daviplata como payout independiente del cobro.

### 2.5 dLocal

- **[DOC]** Payins Colombia (docs.dlocal.com): tarjetas Visa, Mastercard, Amex, Diners, Codensa; Efecty (vence en 5 días); **PSE** (mínimo 1.600 COP, solo redirección); efectivo en Bancolombia (`BN`); **Nequi Push** (`QP`, «one-shot and tokenized», ventana de 15 minutos), Nequi Mixed (`MQ`) y **Nequi QR** (`QR`, 45 minutos); Mercado Pago; **Bre-B QR** (`EV`); Addi (sin contracargos de tarjeta). Reembolsos parciales y múltiples para varios métodos. **Daviplata no aparece** como payin.
- **[DOC]** Payouts Colombia (docs.dlocal.com/docs/colombia-payouts): dos métodos, **transferencia bancaria** y **Bre-B** («Colombia's government-backed, real-time payment rail»); monedas `COP` o `USD`; tipos de cuenta `C`, `S` y `breb`; documentos `NIT`, `CC`, `CE`, `PASS`, `PEP`; campos `document_id`, `document_type`, `beneficiary_name`, `beneficiary_lastname`, `bank_code`, `bank_account`, `account_type`, `address`; `comments = TRANSFIYA` enruta por la red 24/7 Transfiya. Tabla de bancos con **Nequi (507) y Daviplata (551)**. Llaves Bre-B: celular de 10 dígitos que empieza por 3, alias con @, correo o identificación. Mínimo Bre-B 1.000 COP. **[INF]** Nequi y Daviplata se pagan como «banco» con su código; la doc no los describe aparte.
- **[DOC]** FAQ de dLocal: onboarding empieza por ventas; KYC «through your Merchant Dashboard or directly to our compliance team»; modelo **Merchant of Record** para cobros transfronterizos; «collect locally in each market and settle crossborder in USD/EUR»; costos = porcentaje por transacción + spread de cambio + «setup and monthly account fees». **[OBS]** BigCommerce menciona un mínimo de 70.000 USD mensuales; Guía de Software dice «comisiones negociadas (4-6% típico)». **[NV]** tarifa real de Colombia, tiempos de liquidación.
- **[INF]** dLocal es el único candidato que, por diseño, **contrata con una empresa extranjera (Windoce LLC) y liquida en dólares**, sin NIT colombiano; a cambio exige volumen, contrato comercial y cobra más.

### 2.6 Stripe

- **[DOC]** stripe.com/global: Colombia **no** está en «Stripe is currently supported in the following countries/regions». De Latinoamérica solo Brasil y México.
- **[DOC]** Connect cross-border payouts: «Platforms based in the US, UK, EEA, Canada, or Switzerland can transfer funds to connected accounts in any of those regions». «Stripe doesn't support self-serve cross-border payouts to countries outside the listed regions. Contact sales to discuss alternatives, or use Global Payouts.» No se puede usar con cuentas bajo «recipient service agreement». Precio «Starting at 0.25% of payout volume».
- **[DOC]** Formatos de cuenta bancaria de Connect: existe formato para Colombia (código de banco de 3 dígitos, cuenta de 9 a 16 dígitos, ahorros o corriente) pero «Colombia is only available for Cross-border payouts accounts», y esas cuentas no están disponibles en autoservicio fuera de las regiones listadas. **[INF]** Se obtiene solo negociando con ventas de Stripe.
- **[DOC]** Global Payouts: disponible para empresas en **US y GB**; «requires Treasury»; «best for businesses that already hold the Money Transmitter License (MTL) required to move money themselves»; con Global Payouts «Manage your own legal and compliance requirements. This might require a Money Transmitter license if you manage your customers' funds». Changelog del 25 de marzo de 2026: «Adds support for Global Payouts recipient bank accounts in Argentina, **Colombia**, and Egypt» (`co_bank_account`, vía OutboundSetupIntents y OutboundPayments, API en preview). **[NV]** Colombia no aparece todavía en la tabla pública de «Recipient requirements» (sender US); el costo por pago a Colombia y los requisitos de identidad del repartidor no están publicados.
- **[DOC]** Precios de Connect: «0.25% + 25¢ per payout sent» en el modelo donde la plataforma fija precios; no detalla destinos internacionales.
- **Conclusión para Tumbite:** cobrar en Colombia con Stripe: **no**. Pagar a un repartidor colombiano con Connect Express desde Windoce LLC (EE.UU.): **no en autoservicio**. Pagar con Global Payouts: posible en teoría desde abril de 2026, pero exige Treasury, posiblemente licencia MTL y se paga desde saldo en dólares con cambio a pesos: **[INF]** no es el camino para un marketplace que cobra en pesos.

### 2.7 Cómo cobran hoy Rappi y DiDi Food en Colombia

**Rappi**

- **[OBS]** Cuenta oficial de soporte de Rappi Colombia en X (mensaje de 2023): «los medios de pagos que tenemos disponibles son los siguientes: RappiPay, RappiCard, Crédito, Débito, Nequi, Efectivo, Apple pay, PSE e Internacional». Tiene más de tres años.
- **[OBS]** Ayuda de Nequi: pagar con Nequi en Rappi se hace vinculando la cuenta desde «Cuenta > Métodos de pago» y aprobando desde la app de Nequi en 15 minutos; se debita del saldo (push de Nequi, no PSE).
- **[OBS]** merchants.rappi.com (página para restaurantes): recomienda «Activa Nequi y Daviplata primero» para pedidos pequeños, PSE para débito desde cuenta y tarjetas con 3D Secure para pedidos grandes. «Al operar en Rappi recibes el pago de tus ganancias frecuentemente», sin plazos.
- **[OBS]** Efectivo: guías de terceros dicen que se elige «efectivo» al pagar y se entrega el monto exacto al repartidor. **[NV]** reglas vigentes de efectivo (límites, bloqueo a usuarios nuevos).

**DiDi Food**

- **[DOC]** Guía de métodos de pago para usuarios (web.didiglobal.com/co/food, actualizada 24/7/2023): «los usuarios pueden pagar sus pedidos con tarjeta de crédito/débito o en efectivo».
- **[DOC]** Guía para restaurantes «Paso a paso para habilitar el pago en efectivo»: «todos los restaurantes reciben pagos mediante tarjeta y en efectivo» por defecto; «los pagos en efectivo serán entregados por el repartidor al restaurante»; los pagos con tarjeta se consignan «semanalmente los martes» a la cuenta bancaria del restaurante; **CashBlock** limita a pagos virtuales (DiDi también lo activa si el restaurante acumula comisiones pendientes por efectivo); **Prepay**: el cliente paga en efectivo al repartidor, el restaurante no recibe ese dinero del repartidor y se le consigna semanalmente descontando comisiones.
- **[DOC]** Guía para repartidores «Pagos en efectivo»: el repartidor **paga el pedido en el restaurante** y cobra al cliente; si hay cupón, el monto a cobrar puede ser menor y la plataforma «te depositaría lo restante a tu billetera de repartidor»; conviene salir con efectivo para dar cambio. Si la billetera del repartidor no alcanza, debe pagar en efectivo en la tienda; no se puede rechazar el método de pago porque «los pedidos en efectivo y con tarjeta tienen la misma proporción».
- **[OBS]** Prensa 2019-2021: el efectivo era el principal medio de pago en apps de domicilio en Colombia (nueve de cada diez pedidos de iFood); en Rappi cayó más de 42 % entre 2020 y 2021. **[INF]** El efectivo sigue siendo obligatorio en Colombia para competir, con mecanismos de control (bloqueo, prepago, cuadre con el repartidor).

### 2.8 Regulación colombiana: ¿Tumbite necesita licencia?

- **[DOC]** Decreto 1692 de 2020 (modifica el Decreto 2555 de 2010 sobre sistemas de pago de bajo valor): abre la **adquirencia** a sociedades no vigiladas con registro ante la Superintendencia Financiera; requisitos: sociedad anónima, capital pagado de al menos 1.700 salarios mínimos, fondos de los comercios separados de los propios, capital anual de al menos 2 % de los fondos recibidos, y «mecanismos para obligar al adquirente no vigilado a trasladar los fondos recibidos de la liquidación» a sus usuarios. Las «pasarelas de pago» quedan como «proveedores de servicios de pago» y no son participantes del sistema.
- **[OBS]** Accounter (artículo jurídico): la actividad de **agregador** «no está limitada a las entidades financieras», cualquier sociedad comercial con ese objeto puede ejercerla. OnePay (fuente comercial): opera «como agregador de pagos bajo el Decreto 1692 de 2020, sin ser una entidad vigilada», recibiendo y dispersando el dinero bajo «contrato de mandato».
- **[INF]** Tumbite **no** sería adquirente ni pasarela: contrata a un agregador/adquirente registrado (Wompi, PayU, ePayco, Mercado Pago) que recauda y abona. Lo que sí toca es que Tumbite reciba dinero de clientes y pague a restaurantes y repartidores: eso es un contrato de mandato o de marketplace, como hacen Rappi y DiDi, y el dinero pasa por cuentas en entidades vigiladas. **[NV]** Si retener el saldo del restaurante en una «billetera» propia (como hoy hace Tumbite con el libro de movimientos) tiene límites en Colombia. Esto lo debe confirmar un abogado colombiano; no se encontró norma pública que lo prohíba ni que lo permita de forma expresa.
- **[DOC]** Impuestos que afectan el flujo: 4x1000 (GMF) sobre movimientos bancarios (ePayco lo menciona en «Pagos Divididos»); retenciones sobre ventas con tarjeta (ePayco lista reteIVA, reteRenta 1,5 % y reteICA). **[NV]** cómo aplica a una empresa extranjera sin NIT.

---

## 3. Comparación con Tumbite (lo que hay hoy)

Según `VERIFICAR-PAGOS.md` y `docs/REQUISITOS.md`:

| Pieza de Tumbite hoy                     | Cómo funciona (Stripe, EE.UU.)                                                                                                                         | Qué cambia para Colombia                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cobro al cliente                         | PaymentIntent con `capture_method: manual`, autorizar al pedir y capturar al entregar, tarjeta guardada para propina (`off_session`), Apple/Google Pay | Ningún proveedor colombiano documenta autorizar-y-capturar para PSE, Nequi o Daviplata: esos métodos **cobran de una vez** y son asíncronos (push, redirección, OTP). Solo tarjetas podrían seguir el flujo actual (PayU documenta dos pasos «on request»; Wompi no lo documenta). Hay que tener un modo «cobro inmediato + reembolso» para Colombia. |
| Aviso del procesador                     | Webhook de Stripe con firma, idempotencia por id de evento, evento `payment_intent.amount_capturable_updated`                                          | Wompi: evento `transaction.updated` con checksum SHA256 y reintentos 3 veces en 24 h. PayU: página de confirmación. Mercado Pago: notificaciones IPN/webhooks. El servidor necesita una capa «procesador» con un adaptador por proveedor.                                                                                                             |
| Billetera de restaurantes y repartidores | Stripe Connect Express, libro de movimientos, retiro a banco (Fase 0)                                                                                  | Stripe Connect **no llega a Colombia**. La billetera se queda igual (libro propio); el retiro se ejecuta con la API de dispersiones de Wompi (`POST /payouts`) o de dLocal (payouts Colombia), a banco, Nequi, Daviplata o Bre-B.                                                                                                                     |
| Efectivo                                 | No existe (todo es tarjeta)                                                                                                                            | Obligatorio en Colombia (Rappi y DiDi lo aceptan). Hace falta: pedido «pagar en efectivo», el repartidor cobra y cuadra, control de deuda del repartidor/restaurante (DiDi: CashBlock, Prepay), tope por pedido.                                                                                                                                      |
| Moneda                                   | Centavos de dólar                                                                                                                                      | Pesos colombianos sin decimales (Wompi y PayU usan centavos enteros en la API; dLocal usa 0 decimales). `packages/compartido` ya maneja enteros: hay que agregar moneda por país.                                                                                                                                                                     |
| Conciliación diaria                      | Compara Stripe con la base                                                                                                                             | Hay que conciliar por proveedor, incluyendo los reembolsos que PayU no puede hacer en PSE.                                                                                                                                                                                                                                                            |
| Sandbox                                  | Stripe test mode                                                                                                                                       | Wompi, PayU, Mercado Pago y dLocal tienen sandbox público; ePayco también. Staging puede conectarse a cualquiera sin dinero real.                                                                                                                                                                                                                     |

**Brechas de contratación:** ningún candidato local documenta aceptar una LLC de EE.UU. sin NIT. Las tres opciones realistas son: (a) una S.A.S. colombiana de Windoce (NIT, RUT, cuenta bancaria colombiana, representante legal); (b) dLocal como Merchant of Record contratando con Windoce LLC y liquidando en dólares (volumen mínimo y tarifas negociadas); (c) un socio franquiciado colombiano que contrate la pasarela y reciba el dinero (coherente con el modelo de franquicias ya construido).

---

## 4. Decisión recomendada

**Orden de candidatos y por qué:**

1. **Wompi (Bancolombia): primero.** Es el único con cobros de todos los métodos pedidos (tarjeta, PSE, Nequi push, Botón y QR Bancolombia, Daviplata, efectivo en corresponsales) **y** una API de dispersiones a banco, Nequi y Daviplata, con sandbox, webhooks firmados e idempotencia documentados. Requiere entidad colombiana con RUT y, para abonos rápidos, cuenta Bancolombia (el banco más grande del país y dueño de Nequi). Riesgos: tarifas oficiales no leídas, contracargos sin página pública, Botón y QR solo para persona natural (bien para clientes, no para pagar a restaurantes).
2. **dLocal: segundo, y primero si Richard no quiere abrir empresa en Colombia.** Contrata con Windoce LLC, cobra en pesos y liquida en dólares, tiene Nequi push, PSE, Bre-B y Efecty, y payouts a banco, Bre-B, Nequi y Daviplata. Riesgos: sin Daviplata como cobro, volumen mínimo y tarifas negociadas (sin cifra pública), spread de cambio.
3. **PayU: tercero.** Cobertura de cobros completa (incluye Bre-B QR y efectivo) y sandbox muy documentado, pero sin API pública de dispersión y con la limitación de no reembolsar PSE. Útil como respaldo de tarjetas.
4. **ePayco: cuarto.** Tiene Daviplata, efectivo y «Pagos Divididos» para repartir entre beneficiarios; precios publicados. Falta ver si el split llega a Nequi/Daviplata de un repartidor persona natural y si el modelo agregador admite miles de beneficiarios.
5. **Mercado Pago: quinto.** Precios claros (2,79 a 3,29 % + 800 + IVA), Split 1:1 en Colombia, pero Nequi solo vía PSE y el split parece limitado a saldo de cuenta Mercado Pago; no dispersa a Nequi ni Daviplata.
6. **Stripe: descartado para Colombia.** No cobra en Colombia y Connect no paga a Colombia en autoservicio; Global Payouts exige Treasury y posiblemente licencia de transmisor de dinero. Se mantiene para EE.UU.

**Arquitectura que se propone (sin construir todavía):**

- Una interfaz `Procesador` en `apps/servidor` con dos implementaciones: `stripe` (EE.UU., como hoy) y `wompi` (Colombia), elegida por el país de la franquicia/zona. Más adelante `dlocal` con la misma interfaz.
- Para Colombia el pedido se cobra **al confirmar** (no al entregar), porque PSE, Nequi y Daviplata no autorizan; la cancelación devuelve con reembolso. Para tarjeta se puede mantener autorizar-y-capturar si el proveedor lo confirma por escrito.
- Pedidos en efectivo como método propio: el repartidor cobra, el saldo del repartidor queda en negativo por lo cobrado y se compensa con sus ganancias o con un pago suyo (patrón DiDi), con tope por pedido y bloqueo automático de efectivo cuando la deuda pasa de un límite (patrón CashBlock).
- Retiros de restaurantes y repartidores por la API de dispersiones del proveedor, con la misma billetera y conciliación de hoy; Nequi y Daviplata como «bancos» con su código.
- Todo en staging con los sandbox públicos; nada en producción hasta que haya contrato, cuenta y pruebas de punta a punta por método y moneda (regla de pagos).

---

## 5. Tabla resumen

| Proveedor        | Contrata con empresa extranjera                      | Cobros: tarjeta / PSE / Nequi / Daviplata / efectivo / Bancolombia QR  | Costo público                                                                                       | Fondos disponibles                                         | Reembolsos / contracargos                                | Sandbox + webhooks                       | Dispersión a terceros                                                                                                                     | Ambiente marketplace                       |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Wompi**        | [NV]; pide RUT y representante legal                 | ✅ / ✅ / ✅ push / ✅ OTP / ✅ corresponsales / ✅ (persona natural)  | [OBS] 2,65 % + 700 + IVA general; QR 1 %; por método [NV]                                           | [OBS] siguiente día hábil o hasta 180 días en cuenta Wompi | Reembolsos V2 (sandbox); contracargos [NV]               | ✅ sandbox, eventos firmados, reintentos | ✅ API `/payouts` a banco, Nequi, Daviplata; Bre-B próximamente; costo [NV]                                                               | Agregador registrado; Tumbite solo cliente |
| **dLocal**       | ✅ Merchant of Record, liquida USD                   | ✅ / ✅ / ✅ push, QR / ❌ / ✅ Efecty, Bancolombia / ❌ (Bre-B QR sí) | [NV] negociado; [OBS] 4-6 %                                                                         | [NV]                                                       | Parciales y múltiples según método                       | ✅                                       | ✅ banco, Bre-B, Nequi (507), Daviplata (551), COP o USD                                                                                  | Cross-border; MoR                          |
| **PayU**         | [NV]; cuenta bancaria «en el domicilio del comercio» | ✅ / ✅ / ✅ / [NV] / ✅ / Bre-B QR ✅                                 | [OBS] 3,29 % + 300 (mín. 450) antes de IVA; otras fuentes 2,99 % + 700                              | [OBS] 3 días hábiles; 3 retiros gratis al mes              | Reversa tarjeta, **no PSE**; fraude lo asume el comercio | ✅ muy documentado                       | ❌ no pública                                                                                                                             | Agregador local                            |
| **ePayco**       | [NV]; pide RUT y Cámara de Comercio                  | ✅ / ✅ / [NV] / ✅ / ✅ Efecty, Baloto, Gana / ❌                     | [DOC] 2,64 % + 690 (Davivienda) o 3,29 % + 700 + IVA; PSE < 60.000: 2.000 + IVA; retiro 6.500 + IVA | Agregador: inmediato; Gateway: 24-72 h                     | Reversiones solo con tarjeta de crédito                  | ✅                                       | «Pagos Divididos» (split a varios beneficiarios); payout suelto [NV]                                                                      | Agregador o Gateway                        |
| **Mercado Pago** | [NV]; pide NIT                                       | ✅ / ✅ / solo vía PSE / ❌ / ✅ Efecty / ❌                           | [DOC] 3,29 % (al momento), 2,99 % (7 d), 2,79 % (14 d) + 800 + IVA                                  | Al momento, 7 o 14 días según tarifa                       | [NV]                                                     | ✅                                       | Split 1:1 (marketplace_fee / application_fee); no a Nequi/Daviplata                                                                       | PSP para marketplaces                      |
| **Stripe**       | ✅ (Windoce LLC ya)                                  | ❌ no opera en Colombia                                                | —                                                                                                   | —                                                          | —                                                        | ✅                                       | Connect: ❌ a Colombia en autoservicio. Global Payouts: Colombia desde mar-2026, requiere Treasury y posible MTL; 0,25 % + 25¢ en Connect | Solo EE.UU.                                |

Leyenda: ✅ documentado, ❌ no existe o no aplica, [NV] no verificable en fuentes públicas, [OBS] cifra de terceros o prensa.

---

## 6. Pruebas de aceptación (para cuando se construya)

Todas en staging, con sandbox del proveedor, sin dinero real.

1. **Cobro por método:** un pedido pagado con tarjeta, uno con PSE, uno con Nequi push, uno con Daviplata (OTP) y uno con QR Bancolombia en sandbox de Wompi; cada uno termina en `APPROVED` por webhook con checksum válido, y el pedido pasa a «pagado» una sola vez aunque el evento llegue tres veces.
2. **Evento inválido:** un webhook con checksum alterado no cambia el pedido y queda en el log de errores y en el canario `/datos/salud`.
3. **Declinado y vencido:** un pago `DECLINED` deja el pedido en «pago pendiente» con mensaje claro al cliente; un push de Nequi sin responder vence y el pedido se cancela solo.
4. **Reembolso:** cancelar un pedido pagado con tarjeta genera reembolso total en sandbox; con PSE en un proveedor que no reembolsa (PayU), el sistema lo marca como «devolución manual pendiente» y lo muestra al superadmin.
5. **Efectivo:** pedido en efectivo de 60.000 COP: el repartidor lo marca cobrado; su saldo baja por el valor del plato y sube por su ganancia; al superar el tope de deuda, no recibe más pedidos en efectivo hasta pagar.
6. **Dispersión:** retiro de un restaurante a cuenta Bancolombia y de un repartidor a Nequi por `POST /payouts` en sandbox; la misma clave de idempotencia repetida no crea un segundo pago; el estado final llega por webhook y la conciliación cuadra.
7. **Moneda:** los montos en COP viajan como enteros sin decimales en la API y se muestran con separador de miles en la app; ningún cálculo usa decimales.
8. **Canario:** `/datos/salud` reporta `wompi` y `webhookWompi` en `ok` o `pendiente` igual que hoy con Stripe.
9. **Prueba de humo real (antes de anunciar):** una compra real por cada método y una dispersión real a Nequi y a banco, miradas en el panel del proveedor hasta el abono, como manda la regla de pagos.

---

## 7. Lo que solo Richard puede dar

- **Decisión de entidad:** abrir una S.A.S. colombiana (NIT, RUT, representante legal, cuenta bancaria, idealmente Bancolombia), o contratar dLocal como Merchant of Record desde Windoce LLC, o dejar que un franquiciado colombiano contrate la pasarela. Sin esto no se puede abrir ninguna cuenta.
- **Cuentas y documentos legales:** RUT y certificado de Cámara de Comercio de la entidad colombiana, cédula del representante legal, certificación bancaria reciente, beneficiarios finales.
- **Cuenta bancaria colombiana** (Bancolombia para Wompi; cualquiera para los demás) y su titular.
- **Decisiones de dinero:** si Tumbite acepta efectivo en Colombia y con qué tope por pedido; quién asume el 4x1000 y las retenciones; comisión por servicio en pesos; si se cobra al confirmar o al entregar en Colombia; plazo de liberación en Mercado Pago si se usara (afecta la tarifa).
- **Abogado colombiano:** confirmación de que retener saldos de restaurantes y repartidores en la billetera de Tumbite y pagarlos después no requiere registro ante la Superintendencia Financiera, y del tratamiento tributario de una empresa extranjera.
- **Contacto comercial:** solicitar a Wompi (y a dLocal como alternativa) la tarifa por método, el costo de dispersión, la política de contracargos y si aceptan empresa extranjera; esas páginas no son públicas o devolvieron bloqueo.

---

## 8. Fuentes (nombre y dirección)

- Wompi, guía de métodos de pago: https://docs.wompi.co/docs/colombia/metodos-de-pago/
- Wompi, ambientes y llaves: https://docs.wompi.co/docs/colombia/ambientes-y-llaves/
- Wompi, eventos (webhooks): https://docs.wompi.co/docs/colombia/eventos/
- Wompi, inicio rápido: https://docs.wompi.co/docs/colombia/inicio-rapido/
- Wompi, API de pagos a terceros: https://docs.wompi.co/en/docs/colombia/introduccion-pagos-a-terceros/
- Wompi, qué es pagos a terceros: https://docs.wompi.co/en/docs/colombia/que-es-pagos-a-terceros/
- Wompi, crear cuenta empresarial (PDF): https://www.wompi.com/assets/downloadble/crear_cuenta_empresarial.pdf
- Wompi, tarifas (bloqueada al consultar): https://wompi.com/es/co/tarifas/
- Enter.co, Wompi baja la tarifa del QR al 1 %: https://www.enter.co/?p=587327
- La República, Wompi modalidad de gestión de pagos (abril 2026): https://www.larepublica.co/finanzas/wompi-lanzo-modalidad-de-gestion-de-pagos-para-negocios-segun-su-ritmo-operativo-4382642
- Bancolombia, sala de prensa, negocios ganan autonomía con Wompi: https://www.bancolombia.com/acerca-de/sala-prensa/noticias/innovacion/administrar-dinero-de-ventas-virtuales-wompi
- Wompi, app en Shopify: https://apps.shopify.com/wompi-pagos?locale=es
- Wompi, ebook sobre estafas: https://wompi.co/assets/downloadble/EbookEstafa.pdf
- PayU, probar la solución (sandbox): https://developers.payulatam.com/latam/en/docs/getting-started/test-your-solution.html
- PayU, API de pagos Colombia: https://developers.payulatam.com/latam/en/docs/integrations/api-integration/payments-api-colombia.html
- PayU, términos y condiciones para comercios: https://legal.payulatam.com/ES/terminos_y_condiciones_comercios.html
- PayU, política de reversiones y contracargos (PDF): https://latam.payu.com/hubfs/POL%C3%8DTICA%20DE%20REVERSIONES%20Y%20CONTRACARGOS%20(VF).pdf
- PayU, tarifas en Latinoamérica (no accesible al consultar): https://corporate.payu.com/?p=36826
- Mercado Pago, checkout para sitio web (costos): https://www.mercadopago.com.co/herramientas-para-vender/check-out
- Mercado Pago, changelog (PSE en Checkout API): https://www.mercadopago.com.co/developers/en/changelog
- Mercado Pago, PSE en Checkout API: https://www.mercadopago.com.co/developers/en/docs/checkout-api/integration-configuration/pse
- Mercado Pago, IVA en Colombia: https://www.mercadopago.com.co/developers/es/docs/checkout-pro-preferences/additional-settings/iva-colombia
- Mercado Pago, Split de Pagos 1:1: https://www.mercadopago.com.co/developers/es/docs/split-payments/split-1-1/overview
- Mercado Pago, integrar marketplace (versión Chile): https://www.mercadopago.cl/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- IsDown, incidentes Mercado Pago Nequi vía PSE: https://isdown.app/status/mercadopago/incidents/657244-colombia-pse-high-error-rate-in-approval-of-nequi-transactions
- ePayco, tarifas: https://epayco.com/tarifas/
- ePayco, SDK Node (split): https://github.com/roberto-epayco/epayco-node
- ePayco, SDK Python (split): https://github.com/ma1onso/epayco-python
- La República, ePayco y el 4x1000 (Pagos Divididos): https://www.larepublica.co/finanzas/epayco-lanzo-una-nueva-herramienta-empresarial-para-el-pago-del-impuesto-4x1000-4368706
- dLocal, métodos de pago Colombia (payins): https://docs.dlocal.com/api-documentation/payins-api-reference/payment-methods/colombia
- dLocal, payouts Colombia: https://docs.dlocal.com/docs/colombia-payouts
- dLocal, FAQ soluciones: https://www.dlocal.com/faqs/faqs-solutions
- BigCommerce, conectar con dLocal (requisitos de terceros): https://support.bigcommerce.com/articles/en_US/Knowledge/Connecting-with-dLocal
- Stripe, países soportados: https://stripe.com/global
- Stripe, Connect cross-border payouts: https://docs.stripe.com/connect/cross-border-payouts
- Stripe, Global Payouts: https://docs.stripe.com/global-payouts
- Stripe, requisitos de destinatarios de Global Payouts: https://docs.stripe.com/global-payouts/recipient-requirements
- Stripe, changelog 25 mar 2026 (Colombia en Global Payouts): https://docs.stripe.com/changelog/dahlia/2026-03-25/cross-border-payouts-new-countries
- Stripe, cuentas de pago de cuentas conectadas (formato Colombia): https://docs.stripe.com/connect/payouts-bank-accounts
- Stripe, precios de Connect: https://stripe.com/connect/pricing
- Rappi Colombia, soporte en X (lista de medios de pago, 2023): https://x.com/RappiColombia/status/1663919641704398849
- Rappi, pagos digitales para restaurantes: https://merchants.rappi.com/es-co/pagos-digitales-envios-domicilio
- Nequi, cómo pagar con Nequi en Rappi: https://ayuda.nequi.com.co/hc/es/articles/34002064141453
- DiDi Food Colombia, habilitar pago en efectivo (restaurantes): https://web.didiglobal.com/co/food/restaurantes/guias/paso-a-paso-para-habiliar-el-pago-en-efecitvo-para-tus-pedidos/
- DiDi Food Colombia, métodos de pago (usuarios): https://web.didiglobal.com/co/food/blog/metodos-de-pago-en-didi-food/
- DiDi Food Colombia, pagos en efectivo (repartidores): https://web.didiglobal.com/co/food/repartidores/preguntas-frecuentes/pagos-en-efectivo/
- La República, nueve de cada diez usuarios de iFood pagan en efectivo: https://www.larepublica.co/consumo/nueve-de-cada-10-usuarios-de-la-app-ifood-pagan-sus-domicilios-en-efectivo-2863200
- Función Pública, Decreto 1692 de 2020: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=153787
- CCCE, comunicado sobre el Decreto 1692 de 2020: https://ccce.org.co/noticias/comunicado-oficial-decreto-1692-de-2020-sistemas-de-pago-de-bajo-valor/
- Accounter, el rol de los adquirentes y los agregadores: https://accounter.co/noticias/actualidad/asuntos-legales-el-rol-de-los-adquirentes-y-los-agregadores-en-los-pagos-electronicos
- OnePay (fuente comercial), agregador de pagos y Decreto 1692: https://www.onepay.la/blog/agregador-de-pagos-colombia-decreto-1692-2020
- Guía de Software (comparativa de terceros, sept. 2026): https://www.guiadesoftware.com/blog/mejor-pasarela-pago-colombia
- Affirma Legal, cuenta bancaria para empresa extranjera en Colombia: https://www.affirmalegal.com/blog/como-abrir-cuenta-bancaria-para-empresa-extranjera-en-colombia/
