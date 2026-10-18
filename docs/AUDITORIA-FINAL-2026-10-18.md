# Auditoría final de Tumbite — 18 oct 2026

Pedida por Richard, urgente, para decidir **cuándo publicar las apps en las tiendas**. Método: la metodología permanente (REA y fuentes oficiales de DoorDash, Uber Eats, Dasher, Uber Driver, DoorDash Merchant y Uber Eats Manager; los estudios de Richard), cuatro auditorías de código en paralelo (cliente, restaurante, superadmin y web, servidor) y comparación función por función. Lo que no se pudo verificar en fuente oficial está marcado [NV]; nada se le atribuye a Richard como decisión si no la dijo.

Documentos de apoyo: `docs/investigaciones-rea/2026-10-18-inicio-cliente.md`, `docs/investigaciones-rea/2026-10-18-repartidor.md`, `docs/COMPARACION-CICLO-PEDIDO.md`, `VERIFICAR-PAGOS.md`, `CANDADOS.md`, `PENDIENTES.md`.

## 0. La respuesta corta

- **Hoy la app funciona de punta a punta en pruebas**: pedir, pagar (Stripe de prueba), despachar, recoger con código y foto, entregar con foto o PIN, calificar, propina posterior, billetera y retiros. Lo prueba el recorrido automático en los dos idiomas y seiscientas noventa y cinco pruebas.
- **No está lista para las tiendas todavía**: faltan piezas que un cliente de EE.UU. da por hechas (lista MVP de abajo) y hay cuatro fallos reales encontrados en esta auditoría. Además dependen de Richard cinco cuentas externas sin las cuales las apps no pueden ni compilarse para las tiendas (Apple Developer, Expo, Firebase, Google Maps, Twilio).
- **Recomendación de fecha**: subir a las tiendas cuando esté cerrada la lista MVP y Richard haya hecho la prueba en la calle; las capturas de las tiendas se toman en ese momento, del recorrido real, y no antes (si no, cambian).

## 1. El estándar del mercado (lo que un usuario de EE.UU. da por hecho)

### 1.1 Cliente (DoorDash y Uber Eats) [DOC]

Inicio con dirección arriba, buscador, categorías/servicios, tiendas cercanas, ofertas reales; menú con fotos, opciones, notas por plato, agotados visibles; carrito con entrega/recogida, propina, cupones y promociones, pedido programado, pedido en grupo; pago con tarjeta, Apple Pay y Google Pay, tarjeta guardada; seguimiento en vivo con ETA, mapa, chat y llamada; cancelar con reglas claras; calificar y propina posterior; favoritos, repetir pedido, historial con recibo; soporte en la app con reembolsos guiados; suscripción (DashPass / Uber One) y pickup con descuento.

### 1.2 Restaurante (DoorDash Merchant y Uber Eats Manager) [DOC]

Tablet/app de pedidos con alarma, aceptar/rechazar, tiempo de preparación, pausa y «cocina ocupada»; menú con categorías, fotos, modificadores, disponibilidad y horarios por menú; horarios y festivos; rendimiento (ventas, pedidos, ticket promedio, pedidos incorrectos, reembolsos); clientes (nuevos, recurrentes, inactivos) y reseñas con respuesta; pagos con desglose por pedido, documentos fiscales y frecuencia; promociones y anuncios; equipo con roles (analista, staff, manager, admin); varias tiendas; documentos; soporte.

### 1.3 Repartidor (Dasher y Uber Driver) [DOC]

Alta guiada con antecedentes; conectarse/pausar; oferta completa con cuenta regresiva; navegación; llegué/recogida verificada; entrega con foto/PIN/ID; cliente que no responde con reloj; ganancias con desglose y propinas posteriores; retiro diario e instantáneo; calificaciones con tasas; niveles y recompensas; seguridad (emergencia, compartir viaje); soporte en la app; GPS en segundo plano.

## 2. Lo que Tumbite ya tiene y funciona (comprobado en código y en el recorrido)

### Cliente

Registro y entrada con confirmación de correo; inicio como los grandes (saludo, campana real, cupón de regalos, buscador real, ocho servicios en orden, restaurantes cerca); menú con fotos, opciones y notas; carrito con entrega o recogida, propina y regalos (sellos, descuento por volver); pago con tarjeta dentro de la app (Stripe, sin salto), tarjeta guardada; seguimiento con semáforo, mapa, chat y llamada con número oculto; cambio de dirección en curso; cancelar con reglas; entrega con código, foto o PIN; calificar y propina posterior; tickets de soporte; borrar cuenta; idioma español e inglés; borradores que nunca se pierden.

