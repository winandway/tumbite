# Pagos en Venezuela para Divoox: cobrar con pago móvil y pagar a restaurantes y conductores

Fecha: 16 de noviembre de 2026. Piloto: El Vigía y Tucaní, estado Mérida.
Puesto: investigador. Para alguien no técnico.

Etiquetas: [DOC] = leído hoy en una fuente pública. [TERCERO] = documentación de un tercero, no oficial del banco. [NV] = no verificado, no encontramos fuente. «Opinión nuestra» = conclusión de este informe, no sale de una fuente.

---

## 1. Respuesta corta

**Para cobrar al cliente:** sí existe forma de que el pago móvil quede confirmado solo. Hay dos caminos y conviene usar los dos.

1. **Cobro C2P por la API de un banco (el cliente pone teléfono, cédula, banco y un código que le llega por mensaje).** Mercantil lo ofrece con un plan llamado «Botón de Pagos Móviles (C2P) y Vuelto» [TERCERO: módulo de Odoo]. Es el que más se parece a «pagar con tarjeta» dentro de la app.
2. **El cliente paga por pago móvil normal y la plataforma confirma sola.** Activo Banco Universal abrió en agosto de 2026 una sección de APIs con pagos móviles a comercios, validadores automáticos y avisos automáticos (webhooks) [DOC]. Banesco tiene una «Suite» para empresas que valida en tiempo real los pagos móviles recibidos de cualquier banco, pero el artículo no menciona que tenga API [DOC].

**Qué usar (opinión nuestra):**

- Cobro: abrir cuenta jurídica en bolívares en Mercantil y activar C2P por su API. En paralelo, pedir a una pasarela local (Pabilo, Ubii) que confirme pagos móviles de cualquier banco por webhook, para no depender de un solo banco. De Pabilo sí leímos que verifica por webhook; de Ubii y las demás no hay documentación pública.
- Pago a restaurantes y conductores: **no existe, según lo que encontramos, una API pública venezolana de pago masivo comprobada.** Para el piloto, usar el servicio de pago de nómina o proveedores por archivo del banco (los bancos venezolanos lo ofrecen, por ejemplo Sofitasa, y el BCV lo reconoce como «lotes») [DOC]. Preguntar a Payelu o Conomy si dan pago móvil saliente por API [TERCERO].
- **Stripe y Stripe Connect no sirven en Venezuela:** Venezuela no está en la lista oficial de 51 países de Stripe leída hoy [DOC]. Se puede usar Stripe solo si Divoox opera en otro país donde sí exista.
- Dólares: Binance Pay vía Crixto es lo único con cobro comercial real [DOC]; Zelle no es para cobrar a comercios.

**Lo que NO está comprobado y hay que preguntar antes de prometer nada:** comisiones de cada pasarela, tiempo de activación, y si algún banco da pago masivo por API. Ninguno de esos datos es público en lo que leímos.

---

## 2. Cómo funciona el pago móvil hoy (pregunta 1)

- **P2P:** persona a persona. Quien paga envía desde su banco con el teléfono y cédula del receptor. Comisión máxima 0,30 % con mínimo Bs. 14 [DOC].
- **P2C:** persona a comercio. El cliente paga como si fuera a una persona, pero a la cuenta del comercio. Máximo 1,50 %, mínimo Bs. 14 [DOC].
- **C2P:** comercio a persona. El comercio inicia el cobro: el cliente da cédula, celular y banco, recibe un SMS con un código, se lo da al comercio y este confirma en tiempo real [DOC: Sudeban, marzo de 2021; en esa fecha 12 bancos estaban en producción]. Máximo 2 %, mínimo Bs. 14; dentro del mismo banco, 1,75 % [DOC: Finanzas Digital, agosto de 2026]. Cada banco puede cobrar menos. El mínimo fijo pesa mucho en pagos pequeños.
- **Vuelto:** Banesco permite devolver el cambio al cliente por pago móvil desde el punto de venta [DOC].

**Cómo lo hacen las apps grandes:**

