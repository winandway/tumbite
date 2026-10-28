# Tumbite — Pendientes

## En cola (pedido por Richard el 23 oct 2026)

- [x] (23 oct, publicado con C-DOMINIO-DIVOOX; falta que Richard reenvíe el mapa 👤) **divoox.com en Google Search Console (Richard ya verificó el dominio):** quitar o redirigir los mapas del sitio viejos del dueño anterior (`/sitemap_index.xml` de 2024 y `http://www.divoox.com/sitemap.xml` de 2018), servir el nuestro en `https://divoox.com/sitemap.xml`, y que las direcciones canónicas apunten a divoox.com. Al terminar, avisarle a Richard para que vuelva a enviar el mapa del sitio.
- [x] (23 oct, rama fase-divoox-fotos) **Portada más profesional:** menos rojo y más blanco y negro, con balance. Un banner delgado animado hecho con código, como un juego: pasa de derecha a izquierda una moto con su caja o un carro, con el anuncio y el logo de Divoox que se mueve. Va después de terminar la identidad visual.
- [x] (23 oct) Fotos nuevas de marketing grandes en la portada: restaurante moderno y repartidora en bicicleta.
- [ ] 👤 Banner «Todo lo que necesitas, a un clic»: marketing debe corregir la mascota y el «bite» viejos, el «DivoooX» con tres o, «Detroit» y hacer la versión en inglés. La foto de McDonald's no se usa (marca ajena).
- [x] (23 oct) Correos visibles cambiados a go@windoce.com (decisión de Richard).
- [ ] Remitente de los correos automáticos: sigue saliendo de tumbite.com; pasarlo a divoox.com exige verificar el dominio en el proveedor de correo.
- [ ] Auditoría y limpieza definitiva Tumbite → Divoox (pedida por Richard el 23 oct): inventario completo (archivo, línea, referencia, corrección), presentar hallazgos ANTES de tocar textos legales o configuraciones críticas, luego corregir, staging, producción e informe final.

👤 = depende de Richard. Ordenado por importancia.

- [ ] **Monetización prepago multiservicio** (requisito de Richard, 27 oct 2026, `docs/REQUISITO-MONETIZACION-PREPAGO-MULTISERVICIO.md`): unificar Food en cobro directo con la capa de políticas sin cambiar su resultado; política de cancelaciones por servicio; enchufar Express, Grocery y Flex conductor cuando existan.
- [ ] 👤 **Autorización comercial y legal por mercado** para encender el prepago de conductores (sin ella la política no rige).
- [x] **Divoox Flex · Fase 3** (27 oct 2026, rama `fase-flex-3` sobre la 2, solo staging): ofertas que vencen solas en el reloj existente, avisos al celular a conductor y empresa, integraciones firmadas con anti-SSRF, orden sugerido, capacidad de vehículos, indicadores de operación, retención con simulación, escala medida (10/100/1000 empresas), protocolo de piloto y cuentas de revisores resueltas en el código. Informe: `docs/DIVOOX-FLEX-FASE-3-RESULTADOS.md`; piloto: `docs/DIVOOX-FLEX-PROTOCOLO-PILOTO.md`. 👤 Autorizar la Fase 4 (dinero).
- [ ] **Llave `FLEX_LLAVE_WEBHOOKS` en producción** (el día que Flex pase a producción, con autorización). En staging ya está cargada (27 oct 2026, `scripts/staging/cargar-llave-flex.sh`).
- [ ] **Piloto de Flex en la calle** (20 a 40 paquetes, Android y iPhone) según `docs/DIVOOX-FLEX-PROTOCOLO-PILOTO.md`. Necesita personas y celulares; los avisos esperan Firebase (Android) y Apple.
- [ ] Al publicar Flex en producción: tocar «Crear cuentas de revisión» en el superadmin para confirmar las 3 cuentas viejas (con autorización).
- [x] **Divoox Flex · Fase 2** (27 oct 2026, rama `fase-flex-2` sobre la 1, solo staging): rutas operativas con la ruta como una sola ocupación del conductor, «Mi ruta» en Divoox Driver, escaneo, entrega con pruebas, incidencias, devoluciones, cierre, cola sin conexión y panel de rutas. Informe: `docs/DIVOOX-FLEX-FASE-2-RESULTADOS.md`. 👤 Autorizar la Fase 3 y decidir cuándo Flex pasa a producción (antes: marcar confirmadas las 3 cuentas de revisores).
- [x] **Divoox Flex · Fase 1** (27 oct 2026, rama `fase-flex-1`, solo staging): empresas, invitaciones seguras, claves de API, envíos y paquetes con custodia, importación CSV, etiquetas, base de lotes y rutas, panel en /panel/business, Docs. Informe: `docs/DIVOOX-FLEX-FASE-1-RESULTADOS.md`. 👤 Autorizar la Fase 2 (rutas operativas, conductores, escaneo, entregas y devoluciones) y decidir si Flex pasa a producción antes o después del lanzamiento de Comida.

