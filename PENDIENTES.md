# Tumbite — Pendientes

👤 = depende de Richard. Ordenado por importancia.

## 👤 Lo que solo puede hacer Richard

- [x] Republicado por Richard (10 oct 2026): base y almacén en vivo.
- [ ] 👤 🔴 **Republicar otra vez en YaDominios Cloud.** La publicación automática no funciona en este sitio: cada cambio se queda en la rama `yapanel-build` y tumbite.com sigue con la versión anterior hasta que se republica a mano. Con eso salen la landing nueva roja, las zonas y la lista de espera. Prompt de soporte listo para la sesión de YaDominios Cloud en `docs/SOPORTE-YADOMINIOS-REPUBLICAR.md`.
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

## Siguiente fila (no depende de Richard)

- [ ] Fotos de restaurantes y platos (subida al almacén del sitio).
- [ ] Notificaciones al celular (pedido aceptado, repartidor en camino, oferta nueva).
- [ ] Mapa en vivo del repartidor en la app del cliente.
- [ ] Ubicación del repartidor en segundo plano (requiere build propio y video para Apple).
- [ ] Impresora de cocina y conexión con cajas (Fase 2).
- [ ] Programa de música y «Música en vivo esta semana» (Fase 2, espera el nombre).
