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

### 0.4 Reloj externo y respaldo 🤖 — ✅ hecho el 11 oct 2026 (GitHub Actions, cero costo)

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

## Etapa 2½ — El ciclo del pedido como lo hacen los grandes (dictado por Richard, 14 oct 2026)

Sale de `docs/COMPARACION-CICLO-PEDIDO.md` (DoorDash y Uber Eats frente a nosotros, con fuentes oficiales). Richard: «no quiero ir a probar nada todavía si no lo tenemos claro». **Nada de esto se salta: sin los puntos 1 a 5 no hay prueba en la calle ni envío a las tiendas.** Hecho el 14 oct 2026 salvo «cocina ocupada» (un botón que suma minutos a todos los pedidos: va después) y el punto 8.

1. ✅ (14 oct) **Despacho con reloj.** Ofrecer el pedido cuando falten «viaje del repartidor + 3 minutos» para la hora de listo (la regla de los 7 minutos de Uber), no al aceptar. Si el restaurante toca «Listo» antes, ofrecer ya. El repartidor ve «listo en X min».
2. ✅ (14 oct) **El restaurante ve venir al repartidor.** Estados «va al restaurante» y «llegó» (por GPS), aviso con sonido a 5 minutos, indicador «esperando» con cronómetro que empieza cuando pasó el tiempo de preparación (espera evitable, como DoorDash). Aquí entra lo propuesto el 14 oct: **si el repartidor ya mandó la foto y el restaurante no confirma en 2 minutos, el pedido se pone en amarillo y suena la alarma en la tableta.**
3. ✅ (14 oct) **Hablar entre repartidor y cliente** con número enmascarado (llamar y escribir), y protocolo de «cliente no aparece» (llamar, esperar, dejar en lugar seguro con nota).
4. ✅ (14 oct) **«Dejar en la puerta» o «en mano»** al pedir; botón «Entregado en mano» que no exige la foto de la bolsa en el piso.
5. ✅ (14 oct) **Avisos al cliente**: repartidor asignado, «casi llega» (1 minuto por GPS), «llegó»; hora «a más tardar» fijada al aceptar.
6. ✅ (14 oct) **Repartidor que se baja o desaparece**: soltar con motivo, reasignación sola, y el Manager vigila pedidos asignados sin movimiento.
7. ✅ (14 oct) Cambiar un pedido por ingrediente agotado sin cancelarlo todo; ajustar el tiempo de preparación después de aceptar y «cocina ocupada».
8. Después del lanzamiento: varios pedidos por repartidor; firma, PIN y mayoría de edad (cuando haya alcohol).

## Etapa 2¾ — Todo lo que los estudios de Richard dicen que hay que tener (14 oct 2026)

Fuente: `docs/COMPARACION-CICLO-PEDIDO.md`, sección «Los estudios de Richard». Regla de Richard: se copian las herramientas que los grandes ya tienen, con interruptor para que el usuario final elija; la IA decide cómo encajan y ejecuta; a Richard solo se le pide lo que únicamente él puede dar (cuentas, claves, dinero). **Ninguna se descarta.** Orden de ejecución:

1. ✅ (14 oct, sin probar en real) **Autorizar al pedir y capturar al entregar.** Richard ya agregó el evento en Stripe.
2. ✅ (14 oct) **PIN de 4 dígitos en mano**, con interruptor del cliente.
3. ✅ (14 oct) **Horarios reales del restaurante** (por día, varios turnos, cierre automático, «abre a las…» en la app) y **modificadores de platos** (grupos: tamaño, extras, sin…; obligatorios u opcionales; mínimo y máximo; precio por opción), con el carrito y el pedido mostrando lo elegido.
4. ✅ (14 oct) **GPS serio:** precisión reportada, dos lecturas coherentes, detección de saltos imposibles, y «No puedo confirmar mi ubicación» que soporte autoriza con motivo y queda en la bitácora.
5. ✅ (14 oct) **Checklist de activación del restaurante** (precios, horario, dirección con pin, cuenta de cobro, teléfono, al menos 5 platos con foto) visible para el restaurante y bloqueante; **cola sin red** en la app del repartidor (la foto y la entrega se guardan y se reintentan; «pendiente de confirmar»).
6. ✅ (14 oct) **Despacho completo:** oferta abierta a todos con +$1 tras 3 rechazos; aviso al equipo a los 5 minutos sin repartidor; tiempo de preparación por defecto = promedio real de los últimos 20 pedidos del restaurante; **cocina ocupada** (+10/+20 a los pedidos nuevos).
7. ✅ (14 oct, Twilio simulado; en producción se enciende al pegar las llaves 👤) **Avisos completos al cliente:** «llega en 5 min» y «sal a recibir» a 2 min (en mano); **SMS de respaldo** para en-puerta y no-te-encuentran (Twilio; Richard aprobó el costo); **llamadas y mensajes con número oculto** entre repartidor y cliente (Twilio; Richard aprobó).
8. ✅ (14 oct) **Manager a los tiempos de los grandes:** recordatorio a 1 y 3 minutos, cancelación a los 6 (decisión de la IA entre los 3-8 de DoorDash y los 11,5 de Uber); oferta de 45 s.
9. ✅ (14 oct; Apple Pay real espera la cuenta de Apple 👤) **Dinero vigilado:** conciliación diaria (pedidos, cobros, capturas, anulaciones, reembolsos, transferencias, abonos) con canario en `/datos/salud`; abono fallido avisa al beneficiario y al equipo; retención de fotos 30 días salvo reclamo; **Apple Pay y Google Pay** en el formulario de pago.
10. ✅ (14 oct; Checkr real espera la cuenta 👤) **Antecedentes de repartidores con proveedor** (Checkr: antecedentes penales y récord de manejo, como DoorDash) + **selfie aleatoria** de identidad continua. Necesita la cuenta de Checkr a nombre de Windoce LLC (se le pide a Richard al llegar aquí, con croquis).
11. ✅ (14 oct) **Recogida en el local (pickup)** con comisión del 5 %; **cambio de dirección** por el cliente con recálculo y consentimiento; **propina después de entregar**; **agrupar pedidos** del mismo local con desvío menor a 5 min; **firma y verificación de edad** (para cuando haya alcohol).
12. 👤 Lo que solo Richard puede dar, cuando se llegue a cada punto: cuenta de Twilio (7), cuenta de Checkr (10), 1099 e impuestos con el contador (ya en la lista).

