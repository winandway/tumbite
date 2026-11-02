# FILA — el rumbo de la IA en Divoox (Tumbite)

> Esta es LA lista de trabajo de la IA. Una sola, en orden, solo con lo que la IA puede hacer sola.
> El gancho de la fábrica (`scripts/fabrica/seguir.sh`) no deja que la sesión se quede parada
> mientras quede un `- [ ]` aquí: le devuelve el siguiente punto.
>
> - `[ ]` por hacer · `[x]` hecho (con commit) · `[!]` trabado por Richard (la razón al lado).
> - Lo que depende de Richard vive en `PENDIENTES.md` (los 👤), no aquí.
> - Cada punto dice a qué país aplica.
> - Freno manual: crear el archivo `.fabrica-pausa` en la raíz (o que Richard diga «para»).
> - El orden sale de `docs/ROADMAP-DIVOOX.md` (plan maestro del 29 oct). Al vaciarse una etapa, se pasa a la siguiente de ese plan.

## DoorDash Dasher al volver (capturas de Richard, 31 oct 2026; ficha docs/investigaciones-rea/2026-10-31-doordash-dasher-capturas.md)

- [x] (D1) HECHO 31 oct (C-VUELTA-VERIFICA). Verificación obligatoria al volver: si el repartidor lleva 14 días o más sin conectarse, la foto de control se pide siempre (no al azar). Todos los países.
- [x] (D2) HECHO 31 oct (C-PRUEBA-DE-VIDA). Prueba de vida en la foto de control: de frente y otra mirando a la derecha, con guía en pantalla; el equipo revisa las dos en el panel. Todos los países.
- [x] (D3) HECHO 31 oct (C-PERMISOS-EXPLICADOS), visto en el simulador. Permisos explicados antes de pedirlos en el Driver (ubicación y avisos, cada uno con su porqué, «Estoy listo»). Todos los países.
- [x] (D4) HECHO 31 oct (C-TERMINOS-ACTUALIZADOS). Términos actualizados: si cambió la versión de los términos del repartidor, aceptarlos antes de conectarse. Todos los países.
- [x] (D5) HECHO 31 oct. Mapa del Driver conectado sin ofertas: «Buscando ofertas… Es más probable en las zonas en rojo» y bienvenida «tu nivel no cambió» al volver. Todos los países.
- [x] (D6) HECHO 31 oct: ya existía el centro de seguridad (emergencia, compartir recorrido, reportar) pero escondido; ahora escudo en el mapa (C-SEGURIDAD-A-LA-VISTA). Los turnos y la pausa ya existían. Revisar SafeDash (desliza para 911, compartir ubicación) y el dash actual (hora de fin, terminar ahora) frente a la ficha; construir lo que falte. Todos los países.
- [x] (D7) HECHO 1 nov (C-PAGO-PICO): pago por hora pico construido de punta a punta y APAGADO (monto y presupuesto en cero); se enciende en Superadmin → Rewards cuando Richard fije el dinero. Todos los países.
- [x] (D8) HECHO 1 nov (C-TELEFONO-VUELTA): tras 14 días sin conectarse, el Driver confirma su teléfono con un código por SMS; se exige solo donde el SMS sale (EE. UU. desde que Twilio apruebe el número). Todos los países.

## Logística: lo que falta frente a Amazon Flex (Richard, 31 oct: «la parte de logística no está terminada»)

- [x] (L1) Revisar en el simulador «Mi ruta» de punta a punta con una ruta de prueba (escanear todos los paquetes de la parada, geocerca, lugar, deslizar) y arreglar lo que falle. Todos los países. HECHO 31 oct: recorrido completo en el simulador; arreglados deslizar, encuadre del mapa, millas, carga lista, avisos, final de ruta, ruta en el inicio; pantallas oscuras, lista unida y sin logo (pedido de Richard).
- [x] (L3) Escanear cada paquete en la parada antes de entregar («1 de 1 paquetes escaneados», como Amazon Flex), con «escribir el código» si la etiqueta no se lee. Todos los países.
- [x] (L4) Botón fijo «Parada actual» abajo en la lista, el mapa y el resumen de la ruta (como Amazon Flex). Todos los países.
- [x] (R1) App del restaurante: que «Mi restaurante», «Beneficios/Ganancias», «Equipo» y «Configuración» del menú Más se abran DENTRO de la app (hoy mandan a la web), como DoorDash Merchant. Visto por Richard grabando el video de Apple. Todos los países.
- [x] (LG1) Registro de la empresa de logística DENTRO de la app del cliente, completo y legal como Uber Direct / DoorDash Drive: razón social, país, número fiscal (EIN en EE. UU., RIF en Venezuela, NIT en Colombia, validado por país), dirección fiscal, representante y teléfono; el centro de carga; y entrar a su panel sin salir de la app. Todos los países.
- [x] (LG2) Modo de entrega por envío, como los transportistas de Venezuela (MRW, Tealca, Zoom): a la puerta, en un punto de referencia («estación de servicio Doña María», con su punto en el mapa) o en una agencia o punto de acopio. El conductor ve el modo y el punto. Todos los países.
- [x] (LG3) «Rastrear paquete» en la app del cliente: la persona escribe o escanea uno o varios números de seguimiento; si el paquete existe y es suyo (su teléfono o correo), queda en «Mis paquetes» con el mapa, la etapa, los días o minutos que faltan y avisos push en cada paso. Todos los países.
- [x] (LG4) Aviso de «ya llega» al destinatario: push con sonido insistente cuando el conductor está cerca (o en el punto de referencia), con nombre del conductor, vehículo, color y placa; llamada automática si tiene Twilio. Todos los países. HECHO 31 oct: aviso push con conductor, vehículo y placa; la llamada espera las claves de Twilio (va con LG5).
- [x] (LG5) Invitación al destinatario al crear el envío: correo (ya hay) y SMS con el enlace para instalar la app y seguir su paquete con el número de seguimiento. El SMS sale por Twilio. Todos los países. HECHO 31 oct: SMS, correo y llamada «ya llega» construidos; se encienden solos al poner las claves de Twilio de Richard.
- [x] (LG6) Bloque de demostración para Richard en producción: su empresa de demo, un centro, 6 envíos con etiquetas para IMPRIMIR (PDF listo para la impresora), una ruta asignada a su cuenta de Driver y el guion paso a paso para probarla en la calle con el teléfono. EE. UU.
- [x] HECHO 31 oct: los tres videos subidos como adjunto y las tres apps reenviadas a Apple (en revisión). EE. UU.
- [x] (L2) HECHO 31 oct (C-SEGURIDAD-A-LA-VISTA). «Ayuda de emergencia» a la vista desde «Mi ruta», como el menú de Amazon Flex. Todos los países.

## Siguiente, 31 oct 2026 por la tarde (Richard: «sigue con el roadmap»; Etapa 1, punto 2 y hallazgos del repaso)

- [x] (S1) HECHO 31 oct: entrar, inicio, pedidos, menú, estadísticas, Más y horario revisados; arreglados la gráfica de pedidos por hora (bloque negro de lado a lado) y el horario (día repetido, «Quitar» desalineado). Repaso de la app NATIVA de restaurantes en el simulador de iPhone contra el sitio de pruebas: entrar, pedidos (aceptar, listo, rechazar), menú, horarios y ajustes. Cada fallo con prueba en rojo y arreglo. EE. UU.
- [x] (S2) HECHO 31 oct: el encuadre esperaba al mapa cargado; comprobado en el simulador (repartidor en Walled Lake y restaurante en Novi a la vez, 4.0 mi). Mapa del Driver durante la entrega: que se vean el restaurante y la casa con la ruta, no solo el punto del repartidor (como Uber Driver y Dasher). Todos los países.
- [x] (S3) HECHO 31 oct: GPS otra vez al volver a la app y «En tu zona» sin ubicación (C-UBICACION-AL-VOLVER). Ubicación del cliente que se actualiza al volver a la app y al dar el permiso; sin ubicación, no decir «Cerca de tu ubicación». Todos los países.
- [x] (S4) HECHO 31 oct: guías ES/EN de horario y primer pedido actualizadas y 188 capturas originales rehechas. Docs y web al día con lo visible de hoy (millas en EE. UU., «No recibe pedidos ahora», «Calle y número», «Pedir otra vez»): guías en español e inglés y capturas originales del recorrido. Todos los países.
- [x] (S5) HECHO 31 oct: «Panel de tu negocio · Divoox». Título de la pestaña del panel del restaurante (hoy «Comida a domicilio en Miami»). Todos los países.

