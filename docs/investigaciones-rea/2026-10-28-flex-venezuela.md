# Divoox Flex en Venezuela: cómo funciona la última milla y qué nos falta

Ficha de investigación REA · 28 de octubre de 2026 · Divoox Flex (software de logística y última milla para empresas de logística y comercios; Divoox no tiene camiones).

Evidencia REA exportada: `docs/investigaciones-rea/evidencia-rea-flex-venezuela-2026-10-28.json` (10 registros, 0,58 MB, sin comprimir porque no pasa de 5 MB).

## 0. Alcance, método y límites

- **Método:** navegador Chromium sin interfaz lanzado por REA en modo `launch` (perfil temporal vacío), solo páginas públicas como visitante. Se complementó con descarga directa de las mismas páginas públicas (texto), documentación pública de los proveedores y prensa.
- **Límites que se respetaron:** no se descompiló ninguna app, no se usó ninguna cuenta, no se inició sesión, no se tocó nada que pidiera login o reto anti-robots, no se capturó tráfico ajeno (solo la lista de peticiones del propio navegador de prueba, sin cuerpos ni cabeceras).
- **Etiquetas:** [REA] evidencia de REA con su evidence_id · [OBS] observación pública directa · [DOC] documentación publicada · [INF] inferencia nuestra · [NV] no verificable.
- **Dónde se paró:**
  - `mrw.com.ve` no responde desde EE. UU. (el DNS resuelve a una IP de Venezuela, la conexión no contesta). El sitio activo de MRW Venezuela es `mrwve.com` [OBS].
  - `domesa.com.ve` no responde desde EE. UU.; `domesa.com` muestra «Coming Soon» [OBS]. Domesa quedó sin investigar [NV].
  - `pedidosya.com.ve` responde 403 (bloqueo de robots o por país): se paró ahí [OBS].
  - `ridery.app` es una página que solo funciona con JavaScript y sin información pública de envíos; no se siguió [NV].
  - El portal de recolección de Tealca y el de empresas de Zoom (`mi.zoom.red`) piden cuenta: no se entró [OBS].

### Registros REA de esta investigación

| evidence_id                                                         | Qué se capturó                                                                         | Fecha      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| ev_7ce8647dfd13984bbfbf08c4d3b03170718b453d7fb15fedb32d77eb48e30909 | Portada de MRW Venezuela (mrwve.com), árbol de accesibilidad                           | 2026-10-28 |
| ev_9549ecdb365300a139a04bb04a81cc60f04f7645585d98d47fff1c640c8d1e53 | Rastreo público de MRW con una guía de prueba (ver hallazgo de privacidad, §1.6)       | 2026-10-28 |
| ev_4c8ab478394c4c8c5ef54ef5863426ce674c1195f03987df664779aca74ec28a | Página de rastreo de Zoom (zoom.red), formulario                                       | 2026-10-28 |
| ev_4e2df516bd070490287e92355579aa841454c9f47dea920b1315d7d015d1e7ea | Intento de rastreo Zoom (falló el selector del botón; sirve como registro del intento) | 2026-10-28 |
| ev_1ac7738d1395076f475a2a134f28359c6a561bc599a696b13b0982151620ba14 | Rastreo de Zoom con guía inválida «PRUEBAINVALIDA»                                     | 2026-10-28 |
| ev_3c53ec14dbc2f0614a273e94029891360d0b9976ce19fd493d113e9b407bc492 | Portal de recolección de Tealca (recolectas.tealca.com)                                | 2026-10-28 |
| ev_c8fb9f2ee516b61628e4c467d376640aeedde94ea372708ecfc33d0154e65ef1 | Portada de Yummy (yummysuperapp.com): B2B última milla, Corporate, Wink                | 2026-10-28 |
| ev_46a982df87f130d4a2e7cb2fefdda4328305f3ad66052abe0af06ff6d77d09a5 | Onfleet, página de precios                                                             | 2026-10-28 |
| ev_f837c5f0579f7d9603b047145c97de6f4503353de482c46f0d2eda5d60ac8023 | Routific, página de precios                                                            | 2026-10-28 |
| ev_8a293a3fe1de75624cfdfd5c3c998d88d2af8c4b0bdd2b5befbf4b373a57f06b | Shipday, página de precios                                                             | 2026-10-28 |

---

## 1. MRW Venezuela, paso a paso

Fuente principal: mrwve.com (portada, «Hacer mi envío», «Corporativos», «Preguntas frecuentes», «Calculadora»), consultadas el 28 oct 2026.