Lo de Sudamérica (efectivo, Rappi, Mercado Pago, leyes de Colombia y México) se construye cuando se decida salir de EE.UU., como herramientas que se encienden por país.

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

## Etapa 5 — Tumbite AI (dictado por Richard, 12 oct 2026)

Estudio completo en `docs/TUMBITE-AI.md`: dónde va la IA momento por momento, el Manager que vigila
cada pedido, APIs y costos, alarmas y fases. Resumen del orden:

- ✅ **Primera parte de la Fase A hecha (12 oct 2026, candado C-MANAGER-1):** recordatorios al restaurante, cancelación con devolución a los 10 minutos, alerta sin repartidor y bitácora en el superadmin. Semáforo en la lista del restaurante y tablero «Pedidos en curso» en el superadmin hechos el mismo día. La Fase A con reglas queda completa.
- 🤖 **Fase A — Manager con reglas, costo cero:** reloj de tiempos esperados por pedido, semáforo
  verde/amarillo/rojo, avisos automáticos y bitácora en el panel. Puede empezar apenas se cierre la
  Etapa 1 (no gasta en IA ni toca dinero).
- 👤 + 🤖 **Fase C' — Asistentes de soporte con IA (decisión de Richard, 12 oct):** uno para el cliente
  («¿dónde está mi comida?»), otro para el repartidor y otro para el restaurante («¿cuándo cobro?»),
  que leen la base solo de esa persona; y chat repartidor ↔ cliente con traducción en vivo. Va
  después de la Fase A y antes de la B. Necesita el tope de gasto aprobado por Richard. Además,
  un chat público en el sitio que responde con lo publicado en Docs y en la Calculadora (precios,
  comparación, cuánto gana cada quien), sin inventar cifras: si no está en Docs, lo dice.
- 🤖 **Fase B — Tiempo real de ruta** (OSRM): repartidor por minutos, oferta anticipada, juntar pedidos.
- 👤 + 🤖 **Fase C — El cerebro que habla:** primero la guardia de modelos y el tope de gasto
  (👤 Richard aprueba el tope); luego mensajes, resumen del día y de reseñas.
- 🤖 **Fase D — Soporte con IA y menú desde una foto.**
- 🤖 **Fase E — Aprender de la historia:** tiempos predichos, recomendaciones, fraude.

## Buscador de la portada (dictado por Richard, 12 oct 2026) — no se olvida

- Hoy: «Usar mi ubicación» comprueba la zona y, si Tumbite llega, abre la app web con la ubicación puesta; una dirección escrita abre la app con esa dirección en el pedido. Fuera de zona, manda a la lista de espera.
- Falta (👤 llave de geocodificación de Google o Mapbox): convertir la dirección escrita en coordenadas para decir si está en zona ANTES de entrar, con sugerencias mientras se escribe, como Uber Eats. Va en la Etapa 2.

## Dictado por Richard el 12 oct 2026, tras la primera compra de prueba

1. **Pago dentro de la app, sin salto** (como Mercatren): Stripe Payment Element en la versión web y Payment Sheet en las apps, con tarjeta guardada para la próxima compra (Customer + setup_future_usage). Reemplaza el Checkout con salto. Es lo siguiente que se construye.
2. **Dirección con autocompletado** (Google Places): se escribe la calle y aparecen las sugerencias hasta elegir la de uno. 👤 Llave de Google Places (Maps Platform) con tope de gasto.
3. **La app siempre clara**: el navegador del teléfono en modo oscuro la oscurecía; se fuerza fondo blanco.

## Segunda prueba en la calle — ver `docs/PLAN-DE-PRUEBA-EN-CALLE.md`

La primera prueba (11–12 oct) dio por probada la pasarela de pago: el cobro real entró, el pedido se marcó pagado y salieron los correos. La segunda prueba es el circuito completo: pedido, restaurante y repartidor en bicicleta con el mapa, siguiendo el plan escrito.