### Restaurante

Registro guiado con verificación (KYC) y foto del local; panel web y app: tablero de pedidos nuevos con alarma, aceptar o rechazar, tiempo de preparación, «cocina ocupada», pausa, horarios; menú con categorías, fotos, opciones y «se acabó»; estadísticas básicas; regalos y beneficios; billetera con lo ganado por pedido; confirmación de recogida; activación de pagos con Stripe Connect; avisos por correo y push (cuando esté la cuenta de Expo).

### Repartidor

Alta guiada con documentos, antecedentes (Checkr cuando haya llave) y selfie de control; conectarse, pausar, cobertura por ciudad; oferta completa con cuenta regresiva, distancia, pago y artículos; navegación con Google Maps o Apple Maps; «llegué», «no está listo», foto de recogida, entrega con PIN o foto; cliente que no responde con reloj; ganancias con desglose y propinas posteriores; calificaciones; billetera y retiro (apagado por bandera); campana, ayuda y emergencia; niveles por puntos.

### Servidor y operación

Un solo servidor (Hono) con base SQLite y archivos; esquema completo; canario de salud con diecinueve piezas; reloj con tareas aisladas; Manager automático (recordatorios, cancelación con devolución, alertas al equipo, repartidor perdido); conciliación diaria; respaldo diario; cobro al entregar con reintentos; retiros sin doble pago; zonas, áreas en polígono y franquicias; superadmin con tickets, pedidos en curso, verificaciones, fichas, dinero y zonas; web pública bilingüe con Docs (unas setenta guías, casi todas con capturas reales del recorrido), legales, calculadora y páginas por ciudad; seiscientas noventa y cinco pruebas automáticas y el recorrido de punta a punta en los dos idiomas.

## 3. Fallos reales encontrados en esta auditoría

Cada uno con su estado. Los marcados «corregido hoy» quedaron con su prueba en rojo y van en la publicación de este trabajo; el resto entra en la lista MVP en orden.

| #   | Fallo                                                                                                                                                                                                                                     | Dónde                 | Estado                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| F1  | La ficha de un pedido no abría desde las listas del superadmin (los enlaces iban a «orders» y el panel solo entendía «pedidos»).                                                                                                          | panel, PanelApp       | **Corregido hoy** (prueba C-SUPER-PEDIDO-RUTA)                                           |
| F2  | Cuatro enlaces del índice de «Cómo funciona» y el del buscador de la portada apuntaban a secciones con nombre viejo.                                                                                                                      | web                   | **Corregido hoy**                                                                        |
| F3  | La web y Docs prometían Waze (la app solo abre Google Maps o Apple Maps) y la guía de Apple Pay / Google Pay los daba por disponibles cuando aún están apagados.                                                                          | web, Docs             | **Corregido hoy**                                                                        |
| F4  | La web mostraba maquetas en vez de pantallas reales de la app.                                                                                                                                                                            | web                   | **Corregido hoy** (pantallas del recorrido real; queda el banner del kit, ver sección 7) |
| F5  | La app del cliente no manda el pase anti-robots (Turnstile): si se configura la llave en producción, nadie podrá entrar ni registrarse desde la app.                                                                                      | cliente               | Pendiente, MVP                                                                           |
| F6  | El carrito no descuenta el envío al elegir «recoger en el local» y no compara su total con el del servidor: el cliente ve un precio y paga otro.                                                                                          | cliente, cart         | Pendiente, MVP                                                                           |
| F7  | Cambiar la dirección antes del pago no actualiza el cobro en Stripe, y después del pago responde error 500.                                                                                                                               | servidor, pedidos     | Pendiente, MVP                                                                           |
| F8  | Al quitar un plato agotado el servidor recalcula ignorando si el pedido era para recoger.                                                                                                                                                 | servidor, pedidos     | Pendiente, MVP                                                                           |
| F9  | La llamada con número oculto: el servidor llama a Twilio con un método y la ruta de vuelta espera otro; no está probada.                                                                                                                  | servidor, sms         | Pendiente, MVP (depende de la cuenta de Twilio)                                          |
| F10 | Un solo secreto de webhook de Stripe: los eventos de las cuentas conectadas (activación de pagos del restaurante, abonos fallidos) llegan por otro endpoint y pueden no activarse.                                                        | servidor, pagos       | Pendiente, MVP                                                                           |
| F11 | El canario no se pone en rojo cuando el reloj está «atrasado»: si GitHub deja de llamar, nadie se entera.                                                                                                                                 | servidor, salud       | Pendiente, MVP                                                                           |
| F12 | El push de las apps no se registra: falta el identificador del proyecto de Expo en los tres app.json.                                                                                                                                     | apps                  | Pendiente, depende de Richard (cuenta de Expo)                                           |
| F13 | En la app del restaurante, «Recibiendo pedidos» sale según el botón y no según si de verdad está abierto ahora.                                                                                                                           | restaurante           | Pendiente, MVP                                                                           |
| F14 | El ítem «cobro» de la activación del restaurante no mira si los pagos ya están activos; el dueño no recibe aviso al aprobarlo.                                                                                                            | restaurante, servidor | Pendiente, MVP                                                                           |
| F15 | La pestaña «Pedidos» de la app del cliente lleva a Mi cuenta; Favoritos dice «muy pronto».                                                                                                                                                | cliente               | Pendiente, MVP                                                                           |
| F16 | El idioma elegido en la app del cliente no se sincroniza con la cuenta; la app no manda su versión al servidor.                                                                                                                           | cliente               | Pendiente, MVP                                                                           |
| F17 | La web marca Miami como ciudad activa en la página de ciudad y «muy pronto» en la portada; la lista de ciudades está fija en el código y no sale de las zonas del servidor.                                                               | web                   | Pendiente, MVP                                                                           |
| F18 | Las malas notas «por culpa del restaurante» se guardan pero sí cuentan; el nivel del repartidor solo suma puntos por entrega aunque los términos hablen de estrellas y puntualidad; el «nivel del restaurante» de los términos no existe. | servidor, legales     | Pendiente, MVP (o se corrigen los términos)                                              |
| F19 | El PIN de entrega no tiene tope de intentos; el límite de intentos de entrada vive solo en memoria.                                                                                                                                       | servidor              | Pendiente, MVP                                                                           |
| F20 | Contraseñas de cuentas de prueba quedaron en el historial del repositorio.                                                                                                                                                                | repo                  | Depende de Richard (cambiarlas; el repo es público)                                      |
| F21 | VERIFICAR-PAGOS decía que el arreglo de retiros no estaba publicado; ya está en producción desde el 17 oct.                                                                                                                               | docs                  | **Corregido hoy**                                                                        |

