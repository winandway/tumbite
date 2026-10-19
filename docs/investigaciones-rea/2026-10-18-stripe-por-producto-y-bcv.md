# Stripe producto por producto en Colombia y Venezuela, sanciones de EE. UU. y la regla del BCV

**Fecha:** 18 de octubre de 2026. **Quién pidió:** Richard. **Para qué:** saber, con fuente, qué puede hacer Windoce LLC (cuenta de Stripe en EE. UU.) en Colombia y en Venezuela, y si es cierta la afirmación interna «en Venezuela solo el cobro directo es viable sin licencia del BCV».
**Método:** solo documentación oficial y fuentes públicas. No se abrió ninguna cuenta, no se inició sesión y no se movió dinero. Se descargó y leyó el texto de la Resolución 18-12-01 del BCV y del Decreto 1692 de 2020 de Colombia.
**Etiquetas:** [DOC] fuente oficial (Stripe, BCV, OFAC, Función Pública, SFC, FinCEN) · [OBS] prensa, despacho de abogados o tercero · [INF] inferencia nuestra · [NV] no verificable con lo encontrado.

> Esto no es asesoría legal. Todo lo marcado [INF] y todo lo de la sección «Qué debe validar un abogado» tiene que confirmarlo un abogado colombiano, uno venezolano y uno de sanciones en EE. UU. antes de mover dinero.

---

## 1. Tabla resumen «Producto × país»

| Producto de Stripe (desde la cuenta de EE. UU. de Windoce)                    | Colombia                                                                                                                                                                                                                                                                                                                            | Venezuela                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir una cuenta de Stripe en el país (comercio local)                        | **No disponible**: no está en la lista de países de Stripe [DOC] stripe.com/global                                                                                                                                                                                                                                                  | **No disponible** [DOC] stripe.com/global                                                                                                                                                                                                                                                                                                                                   |
| Cobrar con tarjeta a clientes de ese país desde la cuenta de EE. UU.          | **Disponible**: tarjeta internacional, 2,9 % + 30 ¢ + 1,5 % internacional + 1 % si hay conversión [DOC] precios                                                                                                                                                                                                                     | **Con restricciones**: Stripe no bloquea Venezuela como jurisdicción (su lista prohibida es Cuba, Irán, Corea del Norte, Siria, Crimea, Donetsk, Luhansk) [DOC], pero aplica el filtro OFAC y muchas tarjetas venezolanas tienen cupo internacional limitado [OBS]; si el banco emisor es estatal (Banco de Venezuela, Banco del Tesoro) entra la Licencia General 57 [OBS] |
| Moneda de presentación local                                                  | **Disponible: COP** (en la lista de monedas de una cuenta de EE. UU.; mínimo 0,50 COP equivalente; **American Express no acepta COP**) [DOC]                                                                                                                                                                                        | **No disponible: VES/VEF no están** en la lista de monedas de presentación; se cobra en USD [DOC]                                                                                                                                                                                                                                                                           |
| Métodos locales (PSE, Nequi, Daviplata, Pago Móvil, C2P)                      | **No disponible** [DOC] (estudio previo, tabla de métodos de Stripe)                                                                                                                                                                                                                                                                | **No disponible** [DOC]                                                                                                                                                                                                                                                                                                                                                     |
| Recarga de saldo prepago del repartidor con su tarjeta                        | **Con restricciones**: técnicamente es un cobro normal; aceptable para Stripe si es crédito propio de circuito cerrado [INF]; en Colombia, riesgo de «captación» si el saldo se devuelve en dinero [DOC SFC]                                                                                                                        | **Con restricciones**: mismo cobro en USD; la regla del BCV excluye los «esquemas de prepago de servicios» [DOC]; queda el filtro OFAC y el cupo de la tarjeta [OBS]                                                                                                                                                                                                        |
| Cuenta conectada Connect (Express/Custom) con acuerdo «full» (cobra tarjetas) | **No disponible** (Colombia solo admite acuerdo «recipient») [DOC]                                                                                                                                                                                                                                                                  | **No disponible** (Venezuela no está en ninguna lista de Connect ni en los formatos bancarios) [DOC]                                                                                                                                                                                                                                                                        |
| Cuenta conectada con acuerdo «recipient»                                      | **Con restricciones**: existe (Express o sin panel, solo «transfers»), pero «Colombia is only available for Cross-border payouts accounts» y el transfronterizo fuera de EE. UU./UK/EEE/CA/CH **no es de autoservicio** [DOC]                                                                                                       | **No disponible** [DOC]                                                                                                                                                                                                                                                                                                                                                     |
| Connect «cross-border payouts»                                                | **No disponible en autoservicio**: solo entre EE. UU., UK, EEE, Canadá y Suiza; fuera de ahí «contact sales… or use Global Payouts»; y **no se puede usar con cuentas «recipient»** [DOC]                                                                                                                                           | **No disponible** [DOC]                                                                                                                                                                                                                                                                                                                                                     |
| Global Payouts (pagar a un banco sin cuenta de Stripe)                        | **Con restricciones / vista previa**: el changelog del 25 de marzo de 2026 agrega cuentas bancarias de Colombia en la versión de API «preview», pero la tabla oficial de requisitos para remitente de EE. UU. **no lista Colombia**; exige Treasury y Stripe dice que es para quien ya tiene licencia de transmisor de dinero [DOC] | **No disponible**: Venezuela no aparece [DOC]                                                                                                                                                                                                                                                                                                                               |
| Pago a cuenta bancaria local en moneda local (COP / VES)                      | **No verificable** en autoservicio; solo por la vía de vista previa de Global Payouts [DOC]/[NV]                                                                                                                                                                                                                                    | **No disponible** por Stripe; solo con banco venezolano y empresa local [DOC]/[OBS]                                                                                                                                                                                                                                                                                         |
| Pagos en stablecoin (USDC) de Global Payouts                                  | Disponible para empresas de EE. UU. (salvo Nueva York) a billeteras «anywhere in the world» [DOC]; encuadre legal en Colombia [NV]                                                                                                                                                                                                  | Mismo texto de Stripe [DOC], pero el BCV prohibió pagos en divisas por no bancarios y la mayoría de licencias OFAC excluyen pagos en moneda digital [DOC]/[OBS]; **no usar** [INF]                                                                                                                                                                                          |