| App       | Lo que encontramos                                                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yummy     | Aceptaba pago móvil, Zelle, tarjetas, PayPal y Yape (2022); Binance Pay solo en transporte, no en delivery, sin comisión [DOC: criptonoticias, 2022]. Es la app líder: 94 % de uso en delivery, según Ecoanalítica [DOC]. Los métodos actuales dentro de la app: [NV]. |
| Ridery    | Dice haber adaptado los métodos de pago a Venezuela; tiene unos 28.000 conductores [DOC]. Métodos concretos: [NV].                                                                                                                                                     |
| PedidosYa | Reclamos de usuarios indican que pago móvil existe pero a veces tarda en acreditarse [DOC: tuquejasuma, no oficial].                                                                                                                                                   |
| Cashea    | Exige al aliado una cuenta receptora en bolívares y dólares, con pago móvil activo en la de bolívares [DOC: ayuda de Cashea]. Más de 6.000 aliados (2025) [DOC].                                                                                                       |
| Zoom      | Es casa de cambio: entrega remesas por pago móvil [DOC]. No es un caso de cobro de delivery.                                                                                                                                                                           |

**Cómo liquidan estas apps a restaurantes y conductores: [NV].** No encontramos una fuente que lo explique. Opinión nuestra: lo más probable es transferencia o pago móvil desde sus cuentas, por lotes, con reglas de pago semanales o diarias.

---

## 3. Tabla comparativa de opciones (preguntas 2, 4 y 5)

Todas las comisiones y tiempos de activación marcados [NV] hay que pedirlos por escrito al proveedor.

| Opción                                     | ¿API para cobrar con confirmación automática?                                                                                                                                     | ¿Paga a terceros?                                                                     | Qué se sabe                                                                                                                                                     | Requisitos conocidos                                                         | Comisión                                                               | Tiempo de activación |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------- |
| Mercantil (API C2P)                        | Sí: flujo de dos pasos (autenticación con código y cobro) [TERCERO]                                                                                                               | «Vuelto» incluido en el plan [TERCERO]                                                | Portal de APIs en apiportal.mercantilbanco.com; plan «Botón de Pagos Móviles (C2P) y Vuelto»; hay que certificar una transacción en pruebas antes de producción | Cuenta jurídica Mercantil, afiliación a C2P, registro en el portal [TERCERO] | Tope del BCV 2 % (1,75 % mismo banco) [DOC]; la tarifa del banco: [NV] | [NV]                 |
| Activo Banco Universal                     | Sí: pagos móviles a comercios, validadores y webhooks [DOC]                                                                                                                       | Transferencias internas y externas [DOC]                                              | Sección de APIs abierta, anunciada el 24 de agosto de 2026; acompañan la integración                                                                            | Formulario de registro; el resto: [NV]                                       | [NV]                                                                   | [NV]                 |
| Banesco (Suite)                            | Validación de pagos móviles recibidos de cualquier banco; la API no se menciona [DOC]                                                                                             | Vuelto por pago móvil [DOC]                                                           | 14.511 clientes jurídicos registrados a septiembre de 2025                                                                                                      | Cliente jurídico, afiliar cada servicio [DOC]                                | [NV]                                                                   | [NV]                 |
| Banco de Venezuela                         | Consulta de pago móvil por API (cédula, monto, banco origen) [TERCERO, página retirada]                                                                                           | [NV]                                                                                  | Sin documentación oficial encontrada                                                                                                                            | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| BNC, Bancamiga, Provincial, Bancaribe, BDT | [NV]                                                                                                                                                                              | [NV]                                                                                  | No encontramos documentación pública de API para pago móvil                                                                                                     | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Pabilo (pasarela)                          | Sí: enlace de pago, Pago Móvil y transferencias de varios bancos, confirmación por webhook; reconoce Banco de Venezuela, Mercantil, Banesco y Provincial [DOC: página del plugin] | [NV]                                                                                  | Existe plugin para WooCommerce y API                                                                                                                            | Cuenta en pabilo.app y cuenta bancaria receptora [DOC]                       | [NV]                                                                   | [NV]                 |
| Ubii Pagos                                 | [NV]                                                                                                                                                                              | [NV]                                                                                  | Fintech venezolana de 10 años [DOC: descubre.vc]; su app Cobro Activo existe; sin documentación pública de API                                                  | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Instapago                                  | Cobro con tarjetas Visa y Mastercard en bolívares, en alianza con Banesco [DOC: DPL News]                                                                                         | No                                                                                    | Más orientada a tarjetas                                                                                                                                        | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Megasoft (Conexus, PayGo)                  | Procesa pagos en puntos de venta, incluso con cripto; no encontramos API pública de pago móvil [DOC]                                                                              | [NV]                                                                                  | Aparece como proveedor de cobro electrónico en manuales de Galac                                                                                                | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Credicard                                  | Solo hallamos AccessPay, app para personas [DOC]                                                                                                                                  | [NV]                                                                                  |                                                                                                                                                                 | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Sypago, Cobra Fácil, BotonDePago           | No encontramos nada verificable                                                                                                                                                   | [NV]                                                                                  |                                                                                                                                                                 | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Conomy / Payelu (terceros globales)        | Conomy: cobro por pago móvil, moneda VES [TERCERO]                                                                                                                                | Payelu: pago móvil saliente por API, campos: cédula, banco, cuenta y nombre [TERCERO] | Documentación con inconsistencias en los ejemplos                                                                                                               | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Binance Pay vía Crixto                     | Sí: el cliente escanea QR y paga USDT; el comercio recibe bolívares [DOC, agosto de 2025]                                                                                         | No                                                                                    | Crixto registrada ante Sunacrip; meta de 20.000 comercios; la tasa no sería la oficial del BCV                                                                  | [NV]                                                                         | [NV]                                                                   | [NV]                 |
| Zelle                                      | No hay API de cobro para comercios                                                                                                                                                | No                                                                                    | Cobrar a comercios con cuentas personales expone a que el banco estadounidense suspenda Zelle [DOC: nota de julio de 2026]                                      |                                                                              |                                                                        |                      |
| Zinli, Reserve, Wally                      | No encontramos API de cobro comercial [DOC: búsquedas]                                                                                                                            | No                                                                                    | Zinli y Wally son wallets de usuario; Reserve solo envíos entre usuarios y retiros                                                                              |                                                                              |                                                                        |                      |
| **Stripe + Connect**                       | Sí, pero **no disponible en Venezuela** [DOC]                                                                                                                                     | Sí, reparto automático a socios                                                       | Modelo de referencia                                                                                                                                            | Entidad en país soportado                                                    | Según país                                                             | Según país           |