## 4. LISTA MVP — lo que falta para publicar en las tiendas con una app funcional y recomendable

En orden. Primero lo que afecta dinero y clientes, después lo que desbloquea, después el resto. Lo marcado 👤 solo lo puede dar Richard.

### 4.1 Dinero y confianza (sin esto no se publica)

1. Corregir F6, F7, F8 (totales y cambios de dirección) con pruebas en rojo.
2. Corregir F10 (webhook de cuentas conectadas) y probar en staging la activación de pagos de un restaurante de punta a punta.
3. Prueba completa del circuito de pagos en staging con Stripe de prueba: compra con tarjeta, cancelación antes y después de aceptar, cobro al entregar, propina posterior, abono al restaurante, retiro del repartidor cortando la respuesta a propósito (S11). Queda escrito en VERIFICAR-PAGOS con fecha.
4. 👤 Una compra real de un dólar en tumbite.com cuando Richard la autorice, mirada hasta el final (regla global: ningún sitio con pagos se lanza sin eso).
5. Corregir F19 (tope de intentos del PIN y límite de entrada persistente).
6. Corregir F11 (canario rojo con reloj atrasado) y dejar alertas automáticas por correo cuando el canario cambie a rojo.
7. Pantallas de dinero que faltan en el superadmin: liquidaciones en revisión con botón para resolver, abonos fallidos, historial de conciliación con detalle y recálculo, e interruptor de retiros (hoy solo por API).
8. 👤 Decisión de Richard: retiro mínimo y frecuencia; cuándo encender retiros.

### 4.2 Entrada y cuentas

9. Corregir F5 (Turnstile en las tres apps: el pase viaja en cabecera, como en la web).
10. Corregir F16 (idioma y versión de la app al servidor) y que el servidor pueda pedir «actualiza la app» por versión mínima.
11. 👤 Cambiar las contraseñas expuestas (F20).

### 4.3 Cliente

12. Pestaña «Pedidos» real con historial, recibo y «repetir pedido» (F15).
13. Favoritos reales (guardar restaurante, lista en la pestaña).
14. Direcciones guardadas (casa, trabajo) con instrucciones de entrega y «dejar en la puerta / en mano» por dirección.
15. Cupones y promociones reales en el carrito (hoy «Ejemplo»): código de descuento, primer pedido, envío gratis por restaurante.
16. Comentario de texto en la calificación y motivo guiado de queja con reembolso parcial automático (artículo faltante, pedido frío) según reglas.
17. Apple Pay y Google Pay encendidos y probados (👤 interruptores en Stripe e identificador de comercio de Apple).

