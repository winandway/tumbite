# Logística para empresas: quién usa qué y cómo es un día de trabajo

Ficha REA del 1 de noviembre de 2026. País: todos (el estándar es el mismo en EE. UU. y en Venezuela; lo que cambia por país se anota aparte).

**Para qué sirve esta ficha:** Divoox Flex se vende como TECNOLOGÍA a empresas de reparto que ya tienen sus conductores y sus vehículos. Aquí está cómo lo hacen los líderes del mercado (Onfleet, Spoke —antes «Circuit for Teams»—, Shipday, Routific y Tookan), quién usa cada pantalla, cómo es un día normal, cómo arranca un cliente nuevo y cuánto cobran. Al final, qué debe hacer Divoox.

**Cómo se investigó:** con REA, visitando como cualquier persona las páginas públicas de cada empresa (sin crear cuentas, sin saltar verificaciones anti-robots, sin descompilar apps). El paquete de evidencia (7,9 MB, con capturas de otras sesiones de REA) se guarda fuera del repositorio público, en la carpeta privada de Divoox («evidencia-rea»); los hashes de cada captura están en la tabla de abajo.

## Evidencia REA (capturas de esta ficha)

| Código | Qué se capturó                                                                                                  | Identificador de la evidencia                                       | Huella del escenario                                             |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R0     | Onfleet, app del conductor (captura de la sesión principal)                                                     | ev_524db4853b73d599c5d7e87fbd239aade863339315bb509966b0c3d60ce32ec6 | (anotada en la sesión principal)                                 |
| R1     | Onfleet: precios y optimización de rutas                                                                        | ev_fe52fa11f364a41d85fe24c8425c849db7565ac8935c3aaa983dd8a0971622d5 | 5fc77106d86e19ca84aa6afc4d065c8fcd82207e8cc92fb18f206f14e684ef6a |
| R2     | Onfleet: seguimiento, despacho, Courier Suite, portal del cliente, primeros pasos y formulario de prueba gratis | ev_21eacd62ffeca82380a3dae11afa43ab503ada6dc2b65e4452606ca558c10d9d | bb681d2f72237ea1f58a52e2c760cbb69fa18051885c011cc6716c341ac687b0 |
| R3     | «Circuit for Teams» (redirige a Spoke Dispatch), precios de Spoke, portada de Shipday                           | ev_9d9ac164b621379ace091e34643abf6d852794723b1a16a9e5557e76799073e6 | cb8ffcf9d1a70a3c11b8016fb2e6db8979eddd1201592e4fe088e3fd896b9097 |
| R4     | Planes de Shipday, precios de Routific y de Tookan                                                              | ev_616df55fef0181ab2bed4650068f880354eaa772fd8df436c319033423eb2247 | da2beb12a8a970235b5ecfb983436e93122039c784bb4d7e3fe1697880527d1f |
| R5     | Índice de ayuda de Spoke; ayuda de Onfleet y Amazon Flex (bloqueadas, ver límites)                              | ev_88188a95a3277c795c3a60df4d31d33d6ac09a6c11a25007ef87a1239157f9d8 | f0c7488b3d4091fe91fb49221856fafdcd173dcad020b0c607a0f7b6a40d2f45 |
| R6     | Spoke: cómo se agregan conductores, avisos al destinatario y portal del cliente (Spoke Connect)                 | ev_71ffe0f789a627797c298ff5e04d6576eaf94e3ea80d47ab019dcb91997c03c8 | 8d888eb8c53fc7ee9be9eccacebe53d00552d2cddba06353cdb22eb09d625b41 |

Etiquetas: [REA] = visto en una captura de arriba; [OBS] = observación pública; [DOC] = documentación publicada; [INF] = inferencia nuestra; [NV] = no verificable.

**Límites de esta investigación:**

- El centro de ayuda de Onfleet mostró una verificación anti-robots de Cloudflare. No se saltó: lo que dice sobre cómo entra el conductor se tomó de Spoke, que sí es público [REA R5].
- La web de Amazon Flex respondió «403, solicitud bloqueada» al navegador automático [REA R5]. Para Amazon Flex se usa lo que ya teníamos: las capturas reales de Richard (ficha del 30 de octubre).
- Dos direcciones dieron «página no encontrada» y se reemplazaron por las correctas desde el menú: el seguimiento de Onfleet y la app del conductor de Shipday [REA R1, R4].
- Hallazgo de paso: la dirección de «Circuit for Teams» ahora lleva a «Spoke Dispatch». Circuit cambió el nombre de su producto para empresas a Spoke [REA R3].

