# Stripe internacional y modelo de cobro directo en efectivo: investigación y decisión

**Fecha:** 18 de octubre de 2026. **Quién pidió:** Richard. **Método:** metodología REA de Tumbite, solo con documentación oficial pública y prensa (sin cuentas, sin registro, sin navegador interactivo, sin REA sobre apps de terceros). **Alcance:** dos preguntas. (1) Qué puede hacer la cuenta plataforma de Stripe de Windoce LLC (EE.UU., Connect) con comercios y repartidores de Colombia, Venezuela y México. (2) Quién opera ya el modelo que Richard aprobó —el repartidor compra la comida con su dinero, el cliente le paga en efectivo o por transferencia, y la plataforma cobra sus comisiones de un saldo prepago del repartidor— y cómo resuelven cada caso límite.

**Etiquetas:** [DOC] documentación oficial publicada · [OBS] observación pública (prensa, páginas de terceros, blogs) · [INF] inferencia nuestra · [NV] no verificable con las fuentes consultadas. Las direcciones de las fuentes están solo en la sección 8 de este archivo; en el chat se nombra el medio.

**Resumen en diez líneas:**

1. Stripe no abre cuentas en Colombia ni en Venezuela; sí en México y Brasil. [DOC]
2. Desde una plataforma en EE.UU., Stripe sí deja crear cuentas conectadas en Colombia, México, Argentina, Perú, Chile, Ecuador y otros 100 países, pero en Colombia **solo bajo el acuerdo «recipient»** (recibir transferencias, sin cobrar tarjetas) y Stripe dice que fuera de EE.UU./UK/EEE/Canadá/Suiza los pagos transfronterizos **no son de autoservicio: hay que hablar con ventas**. Venezuela no aparece en ninguna lista. [DOC]
3. Tarjetas colombianas o venezolanas sí se pueden cobrar en la cuenta de EE.UU.: cuesta 2,9 % + 30 centavos, más 1,5 % por tarjeta internacional, más 1 % si hay conversión de moneda. [DOC]
4. PSE y Nequi (Colombia) **no existen en Stripe**. OXXO (México) sí, y una cuenta de EE.UU. puede activarlo; SPEI solo para cuentas de México. [DOC]
5. Pagar a bancos de Colombia: solo con cuenta conectada «recipient» (si ventas lo aprueba) o con Global Payouts, que exige Treasury y, según Stripe, licencia de transmisor de dinero; Colombia no aparece en la tabla de países de Global Payouts. Venezuela: imposible por Stripe. [DOC]
6. Stripe Tax calcula el impuesto de ventas de Florida según la ubicación del cliente, incluye el recargo por condado y tiene umbral de registro de 100 000 dólares para vendedores remotos; si la sede está en Florida hay que registrarse de una. [DOC]
7. Disputas: 7 a 21 días para responder, una sola oportunidad, 15 dólares por disputa recibida (no se devuelven) y 15 por contestar (se devuelven si se gana). Reembolsos: parciales o totales, sin devolver la comisión original de Stripe. [DOC]
8. El modelo de «el repartidor cobra en efectivo y le queda una deuda a la plataforma» es el estándar en DoorDash, Uber Eats, Rappi, DiDi Food, Glovo y Bolt. Todos lo resuelven igual: saldo negativo con tope, descuento de las ganancias digitales, recarga por canales propios y pausa de pedidos en efectivo al llegar al tope. [DOC]
9. El saldo **prepago** obligatorio (recargar antes de trabajar) es el modelo de las apps de transporte de bajo costo (inDrive, Yango) y de DiDi Food cuando paga a la tienda por el repartidor. Las recargas en puntos físicos existen: OXXO en DiDi México, Fawry en inDrive Egipto, Zeepay en Glovo Ghana. Para Colombia (Efecty, Baloto) no hay confirmación oficial. [DOC]/[NV]
10. Recomendación: copiar el estándar (saldo del repartidor con tope, pausa automática, recarga digital y por puntos de venta), con **tres estados separados** en el pedido —entrega física, cobro confirmado, conciliación— y sin que Tumbite toque dinero del cliente en los países donde Stripe no puede pagar.

---

## 1. Referencias

### 1.1 Para Stripe internacional (pregunta 1)

- Documentación oficial de Stripe: disponibilidad global, Connect (pagos transfronterizos, tipos de acuerdo de servicio, información de verificación requerida, precios de Connect, pagos a cuentas conectadas), Global Payouts (disponibilidad y requisitos del receptor), métodos de pago (tabla de soporte por país, OXXO, transferencias bancarias), precios de EE.UU., Stripe Tax para Estados Unidos y para Florida, disputas (cómo funcionan, cómo responder, API) y reembolsos.
- El punto final de datos que alimenta la página «Required verification information» de Stripe (devuelve la lista exacta de países de cuentas conectadas permitidos para una plataforma de EE.UU. y los requisitos por configuración). Es la misma información que muestra la página, en formato de máquina.

### 1.2 Para el cobro directo y el efectivo (pregunta 2)

- DoorDash (centro de ayuda de Dashers: «Cash on Delivery Overview and FAQ»).
- Uber Eats (términos de pago en efectivo para consumidores en EE.UU., blog «Introducing cash payment for deliveries» de julio de 2026, página de entregas en efectivo para socios de Japón, página de viajes en efectivo para repartidores de Guatemala).
- Rappi (términos y condiciones de la app Soy Rappi en Colombia; páginas de ayuda «Cómo pagar la deuda» de Soy Rappi Argentina y Ecuador; prensa: C5N, iProUP, 45 Segundos, Descubre.vc).
- DiDi Food (preguntas frecuentes oficiales para repartidores de México y Colombia).
- Glovo (centro de ayuda de repartidores de Albania y Ghana; guía de riders en Scribd; mesas de ayuda de flotas asociadas en Polonia; preguntas frecuentes de PAYCOMET).
- Bolt (guía oficial para conductores «Cash trips paused or how to repay driver debt», Arabia Saudita).
- inDrive (centro de ayuda oficial «Cómo recargar tu cuenta» en Colombia, India, Egipto, Brasil, Indonesia; prensa: Valora Analitik, Enter.co, Mobile Time, DPL News).
- Yango (página de conductores en Colombia, prensa RCN y Forbes Chile, flota asociada DG Flota en Perú, términos de Yego en Perú).
- Yummy y Ridery (Venezuela): prensa (Bloomberg Línea, Forbes, Crónica.Uno, DPL News, Valora Analitik) y un blog de conductores (Chofer Venezuela).
- PedidosYa: términos y condiciones de Argentina, prensa (Urgente24, Nodal, El Cronista) y reclamos públicos.
- Estudios de Richard en la carpeta «Proyectos Para estudiar y copiar clonar ideas» y la ficha previa `2026-10-16-cobro-al-entregar.md` (seguridad del cobro al entregar con Stripe).

**Límite legal respetado:** no se descompiló ni analizó ninguna app de terceros. Todo sale de páginas públicas leídas como visitante.

---

## 2. Evidencia y límites

### 2.1 Stripe desde una plataforma de EE.UU.: qué sí y qué no

#### A. Países donde Stripe abre cuentas

- [DOC] La página «Global availability» de Stripe lista 51 países/regiones. En América: **Brasil, Canadá, México y Estados Unidos**. India e Indonesia están en «preview»; Costa de Marfil, Ghana, Kenia, Nigeria y Sudáfrica aparecen como «red extendida» vía Paystack.
- [DOC] **Colombia, Venezuela, Argentina, Chile y Perú NO aparecen.** Un comercio colombiano o venezolano no puede abrir su propia cuenta de Stripe.
- [DOC] Para países fuera de la lista, Stripe ofrece solo «Stripe Treasury con stablecoins» (sin pagos). No sirve para cobrar.

#### B. Cuentas conectadas (Connect) desde una plataforma de EE.UU.