### 4.4 Restaurante

18. Corregir F13 y F14 (estado real de «recibiendo pedidos», ítem de cobro, aviso al aprobar).
19. Reseñas visibles en el panel con respuesta del dueño (estándar DoorDash Merchant y Uber Eats Manager).
20. Reordenar platos y categorías arrastrando; festivos y cierres excepcionales.
21. Varios usuarios por restaurante con roles (dueño, manager, staff).
22. Correo al restaurante al aprobarlo, pausarlo o rechazarlo, con motivo.

### 4.5 Repartidor

23. GPS en segundo plano (la app sigue mandando ubicación con la pantalla apagada) y navegación paso a paso dentro de la app, o al menos enlace que vuelva a la app.
24. Entrega con verificación de edad (licores) y firma cuando el restaurante lo exija.
25. Retiro instantáneo (Fast Pay / Instant Pay) además del diario, cuando Richard encienda retiros.

### 4.6 Operación

26. Superadmin: cancelar y devolver desde el pedido, reasignar repartidor, buscar pedidos cerrados, suspender cuentas de clientes y repartidores con motivo.
27. Verificaciones: aviso al equipo al enviarse una solicitud y paginación de la bandeja.
28. Pantalla de salud en el superadmin y prueba de restauración de un respaldo (documentada).
29. 👤 Cuentas externas sin las que no se puede ni compilar para las tiendas: Apple Developer, Expo (organización y proyecto, F12), Firebase (push Android), Google Maps (llave Android), Twilio (llamadas y SMS), Checkr (antecedentes).
30. 👤 Prueba en la calle con el plan de docs (un restaurante, un repartidor, tres pedidos reales en modo prueba).
31. Tiempo real en producción (Worker de Cloudflare ya listo en staging): 👤 aprobación de Richard para conectarlo a producción.

### 4.7 Web y tiendas

32. Corregir F17 (Miami y ciudades desde el servidor).
33. Texto de la web ajustado a lo que existe hoy: ventajas de los planes «Crece» y «Élite» (hoy el plan no cambia el orden ni da marketing), «soporte local en cada ciudad» y «música en vivo» pasan a «Lo que viene» hasta que existan.
34. Un solo buzón de correo público (hoy tres: hello, sales, support) o confirmar que los tres existen.
35. Fichas de App Store y Google Play: nombre, descripción en los dos idiomas, política de privacidad (ya existe), capturas originales del recorrido tomadas al cerrar esta lista, ícono con la mascota del kit.

**Cuando esta lista esté en verde, la app es funcional, recomendable y publicable.**

## 5. LISTA HASTA LA TERMINACIÓN FINAL — a la altura de DoorDash y Uber Eats

Continúa después del MVP, en orden sugerido. Cada punto es una función que las referencias tienen hoy [DOC].

### Cliente

36. Pedido programado (elegir hora de entrega).
37. Pedido en grupo (varias personas agregan a un carrito, cada uno paga lo suyo).
38. Suscripción tipo DashPass / Uber One (envío gratis y menos cargo de servicio) con cobro recurrente.
39. Pickup con descuento y mapa de locales cercanos para recoger.
40. Impuesto de ventas por estado y condado en el total (Florida: estatal más condado), con informe.
41. Chat de soporte en la app con reembolsos guiados por motivo y foto.
42. Recomendaciones personalizadas («pide otra vez», «te puede gustar»), búsqueda por plato con filtros de dieta.
43. Regalos entre usuarios (enviar un pedido a otra persona) y tarjetas de regalo.
44. Pedir a dos tiendas en un solo pedido (DoubleDash) cuando haya densidad.

### Restaurante

45. Promociones y anuncios pagados dentro de la app (banners, «patrocinado») con presupuesto y reporte.
46. Rendimiento completo: ventas por hora y día, ticket promedio, pedidos incorrectos, reembolsos, tiempo de preparación real contra prometido, clientes nuevos y recurrentes, inactivos.
47. Pagos con documentos fiscales (1099-K y resumen anual) y frecuencia de abono configurable.
48. Varias tiendas (sucursales) en una sola cuenta con menús compartidos.
49. Integración con sistemas de punto de venta (API pública de pedidos y menú).
50. Auto-respuestas a reseñas y plantillas.
51. Tablet dedicada con modo quiosco e impresora de tickets.

### Repartidor