1. **Dónde se recibe.** En agencia: 250 agencias, 17 plataformas, 3.600 poblaciones, horario lunes a viernes 8:00 a 17:00 y algunas los sábados 8:00 a 12:00 [OBS, mrwve.com/servicios y /preguntas-frecuentes]. El buscador de agencias filtra por estado (los 24) y por «agencias más cercanas» [REA ev_7ce8…0909 · OBS mrwve.com/mi-envio]. No hay recolección a domicilio para personas en la web pública; para empresas, «recoger, organizar y distribuir la carga» se ofrece a agentes de carga [OBS mrwve.com/corporativos].
2. **Datos que piden** [OBS mrwve.com/preguntas-frecuentes]:
   - Remitente y destinatario: nombre, apellido, **número de cédula**, teléfono y correo.
   - Destino: **código y nombre de la agencia destino**, o, si es a domicilio, «la dirección correctamente, detallando un **punto de referencia**».
   - **Declaración de contenido** (lo que se envía exactamente; frágil o líquido se avisa en taquilla).
   - Límites: hasta 80 kg y largo + alto + ancho ≤ 300 cm. Medicinas: factura y récipe, máximo 12 unidades.
3. **Guía y número.** La guía se entrega al hacer el envío; el destinatario necesita «la foto de la guía… donde se refleje el número de tracking» [OBS]. En el único resultado que devolvió el rastreo, el número de seguimiento tenía 15 dígitos y empezaba con los 4 primeros dígitos del código de la agencia origen seguidos de los 4 primeros de la agencia destino y un correlativo [REA ev_9549…1e53] → **el número de guía codifica origen y destino** [INF, una sola muestra].
4. **Etiqueta impresa.** No hay imagen pública de la guía en el sitio [NV]. Lo que sí se ve en el rastreo: agencia origen, destinatario con cédula, agencia destino, peso y número de seguimiento [REA ev_9549…1e53].
5. **Rastreo público.** Un solo campo «Introduce tu tracking» en la portada; al enviar llama a `POST /api/tracking` del propio sitio y abre una ventana «Tracking» con: Agencia Origen (código y nombre), Destinatario (nombre y cédula), Agencia Destino, Peso, Número de seguimiento y una lista de eventos con fecha y hora [REA ev_9549…1e53]. En la muestra, todos los íconos de estado tenían el texto alternativo «ENTREGADO», también los eventos anteriores a la entrega [REA] → los nombres reales de cada escaneo no se pudieron leer [NV].
6. **Hallazgo de privacidad (importante para nuestro diseño).** Escribimos una guía inventada de once ceros y el rastreo **devolvió el envío real de un tercero**, con su nombre completo y su cédula [REA ev_9549…1e53]. Es decir: el rastreo acepta coincidencias parciales y muestra datos personales sin pedir nada más. En la evidencia exportada esos datos están **redactados**. No se hizo ninguna otra consulta a MRW. Para Divoox: el rastreo público nunca debe mostrar cédula ni nombre completo, y el código debe ser largo e imposible de adivinar (ya lo hacemos con un identificador opaco; ver §8).
7. **Entrega.** Agencia (por defecto) o domicilio [OBS]. Plazo 24 a 72 horas según origen y destino [OBS]. En agencia hay **5 días hábiles** para retirar; después se devuelve al origen [OBS].
8. **Prueba de entrega en agencia.** El destinatario presenta «su cédula de identidad laminada en original y el número de tracking». Un tercero puede retirar con autorización escrita, copia de la cédula del destinatario y de la persona autorizada [OBS].
9. **Cobro.** Pago en origen o **Cobro en Destino (COD)**: lo paga quien recibe al retirar. Los métodos de pago «puede solicitar la información en la agencia» (no se publican) [OBS]. Tarifa por peso, con calculadora: agencia o domicilio, sobre o paquete [OBS mrwve.com/calcula-envio].
10. **Seguro («resguardo»).** Opcional, 3 % del valor declarado sin IVA, cubre de 1 a 600 dólares; **obligatorio** para teléfonos y electrónicos, con factura [OBS].
11. **Reclamos.** Aviso inmediato a la agencia, 3 días hábiles para formalizar, respuesta en 7 días hábiles; los reclamos de Mercado Libre los hace el vendedor [OBS].
12. **Empresas.** «Tarifas especiales», «tracking moderno», call center, formulario de contacto (empresa, contacto, teléfono, correo) [OBS mrwve.com/corporativos]. No hay panel, API ni importación publicada [NV].

## 2. Grupo Zoom (zoom.red), paso a paso