- [DOC] El punto final de datos de «Required verification information» para `platformCountry=US` devuelve **121 países de cuenta conectada** permitidos. Entre ellos: **México (acuerdo full o recipient; dashboard full, express o none; capacidades card_payments, transfers, oxxo_payments…)**, **Colombia (SOLO acuerdo recipient; dashboard express o none; SOLO capacidad transfers)**, Argentina, Perú, Chile, Ecuador, República Dominicana, Guatemala, Bolivia, Paraguay, Uruguay, Costa Rica, El Salvador, Panamá (todos recipient / transfers). **Venezuela no existe en el mapa.**
- [DOC] Requisitos para un repartidor individual de Colombia con acuerdo recipient, sin dashboard y capacidad transfers (consulta hecha al mismo punto final): `external_account` (la cuenta bancaria), `tos_acceptance.date` y `tos_acceptance.ip`. Nada más «currently due» según la respuesta. [INF] Stripe puede pedir más (identificación) al verificar; la respuesta solo lista lo inicial.
- [DOC] «Service agreement types»: el acuerdo **recipient** «reconoce que Stripe no tiene relación directa con el receptor»; esas cuentas **no pueden procesar pagos ni pedir card_payments**; las transferencias tardan **24 horas más** en estar disponibles; Stripe no les da soporte directo (lo da la plataforma). Una vez aceptado, no se puede cambiar el tipo de acuerdo. Un acuerdo **full** sí permite cobrar tarjetas (aplica a México).
- [DOC] Tensión importante: la página «Cross-border payouts» dice que las plataformas de **EE.UU., UK, EEE, Canadá y Suiza** pueden pagar a cuentas conectadas **en cualquiera de esas mismas regiones**, y que «Stripe doesn't support self-serve cross-border payouts to countries outside the listed regions. Contact sales to discuss alternatives, or use Global Payouts». Es decir: la configuración técnica para Colombia o México existe en la herramienta de requisitos, pero **activarla no es de autoservicio: hay que pedirla a ventas de Stripe**. [INF] Lo más probable es que Stripe la habilite por plataforma, caso por caso, con revisión de riesgo.
- [DOC] La misma página: «You can't make cross-border payouts to connected accounts under a recipient service agreement. For those accounts, use Global payouts». [INF] Combinado con lo anterior: para Colombia (que solo admite recipient) el camino que Stripe documenta es Global Payouts, no Connect; para México (admite full) sí cabe Connect transfronterizo, previa aprobación de ventas.
- [DOC] Flujos de fondos soportados en transfronterizo: cargos y transferencias separados **sin** `on_behalf_of`, top-ups y transferencias, y destination charges **sin** `on_behalf_of`. No se soportan direct charges ni `on_behalf_of`. [INF] Tumbite ya usa cargos en la plataforma y transfiere después (modelo compatible).
- [DOC] Precios de Connect en EE.UU. (modelo «tú fijas los precios a tus usuarios»): 2 dólares por cuenta activa al mes; 0,25 % + 25 centavos por pago enviado; 0,25 % del volumen por enrutamiento; pagos instantáneos 1 %; **transfronterizo desde 0,25 % del volumen** y, según la página de precios general, 1,50 dólares por pago transfronterizo más cambio de moneda desde 0,5 %.
- [DOC] «Payouts to connected accounts»: las monedas de liquidación por país están en una tabla interactiva (no se pudo leer en texto plano); la página remite a «multi-currency settlement». [NV] No se verificó la moneda de liquidación exacta para una cuenta recipient en Colombia (se supone COP por la tabla de Global Payouts, que sí la lista). Para México, Global Payouts indica MXN con método bancario local.

#### C. Global Payouts (pagar a quien no tiene cuenta de Stripe)

- [DOC] Disponible para empresas en **EE.UU. y UK**; en preview privada para parte de Europa y Australia. Requiere **Stripe Treasury** (hay que activarlo y fondear una «financial account»). Permite pagar a más de 160 países.
- [DOC] Stripe dice textualmente que Global Payouts «is best for businesses that already hold the Money Transmitter License (MTL) required to move money themselves». La tabla comparativa dice que con Connect transfronterizo «shift legal and compliance requirements to Stripe» y con Global Payouts «manage your own legal and compliance requirements. This might require a Money Transmitter license». **Esto es una decisión legal, no técnica.**
- [DOC] Tabla de países receptores (remitente EE.UU.): **México (MXN, método bancario local; solo correo y nombre)**, Perú (PEN, local, exige DNI/RUC), Ecuador (USD, wire), El Salvador (USD, wire), Guatemala (GTQ, wire, NIT), Panamá (USD, wire), República Dominicana (DOP, local), Costa Rica (CRC, local), Jamaica, Trinidad. **Colombia NO aparece. Venezuela NO aparece. Argentina, Chile y Brasil tampoco.**
- [DOC] Pagos en stablecoin (USDC/OUSD) a billeteras cripto «en cualquier parte del mundo», en preview pública, para empresas de EE.UU. salvo Nueva York. [INF] Técnicamente alcanzaría a Venezuela, pero exige que el repartidor tenga billetera cripto y supone riesgo regulatorio y cambiario; no se recomienda sin asesoría legal.

#### D. Cobrar tarjetas de Colombia o Venezuela en la cuenta de EE.UU.

- [DOC] Página de precios de EE.UU.: 2,9 % + 30 centavos por tarjeta nacional; **+1,5 % por tarjeta internacional**; **+1 % si hace falta conversión de moneda**. El recargo lo dispara el país emisor de la tarjeta, no la dirección del cliente. Ejemplo con 100 dólares: 3,20 dólares de comisión base; con los dos recargos, 5,70.
- [DOC] Stripe cobra en dólares (moneda de la cuenta) o en la moneda que se presente; si se presenta en COP o MXN, aplica la conversión del 1 % y Stripe liquida en USD. [INF] Para un cliente colombiano pagando con tarjeta de crédito colombiana, su banco aplicará además su propio recargo por compra internacional (fuera de Stripe). Tarjetas de débito venezolanas en bolívares normalmente no funcionan en comercios extranjeros; las tarjetas internacionales de venezolanos sí. [NV] No hay documento de Stripe que hable específicamente de Venezuela.
- [DOC] Stripe no bloquea por nacionalidad del tarjetahabiente; su lista de «restricted businesses» y las sanciones (OFAC) aplican por países sancionados. [NV] No se encontró una página de Stripe que declare a Venezuela como país bloqueado para tarjetahabientes; la sanción de OFAC es a entidades, no al país completo. **Debe confirmarlo un abogado**.

#### E. Métodos locales de Colombia y México en Stripe

- [DOC] En la tabla «Payment method support» de Stripe **no existe PSE ni Nequi**. Tampoco Daviplata, Efecty ni Baloto. Para Colombia Stripe no ofrece ningún método local. (Quien ofrece PSE y Nequi son dLocal, Bamboo, payabl y otros, no Stripe.)
- [DOC] **OXXO**: disponible para cuentas de **México, Estados Unidos, Canadá y Singapur** (y en preview privada para EEE/UK). Cliente en México, moneda MXN, mínimo 10 MXN y máximo 10 000 MXN, comprobante que vence en 1 a 7 días (5 por defecto), confirmación al siguiente día hábil, liquidación hasta T+4, **sin reembolsos y sin disputas**, no sirve para pagos recurrentes ni para guardar tarjeta, sí funciona con Connect. [INF] Útil para que un repartidor en México recargue su saldo en efectivo en una tienda OXXO: Stripe emite el voucher, el repartidor paga en la tienda y Stripe avisa al día siguiente.
- [DOC] **SPEI** (transferencias bancarias de México) en Stripe es el método `customer_balance` en MXN y **solo para cuentas con ubicación de negocio en México**. Una cuenta de EE.UU. puede aceptar transferencias en USD (ACH/wire), EUR (SEPA) y GBP, **no MXN**. [INF] Tumbite en EE.UU. no puede ofrecer SPEI salvo que Windoce abra una entidad y cuenta de Stripe en México.
- [DOC] Pix y Boleto (Brasil) existen; Pix admite cuentas de EE.UU. No aplican a los tres países preguntados.

#### F. Pagar a bancos de Colombia o Venezuela

- [DOC] **Colombia**: (a) por Connect, una cuenta conectada recipient con `external_account` colombiano existe en la herramienta de requisitos, pero el transfronterizo fuera de las cinco regiones **no es autoservicio** (hablar con ventas) y Stripe remite a Global Payouts para recipient; (b) por Global Payouts, **Colombia no está en la tabla** de países receptores. [INF] Conclusión práctica: hoy no hay camino documentado y de autoservicio para que Tumbite pague a un banco colombiano desde Stripe. Hay que preguntar a ventas de Stripe o usar otro proveedor de pagos a terceros (fuera del alcance de esta ficha).
- [DOC] **Venezuela**: no aparece en ninguna lista de Stripe (ni cuentas, ni cuentas conectadas, ni Global Payouts, ni métodos de pago). **No es posible pagar a un banco venezolano con Stripe.**
- [DOC] **México**: sí, por dos caminos: cuenta conectada (full o recipient, con aprobación de ventas para transfronterizo) o Global Payouts (MXN, método bancario local, solo correo y nombre del receptor, pero exige Treasury y la carga legal de la licencia).

#### G. Stripe Tax y el impuesto de ventas de Florida