---

## 2. Colombia, producto por producto

### 2.1 Cobros

- [DOC] Colombia no figura en «Stripe is currently supported in the following countries»; de Latinoamérica solo están Brasil y México. Windoce no puede tener «cuenta Stripe Colombia».
- [DOC] Una cuenta de EE. UU. puede cobrar tarjetas emitidas en Colombia como tarjetas internacionales: 2,9 % + 30 ¢, más 1,5 % por tarjeta internacional, más 1 % si hay conversión de moneda.
- [DOC] COP está en la lista de monedas de presentación de una cuenta de EE. UU. COP figura entre las monedas que American Express no admite. El importe máximo en métodos no tarjeta es de 10 dígitos para COP.
- [INF] Cobrar en COP desde EE. UU. no convierte a Stripe en adquirente colombiano: el cobro se liquida en EE. UU. y Tumbite recibe dólares. El cliente puede pagar comisión de su banco por compra internacional.
- [DOC] Restricciones: la lista de negocios restringidos de Stripe aplica en todo el mundo (no menciona el reparto de comida). Lo relevante para Tumbite: «Payment facilitation and aggregation» es restringido, y está prohibido «facilitate transactions on behalf of another undisclosed merchant».

### 2.2 Recargas del repartidor

- [INF] Para Stripe, cobrar a un repartidor para cargar un saldo es un PaymentIntent igual que cualquier otro. La diferencia es de calificación del negocio.
- [DOC] Stripe restringe la «Sale of stored value or credits maintained, accepted, and issued by anyone other than the seller», prohíbe la «Peer-to-peer money transmission» y restringe a «Money transmitters… and other money service businesses».
- [INF] Un saldo que **emite Tumbite y solo sirve para pagar comisiones de Tumbite** es crédito del propio vendedor, de circuito cerrado. Encaja fuera de la restricción. Deja de encajar si el saldo se puede retirar en dinero, transferir a otra persona o usar para pagar a restaurantes.
- [DOC] Del lado de EE. UU., FinCEN excluye del régimen de «prepaid access» el acceso prepago de **circuito cerrado** hasta **2 000 dólares** por dispositivo y por día (31 CFR 1010.100(ff)(4)(iii)(A), según su guía de preguntas frecuentes).
- [DOC] Del lado colombiano, ver la sección 6 (concepto de la SFC sobre prepago y captación).

### 2.3 Cuentas conectadas (Connect)

- [DOC] La herramienta oficial de requisitos de Stripe, para plataforma de EE. UU., admite Colombia **solo con acuerdo «recipient»**, panel Express o ninguno, y solo la capacidad «transfers» (dato del estudio previo, coherente con la página de tipos de acuerdo).
- [DOC] El acuerdo «recipient» no puede procesar pagos ni pedir «card_payments»; las transferencias tardan 24 horas más; Stripe no da soporte directo al receptor.
- [DOC] En la página de formatos bancarios: «Colombia is only available for Cross-border payouts accounts» (código de banco de 3 dígitos, cuenta de 9 a 16 dígitos, ahorros o corriente).
- [DOC] «Cross-border payouts»: las plataformas de EE. UU., UK, EEE, Canadá o Suiza pagan a cuentas conectadas **de esas mismas regiones**. «Stripe doesn't support self-serve cross-border payouts to countries outside the listed regions. Contact sales to discuss alternatives, or use Global Payouts.» Y: «You can't make cross-border payouts to connected accounts under a recipient service agreement. For those accounts, use Global payouts.»
- [INF] Conclusión: una cuenta conectada colombiana se puede **crear**, pero no hay camino de autoservicio para **pagarle**. El camino que Stripe documenta para «recipient» es Global Payouts.

### 2.4 Pagos a destinatarios (Global Payouts)