52. Turnos programados y «Dash Now» con mapa de calor de demanda.
53. Ganar por tiempo además de por oferta.
54. Niveles con requisitos reales (tasa de aceptación, de finalización, puntualidad, estrellas) y recompensas visibles; las notas por culpa del restaurante fuera del cálculo (F18).
55. Pedidos agrupados (dos entregas en un viaje) con orden sugerido.
56. Seguro de accidentes durante la entrega y centro de seguridad (compartir viaje, reporte de incidente).
57. Documentos fiscales del repartidor (1099-NEC) y resumen de millas.

### Operación y empresa

58. Contracargos (disputas de Stripe) con flujo de respuesta y devoluciones después de entregar.
59. Roles internos en el superadmin (soporte, finanzas, solo lectura) con registro de quién hizo qué.
60. Tickets con asignación, prioridad, tiempos de respuesta, plantillas y adjuntos.
61. Informes por rango de fecha con gráficos y exportación; embudo de conversión.
62. Configuración financiera por ciudad con historial de cambios; comisión de recogida configurable; la calculadora pública leyendo la configuración en vivo.
63. Franquicias: cobro y liquidación de las condiciones (cuota, porcentaje, mensualidad), panel del franquiciado con tickets, aprobaciones y dinero.
64. Avisos al equipo por SMS y push, configurables por persona y por tipo.
65. Restauración de respaldos desde el panel y pruebas de restauración periódicas.
66. Servicios Moto, Carro, Envíos, Mercado, Farmacia y Licores (hoy con franja «en construcción»), cada uno con su ficha REA antes de construirlo.
67. Tumbite AI (el Manager con criterio, estudio en docs/TUMBITE-AI.md).

## 6. Lo que depende de Richard (resumen)

- Cuentas: Apple Developer (publicar en iPhone, Apple Pay), Expo (organización y proyecto, push), Firebase (push Android), Google Maps (llave Android), Twilio (llamadas y SMS), Checkr (antecedentes).
- Stripe: interruptores de Apple Pay y Google Pay; aviso de transferencias creadas (transfer.created) en el panel de Stripe; la compra real de un dólar.
- Decisiones: retiro mínimo y frecuencia; cuándo encender retiros; si la verificación de identidad es obligatoria para aprobar restaurantes; condiciones comerciales de las franquicias; qué hacer con el banner del kit en la web (sección 7).
- Seguridad: cambiar las contraseñas de prueba que quedaron en el historial del repositorio.
- Calle: la prueba en la calle con el plan de docs.
- Producción: aprobar el Worker de tiempo real de Cloudflare en producción.

## 7. Recomendación: cuándo publicar en las tiendas y qué capturas usar

**Cuándo.** No antes de cerrar la sección 4.1 completa (dinero), la 4.2 (entrada), los puntos 12 a 14 del cliente, 18 y 19 del restaurante, 23 del repartidor, 29 y 30 (cuentas y prueba en la calle) y 35 (fichas de tienda). Con el equipo de ahora eso son unas tres a cuatro semanas de trabajo de código más el tiempo de las cuentas y la revisión de Apple (entre uno y siete días). Publicar antes significa reseñas de una estrella por cosas que un cliente de EE.UU. da por hechas (sin historial de pedidos, sin direcciones guardadas, sin favoritos) y esas reseñas no se borran.

**Capturas de las tiendas.** Se toman al final, del recorrido real (el mismo que genera las capturas de Docs y de la web), en los dos idiomas, con datos neutros. Si se toman antes, cada cambio de diseño las deja mentirosas. Nada de maquetas: lo que ve la persona en la tienda tiene que ser lo que ve al abrir la app.

**La web, desde hoy.** Regla nueva guardada en CLAUDE.md: cada actualización pone al día Docs y la web con capturas originales del recorrido; la portada y «Cómo funciona» ya muestran pantallas reales de la app. Queda una decisión de Richard: el banner del kit aprobado muestra un teléfono con una pantalla dibujada por el diseñador, no real. Recomendación: pedirle al diseñador la misma pieza con la captura real del inicio montada en el teléfono, y mientras tanto dejarlo (es marca, no promesa de función).

## 8. Lo publicado con este trabajo

- Web: pantallas reales del recorrido en la portada y en «Cómo funciona», marco de teléfono propio, Apple Pay y Google Pay como «muy pronto», sin Waze, enlaces del índice y del buscador arreglados.
- Docs: guía de Apple Pay y Google Pay marcada como «muy pronto»; guía de navegación sin Waze.
- Superadmin: la ficha del pedido abre desde las listas (candado C-SUPER-PEDIDO-RUTA).
- Documentos: este informe, VERIFICAR-PAGOS al día, CANDADOS y PENDIENTES actualizados.