## Hoy, 31 oct 2026 (piloto automático, pedido de Richard)

- [x] (H1) HECHO 31 oct: en producción c268d83, verificación en verde y humo 200 (la prueba de Tiendas ahora busca «Calle y número»). Publicar en producción los arreglos del 31 oct (carrito sin dirección repetida, mapa que sigue a la dirección, hoja de pago del iPhone): rama → pruebas → main → producción, con su verificación. Todos los países.
- [x] (H2) HECHO 31 oct: circuito completo en el simulador; 10 fallos arreglados (docs/investigaciones-rea/2026-10-31-repaso-iphone-simulador.md). Repaso de las tres apps NATIVAS de iPhone en el simulador contra el sitio de pruebas, de punta a punta: entrar, pedir en Pizzería Demo Novi, pagar con 4242 en la hoja de Stripe, restaurante acepta y marca listo, repartidor acepta, recoge y entrega, cliente califica. REA sobre nuestras apps; cada fallo con prueba en rojo y arreglo. EE. UU.
- [x] (H3) HECHO 31 oct: Android en el emulador hasta el pago, tres arreglos (ver el informe del repaso). El mismo repaso con las tres apps de Android en el emulador, para que la versión acumulada para Google vaya limpia. EE. UU.
- [x] (H4) HECHO 31 oct: certificado 99965J4YRA por la API de Apple, subido a Stripe, variable en eas.json. Apple Pay listo para encender: certificado de procesamiento de Apple Pay del identificador merchant.com.tumbite.cliente en Stripe (prueba y real) y la variable EXPO_PUBLIC_APPLE_PAY_COMERCIO en la compilación de producción. EE. UU.
- [x] (H5) HECHO 31 oct: Divoox compilación 10 y Driver 4 aceptadas por Apple y en TestFlight (todos los arreglos y Apple Pay); se mandan a la tienda cuando Apple apruebe la versión en revisión. Próxima versión de iPhone (1.0.1) en TestFlight con todo lo acumulado, sin tocar las revisiones en curso; lista para mandar cuando Apple apruebe la 1.0. EE. UU.

## Apps de iPhone (membresía de Apple activa el 30 oct 2026; llave de API guardada en ~/.config/tumbite/apple-asc)

- [x] (I1) Asociar en el portal de Apple el identificador de Apple Pay (merchant.com.tumbite.cliente) a la app del cliente y encender notificaciones en Driver y Restaurante. EE. UU.
- [x] (I2) Compilar las tres apps de iPhone con EAS (cliente, Driver y Restaurante). EE. UU.
- [x] (I3) Crear las tres apps en App Store Connect (Divoox 6829108108, Driver 6829108327, Restaurants 6829108322) y subir las compilaciones a TestFlight (subidas el 30 oct). EE. UU.
- [x] (I5) Llave de notificaciones de Apple (APNs): crearla en el portal de Apple y cargarla en EAS para las tres apps, sin contraseña. EE. UU.
- [x] (I4) Fichas de la App Store en inglés y español con capturas reales (10, 7 y 4 + iPad), categoría, edad, copyright, precio gratis, solo EE. UU. y cuentas de revisión. EE. UU.
- [x] (I6) Privacidad de la app publicada en las tres apps (todo vinculado al usuario, nada de seguimiento) y derechos de contenido declarados. Restaurants con su compilación adjunta y ENVIADA a revisión de Apple (30 oct, a2d030b). EE. UU.
- [x] (I7, 31 oct 00:20: Divoox compilación 8 y Driver compilación 3, con el arreglo 5ef2786, adjuntas y «esperando revisión» en Apple) Divoox y Driver: Apple rechazó sus compilaciones por falta del texto del sensor de movimiento (C-IOS-TEXTOS-PERMISO, 5635d7b); se compilan otra vez y, al quedar procesadas, se adjuntan y se envían a revisión con scripts/tiendas/enviar-revision-ios.mjs. EE. UU.

## Divoox Flex como Amazon Flex (bloque real de Richard, 30 oct 2026; ficha docs/investigaciones-rea/2026-10-30-amazon-flex-capturas.md)

- [x] (F1) Color propio de logística en MARCA y en toda pantalla de Flex y Envíos (Driver, cliente y panel de empresa), distinto de comida. Todos los países.
- [x] (F2) Al entrar a Envíos, elegir entre «De A a B» y «Bloque de logística», los dos con el color de logística. Todos los países.
- [x] (F3) «Mi ruta» con tres pestañas: Lista (hora de entrega, check verde, próxima parada), Mapa (filtros Todos, Apartamentos, Prioridad) y Resumen (barras y Pendientes, Correcto, Problemas). Todos los países.
- [x] (F4) Iniciar viaje con elección de app de mapas (Apple Maps o Google Maps) y botón «Ya estacioné». Todos los países.
- [x] (F5) Geocerca de entrega: no deja terminar fuera del área, con el círculo en el mapa y un mensaje claro; salida por soporte. Todos los países.
- [x] (F5b) Dibujar en el mapa de la parada el círculo del área de entrega (200 m), como Amazon Flex. Todos los países.
- [x] (F6) «¿Dónde dejaste el paquete?» con cinco opciones, revisión de la foto con aviso, «Volver a tomar» y «Deslizar para finalizar». Todos los países.
- [x] (F7) Tarjeta de la parada con la foto de la entrega anterior en esa dirección. Todos los países.
- [!] (decide Richard: proveedor de IA para traducir, su clave y su tope de gasto; el proyecto no tiene ninguno) (F7b) Instrucciones del cliente traducidas automáticamente con «Ver original», como Amazon Flex. Todos los países.

## Lanzamiento en producción controlada (directiva del 30 oct 2026, plan en docs/PLAN-LANZAMIENTO-PILOTO.md)

- [x] (P1) Lista de participantes del piloto en el superadmin (cliente, restaurante, repartidor, empresa), con registro de cambios. Todos los países.
- [x] (P2) Cada servicio por ciudad: apagado, solo piloto o público; «solo piloto» lo ven y usan solo los participantes. Todos los países.
- [x] (P3) Límites del piloto: monto máximo por pedido y por día para participantes. Todos los países.
- [x] (R1) Rewards a producción: el nivel de reputación reemplaza al nivel viejo por puntos en Driver. Todos los países.
- [x] (R2) Pantalla «Mi nivel» en Driver: puntaje, cinco componentes, experiencia por servicio, progreso al siguiente nivel y al hito. Todos los países.
- [x] (R3) Panel de Rewards en el superadmin: umbrales, pesos, hitos, porcentaje del margen, presupuesto por ciudad y mes, encendido; sin publicar de nuevo. Todos los países.
- [x] (R4) Prioridad de despacho configurable por nivel (peso 0 = apagada), solo participantes. Todos los países.
- [x] (R5) Premio variable: porcentaje configurable del margen de contribución real de las entregas que cuentan, con topes. Todos los países.
- [x] (R6) Pago real del premio a la billetera, con movimiento, evento y conciliación; nunca más que lo reservado (presupuesto inicial cero hasta que Richard lo fije). Todos los países.
- [x] (R7) Apelaciones del repartidor y su bandeja en soporte. Todos los países.
- [x] (R8) Guías de Rewards en Docs, en español e inglés, con capturas reales. Todos los países.
- [x] Mercado, Farmacia y Licores listos para encender en piloto: el equipo los marca en Superadmin → Piloto cuando las tiendas del grupo se registren (sin código pendiente). EE. UU.
- [x] HECHO 31 oct (docs/ACTIVACION-PILOTO-2026-10-31.md): Envíos «solo piloto» en Miami y Novi con tarifa de mercado (2 USD base, 0,90 por km, mínimo 6, valor máximo 100). EE. UU.
- [!] (decide Richard: aprobación legal y seguro del pasajero) Moto y Carro en piloto: llevan pasajeros reales. EE. UU.
- [x] Monetización prepago: el código ya estaba hecho (Food por políticas, viajes y Tiendas con reserva y cobro, cancelaciones); Flex no aplica; solo falta la activación por mercado, que decide Richard. Todos los países.