Fuente: zoom.red (grupozoom.com redirige a zoom.red), consultado el 28 oct 2026.

1. **Dónde se recibe.** En oficina («taquilla») o con aliados; para empresas, logística tercerizada, «red de cobranzas extrabancarias», casilleros [OBS zoom.red/home-empresas].
2. **Datos que piden** (envío con cobro en destino, 6 pasos): nombre, apellido, **C.I.**, dirección, teléfono celular y correo del remitente y del destinatario; se revisa el contenido; el remitente **firma la guía** y recibe una **constancia** [OBS zoom.red/envios-cod-personas].
3. **Seguro.** «El Servicio de Protección de Encomienda es obligatorio» en COD [OBS].
4. **Recepción.** «Puerta a Puerta» o «Retiro por Oficina ZOOM»; si es en oficina, llega un **SMS cuando la encomienda está disponible**; el destinatario revisa el embalaje y **firma la prueba de entrega** [OBS zoom.red/recibir-envio-personas].
5. **Rastreo público.** Formulario con «Nro Guía» y tipo de consulta (Envíos o Remesas MTCN). Al rastrear, la página se recarga con la guía en la dirección (`?nro-guia=…&tipo-consulta=1`); con una guía inválida no apareció mensaje visible en el árbol de accesibilidad (el resultado se pinta en un marco aparte) [REA ev_4c8a…c28a y ev_1ac7…a14]. Los nombres de los estados no se publican [NV].
6. **Medios de pago** [OBS zoom.red/medios-de-pago-personas]: en línea: pago móvil en bolívares, tarjeta de crédito en bolívares y en divisas, transferencia en bolívares, **Zelle** en dólares, **PayPal**; en taquilla: pago móvil, **efectivo en bolívares y dólares**, tarjetas de débito y crédito. En COD el destinatario puede pagar con pago móvil, Zelle, transferencia o tarjeta [OBS recibir-envio-personas].
7. **Tecnología para empresas.** Portal mi.zoom.red y «conectarse vía API con ZOOM (host-2-host)» [OBS zoom.red/herramientas-tecnologicas]. El detalle de la API no es público [NV].
8. **Marketing.** Sorteo «Con ZOOM tu envío tiene ruedas»: el cliente registra su número de guía para concursar (autorizado por la SUNDDE) [OBS, publicado el 14 sep 2026] → la guía también es un activo de fidelización [INF].

## 3. Tealca, Domesa, Liberty Express y apps locales

- **Tealca** (tealca.com, 28 oct 2026):
  - Más de 110 a 115 oficinas y franquicias [OBS].
  - Rastreo por **Guía o Pre-Guía**; estados visibles: «En tienda», «En tránsito», «Entregado», con tabla Código · Estado · Ciudad · Zona · Estatus y botón para **compartir el estado por WhatsApp** [OBS tealca.com/rastrear-envio].
  - Modalidades de pago para empresas: **contado, COD, crédito empresarial con factura quincenal, prepagado** («protegerse de la inflación pagando su envío anticipadamente») y **casillero nacional** (mensualidad con cupo de 10 kg) [OBS tealca.com/hacer-envio].
  - Sobre hasta 500 g; carga hasta 80 kg por pieza; tarifa urbana (Gran Caracas) y nacional única [OBS].
  - Entrega: oficina (después de las 11 a. m. del día hábil siguiente) o domicilio (48 horas) [OBS].
  - Recolecta a domicilio: requisitos mayor de edad, teléfono, correo y dirección de remitente y destinatario, **C.I. o pasaporte del destinatario**; recolección en 24 horas, no fines de semana; tarifa calculada por distancia desde la oficina; si el peso no coincide, llaman para ajustar [OBS tealca.com/recolecta].
  - **El portal de recolección está fuera de servicio**: «Estamos trabajando en una nueva versión de esta página», y remite a correo y WhatsApp [REA ev_3c53…c492]. Oportunidad directa para Divoox Flex [INF].
  - Para domicilio piden rotular «nombre completo, cédula, teléfono activo y dirección detallada con **puntos de referencia específicos**» [OBS, blog del 28 sep 2026].
