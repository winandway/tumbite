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
- [ ] (R8) Guías de Rewards en Docs, en español e inglés, con capturas reales. Todos los países.
- [x] Mercado, Farmacia y Licores listos para encender en piloto: el equipo los marca en Superadmin → Piloto cuando las tiendas del grupo se registren (sin código pendiente). EE. UU.
- [!] (decide Richard: precio del envío, valor máximo y seguro del paquete en producción) Envíos en piloto: sin tarifa en producción no se puede cotizar. EE. UU.
- [!] (decide Richard: aprobación legal y seguro del pasajero) Moto y Carro en piloto: llevan pasajeros reales. EE. UU.
- [ ] Monetización prepago: unificar Comida con la capa de políticas y enchufar Express, Tiendas y Flex conductor. Todos los países.

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
- [!] (cuenta y costo de un proveedor de SMS: espera a Richard; los avisos por push y correo ya existen) Avisos al equipo también por SMS. Todos los países.

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