- [DOC] Florida: tasa estatal 6,0 %; los 67 condados agregan un recargo discrecional de 0,0 % a 2,0 % (combinadas 6,0 % a 7,5 %). Ejemplos 2026 de la propia página de Stripe: Miami-Dade y Broward 7,0 %, Palm Beach 6,5 %, Hillsborough 7,5 %. El recargo de condado aplica solo a los primeros 5 000 dólares de un artículo; el 6 % estatal al total.
- [DOC] «Collect tax in the United States»: Stripe convierte las direcciones en coordenadas y las cruza con los límites de jurisdicción; para ventas fuera del estado de la sede calcula según la ubicación del cliente; para ventas **dentro de Florida** también usa la ubicación del cliente (Florida no está en la lista de estados con sourcing por origen). La página de Florida dice: «Stripe calculates the taxes that apply to your customer's location».
- [DOC] Florida: umbral de vendedor remoto **100 000 USD** en el año calendario anterior (solo bienes tangibles gravables; excluye servicios y ventas de marketplace). «If your head office … is in Florida, you're not a remote seller and you must register due to your physical presence in the state». Stripe puede registrar por ti (Tax Complete) y presentar las declaraciones.
- [DOC] Nota de reportes: «Certain areas in Florida can impose an extra sales surtax, but there is a set limit on how much tax will be applied based on the transaction amount. You won't see a location report for Florida if you had these transactions. Use the exports instead».
- [DOC] Leyes de «marketplace facilitator» existen en todos los estados con impuesto de ventas: el marketplace recauda y remite por los vendedores. [INF] Tumbite, como marketplace, es quien recauda el impuesto de los restaurantes en Florida, salvo que un contador diga lo contrario.
- [DOC] Precio de Stripe Tax: Tax Complete desde 90 USD/mes con contrato anual; Tax Basic sin código 0,5 % por transacción donde estés registrado; Tax Basic por API 0,50 USD por transacción (10 cálculos incluidos, 5 centavos extra cada uno).
- [NV] No se encontró en Stripe la regla exacta de Florida para comida preparada (la página de Stripe solo dice que «some grocery items, e.g., unprepared food» están exentos). Eso lo fija el código fiscal de producto que se asigne; confirmar con el contador el código correcto para comida de restaurante y para la tarifa de envío.

#### H. Disputas y contracargos

- [DOC] Plazos: el tarjetahabiente suele tener **120 días** desde el pago para disputar; una vez abierta, el comercio tiene **7 a 21 días** según la red para responder (`evidence_details.due_by`); el emisor decide en **60 a 75 días**; el ciclo completo dura 2 a 3 meses. Si no se responde, se pierde.
- [DOC] Dinero: al abrirse la disputa Stripe debita del saldo el monto disputado **más la comisión**. En EE.UU.: **15 USD por disputa recibida (nunca se devuelve)** y **15 USD por disputa contestada (se devuelve si se gana)**. «Smart Disputes»: 30 % del monto solo si se gana. Disputas de cumplimiento Visa/Mastercard: 500 USD adicionales, reembolsables si se gana. Mientras la disputa está abierta no se puede reembolsar.
- [DOC] Evidencia: **una sola oportunidad**; máximo combinado 4,5 MB (Mastercard 19 páginas); los bancos no abren enlaces, audios ni videos. Por API: `POST /v1/disputes/:id` con `evidence[...]` (campos de texto como `customer_name`, `customer_email_address`, `customer_purchase_ip`, `product_description`, `service_date`, `shipping_date`, `uncategorized_text`; campos de archivo como `shipping_documentation`, `service_documentation`, `customer_communication`, `receipt`, `uncategorized_file`, subidos antes con `purpose=dispute_evidence`); límite de 150 000 caracteres en texto; `submit=true` para enviar. Evento `charge.dispute.created` al abrir y `charge.dispute.closed` al cerrar; `charge.dispute.funds_reinstated` si devuelven el dinero.
- [DOC] Pre-disputas: «early fraud warnings» (unos 40 % se convierten en disputa de fraude; conviene reembolsar solo cargos de monto similar o menor a la comisión de disputa) e «inquiries» (Amex/Discover y cargos domésticos de México; responder evita la comisión).
- [DOC] Con 3D Secure hay traslado de responsabilidad en disputas de fraude y Stripe aporta la evidencia (ECI). Visa CE 3.0: Stripe prellena el historial del cliente.
- [INF] Para Tumbite la mejor evidencia de «no recibí el pedido» es la que ya producimos: foto de entrega, PIN, GPS en el punto, hora, chat con el cliente y la dirección. Hay que guardarla asociada al `payment_intent` y subirla por API.

#### I. Reembolsos después de capturar

- [DOC] Se puede reembolsar total o parcialmente (`amount` en centavos) un PaymentIntent exitoso, varias veces hasta el total. **La comisión de procesamiento, la de Connect y la de conversión del cargo original no se devuelven.** No hay comisión por emitir el reembolso (salvo transferencias bancarias). Si el saldo disponible no alcanza, el reembolso de tarjeta queda pendiente hasta que haya saldo.
- [DOC] Si la autorización todavía no se capturó (`requires_capture`), no se reembolsa: se **cancela** el PaymentIntent sin costo. Stripe recomienda explícitamente autorizar y capturar por separado a quien reembolsa mucho cerca del momento de la compra (ya es lo que hace Tumbite).
- [DOC] En Connect, con destination charges o cargos separados, Stripe debita a la **plataforma** el reembolso; hay que revertir las transferencias (`reverse_transfer`) para recuperar lo ya enviado a la cuenta conectada. Los reembolsos hechos poco después del cargo pueden llegar como «reversal» (desaparece el cargo del extracto). El cliente ve el crédito en 5 a 10 días hábiles. Si el reembolso falla (tarjeta cerrada), evento `refund.failed` y el dinero vuelve al saldo hasta 30 días después.
- [DOC] OXXO no admite reembolsos ni disputas: hay que devolver por otro canal.

#### J. Síntesis de la pregunta 1 (tabla)

| Qué                                             | Colombia                                                                                         | Venezuela                                                        | México                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Comercio abre su propia cuenta Stripe           | No [DOC]                                                                                         | No [DOC]                                                         | Sí [DOC]                                                         |
| Cuenta conectada desde plataforma EE.UU.        | Sí, solo recipient (transfers), express o none; activación transfronteriza requiere ventas [DOC] | No existe [DOC]                                                  | Sí, full o recipient, con card_payments y oxxo_payments [DOC]    |
| Cobrar sus tarjetas en nuestra cuenta de EE.UU. | Sí: +1,5 % internacional, +1 % conversión [DOC]                                                  | Sí si la tarjeta es internacional [INF]; sin doc específica [NV] | Sí, mismos recargos [DOC]                                        |
| Métodos locales en Stripe                       | Ninguno (sin PSE, sin Nequi) [DOC]                                                               | Ninguno [DOC]                                                    | OXXO sí desde cuenta de EE.UU.; SPEI solo cuenta de México [DOC] |
| Pagar a su banco                                | Sin camino de autoservicio documentado; no está en Global Payouts [DOC]                          | Imposible [DOC]                                                  | Sí (Connect con ventas, o Global Payouts en MXN) [DOC]           |
| Stablecoin a billetera cripto                   | Técnicamente sí (preview) [DOC]; no recomendado [INF]                                            | Igual                                                            | Igual                                                            |

### 2.2 Cobro directo y efectivo: cómo lo hacen los grandes

Para cada plataforma se buscó: límite de efectivo, saldo negativo, pago de comisiones, recargas en puntos de venta, cliente que no paga, pedido cancelado tras la compra, propina en efectivo y verificación de transferencias.

#### DoorDash (Cash on Delivery para Dashers, EE.UU.)

- [DOC] El Dasher **opta** en Account → Delivery Preferences → «Cash on Delivery Orders»; puede salir cuando quiera sin afectar calificaciones; puede rechazar un pedido en efectivo sin castigo.
- [DOC] **Se queda con el 100 % del efectivo, incluida la propina.** «The order amount is automatically deducted from your next direct deposit». El desglose semanal muestra las deducciones. Las propinas en efectivo no se descuentan.
- [DOC] Cliente que no paga: botón «Issue Collecting Cash Payment» con cuatro opciones (corto de efectivo, no tengo cambio, cliente no disponible, cliente se niega). Si el cliente está corto, no está o se niega: **no se entrega y se desecha el pedido**; si el problema es que el Dasher no tiene cambio, puede entregar. **En todos los casos el Dasher recibe su pago base** y su tasa de finalización no se afecta.
- [DOC] Se recomienda llevar 10 a 15 dólares en billetes pequeños para dar cambio.
- [NV] Monto máximo por pedido en efectivo, tope de saldo negativo y qué pasa con un pedido cancelado después de recoger: no están en la página oficial. [OBS] Guías de terceros dicen que si el Dasher pierde el efectivo, la pérdida es suya.
- [INF] DoorDash no usa saldo prepago: el Dasher **debe** a DoorDash lo que cobró y se compensa contra su depósito. El Dasher no compra la comida con su dinero: DoorDash ya le pagó al restaurante (modelo «Red Card» en pedidos que sí requieren pago en tienda, con tarjeta de DoorDash, no del Dasher).

#### Uber Eats (EE.UU. y Latinoamérica)