- **Domesa:** sin acceso desde EE. UU. [NV].
- **Liberty Express** (libertyexpress.com): internacional y casilleros; publica en su portada los **datos de pago móvil** (banco, RIF, teléfono) y una cuenta corriente para transferencias; pago en origen o destino; delivery a domicilio [OBS]. Esto muestra que en Venezuela el pago se concilia «a mano» con referencia [INF].
- **Yummy** (yummysuperapp.com) [REA ev_c8fb…5ef1]:
  - **Yummy B2B «Última milla»**: «entregas en menos de 30 minutos, integración por API, **cobro en efectivo con retorno al comercio** y seguimiento en tiempo real», 35 ciudades.
  - **Yummy Corporate**: «viajes, mandaditos y envíos nacionales en un solo panel», centros de costo, **factura consolidada cada 15 días**, 40 ciudades.
  - **Wink by Yummy**: agente de IA en WhatsApp que toma pedidos, cobra y despacha, «integrado con la flota de entregas de Yummy».
  - Pagos visibles en la portada: pago móvil en bolívares, Zelle, tarjeta; precios en dólares con equivalente en bolívares [REA].
  - Es el competidor local más moderno, pero vende **su flota**, no software para la flota de otro [INF].
- **Ridery y PedidosYa envíos en Venezuela:** no verificables desde aquí [NV] (ver §0).

## 4. Tabla comparativa (Venezuela)

|                        | MRW                                                                           | Zoom                                                                | Tealca                                                                               | Yummy B2B                                           |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Recepción              | Agencia                                                                       | Oficina                                                             | Oficina o recolecta (portal caído)                                                   | Recolección por su flota                            |
| Datos del destinatario | Nombre, cédula, teléfono, correo, agencia o dirección con punto de referencia | Nombre, C.I., dirección, celular, correo                            | Nombre, C.I. o pasaporte, teléfono, correo, dirección con referencias                | [NV]                                                |
| Guía                   | Número de 15 dígitos que codifica agencias [INF]                              | Nro de guía; remesas MTCN                                           | Guía y pre-guía                                                                      | [NV]                                                |
| Rastreo público        | Un campo; muestra nombre y cédula (fallo de privacidad)                       | Guía + tipo                                                         | Guía o pre-guía; estados En tienda / En tránsito / Entregado; compartir por WhatsApp | Tiempo real en la app                               |
| Aviso al destinatario  | [NV]                                                                          | SMS al llegar a oficina                                             | [NV]                                                                                 | App                                                 |
| Prueba de entrega      | Cédula laminada original + tracking                                           | Firma de la prueba de entrega                                       | [NV]                                                                                 | [NV]                                                |
| Cobro                  | Origen o COD                                                                  | Origen o COD; pago móvil, Zelle, PayPal, efectivo Bs y USD, tarjeta | Contado, COD, crédito quincenal, prepagado, casillero                                | Efectivo con retorno al comercio; factura quincenal |
| Seguro                 | 3 % opcional, obligatorio en electrónicos, máx. 600 USD                       | Obligatorio en COD                                                  | Opcional                                                                             | [NV]                                                |
| Empresas               | Tarifas especiales, call center                                               | Portal + API host-to-host                                           | Crédito, prepago, casillero                                                          | API y panel                                         |

## 5. Ubicación exacta del destinatario: el estándar internacional

- **Amazon:** cada dirección guardada tiene «instrucciones de entrega» (dónde dejarlo, código de acceso, horario) [OBS por guías de terceros, freightcourse.com]; existe una patente de Amazon sobre instrucciones de entrega por ubicación (US11861546B1) [DOC]. Un pin ajustable en el mapa para el comprador no se pudo confirmar en documentación oficial [NV].
- **Uber, Rappi, DoorDash:** el estándar visible es dirección + **pin en el mapa que el cliente mueve** + campo de referencias (apartamento, edificio, «al lado de…») [INF, conocido del mercado; no se capturó en esta ficha].
- **Google Maps Platform** [DOC developers.google.com, 28 oct 2026]:
  - **Address Validation: Venezuela NO está en la lista de países**; en Latinoamérica solo Argentina, Brasil, Chile, Colombia, México y Puerto Rico. No sirve para Venezuela.
  - Precios por cada 1.000 llamadas (primer tramo pagado): Address Validation Pro 17 USD (5.000 gratis al mes); Autocomplete 2,83 USD (10.000 gratis; las sesiones de autocompletado no se cobran aparte); Geocoding 5 USD (10.000 gratis); Place Details Essentials 5 USD; Routes Essentials 5 USD; Route Optimization de flota 30 USD (1.000 gratis).
  - El autocompletado y el geocodificado funcionan en Venezuela, pero con direcciones informales el pin manual es lo que manda [INF].