## Ahora — en el orden de docs/ROADMAP-DIVOOX.md

### Etapa 1 — Comida lista para lanzar en Miami

- [x] (29 oct: producción lo incluye y la pantalla lo trae; en pruebas responde con datos reales) (1) Comprobar en producción el embudo de pedidos de los informes del superadmin. Todos los países.
- [x] (29 oct: 24 pantallas en pruebas sin errores; arreglados el saludo del inicio con la hamburguesa y «Mi cuenta» con la cabecera vieja; la pizza recortada va a marketing) (2) Repaso en celular (375 px) de todas las pantallas de la app del cliente, Divoox Driver, la app del restaurante y el panel, en el sitio de pruebas, con REA sobre nuestras apps: cada fallo con prueba en rojo, arreglo y publicación. Todos los países.

### Etapa 1½ — Identidad de los repartidores (pedido urgente de Richard, 29 oct, noche)

- [x] (ficha docs/investigaciones-rea/2026-10-29-identidad-repartidores.md con evidencia REA) (K1) Ficha REA de verificación de identidad de repartidores y conductores (DoorDash, Uber, Rappi; proveedores de verificación con documento y selfie y búsqueda de caras repetidas): qué hacen, qué cuesta, qué exige la ley de datos biométricos por país y estado. Comparación con lo que ya tenemos (foto del documento, selfie de control, revisión del equipo). Todos los países.
- [x] (C-FOTO-VERIFICADA) (K2) Foto de perfil real al registrarse: el verificador la compara con el documento, la aprueba y queda BLOQUEADA (el repartidor no la puede cambiar; solo soporte, con motivo y registro). Se muestra en su perfil y al cliente. Servidor, app Driver, panel de verificación, Docs. Todos los países.
- [x] (C-IDENTIDAD-UNICA) (K3) Correo y teléfono únicos de verdad: ni el mismo correo con mayúsculas, puntos o «+algo», ni el mismo teléfono en otro formato, ni los de cuentas cerradas por mala conducta. Todos los países.
- [x] (correo y teléfono, C-IDENTIDAD-UNICA; la foto se compara en K5) (K4) Lista de personas bloqueadas por mala conducta: al cerrar una cuenta por fraude queda su documento, su teléfono y su foto; al registrarse alguien nuevo se compara y, si coincide, va a revisión del equipo. Todos los países.
- [!] (decide Richard: proveedor, costo y consentimiento biométrico con el abogado; recomendación en la ficha K1) (K5) Comparación de caras con IA (foto contra documento y contra la lista de bloqueados), detrás de un interruptor, con el proveedor que salga de la ficha K1. Se enciende cuando Richard apruebe el costo y el consentimiento legal. Todos los países.

- [x] (C-KYC-DOCUMENTO: lectura de licencia y pasaporte, vigencia, edad y cruce; la lectura desde la foto queda en K6b) (K6) Motor de verificación propio (diseño en docs/investigaciones-rea/2026-10-29-kyc-automatico.md, copiado de Idswyft, MIT): servicio en `apps/verificador` con lectura del código de barras de la licencia de EE. UU. y de la franja del pasaporte, cruce con el frente, vencimiento y edad. Con sus pruebas. EE. UU. primero.
- [x] (C-KYC-CODIGO-FOTO: el PDF417 se lee desde la foto con ZXing y sharp; el OCR va en K6c) (K6b) En el motor: leer el código de barras PDF417 y la franja del pasaporte desde la FOTO (decodificador de código abierto con licencia que lo permita) y el texto del frente con OCR, como Idswyft. Con sus pruebas. EE. UU. primero.
- [x] (C-KYC-OCR: corrección por posición con dígitos de control, como los lectores de pasaportes; frente cruzado buscando los datos del código en el texto) (K6c) En el motor: leer con OCR el texto del frente de la licencia y la franja del pasaporte desde la foto (OCR de código abierto con licencia que lo permita, como el de Idswyft), para el cruce. Con sus pruebas. Todos los países.
- [x] (C-KYC-CARAS: face-api con WASM, umbral 0,6, giro hacia los dos lados, lista de mala conducta) (K7) En el motor: comparación de caras (selfie contra documento) y prueba de persona viva (girar la cabeza), con @vladmandic/face-api (MIT). Con sus pruebas. Todos los países.
- [x] (C-KYC-AUTO: servidor y Driver listos; apagado hasta conectar el motor) (K8) Decisión al instante en el servidor y en la app Driver: verificado, en revisión (con motivo para el equipo) o repetir; con el motor apagado, todo sigue como hoy. Consentimiento escrito antes de la selfie. Todos los países.
- [!] (decide Richard: dónde corre el motor, contenedor con costo; y el abogado aprueba el consentimiento biométrico) (K9) Encender el motor en pruebas y después en producción. Todos los países.

### Etapa 2 — Tiendas (Mercado, Farmacia, Licores)

- [x] (ficha docs/investigaciones-rea/2026-10-29-tiendas-reemplazos.md con evidencia REA) (5) Ficha REA de tiendas frente a DoorDash, Instacart y Uber Eats (documentación pública y web como visitante): comprador que reemplaza en vivo con foto, chat de reemplazos, horarios por tienda, límites de licores por estado; comparación con lo nuestro y brechas en orden. Todos los países.
- [x] (reemplazos propuestos por la tienda, C-TIENDAS-REEMPLAZOS; quedan en la ficha la foto en la propuesta y los horarios de licores por estado) (6) Construir las brechas de la ficha de tiendas, solo en el sitio de pruebas, de punta a punta. Todos los países.

- [x] (6b) Foto del producto en cada reemplazo propuesto (cliente y tienda). Todos los países.

### Etapa 3 — Moto

- [x] (C-VIAJE-TARJETA; la propina después del viaje queda en el punto 8b) (8) Pago de los viajes con tarjeta (Stripe en modo prueba) y propina, solo en pruebas. Todos los países.
- [x] (C-VIAJE-PROPINA) (8b) Propina después del viaje con la tarjeta guardada (como la propina posterior de Comida). Todos los países.
- [x] (C-CARGO-AL-AFECTADO) (9) El cargo de cancelación va al conductor afectado, no al del siguiente viaje. Todos los países.
- [x] (C-VIAJE-SEGURIDAD-2) (10) Seguridad del viaje: contactos de emergencia, aviso si el viaje se desvía y límite de horas al volante. Todos los países.
- [x] (C-MOTO-CIUDAD) (11) Interruptores por ciudad: código solo de noche y selfie con casco. Todos los países.
- [x] (C-DOCS-MOTO-BORRADOR) (12) Guías de Docs de Moto escritas y guardadas sin publicar (se publican al encender). Todos los países.

### Etapa 4 — Carro

- [x] (docs/investigaciones-rea/2026-10-30-carro.md) (14) Ficha REA de Carro: Uber y DiDi por su documentación y web pública, y apps de transporte de código abierto con licencia que lo permita. Todos los países.
- [x] (C-CARRO-PRUEBAS; XL queda en 15b) (15) Carro sobre el motor de Moto, solo en pruebas: requisitos del conductor, tipos de carro, tarifa, oferta y viaje de punta a punta en cada publicación. Todos los países.
- [x] (C-CARRO-XL) (15b) Carro grande (XL, 6 plazas o más): tipo de viaje con su tarifa por ciudad, solo a conductores con carro de 6 plazas. Todos los países, solo en pruebas.

### Etapa 5 — Envíos de persona a persona