---

## 1. Los actores y la herramienta de cada uno

El mercado entero trabaja con **cuatro actores**. Spoke lo dibuja así en su portada: los Clientes suben pedidos y ven el estado, los Despachadores optimizan rutas en el panel, los Conductores navegan y toman la prueba de entrega en la app, y los Destinatarios siguen su pedido en una página web [REA R3].

### a) La empresa que compra el software → panel web

- **Quién:** el dueño o administrador y sus despachadores. Entran a un panel web (Onfleet lo llama «Dashboard» y «Command Center»; Spoke, «Dispatcher Dashboard») [REA R2, R3].
- **Roles con permisos distintos:** Spoke tiene Dueño del equipo (lo recibe quien abre la cuenta, no se puede borrar y se puede traspasar), Administrador, Encargado de depósito, Despachador y Solo lectura [REA R6]. Onfleet arma sus guías de inicio por rol: Administrador, Despachador y Conductor [REA R2]. Routific suma un panel de **solo lectura para atención al cliente**, para que respondan «¿dónde está mi pedido?» sin tocar las rutas [REA R4].
- **Usuarios sin límite en el panel:** Onfleet incluye «usuarios ilimitados» en todos sus planes [REA R1]; Routific, «despachadores ilimitados» [REA R4].
- **Qué hace en el panel:** carga pedidos, optimiza rutas, asigna, mira el mapa en vivo con las horas estimadas de llegada, recibe alertas de retraso, reasigna y saca reportes [REA R1, R2].

### b) Sus conductores → app del conductor, por invitación

- **No se registran como trabajadores de la plataforma.** El despachador los da de alta desde el panel. En Spoke: «Agregar conductor» → correo o teléfono (en formato internacional, por ejemplo +1 o +58) → nombre → depósito → color en el mapa → **le llega un SMS o un correo con la invitación**; el conductor toca el enlace, instala la app correcta y entra con esos mismos datos [REA R6].
- **Si la invitación no llega:** el conductor busca la app en la tienda, la descarga y entra con los datos con los que lo agregaron [REA R6].
- **El conductor no es cliente del software:** en el formulario de prueba gratis de Onfleet hay dos opciones para separarlos: «Soy conductor y necesito la app» y «Soy conductor y busco trabajo». O sea, el conductor no abre cuenta: la empresa lo invita [REA R2].
- **Conductores sin límite y sin cobro por cabeza:** Spoke, Routific y Tookan (desde su plan de inicio) incluyen conductores ilimitados [REA R3, R4]. Routific lo dice claro: se paga por pedido, no por conductor ni por vehículo [REA R4].
- **Qué hace en la app:** ve su ruta, navega (Routific abre Google Maps o Waze), escanea los paquetes, toma la prueba de entrega (foto, firma, notas, código de barras, verificación de identidad por escaneo y PIN del destinatario en los planes altos), chatea y trabaja sin conexión [REA R0, R1, R4].

### c) El destinatario final → SMS o correo con enlace de seguimiento, sin app

- **No tiene que instalar nada.** Recibe avisos por SMS o por correo con un enlace a una página web de seguimiento en vivo [REA R2, R6].
- **Los tres avisos estándar** (Spoke): el primero cuando el conductor arranca la ruta («va en camino, llega a tal hora»); el segundo cuando su parada es la siguiente («llega en breve»); el tercero cuando el conductor marca la entrega como hecha o fallida, y el enlace pasa a mostrar la prueba de entrega [REA R6].
- **La página de seguimiento:** GPS en vivo, hora estimada que se actualiza sola y chat con el conductor [REA R2]. El destinatario también puede dejar notas e instrucciones [REA R3].
- **Con la marca de la empresa, no la del software:** «cada mensaje parece que viene de ti», incluso si la entrega la hace un tercero [REA R2]. Spoke deja cambiar el idioma y el texto de cada aviso [REA R6].
- **Costo:** el correo es gratis; el SMS se cobra aparte, según el uso. Onfleet publica cuánto cobra en EE. UU.: 1,3 centavos por segmento de SMS [REA R1]. Spoke cobra el SMS a la tarifa de Twilio [REA R6]. Routific no incluye SMS en su plan gratis [REA R4].