- **Códigos plus (Open Location Code):** código corto que sirve de dirección donde no hay calles formales; un código de 10 caracteres cubre unos 14 metros; **funciona sin internet** y la librería es de código abierto con licencia Apache 2.0 (C, Go, Java, JavaScript, Python, Rust…) [DOC github.com/google/open-location-code]. Es la opción ideal para Venezuela: gratis, sin proveedor, imprimible en la etiqueta [INF].
- **what3words:** cuadrículas de 3 metros con tres palabras; API de pago desde 9,99 USD al mes (1.000 conversiones) hasta 300 USD (75.000) [DOC what3words.com/pricing vía búsqueda]. Pago y uso desde Venezuela no confirmados por sanciones [NV]. No recomendado como base [INF].
- **Cuando el destinatario no tiene la app** (la pregunta clave):
  - Onfleet: SMS con enlace a una página de seguimiento en tiempo real; enlace para firmar por adelantado; PIN del destinatario en plan Enterprise [DOC intercom.help/onfleet]. No se encontró una función pública de «confirma tu ubicación» [NV].
  - Shipday, Bringg, Tookan, Routific, Spoke (antes Circuit for Teams): enlace de seguimiento por SMS o correo; Shipday además por **WhatsApp** y «código de entrega de 4 dígitos para validar al cliente» [OBS shipday.com/pricing · REA ev_8a29…f06b]. Ninguno documenta públicamente una pantalla donde el destinatario ponga el pin antes de la entrega [NV].
  - **En Venezuela la práctica real es pedir la «ubicación de WhatsApp»** al destinatario [INF, práctica común; no verificable con fuentes públicas].
  - **Conclusión:** un enlace «Confirma dónde recibes» (pin + foto de la fachada + referencia + código plus), enviado por WhatsApp o SMS antes de salir la ruta, **no es estándar documentado de los grandes**; es la mejora que nos diferencia, construida sobre piezas que sí son estándar (enlace de seguimiento por SMS o WhatsApp) [INF].

## 6. Software de última milla: cómo venden y qué flujo describen

|                                                                             | Precio público (28 oct 2026)                                                                                                                                                                                                                                 | Flujo descrito                                                                                                                                                                   | Para empresas sin tecnología                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Onfleet [REA ev_46a9…09a5]                                                  | Launch desde 619 USD/mes (2.500 entregas); Scale desde 1.349 USD/mes (5.000); Enterprise desde ~3.099 USD/mes; Courier Suite desde 299 USD/mes (portal de pedidos para clientes, tablas de tarifas, facturación automática, avisos con la marca del cliente) | Rutas optimizadas, asignación automática, app del conductor, prueba de entrega con foto, código de barras, firma, verificación de edad e identidad, notas; página de seguimiento | Prueba gratis de 14 días, usuarios ilimitados, API y webhooks en todos los planes, onboarding guiado                     |
| Shipday [REA ev_8a29…f06b]                                                  | Gratis hasta 300 pedidos; Pro Lite 29 USD; Elite 99 USD; AI Lite 199 USD; Business AI 399 USD; Enterprise desde 3.499 USD                                                                                                                                    | Despacho automático, app del conductor, seguimiento en vivo, prueba con foto y firma, avisos por **SMS y WhatsApp**, código de 4 dígitos, geocercas, agentes de IA               | Plan gratis para siempre; formularios de pedido para clientes; portal para comercios                                     |
| Routific [REA ev_f837…c8023]                                                | Gratis hasta 100 pedidos; 150 USD planos hasta 1.000; luego de 15 a 3 centavos por pedido                                                                                                                                                                    | Rutas con ventanas, capacidades y turnos; navegación con Google Maps o Waze; seguimiento; prueba con fotos, firmas, código de barras; perfil de cliente                          | Cobra por pedido, no por conductor; integración con Shopify, Zapier y **servidor MCP para agentes de IA**                |
| Spoke Dispatch (antes Circuit for Teams) [OBS getcircuit.com/teams/pricing] | Starter 125 USD (1.000 paradas); Premium 200 USD (2.000); Expert 1.000 USD (12.000)                                                                                                                                                                          | **Subir rutas desde hoja de cálculo**, optimizar, enviar a conductores, escanear códigos, foto y firma, página de seguimiento                                                    | «Pocos minutos» para aprender a importar paradas; los conductores sin entrenamiento                                      |
| Tookan [OBS jungleworks.com/tookan/pricing]                                 | Gratis 100 tareas; desde 39 USD/mes (1.000 tareas) hasta 249 USD                                                                                                                                                                                             | Asignación automática, GPS, prueba de entrega                                                                                                                                    | **CSV a medida para crear pedidos en bloque**, más de 45 integraciones con cajas registradoras, prueba gratis de 14 días |
| Bringg [OBS bringg.com/platform]                                            | A medida                                                                                                                                                                                                                                                     | Cadena de custodia, prueba de entrega, visibilidad por geocercas, avisos automáticos                                                                                             | Enterprise                                                                                                               |