- [DOC] Global Payouts está disponible para empresas de EE. UU. y UK, exige Treasury y Stripe dice que «is best for businesses that already hold the Money Transmitter License (MTL)». La tabla comparativa dice que con Global Payouts se gestiona el cumplimiento propio, y «This might require a Money Transmitter license if you manage your customers' funds».
- [DOC] Changelog del 25 de marzo de 2026: «Adds support for Global Payouts recipient bank accounts in Argentina, Colombia, and Egypt» (valor «co_bank_account»), en la versión de API «2026-03-25.preview».
- [DOC] La tabla «Recipient requirements» (remitente EE. UU., empresa y persona) consultada hoy **no lista Colombia**.
- [INF] Lectura correcta: Colombia está en Global Payouts **solo en vista previa de API**, no en la lista general. Hay que confirmarlo con Stripe antes de diseñar sobre eso.
- [NV] Comisiones, plazos y si el pago llega en COP por método local o por transferencia internacional.

---

## 3. Venezuela, producto por producto

### 3.1 Cobros

- [DOC] Venezuela no está en la lista de países de Stripe.
- [DOC] La lista de jurisdicciones prohibidas de Stripe es Cuba, Irán, Corea del Norte, Siria y las regiones de Crimea, Donetsk y Luhansk. **Venezuela no está.** Sí están prohibidas las personas bajo sanciones de OFAC.
- [DOC] VES y VEF **no aparecen** en la lista de monedas de presentación de una cuenta de EE. UU. Se cobra en dólares.
- [OBS] Las tarjetas venezolanas para compras en el exterior dependen de cada banco. El Banco de Venezuela asigna una «Tarjeta Internacional» que se activa en su app, con compra de divisas limitada por día (Finanzas Digital, 2026). Otros bancos tienen tarjetas en divisas con límites.
- [OBS] El Banco de Venezuela y el Banco del Tesoro son del Estado. Desde el 14 de abril de 2026 la Licencia General 57 de OFAC autoriza los servicios financieros con el BCV, el Banco de Venezuela, el Banco Digital de los Trabajadores y el Banco del Tesoro, incluidos tarjetas y billeteras (Faegre Drinker, julio de 2026).
- [INF] Cobrar con tarjeta a un cliente venezolano no sancionado es posible. Pero Stripe puede rechazar o revisar por riesgo, y el rechazo de tarjetas venezolanas será alto. **Hay que probarlo en modo prueba y con una compra controlada antes de prometerlo.**

### 3.2 Recargas del repartidor

- [INF] Es un cobro en dólares desde EE. UU., igual que en Colombia, con el mismo análisis de Stripe (crédito propio de circuito cerrado).
- [DOC] La Resolución 18-12-01 del BCV, artículo 19, **excluye** de las reglas de proveedores de servicios de pago a las «empresas con esquemas de prepago de servicios y cupones de descuento».
- [INF] Un saldo que solo paga las comisiones de Tumbite encaja en esa exclusión. No encaja si el saldo se retira, se transfiere o paga a terceros.
- [OBS] SUDEBAN frenó en 2022 la recarga de la billetera de Yummy cuando les cerró las «cuentas recaudadoras» (estudio previo, Bloomberg Línea y NTN24). Ojo: era una billetera de **clientes**, recargada en bolívares en bancos venezolanos, no un saldo de comisiones cobrado desde el exterior.

### 3.3 Cuentas conectadas, transfronterizo y Global Payouts

- [DOC] Venezuela no aparece en Connect (ni en formatos bancarios ni en requisitos), ni en cross-border payouts, ni en la tabla de Global Payouts. **No hay ningún producto de Stripe para pagarle a un venezolano en Venezuela.**

### 3.4 Pagos a destinatarios en VES

- [DOC]/[OBS] Solo por bancos venezolanos (por ejemplo, las API de Mercantil y Activo descritas en el estudio previo), que exigen persona jurídica venezolana con RIF y cuenta.
- [INF] Si Tumbite recauda el dinero del cliente y después lo reparte en bolívares, eso es un «servicio de pago» del BCV (ver sección 5).

---

## 4. Sanciones de EE. UU. (OFAC) sobre Venezuela

- [DOC] Pregunta frecuente 680 de OFAC (actualizada el 9 de enero de 2023): la Orden Ejecutiva 13884 bloquea al **Gobierno de Venezuela** (incluye el BCV, PDVSA, entidades con 50 % o más del Estado y quienes actúan en su nombre), aunque no aparezcan en la lista SDN. **No están prohibidas las transacciones con el país ni con su gente** si no hay personas bloqueadas de por medio.
- [OBS] En 2026 OFAC emitió una serie de licencias generales: la 46 (petróleo, 29 de enero), la 48, 49, 55, 58, la **57 (servicios financieros con BCV, Banco de Venezuela, Banco del Tesoro y Banco Digital de los Trabajadores, 14 de abril)** y la 60 (ayuda por terremotos, hasta el 23 de octubre de 2026). Varias se reemitieron el 10 de junio de 2026 (Morgan Lewis, Baker McKenzie, Faegre Drinker, Foley).
- [OBS] Las órdenes ejecutivas **no se han revocado**. Las licencias pueden retirarse y las sanciones «volver» de golpe (Faegre Drinker, julio de 2026).
- [DOC] La Licencia General 35 (2019) autoriza pagar impuestos, tasas, permisos y licencias al Gobierno de Venezuela cuando son necesarios para las operaciones del día a día, con reportes semestrales. [NV] Su versión vigente en 2026.