### d) El «comercio» que crea pedidos → portal del cliente o conexión directa

- Aparece cuando la empresa de reparto es una **mensajería que trabaja para terceros** (farmacias, tiendas, laboratorios) [REA R2, R6].
- **Portal del cliente por invitación:** «empezar es tan simple como mandar un enlace de invitación» (Onfleet) [REA R2]. En Spoke Connect el comercio entra, sube sus pedidos (por CSV, conexión directa o integraciones), imprime etiquetas con código de barras y ve la hora estimada, el estado y la prueba de entrega. Sus pedidos caen en la lista «sin asignar» de la empresa de reparto [REA R6].
- **Campos obligatorios:** la empresa de reparto elige qué datos tiene que poner el comercio. La dirección siempre es obligatoria [REA R6].
- **Avisos con la marca del comercio:** el destinatario recibe los avisos con la marca de la tienda donde compró [REA R2].
- **Cobro al comercio:** Onfleet Courier Suite añade tablas de tarifas, cargos extra y facturas automáticas al comercio [REA R2].

---

## 2. Cómo es un día normal

1. **Entran los pedidos.** Por CSV, por conexión directa con sus sistemas, por integraciones (Shopify, Zapier, Square) o desde el portal del comercio [REA R2, R4, R6]. Spoke tiene guías para preparar la hoja de cálculo e importarla [REA R5].
2. **Se optimizan las rutas.** En minutos y con las reglas de la empresa: zonas, capacidad de cada vehículo, tiempo en cada parada, evitar peajes y ventanas de entrega [REA R1]. Un cliente de Onfleet cuenta que pasó de 8 a 10 horas a menos de una hora para rutear 500 pedidos [REA R1]. Routific cobra cada pedido una sola vez, cuando entra en una ruta, y deja reoptimizar todas las veces que quieras [REA R4].
3. **Se asigna a los conductores.** A mano por zonas, o en automático según cercanía, carga de trabajo y ventana de entrega. Los pedidos urgentes se meten solos en rutas que ya están en curso [REA R2].
4. **El conductor carga.** Recibe la ruta en la app y escanea cada paquete al recogerlo y al entregarlo. Así queda la cadena de custodia [REA R0, R2].
5. **Navega y entrega.** Indicaciones paso a paso, notas de cada parada y prueba de entrega (foto, firma, código de barras, identidad o PIN) [REA R0, R1].
6. **Entregas fallidas.** El sistema marca solo los retrasos y las entregas fallidas para que el despachador reasigne [REA R2]. El tercer aviso le cuenta al destinatario si se pudo o no [REA R6]. Spoke también cobra contra entrega en efectivo [REA R5].
7. **El destinatario recibe la hora estimada y el seguimiento** durante todo el recorrido (punto c) [REA R2, R6].
8. **Reportes.** Entregas a tiempo, tiempo en cada parada y calificación promedio por conductor; vista por sede para cada equipo y vista general para la dirección; comparación entre la flota propia y los mensajeros externos [REA R2]. Spoke exporta los datos [REA R5]. Onfleet suma pago a los conductores con reglas propias y conexión con la nómina [REA R1].

---

## 3. Cómo arranca un cliente nuevo