## 7. Estándar del mercado (se copia)

1. **Alta del envío por tres caminos:** formulario en el panel, **importación de Excel o CSV** con plantilla, y API con webhooks (todos los grandes).
2. **Número de guía único + etiqueta** con código de barras o QR, legible por el conductor y escaneable en cada paso (MRW, Zoom, Tealca, Onfleet, Spoke).
3. **Escaneos de custodia:** recibido, en centro, en tránsito, en ruta, entregado, fallido, devuelto, cada uno con hora, lugar y quién (Bringg «cadena de custodia»; Tealca «En tienda / En tránsito / Entregado»).
4. **Rastreo público por número de guía** y **enlace de seguimiento enviado por SMS o WhatsApp** con el conductor en vivo y la hora estimada (Onfleet, Shipday, Routific, Spoke).
5. **Aviso al destinatario** en los momentos clave: salió, está cerca, llegó a la oficina, entregado (Zoom manda SMS cuando está en oficina).
6. **Prueba de entrega:** foto, firma, código de 4 dígitos o PIN, escaneo del código de barras, verificación de identidad (Onfleet, Shipday). En Venezuela, además, **cédula del que recibe** (MRW).
7. **Entrega a domicilio o retiro en punto** (agencia, oficina o aliado), con plazo de retiro y devolución automática al vencer (MRW: 5 días hábiles).
8. **Cobro contra entrega (COD)** con liquidación al comercio (MRW, Zoom, Tealca, Yummy).
9. **Seguro o protección** por porcentaje del valor declarado (MRW 3 %, Zoom obligatorio en COD).
10. **Planes por volumen con un nivel gratis o prueba de 14 días**, cobro por pedido y no por conductor (Routific, Shipday, Tookan).
11. **Compartir el estado por WhatsApp** desde la página de rastreo (Tealca).

## 8. Lo que cambia en Venezuela

- **Cédula o RIF es obligatorio** para remitente y destinatario, y se usa para retirar y como prueba de entrega. Formatos: V-, E-, J-, G-, P- [OBS MRW, Zoom, Tealca].
- **La dirección es informal:** todos piden «punto de referencia». Hace falta un campo propio de referencia, el pin en el mapa y el código plus, no solo «dirección» [OBS + INF].
- **Agencia como destino por defecto:** buena parte de los envíos se retiran en oficina; el sistema debe manejar «punto de retiro» con código, plazo y aviso de llegada [OBS].
- **Pagos multimoneda y manuales:** pago móvil, transferencia, Zelle, efectivo en dólares y bolívares, tarjeta en bolívares; conciliación por **número de referencia** [OBS Zoom, Liberty, Yummy].
- **El COD es la norma** para e-commerce y el comercio quiere el efectivo de vuelta rápido (Yummy: «retorno inmediato») [OBS].
- **Inflación:** prepago y crédito quincenal son formas de pago comunes para empresas (Tealca) [OBS]. Encaja con nuestra billetera prepago.
- **WhatsApp manda** como canal: soporte, estado, pedidos (Tealca, Zoom, Yummy-Wink) [OBS].
- **Privacidad:** el rastreo de MRW expone cédulas; nosotros no [REA ev_9549…1e53].
- **Fiscal:** IVA, IGTF del 3 % al pagar en divisas y facturación fiscal del SENIAT; el alcance vigente en 2026 no quedó confirmado en fuentes oficiales (solo prensa y facturas de muestra) [NV]. Requiere revisión de un contador venezolano antes de cobrar en Venezuela.
- **Google Address Validation no cubre Venezuela** [DOC]: la validación se hace con pin + confirmación del destinatario.

## 9. Perfil Venezuela (sistema propio)

