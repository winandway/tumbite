# Plan: Tumbite Fase 1 en piloto automático (desde el paso 1b)

- [x] Paso 1b: Landing pública bilingüe en «/» (quiénes somos, cómo funciona, restaurantes, repartidores, música, contacto) + páginas de privacidad, términos y soporte; panel movido a «/panel»; salud dice si existen la base y el almacén.
- [ ] Paso 2a: Base de datos (schema.sql) de cuentas y sesiones + servidor de cuentas: registrarse, entrar, salir, quién soy; contraseñas con hash fuerte; roles cliente/repartidor/restaurante/admin; regla «Soporte» para correos @windoce.com; Turnstile opcional; límite de intentos. Pruebas con una base SQLite local.
- [ ] Paso 2b: Paquete compartido: esquemas de datos (zod) y cliente del servidor usados por apps y panel; pieza reutilizable de borradores (useBorrador) con su prueba.
- [ ] Paso 2c: Panel web: entrar / registrarse con campo de contraseña con ojito, borradores, cerrar sesión de verdad.
- [ ] Paso 2d: Las tres apps: navegación con Expo Router, entrar / registrarse con ojito y borradores, sesión guardada segura, cerrar sesión.
- [ ] Paso 3: Restaurantes y menús: tablas, servidor (crear/editar restaurante y platos bilingües, aprobación por admin), pantallas del panel.
- [ ] Paso 4: App Cliente: restaurantes abiertos, menú, carrito con desglose de los cuatro bolsillos (cálculo compartido y probado al 90 %).
- [ ] Paso 5: Cobro: configuración de dinero editable por admin, pedido recalculado en el servidor, pago con Stripe Checkout, aviso de Stripe con firma verificada, alta de billetera con Stripe Connect; VERIFICAR-PAGOS.md con lo probado y lo NO probado.
- [ ] Paso 6: App Restaurante: pedidos entrantes con alarma, aceptar con tiempo, listo, pausar restaurante.
- [ ] Paso 7: App Repartidor: conectarse, ofertas por cercanía y nivel, aceptar/rechazar sin castigo, estados del viaje, ubicación; el cliente ve el seguimiento.
- [ ] Paso 8: Regalos y marketing (porcentaje por restaurante, cumpleaños, sellos, cliente que vuelve) y niveles de repartidor; pantallas del panel.
- [ ] Paso 9: Prueba del circuito completo de pagos en modo prueba de Stripe (bloqueado si no hay llaves de prueba: se deja escrito en rojo).
- [ ] Paso 10: Preparar publicación en tiendas (eas.json, fichas, permisos); bloqueado por las cuentas de Apple y Google.
- [ ] Paso 11: Verificación completa, publicar, prueba de humo en vivo, documentos y PENDIENTES al día.