**Qué significa para una empresa privada de EE. UU. con una app de comercios y personas venezolanas no vinculadas al Gobierno:**

1. [DOC] Puede tratar con restaurantes, repartidores y clientes privados no bloqueados.
2. [DOC] No puede tratar sin licencia con entidades del Estado ni con empresas en las que el Estado tenga 50 % o más (por ejemplo, una cadena estatal de comida) ni con personas de la lista SDN. Hay que revisar a cada comercio (filtro SDN más dueño), no solo el nombre.
3. [OBS] Si el dinero pasa por bancos estatales, la cobertura viene de la Licencia General 57, que puede cambiar.
4. [INF] Pagar impuestos venezolanos (IVA, IGTF) desde Windoce LLC es una transacción con el Gobierno: hace falta la cobertura de una licencia general (la 35 o la que la reemplace).
5. [OBS] La mayoría de las licencias de 2026 excluyen pagos en moneda digital: no usar cripto.

**Cómo afecta a Stripe:**

- [DOC] Stripe prohíbe a las personas sancionadas por OFAC y aplica su filtro a cada cobro.
- [INF] Stripe puede pedir información, retener fondos o cerrar la cuenta si ve exposición venezolana sin controles. Es un riesgo para **toda** la cuenta de Windoce, también para Miami. Recomendación: Venezuela no se conecta a la cuenta principal de Stripe sin una revisión legal de sanciones escrita.

---

## 5. Venezuela: BCV

### 5.1 Qué norma existe

- [DOC] **Resolución 18-12-01 del BCV** (4 de diciembre de 2018, Gaceta 41.547 del 17 de diciembre de 2018), «Normas Generales sobre los Sistemas de Pago y Proveedores no Bancarios de Servicios de Pago que operan en el país». Es la norma que el BCV sigue listando hoy como vigente en su sección de pagos, junto con la 18-10-02 (comisiones) y la 21-06-01 (liquidación interbancaria).
- [DOC] Definición (artículo 2, número 14): proveedor no bancario es una persona jurídica «autorizada por el Banco Central de Venezuela para prestar **en el país y en moneda nacional**, los servicios de pago».
- [DOC] Servicio de pago (artículo 2, número 16): la «ejecución de orden de transferencia instruida por los usuarios… con cargo a los fondos que mantengan en sus respectivas cuentas».
- [DOC] Artículo 17: toda persona jurídica que preste servicios de pago distintos de los integrados a la infraestructura de los bancos autorizados por SUDEBAN necesita autorización del BCV.
- [DOC] Artículo 23: lo que hace un proveedor autorizado: abrir cuentas, recibir efectivo para abonar, ejecutar transferencias con cargo a una cuenta, recibir pagos para abonar a una cuenta, **«proveer a los clientes de mecanismos para la recepción de pagos»** y remesas en moneda nacional.
- [DOC] Artículo 19: quedan **excluidos** los bancos, quienes tengan ley especial, y «empresas con esquemas de prepago de servicios y cupones de descuento».
- [DOC] Comunicado del BCV de octubre de 2020: no ha autorizado a ningún proveedor no bancario para pagos en divisas; ofrecerlos contraviene la 18-12-01 (prensa: El Universal, estudio previo).
- [OBS] El BCV suspendió por tiempo indefinido nuevos permisos de proveedores no bancarios (Banca y Negocios, 5 de noviembre de 2021). En ese momento había cinco autorizados (Mueve, Vippo, Digo Pagos, Lanzapagos y Pagonet). [NV] Si la suspensión sigue en 2026: el registro público del BCV no mostró resultados al consultarlo hoy, y no se encontró norma nueva.
- [OBS] SUDEBAN, Resolución 001.21 (Gaceta 42.151, junio de 2021): las fintech del sector bancario necesitan autorización previa de SUDEBAN (estudio previo, Acceso a la Justicia).
- [OBS]/[DOC] Pago Móvil, C2P y P2C se prestan dentro de la infraestructura de los bancos (SUDEBAN presentó el C2P; el BCV fija comisiones máximas en su aviso de la Gaceta Extraordinaria 7.073, vigente desde el 15 de septiembre de 2026).
- [OBS] SUNACRIP sigue en reestructuración desde 2023; no aplica a Tumbite si no se toca cripto.

### 5.2 Si un marketplace que solo intermedia sin custodiar fondos cae dentro o fuera

- [INF] **Fuera**, si el cliente paga directo al restaurante o al repartidor (efectivo, Pago Móvil P2P o C2P a la cuenta del propio comercio) y Tumbite solo registra el pedido. No ejecuta órdenes con cargo a fondos de usuarios, no abre cuentas y no recauda.
- [INF] **Fuera también**, probablemente, la mera lectura o confirmación de un pago móvil en la cuenta del propio comercio con la API de su banco: el servicio lo presta el banco.
- [INF] **Dentro**, si Tumbite recauda en bolívares en una cuenta propia o de un tercero y después reparte a restaurantes y repartidores: es «proveer mecanismos para la recepción de pagos» y «ejecutar transferencias». Es exactamente lo que SUDEBAN le cortó a Yummy en 2022 [OBS].
- [INF] **Zona gris razonable**: cobrar en dólares, desde EE. UU. y con Stripe, una tarjeta internacional al cliente o la recarga del repartidor. No es un servicio de pago «en el país y en moneda nacional», y el saldo de comisiones encaja en la exclusión del artículo 19. Pero la norma no habla de cobros desde el exterior y las autoridades venezolanas actúan sobre las cuentas locales, no sobre el texto. Lo confirma un abogado.