- [x] (docs/investigaciones-rea/2026-10-30-envios.md: sobre el motor de viajes, como Uber Courier) (17) Ficha REA de Envíos: Uber Connect y DoorDash (paquetes), y qué se reutiliza de Flex. Todos los países.
- [x] (C-ENVIOS; guías de Docs en 18b) (18) Construir Envíos solo en pruebas: cotizar de A a B, pagar con Stripe de prueba, recoger con foto, entregar con PIN y seguimiento. Todos los países.
- [x] (borradores/envios.ts) (18b) Guías de Docs de Envíos (quien envía, quien recibe, conductor) en español e inglés, guardadas sin publicar como las de Moto. Todos los países.

### Etapa 6 — «Más»

- [x] (C-EXPLORAR) (20) Ficha REA de «Explorar» de los grandes y construir la pantalla «Más» con todos los servicios y categorías. Todos los países.

## Trabado por Richard (se hace apenas lo decida; el detalle está en PENDIENTES.md)

- [!] (Fase 2 COMPLETADA el 30 oct en modo sombra solo en pruebas, rama fase-rewards-2, informe docs/REWARDS-FASE-2-RESULTADOS.md; la Fase 3 espera tu orden: porcentaje del margen y presupuesto por ciudad) Divoox Rewards: puntaje de 0 a 100 como DoorDash, niveles en vivo, beneficios, premios en dinero por hitos y Docs. Ficha: docs/investigaciones-rea/2026-10-30-niveles-repartidor.md. Todos los países.
- [!] (necesita que Richard abra su sesión de administrador en divoox.com/panel; yo no escribo contraseñas) Google Play, accesos de revisión: preparar el escenario aislado en staging y comprobar que las tres cuentas de revisión entran en las tres apps. EE. UU.
- [!] (espera tu visto bueno: hay que reconstruir la tabla de restaurantes en producción porque hoy un dueño solo puede tener uno; ficha lista en docs/investigaciones-rea/2026-10-29-varios-locales.md) Varios locales en una sola cuenta (DoorDash Merchant para cadenas): primero la ficha en docs/investigaciones-rea con todo lo que hoy supone un local por dueño (fotos, verificación del local, cobros, activación, miembros); después construir con selector de local en panel y app. Todos los países.
- [!] (espera tu sí: gasta dinero si pasa de lo gratis; tope propuesto 300 cargas al día; ficha en docs/investigaciones/2026-10-29-mapa-de-la-web.md) Mapa de la web moderno con Google Maps, igual que en las apps, en una sola pieza para las cuatro pantallas. Todos los países.
- [!] (después de que Google apruebe la revisión en curso: la ubicación en segundo plano exige en Google Play una declaración y un video, y agregarla ahora puede frenar la aprobación) GPS en segundo plano en Divoox Driver mientras hay un pedido en curso (como Dasher): sigue mandando la ubicación con la pantalla apagada y se apaga al entregar; aviso claro al pedir el permiso. Ficha REA antes. Todos los países.
- [!] (dinero: precio y beneficios los decide Richard) Suscripción tipo DashPass (envío gratis y menos servicio con cobro mensual). Todos los países.
- [!] (lo decide el contador: tasas por condado) Impuesto de ventas de Florida por condado en el total. EE. UU.
- [!] (dinero) Tarjetas de regalo y regalar un pedido a otra persona. Todos los países.
- [!] (toca el cobro: un solo pago repartido entre dos restaurantes, y el circuito de pagos todavía no está probado de punta a punta; la auditoría lo deja «cuando haya densidad») Pedir a dos tiendas en un solo pedido (DoubleDash): un carrito con dos locales cercanos, un repartidor y una entrega. Todos los países.
- [!] (dinero: cuánto se paga por minuto y por milla lo decide Richard) Ganar por tiempo además de por oferta (como «Earn by Time» de Uber y DoorDash). Todos los países.
- [!] (dinero: precio de los anuncios y cómo se cobran lo decide Richard) Promociones y anuncios pagados dentro de la app («patrocinado») con presupuesto y reporte para el restaurante. Todos los países.
- [x] HECHO 1 nov (C-SMS-EQUIPO): la emergencia de un repartidor y el canario en rojo también llegan por SMS al equipo (Twilio, solo países encendidos). Todos los países.

## Etapa 1, punto 2 · Repaso en el celular de lo nuevo (30 oct 2026)

- [x] (C-TEXTOS-POR-SERVICIO: Carro y Envíos mostraban los textos de Moto; arreglado) (21) Repaso con REA en el sitio de pruebas, tamaño celular, de las pantallas nuevas del cliente: Moto (contactos de confianza), Carro y Carro XL, Envíos (formulario del paquete y PIN) y «Más». Cada fallo: prueba en rojo y arreglo. Todos los países.
- [x] (inicio y cuenta sin errores en pruebas; la oferta, la foto y el PIN se cubren con el recorrido automático del punto 23) (22) Repaso con REA en el sitio de pruebas del Driver: verificación con el motor apagado, oferta de Carro y de Envíos, foto del paquete y PIN de entrega. Cada fallo: prueba en rojo y arreglo. Todos los países.
- [x] (C-RECORRIDO-CARRO-ENVIOS) (23) Recorrido automático de punta a punta de un viaje en Carro y de un Envío en la app web (como el de Comida), con capturas para Docs cuando se enciendan. Todos los países.
- [x] (C-COLORES-DRIVER) (24) Colores de marca en el Driver: la campana y el ícono activo de la barra de abajo salen en azul (fuera de la paleta de Divoox); pasarlos a rojo y negro desde la pieza única, con su prueba. Todos los países.

## Etapa 1, punto 3 · Repaso del restaurante y de Flex, y nueva fila del roadmap (30 oct 2026)

- [x] (C-MAS-RESTAURANTE: «Más» estaba casi vacía; ahora trae la lista de DoorDash Merchant) (25) Repaso en el sitio de pruebas, tamaño celular, de la app del restaurante (inicio, pedidos, menú, cuenta): marca, textos, errores en consola y pedidos fallidos. Cada fallo: prueba en rojo y arreglo. Todos los países.
- [x] (C-FLEX-ACTIVIDAD: códigos internos y horas crudas en el panel; arreglado) (26) Repaso en el sitio de pruebas, tamaño celular, del panel de Divoox Flex (empresa: inicio, envíos, rutas, saldo): marca, textos y errores. Cada fallo: prueba en rojo y arreglo. Todos los países.
- [x] (hecha el 30 oct: once brechas, cargadas abajo como puntos 28 a 38) (27) Auditoría de lo que falta del roadmap: comparar los estudios de Richard, la comparación del ciclo del pedido y la auditoría final con lo construido; cada brecha que no dependa de Richard entra a esta fila en orden de lanzamiento. Todos los países.

## Etapa 8 · Brechas frente a los grandes (auditoría del 30 oct 2026), en orden de lanzamiento