> **Estado vigente:** el registro único es `docs/RECONCILIACION-FASE-2.md` (fallos F5–F20, puntos 1–67, compuerta del MVP y estado por país y método). Si este documento dice otra cosa, manda el registro.

## La fila de la IA — Fase 2 (18 oct 2026)

Lista única en `docs/PLAN-MAESTRO-FASE-2.md`. Hecho el 18 oct (en producción o en la rama lista para publicar): F1–F8, F10, F11, F13, F14, F16, F19, F21; puntos 7, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 26, 27, 28, 32, 33, 34; bloque B (libro, prepago, cobro directo, cuentas del repartidor, recargas); impuesto, devoluciones y disputas; pantallas del cobro directo y guías.

- [ ] B.7 Conectores reales por país (Wompi/dLocal, pago móvil): solo con contrato y decisión de Richard.
- [x] Recorrido internacional completo (18 oct, noche): pago de la comida en el local con monto, ticket y método; diferencias, excedente, transferencia por verificar y comida comprada sin entregar en el libro (C-COBRO-DIRECTO-LOCAL). Quién absorbe la comida comprada es la decisión 20 (👤).
- [x] F9 llamada con número oculto (método del puente) y F18 notas por culpa del restaurante (18 oct, noche). F9 se prueba de verdad con la cuenta de Twilio (👤).
- [x] Foto del ticket del restaurante en el pago en el local (19 oct, C-FOTO-TICKET).
- [x] Ruta interna para consultar y crear los avisos de Stripe (19 oct, C-STRIPE-AVISOS). Comprobado: falta el de cuentas conectadas en prueba y en real; crearlo espera la autorización (B).
- [x] Clave expuesta del cliente de pruebas rotada y comprobada (19 oct). Falta la de Expo (C, Richard).
- [ ] Montos en moneda local: el formato está listo (C-MONEDA-LOCAL); falta construir las tarifas por país, que dependen de la decisión 12 (D).
- [ ] F17: ciudades de la web desde el servidor, con un interruptor público de lanzamiento por ciudad (hoy la lista fija es intencional; Miami «muy pronto»).
- [x] Panel del superadmin para países, puntos de venta y libro (18 oct, en la rama fase-2-bloque-c; probado a mano en local).
- [x] E.2 Recorrido visual de lo nuevo con capturas en Docs (18 oct, 1ff9eb6f): reseñas con respuesta, equipo, festivos, orden del menú, favoritos, direcciones, cupón, pago al recibir y saldo prepago. Lo que falta es verlo en un celular real (Expo, 👤).
- [ ] 35 / E.4 Fichas de App Store y Google Play con capturas del recorrido (al final).
- Después del MVP: puntos 36 a 67 (sección F del plan maestro).

## Clasificación por quién lo resuelve (19 oct 2026)

Ver `docs/RECONCILIACION-FASE-2.md`, sección 5: A (lo hace la IA), B (preparado, falta una autorización), C (Richard en persona) y D (decisión o abogado).

## 👤 Lo que solo puede hacer Richard

- [ ] **Google Play, accesos:** confirmar administrador real, preparar escenario aislado de revisión, comprobar los tres accesos en los Android de la tienda y guardar las credenciales directamente en Google Play. Crear cuentas por sí solo no cierra este punto. Véase [Acceso de revisores](docs/ACCESO-REVISORES.md).

- [ ] 👤 **Leer la auditoría final** (`docs/AUDITORIA-FINAL-2026-10-18.md`) y decidir: cuándo publicar en tiendas (recomendación: al cerrar la lista MVP), qué hacer con el banner del kit de la web (pantalla dibujada, no real), y ordenar la fila si quiere otro orden.
- [ ] 👤 **Probar en el simulador las dos apps nuevas** (cliente e inicio «como los grandes»; repartidor con oferta completa, calificaciones, ganancias, campana, pausa, llegué y ayuda) y decir qué falta. Cuentas en `docs/CUENTAS-DE-PRUEBA.md`.