### 5.3 Evaluación de la afirmación «en Venezuela, solo el cobro directo es viable sin licencia del BCV»

- **Respaldado [DOC]/[OBS]:** recaudar el dinero del cliente en bolívares y repartirlo exige autorización del BCV (artículos 17 y 23), **Corrección del 19 oct:** el BCV volvió a recibir solicitudes de licencia desde julio de 2022 según su circular (ver `docs/EXPEDIENTE-ABOGADOS-Y-PROVEEDORES.md`); no hay datos públicos de cuántas otorgó. Ningún proveedor no bancario puede procesar pagos en divisas. El caso Yummy lo confirma.
- **Corregido [DOC]/[INF]:** «solo el cobro directo» es demasiado estricto. Hay al menos dos cosas más que, según el texto, quedan fuera de la licencia del BCV: (a) el cobro con tarjeta internacional en dólares, hecho por Windoce desde EE. UU., que no es un servicio de pago en el país en moneda nacional; (b) el saldo prepago del repartidor para pagar las comisiones de Tumbite, que encaja en la exclusión de «esquemas de prepago de servicios» (artículo 19).
- **Sin respaldo [NV]:** que la licencia del BCV sea el único permiso relevante. También cuentan SUDEBAN (fintech, Resolución 001.21), la ley de sanciones de EE. UU. y el registro mercantil y fiscal (RIF, IVA, IGTF) si se opera con establecimiento en Venezuela.
- **Afirmación corregida:** «En Venezuela, Tumbite no puede recaudar ni repartir dinero de clientes en bolívares sin licencia del BCV (que hoy no se otorga). Sí puede, con mucho menos riesgo: cobro directo del cliente al comercio o al repartidor; cobro con tarjeta internacional en dólares por Stripe desde EE. UU., sujeto a OFAC y a la revisión de Stripe; y saldo prepago del repartidor que solo pague comisiones de Tumbite y no se pueda retirar ni transferir.»

---

## 6. Colombia: SFC

- [DOC] **Decreto 1692 de 2020** (modifica el Decreto 2555 de 2010, sistemas de pago de bajo valor). La **adquirencia** (vincular comercios, darles tecnología de acceso, procesar y **abonar al comercio o al agregador** los recursos de las ventas, y gestionar contracargos) la pueden hacer los bancos, las SEDPE y **sociedades no vigiladas** inscritas en el **Registro de Adquirentes no Vigilados** de la SFC.
- [DOC] Requisitos de ese registro: sociedad anónima, capital pagado mínimo de 1 700 salarios mínimos, fondos de los usuarios separados de los propios (alianza con banco o patrimonio autónomo), y desde el primer año capital de al menos el 2 % de los fondos recibidos en doce meses. La SFC decide en máximo dos meses.
- [DOC] **Agregador**: «Proveedor de servicios de pago del adquirente que vincula a los comercios…, le suministra tecnologías de acceso… y recauda en su nombre los fondos». La relación del comercio es directa y única con el adquirente, que responde ante el sistema.
- [OBS] Despachos y fuentes del sector dicen que el agregador no necesita ser entidad vigilada y que «pasarela de pagos» no es una categoría del decreto (Accounter, OnePay).
- [NV] El número de la circular de la SFC que reglamenta el registro (la prensa menciona una Circular Externa de diciembre de 2020) no se pudo leer en esta ficha.
- [INF] Para Tumbite: no hace falta ser adquirente si contrata a uno registrado (Wompi, PayU, ePayco, Mercado Pago). Si Tumbite recauda a nombre de los restaurantes y luego les abona, actúa como agregador o mandatario dentro del contrato de ese adquirente: debe pactarse así por escrito.
- [DOC] **Saldos prepago de repartidores y captación:** el Concepto 2007054433-003 de la SFC (23 de noviembre de 2007) dice que vender bienes o servicios por prepago **no** es el problema siempre que esa sea la única contraprestación por el 100 % del valor. Se acerca a captación cuando se **devuelve dinero**, se permite **retirar efectivo**, o el operador **recibe y administra fondos** para pagar transacciones de terceros. La captación masiva y habitual sin autorización es delito (artículo 316 del Código Penal; definición en el Decreto 1981 de 1988, hoy compilado) [OBS].
- [INF] Por tanto: un saldo que solo paga comisiones de Tumbite, no se retira en dinero y no paga a terceros está del lado seguro. Si el saldo también paga la comida al restaurante, se reembolsa en efectivo o se transfiere, entra en la zona de captación o de depósitos electrónicos (SEDPE). Qué hacer con el saldo que sobra cuando un repartidor se va [NV]: consultar abogado (ley de consumo frente a captación).
- [INF] La custodia de las **ganancias** de restaurantes y repartidores (dinero de terceros que Tumbite retiene y paga después) es otra cosa: es recaudo por mandato. El estudio previo de Colombia ya lo dejó para el abogado.