**Lo que ofrece Stripe Connect y lo que no existe aquí (opinión nuestra):** Stripe cobra con tarjeta, descuenta su comisión y reparte solo a cada restaurante y conductor con una cuenta verificada. En Venezuela, ninguna fuente que leímos ofrece las tres cosas juntas. Hoy hay que armar las piezas por separado: cobro (API del banco o pasarela), registro del reparto dentro de Divoox, y pago saliente (lote del banco o pago móvil saliente).

---

## 4. Cómo funcionaría en Divoox (opinión nuestra)

### Cobro al cliente

1. El cliente elige «Pago móvil» al pedir.
2. **Camino A, C2P:** pone cédula, teléfono y banco, recibe el código por SMS y lo escribe en la app. Divoox llama a la API del banco y el pedido se marca como pagado en segundos.
3. **Camino B, pago móvil normal con confirmación:** la app muestra los datos de la cuenta y el monto exacto; el banco o la pasarela avisa por webhook que llegó el pago y la app lo asocia al pedido por cédula, monto y referencia.
4. **Plan de respaldo:** efectivo contra entrega y captura de comprobante revisada a mano, solo mientras se activan las APIs.
5. Dólares: Binance Pay vía Crixto, solo si Richard decide ofrecerlo.

### Pago a restaurantes y conductores

1. Divoox lleva dentro un libro de cuentas: cuánto se cobró, cuánto es de cada restaurante, cuánto de cada conductor, cuál es la comisión de Divoox.
2. **Cierre diario o semanal:** se genera un archivo con todos los pagos y se carga en la banca empresarial como pago a proveedores o nómina (así lo describen contratos venezolanos y el BCV) [DOC]. Hay que preguntar el formato y si hay carga por API.
3. Alternativa: pago móvil saliente por API de una pasarela como Payelu [TERCERO]; solo viable después de confirmar comisiones y límites.
4. Comisión: el pago por lote suele cobrar por cada instrucción [DOC: tarifario de Banplus]. Con 500 comercios, un mínimo de Bs. 14 por pago ya pesa; conviene pagar semanal y no diario a los restaurantes pequeños (opinión nuestra).

### Piloto en El Vigía y Tucaní

Empezar con pocos restaurantes y conductores: así los pagos por lote se pueden hacer a mano mientras se activa la automatización. Los pagos por API se activan antes de ampliar.

---

