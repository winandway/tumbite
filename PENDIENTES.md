# Tumbite — Pendientes

👤 = depende de Richard. Ordenado por importancia.

## 👤 Lo que solo puede hacer Richard

### Lo primero para lanzar (al 12 oct 2026, noche), en orden

- [ ] 👤 **Compra real de 1 dólar** desde la app web y, en la misma prueba, **cancelar otro pedido de 1 dólar antes de que el restaurante lo acepte** (tiene que verse la devolución en Stripe). Es lo único que falta para dar los pagos por probados (`VERIFICAR-PAGOS.md`).
- [ ] 👤 **Prueba en la calle** con tres cuentas: cliente, restaurante y repartidor (`docs/PLAN-DE-PRUEBA-EN-CALLE.md`). **Destrancada el 14 oct:** las brechas 1 a 7 de `docs/COMPARACION-CICLO-PEDIDO.md` quedaron cerradas; la prueba en la calle ahora también comprueba el radio de 200 m, el código QR, el chat y la entrega en mano.
- [ ] 👤 Decidir el primer pedido de 7.18 dólares: marcarlo entregado o devolverlo.
- [ ] 👤 **Cuentas de desarrollador de Apple y Google** a nombre de Windoce LLC: sin ellas las apps no llegan a las tiendas. (La Etapa 2½ quedó cerrada el 14 oct; solo falta la prueba en la calle.) Guía paso a paso con croquis en `docs/Guia-publicar-apps-Apple-Google.pdf` (Apple como organización con correo @windoce.com, llave Admin; Google: comprobar que la cuenta sea de organización; Expo: organización windoce-llc y su llave).
- [ ] 👤 Número de WhatsApp de soporte.
- [ ] 👤 Llave de Google Places para que la dirección se complete sola.
- [ ] 👤 Abogado: revisar los textos legales y la marca.
- [x] Modelo de dinero en punto de equilibrio aplicado el 13 oct 2026 (envío desde 3,99, servicio con mínimo 1,99; `docs/MODELO-DE-DINERO.md`).
- [ ] 👤 Retiro mínimo para restaurantes y repartidores (hoy 1 dólar; recomendado 10, porque Stripe cobra 25 centavos por retiro).
- [ ] 👤 Cuándo se vuelve obligatoria la verificación de identidad (interruptor `KYC_OBLIGATORIO`).
- [ ] 👤 **Regalo que cubre todo el plato:** hoy el cliente igual paga envío, servicio y el cargo por pedido pequeño (en la prueba, un regalo de 3 dólares dejó el pedido en 6.58). Decidir si el cargo por pedido pequeño se perdona cuando el regalo cubre la comida.
- [ ] 👤 **Parte del franquiciado:** qué porcentaje de lo que deja la plataforma en su ciudad le toca a quien abre Tumbite allí (cuota de entrada, porcentaje y derechos). La calculadora pública ya muestra lo que mueve una ciudad y dice que esa parte se acuerda por contrato.
- [ ] 👤 **SMS de respaldo** para los avisos críticos del cliente (en tu puerta, no te encuentran): cuesta un servicio externo (centavos por mensaje). Sí o no.
- [ ] 👤 **Antecedentes de repartidores con proveedor** (tipo Checkr, cobra por verificación): sí o no, y desde cuándo.
- [ ] 👤 **Tiempos del Manager:** hoy recordatorios a los 3 y 6 minutos y cancela a los 10; los estudios proponen cerrar a los 2 minutos. ¿Bajamos a 5?
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
- [ ] 👤 Turnstile (escudo anti-robots): claves de Cloudflare para el login. Opcional; sin ellas el login funciona con el límite de intentos.
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
- [ ] Ubicación del repartidor en segundo plano (build propio con EAS + video para Apple).
- [x] Fotos de restaurantes y platos (11 oct 2026; se adelantó a la Etapa 0).
- [ ] Etapas 3 y 4: tiendas, lanzamiento cerrado, entrar con Google/Apple/teléfono, impresora, música, zonas nuevas.
- [ ] Etapa 5 — Tumbite AI (estudio hecho el 12 oct 2026, `docs/TUMBITE-AI.md`). Fase A, primera parte hecha el 12 oct (C-MANAGER-1: recordatorios, cancelación con devolución, alerta sin repartidor, bitácora). Semáforo y «Pedidos en curso» hechos el mismo día: Fase A completa.
- [ ] 👤 Tumbite AI: tope mensual de gasto en IA (propuesto 20 USD prepago) y si el Manager puede dar regalos de disculpa solo y hasta cuánto.