---

## 7. Contraste con los estudios locales

### 7.1 «Pagos en Colombia» (estudio del 18 de octubre)

| Afirmación                                                                                     | Resultado                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe no sirve para cobrar en Colombia (no está en la lista de países)                        | **Confirmada** en lo de abrir cuenta local. **Matizada**: sí se pueden cobrar tarjetas colombianas, incluso en COP, desde la cuenta de EE. UU. |
| Connect transfronterizo solo llega a EE. UU., UK, EEE, Canadá y Suiza                          | **Confirmada** para autoservicio; fuera de ahí, ventas o Global Payouts                                                                        |
| Formato bancario de Colombia solo para cuentas transfronterizas                                | **Confirmada** con cita literal                                                                                                                |
| Global Payouts posible en teoría desde abril de 2026                                           | **Corregida**: el changelog es del **25 de marzo de 2026** y en versión **preview**; la tabla oficial de destinatarios no lista Colombia hoy   |
| Decreto 1692: adquirentes no vigilados con registro SFC, 1 700 salarios, fondos separados, 2 % | **Confirmada** con el texto del decreto                                                                                                        |
| El agregador no está limitado a entidades financieras                                          | **Confirmada** como [OBS]; el decreto lo define como proveedor del adquirente, sin registro propio [DOC]/[INF]                                 |
| Abogado debe confirmar si retener saldos requiere registro SFC                                 | **Sigue abierta**; se añade el concepto de la SFC de 2007 sobre prepago y captación                                                            |

### 7.2 «Pagos en Venezuela» (estudio del 18 de octubre)

| Afirmación                                                                                            | Resultado                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un intermediario que recibe y paga es proveedor no bancario y necesita autorización del BCV o SUDEBAN | **Confirmada** con los artículos 2, 17 y 23 de la Resolución 18-12-01                                                                                                                                        |
| El BCV prohibió desde 2020 que no bancarios procesen pagos en divisas                                 | **Confirmada** (comunicado de octubre de 2020); sin cambio encontrado en 2026                                                                                                                                |
| Billetera prepagada para clientes necesita licencia                                                   | **Matizada**: el artículo 19 excluye los «esquemas de prepago de servicios»; lo que SUDEBAN frenó a Yummy fue la recaudación en cuentas locales; para clientes con recarga en bolívares el riesgo sigue alto |
| Sanciones OFAC: no investigado ([NV])                                                                 | **Ahora investigado** (sección 4): privados permitidos; Estado bloqueado; licencias 35, 57 y otras; riesgo de revocación                                                                                     |
| Tarjeta internacional vía Stripe como método                                                          | **Confirmada con restricciones**: cobro en USD (VES no existe en Stripe), filtro OFAC y cupos de tarjetas                                                                                                    |
| IGTF, tasa BCV, comisiones de Pago Móvil                                                              | **No revisadas** en esta ficha (fuera del alcance)                                                                                                                                                           |

### 7.3 «Stripe internacional y cobro directo» (estudio del 18 de octubre)

| Afirmación                                                                             | Resultado                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colombia en Connect solo con «recipient», Express o sin panel, solo «transfers»        | **Confirmada** (coherente con tipos de acuerdo y formatos bancarios)                                                                                                                                                                  |
| Fuera de las cinco regiones no es autoservicio; hablar con ventas                      | **Confirmada** con cita literal                                                                                                                                                                                                       |
| No hay transfronterizo para cuentas «recipient»; usar Global Payouts                   | **Confirmada** con cita literal                                                                                                                                                                                                       |
| Colombia no aparece en la tabla de Global Payouts                                      | **Matizada**: no está en la tabla, **pero** el changelog de marzo de 2026 la agrega en la API de vista previa                                                                                                                         |
| Global Payouts exige Treasury y es para quien tiene licencia de transmisor             | **Confirmada** con cita literal                                                                                                                                                                                                       |
| Tarifas 2,9 % + 30 ¢ + 1,5 % + 1 %                                                     | **Confirmada** en la página de precios                                                                                                                                                                                                |
| No hay página de Stripe que bloquee Venezuela para tarjetahabientes                    | **Confirmada**: Venezuela no está en su lista de jurisdicciones prohibidas                                                                                                                                                            |
| Venezuela no aparece en ninguna lista de Stripe                                        | **Confirmada** (países, Connect, formatos bancarios, Global Payouts, monedas)                                                                                                                                                         |
| Recibir recargas y cobrar comisiones sigue siendo dinero de terceros en algunos marcos | **Matizada**: si el saldo solo paga comisiones propias y no se retira, Stripe, FinCEN, el BCV (artículo 19) y la SFC (concepto 2007) lo tratan como prepago de servicios; deja de serlo si se retira, se transfiere o paga a terceros |

---

## 8. Qué debe validar un abogado

**Venezolano:**

