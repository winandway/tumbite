# Pagos en Venezuela · Cómo puede Tumbite cobrar a clientes y pagar a restaurantes y repartidores venezolanos

**Fecha:** 18 de octubre de 2026. **Quién pidió:** Richard. **Alcance:** solo documentación oficial y páginas públicas (sin cuentas, sin registros, sin navegador interactivo). **Sin dinero real.** Las direcciones de las fuentes están al final de este archivo; en el chat solo se nombra el medio.

**Etiquetas:** [DOC] documentación oficial del banco, regulador o proveedor · [OBS] observación pública (prensa, tiendas de apps, redes del propio actor) · [INF] inferencia nuestra · [NV] no verificable con lo encontrado · [REA] no aplica en esta ficha (no hay artefacto propio ni autorizado que analizar).

---

## Resumen en diez líneas

1. En Venezuela el dinero de la calle se mueve en **bolívares por Pago Móvil** (99 % de las operaciones son pago móvil o punto de venta, según la Asociación Bancaria, enero 2026 [OBS]) y en **dólares en efectivo o Zelle** fuera del sistema bancario local.
2. **Un intermediario que recibe el dinero del cliente y después le paga al comercio** (lo que hace Tumbite con Stripe en EE.UU.) es, en Venezuela, un «Proveedor no Bancario de Servicios de Pago» o una «fintech», y necesita autorización del **BCV** o de **SUDEBAN**. Sin esa autorización, SUDEBAN le cerró las cuentas recaudadoras a **Yummy** en septiembre de 2022 [DOC/OBS].
3. Por eso Yummy, el mayor actor local, cobra el pago móvil **directo del cliente al comercio o al repartidor**, y lo demás con tarjeta internacional, Zelle y efectivo [OBS].
4. **Zelle no tiene API ni checkout** para comercios: es banco a banco de EE.UU., las dos partes con cuenta estadounidense [DOC]. Se usa en Venezuela de forma informal y los bancos de EE.UU. lo han restringido desde allá (Wells Fargo 2020, Chase 2023) [OBS].
5. **Las APIs bancarias que sí existen en público** son las de **Mercantil** (portal de APIs con botón de pago de tarjetas, C2P/pagos móviles, Vuelto, transferencias TED, búsqueda de pagos móviles; pruebas gratis; producción solo para clientes jurídicos con cuenta y Mercantil en Línea Empresas) [DOC] y las de **Activo Banco** (consultas, pago móvil P2C, transferencias, webhooks) [OBS]. Banesco tiene «BanescoPagos» (botón de recaudación) sin documentación técnica pública [OBS]. BNC, BDV, Bancamiga y BBVA Provincial: C2P y cobro con QR desde su banca empresas, **sin API pública encontrada** [NV].
6. **Confirmar que un pago móvil llegó** se puede solo en la cuenta **del titular que da la autorización**: con la API de búsqueda de pagos móviles de Mercantil o con servicios de lectura como **Pabilo** (solo lectura, sin custodiar dinero, webhook firmado) [DOC]. No existe una consulta «abierta» que diga si le llegó a la cuenta de un repartidor en otro banco [INF].
7. **Cripto (Binance Pay/USDT)**: la pasarela local **Crixto** convierte USDT a bolívares y deposita al comercio; SUNACRIP está en reestructuración desde 2023 con prórrogas sucesivas; el BCV prohibió desde 2020 que proveedores no bancarios procesen pagos en divisas [DOC/OBS]. Riesgo regulatorio alto.
8. **IGTF**: 3 % sobre pagos en moneda extranjera o cripto; desde julio de 2024 la alícuota es 0 % para contribuyentes especiales (Decreto 4.972) y sigue en 3 % para los demás [DOC]. La factura de Yummy Rides de 2025 incluye el 3 % adicional si el pago es en divisas [OBS].
9. **Tasa**: la **tasa de referencia del BCV** (promedio ponderado de las mesas de cambio) es la única legal para precios en divisas; la SUNDDE fiscaliza y cierra comercios que usan otra [DOC/OBS]. Tumbite debe fijar precios en USD y convertir a bolívares con la tasa BCV del día.
10. **Decisión recomendada:** empezar como lo hace el mercado y sin tocar dinero venezolano: **pago directo al comercio** (Pago Móvil C2P o P2C del propio restaurante) + **efectivo** (USD o Bs) + **tarjeta internacional vía Stripe** (que ya tenemos). La **dispersión** a restaurantes y repartidores desde Tumbite exige una **empresa venezolana con RIF y cuenta jurídica** y, si Tumbite custodia fondos, la licencia de PSP del BCV. Eso lo decide Richard.

---

## 1. Referencias estudiadas

- **Reguladores:** Banco Central de Venezuela (BCV: Resolución 18-12-01, circular PSP/ASP de julio 2022, comunicado octubre 2020, tipo de cambio de referencia, tarifario de comisiones 2026), SUDEBAN (Resolución 001.21 fintech, circular contra Yummy 2022, lanzamiento de C2P), SENIAT/Ley IGTF (Decreto 4.972), SUNACRIP (reestructuración 2023-2024), SUNDDE (tasa BCV obligatoria).
- **Bancos:** Mercantil (portal de APIs, GitHub oficial), Banesco (BanescoPagos), BNC, Banco de Venezuela, Bancamiga (términos de Pago Móvil), BBVA Provincial (Dinero Rápido), Banplus (documentos C2P), Activo Banco (APIs 2026).
- **Redes:** Suiche 7B y Conexus (operadoras del Pago Móvil interbancario).
- **Pasarelas y agregadores:** Instapago, Credicard (Access Commerce), Megasoft (Merchant Server), PagoFlash, Pabilo, VEXPay, Cashea, Crixto/Binance Pay, Vuelto (de Mercantil), Platco.
- **Dólares fuera del sistema local:** Zelle (preguntas frecuentes oficiales), Binance Pay (documentación de desarrolladores).
- **Competidores en Venezuela:** Yummy, PedidosYa Venezuela, Ridery.
- **Los estudios de Richard** (carpeta «Proyectos Para estudiar y copiar clonar ideas»): no tienen capítulo de Venezuela; esta ficha abre esa brecha [INF].

---

## 2. Evidencia y límites

### 2.1 Pago Móvil interbancario: P2P, P2C y C2P

- **[DOC]** Términos de Bancamiga (2023): «Canal de servicio dirigido únicamente a personas naturales y personas con firmas personales, el cual, a través de una red de servicio interbancario (Suiche7B), utilizando únicamente el número móvil asociado al usuario como el medio para movilizar fondos… Se excluyen a las Personas Jurídicas». Es decir, en ese banco el **P2P es solo para personas**; las empresas cobran por los productos de comercio (P2C/C2P).
- **[DOC]** Banplus (documentos C2P): el comercio «debe estar registrado al cobro C2P de su banco»; la «Clave de pago a Comercios… tendrá un tiempo máximo de uso de cinco (05) minutos»; el servicio corre sobre «las redes Conexus y Suiche 7B».
- **[OBS]** SUDEBAN (presentación del C2P, DPL News): el cliente da al comercio **cédula, teléfono y banco**; recibe por SMS un código (la clave dinámica) que entrega al vendedor; el comercio registra el código y confirma el cobro en tiempo real; «12 bancos» en producción al momento del anuncio.
- **[OBS]** BBVA Provincial (Dinero Rápido, ficha oficial de la App Store): el cliente «autoriza el pago con la clave de compra que le solicitará el comercio (C2P)»; «como cliente jurídico realiza el cobro de tus ventas al generar tu código QR»; afiliación desde «Provinet Empresas móvil».
- **[OBS]** Banco de Venezuela: «Para el caso de comercios, la afiliación se realiza desde BDVenlínea empresas» (La Verdad de Monagas / DPL News). Tiene «Pago Clave a Comercios» por SMS para negocios sin punto de venta (NTN24, sin fecha) y Biopago (huella) para tienda física [DOC manual bio500 2025].
- **[OBS]** Bancamiga fue «primer banco con C2P en el punto de venta» (La Patilla, abril 2021).
- **[DOC/OBS]** Comisiones máximas del BCV vigentes (tarifario Gaceta 46.427 del 31 de julio de 2026 y aviso de la Gaceta Extraordinaria 7.073 del 11 de septiembre de 2026, según Finanzas Digital, 21 de agosto de 2026): **P2P hasta 0,30 %**, **P2C hasta 1,50 %**, **C2P hasta 2 %** (1,75 % si es el mismo banco), con **mínimo de Bs. 14** por operación y cobro también por operaciones rechazadas. Son topes; cada banco fija la suya.
- **[NV]** Límites diarios vigentes de monto para P2P/C2P (los encontrados son de 2018-2024 y por banco). Número exacto de la circular SUDEBAN que obliga el C2P. Si la clave dinámica se exige por norma o la decide cada banco.
- **[INF]** Para Tumbite: el **C2P** es el equivalente venezolano a «cobrar con tarjeta dentro de la app»: el cliente escribe cédula, teléfono, banco y la clave que le llega por SMS; el dinero entra **a la cuenta jurídica del comercio afiliado**. Si el afiliado es el restaurante, el dinero no pasa por Tumbite (modelo Yummy post-2022). Si el afiliado es Tumbite, Tumbite custodia fondos y necesita licencia (sección 2.8).