- [ ] 👤 **Condiciones comerciales de las franquicias** (cuota de entrada, porcentaje sobre ingresos, cuota mensual, plazo y exclusividad territorial). El sistema ya las guarda por franquicia, pero quedan «pendientes de definición comercial» y ningún cobro las usa. Detalle en `docs/TERRITORIO-Y-FRANQUICIAS.md`.
- [x] 👤 Autorizar en producción la arquitectura multiciudad: publicada el 17 oct (bac14e2a).
- [ ] 👤 **Revisar como superadmin en tumbite.com** Zonas → Áreas y Franquicias → Territorio y equipo (solo Richard puede entrar).

- [x] (27 oct 2026, comprobado en la API de Expo: las tres apps tienen la llave FCM V1) **Proyecto de Firebase** (gratis) para los avisos al celular en Android: registrar las tres apps (com.windoce.tumbite, .driver, .restaurants) y subir la llave de FCM a Expo. Sin él, los APK no reciben avisos. Detalle en `docs/APPS-MOVILES-FASE-4.md`.

- [ ] 👤 **URGENTE — cambiar las contraseñas de prueba** que estaban en el archivo de contraseñas de las apps (la de Expo y las de las cuentas de prueba de cliente, repartidor y restaurante). El archivo entró por error al repositorio público el 16 oct y **sí está en el historial de main** (no en lo publicado). La clave del cliente de pruebas ya se cambió el 19 oct; falta la de Expo. Detalle en `docs/PUBLICACION-RELOJ-SEGURO-2026-10-17.md`. Borrarlo del historial de GitHub es destructivo y espera su decisión.

### Lo primero para lanzar (al 12 oct 2026, noche), en orden

- [ ] 👤 **Compra real con tarjeta** (plato de 1,00: la tarjeta autoriza 4,99), **otra igual cancelada antes de aceptar** (se anula la autorización) y **una devolución parcial de 1,00**. Guion y límites en `docs/PRUEBA-REAL-1-DOLAR.md`. No es lo único que falta: después quedan la entrega con repartidor, la liquidación al restaurante y la devolución total.
- [ ] 👤 **Prueba en la calle** con tres cuentas: cliente, restaurante y repartidor (`docs/PLAN-DE-PRUEBA-EN-CALLE.md`). **Destrancada el 14 oct:** las brechas 1 a 7 de `docs/COMPARACION-CICLO-PEDIDO.md` quedaron cerradas; la prueba en la calle ahora también comprueba el radio de 200 m, el código QR, el chat y la entrega en mano.
- [ ] 👤 **Cuenta de Twilio** para los SMS de respaldo y las llamadas con número oculto (ya construidos y probados con Twilio simulado; en producción están apagados hasta tener las llaves). Hace falta: abrir la cuenta en Twilio con la tarjeta de Windoce LLC, comprar UN número de Estados Unidos (unos 1,15 dólares al mes; los SMS cuestan cerca de 0,008 y las llamadas cerca de 0,014 por minuto) y pegar tres valores en YaDominios Cloud → sitio tumbite → Variables de entorno: `TWILIO_ACCOUNT_SID` (empieza por AC), `TWILIO_AUTH_TOKEN` y `TWILIO_FROM` (el número comprado, con +1). Al republicar, el canario `datos/salud` pasa `sms` de «pendiente» a «ok». Destranca: SMS de «en tu puerta» y «no te encuentran», y los botones «Llamar» de las dos apps (hoy responden «Las llamadas todavía no están activas»).
- [ ] 👤 **Apple Pay y Google Pay:** (1) en el panel de Stripe → Configuración → Métodos de pago, encender Apple Pay y Google Pay (dos interruptores); (2) el dominio tumbite.com se registra solo con el botón «Activar Apple Pay y Google Pay en la web» del superadmin (o lo hago yo cuando digas); (3) Apple Pay en la app del iPhone necesita el identificador de comercio `merchant.com.tumbite.cliente` creado en la cuenta de Apple Developer (la misma que falta para publicar). Google Pay ya queda listo con la app.
- [ ] 👤 **Cuenta de Checkr** (antecedentes de repartidores, como DoorDash): abrir la cuenta a nombre de Windoce LLC en Checkr, elegir el paquete con antecedentes penales y récord de manejo (cuesta por repartidor verificado, del orden de 30 a 50 dólares cada uno; lo paga Tumbite), y pegar UN valor en YaDominios Cloud → sitio tumbite → Variables de entorno: `CHECKR_API_KEY` (la llave secreta de producción). En Checkr → Developer → Webhooks, poner la dirección de avisos `https://tumbite.com/datos/checkr/aviso`. Destranca: el botón «Iniciar la verificación de antecedentes» de la app del repartidor (hoy dice que se activa pronto).
- [x] 👤 Decidir el primer pedido de 7.18 dólares: marcado entregado por decisión de Richard (15 oct), sin reembolso.
- [ ] 👤 **Cuentas de desarrollador de Apple y Google** a nombre de Windoce LLC: sin ellas las apps no llegan a las tiendas. (La Etapa 2½ quedó cerrada el 14 oct; solo falta la prueba en la calle.) Guía paso a paso con croquis en `docs/Guia-publicar-apps-Apple-Google.pdf` (Apple como organización con correo @windoce.com, llave Admin; Google: comprobar que la cuenta sea de organización; Expo: organización windoce-llc y su llave).
- [ ] 👤 Número de WhatsApp de soporte.
- [ ] 👤 Llave de Google Places para que la dirección se complete sola.
- [ ] 👤 Abogado: revisar los textos legales y la marca.
- [x] Modelo de dinero en punto de equilibrio aplicado el 13 oct 2026 (envío desde 3,99, servicio con mínimo 1,99; `docs/MODELO-DE-DINERO.md`).
- [ ] 👤 Retiro mínimo para restaurantes y repartidores (hoy 1 dólar; recomendado 10, porque Stripe cobra 25 centavos por retiro).
- [ ] 👤 Cuándo se vuelve obligatoria la verificación de identidad (interruptor `KYC_OBLIGATORIO`).
- [ ] 👤 **Regalo que cubre todo el plato:** hoy el cliente igual paga envío, servicio y el cargo por pedido pequeño (en la prueba, un regalo de 3 dólares dejó el pedido en 6.58). Decidir si el cargo por pedido pequeño se perdona cuando el regalo cubre la comida.
- [ ] 👤 **Parte del franquiciado:** qué porcentaje de lo que deja la plataforma en su ciudad le toca a quien abre Tumbite allí (cuota de entrada, porcentaje y derechos). La calculadora pública ya muestra lo que mueve una ciudad y dice que esa parte se acuerda por contrato.
- [ ] 👤 Nombre público del negocio en Stripe (hoy sale «Windoce, LLC» en el cobro).
- [ ] 👤 Tope mensual de gasto en IA (propuesto 20 dólares prepago) y si el Manager puede dar regalos de disculpa.
- [ ] 👤 Mirar las ideas de «Lo que viene» en la página Cómo funciona.
- [ ] 👤 Antes del lanzamiento abierto: apagar o borrar los datos de prueba (Orlando y Tampa de prueba, cuentas `prueba.%@ejemplo.com`; la consulta está en `CANDADOS.md`).
- [ ] 👤 Sí o no a un reloj exacto en Cloudflare (hoy el reloj de GitHub es impuntual; el Manager ya no depende de él para cancelar a tiempo).