1. Que el cobro con tarjeta internacional en USD hecho por una LLC de EE. UU. a un cliente o repartidor venezolano no se considera «servicio de pago en el país».
2. Que el saldo prepago de comisiones del repartidor encaja en la exclusión del artículo 19, y qué pasa con el saldo sobrante.
3. Si leer o confirmar pagos móviles en la cuenta del propio comercio (con su API o con un tercero de solo lectura) necesita alguna autorización.
4. Si sigue vigente la suspensión de permisos de proveedores no bancarios y si hubo circulares después de 2021.
5. Si Tumbite necesita sucursal, RIF, IVA o IGTF por operar la app en Venezuela.

**Colombiano:**

1. Que el saldo de comisiones, no reembolsable en dinero, no es captación ni depósito electrónico.
2. Cómo pactar con el adquirente (Wompi u otro) el recaudo por mandato de las ventas de los restaurantes.
3. El número y contenido de la circular de la SFC sobre el registro de adquirentes no vigilados.

**De sanciones en EE. UU.:**

1. Diligencia mínima sobre comercios y repartidores (SDN y propiedad estatal).
2. Si la Licencia General 57 cubre los pagos que pasen por bancos estatales y qué pasa si se revoca.
3. Licencia aplicable para pagar impuestos venezolanos.
4. Si conviene aislar Venezuela en una cuenta de Stripe distinta de la de Miami.

---

## 9. Conclusiones corregidas (10 líneas)

1. Colombia y Venezuela no pueden tener cuenta de Stripe propia; Windoce sí puede cobrar desde EE. UU. tarjetas de los dos países. [DOC]
2. En Colombia se puede presentar el precio en COP (sin American Express); en Venezuela no existe VES en Stripe: se cobra en USD. [DOC]
3. Connect en Colombia: solo cuentas «recipient», a las que no se puede pagar por transfronterizo; hay que pasar por ventas o por Global Payouts. [DOC]
4. Global Payouts tiene Colombia solo en API de vista previa desde el 25 de marzo de 2026, exige Treasury y Stripe lo pensó para quien tiene licencia de transmisor. [DOC]
5. Venezuela no está en ningún producto de pago a terceros de Stripe. [DOC]
6. OFAC permite tratar con privados venezolanos no bloqueados; prohíbe al Estado y sus empresas salvo licencia; las licencias de 2026 (la 57 para bancos estatales) pueden revocarse. [DOC]/[OBS]
7. BCV: recaudar y repartir bolívares exige licencia de proveedor no bancario (Resolución 18-12-01), que en la práctica no se otorga; pagos en divisas por no bancarios, prohibidos. [DOC]/[OBS]
8. La afirmación interna es demasiado estricta: además del cobro directo, caben la tarjeta internacional en USD desde EE. UU. y el saldo prepago de comisiones (artículo 19). [DOC]/[INF]
9. Colombia: no hace falta ser adquirente si se usa uno registrado; el saldo prepago es seguro solo si paga servicios de Tumbite y no se reembolsa en dinero. [DOC]/[INF]
10. Antes de cobrar una sola recarga en Colombia o Venezuela: opinión escrita de los tres abogados y prueba en modo prueba de Stripe. [INF]

---

## 10. Fuentes