- [DOC] Términos de efectivo para consumidores (EE.UU.): solo en ciudades seleccionadas; **Uber puede fijar montos máximos y límites de frecuencia** de pedidos en efectivo (por encima, exige pago digital); el repartidor cobra; **la propina también debe ser en efectivo**; si el cliente paga de menos, lo que falta queda como **«arrears»** en su cuenta y se cobra con su próximo pedido o con un método digital; si los arrears superan un **umbral por mercado**, el cliente no puede pedir hasta pagar; si no hay cambio físico, el vuelto se acredita como Uber Cash; reembolsos de pedidos en efectivo se dan como Uber Cash.
- [DOC] Blog de Uber (21 de julio de 2026, EE.UU.): el repartidor elegible queda **inscrito automáticamente** (puede salir en Preferences → «Accept Cash»); la tarjeta de oferta muestra la insignia «Cash» antes de aceptar; al entregar aparece «Collect Payment» con el monto exacto; el efectivo cobrado aparece como **pago negativo** en el recibo; **el saldo puede quedar negativo** más allá de lo ganado en ese viaje porque parte del efectivo es del restaurante o de Uber; Uber recupera el negativo **descontándolo de futuras entregas pagadas digitalmente**; si el cliente paga corto o no paga, **el repartidor recibe la tarifa completa** y anota lo recibido (o cero); no hay que llevar cambio (el sobrante vuelve al cliente como Uber Cash); **las propinas en efectivo son 100 % del repartidor**; «cash deliveries may be paused if your negative balance gets too high» (sin cifra).
- [DOC] Página de socios en Japón: liquidación **semanal**; primero descuenta lo adeudado de las ganancias no en efectivo; si no alcanza, **cobra la tarjeta de crédito o débito registrada** en el Driver App (registrar tarjeta es requisito para recibir entregas en efectivo). Página de Sudáfrica: además se puede **dejar el efectivo en restaurantes participantes** al recoger pedidos.
- [DOC] Página para repartidores de Guatemala: «Siempre se le cobrará a tu cliente por la entrega»; si el cliente no paga o paga de menos, el monto aparece **a favor del repartidor** en la app; la tarifa de servicio de Uber se descuenta de las ganancias totales, separada del efectivo; si no hay señal, se le pregunta el monto al cliente y se mira en su pantalla.
- [NV] Umbral exacto de pausa por mercado, manejo de pedido cancelado tras la compra, tiempos de verificación de depósitos.
- [INF] Uber tampoco usa prepago: usa **saldo deudor con tope + compensación semanal + cobro a tarjeta del repartidor + depósito en restaurantes**.

#### Rappi (Colombia, Argentina, Ecuador, México)

- [DOC] Términos y condiciones de la app Soy Rappi en Colombia: «Cuando el pedido es pagado en efectivo, el Repartidor Independiente realiza el recaudo del valor total del pedido … se le genera una deuda por dicho valor hasta tanto no realiza el depósito del mismo, el cual lo puede realizar a través de los canales dispuestos por Rappi para tal fin». Propinas: 100 % del repartidor «sin importar el método de pago», Rappi no las retiene. Deberes: no pagar una deuda **por un valor superior a la deuda existente** (si lo hace, puede exigírsele probar el origen de los fondos: control antilavado). No se borra la cuenta mientras haya deuda. Causa de suspensión: no devolver la totalidad de los pedidos cancelados; pagar pedidos con datáfonos no autorizados. Para pedidos tipo cajero (retiro de efectivo) el repartidor debe usar la **tarjeta de compras de Rappi**, no su dinero; si usa su dinero, libera a Rappi de responsabilidad.
- [DOC] Páginas de ayuda «¿Cómo pagar la deuda por pedidos cancelados o recibir efectivo?» de Soy Rappi Argentina y Ecuador (leídas a través del resumen del buscador; la página se renderiza con JavaScript y no se pudo leer entera): la deuda aparece porque **Rappi paga por adelantado al restaurante** y el repartidor cobra al cliente; hay **dos topes**: al primero **solo recibe pedidos pagados con tarjeta**, al último **deja de recibir pedidos** hasta pagar; si el balance del corte es negativo, el siguiente corte **arranca con saldo pendiente**; en Ecuador existe una figura de «socio» para autopagar la deuda. [OBS] iProUP (2020): el repartidor puede depositar o compensar contra lo que se le debe cada 15 días, y cuando supera un límite lo deposita en Rapipago/Pago Fácil. [OBS] C5N: cuando se cancela un pedido ya pagado al restaurante y luego el cliente paga en efectivo, aparece la deuda.
- [OBS] Prensa de julio de 2026 (Descubre.vc, Nodal): repartidores argentinos acumulan deudas con Rappi y PedidosYa (se cita al BCRA); Rappi y PedidosYa prestan dinero a repartidores y lo descuentan de cada entrega. [OBS] Abril de 2026: la Superintendencia de Industria y Comercio multó a Rappi por reclamos de consumidores.
- [NV] Cifras de los topes por país; existencia de «RappiCash» o adelanto de efectivo al repartidor (no aparece en los T&C de Colombia); «Rappi Turbo» es la vertical de entrega ultrarrápida con tiendas propias, no un producto de efectivo (no se encontró relación con el saldo del repartidor).
- [INF] Rappi = saldo deudor con **dos topes escalonados** (primero solo tarjeta, luego bloqueo), corte periódico, depósito por canales propios y controles antilavado al pagar.

#### DiDi Food (México y Colombia)

- [DOC] Preguntas frecuentes de México: el **saldo negativo** aparece «cuando se recibe más efectivo de los clientes que lo ganado en pedidos en línea»; hay que **recargar la billetera para evitar un bloqueo temporal**; **el tope de saldo negativo depende de la ciudad y del nivel** del repartidor (programa de niveles: más nivel, más tope), y la app **recuerda** cuando se acerca. Recargas: **transferencia SPEI** con referencia de la app, **OXXO** («recargar tu cuenta OXXO Pay», máximo 1 500 MXN por recarga) y **tarjeta** en la app; pagos en línea limitados a **uno cada 30 minutos y tres al día**; si no se refleja, esperar 48 horas y luego soporte. **No se puede elegir** recibir solo pedidos con tarjeta: efectivo y tarjeta llegan en la misma proporción. Cliente sin cambio: no entregar hasta tener el cambio; si no puede pagar exacto, ruta de ayuda «Dinero insuficiente para pagar el pedido». Repartidor sin efectivo para pagar en la tienda: «Efectivo insuficiente» → **se reasigna automáticamente**. Propinas en línea o en efectivo: 100 % del repartidor. Esperas: 10 minutos en tienda, 10 minutos y dos llamadas en casa del cliente.
- [DOC] Colombia (métodos de pago): «Si el saldo de tu billetera es suficiente, DiDi Food paga directo a la tienda» y lo descuenta de la billetera; **si no alcanza, el repartidor debe pagar en efectivo en la tienda**. [DOC] (resumen del buscador) el tope de saldo negativo en Colombia también depende de ciudad y nivel y puede causar bloqueo temporal.
- [OBS] Guía no oficial (Google Sites) recomienda llevar 40 000 a 80 000 pesos colombianos para pagar en tiendas y dar cambio. [OBS] Xataka/Rest of World: préstamos de DiDi Food a repartidores en México desde 5 % mensual.
- [NV] Métodos de recarga en Colombia (Efecty, Baloto, PSE): la página oficial no los lista.
- [INF] DiDi Food es la referencia más cercana al modelo aprobado por Richard: **billetera del repartidor que paga a la tienda** (si tiene saldo) o **el repartidor paga con su efectivo** (si no), saldo negativo con tope por nivel, recarga en **OXXO** (punto de venta físico) y por transferencia, bloqueo temporal al tope, reasignación si el repartidor no tiene con qué pagar.

#### Glovo (Europa, África, Latinoamérica histórica)

- [OBS] Guía de riders (copia en Scribd): el **«cash balance»** son todos los montos recibidos o gastados en efectivo con la app; la pantalla de aceptación avisa si hay que **pagar al comercio en efectivo**; quien no tenga efectivo puede redespachar el pedido, pero afecta su tasa de aceptación; al llegar al **límite diario de efectivo** el rider recibe un mensaje con instrucciones para depositarlo.
- [OBS] Mesas de ayuda de flotas asociadas en Polonia: el saldo objetivo ronda 70 PLN (35 PLN si tiene pocos turnos); Glovo notifica cuándo depositar el excedente; se paga por un **enlace de pago** (DotPay/PAYCOMET) y la confirmación reduce el saldo automáticamente; también se puede «trabajar» el saldo con pedidos con tarjeta; **si la cuenta está bloqueada, solo queda depositar por el enlace**. PAYCOMET confirma ser la plataforma de depósitos de riders de Glovo y que solo Glovo puede resolver temas de saldo.
- [OBS] Ghana: depósitos por **Zeepay** (billeteras MTN, Vodafone, Zeepay) o enlace DirectPay, con ID de courier, teléfono y monto.
- [NV] Las páginas oficiales del centro de ayuda de Glovo (Albania y Ghana) estaban caídas al consultarlas (error de origen). Cifra del límite diario, manejo de cliente que no paga y de pedido cancelado.
- [INF] Glovo = saldo de efectivo con **límite diario** (no por tope de deuda acumulada), depósito por enlace de pago o billetera móvil, bloqueo hasta depositar.

#### Bolt (conductores; referencia de transporte, página oficial de Arabia Saudita)