- [x] (C-CALIFICACION-PUBLICA) (28) Calificación del restaurante visible para el cliente: estrellas y número de votos en la lista, el buscador y la ficha, y las reseñas en la ficha (como Uber Eats y DoorDash). Quitar las estrellas inventadas de las tarjetas de ejemplo. Todos los países.
- [x] (C-ACEPTAR-SOLO) (29) Aceptación automática de pedidos (interruptor del restaurante, como DoorDash: el pedido se confirma solo y se busca repartidor al instante). Todos los países.
- [x] (C-NOTA-PLATO) (30) Nota por plato («sin cebolla», «bien cocido»): el cliente la escribe en cada plato y el restaurante y el repartidor la ven. Todos los países.
- [x] (C-AGOTADO-HOY) (31) «Agotado hasta mañana» en los platos de comida (hoy, sin fecha o hasta una hora), reutilizando lo de Tiendas, en el panel y en la app del restaurante. Todos los países.
- [x] (C-CORREO-ENTREGA) (32) Correo al cliente al entregar, con la foto de la entrega (como DoorDash). Todos los países.
- [x] (C-DIRECCION-APTO) (33) Dirección con casilla aparte para apartamento, piso o edificio. Todos los países.
- [x] (C-MENU-PLANILLA) (34) Alta asistida: el equipo carga el menú por el restaurante, e importación del menú de comida por hoja de cálculo (reutilizando la de Tiendas). Todos los países.
- [x] (C-OPCIONES-ANIDADAS) (35) Modificadores anidados y grupos de opciones compartidos entre platos (el combo pide la bebida y la bebida el tamaño). Todos los países.
- [x] (C-MENU-HORARIO) (36) Menús por horario: categorías con franja (desayuno, almuerzo). Todos los países.
- [x] (C-APP-RESTAURANTE-PAR: horario, cierres y reseñas en la app; las opciones de platos siguen en el panel) (37) La app del restaurante a la par del panel: horarios y cierres, reseñas con respuesta y extras desde el celular. Todos los países.
- [x] (C-CHAT-FOTOS) (38) Fotos dentro del chat del pedido (para mostrar reemplazos en Tiendas). Todos los países.
- [x] (la ventanita no tenía uso: se quitó) (39) Driver: la ventanita «Muy pronto» está montada pero nada la abre; quitarla o conectarla. Todos los países.
- [x] (C-APP-OPCIONES) (40) La app del restaurante edita también las opciones y extras de cada plato (hoy solo en el panel), con opciones anidadas, como Uber Eats Manager. Todos los países.

## Hecho

- Hasta el 29 oct, noche, quedaron hechos 50 puntos de la fila anterior. Cada uno tiene su commit en git y su candado en `CANDADOS.md`.

## Cada sesión

- Mirar si Google aprobó las tres apps (consola de Google Play); si sí, anotarlo y seguir el plan de las apps.

## Bitácora