### 2.2 APIs y botones de pago de los bancos

**Mercantil** (el único con portal público de desarrolladores encontrado):

- **[DOC]** Página «Portal API» de Mercantil Empresas: soluciones «que van desde botón de pago web hasta débito inmediato»; «La utilización de las API en el entorno de desarrollo es gratuita» (basta registrarse, sin ser cliente); para producción hay que «Abre[r] una cuenta corriente», estar afiliado a Mercantil en Línea Empresas («Es necesario estar afiliado a nuestro servicio para utilizar las APIs») y tener app o sitio propio; el uso en producción «tiene un costo» que depende del objeto social (sin montos publicados). Teléfono (0212) 503.25.99; soporte apisupport arroba bancomercantil punto com.
- **[DOC]** Productos listados en el portal según el buscador: «Botón de Pagos Móviles (C2P)» (cobro inmediato por pago móvil interbancario con número de teléfono), API «Vuelto» (devolver cambio digital), botón de pago con **tarjeta** con autenticación **OTP**, y el producto **«Búsquedas de Pagos Móviles»** (producto 21013 del portal). Contratos y anexos publicados para **TED (Transmisión Electrónica de Datos), C2P y tarjetas**.
- **[DOC]** GitHub oficial «apimercantil»: repos «api-playground» (ejemplos para «las distintas API's de Portal de API Mercantil»), «encrypt-examples» (cifrado usado en las APIs), «postman-project» y **«TED»** («Transmisión Electrónica de Datos»: el canal de pagos de empresa, incluidos pagos a terceros).
- **[OBS]** Paquete PHP de terceros (Packagist, 2022): el botón de tarjeta usa cabecera `X-IBM-Client-Id`, «merchant ID» y «clave de cifrado» entregados por el banco; tiene bandera de ambiente de pruebas/producción; cubre «tdc» (crédito/débito) y «tdd» (débito Mercantil).
- **[OBS]** Módulo de Odoo de terceros: integra «la API C2P y Vuelto Digital de Banco Mercantil» en punto de venta.
- **[NV]** El contenido técnico del portal (requiere sesión): campos de la búsqueda de pagos móviles, si TED permite pagos masivos por API a cuentas de otros bancos, tarifas.
- **[INF]** Mercantil es la vía más corta para una integración programática completa en bolívares: cobrar (C2P, tarjeta), confirmar (búsqueda de pagos móviles) y pagar (TED). Requiere una **persona jurídica venezolana cliente de Mercantil**.

**Activo Banco Universal:**

- **[OBS]** Nota de Ecosistema Startup (24 de agosto de 2026): APIs para «empresas, fintech, e-commerce y desarrolladores» con «consulta de pago móvil, transferencias, movimientos de cuentas y tasa de cambio oficial del BCV al instante», «pagos móviles a comercios (P2C) y transferencias internas o externas», «validadores automáticos sobre cada operación y notificaciones mediante Webhooks». Acceso por formulario y acompañamiento técnico. [NV] sandbox, costos y documentación pública.

**Banesco:**

- **[OBS]** Finanzas Digital (9 de noviembre de 2024): **BanescoPagos** son «botones verdes identificados con la imagen de la institución» alojados «en las páginas web o aplicativos móviles de las empresas afiliadas»; el pagador se autentica con BanescOnline; «Banesco también simplifica los pagos a los clientes de otros bancos». La ficha de la app empresarial (App Store) describe la «Suite de BanescoPagos» (cobro presencial y remoto, vuelto, perfiles de empleados), solo para clientes jurídicos con BanescOnline Empresa.
- **[OBS]** Plugin de WordPress de terceros: «el servicio cuenta con API Consulta» para ver el detalle de operaciones; afiliación «con el equipo de Banca en BBU»; moneda bolívares; solo Venezuela.
- **[NV]** Documentación técnica pública, sandbox, comisiones.

**BNC, Banco de Venezuela, Bancamiga, BBVA Provincial:**

- **[OBS]** Todos ofrecen C2P y/o cobro con QR a comercios desde su banca empresas (BNCNET, BDVenlínea empresas, Bancamiga Suite, Provinet Empresas).
- **[NV]** Ninguno tiene portal de desarrolladores público ni documentación de API encontrada. La integración, si existe, se negocia con el banco [INF].

### 2.3 Pasarelas y agregadores

| Actor                    | Qué es (evidencia)                                                                                                                                                                                                                                                                                                                                                                | Para Tumbite                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Instapago**            | [OBS] DPL News: pasarela «en alianza con Banesco» para cobrar con **Visa y Mastercard en bolívares** en la web. Paquete PHP «abandonado» en Packagist. [NV] tarifas, sandbox, requisitos.                                                                                                                                                                                         | Tarjetas nacionales en Bs. Requiere RIF y cuenta Banesco [INF].                                                                           |
| **Credicard**            | [DOC] Sitio oficial, sección Comercios: «Puntos de Venta CredicardPOS», «Botón de pago Access Commerce», «Liquidación en línea por Lote»; sección Banca: «Web Services». [NV] documentación y requisitos del botón.                                                                                                                                                               | Adquirencia de tarjetas nacionales; empresa venezolana.                                                                                   |
| **Megasoft**             | [DOC] Sitio oficial: «Aplicaciones de Recaudación», «Merchant Server», «OnLine Banking». [OBS] vPOS físico que entrega el banco (módulo Odoo). [NV] API pública.                                                                                                                                                                                                                  | Procesador de la banca; no se contrata directo [INF].                                                                                     |
| **PagoFlash**            | [OBS] Fintech venezolana (2013); PagoShop, PagoClick (enlaces). SDK Laravel de terceros (mayo 2026) con «verificación de Pago Móvil» y billetera. [NV] documentación oficial, tarifas, licencia.                                                                                                                                                                                  | Enlaces de pago; verificar licencia PSP antes de usar.                                                                                    |
| **Pabilo**               | [DOC] Sitio oficial: «Pabilo entra al movimiento en la cuenta de tu comercio y confirma si el pago existe de verdad»; solo lectura; «nunca mueve tu dinero ni lo custodia»; bancos BDV, Mercantil, Banesco, Bancaribe, Banco Plaza y Binance; API REST, SDK, webhook firmado; plan plataformas «desde $35 al mes». «no actúa como intermediario financiero ni billetera digital». | **Confirmación automática** de pago móvil/transferencia en la cuenta del restaurante, sin custodiar. Encaja con el modelo «pago directo». |
| **VEXPay**               | [OBS] SDK PHP/Laravel y plugin WooCommerce (octubre 2026): C2P en dos pasos (intent → token SMS), tarjeta, pago móvil, checkout, **merchants y payouts** idempotentes, webhooks firmados, claves de prueba y producción, OTP de prueba desde su portal. [NV] documentación oficial, tarifas, licencia BCV/SUDEBAN.                                                                | Lo más parecido a un «Stripe venezolano»; hay que verificar su autorización antes de confiarle dinero.                                    |
| **Cashea**               | [OBS] Compra ahora y paga después: «inicial más tres cuotas sin interés cada dos semanas», comisión al comercio **3-6 %**, activación «$200 + IVA» (Descubre, marzo 2025); 7.000 comercios, 8 millones de usuarios (Forbes). [NV] API para delivery.                                                                                                                              | No es medio de cobro para comida; es financiación. Fuera de alcance.                                                                      |
| **Vuelto**               | [DOC] Es la **API «Vuelto» de Mercantil** para devolver cambio digital al cliente que paga en efectivo. No existe una app independiente llamada así [NV].                                                                                                                                                                                                                         | Útil si el repartidor cobra efectivo y debe dar vuelto.                                                                                   |
| **Yummy Pay**            | [NV] No existe producto público con ese nombre. Yummy tiene «Saldo» (billetera interna) y Binance Pay en Rides.                                                                                                                                                                                                                                                                   | —                                                                                                                                         |
| **Platco**               | [NV] No apareció en ninguna fuente.                                                                                                                                                                                                                                                                                                                                               | —                                                                                                                                         |
| **Conexus / Suiche 7B**  | [DOC Banplus] Redes interbancarias del Pago Móvil. Sus sitios no resolvieron. Suiche 7B lanzó pago móvil NFC (2025) «en P2P y P2C; eventualmente C2P».                                                                                                                                                                                                                            | No venden a comercios; se entra por un banco [INF].                                                                                       |
| **Crixto + Binance Pay** | Ver 2.5.                                                                                                                                                                                                                                                                                                                                                                          | —                                                                                                                                         |

### 2.4 Zelle

- **[DOC]** Zelle, preguntas frecuentes oficiales: «In order to use Zelle®, the sender and recipient's must have U.S bank accounts». Para negocios: «Contact your bank or credit union to see if they offer Zelle® to eligible small businesses»; se inscribe un correo, un número móvil de EE.UU. o una Zelle tag; «only send money to those you know and trust». **No hay API ni integración de checkout** en la página oficial de negocios.
- **[OBS]** Chase y U.S. Bank lo ofrecen dentro de su banca de negocios (recibir con correo o teléfono); la única API es la de pagos corporativos de J.P. Morgan para **desembolsos**, no para cobrar en una web.
- **[OBS]** Wells Fargo bloqueó Zelle a clientes domiciliados en Venezuela en 2020 y lo repuso al cambiar sus términos; Chase restringió usos desde Venezuela en 2023, asociado a «uso de cuentas personales para recibir pagos de comercios» (Diario Las Américas).
- **[INF]** Para Tumbite, Zelle solo puede ser **«pago fuera de la app» con comprobante** (el cliente paga a la cuenta de EE.UU. de Windoce LLC o del restaurante y sube la referencia) y conciliación manual o por lectura del correo del banco. No hay forma de confirmarlo por API. Riesgo: que el banco de EE.UU. lo considere actividad de comercio con Venezuela y cierre el canal.

### 2.5 Binance Pay / USDT y cripto

- **[DOC]** Documentación de desarrolladores de Binance Pay: «contactless, borderless and secure cryptocurrency payment technology»; cobro C2B con QR y C2C con OAuth; permisos y credenciales con «Binance Merchant Operation». No lista países ni sandbox ni comisiones en la página de introducción. [NV] elegibilidad de un comercio que opera en Venezuela (la página de ayuda devolvió 403).
- **[OBS]** Los términos antiguos de binance.org listan a Venezuela entre «Prohibited Jurisdictions»; los términos de binance.com citados en 2023 no la nombran (lista abierta). Binance retiró al Banco de Venezuela de los métodos P2P por «presión regulatoria» (2024). Venezuela bloqueó el acceso a Binance en 2024 tras las elecciones.
- **[OBS]** **Crixto** (El Diario, 2 de agosto de 2025; La Patilla, 8 de agosto de 2025): fintech «registrada ante la Superintendencia Nacional de Criptoactivos (Sunacrip)»; el cliente paga USDT con QR de Binance Pay y «el comercio recibe el equivalente en bolívares en su cuenta bancaria nacional»; «Crixto se encarga de hacer la conversión automática de USDT a bolívares en tiempo real» a «la tasa vigente, que es dinámica». CriptoNoticias midió un costo 6,98 % peor que vender el USDT en P2P ese día. [NV] comisión oficial y si usa la tasa BCV.
- **[DOC]** BCV, comunicado de octubre de 2020 (vía La Patilla): el BCV **no autorizó a ningún proveedor no bancario a procesar pagos en divisas**; ofrecerlo contraviene la Resolución 18-12-01 (artículos 2.14 y 23). La definición legal de PSP es prestar servicios «en el país y en moneda nacional».
- **[OBS]** SUNACRIP: intervenida y en reestructuración desde marzo de 2023 (Gaceta Extraordinaria 6.739), prorrogada en septiembre de 2023 y marzo de 2024; cese de exchanges licenciados reportado; en 2026 la prensa cripto habla de despidos y de la hipótesis de suprimirla. Licencias de Crixto y Kontigo vigentes hasta finales de 2026/enero 2027 según un agregador [NV].
- **[INF]** Riesgo regulatorio alto y cambiante; además, Windoce LLC es empresa de EE.UU. y el régimen de sanciones de OFAC sobre Venezuela aplica a quien opere desde EE.UU. (no investigado aquí; [NV]). No habilitar cripto en la primera fase.

### 2.6 Efectivo (USD y Bs) y «pago móvil en divisas»

- **[DOC]** Convenio Cambiario N.º 1 (Gaceta Extraordinaria 6.405, 7 de septiembre de 2018): «libre convertibilidad de la moneda en todo el territorio nacional»; su artículo 9 fija que la tasa oficial rige «para todos los efectos legales» (memo Travieso Evans / Diario 2001).
- **[OBS]** ABV (enero 2026): «el 99 % de las transacciones se realizan mediante pagos móviles o puntos de venta»; «el uso de efectivo se concentra principalmente en el transporte público». Prensa de julio de 2026 reporta escasez de billetes en bolívares.
- **[OBS]** El «pago mixto» (parte efectivo en USD, parte pago móvil) es un fenómeno común que ralentiza las cajas (NTN24).
- **[OBS]** «Pago móvil en divisas» (NTN24, septiembre 2021): no es transferencia de dólares, «es sólo una función de venta inmediata de divisas a través de las mesas de cambio»; en 2020 el BCV ordenó cesar productos para pagar bienes y servicios con cargo a cuentas en moneda extranjera [DOC circular BCV].
- **[INF]** El efectivo en USD al repartidor es el método más simple de habilitar y el más usado por los competidores; exige **vuelto** (Vuelto de Mercantil, saldo a favor en billetera como hace Ridery) y controles de caja del repartidor.

### 2.7 Tasa oficial del BCV y reglas de conversión

- **[DOC]** Portada del BCV: «El tipo de cambio publicado por el BCV es el promedio ponderado resultante de las operaciones diarias de las mesas de cambio activas de las instituciones bancarias participantes» (Art. 3, Resolución 19-05-01); publica USD y EUR con **«Fecha Valor»** (al consultar hoy: lunes 19 de octubre de 2026, es decir, el BCV publica la tasa del día hábil siguiente). El valor exacto Bs/USD de hoy no se transcribe aquí porque la lectura automática no permitió confirmar la etiqueta de la cifra [NV]; se lee en la portada o se toma por API de un banco (Activo publica «tasa de cambio oficial del BCV» por API [OBS]).
- **[OBS]** La Ley de Precios Justos obliga a usar la tasa BCV para calcular precios; usar otra puede ser «usura» (artículo 58, según abogado citado por Diario 2001); la SUNDDE cerró comercios por cobrar sobre la tasa BCV (2022) y activó un «Plan Nacional de Verificación del Cumplimiento de la Tasa» (agosto 2024).
- **[INF]** Regla para Tumbite: precios de catálogo en **USD centavos** (como ya hace `dinero.ts`), conversión a Bs **en el momento del cobro** con la tasa BCV vigente a esa fecha valor, redondeo a céntimos de bolívar, guardar en el pedido la tasa usada y la fecha. Nunca tasa paralela.

### 2.8 IGTF

- **[DOC]** Acceso a la Justicia sobre el Decreto 4.972 (Gaceta 6.821 Extraordinario, 12 de julio de 2024, vigente desde el 15 de julio de 2024): «Se fija en cero por ciento (0%) la alícuota del Impuesto a las Grandes Transacciones Financieras» para los sujetos pasivos especiales (numerales 1-4 del artículo 4); «Se mantienen sujetas a la alícuota del tres por ciento (3%)» las transacciones de los numerales 5 y 6: **pagos en moneda distinta a la de curso legal o en criptoactivos** distintos a los emitidos por Venezuela. El decreto «no significa la eliminación de ese impuesto».
- **[OBS]** Simpletv cobra IGTF a quien paga con PayPal y Zelle (2022); facturas de Yummy Rides de 2025 indican «3 % adicional si el pago se realiza en moneda extranjera».
- **[INF]** Si Tumbite (o el restaurante) factura en Venezuela y recibe USD/Zelle/cripto, debe **cobrar y declarar el 3 %** salvo que el pagador esté en el 0 %. Esto es decisión fiscal del contador venezolano, pero el software debe poder **agregar la línea «IGTF 3 %»** al recibo cuando el método sea en divisas.

### 2.9 Requisitos legales para operar como plataforma

- **[DOC]** BCV, Resolución 18-12-01 (Gaceta 41.547, 17 de diciembre de 2018): PSP = «Persona jurídica pública o privada autorizada por el Banco Central de Venezuela para prestar en el país y en moneda nacional, los servicios de pago»; puede «Abrir cuentas transaccionales», «Recibir transferencias de fondos o pagos a ser abonados en una cuenta», «Proveer a los clientes de mecanismos para la recepción de pagos», «Ejecutar transferencias de fondos u órdenes de pago con cargo a una cuenta» (artículo 23); los fondos recibidos «no serán considerados como captación de depósitos» (artículo 25); debe reportar a la UNIF (artículo 26).
- **[DOC]** BCV, circular del 21 de julio de 2022 (requisitos PSP): «capital mínimo suscrito y pagado en bolívares, equivalente a **cien mil (100.000) veces el tipo de cambio más alto** publicado por el Banco Central de Venezuela» (≈ 100.000 USD), «Poseer un mínimo de **cinco (5) accionistas**… y establecer su **domicilio en el territorio nacional**»; cita previa con la UNAMEF (correo Unamef_PSP arroba bcv punto org punto ve); solicitud en papel sellado del Distrito Capital; estados financieros auditados, ISLR de tres años, estructura accionaria hasta personas naturales, plan de negocio, esquema tarifario, modelos de contrato; **las personas jurídicas no domiciliadas** deben presentar declaración jurada de someterse «de manera exclusiva al ordenamiento jurídico venezolano» y «Documento emitido por el ente regulador… en el país de origen», todo «apostillado, notariado y traducido»; 90 días hábiles para iniciar operaciones tras la autorización; si rechazan, 180 días hábiles para volver a solicitar.
- **[DOC]** SUDEBAN, Resolución 001.21 (Gaceta 42.151, 17 de junio de 2021): «Instituciones de Tecnología Financiera del Sector Bancario» = «Toda persona jurídica… nacional o extranjera, autorizada por la Superintendencia»; sociedades anónimas; autorización previa con opinión vinculante del OSFIN; fianza de fiel cumplimiento no menor a **20.000 euros**; contratos con clientes aprobados por SUDEBAN; 120 días hábiles para iniciar; quienes ya operaban, 90 días para adecuarse. Disposición transitoria (artículo 41, según Forvis Mazars): no pueden «publicitar sus servicios en el territorio nacional» sin autorización.
- **[DOC/OBS]** Caso Yummy (Bloomberg Línea, 28 de septiembre de 2022): SUDEBAN prohibió a los bancos abrir «cuentas recaudadoras de fondos para Yummy» y procesar transacciones por ellas, «hasta que Yummy obtenga una nueva autorización»; «la sociedad mercantil PideYummy, S.A., desarrolla procesamiento de pagos, compensación» sin autorización. Yummy pasó a pago móvil «directamente al conductor» y «los pagos van directamente del usuario al comercio aliado… no van a pasar los fondos a través de Yummy» (El Estímulo).
- **[OBS]** Berzus (2022) tuvo que cambiar de nombre porque SUDEBAN consideró que sugería ser un banco.
- **[NV]** Requisitos exactos para que una empresa extranjera abra sucursal o filial (Registro Mercantil, RIF, registro de inversión extranjera) y abra cuenta jurídica: la guía de inversiones 2026 de KPMG Venezuela es la fuente a leer (no se pudo descargar). Impacto de las sanciones de EE.UU. (OFAC) sobre una LLC de Florida que opere en Venezuela: **no investigado; requiere abogado**.
- **[INF]** Conclusión jurídica operativa: **(a)** Tumbite puede operar en Venezuela **sin tocar dinero venezolano** (el cliente paga directo al restaurante o al repartidor, Tumbite cobra su comisión aparte) con mucho menor riesgo regulatorio, como hace Yummy desde 2022; **(b)** recibir el dinero del cliente en una cuenta de Tumbite y repartirlo es «procesamiento de pagos y compensación» y exige empresa venezolana + licencia PSP del BCV (o fintech SUDEBAN); **(c)** aun en el modelo (a), para cobrar la comisión en bolívares a los restaurantes y emitir facturas hace falta **RIF y cuenta jurídica**, es decir, una sociedad venezolana o una franquicia local que facture.

### 2.10 Confirmación bancaria y dispersión

- **[DOC]** Mercantil ofrece «Búsquedas de Pagos Móviles» y TED en su portal; Pabilo lee «el movimiento en la cuenta de tu comercio» y manda «un webhook firmado a tu backend».
- **[OBS]** Activo: «consulta de pago móvil… movimientos de cuentas» y webhooks «cuando cambia el estado de un pago»; VEXPay: «payouts» idempotentes y «onboarding de vendedores como merchants».
- **[INF]** Respuesta a la pregunta clave: **solo se puede verificar la llegada de un pago en una cuenta cuyo titular haya autorizado el acceso** (la cuenta jurídica del comercio en Mercantil/Activo por API, o cualquier cuenta conectada a Pabilo). **No existe una consulta interbancaria abierta** que diga «¿le llegó el pago móvil a la cuenta personal del repartidor X en el banco Y?». Para repartidores hay dos caminos: (1) el repartidor conecta su propia cuenta (Pabilo admite «cuentas personales y jurídicas») y Tumbite recibe el webhook; (2) Tumbite confía en la **referencia de pago + confirmación del repartidor** y cruza con la liquidación semanal, como hacen Yummy y Ridery con el efectivo.
- **[INF]** Dispersión masiva (pagar a cientos de restaurantes y repartidores): por API solo Mercantil TED y Activo «transferencias internas o externas» aparecen en público; los demás bancos lo hacen por **archivo de pagos a proveedores/nómina** en su banca empresas [NV formatos]. Todo exige cuenta jurídica del pagador en Venezuela.

### 2.11 Cómo cobran hoy los competidores

**Yummy**

- **[OBS]** 2021 (red oficial X de Yummy): «Tarjeta de Crédito y Débito, Efectivo, Pago Móvil, Zelle, Venmo, Paypal, Pipol Pay» y Reserve.
- **[OBS]** Septiembre 2022 (El Estímulo, NTN24, Tal Cual, Bloomberg Línea): tras SUDEBAN, quedaron **Zelle, tarjeta internacional y efectivo** dentro de la app; el saldo (billetera) se puede gastar pero no recargar «hasta nuevo aviso»; «Ya Pago Móvil está de vuelta. Ahora podrás realizarlo directamente al conductor»; pagos «directamente del usuario al comercio aliado».
- **[OBS]** Yummy Rides integró **Binance Pay** (solo transporte, stablecoins).
- **[OBS]** Guía de terceros (≈2025): tarjeta internacional Visa/Mastercard, pago móvil o transferencia al momento de la entrega, Zelle, cripto por pasarelas, «Yummy Saldo». Un blog reciente cita el centro de ayuda: «débito inmediato, pago móvil, Zelle, efectivo, tarjeta internacional y saldo», y aclara que «la que vale es la que te muestra la app». Un usuario reportó en 2024 que el correo de Zelle de Yummy para recargar «es inválido».
- **[OBS]** Facturas 2025: «Pago inmediato» y 3 % adicional si se paga en divisas (IGTF).
- **[NV]** Cómo y cuándo liquida a restaurantes y repartidores; comisión. Página oficial del centro de ayuda (no indexada).

**PedidosYa Venezuela**

- **[OBS]** Lanzamiento (Con Café, 2020): «pagar en línea o en efectivo al momento de la entrega». La Guaira (Analítica): pago en línea, efectivo y **pago móvil al momento de la entrega**.
- **[OBS]** HispanoPost («PedidosYa fortalece su plataforma de medios de pago en bolívares», sin fecha legible): flujo de pago móvil en el que la app muestra el monto en bolívares y los datos bancarios, el usuario transfiere desde su banco y vuelve a la app; la opción pasó de «Efectivo y otros» a «PedidosYa Pagos».
- **[OBS]** Enero 2026 (El Diario): PedidosYa, Yummy y Farmatodo suspendieron el servicio desde el 3 de enero por las operaciones militares de EE.UU.; Uber anunció la compra de Delivery Hero (incluye PedidosYa Venezuela), cierre esperado en 2027.
- **[NV]** Centro de ayuda oficial de Venezuela; si aceptan tarjetas internacionales; cómo pagan a comercios y repartidores.

**Ridery**

- **[OBS]** Arepa Tecnológica (2021, actualizado 2023): «Zelle, pago móvil, efectivo en divisas, tarjeta internacional» y Wallet recargable; si no hay cambio en efectivo, el monto a favor «sea abonado a tu Wallet».
- **[OBS]** Fichas oficiales en App Store/Google Play: «Mejoramos el flujo de error en Pago Móvil»; guardar «tarjetas para pagar con Mastercard o Visa de cualquier banco»; PayPal en versiones anteriores; «Débito Inmediato» para recargas con bonos; en la app de conductores «al crear un viaje en efectivo podrás elegir la moneda en la que el cliente realizará el pago».
- **[OBS]** Valora Analitik (4 de marzo de 2026): «el conductor recibe el 75 % del valor total, mientras que la plataforma retiene el 25 %».
- **[NV]** Cómo y en qué moneda retiran los conductores; Binance no aparece.

**Patrón común [INF]:** nadie cobra solo dentro de la app; todos combinan **tarjeta internacional + efectivo (USD/Bs) + pago móvil directo al que entrega o al comercio + Zelle fuera de la app + billetera interna prepagada**. La billetera prepagada fue justamente lo que SUDEBAN le frenó a Yummy (recarga suspendida), así que no se copia en la primera fase.

---

## 3. Comparación con Tumbite (lo que hay hoy)

| Pieza                              | Tumbite hoy                                                                                                                                                          | Venezuela exige                                                                                                 | Brecha                                                                                                                                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moneda                             | Todo en **centavos USD** (`packages/compartido/src/dinero.ts`); zonas con campo `moneda` (3 letras, por defecto `USD`) y `pais` (`apps/servidor/src/rutas/zonas.ts`) | Precios en USD a tasa BCV y cobro en **VES** o USD efectivo                                                     | Falta tabla de **tasa BCV por fecha valor**, conversión al cobrar, redondeo a céntimos de Bs, y guardar tasa+fecha en el pedido                                                                                                                                                  |
| Cobro al cliente                   | Stripe dentro de la app (PaymentIntent, `apps/servidor/src/rutas/pedidos.ts`), con autorizar/capturar al entregar (C-COBRO-AL-ENTREGAR)                              | Pago móvil C2P/P2C, efectivo, Zelle con referencia, tarjeta internacional                                       | Falta el concepto de **método de pago por pedido** distinto de Stripe: «efectivo», «pago móvil al comercio», «pago móvil al repartidor», «Zelle con referencia»; falta captura de **referencia + comprobante** y estados «pago declarado / pago confirmado / pago no encontrado» |
| Confirmación                       | Webhook de Stripe                                                                                                                                                    | Lectura de la cuenta del comercio (Mercantil API, Pabilo) o confirmación manual                                 | Falta un **conector de confirmación** por país/proveedor y una cola de conciliación                                                                                                                                                                                              |
| Pago a restaurantes y repartidores | Saldo interno + **retiros vía Stripe** con idempotencia (`apps/servidor/src/retiros.ts`, apagados)                                                                   | Transferencias en Bs desde cuenta jurídica venezolana (TED, archivo) o **modelo directo** sin pasar por Tumbite | Falta el modelo **«el dinero no pasa por Tumbite»**: el pedido se marca «cobrado por el restaurante/repartidor» y Tumbite registra **la comisión por cobrar**, que se liquida aparte                                                                                             |
| Impuestos                          | Ninguno específico                                                                                                                                                   | IVA 16 % e **IGTF 3 %** en divisas                                                                              | Falta línea de impuesto configurable por zona y por método                                                                                                                                                                                                                       |
| Entidad                            | Windoce LLC (Florida), Stripe EE.UU.                                                                                                                                 | RIF, empresa venezolana o franquicia local que facture; licencia PSP si custodia                                | Decisión de Richard (sección 6)                                                                                                                                                                                                                                                  |
| Docs públicos                      | Guías en `/docs` bilingües                                                                                                                                           | Guía «Cómo pagar en Venezuela» (cliente, restaurante, repartidor)                                               | Se escribe junto con la función                                                                                                                                                                                                                                                  |

---

## 4. Decisión recomendada

### 4.1 Orden de habilitación (qué primero y por qué)

1. **Catálogo en USD + tasa BCV + recibo en Bs (sin cobrar nada nuevo todavía).** Es la base legal de todo lo demás (Ley de Precios Justos). Fuente de la tasa: lectura diaria de la portada del BCV con respaldo manual del superadmin; más adelante, API de un banco (Activo, Mercantil). Guardar `tasa_bcv`, `fecha_valor` y `total_bs` en el pedido.
2. **Efectivo al repartidor (USD o Bs) con vuelto y caja del repartidor.** No requiere entidad local ni licencia; es el método que todos los competidores tienen. Reglas: el repartidor declara moneda y monto recibido; el vuelto se puede abonar como **saldo a favor del cliente** (como Ridery) en vez de billetes. La comisión de Tumbite y el pago al restaurante quedan como **cuentas por cobrar/pagar** en bolívares o USD, liquidadas fuera del flujo del pedido.
3. **Pago móvil directo al restaurante (P2C/C2P del propio restaurante).** El restaurante registra en su perfil sus datos de Pago Móvil (banco, teléfono, RIF) y, si tiene, su afiliación C2P. La app muestra al cliente los datos y el monto en Bs a tasa BCV; el cliente paga desde su banco y escribe la **referencia**; el restaurante confirma en su app (o se confirma solo si conectó su cuenta a Pabilo o a la API de Mercantil). El dinero **no pasa por Tumbite** (modelo Yummy 2022). Repartidor: igual, para su tarifa de entrega si el restaurante no la cubre; requiere que el repartidor sea persona natural afiliada a Pago Móvil (regla Bancamiga).
4. **Tarjeta internacional vía Stripe** (ya existe): se mantiene para clientes con tarjeta de EE.UU. u otra internacional. Nota: Stripe no procesa tarjetas emitidas en Venezuela de forma fiable y no liquida en Bs [INF]; la liquidación sigue en USD a Windoce LLC.
5. **Zelle con referencia** a la cuenta de EE.UU. que decida Richard (de Windoce LLC o del restaurante si la tiene): el cliente paga fuera de la app y sube referencia; confirmación manual o por lectura del correo del banco. Solo si Richard acepta el riesgo de que el banco de EE.UU. lo cuestione (caso Chase 2023).
6. **Confirmación automática** del pago móvil: integrar **Pabilo** (lectura, webhook firmado, desde 35 USD/mes para plataformas) o la API de Mercantil para los restaurantes que tengan cuenta allí. Requiere que el restaurante autorice la lectura de su cuenta.
7. **Cobro centralizado y dispersión desde Tumbite** (que el cliente le pague a Tumbite y Tumbite reparta): **solo con empresa venezolana + licencia PSP del BCV** (capital ≈ 100.000 USD, cinco accionistas, domicilio en Venezuela) o alianza con un PSP ya autorizado (verificar en el Registro Especial del BCV: VEXPay, PagoFlash u otro). Es la Etapa final, no la primera.
8. **Cripto (Binance Pay vía Crixto u otro agregador licenciado):** no habilitar hasta que SUNACRIP salga de la reestructuración y un abogado confirme el encuadre OFAC para una LLC de EE.UU.

### 4.2 Lo que requiere entidad local (resumen)

| Capacidad                                                   | ¿Necesita empresa venezolana con RIF?                 | ¿Necesita licencia BCV/SUDEBAN?                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Mostrar precios en Bs a tasa BCV                            | No                                                    | No                                                                                         |
| Efectivo al repartidor                                      | No (el dinero es del restaurante/repartidor)          | No                                                                                         |
| Pago móvil directo al restaurante o repartidor              | No para Tumbite; sí el restaurante (su propia cuenta) | No                                                                                         |
| Tarjeta internacional por Stripe                            | No                                                    | No (es EE.UU.)                                                                             |
| Zelle a cuenta de EE.UU.                                    | No                                                    | No (riesgo bancario en EE.UU.)                                                             |
| Confirmación automática con Pabilo/Mercantil API            | No para Tumbite; la cuenta es del restaurante         | No                                                                                         |
| Cobrar la comisión de Tumbite en Bs y facturar en Venezuela | **Sí** (RIF, factura fiscal, IVA)                     | No                                                                                         |
| Recibir el pago del cliente y repartirlo (custodia)         | **Sí**                                                | **Sí** (PSP del BCV o fintech SUDEBAN)                                                     |
| Dispersión masiva a repartidores en Bs                      | **Sí** (cuenta jurídica pagadora)                     | No si el dinero es propio de Tumbite (comisiones ya cobradas); sí si es dinero de terceros |
| Billetera prepagada para clientes                           | **Sí**                                                | **Sí** (es lo que SUDEBAN frenó a Yummy)                                                   |

### 4.3 Arquitectura propuesta (compatible con lo que existe)

- Nuevo campo en el pedido: `metodo_pago` (`stripe` | `efectivo` | `pago_movil_comercio` | `pago_movil_repartidor` | `zelle`), `moneda_cobro` (`USD` | `VES`), `tasa_bcv`, `fecha_valor`, `total_bs`, `referencia_pago`, `estado_pago` (`pendiente` | `declarado` | `confirmado` | `no_encontrado` | `reembolsado`), `igtf_centavos`.
- Tabla `tasas_bcv` (fecha_valor, usd_bs, eur_bs, fuente, cargado_por). Columna nueva en tabla existente → va a `esquemaColumnas.ts` (regla de migraciones).
- Perfil del restaurante y del repartidor: datos de Pago Móvil (banco, teléfono, cédula/RIF), opción «acepto efectivo USD/Bs», opción «conectar mi cuenta para confirmación automática» (Pabilo).
- Módulo `conciliacion` por país: en Venezuela, el pedido con `estado_pago = declarado` espera confirmación del receptor o del webhook; si en N minutos no llega, el Manager (Tumbite AI, Etapa 5) avisa.
- Comisión de Tumbite: en los métodos directos no se descuenta del pago; se registra como **cuenta por cobrar al restaurante** y se liquida en la factura semanal (o se compensa contra lo que Tumbite le deba por pagos con Stripe).
- Candado: prueba que falle si un pedido en Venezuela se guarda sin `tasa_bcv` o si `total_bs` no coincide con `total_usd × tasa` redondeado; prueba que falle si un método en divisas no lleva línea de IGTF cuando la zona lo exige.

---

## 5. Pruebas de aceptación

1. **Tasa BCV:** dado un pedido de 12,50 USD en una zona `VE` con tasa cargada para la fecha valor, el recibo muestra el total en Bs = 1250 × tasa / 100 redondeado a 2 decimales; sin tasa cargada para ese día, el pedido no se puede crear y el superadmin recibe aviso. Prueba en rojo primero.
2. **Efectivo:** el repartidor marca «cobré 15 USD en efectivo» sobre un total de 13,20 USD; el sistema registra vuelto 1,80 USD como saldo a favor del cliente (si el cliente aceptó) o como vuelto entregado; la caja del repartidor refleja el ingreso y la deuda con el restaurante y con Tumbite.
3. **Pago móvil directo:** el cliente elige «Pago Móvil al restaurante»; ve banco, teléfono, RIF, monto en Bs y tasa; escribe la referencia (4-8 dígitos); el pedido queda `declarado`; el restaurante confirma desde su app → `confirmado` y el pedido avanza; si el restaurante marca «no llegó» → `no_encontrado` y el pedido no se prepara.
4. **Confirmación automática:** con un webhook simulado de Pabilo (firma válida, misma referencia y monto en Bs), el pedido pasa a `confirmado` sin intervención; con firma inválida o monto distinto, no cambia y queda registro de alarma. Nunca se pega al servicio real en pruebas (msw).
5. **IGTF:** pedido pagado con Zelle o efectivo USD en zona `VE` con `igtf_activo = 1` → el recibo muestra «IGTF 3 %» calculado sobre el total en divisas; con `igtf_activo = 0` no aparece; en pago móvil en Bs nunca aparece.
6. **Comisión por cobrar:** tras un pedido pagado directo al restaurante, el estado de cuenta del restaurante muestra la comisión de Tumbite como deuda; el reporte semanal la suma y la compensa con lo que Tumbite le deba por pedidos de Stripe.
7. **Prohibiciones:** en zona `VE` la app no ofrece «recargar saldo» ni «billetera» mientras la bandera `custodia_ve` esté apagada; la prueba falla si aparece.
8. **Docs:** existe la guía «Cómo pagar en Venezuela» / «How to pay in Venezuela» en `/docs`, en los dos idiomas, con capturas reales de la app.

---

## 6. Lo que solo Richard puede dar

1. **La decisión de negocio sobre la entidad:** operar en Venezuela mediante (a) franquicia local que factura y cobra en Bs, (b) empresa venezolana propia de Windoce, o (c) solo con el modelo «el dinero no pasa por Tumbite» sin facturar en Bs por ahora. Ninguna de las tres la puede tomar la IA.
2. **Abogado venezolano** (o el contador) para: constitución o sucursal, RIF, IVA, IGTF, Ley de Precios Justos, y si procede la licencia PSP del BCV. Y **abogado en EE.UU.** para el encuadre de sanciones (OFAC) de una LLC de Florida que opere en Venezuela.
3. **Cuentas bancarias:** si se va por Mercantil o Activo, la **cuenta jurídica** y la afiliación a Mercantil en Línea Empresas (y las credenciales del portal de APIs, que solo entrega el banco al cliente). Si se usa Zelle, **qué cuenta de EE.UU.** recibe y la aceptación del riesgo de cierre.
4. **Contratación de Pabilo** (o el proveedor de confirmación que elija) y sus credenciales, cuando llegue el paso 6.
5. **Tasa BCV diaria:** autorizar la lectura automática de la portada del BCV (o la API de un banco) como fuente oficial, con él como respaldo manual.
6. **Si algún día se quiere cripto:** la autorización explícita por escrito (regla global de billeteras y pagos automáticos) y el contrato con un agregador licenciado.

---

## 7. Tabla resumen

| Método                                                                                    | Cómo funciona                                          | API / confirmación                                  | Costo conocido                              | Licencia / entidad                                                         | Riesgo                                          | Orden        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- | ------------ |
| Precios a tasa BCV                                                                        | Catálogo USD → Bs al cobrar                            | Portada BCV (fecha valor); API Activo               | Gratis                                      | No                                                                         | Bajo (obligatorio)                              | 1            |
| Efectivo USD/Bs al repartidor                                                             | Cliente paga al entregar; vuelto o saldo a favor       | Declaración del repartidor; caja                    | 0                                           | No                                                                         | Medio (robo, vuelto, IGTF 3 % en USD)           | 2            |
| Pago Móvil P2C/C2P al restaurante                                                         | Cliente paga desde su banco con referencia o clave SMS | Confirmación del restaurante; Pabilo; API Mercantil | P2C ≤1,5 %, C2P ≤2 %, mín. Bs 14 (tope BCV) | Restaurante con cuenta jurídica afiliada; Tumbite no                       | Bajo-medio (conciliación)                       | 3            |
| Pago Móvil P2P al repartidor                                                              | Cliente paga la entrega al repartidor                  | Declaración + referencia; Pabilo en cuenta personal | P2P ≤0,30 %, mín. Bs 14                     | Repartidor persona natural afiliada                                        | Medio                                           | 3            |
| Tarjeta internacional (Stripe)                                                            | Como hoy                                               | Webhook Stripe                                      | Stripe EE.UU.                               | No                                                                         | Bajo (pocos clientes con tarjeta internacional) | 4            |
| Zelle                                                                                     | Fuera de la app, con referencia                        | Manual / correo del banco; **sin API**              | 0                                           | Cuenta de EE.UU.                                                           | Alto (cierre de canal, IGTF, sin reversa)       | 5            |
| Confirmación automática (Pabilo)                                                          | Lee la cuenta del comercio, webhook firmado            | API REST + SDK                                      | Desde 35 USD/mes (plataformas)              | No custodia                                                                | Bajo                                            | 6            |
| Tarjetas nacionales en Bs (Instapago/Banesco, Mercantil botón, Credicard Access Commerce) | Pasarela de adquirencia local                          | OTP; API Mercantil                                  | [NV]                                        | **Empresa venezolana** cliente del banco                                   | Medio                                           | 7            |
| Cobro centralizado + dispersión (TED Mercantil, Activo, VEXPay payouts)                   | Tumbite recibe y reparte                               | API TED / webhooks / payouts                        | [NV]                                        | **Empresa venezolana + PSP del BCV** (≈100.000 USD capital, 5 accionistas) | Alto (caso Yummy)                               | 8            |
| Binance Pay/USDT (Crixto)                                                                 | QR Binance → Bs al comercio                            | API agregador                                       | ≈7 % peor que P2P (medición de prensa)      | Agregador licenciado SUNACRIP (en reestructuración)                        | Muy alto (BCV 2020, SUNACRIP, OFAC)             | No por ahora |
| Cashea                                                                                    | Cuotas                                                 | [NV]                                                | 3-6 % + 200 USD activación                  | Comercio afiliado                                                          | No aplica a comida                              | —            |

---

## 8. Lo que no se pudo verificar (lista corta)

- Texto completo del portal de APIs de Mercantil (requiere sesión): campos de la búsqueda de pagos móviles, alcance de TED para terceros, tarifas de producción.
- Documentación técnica de BanescoPagos, BNC, BDV, Bancamiga, BBVA Provincial (ninguna pública).
- Tarifas y licencias de VEXPay, PagoFlash, Instapago; estado del Registro Especial de PSP del BCV (no accesible por certificado).
- Centros de ayuda oficiales de Yummy y PedidosYa Venezuela (no indexados); condiciones de liquidación a comercios y repartidores de los tres competidores.
- Valor numérico de la tasa BCV de hoy (la portada carga, pero la etiqueta de la cifra no se pudo confirmar en la lectura automática).
- Límites diarios vigentes de Pago Móvil; número de la circular SUDEBAN del C2P.
- Elegibilidad de Venezuela en Binance Pay Merchant hoy; estado final de SUNACRIP en 2026.
- Régimen de sanciones de EE.UU. aplicable a Windoce LLC: fuera de alcance, requiere abogado.

---

## Fuentes (solo aquí; en el chat se nombra el medio)

**Reguladores**

- BCV, Resolución 18-12-01: https://www.bcv.org.ve/system/files/documentos_juridicos/resolucion_n_18-12-01.pdf
- BCV, circular requisitos ASP y PSP (21 jul 2022): https://www.bcv.org.ve/system/files/documentos/circular_asp_y_psp_de_los_aspectos_operativos_jul-2022.pdf
- BCV, circular reactivación autorizaciones PSP (jul 2022): https://www.bcv.org.ve/system/files/documentos/circular_reactivacion_del_proceso_de_autorizaciones_para_psp_def_lul-2022.pdf
- BCV, portada con tipo de cambio de referencia: https://www.bcv.org.ve/
- BCV, circular suspensión de pagos en divisas con cuentas en moneda extranjera: https://www.bcv.org.ve/system/files/documentos/circular_suspension_pagos_en_divisas.pdf
- Comunicado BCV octubre 2020 sobre PSP y divisas (La Patilla): https://lapatilla.com/2020/10/09/bcv-chavista-suspendio-pagos-de-bienes-y-servicios-en-divisas-a-traves-de-proveedores-no-bancarios/
- SUDEBAN Resolución 001.21 fintech (Acceso a la Justicia): https://accesoalajusticia.org/sudeban-regula-servicios-de-tecnologia-financiera-fintech/
- Fintech, artículo 41 y PSP (Forvis Mazars): https://www.forvismazars.com/ve/en/insights/forvis-mazars-insights/fintech
- IGTF Decreto 4.972 (Acceso a la Justicia): https://accesoalajusticia.org/fijada-en-cero-por-ciento-0-la-alicuota-del-impuesto-a-las-grandes-transacciones-financieras-igtf/
- IGTF boletín PwC (jul 2024): https://www.pwc.com/ve/es/publicaciones/assets/PublicacionesNew/Boletines/Modificaci%C3%B3n%20de%20la%20Al%C3%ADcuota%20de%20IGTF%202%20al%200%20(Julio%202024).pdf
- SUNACRIP reestructuración (Acceso a la Justicia): https://accesoalajusticia.org/prorrogado-el-plazo-para-el-proceso-de-reestructuracion-de-la-sunacrip/
- Convenio Cambiario N.º 1 (Finanzas Digital): https://finanzasdigital.com/goe-6405-convenio-cambiario/
- Tasa BCV obligatoria y SUNDDE (La Patilla 2024): https://lapatilla.com/2024/10/03/el-dolar-paralelo-resurge-a-escondidas-en-venezuela-tras-meses-de-fingida-estabilidad-cambiaria/
- SUNDDE cierra comercios por tasa (El Diario 2022): https://eldiario.com/2022/08/22/sundde-cerro-comercios-catia-dolar-en-bs-8/
- Comisiones Pago Móvil 2026 (Finanzas Digital): https://finanzasdigital.com/como-hacer-un-pago-movil-pasos-y-comisiones/
- Aviso BCV Gaceta Ext. 7.073 (Finanzas Digital): https://finanzasdigital.com/bcv-limites-comisiones-bancarias-septiembre-2026/
- SUDEBAN presenta C2P (DPL News): https://dplnews.com/venezuela-sudeban-presento-un-pago-movil-para-que-los-comercios-cobren-a-los-clientes/
- SUDEBAN contra Yummy (Bloomberg Línea): https://www.bloomberglinea.com/2022/09/28/sudeban-prohibe-a-entidades-bancarias-venezolanas-la-apertura-de-cuentas-o-transacciones-de-yummy/

**Bancos y redes**

- Mercantil Portal API (empresas): https://www.mercantilbanco.com/empresas/servicios-digitales/canales-digitales/portal-apis-empresas
- Mercantil API Developer Portal: https://apiportal.mercantilbanco.com/mercantil-banco/produccion/
- Mercantil producto Búsquedas de Pagos Móviles: https://apiportal.mercantilbanco.com/mercantil-banco/produccion/product/21013
- Mercantil contratos y anexos API: https://www.mercantilbanco.com/mercprod/apiportal/epagos/license/index.html
- Mercantil GitHub oficial: https://github.com/apimercantil
- Paquete PHP de terceros Mercantil: https://packagist.org/packages/josepratolopez/mercantil-ve
- Módulo Odoo Mercantil C2P y Vuelto (terceros): https://apps.odoo.com/apps/modules/19.0/l10n_ve_pos_mercantil_c2p
- Activo Banco APIs (Ecosistema Startup): https://ecosistemastartup.com/activo-banco-universal-lanza-apis-para-empresas-en-venezuela/
- BanescoPagos (Finanzas Digital): https://finanzasdigital.com/banescopagos-mejora-la-experiencia-de-recaudacion/
- Banesco app empresas (App Store): https://apps.apple.com/us/app/-/id6449720919
- Plugin WordPress Botón Banesco (terceros): https://ja.wordpress.org/plugins/botonbanesco-internet-banking-payment-gateway/
- Bancamiga términos Pago Móvil: https://www.bancamiga.com/wp-content/uploads/2023/04/FO.CE_.007.V4.0323-Terminos-y-condiciones-generales-del-servicio-Pago-Mov.pdf
- Bancamiga C2P en POS (La Patilla): https://lapatilla.com/2021/04/15/bancamiga-primer-banco-con-c2p-en-el-punto-de-venta-y-expande-gama-de-servicios-en-los-pos/
- BBVA Provincial Dinero Rápido (App Store): https://apps.apple.com/us/app/-/id1521629585
- Banplus C2P: https://www.banplus.com/uploads/ahora_puedes_hacer_tus_pagos_a_comercios_con_c2p_de_banplus.pdf
- Banplus condiciones Pago Plus: https://banplus.com/wp-content/uploads/2025/04/CONDICIONES-PAGO-PLUS.pdf
- BDV Pago Clave a Comercios (NTN24): https://www.ntn24.com/noticias-economia/banco-de-venezuela-activo-pago-clave-a-comercios-para-negocios-sin-punto-de-venta-97139
- BDV manual Biopago bio500 (2025): https://biopagobdv.com/media/filer_public/96/3a/963a4b5e-6db5-44aa-9de3-59218c86018f/manual_de_uso_bio500_15122025.pdf
- BNC app (App Store): https://apps.apple.com/mx/app/bnc/id1635259975
- Suiche 7B NFC (Bloomberg Línea): https://www.bloomberglinea.com/latinoamerica/venezuela/como-funciona-el-pago-movil-nfc-en-el-banco-de-venezuela-todo-lo-que-debe-saber/
- Pago móvil en divisas (NTN24 2021): https://www.ntn24.com/noticias-economia/pago-movil-en-divisas-la-nueva-transaccion-que-ofrecen-algunos-bancos-venezolanos-384945
- Pagos digitales 99 % (Finanzas Digital, ene 2026): https://finanzasdigital.com/banca-venezolana-pagos-digitales-enero-2026/

**Pasarelas y agregadores**

- Pabilo: https://pabilo.app/
- Pabilo plugin WooCommerce: https://es-mx.wordpress.org/plugins/pabilo-payment-gateway-for-woocommerce/
- VEXPay SDK PHP: https://packagist.org/packages/vexpay/vexpay-php
- VEXPay Laravel: https://packagist.org/packages/vexpay/laravel
- Instapago (DPL News): https://dplnews.com/?p=185118
- Instapago paquete (Packagist): https://packagist.org/packages/instapago/instapago
- Credicard: https://www.credicard.com.ve/
- Megasoft: https://www.megasoft.com.ve/
- Megasoft módulo Odoo vPOS (terceros): https://apps.odoo.com/apps/modules/19.0/l10n_ve_pos_megasoft
- PagoFlash (Lendsqr): https://lendsqr.com/providers/pagoflash
- PagoFlash SDK Laravel (terceros): https://packagist.org/packages/gerarjos14/laravel-pagoflash
- Cashea condiciones (Descubre): https://www.descubre.vc/noticia/condiciones-de-cashea-para-comercios-afiliados-2025-03-31
- Cashea en Forbes (Finanzas Digital): https://finanzasdigital.com/forbes-cashea-procesa-35-del-pib-con-300-millones-mensuales-en-transacciones/

**Zelle y cripto**

- Zelle internacional: https://www.zelle.com/faq/can-i-use-zelle-internationally
- Zelle negocios: https://www.zelle.com/business
- Chase Zelle negocios: https://www.chase.com/business/banking/services/online-banking/zelle
- Restricciones Zelle Venezuela (Diario Las Américas): https://www.diariolasamericas.com/america-latina/algunos-bancos-eeuu-bloquean-el-uso-zelle-venezuela-n5346881
- Wells Fargo y Zelle Venezuela (El Diario 2020): https://eldiario.com/2020/06/05/wells-fargo-aclara-el-motivo-de-la-suspension-del-servicio-de-zelle-en-cuentas-particulares/
- Binance Pay documentación: https://developers.binance.com/docs/binance-pay/introduction
- Binance Pay ayuda comercios: https://merchant.binance.com/en/help
- Binance Pay Onchain industrias restringidas: https://developers.binance.com/en/docs/products/connect-2.0/basics/10.restricted-industries
- Crixto y Binance Pay (El Diario): https://eldiario.com/2025/08/02/binance-pay-crixto-pagos-usdt-venezuela/
- Crixto cinco claves (La Patilla): https://lapatilla.com/2025/08/08/crixto-y-binance-pay-cinco-claves-sobre-su-acuerdo-para-pagos-con-usdt-en-venezuela/
- Costo Crixto vs P2P (CriptoNoticias): https://www.criptonoticias.com/comunidad/crixto-binance-opiniones-pagos-usdt-venezuela/
- Binance restricciones Venezuela 2024 (La Patilla): https://lapatilla.com/2024/08/11/las-restricciones-de-binance-en-venezuela-y-como-mantener-resguardados-los-fondos/

**Competidores**

- Yummy métodos 2021 (X oficial): https://twitter.com/yummy_superapp/status/1416875223853502472
- Yummy solo dólares 2022 (El Estímulo): https://elestimulo.com/elinteres/empresas/2022-09-29/yummy-solo-aceptara-dolares-por-que-y-cuales-son-las-opciones-para-los-usuarios/
- Yummy cambia métodos (NTN24): https://www.ntn24.com/noticias-economia/yummy-venezuela-cambia-sus-metodos-de-pagos-tras-sancion-de-sudeban-401021
- Yummy reestructura cobro (Tal Cual): https://talcualdigital.com/yummy-reestructura-su-metodo-de-cobro-via-pago-movil-por-prohibicion-de-la-sudeban/
- Yummy Rides Binance Pay (CriptoNoticias): https://www.criptonoticias.com/comunidad/adopcion/servicio-taxis-yummy-integra-pagos-binance-pay-venezuela/
- Yummy guía de terceros: https://infografiar.com/yummy/
- PedidosYa Venezuela lanzamiento (Con Café): https://www.con-cafe.com/2020/11/02/pedidos-ya-venezuela-comida-lista-supermercado-y-mensajeria/
- PedidosYa La Guaira (Analítica): https://www.analitica.com/emprendimiento/noti-tips/pedidosya-enciende-su-app-en-la-playa-atendiendo-a-usuarios-de-la-guaira/
- PedidosYa medios de pago en bolívares (HispanoPost): https://hispanopost.com/pedidosya-fortalece-su-plataforma-de-medios-de-pago-en-bolivares/
- Suspensión enero 2026 (El Diario): https://eldiario.com/2026/01/04/reportaron-suspension-temporal-servicio-a-domicilio-algunas-plataformas-venezuela/
- Ridery métodos (Arepa Tecnológica): https://arepatecnologica.com/conoce-a-ridery-el-uber-de-venezuela
- Ridery app (App Store): https://apps.apple.com/ve/app/ridery-viajes-seguros/id1553877900
- Ridery conductores (App Store): https://apps.apple.com/ve/app/ridery-conductores/id1553878292
- Ridery comisión 75/25 (Valora Analitik, mar 2026): https://www.valoraanalitik.com/?p=559884
- Pago mixto (NTN24): https://www.ntn24.com/noticias-economia/pago-mixto-el-fenomeno-unico-en-venezuela-que-ralentiza-el-proceso-de-pago-407874

**Entidad extranjera**

- Guía de Inversiones 2026 KPMG Venezuela (no descargada, pendiente de lectura): https://assets.kpmg.com/content/dam/kpmg/ve/pdf/2026/3/Gu%C3%ADa%20de%20Inversiones%202026.3.pdf