- [DOC] En viajes en efectivo el pasajero paga al conductor y **la comisión de Bolt se suma al saldo** del conductor; al llegar al **límite negativo** (visible en la app, sin cifra pública) los pedidos en efectivo **se pausan** con recordatorios; siguen llegando viajes con tarjeta; se paga total o parcialmente desde la app bancaria (STC Bank → «Company Payments» → Bolt → teléfono de la cuenta) y los pedidos en efectivo **se reactivan automáticamente** al limpiar el saldo. [OBS] En Nigeria Bolt agregó retiro de efectivo para conductores (prensa).
- [NV] Reglas de Bolt en Latinoamérica (no encontradas).

#### inDrive (conductores; Colombia y otros)

- [DOC] Centro de ayuda oficial de Colombia: el saldo de la app **«covers service payments»** (la comisión); se ve en Driver mode → Wallet; se recarga con «Top up» eligiendo el método en la página de pago (la página **no lista** los métodos para Colombia); si no se refleja en 24 horas, soporte (responde en 3 días hábiles). Egipto: tarjeta, **Fawry (efectivo en tiendas)**, Meeza Wallet o transferencia, mínimo 40 a 60 EGP. Brasil: tarjeta, **Pix o efectivo**, mínimo 5 a 25 BRL.
- [OBS] Valora Analitik y Enter.co (Colombia, 2026): «El conductor recarga su saldo dentro de la app para poder tomar viajes; de ese mismo saldo se descuenta automáticamente el pago del micropréstamo» (inDrive Money, hasta 1 000 000 COP a 3 a 5 meses, cobrado junto con la comisión en cada viaje). [OBS] Sitios de reclamos: máximo **20 recargas semanales**; recargas rechazadas «por alto riesgo» con bloqueo. [OBS] Nicaragua: inDrive cambió los comercios autorizados como puntos de recarga en Managua (DPL News), lo que confirma que existen puntos de recarga físicos.
- [NV] Confirmación oficial de Efecty o Baloto como puntos de recarga en Colombia; cifra del saldo mínimo para recibir viajes.
- [INF] inDrive es el modelo **prepago puro**: sin saldo no hay viajes; la comisión se descuenta del saldo en cada viaje; recarga digital y en puntos físicos según el país.

#### Yango (conductores; Colombia, Perú, Bolivia, Guatemala)

- [OBS] Flota asociada en Perú (DG Flota): recarga desde la app por la pasarela Izipay (comisión ~2,48 % del banco), con tarjeta o Yape, reflejada en 3 a 10 minutos. Términos de la flota Yego (Perú): la plataforma puede fijar un **saldo mínimo de −20**; al llegar por «constantes pedidos en efectivo», **no recibe más pedidos hasta recargar y enviar el comprobante**. [OBS] RCN: comisión de Yango en Colombia no supera 14 %.
- [NV] Páginas oficiales de Yango sobre saldo, tope negativo o recargas en Colombia, Bolivia o Guatemala. Reglas de Yango como app de reparto (Yango Deli) en Latinoamérica.
- [INF] Yango sigue el patrón prepago/tope negativo pequeño, con verificación **manual del comprobante** de recarga en algunas flotas.

#### Yummy y Ridery (Venezuela)

- [OBS] Blog Chofer Venezuela (actualizado 28 de septiembre de 2026): Yummy Rides paga a los conductores **a diario por pago móvil** (los viajes del lunes llegan el martes; el fin de semana se acumula al lunes); la comisión se descuenta antes del pago; cuando el pasajero paga por **pago móvil directo al conductor**, el conductor recibe el viaje completo y **la comisión queda como deuda**; la app permite deuda hasta **−10 dólares**; al llegar, **bloquea los viajes con pago móvil y los corporativos** (quedan los de efectivo, se infiere). Métodos del pasajero según el centro de ayuda citado: débito inmediato, pago móvil, Zelle, efectivo, tarjeta internacional y saldo precargado; en efectivo se paga al conductor al terminar.
- [OBS] Crónica.Uno (septiembre de 2025): Yummy cambió a que el **pago móvil se haga directo al repartidor**, y repartidores dijeron que «no es viable» porque **debían pagar el pedido en el negocio antes de que se liberara la orden**: es exactamente el modelo de «repartidor compra con su dinero», con el problema de capital de trabajo que señalaron ellos mismos.
- [OBS] Bloomberg Línea (2022): un repartidor de Yummy hacía 12 a 15 entregas a 1,49 USD cada una y gastaba 5 USD diarios de gasolina.
- [NV] Páginas oficiales de Yummy o Ridery sobre saldo, comisiones, topes o verificación de pago móvil. El sitio «yummydelivery.com.ve» que apareció en la búsqueda es **otro negocio** (envío de compras a familiares en Venezuela, cobra por Zelle/PayPal/bolívares) y no la superapp Yummy; no se usó como evidencia.
- [INF] En Venezuela el estándar de hecho es: **pago móvil directo al repartidor o conductor**, comisión como deuda con tope pequeño en dólares, bloqueo parcial (quita los viajes digitales) al tope. La **verificación de la transferencia** la hace el propio repartidor (ve el pago móvil en su banco); la plataforma no la ve.

#### PedidosYa (Argentina, Uruguay y otros)

- [DOC] Términos de Argentina (marzo de 2026): el usuario «podrá abonar el Pedido al repartidor en efectivo»; PedidosYa «podrá compensar y/o descontar de cualquier suma que deba … los montos que … le adeude por cualquier concepto» (redactado para comercios/clientes).
- [OBS] Nodal y Urgente24 (2026): las cuotas de préstamos a repartidores se descuentan automáticamente de la comisión de cada entrega; sindicato SiTraRepA denuncia la carga. [OBS] Reclamos públicos: cuentas desactivadas «por una deuda en efectivo» tras cerrar el día con la «caja chica» alta, con depósito al día siguiente.
- [NV] Guía oficial para repartidores (Peya Rider) sobre topes, depósitos (Rapipago/Pago Fácil) o conciliación.
- [INF] Mismo patrón de saldo deudor con tope y desactivación.

#### Tabla comparativa

| Plataforma | ¿Prepago o deuda?                                                         | Tope                         | Qué pasa al tope                                         | Cómo se paga la comisión                                                                    | Recarga en puntos físicos                                          | Cliente no paga                                                   | Pedido cancelado tras comprar                              | Propina en efectivo    | Verificación de transferencias                      |
| ---------- | ------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| DoorDash   | Deuda, descontada del próximo depósito [DOC]                              | [NV]                         | [NV]                                                     | Descuento automático semanal [DOC]                                                          | No [NV]                                                            | No entrega, cobra pago base [DOC]                                 | [NV]                                                       | 100 % del Dasher [DOC] | No aplica                                           |
| Uber Eats  | Deuda (saldo negativo) [DOC]                                              | Por mercado, sin cifra [DOC] | Pausa de pedidos en efectivo [DOC]                       | Descuento de ganancias digitales; cobro a tarjeta del socio; depósito en restaurantes [DOC] | Restaurantes participantes (Sudáfrica) [DOC]                       | Repartidor cobra tarifa completa; cliente queda con arrears [DOC] | [NV]                                                       | 100 % [DOC]            | No aplica                                           |
| Rappi      | Deuda, con cortes periódicos [DOC]                                        | Dos topes [DOC*]             | 1.º solo tarjeta; 2.º sin pedidos [DOC*]                 | Depósito por canales de Rappi; compensación en corte [DOC]                                  | Rapipago/Pago Fácil (prensa) [OBS]                                 | [NV]                                                              | Deuda por el valor pagado al restaurante [OBS]             | 100 % [DOC]            | Control antilavado: no pagar más que la deuda [DOC] |
| DiDi Food  | Billetera (paga a la tienda si hay saldo) + saldo negativo con tope [DOC] | Por ciudad y nivel [DOC]     | Bloqueo temporal; recordatorio previo [DOC]              | Se descuenta de la billetera [DOC]                                                          | OXXO (MX, máx. 1 500 MXN); SPEI; tarjeta [DOC]                     | Ruta de ayuda; no entregar sin pago exacto [DOC]                  | Reasignación si no hay efectivo para pagar en tienda [DOC] | 100 % [DOC]            | 48 h para reflejar recarga [DOC]                    |
| Glovo      | Saldo de efectivo con límite diario [OBS]                                 | Diario, por país [OBS]       | Mensaje para depositar; bloqueo [OBS]                    | Enlace de pago (PAYCOMET/DotPay), billeteras móviles [OBS]                                  | Zeepay (Ghana) [OBS]                                               | [NV]                                                              | [NV]                                                       | [NV]                   | Confirmación del enlace reduce saldo [OBS]          |
| Bolt       | Deuda de comisión en viajes en efectivo [DOC]                             | En la app, sin cifra [DOC]   | Pausa de viajes en efectivo; siguen los de tarjeta [DOC] | Pago desde app bancaria [DOC]                                                               | [NV]                                                               | No aplica                                                         | No aplica                                                  | No aplica              | Reactivación automática al pagar [DOC]              |
| inDrive    | Prepago puro [DOC]                                                        | Sin saldo, sin viajes [INF]  | No recibe viajes [INF]                                   | Se descuenta del saldo en cada viaje [DOC/OBS]                                              | Fawry (Egipto), efectivo (Brasil), comercios (Nicaragua) [DOC/OBS] | No aplica                                                         | No aplica                                                  | No aplica              | 24 h; 20 recargas/semana [DOC/OBS]                  |
| Yango      | Prepago con tope negativo pequeño [OBS]                                   | −20 (Perú, flota) [OBS]      | Sin pedidos hasta recargar y enviar comprobante [OBS]    | Del saldo [OBS]                                                                             | Yape/tarjeta (Perú) [OBS]                                          | No aplica                                                         | No aplica                                                  | No aplica              | Comprobante manual [OBS]                            |
| Yummy (VE) | Deuda de comisión [OBS]                                                   | −10 USD [OBS]                | Bloquea pago móvil y corporativos [OBS]                  | Se descuenta del pago diario [OBS]                                                          | [NV]                                                               | [NV]                                                              | [NV]                                                       | [NV]                   | El repartidor ve el pago móvil en su banco [OBS]    |
| PedidosYa  | Deuda [DOC/OBS]                                                           | [NV]                         | Desactivación [OBS]                                      | Compensación [DOC]                                                                          | [NV]                                                               | [NV]                                                              | [NV]                                                       | [NV]                   | [NV]                                                |

