# Tumbite — Pendientes

👤 = depende de Richard. Ordenado por importancia.

## 👤 Lo que solo puede hacer Richard

- [x] Republicado por Richard (10 oct 2026): base y almacén en vivo.
- [x] Republicación automática arreglada por YaDominios Cloud (11 oct 2026, 03:34 UTC). Ya no hay que republicar a mano.
- [ ] 👤 🔴 **Sitio de pruebas (Etapa 0.1 del roadmap):** en YaDominios Cloud crear el sitio `tumbite-pruebas`, mismo repositorio, rama `yapanel-pruebas`. Destranca probar los pagos sin ensuciar la base real.
- [ ] 👤 🔴 **`YAD_TOKEN` (Etapa 0.2):** los correos del dominio ya están activos (11 oct; primer envío de prueba salió). Falta poner el token del sitio como variable `YAD_TOKEN` en el sitio tumbite. Destranca recuperar contraseña, recibos y avisos en vivo.
- [ ] 👤 Número de WhatsApp de soporte de Tumbite (soporte humano en menos de 2 minutos). Destranca el botón de WhatsApp en la landing y las apps.
- [ ] 👤 ¿Promociones de lanzamiento? Cupón de envío gratis para la lista de espera y comisión 0 % por 3 meses para restaurantes (sugerencias en docs/EXPANSION-Y-LANDING.md). Son decisiones de dinero.
- [ ] 👤 ¿Lanzar también en Venezuela? Si sí: Pago Móvil y Zelle (Zelle no tiene API para comercios).
- [ ] ~~Plataforma no republica~~ resuelto. Texto viejo: **La plataforma no está republicando.** Desde las 21:12 (hora UTC) del 10 oct 2026 la rama `yapanel-build` recibió 4 publicaciones nuevas y tumbite.com sigue con la primera. Esa primera versión da error en todas las páginas menos la portada. Entrar a YaDominios Cloud → sitio tumbite → «Registro de errores», y volver a publicar. Con eso se ven la landing nueva, las páginas legales, el panel y el color nuevo.

- [x] ~~Base de datos en vivo~~ resuelto (salud: base ok). `https://tumbite.com/datos/salud` dice `base: pendiente`: el sitio no tiene base de datos. Revisar en YaDominios Cloud → sitio tumbite que el plan incluya base de datos y mirar «Registro de errores». Sin esto, nada de cuentas ni pedidos funciona en vivo.
- [ ] 👤 **Stripe de Windoce LLC** con Connect activado, y sus llaves de PRUEBA puestas en YaDominios Cloud → Variables de entorno: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITIO_URL`. Pasos exactos en `VERIFICAR-PAGOS.md`. Destranca la prueba del circuito de pagos.
- [ ] 👤 **Administrador:** poner en Variables de entorno `ADMIN_CORREOS` (correo de la cuenta Soporte) y `ADMIN_SEMILLA` (secreto largo). Destranca el panel de administración.
- [ ] 👤 **Cuentas de desarrollador** de Apple y Google a nombre de Windoce LLC, y cuenta de Expo (EAS) de la empresa. Destranca la publicación en tiendas (`docs/TIENDAS.md`).
- [ ] 👤 **Abrir Xcode una vez** en esta Mac para que termine de instalarse. Destranca probar las apps en el simulador de iPhone.
- [ ] 👤 Turnstile (escudo anti-robots): claves de Cloudflare para el login. Opcional; sin ellas el login funciona con el límite de intentos.
- [ ] 👤 Aprobar el modelo de dinero de los cuatro bolsillos (construido; se edita en el panel → Dinero).
- [ ] 👤 Nombre del programa de música y porcentaje para el fondo (sugerido 5 %).
- [ ] 👤 Nombres de los planes (hoy: Inicial / Crece / Élite) y de los cuatro niveles (hoy: Bronce / Plata / Oro / Diamante).
- [ ] 👤 Revisión de marca «Tumbite» con abogado (USPTO, clases 9, 39, 42 y 43) y revisión legal de privacidad y términos.
- [ ] 👤 Contador: impuesto de ventas en Florida; repartidores empleados e independientes.
- [x] Empresa: Windoce LLC. Nombre: Tumbite. Dominio tumbite.com conectado y en vivo (10 oct 2026).

## Fase 1 (10 oct 2026, detalle en PLAN.md)

- [x] Base y blindaje, landing con legales, cuentas, panel, tres apps, restaurantes y menús, carrito, cobros, ciclo del pedido, regalos, niveles, calificaciones, borrar cuenta, selector de idioma estilo Amazon, preparación de tiendas.
- [ ] 🔴 Prueba del circuito de pagos de punta a punta (espera Stripe).

## Siguiente fila — en el orden de docs/ROADMAP.md (no se adelanta nada)

- [x] Etapa 0.1 (11 oct 2026): el Action empuja a `yapanel-pruebas` y luego a `yapanel-build`, con semáforo `scripts/semaforo.sh` que se activa al poner la variable `URL_PRUEBAS` en GitHub.
- [x] Etapa 0.2a (11 oct 2026): pieza de correo con canario y recuperar contraseña. Falta activar el dominio y `YAD_TOKEN` para que salga en vivo.
- [ ] Etapa 0.2b: confirmar correo al registrarse, recibo del pedido, aviso al restaurante, aviso al admin, «te anotaste».
- [ ] Etapa 0.4: propuesta de reloj externo y copia de seguridad de la base (se propone y espera el sí).
- [ ] Etapa 1: prueba del circuito de pagos completo en el sitio de pruebas (espera Stripe).
- [ ] Etapa 2: soporte por WhatsApp, avisos al celular, mapa en vivo, ubicación en segundo plano, marcar dirección en mapa.
- [x] Fotos de restaurantes y platos (11 oct 2026; se adelantó a la Etapa 0).
- [ ] Etapas 3 y 4: tiendas, lanzamiento cerrado, entrar con Google/Apple/teléfono, impresora, música, zonas nuevas.