## 5. Qué hace falta para activarlo (opinión nuestra, salvo lo marcado)

1. **Empresa venezolana con RIF y cuenta jurídica en bolívares** en el banco elegido. Mercantil lo exige [TERCERO]. Que sea obligatorio para Divoox si el titular es una empresa de EE.UU.: [NV], preguntar al banco.
2. Afiliar pago móvil y C2P en la cuenta, registrarse en el portal de APIs, probar en modo certificación y pasar a producción [TERCERO].
3. Que las apps de Apple y Google lo acepten: pago móvil es un pago de bien físico (comida y viajes), no compra digital; revisarlo con el auditor de tiendas antes de subir.
4. Facturación fiscal y registro del INTT: una nota de agosto de 2026 dice que las plataformas de delivery con conductores afiliados necesitan autorización e inscripción en el INTT, seguros y revisiones de motos [DOC]. No habla de pagos. El requisito legal completo se queda para revisión de Richard.
5. Conciliación: cada pedido debe poder cruzarse con el movimiento del banco.

---

## 6. Riesgos

- **Cobros que no llegan o se duplican.** Se registró en mayo de 2026 que usuarios de Banesco, Mercantil y Banco de Venezuela tuvieron transferencias retenidas y lentitud en quincena [DOC: El Diario]. Plan: reintento, estado «pendiente» y conciliación diaria.
- **Dependencia de un solo banco.** Por eso se recomiendan dos caminos.
- **Documentación de terceros no oficial.** Lo de Mercantil C2P que leímos viene de un módulo de Odoo y de una guía de terceros; confirmar con el banco antes de programar.
- **Comisiones que cambian** por decisión del BCV (los topes de agosto de 2026 ya cambiaron); el mínimo de Bs. 14 pesa en pedidos pequeños.
- **Irreversibilidad:** los pagos instantáneos suelen ser finales [DOC: Lightspark, empresa que vende otra tecnología]. Un pago a un restaurante equivocado no se recupera fácil; validar la cuenta antes de pagar.
- **Cumplimiento:** conservar facturas digitales 10 años y evitar lavado de dinero [DOC: Lightspark; fuente parcial, sin atribuir]. Revisión legal: Richard.
- **Zelle y cripto:** Zelle puede ser suspendido si se usa para cobrar como comercio; Binance Pay vía Crixto no tiene confirmación oficial de Binance sobre la alianza [DOC]; Zinli ha tenido denuncias de recargas no acreditadas (marzo de 2026) [DOC].
- **Las sanciones de EE.UU.** siguen vigentes; la flexibilización de julio de 2026 va hasta el 29 de enero de 2027 [DOC: Deutsche Welle vía Teletica]. Si Divoox tiene entidad en EE.UU., consultar a un abogado.
- **Fecha de las fuentes:** varios artículos de prensa tienen fechas de 2026 y no pudimos cruzarlos con la fuente original del BCV. Los topes de comisión hay que confirmarlos en la circular vigente del BCV.

---

## 7. Preguntas para hacerle a cada banco o pasarela (es lo que falta para decidir)

1. ¿Tienen API de cobro C2P y de confirmación de pago móvil recibido (P2C)? ¿Con webhook?
2. ¿Tienen pago saliente por API (pago móvil o transferencia) y por archivo? ¿Cuántos pagos por lote y qué tope diario?
3. Comisión por cobro y por pago; mínimo mensual.
4. Requisitos: cuenta jurídica, RIF, si acepta una empresa con operación en dólares.
5. Tiempo desde la solicitud hasta producción.
6. Cómo se concilian los movimientos (informe diario, API).

---

## Pendientes para Richard (👤)

- Decidir con qué banco abrir cuenta jurídica en bolívares (Mercantil y Activo son los que muestran API; Banesco tiene validación).
- Autorizar a Gerencia a contactar a Pabilo, Ubii y los bancos para pedir comisiones y plazos. No se creó ninguna cuenta ni se pidió ningún registro para este informe.
- Revisión legal del modelo de pagos (comercios, conductores, fiscal, INTT).

---

## Fuentes (todas leídas o consultadas el 16 de noviembre de 2026)

Oficiales o de prensa con datos de primera mano:

- Stripe, países soportados: https://stripe.com/global
- Activo Banco Universal lanza APIs (24 ago 2026): https://ecosistemastartup.com/activo-banco-universal-lanza-apis-para-empresas-en-venezuela/
- Suite BanescoPagos (20 ene 2026): https://finanzasdigital.com/suite-banesco-pagos-comercios-tercer-trimestre-2025/
- Comisiones del pago móvil (21 ago 2026): https://finanzasdigital.com/como-hacer-un-pago-movil-pasos-y-comisiones/
- Sudeban presenta el C2P (marzo de 2021): https://dplnews.com/venezuela-sudeban-presento-un-pago-movil-para-que-los-comercios-cobren-a-los-clientes/
- Instructivo del BCV, movimiento transaccional (lotes): https://bcv.org.ve/system/files/documentos/instructivo_movimiento_transaccional_julio_2024.pdf
- Circular del BCV sobre sistemas de pago (2022): https://www.bcv.org.ve/system/files/documentos/circular_asp_y_psp_de_los_aspectos_operativos_jul-2022.pdf
- Contrato de pago de nómina por lote de Sofitasa: https://sofitasa.com/uploads/sofinet-empresas/contrato_pago_nomina.pdf
- Tarifario Banplus (pago a proveedores): https://www.banplus.com/wp-content/uploads/2025/11/Tarifario-Banplus-09-10-2025.pdf
- Portal de APIs de Mercantil (solo mostró el título): https://apiportal.mercantilbanco.com
- Ayuda de Cashea para aliados: https://intercom.help/cashea/es/articles/6206657-que-necesito-para-ser-un-aliado-cashea
- Obligaciones de plataformas de delivery (21 ago 2026): https://finanzasdigital.com/venezuela-fija-nuevas-obligaciones-para-las-plataformas-de-delivery/
- Encuesta de Ecoanalítica sobre delivery: https://finanzasdigital.com/delivery-venezuela-2026-ecoanalitica/
- Yummy y Binance Pay (abril de 2022): https://www.criptonoticias.com/comunidad/adopcion/servicio-taxis-yummy-integra-pagos-binance-pay-venezuela/
- Crixto y Binance Pay (agosto de 2025): https://www.criptonoticias.com/comunidad/adopcion/crixto-binance-pay-usdt-bolivares-comercios-venezuela/
- Zelle y bancos de EE.UU. (julio de 2026): https://www.diariolasamericas.com/america-latina/algunos-bancos-eeuu-bloquean-el-uso-zelle-venezuela-n5346881
- Flexibilización de sanciones (Deutsche Welle vía Teletica): https://www.teletica.com/amp/internacional/ee-uu-suaviza-controles-financieros-a-venezuela-tras-sismos_414399
- Problemas bancarios, mayo de 2026: https://eldiario.com/2026/05/15/problemas-bancos-venezolanos/
- Wallets y cripto en Venezuela: https://finanzasdigital.com/criptomonedas-y-wallets-redefinen-como-se-paga-en-venezuela/
- Zinli, denuncias: https://www.criptonoticias.com/comunidad/denuncian-bloqueos-wallet-zinli-venezuela/ (resultado de búsqueda, no abierto)
- Ubii Pagos, 10 años: https://www.descubre.vc/noticia/ubii-pagos-celebra-10-a-os-transformando-el-ecosistema-financiero-en-venezuela-2026-05-05 (resultado de búsqueda, no abierto)
- Instapago: https://dplnews.com/?p=185118 (resultado de búsqueda, no abierto)

De terceros, no oficiales (confirmar con el banco):

- Módulo de Odoo para C2P de Mercantil: https://apps.odoo.com/apps/modules/19.0/l10n_ve_pos_mercantil_c2p
- Pabilo, plugin de WooCommerce: https://es.wordpress.org/plugins/?p=283698
- Payelu, pago móvil saliente: https://docs-payelu-bullet.pages.dev/payout-pm
- Conomy, cobro por pago móvil: https://conomy-docs.pages.dev/payments/origins-and-destinations/pago-movil/
- Lightspark, pagos instantáneos en Venezuela (empresa con interés propio): https://www.lightspark.com/knowledge/instant-payments-venezuela
- Guía de Mercantil C2P en Mintlify (resultado de búsqueda): https://www.mintlify.com/Zeto96/tmt-doc-6/api-reference/payments/mercantil
- Guía de Banco de Venezuela en Mintlify (devolvió error 410, ya no está): https://www.mintlify.com/Zeto96/tmt-doc-6/banking/banco-de-venezuela