[DOC*] = página oficial leída a través del resumen del buscador porque se renderiza con JavaScript.

**Lo que ninguna plataforma hace:** cobrar al cliente **por transferencia al repartidor** como método oficial de la plataforma (salvo el pago móvil venezolano de Yummy, que la prensa describe como problemático). Las grandes solo reconocen **efectivo** o **pago digital a la plataforma**. **Nadie exige saldo prepago para que el repartidor compre la comida con su dinero** como regla general: DiDi Food lo hace como respaldo cuando la billetera no alcanza, y Yummy lo intentó en 2025 con rechazo de los repartidores.

---

## 3. Comparación con Tumbite

**Lo que Tumbite tiene hoy** (rama principal, `schema.sql` y `apps/servidor/src/rutas/operacion.ts`):

- Estados del pedido: `pago_pendiente`, `pagado`, `aceptado`, `listo`, `en_camino`, `entregado`, `cancelado`. **No hay método de pago en la tabla** `pedidos`: todo pedido nace con `stripe_sesion` y `stripe_pago`; el estado `pagado` significa «autorizado en Stripe».
- Dinero: `cobros` (autorizado, capturado, cancelado), `liquidaciones` (candado C-COBRO-AL-ENTREGAR: la entrega y los abonos nacen en un mismo lote y la captura de Stripe se reintenta aparte), `movimientos` (libro de billetera por usuario), `retiros` (apagados). Comisión, pago al restaurante y al repartidor se calculan al crear el pedido y se abonan al entregar.
- El pago se autoriza al crear el pedido y se **captura al entregar** (Entrega 1b): «registrar la entrega primero y cobrar después». Ya existe la idea de que **entregar y cobrar son dos hechos distintos**.
- No existe: saldo prepago del repartidor, pedidos en efectivo, pago por transferencia al repartidor, recargas, puntos de venta, conciliación de dinero que no pasa por Stripe, topes de deuda, pausa automática.
- `docs/ROADMAP.md` ya dice: «Lo de Sudamérica (efectivo, Rappi, Mercado Pago, leyes de Colombia y México) se construye cuando se decida salir de EE.UU., como herramientas que se encienden por país». `PLAN.md` (B.1, B.3, B.6, C.6) ya prevé la ficha, el saldo prepago, las recargas y las pantallas.

**Brechas frente al estándar:**

| Estándar de los grandes                                                                        | Tumbite hoy                      | Brecha                                                                       |
| ---------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Método de pago por pedido (tarjeta / efectivo) con insignia antes de aceptar                   | Solo Stripe                      | Agregar `metodo_pago` al pedido y mostrarlo en la oferta al repartidor       |
| Saldo del repartidor con tope y pausa automática de pedidos en efectivo                        | No existe                        | Tabla de saldo, tope por zona/nivel, pausa y recordatorio                    |
| Repartidor cobra y se queda con el efectivo; la plataforma descuenta de ganancias digitales    | No existe                        | Compensación efectivo ↔ abonos digitales en `movimientos`                    |
| Recarga digital y en puntos de venta, con referencia y confirmación asíncrona                  | No existe                        | Recargas con código, canje idempotente, estado pendiente/confirmada          |
| Cliente que no paga: el repartidor no pierde; el cliente queda con deuda o pedido no entregado | No existe                        | Botón «problema al cobrar» con opciones y efectos sobre cliente y repartidor |
| Propina en efectivo 100 % del repartidor, fuera del saldo                                      | Propina va en el pedido (Stripe) | Separar propina en efectivo del cobro de la plataforma                       |
| Controles antilavado: no pagar más que la deuda; límite de recargas                            | No existe                        | Tope de recarga, máximo de recargas por semana, prueba de origen             |
| Evidencia de entrega para disputas                                                             | Foto, PIN, GPS existen           | Guardarla ligada al `payment_intent` y subirla por API al abrir disputa      |

---

## 4. Decisión recomendada

### 4.1 Sobre Stripe y los tres países (pregunta 1)

1. **Estados Unidos sigue siendo el único país con circuito completo en Stripe.** Allí: cobrar con tarjeta (incluidas tarjetas colombianas, venezolanas y mexicanas con el recargo del 1,5 % + 1 %), pagar a restaurantes y repartidores por Connect, Stripe Tax para Florida.
2. **México:** cuando se abra, pedir a ventas de Stripe la activación de pagos transfronterizos EE.UU. → México con cuentas conectadas (full para restaurantes, recipient o full para repartidores) y activar **OXXO** en nuestra cuenta de EE.UU. como canal de **recarga en efectivo** del saldo del repartidor (vouchers de 10 a 10 000 MXN, confirmación al día siguiente, sin reembolsos). SPEI exige entidad mexicana: se difiere.
3. **Colombia:** Stripe **no** sirve para pagar a repartidores ni restaurantes de autoservicio, y no tiene PSE ni Nequi. Dos caminos, ambos decisiones de negocio: (a) pedir a ventas de Stripe cuentas recipient para Colombia y ver si lo aprueban; (b) operar Colombia con el **modelo de cobro directo** (el dinero del cliente nunca pasa por Tumbite; Tumbite solo cobra comisiones del saldo prepago) y recibir las recargas por un proveedor local (fuera de esta ficha). El modelo aprobado por Richard encaja justo aquí: **evita que Tumbite tenga que pagar a bancos colombianos**.
4. **Venezuela:** Stripe no llega de ninguna forma. Solo el modelo de cobro directo. Las recargas del saldo tendrían que llegar por pago móvil, Zelle u otro canal que Richard decida, y la verificación será manual o por un proveedor local; igual que Yummy, donde el repartidor cobra directo y la plataforma solo administra la comisión.
5. **Florida:** activar Stripe Tax con sede en Florida (no somos vendedor remoto: registro obligatorio), código fiscal de comida preparada confirmado con el contador, y guardar el impuesto por línea en el pedido. Tumbite es «marketplace facilitator»: recauda y remite.
6. **Disputas:** construir el conector de evidencia (foto, PIN, GPS, chat, hora, dirección) ligado al `payment_intent`, con webhook `charge.dispute.created` que arma y envía la evidencia por API antes de `due_by`. Reserva de 15 USD por disputa en el modelo de dinero.

### 4.2 Diseño del cobro directo y el saldo prepago (pregunta 2)

Se copia el estándar (DiDi Food + Uber Eats + Bolt) con lo nuestro: **saldo prepago sin crédito** (decisión previa de Richard: sin negativo, sin retiro, sin transferencias entre usuarios), **tres estados separados** y conciliación explícita.

**Tres estados independientes por pedido** (ninguno implica al otro):

1. **Entrega física** (`entrega`: pendiente → entregado / no_entregado), con la evidencia de siempre (foto, PIN, GPS). Lo marca el repartidor. Igual que hoy.
2. **Cobro confirmado** (`cobro`: pendiente → confirmado / parcial / no_pagado), con `metodo_cobro` (efectivo, transferencia al repartidor, tarjeta por Stripe) y `monto_recibido`. En efectivo lo confirma el repartidor con el botón «Cobré» (como «Collect Payment» de Uber y «Issue Collecting Cash Payment» de DoorDash). En transferencia al repartidor, lo confirma el repartidor al ver la entrada en su banco (como en Yummy) y, si Richard lo decide, con foto del comprobante. En tarjeta lo confirma Stripe.
3. **Conciliación** (`conciliacion`: pendiente → conciliado / con_diferencia), que corre en el servidor después de los dos anteriores: compara `total` esperado contra `monto_recibido`, descuenta la comisión de Tumbite del saldo prepago del repartidor y anota el abono del restaurante como **deuda del repartidor con el restaurante** o como pago ya hecho en el local (según cómo Richard defina quién le paga al restaurante).

