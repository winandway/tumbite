# Tumbite — Roadmap en orden (11 oct 2026)

> Regla de este documento: **no se adelanta nada**. Una etapa no empieza hasta que la anterior
> esté cerrada. Cada paso dice quién lo hace (👤 Richard · 🤖 la IA) y cómo se sabe que quedó.
> Revisado contra el código real el 11 oct 2026.

## Dónde estamos

- ✅ **Fase 1 construida:** tres apps, panel, landing, cuentas, menús, carrito, cobro con Stripe
  (sin probar), ciclo del pedido, regalos, niveles, calificaciones, zonas «pueblo en pueblo»,
  fotos de restaurantes y platos.
- ✅ **Base de datos multi-zona** (las recomendaciones de arquitectura): todo lo operativo lleva
  `zona_id`, con índices compuestos zona + estado, geohash para buscar cerca sin saturar la base,
  Haversine en el servidor y nunca se cruza de zona. Una zona grande se podrá mover a su propia
  base sin tocar las apps.
- ✅ **Publicación automática** arreglada (cada cambio sale solo en unos 5 minutos).
- ❌ **Correo electrónico: no existe.** Hoy nadie puede recuperar su contraseña, nadie confirma su
  correo, y no sale ningún recibo ni aviso. Es el hueco más grande.
- ❌ **Entorno de pruebas separado: no existe.** Hay una sola base, la de producción (tumbite.com).
  Las pruebas automáticas usan bases en memoria y la computadora usa una base local, pero no hay un
  sitio de pruebas en la nube. Si hoy se prueban los pagos, los pedidos de prueba quedan mezclados
  con los reales.
- Nota honesta: las fotos (paso del 11 oct) se hicieron antes de cerrar la Etapa 0. No rompe nada,
  pero el orden correcto es el de abajo.

---

## Etapa 0 — Las bases (antes de cualquier función nueva)

### 0.1 Entorno de pruebas separado (staging) 👤 + 🤖

- ✅ Hecho el 11 oct 2026: sitio **`tumbite-pruebas`** en `https://staging.tumbite.com`, rama
  **`yapanel-pruebas`**, con su propia base y almacén.
- 🤖 El Action publica primero en `yapanel-pruebas`; solo si la prueba de humo da 200 en todo,
  publica en `yapanel-build` (producción). Ese es el «semáforo» antes de producción.
- 🤖 Las llaves de prueba de Stripe van SOLO en el sitio de pruebas. Producción solo recibe llaves
  reales el día del lanzamiento.
- **Cómo se sabe que quedó:** `https://tumbite-pruebas.sitios.dev/datos/salud` responde ok con su
  propia base, y un pedido creado allá no aparece en tumbite.com.

### 0.2 Correo electrónico 👤 + 🤖

- 👤 Panel de YaDominios → Mis dominios → tumbite.com → «Activar correos de mi dominio» (un botón).
- 👤 Poner el token del sitio como variable `YAD_TOKEN` en el sitio (y en el de pruebas, el suyo).
- 🤖 Pieza única `enviarCorreo` con el canario en `/datos/salud` (correo: ok / error) y registro de
  rebotes. Plantillas bilingües con la marca.
- 🤖 Lo que se construye encima, en este orden:
  1. **Recuperar contraseña** (enlace de un solo uso, vence en 30 minutos, con límite de intentos).
  2. **Confirmar el correo** al registrarse.
  3. **Recibo del pedido** al cliente y aviso de pedido al restaurante.
  4. **Aviso al administrador** cuando un restaurante nuevo pide aprobación.
  5. **«Te anotaste»** para la lista de espera.
- **Cómo se sabe que quedó:** pedir «olvidé mi contraseña» con una cuenta de prueba, llega el correo
  a la bandeja (no a spam) y la clave se cambia.

### 0.3 Administrador 👤

- 👤 Variables `ADMIN_CORREOS` y `ADMIN_SEMILLA` (en los dos sitios). Sin esto no se pueden aprobar
  restaurantes.

### 0.4 Reloj externo y respaldo 🤖 (propuesta, espera el sí)

- YaDominios no tiene tareas programadas. Para lo que debe pasar solo (vencer ofertas viejas,
  cerrar el día de cada restaurante, copia de seguridad de la base) hace falta un reloj de afuera
  que llame a una ruta protegida. Se propone con nombre y costo antes de crearlo.

---

## Etapa 1 — Cerrar la Fase 1 (probar el dinero de punta a punta)

- 👤 Stripe de Windoce LLC con Connect activado y sus llaves **de prueba** en el sitio de pruebas.
- 🤖 Prueba completa en `tumbite-pruebas`: cliente paga con tarjeta de prueba, Apple Pay y Google Pay;
  restaurante acepta; repartidor entrega; se reparte el dinero en los cuatro bolsillos; regalo
  aplicado; reembolso de un pedido cancelado; retiro a banco de restaurante y repartidor.
- 🤖 Cada resultado se anota en `VERIFICAR-PAGOS.md`. Hasta que todo esté en verde, **no se anuncia
  nada a ningún cliente**.

## Etapa 2 — Lo que hace falta para operar el primer día (construido el 11 oct 2026, salvo el punto 4)

1. 🤖 **Soporte por WhatsApp** en la landing y las tres apps (👤 falta el número).
2. 🤖 **Avisos al celular**: pedido aceptado, repartidor en camino, oferta nueva (👤 falta la cuenta
   de Expo de la empresa).
3. 🤖 **Mapa en vivo del repartidor** en la app del cliente (consultas cada pocos segundos; si hace
   falta tiempo real de verdad, esa pieza va directo a Cloudflare con Durable Objects).
4. 🤖 **Ubicación del repartidor en segundo plano** (requiere build propio y un video para Apple).
5. 🤖 **Marcar la dirección en un mapa** dentro de la app del cliente.

## Etapa 3 — Tiendas y lanzamiento cerrado en Miami

- 👤 Cuentas de Apple y Google a nombre de Windoce LLC; abrir Xcode una vez.
- 🤖 Builds, fichas de tienda bilingües, capturas, revisión de Apple.
- 👤 Revisión legal de términos y privacidad, y contador (impuesto de ventas de Florida).
- 👤 Decisiones de dinero: promociones de lanzamiento (envío gratis, comisión 0 % por 3 meses).
- Lanzamiento cerrado con pocos restaurantes y repartidores de confianza, llaves reales de Stripe.

## Etapa 4 — Crecer (después del lanzamiento)

- Entrar con Google y Apple, o con el teléfono (cada código cuesta: con tope de gasto escrito).
- Impresora de cocina y conexión con cajas registradoras.
- Programa de música en vivo (👤 falta el nombre y el porcentaje).
- Nuevas zonas: Orlando, Tampa, Ocala. Venezuela solo si Richard lo decide (Pago Móvil sí tiene
  pasarelas; Zelle no tiene API para comercios).