| Título                                                                                                    | Fecha                                       | URL                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe, Global availability (países soportados)                                                           | consultada 18 oct 2026                      | https://stripe.com/global                                                                                                                                                                                                               |
| Stripe, Cross-border payouts                                                                              | consultada 18 oct 2026                      | https://docs.stripe.com/connect/cross-border-payouts                                                                                                                                                                                    |
| Stripe, Service agreement types                                                                           | consultada 18 oct 2026                      | https://docs.stripe.com/connect/service-agreement-types                                                                                                                                                                                 |
| Stripe, Bank account formats (Connect)                                                                    | consultada 18 oct 2026                      | https://docs.stripe.com/connect/payouts-bank-accounts                                                                                                                                                                                   |
| Stripe, Required verification information                                                                 | consultada 18 oct 2026 (vía estudio previo) | https://docs.stripe.com/connect/required-verification-information                                                                                                                                                                       |
| Stripe, Global Payouts                                                                                    | consultada 18 oct 2026                      | https://docs.stripe.com/global-payouts                                                                                                                                                                                                  |
| Stripe, Global Payouts recipient requirements                                                             | consultada 18 oct 2026                      | https://docs.stripe.com/global-payouts/recipient-requirements                                                                                                                                                                           |
| Stripe changelog, «Expands Global Payouts cross-border payout destinations to three additional countries» | 25 mar 2026                                 | https://docs.stripe.com/changelog/dahlia/2026-03-25/cross-border-payouts-new-countries                                                                                                                                                  |
| Stripe, Supported currencies                                                                              | consultada 18 oct 2026                      | https://docs.stripe.com/currencies                                                                                                                                                                                                      |
| Stripe, Pricing                                                                                           | consultada 18 oct 2026                      | https://stripe.com/pricing                                                                                                                                                                                                              |
| Stripe, Prohibited and restricted businesses                                                              | consultada 18 oct 2026                      | https://stripe.com/legal/restricted-businesses                                                                                                                                                                                          |
| OFAC, FAQ 680                                                                                             | 9 ene 2023                                  | https://ofac.treasury.gov/faqs/680                                                                                                                                                                                                      |
| OFAC, Selected General Licenses                                                                           | consultada 18 oct 2026                      | https://ofac.treasury.gov/selected-general-licenses-issued-ofac                                                                                                                                                                         |
| OFAC, General License 35 (texto)                                                                          | 2019                                        | https://ofac.treasury.gov/media/25961/download                                                                                                                                                                                          |
| Faegre Drinker, «UPDATE: Additional Changes to the Venezuela Sanctions Program…»                          | 23 jul 2026                                 | https://www.faegredrinker.com/en/insights/publications/2026/7/update-additional-changes-to-the-venezuela-sanctions-program-impacting-the-energy-minerals-financial-services-and-aviation-sectors                                        |
| Morgan Lewis, «Venezuela Oil Industry Sanctions Update»                                                   | feb 2026                                    | https://www.morganlewis.com/pubs/2026/02/venezuela-oil-industry-sanctions-update-analyzing-ofac-general-licenses-and-new-faqs                                                                                                           |
| Baker McKenzie, «OFAC Updates Venezuela General Licenses and Issues New Venezuela FAQs»                   | 2026                                        | https://sanctionsnews.bakermckenzie.com/ofac-updates-venezuela-general-licenses-and-issues-new-venezuela-faqs/                                                                                                                          |
| Foley, «OFAC Reaffirms Recent Licenses Along With New License in Response to Venezuela Earthquakes»       | ago 2026                                    | https://www.foley.com/insights/publications/2026/08/ofac-reaffirms-recent-licenses-along-with-new-license-in-response-to-venezuela-earthquakes-2/                                                                                       |
| FinCEN, Frequently Asked Questions regarding Prepaid Access                                               | consultada 18 oct 2026                      | https://www.fincen.gov/resources/statutes-regulations/guidance/frequently-asked-questions-regarding-prepaid-access                                                                                                                      |
| BCV, Resolución 18-12-01 (texto PDF)                                                                      | 4 dic 2018 (Gaceta 41.547, 17 dic 2018)     | https://www.bcv.org.ve/system/files/documentos_juridicos/resolucion_n_18-12-01.pdf                                                                                                                                                      |
| BCV, Normativa sobre sistema de pagos (resoluciones)                                                      | consultada 18 oct 2026                      | https://www.bcv.org.ve/marco/decreto-reglamentos-resolucion-pago                                                                                                                                                                        |
| BCV, Registro de proveedores no bancarios de servicios de pago                                            | consultada 18 oct 2026                      | https://www.bcv.org.ve/sistemas-de-pago/proveedores-servicios-pago                                                                                                                                                                      |
| BCV, aviso de comisiones máximas (Gaceta Ext. 7.073)                                                      | vigente desde 15 sep 2026                   | https://www.bcv.org.ve/system/files/documentos/171.pdf                                                                                                                                                                                  |
| Banca y Negocios, «¿Por qué el BCV suspendió permisos a proveedores no bancarios de medios de pago?»      | 5 nov 2021                                  | https://www.bancaynegocios.com/por-que-el-bcv-suspendio-permisos-a-proveedores-no-bancarios-de-medios-de-pago/                                                                                                                          |
| El Universal, «BCV suspende servicios que faciliten pagos en divisas»                                     | oct 2020                                    | https://www.eluniversal.com/economia/82241/bcv-suspende-servicios-que-faciliten-pagos-en-divisas                                                                                                                                        |
| Acceso a la Justicia, SUDEBAN regula servicios fintech (Resolución 001.21)                                | 2021                                        | https://accesoalajusticia.org/sudeban-regula-servicios-de-tecnologia-financiera-fintech/                                                                                                                                                |
| Bloomberg Línea, SUDEBAN prohíbe cuentas de Yummy                                                         | 28 sep 2022                                 | https://www.bloomberglinea.com/2022/09/28/sudeban-prohibe-a-entidades-bancarias-venezolanas-la-apertura-de-cuentas-o-transacciones-de-yummy/                                                                                            |
| Finanzas Digital, Banco de Venezuela divisas 2026                                                         | 2026                                        | https://finanzasdigital.com/banco-de-venezuela-divisas-2026/                                                                                                                                                                            |
| Función Pública, Decreto 1692 de 2020                                                                     | 18 dic 2020                                 | https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=153787                                                                                                                                                            |
| SFC, Concepto 2007054433-003 (tarjeta prepago y captación), Boletín Jurídico 11                           | 23 nov 2007                                 | https://www.superfinanciera.gov.co/publicaciones/15911/normativanormativa-generalboletin-juridico-superintendencia-financieraboletin-juridico-no-tarjeta-debito-tarjeta-prepago-caracteristicas-captacion-de-dineros-del-publico-15911/ |
| Accounter, el rol de los adquirentes y los agregadores                                                    | s. f.                                       | https://accounter.co/noticias/actualidad/asuntos-legales-el-rol-de-los-adquirentes-y-los-agregadores-en-los-pagos-electronicos                                                                                                          |
| OnePay, Agregador de pagos en Colombia y Decreto 1692                                                     | s. f. (fuente comercial)                    | https://www.onepay.la/blog/agregador-de-pagos-colombia-decreto-1692-2020                                                                                                                                                                |