**Saldo prepago del repartidor:**

- Tabla `saldos_repartidor` (centavos, por moneda y país) y `movimientos` ya existentes para cada cargo y recarga. **Nunca negativo**: la comisión se **reserva** al aceptar un pedido en efectivo (como la reserva de combustible de Yango Pro) y se **cobra** al conciliar o se **libera** si se cancela. Si el saldo no cubre la comisión del siguiente pedido, el repartidor **no ve pedidos en efectivo** (sí los de tarjeta), con recordatorio cuando queda poco (como DiDi, Bolt y Uber).
- Tope de efectivo en mano por día (como Glovo) además del saldo: a partir de X en efectivo cobrado y no conciliado, solo tarjeta. Cifra por decidir.
- Recargas: digital (en EE.UU. y México, con Stripe: tarjeta u OXXO) y en **puntos de venta** con fondo prepago del punto, códigos impredecibles, canje atómico e idempotente, límite de intentos y anulación (ya en PLAN.md B.6). Estado `pendiente` hasta confirmación (OXXO confirma al día siguiente: la app lo dice así, como DiDi dice 48 horas). Máximo de recargas por semana y monto máximo por recarga (DiDi: tres al día; inDrive: 20 a la semana; Rappi: no pagar más que la deuda) como control antilavado.

**Casos límite, copiados del estándar:**

- **Cliente no paga o paga de menos:** el repartidor marca la razón (corto, sin cambio, no está, se niega). Si no hay pago, **no se entrega** y el repartidor recibe su pago base; la comisión reservada se libera; el cliente queda marcado con **deuda** (arrears) y no puede pedir hasta saldarla, con umbral configurable (Uber). Si fue parcial, la diferencia queda como deuda del cliente y el saldo del repartidor no se toca más allá de la comisión proporcional.
- **Pedido cancelado después de que el repartidor compró con su dinero:** la plataforma **no** reserva comisión; se registra `compensacion_repartidor` por el costo de la comida según política (Rappi lo deja como deuda del repartidor cuando él se queda con la comida; DoorDash paga base). La decisión de quién absorbe la comida es de Richard (sección 6). Lo que sí se construye: el estado `cancelado_tras_compra` separado de `cancelado`, con foto del ticket de compra.
- **Propina en efectivo:** 100 % del repartidor, **fuera** del total a conciliar; no toca el saldo (todas las plataformas).
- **Verificación de transferencias al repartidor:** la plataforma no la ve. Se exige confirmación explícita del repartidor y, opcionalmente, foto del comprobante guardada como evidencia; la conciliación marca «sin comprobante» para auditoría. Nunca se marca `cobro=confirmado` automáticamente.
- **Repartidor sin efectivo para comprar:** botón «No tengo con qué pagar» → **reasignación automática** (DiDi) sin castigo si se marca antes de llegar al local; con castigo si es reiterado.
- **Sin señal al cobrar:** mostrar el monto al cliente desde su app y permitir «Cobré» en cola, con marca de tiempo local (Uber Guatemala).

**Lo que no se hace (coherente con decisiones previas de Richard):** crédito al repartidor, saldo negativo, retiros del saldo prepago, transferencias entre usuarios, préstamos (toda la prensa de 2026 sobre Rappi, PedidosYa, DiDi y Uber Eats muestra el daño reputacional de los préstamos a repartidores).

**Interruptores por país** (como pide el roadmap): `efectivo_activo`, `transferencia_repartidor_activa`, `recargas_punto_venta_activas`, `tope_efectivo_diario`, `comision_reserva`, `umbral_arrears_cliente`. En EE.UU. todo apagado hasta que Richard lo encienda.

---

## 5. Riesgos

1. **Legal (Global Payouts):** Stripe dice en su propia página que mover dinero de terceros puede exigir licencia de transmisor de dinero. Operar «cobro directo» evita que Tumbite toque el dinero del cliente, pero **recibir recargas y cobrar comisiones** sigue siendo dinero de terceros en algunos marcos; un abogado debe revisar el modelo por país. [INF]
2. **Sanciones:** nada en Stripe prohíbe tarjetahabientes venezolanos como país, pero OFAC sanciona entidades; se necesita revisión legal antes de operar con Venezuela. [NV]
3. **Capital de trabajo del repartidor:** Yummy en 2025 vio repartidores decir que comprar con su dinero «no es viable». Si Tumbite exige comprar con dinero propio sin ningún respaldo, el riesgo es no tener repartidores. DiDi lo resuelve pagando a la tienda desde la billetera cuando hay saldo. [OBS]
4. **Fraude del repartidor:** quedarse con el efectivo y no conciliar. Mitigación estándar: tope diario de efectivo, reserva de comisión, bloqueo, evidencia (foto, GPS), y deuda visible al cliente para que reclame. [DOC]
5. **Lavado de dinero por recargas:** recargas por encima de la deuda o muchas recargas pequeñas. Rappi lo prohíbe en T&C; inDrive y DiDi limitan cantidad. Hay que limitar y auditar. [DOC/OBS]
6. **Reputación por deudas de repartidores:** la prensa argentina de 2026 y la multa de la SIC a Rappi muestran el costo. Tumbite no da crédito; aun así la pausa por saldo debe explicarse en pantalla y en Docs. [OBS]
7. **Stripe puede negar el transfronterizo a México o Colombia:** no es autoservicio. Plan B: cobro directo. [DOC]
8. **Impuestos en Florida mal calculados por código fiscal de comida errado:** riesgo fiscal directo; confirmar con el contador. [NV]
9. **Disputas de tarjetas internacionales:** más fraude y más conversión; la disputa se recalcula al tipo de cambio del día. Mantener 3D Secure activo (traslado de responsabilidad). [DOC]

---

## 6. Decisiones que solo Richard puede tomar

1. ¿Se pide a ventas de Stripe la activación de pagos transfronterizos a **México** y, por separado, a **Colombia** (cuentas recipient)? Implica contactar a Stripe en nombre de Windoce LLC.
2. ¿Se activa **Stripe Treasury / Global Payouts**? Implica revisar con un abogado la licencia de transmisor de dinero. Recomendación: no, hasta tener opinión legal.
3. ¿Se activa **OXXO** en la cuenta de EE.UU. como canal de recarga para México cuando toque? (No cuesta hasta usarlo; activarlo cambia la cuenta: pide revisión.)
4. **Quién le paga al restaurante** en un pedido en efectivo: el repartidor en el local con su dinero (modelo aprobado), o Tumbite desde el saldo prepago del repartidor (modelo DiDi cuando hay saldo). Cambia el flujo de caja y la deuda.
5. **Quién absorbe la comida** cuando el pedido se cancela después de que el repartidor la compró: el cliente (deuda), Tumbite (compensación) o el repartidor (se queda con la comida). Cifra tope por pedido.
6. **Topes y cifras por país:** tope diario de efectivo en mano, saldo mínimo para ver pedidos en efectivo, umbral de deuda del cliente para bloquearle pedidos, máximo de recargas por semana y monto máximo por recarga.
7. **Transferencia al repartidor como método oficial** (Colombia: Nequi/Daviplata/Bre-B; Venezuela: pago móvil, Zelle): ¿se acepta sabiendo que Tumbite no puede verificarla y que ninguna de las grandes lo hace, salvo Yummy con problemas? Si sí, ¿exige foto del comprobante?
8. **Canales de recarga por país** (Efecty, Baloto, Bre-B en Colombia; pago móvil o Zelle en Venezuela; OXXO/SPEI en México) y el proveedor local que los procese: cuentas, claves y contratos que solo Richard puede abrir.
9. **Stripe Tax:** confirmar con el contador el código fiscal de comida preparada y de la tarifa de envío en Florida, y si Tumbite se registra ya como marketplace facilitator.
10. **Política ante tarjetahabientes venezolanos** (aceptar o bloquear) tras revisión legal de sanciones.

---

## 7. Pruebas de aceptación

Todas en el sitio de pruebas, con Stripe en modo prueba, sin dinero real; la primera versión de cada prueba debe fallar en rojo antes del cambio.

**Stripe internacional**

1. Crear en modo prueba una cuenta conectada `country=MX`, `tos_acceptance[service_agreement]=recipient`, `capabilities[transfers]`: la API la acepta y lista `requirements.currently_due` con `external_account` y `tos_acceptance`. Repetir con `country=CO`: acepta solo con recipient; con `card_payments` devuelve error. Repetir con `country=VE`: devuelve error de país no soportado. (Documenta el comportamiento real de nuestra cuenta; si Stripe rechaza MX o CO por «no autoservicio», se anota como bloqueado por ventas.)
2. Pago con tarjeta de prueba de país emisor no estadounidense: el `balance_transaction` muestra la comisión con el recargo internacional (Stripe tiene tarjetas de prueba por país).
3. Stripe Tax en modo prueba con dirección en Miami-Dade: `tax_amount` corresponde a 7,0 % sobre el subtotal gravable; con dirección en Palm Beach, 6,5 %. Con la sede en Florida, el cálculo se hace por ubicación del cliente.
4. Disputa simulada con la tarjeta de prueba `4000000000000259`: el webhook `charge.dispute.created` arma la evidencia (foto, PIN, GPS, hora, dirección, chat) y la envía con `submit=true` antes de `evidence_details.due_by`; la prueba falla si falta cualquier campo o si `submission_count` sigue en 0.
5. Reembolso parcial después de capturar: `refund.amount` correcto, `movimientos` revierte abonos proporcionales, y un segundo reembolso que exceda el total devuelve error controlado.
6. OXXO en modo prueba (cuenta de EE.UU., `currency=mxn`): el PaymentIntent entra en `requires_action` con voucher y pasa a `succeeded` con el método de prueba; la recarga queda `pendiente` hasta el evento y nunca se acredita antes.