- **Prueba gratis sin tarjeta:** Onfleet da catorce días [REA R1]. Spoke: «prueba gratis, arrancas en cinco minutos» y «sin tarjeta de crédito» [REA R3]. Shipday: «juega con él primero, suma a tu equipo, paga después» [REA R3, R4]. Routific es gratis hasta cien pedidos al mes [REA R4]. Tookan tiene un plan «gratis para siempre» con cien tareas al mes y dos conductores [REA R4].
- **Formulario de alta con preguntas que sirven para preparar la cuenta** (Onfleet): volumen de entregas al mes, si entregas tus productos o los de otras empresas, si usas flota propia, terceros o las dos cosas, y rubro (farmacia, comida, comercio electrónico, materiales, flores, lavandería y otros) [REA R2].
- **Guías de inicio por rol** (Onfleet): Administrador (estructura, invitaciones y equipo, personalizar); Despachador (conocer el panel, crear y asignar tareas, hablar con el equipo); Conductor (lo básico de la app, ajustes, consumo de datos, instalar y entrar) [REA R2].
- **Seminarios en vivo** por la mañana y por la tarde, más horas de consulta [REA R2].
- **Acompañamiento según el plan:** soporte por correo en el plan bajo, arranque guiado en el medio y arranque premium con implementación en el plan empresa (Onfleet) [REA R1]. Spoke incluye arranque dedicado en su plan Expert [REA R3].
- **Datos de ejemplo:** [NV]. Ninguna página pública dice si la cuenta de prueba trae pedidos de muestra. Para saberlo habría que crear una cuenta, y eso queda fuera de los límites.

---

## 4. Precios publicados

| Plataforma                              | Cómo cobra                                                                    | Cifras publicadas                                                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onfleet [REA R1]                        | Por mes, con entregas incluidas; lo que pasa del límite se cobra por tarea    | Launch desde 619 dólares al mes (2.500 entregas); Scale desde 1.349 (5.000); Enterprise desde unos 3.099 (10.000 o más). Courier Suite (portal del comercio y facturas) desde 299 más al mes. SMS en EE. UU.: 1,3 centavos |
| Spoke, antes Circuit for Teams [REA R3] | Por mes según paradas; conductores ilimitados                                 | Starter 125 dólares (1.000 paradas, 4 centavos cada parada extra); Premium 200 (2.000, 6 centavos); Expert 1.000 (12.000, 7 centavos)                                                                                      |
| Shipday [REA R4]                        | Por mes con pedidos incluidos                                                 | Branded Elite desde 99 dólares (300 pedidos, 20 centavos el extra); Business AI Lite desde 199 (750); Business AI desde 399 (ilimitados por local); Enterprise desde 3.499                                                 |
| Routific [REA R4]                       | Solo por pedido entregado, nunca por conductor; todo incluido en un solo plan | Hasta 100 gratis; hasta 1.000 por 150 dólares fijos; después baja de 15 a 3 centavos por pedido según el volumen                                                                                                           |
| Tookan [REA R4]                         | Por mes con tareas incluidas; o licencia de marca blanca con un solo pago     | Gratis (100 tareas, 2 conductores); Startup 99 dólares (1.000 tareas, conductores ilimitados); Growth 249; Standard 399. Marca blanca con pago único desde 5.999 dólares                                                   |

**El patrón [INF]:** casi nadie cobra por conductor. El estándar es una cuota mensual con un paquete de entregas y un precio por cada entrega extra, entre 3 y 20 centavos de dólar. El SMS se cobra aparte.

---

## 5. Software para la flota propia o mercado de bloques: cuál nos toca

|                              | Software para la flota de la empresa (Onfleet, Spoke, Routific, Tookan, Shipday) | Mercado de bloques con conductores independientes (Amazon Flex)                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Quién pone a los conductores | La empresa cliente, que los invita a la app [REA R6]                             | La plataforma, que los recluta y los aprueba                                                                                     |
| Cómo entra el conductor      | Invitación por SMS o correo del despachador [REA R6]                             | Se registra él solo, pasa una revisión de antecedentes y reserva bloques de horas ([OBS], capturas de Richard del 30 de octubre) |
| Quién paga a quién           | La empresa le paga al software una cuota mensual por entregas [REA R1, R3, R4]   | La plataforma le paga al conductor por bloque                                                                                    |
| Qué vendemos                 | Tecnología                                                                       | Mano de obra y capacidad                                                                                                         |

**Para vender tecnología a empresas que ya tienen camiones y motos, el modelo correcto es el de la izquierda** (Onfleet, Spoke). Amazon Flex solo sirve como referencia de cómo se ve la app del conductor, no del modelo de negocio. Onfleet además ofrece una flota híbrida: deja mandar el exceso de pedidos a su red de mensajeros externos sin perder de vista ninguna entrega [REA R2]. Eso puede ser una segunda etapa para Divoox, uniendo Flex con nuestros repartidores independientes [INF].