- **Moneda:** precio base en **dólares (USD)** con equivalente en **bolívares (VES)** a la tasa del día (BCV); se guarda la tasa usada en cada cobro. Dinero siempre en centavos enteros, por moneda [INF; Yummy muestra USD con equivalente en Bs, REA ev_c8fb…5ef1].
- **Formas de pago de la empresa (pagar Divoox o recargar billetera):** pago móvil, transferencia en bolívares, Zelle, efectivo en dólares en un punto autorizado, Binance (USDT) [NV: el uso de Binance para empresas no se verificó en fuentes de esta ficha; Zoom y Yummy no lo publican], tarjeta internacional cuando la tenga. Cada pago manual entra **pendiente** con su número de referencia, comprobante (foto) y conciliación por un operador; nunca se acredita solo por la palabra del cliente [INF, coherente con nuestro candado de pagos].
- **Formas de pago del destinatario (COD):** efectivo en dólares o bolívares, pago móvil, Zelle, punto de venta. El conductor registra método, monto, moneda y referencia; el efectivo queda «en custodia del conductor» hasta que lo liquide en el centro [INF + OBS Zoom].
- **Ubicación del destinatario:** dirección + **punto de referencia (obligatorio)** + estado/municipio/parroquia/urbanización o sector + pin en el mapa + **código plus** calculado y mostrado + foto de fachada opcional; enlace «Confirma dónde recibes» por WhatsApp o SMS; o **punto de retiro** (agencia de la empresa o aliado).
- **Datos que se piden:** remitente: nombre o razón social, **cédula o RIF**, teléfono, correo; destinatario: nombre, **cédula** (opcional en el alta, obligatoria para retirar en punto), teléfono con WhatsApp, correo opcional; envío: declaración de contenido, valor declarado, peso y medidas, monto a cobrar si es COD, seguro sí o no.
- **Etiqueta y guía:** número de guía corto y legible para decirlo por teléfono + código interno opaco en QR y Code 128; impresa en térmica de 4×6 pulgadas o media carta; trae: empresa remitente, destinatario (nombre y **solo los últimos 4 dígitos de la cédula**), teléfono parcial, municipio y sector, **punto de referencia**, código plus, ruta y parada, peso, «COD: monto y moneda» bien visible, servicio (domicilio o retiro en punto), fecha.
- **Qué exige la app del conductor:** funcionar **sin señal** y sincronizar después; navegación con Google Maps o Waze al pin; botón de WhatsApp y llamada al destinatario; prueba de entrega: foto + firma o código, y **número de cédula de quien recibe** con su relación («titular», «familiar», «vigilante»); cobro COD con método, moneda y referencia; motivos de no entrega del país (no estaba, dirección no ubicada, zona insegura, no pagó); entrega de efectivo al cerrar la ruta.
- **Rastreo público:** estados en español, sin cédula ni nombre completo, botón «Compartir por WhatsApp», mapa en vivo solo cuando el conductor va hacia esa parada.

## 10. Perfil EE. UU. (sistema propio)

- **Moneda:** USD. **Pagos:** tarjeta (Stripe), en la empresa por billetera prepago o tarjeta guardada; casi nunca COD en última milla [INF].
- **Ubicación:** dirección postal con autocompletado de Google y **Address Validation** (EE. UU. sí está cubierto) [DOC]; número de apartamento o suite, código de acceso o del portón e instrucciones de entrega («dejar en la puerta», «entregar en mano») al estilo Amazon [OBS].
- **Datos que se piden:** nombre, teléfono, correo, dirección validada, instrucciones; **no** se pide documento de identidad, salvo verificación de edad (alcohol o medicinas) como en Onfleet [DOC].
- **Etiqueta:** 4×6 pulgadas térmica, QR o Code 128, nombre, dirección completa, ruta y parada; sin datos fiscales.
- **App del conductor:** foto en la puerta, firma o PIN, escaneo; aviso automático con enlace de seguimiento por SMS (consentimiento para mensajes de texto según la ley de EE. UU. [INF]).
- **Venta:** planes publicados con nivel gratis o prueba de 14 días, como Shipday y Routific.

## 11. Qué le falta a Divoox Flex

Comparación con lo que ya tenemos (panel de empresa con envíos, importación por Excel, etiquetas con código, rutas optimizadas, «Mi ruta» con pruebas de entrega por foto, firma y código, API y webhooks, billetera prepago, seguimiento). Revisado contra el código: el envío guarda remitente, destinatario, teléfono, dirección, lat/lng, instrucciones, ventana horaria y referencia externa; estados creado, asignado, en tránsito, entregado, fallido, devuelto, cancelado (`apps/servidor/src/flex/envios.ts`).

**Ya cumplimos el estándar en:** alta por panel, Excel y API; etiqueta con QR y Code 128; código opaco (mejor que MRW en privacidad); rutas optimizadas; app del conductor con escáner, carga y pruebas de entrega; webhooks; billetera prepago con reservas (el «prepagado» de Tealca, mejor resuelto).

**Falta (por orden de importancia para Venezuela):**