**Cobro directo y saldo prepago**

7. Un pedido en efectivo no puede pasar a `cobro=confirmado` sin acción explícita del repartidor; marcar `entrega=entregado` no cambia `cobro`.
8. Aceptar un pedido en efectivo reserva la comisión; si el saldo prepago es menor que la comisión, el pedido en efectivo **no se ofrece** a ese repartidor y sí se ofrecen pedidos con tarjeta.
9. Conciliación: con `monto_recibido = total`, cobra la comisión reservada y marca `conciliado`; con `monto_recibido < total`, marca `con_diferencia`, genera deuda del cliente por la diferencia y no cobra de más al repartidor.
10. Cliente que no paga: el repartidor marca «se niega» → `entrega=no_entregado`, `cobro=no_pagado`, comisión liberada, pago base abonado al repartidor, cliente bloqueado si su deuda supera el umbral configurado.
11. Cancelación después de la compra: el estado es `cancelado_tras_compra` (no `cancelado`), exige foto del ticket y aplica la política configurada sin tocar el saldo prepago salvo que la política lo diga.
12. Propina en efectivo: no entra en `total` conciliable ni en `movimientos` de la plataforma.
13. Recarga por punto de venta: el código solo se canjea una vez (segundo intento devuelve «ya usado»), el canje es atómico (si falla el abono, el código no queda consumido), y tras N intentos fallidos el punto queda bloqueado. Límite de recargas por semana y monto máximo por recarga producen error claro.
14. Tope diario de efectivo: al superarlo, el repartidor deja de ver pedidos en efectivo hasta conciliar o recargar, y ve el aviso con el motivo.
15. Interruptores por país: con `efectivo_activo=false` para EE.UU., ningún cliente puede elegir efectivo y la API rechaza `metodo_pago=efectivo` con error controlado.
16. Saldo nunca negativo: cualquier intento de cargar más de lo disponible falla la transacción entera y queda registrado; la prueba inserta un cargo mayor al saldo y comprueba que el saldo no cambia.

---

## 8. Fuentes (solo aquí; en el chat se nombra el medio)

**Stripe (documentación oficial)**

- Disponibilidad global: https://stripe.com/global
- Cross-border payouts: https://docs.stripe.com/connect/cross-border-payouts
- Service agreement types: https://docs.stripe.com/connect/service-agreement-types
- Required verification information (y su punto final de datos): https://docs.stripe.com/connect/required-verification-information · https://docs.stripe.com/_endpoint/get-requirement-selections-for-platform-country?platformCountry=US
- Global Payouts: https://docs.stripe.com/global-payouts · Requisitos del receptor: https://docs.stripe.com/global-payouts/recipient-requirements
- Precios EE.UU.: https://stripe.com/pricing · Precios de Connect: https://stripe.com/connect/pricing
- Payment method support: https://docs.stripe.com/payments/payment-methods/payment-method-support
- OXXO: https://docs.stripe.com/payments/oxxo
- Bank transfers (SPEI/customer balance): https://docs.stripe.com/payments/bank-transfers
- Payouts to connected accounts: https://docs.stripe.com/connect/payouts-connected-accounts
- Stripe Tax EE.UU.: https://docs.stripe.com/tax/supported-countries/united-states · Florida: https://docs.stripe.com/tax/supported-countries/united-states/collect-tax?tax-jurisdiction-united-states=florida · Guía Florida: https://stripe.com/resources/more/florida-sales-tax-rate
- Disputas: https://docs.stripe.com/disputes/how-disputes-work · https://docs.stripe.com/disputes/responding · https://docs.stripe.com/disputes/api
- Reembolsos: https://docs.stripe.com/refunds · https://support.stripe.com/questions/understanding-fees-for-refunded-payments

**Plataformas de reparto y transporte**

- DoorDash, Cash on Delivery FAQ: https://help.doordash.com/dashers/s/article/Cash-on-Delivery-Overview-and-FAQ
- Uber, términos de pago en efectivo (EE.UU.): https://www.uber.com/us/en/legal/consumer-cash-payment-terms/ · Blog julio 2026: https://www.uber.com/us/en/blog/introducing-cash-payment-for-deliveries/ · Japón: https://www.uber.com/jp/en/drive/delivery/cash-delivery/ · Sudáfrica: https://www.uber.com/za/en/drive/delivery/cash-delivery · Guatemala: https://www.uber.com/gt/es/deliver/basics/making-deliveries/cash-trips
- Rappi, T&C Soy Rappi Colombia: https://legal.rappi.com.co/colombia/terminos-y-condiciones-de-uso-de-plataforma-virtual-rappitendero/ · Deuda Argentina: https://soyrappi.com.ar/deuda/ · Deuda Ecuador: https://soy-rappi.com.ec/deudaec/ · C5N: https://www.c5n.com/sociedad/como-pagar-la-deuda-un-pedido-rappi-cancelado-n134998/amp · iProUP: https://www.iproup.com/economia-digital/3047-Rappi-Uber-Cabify-quien-se-queda-con-tu-pago-en-efectivo-o-tarjeta · Descubre.vc: https://www.descubre.vc/noticia/deuda-r-cord-repartidores-en-argentina-deben-casi-1-000-000-a-rappi-y-pedidos-ya-2026-07-16
- DiDi Food México FAQ: https://web.didiglobal.com/mx/food/repartidores/preguntas-frecuentes/ · Colombia métodos de pago: https://web.didiglobal.com/co/food/repartidores/preguntas-frecuentes/metodos-de-pago-en-didi-food/ · Xataka México sobre préstamos: https://www.xataka.com.mx/aplicaciones/rest-of-world-investigo-prestamos-uber-eats-didi-food-a-repartidores-todo-parece-que-trampa
- Glovo Albania (caída al consultar): https://delivery.glovoapp.com/al/faq/hc_delivering/cash-payments-and-balance/ · Ghana: https://delivery.glovoapp.com/gh/faq/hc_earnings/faq-cash-deposit/ · Guía de riders (Scribd): https://www.scribd.com/document/822754944/EN-Rider-Guide · MB Partner: https://mbpartners.pl/helpdesk/en/cash-balance-in-glovo/ · PAYCOMET: https://www.paycomet.com/faqs/en/glovo-deposits/
- Bolt, cash debt: https://bolt.eu/en-sa/driver/guide/cash-debt/
- inDrive, recarga Colombia: https://indrive.com/en-co/help/drivers/how-to-top-up-your-indrive-account · Egipto: https://indrive.com/en-eg/help/drivers/how-to-top-up-your-indrive-account · Brasil: https://indrive.com/en-br/help/drivers/how-to-top-up-your-indrive-account · Valora Analitik: https://www.valoraanalitik.com/indrive-consolida-su-expansion-en-colombia-y-ofrece-prestamos-a-conductores-con-esta-opcion/ · DPL News Nicaragua: https://dplnews.com/?p=295479
- Yango Colombia: https://yango.com/es_co/driver/ · RCN: https://www.noticiasrcn.com/economia/yango-consolida-su-crecimiento-en-colombia-con-nuevas-herramientas-para-conductores-y-usuarios-973222 · DG Flota Perú: https://dgflota.com/yango.php · Yego T&C Perú: https://yego.pro/pe/T&C.pdf
- Yummy / Venezuela: Chofer Venezuela: https://chofervenezuela.com/cuanto-se-gana-yummy-rides-venezuela/ · Crónica.Uno: https://cronica.uno/cambios-en-formas-de-pago-de-yummy-complican-a-usuarios-conductores-y-repartidores/ · Bloomberg Línea 2022: https://www.bloomberglinea.com/2022/10/17/un-dia-con-un-repartidor-en-venezuela-entre-costos-y-ganancias/ · Ridery (DPL News): https://dplnews.com/?p=233294
- PedidosYa T&C Argentina: https://www.pedidosya.com.ar/terminos-y-condiciones · Nodal: https://www.nodal.am/2026/07/en-argentina-los-repartidores-se-endeudan-con-las-plataformas-para-las-que-trabajan-por-diego-lorca/ · Urgente24: https://urgente24.com/actualidad/pedidosya-repartidores-y-la-deuda-que-enciende-una-fuerte-polemica-n628603