- [x] Republicado por Richard (10 oct 2026): base y almacén en vivo.
- [x] Republicación automática arreglada por YaDominios Cloud (11 oct 2026, 03:34 UTC). Ya no hay que republicar a mano.
- [x] Sitio de pruebas `tumbite-pruebas` creado por la IA con el acceso para IA (11 oct 2026). Semáforo activo (`URL_PRUEBAS` en GitHub).
- [x] `YAD_TOKEN` puesto en tumbite y en tumbite-pruebas (11 oct 2026): canario `correo: ok` en los dos.
- [ ] 👤 Número de WhatsApp de soporte (con prefijo, solo dígitos). Ya está todo cableado: la IA lo pone como variable `WHATSAPP_SOPORTE` y el botón aparece en la landing y las tres apps sin publicar código.
- [ ] 👤 **Llave de Google Maps para Android** (Google Cloud → Maps SDK for Android; gratis hasta un volumen alto). Va en `apps/cliente/app.json`. Sin ella, el mapa solo se ve en iPhone.
- [ ] 👤 ¿Promociones de lanzamiento? Cupón de envío gratis para la lista de espera y comisión 0 % por 3 meses para restaurantes (sugerencias en docs/EXPANSION-Y-LANDING.md). Son decisiones de dinero.
- [ ] 👤 ¿Lanzar también en Venezuela? Si sí: Pago Móvil y Zelle (Zelle no tiene API para comercios).
- [ ] ~~Plataforma no republica~~ resuelto. Texto viejo: **La plataforma no está republicando.** Desde las 21:12 (hora UTC) del 10 oct 2026 la rama `yapanel-build` recibió 4 publicaciones nuevas y tumbite.com sigue con la primera. Esa primera versión da error en todas las páginas menos la portada. Entrar a YaDominios Cloud → sitio tumbite → «Registro de errores», y volver a publicar. Con eso se ven la landing nueva, las páginas legales, el panel y el color nuevo.