1. **Cobro contra entrega (COD):** monto y moneda por paquete, cobro en la app del conductor con método y referencia, efectivo en custodia del conductor, liquidación al comercio y conciliación. Es lo que más piden MRW, Zoom, Tealca y Yummy.
2. **Pagos venezolanos para la billetera:** pago móvil, transferencia, Zelle y efectivo con comprobante y conciliación manual; hoy solo Stripe.
3. **Moneda doble USD y VES** con tasa del día guardada en cada operación.
4. **Cédula o RIF** de remitente y destinatario, y **cédula de quien recibe** en la prueba de entrega.
5. **Punto de referencia** como campo propio y obligatorio en Venezuela; división territorial (estado, municipio, parroquia, sector).
6. **Enlace «Confirma dónde recibes»** por WhatsApp o SMS: pin, referencia, foto de fachada, código plus; actualiza lat/lng del envío antes de optimizar la ruta.
7. **Código plus** calculado con la librería abierta e impreso en la etiqueta y en la parada del conductor.
8. **Aviso al destinatario por WhatsApp** (salió, está cerca, entregado, llegó a punto de retiro) con enlace de seguimiento.
9. **Retiro en punto** (agencia o aliado): estado «disponible para retiro», plazo de días hábiles, devolución automática al vencer, entrega con cédula y autorización a terceros.
10. **Escaneos de custodia más finos:** «recibido en centro», «en centro de distribución», «en ruta», «disponible en punto», con lugar y responsable.
11. **Declaración de contenido, valor declarado y seguro** por porcentaje.
12. **Motivos de no entrega del país** y reintento programado.
13. **Botón «Compartir por WhatsApp»** en el rastreo público. La privacidad ya está bien: nuestra página de seguimiento no muestra direcciones, teléfonos ni nombres (candado C-FLEX-SEGUIMIENTO, `apps/panel/src/sitio/Seguimiento.tsx`).
14. **Crédito empresarial con factura quincenal** para empresas grandes (Tealca, Yummy Corporate).
15. **Facturación fiscal venezolana** (IVA, IGTF, SENIAT): solo después de revisión legal.
16. **Planes públicos con nivel gratis** al estilo Shipday y Routific, y servidor MCP para agentes de IA como Routific.

## Fuentes (consultadas el 28 de octubre de 2026)

- MRW Venezuela: https://mrwve.com/ · https://mrwve.com/mi-envio · https://mrwve.com/servicios · https://mrwve.com/corporativos · https://mrwve.com/preguntas-frecuentes · https://mrwve.com/calcula-envio
- Zoom: https://zoom.red/tracking-de-envios-personas/ · https://zoom.red/envios-cod-personas/ · https://zoom.red/recibir-envio-personas/ · https://zoom.red/medios-de-pago-personas/ · https://zoom.red/home-empresas/ · https://zoom.red/herramientas-tecnologicas/ · https://zoom.red/con-zoom-tu-envio-tiene-ruedas/
- Tealca: https://www.tealca.com/ · https://www.tealca.com/rastrear-envio/ · https://www.tealca.com/hacer-envio/ · https://www.tealca.com/recolecta/ · https://recolectas.tealca.com/ · https://www.tealca.com/envios-puerta-a-puerta-venezuela-cobertura-entrega-directa/
- Liberty Express: https://libertyexpress.com/
- Yummy: https://www.yummysuperapp.com/ · prensa: https://latamlist.com/hugo-acquires-venezuelan-food-delivery-app-yummy/
- Google: https://developers.google.com/maps/documentation/address-validation/coverage · https://developers.google.com/maps/billing-and-pricing/pricing · https://github.com/google/open-location-code
- what3words: https://what3words.com/pricing
- Onfleet: https://onfleet.com/pricing · https://onfleet.com/proof-of-delivery · https://intercom.help/onfleet-4f83d83093ac/en/articles/15254709-tracking-page · https://intercom.help/onfleet-4f83d83093ac/en/articles/16165356-recipient-pin-for-tasks
- Shipday: https://www.shipday.com/pricing
- Routific: https://www.routific.com/pricing
- Spoke Dispatch (Circuit for Teams): https://getcircuit.com/teams/pricing · https://getcircuit.com/teams
- Tookan: https://jungleworks.com/tookan/pricing/
- Bringg: https://www.bringg.com/platform/
- Amazon (guías de terceros y patente): https://www.freightcourse.com/?p=9791 · https://patents.google.com/patent/US11861546
- Fiscal (prensa, no oficial): https://www.diariolasamericas.com/america-latina/nueva-ley-impuestos-caos-la-economia-venezuela-n4245986