- 29 oct 2026, noche (tarea programada): la fila estaba vacía; se rellenó con tres puntos de la auditoría y se hizo «Filtros de dieta» de punta a punta (prueba en rojo, arreglo, verify, staging y producción).
- 29 oct 2026, noche: «Mapa de demanda» hecho (zonas con más pedidos en el mapa del Driver); «reasignar repartidor» ya existía y se marcó.
- 29 oct 2026, 22:10 (tarea programada): la fila no tenía puntos abiertos. Se revisó la auditoría del 18 oct: todo lo que la IA puede hacer sola ya está hecho (pedidos agrupados y niveles con requisitos ya existían). Se anotaron los cuatro puntos que quedan, todos trabados por dinero o por el circuito de pagos. En PENDIENTES se cerró «apps de pruebas con la dirección de pruebas» (los perfiles de pruebas ya apuntan a staging).
- 29 oct 2026, noche: Richard pidió ordenar todo y trabajar de corrido. Nuevo plan maestro `docs/ROADMAP-DIVOOX.md` (estado de cada servicio y siete etapas); la fila sigue ese orden.
- 30 oct 2026, 02:10 (tarea programada): sin pausa y sin otra sesión activa. La fila no tiene puntos `[ ]`: las etapas 1 a 6 del plan maestro están hechas y la 7 es toda de Richard (puntos `[!]`). Producción (divoox.com) ya muestra el último commit (6a93366). El estado real de la revisión de Google Play solo se ve en la consola con la sesión de Richard; no se pudo comprobar. No se tocó código.
- 30 oct 2026, 04:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace 74 minutos). La fila no tiene puntos `[ ]`: los puntos 21 a 24 del repaso en el celular quedaron hechos y lo que queda es todo `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit (7353d67). No se tocó código.
- 30 oct 2026, 06:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) muestra el último commit (4a46ba1). No se tocó código.
- 30 oct 2026, 08:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) muestra el último commit (aad1f80). No se tocó código.
- 30 oct 2026, 10:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace 23 minutos). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Se esperó a que terminara la publicación en curso; pruebas y producción (divoox.com) muestran el último commit (e9be234). No se tocó código.
- 30 oct 2026, 14:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace tres horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard (Rewards Fase 3 espera su orden; la rama fase-rewards-2 sigue solo en pruebas). Producción (divoox.com) muestra el último commit (bb587af). No se tocó código.
- 30 oct 2026, 16:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace dos horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) muestra el último commit publicado (bb587af; los posteriores son [skip ci]). No se tocó código.
- 30 oct 2026, 18:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace dos horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit publicado (3c39b7d; los posteriores son solo documentos). No se tocó código.
- 31 oct 2026, 00:20 (tarea programada): otra sesión compiló Divoox y Driver para iPhone con el arreglo del sensor de movimiento; esta tarea esperó a que Apple las procesara, adjuntó la de Driver y envió las dos a revisión. Las tres apps de iPhone quedan en revisión de Apple. Lo demás de la fila es de Richard. EE. UU.
- 31 oct 2026, 02:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas, en la rama fase-repaso-1). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) muestra 3c39b7d y pruebas 2d6fd27 (los commits posteriores son [skip ci]). La rama fase-repaso-1 lleva arreglos de iPhone todavía sin fusionar a main; se deja a la sesión que la trabaja. No se tocó código.
- 31 oct 2026, 04:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) sigue en 3c39b7d y pruebas en 2d6fd27; la rama fase-repaso-1 sigue sin fusionar y se deja a su sesión. No se tocó código.
- 31 oct 2026, 06:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) sigue en 3c39b7d y pruebas en 2d6fd27; la rama fase-repaso-1 sigue sin fusionar y se deja a su sesión. No se tocó código.
- 31 oct 2026, 12:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace 74 minutos). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit (6561001); la verificación y la publicación de main dieron verde. No se tocó código.
- 31 oct 2026, 14:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace 32 minutos). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit (38fa434, el repaso de la tarde ya fusionado). No se tocó código.
- 31 oct 2026, 16:10 (tarea programada): sin pausa; main sin commits en dos horas, pero otra sesión trabaja la rama fase-repaso-1 (último commit hace 25 minutos, ya en pruebas con 8c00d21) y se deja a esa sesión. La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) muestra 38fa434. No se tocó código.
- 31 oct 2026, 20:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace 53 minutos, la rama fase-repaso-1 ya fusionada). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit (7c6977e). No se tocó código.
- 1 nov 2026, 00:10 (tarea programada): sin pausa. La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Otra sesión fusionó fase-repaso-1 a main hace 22 minutos y su verificación sigue corriendo (pruebas en e08346d, producción en ec0f130); se deja terminar sin tocarla. No se tocó código.
- 1 nov 2026, 02:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace 76 minutos). La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit (208a535). No se tocó código.
- 1 nov 2026, 06:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas). La fila sigue sin puntos `[ ]`: todo lo que queda es `[!]` de Richard. Pruebas y producción muestran 208a535. No se tocó código.
- 1 nov 2026, 04:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace dos horas). La fila sigue sin puntos `[ ]`: todo lo que queda es `[!]` de Richard. Pruebas y producción muestran 208a535. No se tocó código.
- 1 nov 2026, 15:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace 44 minutos). La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Pruebas ya muestran 5655439; producción sigue en 6fad5f1 porque la verificación de main de ese commit todavía corre y publicará sola. No se tocó código.
- 1 nov 2026, 17:10 (tarea programada): sin pausa; main sin commits en 46 minutos, pero otra sesión trabaja la rama fase-repaso-1 (último commit hace un minuto, pruebas ya en 2f8b17c) y se deja a esa sesión. La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Producción (divoox.com) muestra a5b775d. No se tocó código.
- 1 nov 2026, 19:10 (tarea programada): sin pausa y sin otra sesión activa (último commit hace 33 minutos). La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Pruebas y producción ya muestran el último commit (7b8675f, «Mis casos de ayuda» y buzón de soporte por app). No se tocó código. Todos los países.

- [x] HECHO 1 nov: no era la campana; la app se quedaba en la pantalla roja confirmando la sesión con el sitio de pruebas lento (hasta 3 intentos de 8 s) y la prueba solo esperaba 20 s; ahora espera 45 s. De paso, el enlace «¿Una empresa te invitó?» de Driver ya no queda sobre el mapa. (Original:) El recorrido de Comida en inglés del sitio de pruebas falla dos veces seguidas esperando el punto rojo de la campana del cliente (`campana-punto`, recorrido.spec.ts:802) con código que antes pasó: revisar con REA si es carrera o datos acumulados del sitio de pruebas. Todos los países.

- [!] (espera que Google y Apple terminen sus revisiones: cambiar la ficha ahora puede cruzarse con ellas) Correo de contacto de las fichas de Google Play y del App Store al buzón de soporte de cada app (soporte+divoox, soporte+divoox.driver y soporte+divoox.restaurantes @windoce.com). Lo hago yo por la API apenas aprueben. Todos los países.

## Repaso del 1 nov (docs/REPASO-ROADMAP-2026-11-01.md): construir como el mercado, apagado hasta poner el dinero

- [x] HECHO 1 nov (C-GANAR-POR-TIEMPO). (R-T1) Ganar por tiempo («Earn by Time»): el repartidor elige cobrar por minuto y milla; superadmin con tarifa en cero (apagado); servidor, Driver, Docs y pruebas. Todos los países.
- [x] HECHO 1 nov (C-ANUNCIOS). (R-T2) Anuncios patrocinados («Sponsored Listings»): el restaurante sale primero con «Patrocinado», paga solo por pedido entregado desde el anuncio, presupuesto semanal y reporte de 30 días; precio en cero (apagado). Servidor, panel del restaurante, superadmin, app del cliente, Docs y pruebas. Todos los países. (Las tiendas usan su propia vitrina: quedan para cuando haya tiendas reales.)
- [x] HECHO 1 nov (C-PLUS). (R-T3) Divoox Plus (suscripción tipo DashPass): envío gratis y medio servicio desde el mínimo, cobro mensual con Stripe que solo se activa con la factura pagada, cancelar al final del periodo; apagado y bloqueado con llave real hasta probar el cobro en staging con la 4242. Solo EE. UU.
- [x] HECHO 1 nov (C-TARJETAS-REGALO). (R-T4) Tarjetas de regalo: comprar para alguien con mensaje, código por correo al confirmarse el pago, canjear como saldo y usarlo en el carrito (vuelve si el pedido se cancela); apagadas y bloqueadas con llave real hasta probar en staging con la 4242. Solo EE. UU.

## Bloque CLI — lo que el cliente de los grandes tiene y nosotros no (2 nov 2026, 12:15, tarea programada)

> Salen de recorrer la app del cliente contra DoorDash y Uber Eats (búsqueda, menú, carrito). Cada uno de punta a punta: servidor si toca, app, Docs en dos idiomas con captura, prueba en rojo y publicación.

- [x] HECHO 2 nov (C-BUSQUEDAS-RECIENTES), commit 8a04417; sin publicar todavía: GitHub perdió la sesión de esta computadora. (CLI-1) Búsquedas recientes en el buscador de la app del cliente, como DoorDash y Uber Eats: las últimas 8 búsquedas bajo la casilla, tocar para repetir, borrar una o todas; se guardan en el teléfono de esa persona. Todos los países.
- [x] HECHO 2 nov (C-ORDENAR-COMIDA); «menor envío» no va aparte porque el envío sale de la distancia y ya está «Más cerca»; sin publicar todavía (GitHub sin sesión). (CLI-2) «Ordenar por» en los resultados de Comida (recomendado, entrega más rápida, mejor calificados, menor envío) y filtros rápidos «Menos de 30 min» y «4,5 o más», como Uber Eats. Todos los países.
- [x] HECHO 2 nov (C-MAS-PEDIDOS); sin publicar todavía (GitHub sin sesión). (CLI-3) «Lo más pedido» en el menú del restaurante: sección arriba con los platos más pedidos de los últimos 30 días y la etiqueta «N.º 1 más pedido», como DoorDash. Todos los países.
- [x] HECHO 2 nov (C-ALERGIAS): casilla en el carrito, columna nueva por COLUMNAS, resaltado en rojo en la app y el panel del restaurante y arriba del ticket; si no la puede cumplir, rechaza con devolución total (ya existía). Sin publicar todavía (GitHub sin sesión). (CLI-4) Pedido de alergias en el carrito, como Uber Eats («Allergy requests»): casilla aparte de las instrucciones; el restaurante la ve resaltada en su pantalla y en el ticket, y puede rechazar si no puede cumplirla. Todos los países.
- [x] HECHO 2 nov (C-TARIFAS-EXPLICADAS); sin publicar todavía: GitHub perdió la sesión de esta computadora. (CLI-5) Explicación de tarifas en el carrito: botón de información junto a envío, servicio e impuestos que abre una hoja con qué es cada cargo, como «Fees & Estimated Tax» de DoorDash. Todos los países.
- [x] HECHO 2 nov (C-REGALAR-PEDIDO): interruptor en el carrito, SMS al destinatario con el mensaje y el seguimiento al pagarse (sale cuando Twilio esté encendido), nombre sin celular para restaurante y repartidor. Sin publicar todavía (GitHub sin sesión). (CLI-6) Regalar un pedido («Send as a gift» de DoorDash y Uber Eats): nombre y teléfono del destinatario y un mensaje; el destinatario recibe el seguimiento por SMS o correo; se paga con el cobro normal. Todos los países.
- [x] HECHO 2 nov (C-REFERIDOS): servidor, app y superadmin, apagado y en cero; la guía de Docs entra con sus capturas al publicar. [sesión: Divoox.com] (CLI-7) Invitar a un amigo (referidos, como DoorDash y Uber Eats): código personal para compartir, crédito para los dos en el primer pedido; construido completo y APAGADO con monto en cero hasta que Richard fije el dinero. Todos los países.

## Bloque PLT — lo que los grandes tienen en platos, repartidores y restaurantes (2 nov 2026, 14:20, tarea programada)

> La fila estaba vacía. Revisado el código contra DoorDash y Uber Eats: estas cinco cosas no existen todavía. GitHub sigue sin sesión en la computadora: lo que se haga queda guardado en la rama y se publica cuando Richard vuelva a entrar.

- [x] HECHO 2 nov (C-GUSTO-PLATOS); sin publicar todavía (GitHub sin sesión); la captura del menú con el porcentaje se toma del sitio de pruebas al publicar. (PLT-1) Calificar cada plato con pulgar arriba o abajo al calificar el pedido, y en el menú «Le gustó al 92 % (40)» cuando hay al menos 5 votos, como DoorDash. El restaurante lo ve en Reseñas. Todos los países.
- [x] HECHO 2 nov (C-AUDITIVA-REPARTIDOR); sin publicar todavía (GitHub sin sesión); la captura de Seguridad se rehace del sitio de pruebas al publicar. (PLT-2) Repartidor sordo o con dificultad auditiva, como Uber y DoorDash: interruptor en Driver; el cliente y el restaurante ven «Tu repartidor tiene dificultad auditiva: escríbele por el chat», y las ofertas avisan con vibración fuerte. Todos los países.
- [x] HECHO 2 nov (C-CALORIAS); sin publicar todavía (GitHub sin sesión). (PLT-3) Calorías opcionales por plato, como Uber Eats (la ley federal las exige a cadenas de 20 o más locales): casilla en el menú del restaurante y «520 cal» en la app del cliente. EE. UU.
- [x] HECHO 2 nov (C-PLANILLA-PEDIDOS); sin publicar todavía (GitHub sin sesión). (PLT-4) Panel del restaurante: descargar los pedidos de un rango de fechas en una planilla (CSV), como el reporte de Uber Eats Manager. Todos los países.
- [ ] (PLT-5) Driver: descargar las ganancias del mes en una planilla (CSV) desde Ganancias, como el estado de cuenta de Uber Driver. Todos los países.

## Registro de la fábrica

- 31 oct 2026, 10:50: la verificación de main había fallado en la prueba de compra en tienda (buscaba la casilla vieja «Dirección de entrega»); se corrigió a «Calle y número», pasó en la nube y quedó publicado en pruebas y en producción (c268d83). Todos los países.
- 1 nov 2026 (tarea programada): sin pausa. La fila no tiene puntos `[ ]`: lo que queda es todo `[!]` de Richard. Producción (divoox.com) muestra 2c502af, el último de main; la rama fase-repaso-1 (página de progreso y gerente, hasta 6e760cc) está en pruebas y la lleva su propia sesión, así que no se fusionó ni se tocó código.

- 1 nov 2026, 22:30 (tarea programada): CAP-1 hecho. Tres capturas reales del mapa de Driver (zona, detalle al tocar y pago por hora pico) en la guía de zonas, en español e inglés, con su prueba. Guion capturas-zonas.mjs: crea pedidos en efectivo solo en pruebas, fotografía y los cancela. Todos los países.

- 1 nov 2026, 23:50 (tarea programada): CAP-7 hecho. 21 guías de Docs que no tenían foto ahora la tienen, en español e inglés (cursos, comparación, pedido en grupo, seguimiento, pago, filtros de dieta, instrucciones, panel del restaurante, Driver y Flex en inglés). Prueba nueva: ninguna guía sin captura, salvo las dos de CAP-7b. Guion capturas-guias-faltantes.mjs, solo en pruebas; deja platos, efectivo y grupos como estaban. Todos los países.
- 2 nov 2026, 01:05 (tarea programada): CAP-7b hecho. El recorrido local (con CAPTURAS=1) suma una segunda pizzería abierta y fotografía «Te puede gustar» y «Califica a tus clientes de hoy» después de la entrega; las dos guías ya tienen foto y la prueba de Docs no tiene excepciones: ninguna guía sin captura. Todos los países.
- 2 nov 2026, 02:10 (tarea programada): sin pausa. La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. La verificación del último commit (9f567e0, colores de «Entregado») está corriendo en GitHub; producción todavía muestra a098a47 y se pondrá al día sola cuando termine la publicación. No se tocó código ni se publicó nada para no frenar esa corrida.
- 2 nov 2026, 08:10 (tarea programada): sin pausa; último commit en main hace 42 minutos (468eee7, página de contacto), ya en pruebas y con su verificación de main todavía corriendo en GitHub; producción muestra 9f567e0 y se pondrá al día sola. La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. No se tocó código ni se rellenó la fila para no cruzarse con la sesión que trabaja fase-repaso-1. Todos los países.
- 2 nov 2026, 09:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace una hora). La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit publicado (468eee7) y la verificación y publicación de main dieron verde. No se tocó código. Todos los países.
- 2 nov 2026, 10:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace una hora). La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Pruebas y producción (divoox.com) muestran el último commit publicado (468eee7); verificación, publicación y reloj de main en verde. No se tocó código. Todos los países.
- 2 nov 2026, 11:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace una hora). La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Producción (divoox.com) muestra el último commit publicado (468eee7); verificación, publicación y reloj de main en verde. No se tocó código. Todos los países.
- 2 nov 2026, 12:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace una hora). La fila no tiene puntos `[ ]`: todo lo que queda es `[!]` de Richard. Producción (divoox.com) muestra el último commit publicado (468eee7). No se tocó código. Todos los países.
- 2 nov 2026, 13:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace una hora). La fila sigue sin puntos `[ ]`: lo que queda es `[!]` de Richard. Producción (divoox.com) muestra el commit 468eee7. No se tocó código. Todos los países.
- 2 nov 2026, 14:10 (tarea programada): sin pausa y sin otra sesión activa (último commit en main hace 54 minutos). La fila sigue sin puntos `[ ]`: lo que queda es `[!]` de Richard, y las 18 brechas de la comparación con los grandes ya están hechas o esperan una cuenta de un tercero. Producción (divoox.com) muestra f1d266f (prepago de VE y CO), con verificación y publicación de main en verde. No se tocó código. Todos los países.
- 2 nov 2026, 15:10 (tarea programada): sin pausa; main sin commits en 53 minutos, pero hay un guardado automático de otra sesión en la rama fase-repaso-1 hace 14 minutos y se deja a esa sesión. La fila sigue sin puntos `[ ]`: lo que queda es `[!]` de Richard. Pruebas ya muestran ce6642d (términos y guías dentro de la app); la publicación a producción de ese commit está corriendo y divoox.com todavía muestra f1d266f. No se tocó código. Todos los países.

- 2 nov 2026, 12:30 (tarea programada): la fila estaba vacía y se rellenó con el bloque CLI (siete funciones de la app del cliente que tienen DoorDash y Uber Eats). Hechos CLI-1 (búsquedas recientes, 8a04417) y CLI-5 (explicación de tarifas, 29ba887), con prueba en rojo, verificación completa en verde y Docs en dos idiomas. NO están publicados: la sesión de GitHub de esta computadora desapareció entre las 11:35 y las 12:10 (gh sin token, llavero vacío) y git push falla; Richard tiene que volver a entrar a GitHub. Las capturas nuevas de Docs se toman del sitio de pruebas apenas se publique. Todos los países.

- 2 nov 2026, 12:40 (tarea programada, misma vuelta): hechos además CLI-2 (ordenar y filtros rápidos, 139632d), CLI-3 (lo más pedido, 471059d), CLI-4 (alergias, en el guardado automático 75561102 y 75d911b) y CLI-6 (regalar un pedido, en el guardado automático 43c1ebc), cada uno con prueba en rojo y Docs en dos idiomas. Siguen SIN publicar: GitHub sin sesión en la computadora. CLI-7 (referidos) queda para la próxima vuelta: otra sesión está trabajando ahora en la misma carpeta (commit bf637a4) y la regla es no pisarla. Todos los países.

## Pedidos de Richard del 1 nov (noche) — en este orden

- [x] HECHO 1 nov (C-DOCS-ZONAS). (CAP-1) Capturas en Docs de «Zonas con más pedidos»: mapa real de Driver con zonas marcadas (3 o más capturas). Todos los países.
- [x] HECHO 1 nov. (CAP-2) Capturas de «Ganar por tiempo»: la tarjeta «¿Cómo quieres cobrar hoy?» en Driver y el superadmin. Todos los países.
- [x] HECHO 1 nov. (CAP-3) Capturas grandes de «Anuncios»: el panel del restaurante (encender, presupuesto, reporte), la etiqueta «Patrocinado» en la app del cliente y el superadmin. Es material de venta. Todos los países.
- [x] HECHO 1 nov. (CAP-4) Capturas de «Divoox Plus»: la pantalla para suscribirse, el carrito con el descuento y Mi cuenta. EE. UU.
- [x] HECHO 1 nov. (CAP-5) Capturas de «Tarjetas de regalo»: comprar, canjear, saldo y el interruptor del carrito. EE. UU.
- [x] HECHO 1 nov. (CAP-6) Capturas y explicación paso a paso de «Mandar capturas a soporte». Todos los países.
- [x] HECHO 1 nov (C-DOCS-CON-CAPTURAS). (CAP-7) Revisar TODAS las guías de Docs y agregar capturas a las que no tengan (regla nueva: ninguna guía sin captura). Todos los países.
- [x] HECHO 2 nov (C-DOCS-CON-CAPTURAS). (CAP-7b) Capturas de «Te puede gustar» (cliente con un pedido entregado en una pizzería y otra pizzería abierta) y de «Calificar al cliente» (Driver con una entrega de hoy): sumarlas al recorrido (npm run recorrido:capturas), que es el único que completa una entrega con fotos y GPS. Al tenerlas, sacarlas de ESPERAN en guiasPublicas.test.tsx. Todos los países.
- [x] HECHO 1 nov. (PRO-1) Página de progreso: sección «Qué hace cada app» (cliente, Driver, restaurante) y «Lo que solo existe en el panel web», pensada para explicar la startup a clientes, inversores y aceleradoras. Todos los países.
- [x] HECHO 1 nov. (STA-1) Llamarla «la startup Divoox» en la web y en Docs donde corresponda (portada, Acerca de, franquicias, presentaciones). Todos los países.

## Bloque G — brechas que quedan frente a los grandes (2 nov 2026, madrugada; revisión del código contra docs/COMPARACION-CICLO-PEDIDO.md) [sesión: Estructura de agentes]

> Reparto con la sesión principal: ella sigue con CAP-7b, UX-3 y UX-4 (pantallas de las tres apps). Este bloque lo hace la sesión «Estructura de agentes» en su propia rama (bloque-g) y se le entrega para fusionar.

- [x] HECHO 2 nov. (G1) Poner al día la tabla «Lo que NO tenemos» de docs/COMPARACION-CICLO-PEDIDO.md: 13 de las 18 brechas ya están hechas con su candado; dejar abiertas solo las que de verdad faltan. Todos los países.
- [x] HECHO 2 nov (C-GPS-ESTUDIOS). (G2) GPS de la entrega como el estudio: precisión exigida 30 m (hoy 60), radio de llegada unos 80 m (hoy 200) y detección de ubicación simulada en Android, que manda el caso a soporte en vez de aceptar. Todos los países.
- [x] HECHO 2 nov (C-EDAD-REPARTIDOR). (G3) Edad mínima del repartidor por estado y por vehículo, como DoorDash y Uber (Florida y Texas 19, California 21, moto y carro 19), con interruptor por zona; la edad sale de la fecha de nacimiento que ya trae la verificación. EE. UU.
- [x] HECHO 2 nov en el catálogo (C-REQUISITOS-VEHICULO); el reparto de Comida lo exige en G4b. (G4) Licencia y seguro según el vehículo también en Comida (en carro o moto se piden; en bici o a pie no), con la tabla servicio por vehículo. Todos los países.
- [x] HECHO 2 nov (C-PAPELES-VEHICULO): licencia y seguro vigentes al conectarse en carro o moto, con interruptor en Superadmin → Verificaciones (nace apagado). Que el reparto de Comida lea todo el catálogo de habilitaciones (M6) queda para cuando se enciendan más servicios. (G4b) Todos los países.
- [x] HECHO 2 nov (C-RESUMEN-1099), emisión apagada. (G5) Resumen anual por repartidor con el umbral de 2.000 dólares del formulario 1099-NEC, apagado; la emisión real la decide el contador. EE. UU.
- [x] HECHO 2 nov. (G6) Quitar del Driver los textos «¡Muy pronto en Divoox!» que quedaron sin uso. Todos los países.

## Pedidos de Richard del 1 nov (noche, con capturas del iPhone) — después de lo anterior

- [x] HECHO 1 nov. (UX-1) App del cliente, «Mis pedidos»: rediseñar las tarjetas como los grandes (miniatura del local o del plato, estado con color, verde para entregado, botones bien hechos: hoy «Ver pedido y recibo» sale como un óvalo roto y «Repetir pedido» parte el texto en dos líneas). Todos los países.
- [x] HECHO 1 nov. (UX-2) Navegación: desde Mi cuenta → un pedido → la flecha de volver tiene que regresar a Mi cuenta, no al inicio. Buscar el mismo fallo en todas las pantallas de las tres apps (volver siempre al lugar de donde se vino). Todos los países.
- [x] HECHO 2 nov. (UX-3) Menos rojo, blanco y negro: sumar el verde de éxito y colores de apoyo donde corresponda (estados, confirmaciones, tarjetas), sin romper la identidad. Todos los países.
- [x] HECHO 2 nov. (UX-4: repaso de 11 pantallas de las tres apps en los dos idiomas con scripts/docs/repaso-pantallas.mjs; arreglados los fallos encontrados) Revisar TODAS las pantallas de las tres apps en español e inglés (textos cortados, botones deformes, textos en el otro idioma) y el inicio (menús, servicios) con terminación profesional. Captura antes y después de cada arreglo. Todos los países.

## Bloque COB — cobertura del dinero al 90 % (2 nov 2026, 11:10, tarea programada)

> Medido hoy: cobertura total 82,6 %. La regla global pide 90 % en todo lo que toca dinero; estos archivos del servidor están por debajo. Solo pruebas nuevas que describen lo que el código YA hace; si una prueba destapa un fallo, se arregla con su prueba en rojo.

- [x] HECHO 2 nov (C-FIN-CONCILIACION). (COB-1) `finanzas/reloj.ts` (65 %) a 91 %: recarga sin pago, cancelada y abandonada, saldo negativo, comisiones descuadradas con aviso al equipo, alerta de saldo bajo una vez al día y las tres tareas del reloj; comprobado en rojo. Todos los países.
- [x] HECHO 2 nov (C-FIN-BILLETERA). (COB-2) `finanzas/rutasEmpresa.ts` (70 %) al 100 % de líneas: recargas y movimientos por fecha, comprobantes, clave de idempotencia obligatoria, límites de la recarga automática y quitar la tarjeta; comprobado en rojo. Todos los países.
- [x] HECHO 2 nov (C-FIN-POLITICAS). (COB-3) `finanzas/rutasAdmin.ts` (77 %) a 96 %: fechas de políticas, cerrar antes de empezar, 404, configuración de recargas por país, empresas con saldo, movimientos, conciliación a mano y simulador logístico solo para el superadmin; comprobado en rojo. Todos los países.
- [x] HECHO 2 nov (C-FIN-RECARGAS, C-FIN-RESERVAS). (COB-4) `finanzas/billetera.ts` (86 → 98 %) y `finanzas/cobrosRuta.ts` (86 → 94 %): límites de recarga, clave repetida, sin Stripe, Stripe que falla, ajustes y reembolsos imposibles, nombres de movimientos, cobro por ruta una sola vez y reservas huérfanas del reloj; comprobado en rojo. Todos los países.
- [x] HECHO 2 nov (C-PLUS, C-TARJETAS-REGALO, C-VIAJE-COBRO). (COB-5) `plus.ts` al 100 %, `tarjetasRegalo.ts` 99 %, `viajesCobro.ts` 97 % y `internacional/recargas.ts` 95 %: ajustes ilegibles, sin Stripe, Stripe que no devuelve el cobro, doble suscripción, avisos incompletos, montos fuera de rango, propina tardía o repetida, puntos y códigos inexistentes. Archivo nuevo plusBordes.test.ts; comprobado en rojo. Todos los países.
- [x] HECHO 2 nov (C-AVISOS-COMPLETOS, C-SMS-PAISES). (COB-6) `sms.ts` (72 %) a 97 %: credenciales, números en formato internacional, solo Twilio real o el simulador local, países encendidos, fallos anotados, texto que no rompe la llamada y pases del puente que vencen y no se falsifican. Archivo nuevo smsTwilio.test.ts; comprobado en rojo. EE. UU.
- [x] HECHO 2 nov (C-COBERTURA-DINERO). (COB-7) Umbral de 90 % de líneas por archivo en vitest.config.mts para los once archivos de dinero del bloque; comprobado en rojo (sin las pruebas de SMS, la verificación falla). Todos los países.
- 2 nov 2026, 11:40 (tarea programada): la fila estaba vacía y se rellenó con el bloque COB (siete puntos de cobertura del dinero). Hechos los siete, cada uno comprobado en rojo: reloj de finanzas 91 %, billetera de empresas 100 %, superadmin 96 %, saldo prepago 98 % y cobros de ruta 94 %, Plus 100 %, tarjetas de regalo, cobro de viajes y recargas sobre 95 %, SMS 97 %, y el candado C-COBERTURA-DINERO en vitest.config.mts. Solo pruebas: no cambia nada visible. Otra sesión subió a la vez un complemento de COB-5 (f334d1c). Publicación: pruebas al día; producción se pone al día sola cuando termine la verificación de main. Todos los países.
- 2 nov 2026, 12:25 (tarea programada, cierre): después de 40 minutos, producción (divoox.com) sigue en ce6642d y pruebas en e3dfc71. Los commits que vinieron después son solo pruebas, configuración de pruebas y documentos: no cambian lo que corre. No se pudo ver por qué la verificación de main no publicó, porque la sesión de GitHub de la computadora se cayó («Failed to log in») y el límite de consultas sin sesión se agotó. La próxima tarea lo comprueba. Todos los países.