- [x] ~~Base de datos en vivo~~ resuelto (salud: base ok). `https://tumbite.com/datos/salud` dice `base: pendiente`: el sitio no tiene base de datos. Revisar en YaDominios Cloud → sitio tumbite que el plan incluya base de datos y mirar «Registro de errores». Sin esto, nada de cuentas ni pedidos funciona en vivo.
- [ ] 👤 **Stripe de Windoce LLC** con Connect activado, y sus llaves de PRUEBA puestas en YaDominios Cloud → Variables de entorno: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITIO_URL`. Pasos exactos en `VERIFICAR-PAGOS.md`. Destranca la prueba del circuito de pagos.
- [x] `ADMIN_CORREOS` (tumbite.com@gmail.com) y `ADMIN_SEMILLA` puestos (11 oct 2026; la semilla está en el llavero de esta Mac).
- [ ] 👤 **Cuenta de administrador:** registrarse en tumbite.com/panel con tumbite.com@gmail.com y nombre «Soporte Tumbite»; la IA la vuelve administrador. Destranca aprobar restaurantes.
- [x] Llave de IA de tumbite-pruebas recibida (11 oct 2026): variables puestas, correo en verde. Las llaves de prueba de Stripe se ponen ahí en cuanto lleguen.
- [x] `staging.tumbite.com` conectado al sitio de pruebas (YaDominios lo arregló el 11 oct 2026, 19:26 UTC). El semáforo (`URL_PRUEBAS`) y `SITIO_URL` de pruebas apuntan ahí.
- [ ] 👤 **Cuentas de desarrollador** de Apple y Google a nombre de Windoce LLC, y cuenta de Expo (EAS) de la empresa. Destranca la publicación en tiendas (`docs/TIENDAS.md`).
- [ ] 👤 **Abrir Xcode una vez** en esta Mac para que termine de instalarse. Destranca probar las apps en el simulador de iPhone.
- [ ] 👤 Turnstile (escudo anti-robots): las DOS claves de Cloudflare (pública `TURNSTILE_SITE_KEY` y secreta `TURNSTILE_SECRET_KEY`) en YaDominios Cloud → sitio tumbite → Variables, con `tumbite.com` y `staging.tumbite.com` en los dominios del widget. Desde el 18 oct la web y las tres apps ya mandan el pase (F5). Opcional; sin ellas el login funciona con el límite de intentos.
- [ ] 👤 Aprobar el modelo de dinero de los cuatro bolsillos (construido; se edita en el panel → Dinero).
- [ ] 👤 Nombre del programa de música y porcentaje para el fondo (sugerido 5 %).
- [ ] 👤 Nombres de los planes (hoy: Inicial / Crece / Élite) y de los cuatro niveles (hoy: Bronce / Plata / Oro / Diamante).
- [x] Legales listos para las tiendas (12 oct 2026): privacidad, términos para clientes, restaurantes y repartidores, página de borrar cuenta y aviso al crear cuenta. Ver `docs/LEGALES-TIENDAS.md`.
- [ ] 👤 Revisión de marca «Tumbite» con abogado (USPTO, clases 9, 39, 42 y 43) y revisión legal de los textos ya publicados.
- [ ] 👤 Contador: impuesto de ventas en Florida; repartidores empleados e independientes.
- [x] Empresa: Windoce LLC. Nombre: Tumbite. Dominio tumbite.com conectado y en vivo (10 oct 2026).

## Fase 1 (10 oct 2026, detalle en PLAN.md)

- [x] Base y blindaje, landing con legales, cuentas, panel, tres apps, restaurantes y menús, carrito, cobros, ciclo del pedido, regalos, niveles, calificaciones, borrar cuenta, selector de idioma estilo Amazon, preparación de tiendas.
- [ ] 🔴 Prueba del circuito de pagos de punta a punta (espera Stripe).

## Siguiente fila — en el orden de docs/ROADMAP.md (no se adelanta nada)

- [x] Etapa 0.1 (11 oct 2026): el Action empuja a `yapanel-pruebas` y luego a `yapanel-build`, con semáforo `scripts/semaforo.sh` que se activa al poner la variable `URL_PRUEBAS` en GitHub.
- [x] Etapa 0.2a (11 oct 2026): pieza de correo con canario y recuperar contraseña. Falta activar el dominio y `YAD_TOKEN` para que salga en vivo.
- [x] Etapa 0.2b (11 oct 2026): confirmar correo al registrarse, recibo del pedido, aviso al restaurante, aviso al admin y bienvenida a la lista de espera. Candado C-AVISOS.
- [x] Etapa 0.4a (11 oct 2026): reloj externo con GitHub Actions cada 5 min (candado C-RELOJ). Cero costo.
- [x] Etapa 0.4b (11 oct 2026): copia de seguridad diaria al almacén del sitio, 30 días (candado C-RESPALDO).
- [x] Sección Docs pública en tumbite.com/docs, 20 guías bilingües (candado C-DOCS).
- [x] Pie de página profesional con países, ciudades y comidas, cada uno con su página para SEO (12 oct 2026, candado C-PIE).
- [x] Prerender: las 50 páginas públicas llegan armadas en HTML (12 oct 2026, candado C-PRERENDER).
- [ ] 👤 **Franquicias por ciudad:** investigación en la sesión de Laboratorio AI (prompt entregado el 12 oct). Con el resultado se construye la página de franquicias y la calculadora por ciudad. Decisiones de dinero (cuota, porcentaje, derechos) son de Richard.
- [ ] Etapa 1: prueba del circuito de pagos completo en el sitio de pruebas (espera Stripe).
- [x] Etapa 2 (11 oct 2026): mapa en vivo del repartidor, pin de dirección en el mapa, WhatsApp cableado, avisos al celular preparados (candado C-ETAPA-2). Falta: ubicación del repartidor en segundo plano (requiere build propio).
- [ ] Ubicación del repartidor en segundo plano (build propio con EAS + video para Apple). Revisado el 17 oct: hoy solo con la app abierta; es función nueva, espera orden.
- [x] Fotos de restaurantes y platos (11 oct 2026; se adelantó a la Etapa 0).
- [ ] Etapas 3 y 4: tiendas, lanzamiento cerrado, entrar con Google/Apple/teléfono, impresora, música, zonas nuevas.
- [ ] Etapa 5 — Tumbite AI (estudio hecho el 12 oct 2026, `docs/TUMBITE-AI.md`). Fase A, primera parte hecha el 12 oct (C-MANAGER-1: recordatorios, cancelación con devolución, alerta sin repartidor, bitácora). Semáforo y «Pedidos en curso» hechos el mismo día: Fase A completa.
- [ ] 👤 Tumbite AI: tope mensual de gasto en IA (propuesto 20 USD prepago) y si el Manager puede dar regalos de disculpa solo y hasta cuánto.

## Fase 0 · Seguridad financiera (15 oct 2026)

- [x] Retiros sin doble pago, bandera de seguridad, conciliación y pruebas (rama `fase-0-seguridad-financiera`, `docs/FASE-0-SEGURIDAD-FINANCIERA.md`).
- [ ] 👤 Aprobar la Fase 0 para fusionarla a `main` y publicarla en producción.
- [x] S2, S3, S5 y S7 en la base real del sitio de pruebas, sin compartir ningún token (corren desde GitHub con el secreto del reloj).
- [x] «En proceso» en la app y en el panel; retiros apagados por defecto.
- [x] Anulación del Manager verificada en Stripe antes de revivir un pedido (C-ANULACION-VERIFICADA).
- [ ] 👤 Cargar en el panel de YaDominios, **en el sitio de pruebas**, las llaves de **modo prueba** de Stripe y su aviso de prueba (con `transfer.created`). Destraba S11 y el recorrido completo de Comida en pruebas. Nunca en el chat.

## Fase 1 · Multiservicio (15 oct 2026, rama `multiservicio-fase-1`, solo local)

- [x] Catálogo de servicios, vehículos, habilitaciones, requisitos y preferencias, con Moto y Carro bloqueados (`docs/FASE-1-MULTISERVICIO.md`).
- [x] Migraciones M4 y M5 preparadas y probadas sobre una base de prueba (no ejecutadas sobre datos reales).
- [ ] 👤 Revisar la Fase 1 y decidir si se publica en el sitio de pruebas.
- [ ] Prueba de los disparadores del catálogo en D1 real (después de publicar en pruebas).
- [ ] M6: el despacho de Comida lee la elegibilidad (con bandera), más la edad por estado y la licencia y el seguro según el vehículo (brechas de los estudios).
- [ ] Permisos finos y doble aprobación del panel (obligatorio antes de encender pasajeros).

## Fase 2 · Tiempo real (15 oct 2026, rama `multiservicio-fase-2`, solo local)

- [x] M5 corregida: identidad solo con verificación real, y la base lo exige siempre.
- [x] Puerta interna firmada, reloj por minuto, lote de ubicaciones, pases cortos, Workers externos y conexión de apps con recuperación (`docs/FASE-2-TIEMPO-REAL.md`). Sin desplegar.
- [ ] 👤 Revisar la Fase 2 y aprobar: publicar en pruebas y desplegar los dos Workers en la cuenta de Cloudflare de Tumbite, apuntando solo a pruebas.
- [ ] Conectar las apps al tiempo real (repartidor y seguimiento del cliente) y los avisos de Comida, con el recorrido completo.

## Validación en staging de las fases 0, 1 y 2 (15 oct 2026, `docs/VALIDACION-STAGING-FASES-0-1-2.md`)

- [x] Ramas integradas solo en staging; S2–S7, F1, M4/M5 (también con datos temporales) y F2 en D1 real, todo en verde.
- [x] Los dos relojes comparten el candado por minuto (C-RELOJ-UNA-VEZ).
- [x] Sesión de Cloudflare de windoce1 en la sesión aparte; los dos Workers desplegados SOLO para pruebas (15 oct).
- [x] Variables del tiempo real cargadas en el sitio de pruebas por su API; prueba en vivo en verde (15 oct).
- [ ] 👤 Correr `bash scripts/staging/cargar-stripe-prueba.sh` y pegar las dos llaves de PRUEBA de Stripe (no se ven) → S11 y el recorrido de Comida en staging.
- [ ] 👤 Revocar la llave de Acceso para IA del sitio de pruebas que pasó por el chat y crear otra cuando termine la validación.
- [x] Con lo anterior: prueba en vivo del tiempo real, S11 y el recorrido de Comida en staging → decisión de empezar la Fase 3.

## Stripe Connect (15 oct 2026)

- [ ] Alta de restaurantes y repartidores con los **componentes de onboarding integrados** de Stripe (dentro de la app y del panel, con los colores de Tumbite), en lugar de mandarlos a la página de Stripe. Decisión de Richard del 15 oct. Hoy funciona con la página alojada por Stripe (`/datos/billetera/conectar`, enlace de cuenta). Requiere sesión de cuenta en el servidor, el componente en el panel web y en las apps, guía en Docs y su prueba.
- [ ] 👤 Terminar la activación de Connect en la cuenta de prueba «Tumbite test» (modelo: los clientes le compran a Tumbite, transferencias divididas, servicios on demand, alta integrada). Destraba S11.

## Después de la validación (15 oct 2026)

- [x] Validación en pruebas de las fases 0, 1 y 2: TODO EN VERDE (corrida 38812353874).
- [ ] 👤 Aprobar publicar en producción la Fase 0 + el arreglo de `evidencias.modo/nota` (producción hoy no puede completar una entrega).
- [ ] `publicar.yml`: construir las apps de pruebas con la dirección de pruebas (hoy la copia de pruebas apunta a producción).
- [ ] 👤 Twilio también en el sitio de pruebas (la llamada con número oculto no se prueba allí).
- [x] 👤 Autorizar la Fase 3 (exclusividad y asignación). Autorizada el 15 oct; hecha en la rama fase-3-exclusividad, solo en el sitio de pruebas.

## Verificación previa a producción (15 oct 2026, `docs/VERIFICACION-PREVIA-PRODUCCION.md`)

- [x] Etapa A (corrección de publicación) validada en pruebas: corrida 38822612288, todo en verde.
- [x] Respaldo completo de producción (51 tablas, 166 filas) y verificaciones de solo lectura.
- [ ] 👤 Decidir el pedido abierto en «listo» desde el 12 oct (7,18 USD autorizados): recomendado cancelarlo antes de publicar.
- [ ] 👤 Autorizar la publicación controlada (PLAN-PUBLICACION-PRODUCCION.md).
- [x] Publicación controlada a producción (16 oct, versión f5b2b1a, docs/RESULTADO-PUBLICACION-CONTROLADA.md).
- [ ] 👤 Revisar y aprobar la Fase 3 (docs/FASE-3-EXCLUSIVIDAD-ASIGNACION.md) y autorizar, aparte, publicarla en producción.
- [ ] 👤 Revocar y volver a crear la llave del sitio de pruebas que pasó por el chat.
- [ ] 👤 Probar «Conectarme» en tumbite.com con una cuenta de repartidor suya (en producción no hay cuenta de prueba de repartidor).

## Orden aprobado desde el 16 oct 2026 (Richard)

- [x] Publicar la Fase 3. Versión `36f4e35`, 16 oct; verificador «después» VERDE.
- [ ] Integrar el reloj seguro con la Fase 3 (rama `fase-reloj-seguro`) y validarlo en el sitio de pruebas. Sin publicar.
- [ ] 👤 Autorizar la publicación del reloj seguro.
- [ ] 👤 Autorizar el trabajador del reloj de producción (`docs/EVALUACION-RELOJ-CLOUDFLARE.md` §B).
- [ ] Hito 1 del cliente: catálogo y sesión, dos correcciones independientes (`docs/PLAN-CATALOGO-Y-RELOJ.md`).
- [ ] Validar el MVP de Comida.
- [ ] Tarea aparte (aprobada en concepto): la salud no oculta discrepancias viejas; excepciones auditables en una tabla propia, sin tocar las conciliaciones. Incluye los 10 pedidos de prueba de Novi del 11 y 12 oct, que nunca se conciliaron.

## Requisitos registrados para próximos hitos (16 oct 2026, Richard; NO implementar todavía)

- [ ] **A. Versionado automático y visible** en la web, el panel y las tres apps:
  - el mismo número de versión en todas, que salga solo de cada publicación (hoy existe la etiqueta `version` de la web, con el commit);
  - visible para la persona en un lugar discreto: el pie de la web, «Acerca de» del panel y la pantalla de cuenta de cada app;
  - en las apps de celular, también el número de compilación de la tienda.
  - Sirve para soporte («¿qué versión tienes?») y para comprobar que una publicación llegó.
- [ ] **B. Optimización automática de imágenes al subirlas:**
  - pasarlas a WebP con buena calidad y en varios tamaños adaptados (miniatura, tarjeta, pantalla completa);
  - quitar los datos ocultos de la foto (ubicación y cámara), salvo las fotos de entrega, cuya ubicación se usa como prueba y se guarda aparte;
  - conservar el original solo donde hace falta como evidencia;
  - aplica a las fotos de platos, de restaurantes, de documentos y de entregas.
  - Hay que decidir dónde se convierte: en el teléfono antes de subir, en el servidor o con un servicio de imágenes. Va con su prueba de peso y de calidad.

## Flex en producción (28 oct 2026)

- [x] Flex Fases 1 a 4 publicadas en producción (21702c4), verificador verde. Restaurar: etiqueta `restauracion-antes-flex-fase4-2026-10-28`.
- [ ] Subir la versión nueva del Driver (build 32d18083, «Mi ruta» rediseñada) a Google Play en cuanto aprueben la revisión en curso.
- [ ] 👤 Encender las recargas de empresa en producción (dinero real): orden de Richard y una compra real de 1 dólar.

## Divoox Moto, pasajeros (28 oct 2026) — plan en docs/PLAN-MOTO-PASAJEROS.md

- [x] (28 oct, rama fase-moto-1) M1 Tarifa por ciudad y cotización con precio fijo guardada en el servidor; Moto encendida solo en el sitio de pruebas.
- [x] (28 oct) M2a Candado C-VIAJE-PASOS-REALES: llegada por radio, espera cumplida y tope del código (fallo encontrado con REA).
- [x] (28 oct) M2 Pedir viaje en efectivo con cotización de un solo uso, código de inicio, cancelación con ventana desde la asignación, «sin conductor» a los 10 min y deuda del pasajero (la tarjeta pasa a M7).
- [x] (28 oct) M3 Oferta completa (ganancia, recogida, destino, duración, pago) y despacho al pedir, al rechazar, al soltar y al consultar.
- [x] (28 oct) M4 App del Driver: oferta, viaje activo, espera, casco, PIN, terminar, no se presentó.
- [x] (28 oct) M5 App del cliente: pedir Moto con precio fijo (recotiza solo), buscando, conductor y moto, mapa, código, cancelar con su precio, pagar en efectivo.
- [x] (28 oct) M6 Seguridad: emergencia en las dos apps con aviso al equipo y número del país, viaje compartido en vivo que se apaga al terminar, casco confirmado por el conductor. (Pendiente para más adelante: contactos de emergencia, aviso de desvío, límite de horas y pausa del chat.)
- [x] (28 oct) M7 Dinero: comisión del prepago apartada al aceptar, cobrada al terminar y devuelta si no se hace; espera por minuto; deudas en la cuenta final; conciliación en la salud. (El pago con tarjeta de los viajes queda para una fase propia con Stripe de prueba.)
- [x] (28 oct) M8 Calificación de ambos lados (cuenta en el promedio del conductor). La propina va con el pago con tarjeta.
- [ ] M9 Panel: tarifas, interruptores, viajes en curso, emergencias.
- [ ] M10 Recorrido en staging, comparación con REA sobre nuestras apps, guías en Docs, informe.
- [ ] 👤 Primer mercado de Moto y aprobación legal de ese país.
- [ ] 👤 Aseguradora para el seguro de accidentes del pasajero.
- [ ] 👤 Tarifas y comisión reales por ciudad (el sistema arranca con valores de prueba).
- [ ] 👤 Orden de encender Moto en producción.
- [ ] Subir la versión 7 del Driver (Mi ruta de Flex) en cuanto Google apruebe la revisión en curso.