---

## 6. Recomendación para Divoox

**Qué app usa cada actor:**

1. **Empresa de reparto → panel web de negocios** (el que ya existe en la sección de negocios del panel). Agregar los roles estándar: Dueño (traspasable), Administrador, Encargado de centro, Despachador y Solo lectura para atención al cliente [REA R6, R4]. Usuarios del panel sin límite.
2. **Conductores de la empresa → Divoox Driver, en modo «Mi ruta» de la empresa, entrando por invitación.** Hoy el servidor de Flex solo vincula a un conductor que **ya tiene** cuenta de repartidor en Divoox: si no la tiene, responde «la persona debe crearla primero en Divoox Driver». Eso va contra el estándar. **El cambio:** el despachador escribe el teléfono (o el correo) y el nombre → le llega un SMS con un enlace → el conductor instala Divoox Driver y entra con un código, **sin pasar por el alta de repartidor independiente** (sin revisión de antecedentes de Divoox ni cuenta de cobro). Queda atado solo a esa empresa [REA R6, R2]. Si después quiere trabajar también como repartidor independiente de Divoox, eso es un alta aparte.
3. **Destinatario → SMS o WhatsApp con enlace a la página de seguimiento de Divoox, sin app.** El seguimiento público por código ya existe (el código empieza por DVX). Faltan los tres avisos estándar: en camino, eres el siguiente, y entregado o fallido con su prueba. También la marca de la empresa de reparto en la página y en los mensajes, y el chat con el conductor [REA R6, R2]. En Venezuela el canal natural es WhatsApp más que SMS [INF; confirmar con REA a MRW, Zoom y Tealca, como manda la regla de cada país].
4. **Comercio de la mensajería → portal por invitación** (como Spoke Connect): sube pedidos por CSV (la importación por CSV ya existe en Flex) o por la API, con campos obligatorios, etiqueta con código de barras, y ve el estado y la prueba de entrega. Sus pedidos caen en la lista «sin asignar» de la empresa [REA R6]. Las facturas al comercio quedan para una segunda etapa (Onfleet las vende aparte) [REA R2].

**Primeros pasos que hacen falta:**

- Prueba gratis sin tarjeta, de catorce días o hasta cien entregas, lo que llegue primero [REA R1, R4].
- Formulario de alta con las preguntas de Onfleet (volumen, flota propia o terceros, rubro), para configurar la cuenta [REA R2].
- Asistente de primeros pasos dentro del panel, en orden: crear el centro, invitar al primer conductor (con un mensaje de prueba a su propio teléfono), importar un CSV de ejemplo, optimizar y despachar la primera ruta, y ver la página de seguimiento [INF basado en las guías por rol de REA R2].
- Tres guías en Docs, en español y en inglés: Administrador, Despachador y Conductor [REA R2].
- Precio de referencia [INF]: cuota mensual con un paquete de entregas y entrega extra entre 4 y 15 centavos, conductores ilimitados y SMS aparte. El precio final lo decide Richard.

---

## Fuentes

- https://onfleet.com/driver-app
- https://onfleet.com/pricing
- https://onfleet.com/route-optimization
- https://onfleet.com/visibility-and-tracking
- https://onfleet.com/assignment-and-dispatching
- https://onfleet.com/courier-suite
- https://onfleet.com/client-portal
- https://onfleet.com/onboarding
- https://onfleet.com/signup
- https://getcircuit.com/teams (redirige a https://spoke.com/dispatch)
- https://spoke.com/dispatch/pricing
- https://help.spoke.com/en/collections/1889210-spoke-help-dispatch
- https://help.spoke.com/en/articles/3849656-how-to-add-drivers-dispatchers-depot-managers-administrators-and-read-only-roles
- https://help.spoke.com/en/articles/7041450-how-to-set-up-recipient-notifications
- https://help.spoke.com/en/articles/9527943-how-to-use-spoke-connect
- https://www.shipday.com/
- https://www.shipday.com/pricing
- https://www.routific.com/pricing
- https://jungleworks.com/tookan/pricing/
- Intentadas y bloqueadas, sin saltar el bloqueo: https://support.onfleet.com (verificación de Cloudflare) y https://flex.amazon.com (403)
