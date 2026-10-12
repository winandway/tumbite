# Candados de Tumbite

Cada cosa que funciona y no debe romperse. Escrito para que otra IA, sin memoria, lo repare sola.

## C-IDIOMA-1 · Bandera del español = España

- Qué: el selector usa 🇪🇸 para español y 🇺🇸 para inglés (regla de Richard).
- Candado: `packages/compartido/src/idiomas.test.ts` falla si el español lleva 🇲🇽. Comprobado en rojo el 10 oct 2026.
- No tocar: la lista `IDIOMAS`.

## C-DINERO-1 · El dinero va en centavos enteros

- Qué: `formatearDolares` y `porcentajeDe` rechazan decimales y negativos; los porcentajes van en puntos básicos (750 = 7,5 %).
- Candado: `packages/compartido/src/dinero.test.ts`; cobertura mínima 90 % en `dinero.ts`.

## C-SALUD-1 · Canario del servidor

- Qué: `GET /datos/salud` dice ok / error / pendiente por pieza (base, variables, Stripe, webhook) y responde 503 si algo está en rojo.
- Candado: `apps/servidor/src/app.test.ts`.

## C-REACT-1 · Una sola copia de React

- Qué se rompió: dos copias de React (19.2.3 y 19.3.0) hacían fallar el panel con «Cannot read properties of null (reading 'useState')».
- Arreglo: `overrides` de `react` y `react-dom` a 19.2.3 en el `package.json` raíz (la versión que exige Expo 57). Al subir de SDK de Expo, se sube aquí también.

## Deuda vigilada · Avisos de seguridad de las herramientas de Expo

- `npm audit` marca altas en `node-forge`, `braces`, `metro` y `uuid` dentro de `expo` / `@expo/cli`. Son herramientas de compilación que corren en la máquina del programador, no viajan en la app ni en el servidor, y no tienen versión corregida (10 oct 2026).
- Se revisa con `npm run audit:apps` en cada actualización de SDK de Expo.

## C-CUENTAS-1 · Contraseñas, sesiones y administradores

- Contraseñas con PBKDF2 (100 000 vueltas, el tope del servidor); nunca en claro. Sesiones guardadas como hash SHA-256 del token.
- Entrar: mismo mensaje y mismo tiempo si el correo no existe o la clave está mal (se calcula un hash falso).
- Nadie se vuelve administrador al registrarse. Para serlo hace falta: sesión + correo en `ADMIN_CORREOS` + `ADMIN_SEMILLA` (secreto del panel de YaDominios) en `POST /datos/cuentas/hacer-admin`.
- Turnstile deja pasar si Cloudflare no responde: decisión de Richard (regla global de login). Detrás quedan contraseña y límite de 10 intentos por minuto por IP.
- Candados: `apps/servidor/src/rutas/cuentas.test.ts` (límite de intentos comprobado en rojo el 10 oct 2026).

## C-BORRADOR-1 · Ningún formulario pierde lo escrito

- Pieza única `useBorrador` en `packages/compartido/src/borrador.ts`; todos los formularios la usan. No guarda campos sensibles; se borra al guardar, al cancelar y al cerrar sesión.
- Candados: `borrador.test.tsx` y `apps/panel/src/panel/PanelApp.test.tsx`.

## C-PAGOS-1 · El precio lo pone el servidor y el aviso de Stripe va firmado

- `POST /datos/pedidos` ignora cualquier precio del teléfono: lee los platos de la base y calcula con `calcularPedido`.
- `POST /datos/stripe/aviso`: firma HMAC verificada con tolerancia de 5 minutos, cada evento una sola vez (`avisos_stripe`), y el monto y la sesión deben cuadrar con el pedido.
- La propina nunca completa el pago mínimo del repartidor (`bolsillos.ts`).
- Candados: `apps/servidor/src/rutas/pedidos.test.ts` (firma comprobada en rojo el 10 oct 2026) y `packages/compartido/src/bolsillos.test.ts` (todo cuadra al centavo).

## C-OPERACION-1 · Ciclo del pedido, reparto justo y billetera sin carreras

- Estados: pagado → aceptado (el restaurante fija minutos) → listo → en_camino (solo si estaba listo) → entregado. Rechazar devuelve el dinero en Stripe.
- Reparto (`repartirOfertas`): primero el más cercano; a igual distancia (medio km) gana el nivel más alto; la oferta vence a los 60 s; rechazar no castiga.
- Aceptar una oferta es atómico: si dos tocan a la vez, solo uno se lo lleva.
- Entregado acredita restaurante, entrega y propina UNA sola vez (índice único pedido + concepto).
- Retiro atómico: revisar saldo y anotar el retiro es una sola sentencia (comprobado en rojo el 10 oct 2026 con dos retiros simultáneos).
- El cliente ve la ubicación del repartidor solo mientras va en camino, y solo su nombre de pila.
- Candados: `apps/servidor/src/rutas/operacion.test.ts`, `pedidos.test.ts`.

## C-ESTATICOS-1 · Las páginas que no son la portada no pueden dar error 500

- Qué se rompió (10 oct 2026, primera versión en vivo): `tumbite.com/privacidad`, `/panel`, `/og.png` y todo lo que no era la portada daba 500.
- Causa: la respuesta de los estáticos trae cabeceras de solo lectura y el middleware de seguridad intentaba escribirles.
- Arreglo: `cabecerasSeguridad` copia la respuesta antes de tocar las cabeceras, y la ruta de estáticos devuelve una copia (`new Response(res.body, res)`).
- Candado: `apps/servidor/src/seguridad.test.ts` (comprobado en rojo).
- Cómo comprobar en vivo: las rutas `/`, `/privacidad`, `/terminos`, `/soporte`, `/panel`, `/og.png`, `/robots.txt` deben dar 200.

## C-ESQUEMA-1 · Migraciones seguras al arrancar

- schema.sql solo crea lo que no existe; NO agrega columnas a tablas vivas. `apps/servidor/src/esquema.ts` revisa al arrancar qué columnas faltan, las agrega con `ALTER TABLE ... ADD COLUMN` (sin tocar datos) y crea los índices que dependen de ellas.
- Regla: los índices sobre columnas NUEVAS van en `esquema.ts`, nunca en schema.sql (en una base vieja la columna aún no existe cuando corre schema.sql y la publicación fallaría).
- Canario: `/datos/salud` → `esquema: ok/error`.
- Candado: `apps/servidor/src/esquema.test.ts` (base vieja sin columnas queda completa; comprobado en rojo el 10 oct 2026).

## C-ZONAS-1 · Pueblo en pueblo: nunca se cruza de zona

- Todo lo operativo lleva `zona_id`. La lista pública filtra por zona; el reparto busca primero en la celda (geohash de 5 letras) del restaurante y sus 8 vecinas, luego en toda la zona, y jamás en otra zona.
- Candado: `apps/servidor/src/rutas/zonas.test.ts` (zona vecina pegada; comprobado en rojo).

## C-WEB-1 · Las páginas internas no redirigen a la portada

- La plataforma redirige `/index.html` → `/`. Para servir la app web en rutas internas se pide `/` (no `/index.html`). También responden a HEAD.
- Candado: `apps/servidor/src/app.test.ts`.

## C-SIN-EMOJIS — Íconos de línea, nunca emojis (10 oct 2026)

- **Qué pasaba:** la landing, el panel y las apps usaban emojis como íconos (campana, regalo, moto, pizza…). Richard: «pareciera una página de payasos».
- **Qué se hizo:** la landing y el panel usan la pieza `apps/panel/src/sitio/Icono.tsx` (librería lucide-react, íconos de línea en escarlata dentro de un cuadrito rosado suave). Los textos guardan una clave (`'alarma'`, `'regalo'`…) en vez del emoji. Las tiendas llevan los logos de Apple y Google Play en una tinta. En las apps, el ojito de la contraseña es un ojo dibujado con vistas y los regalos del carrito van solo con texto.
- **Candado:** `apps/servidor/src/sinEmojis.test.ts` recorre el código del panel y de las tres apps y se pone en rojo si aparece un emoji. Solo permite las banderas del selector de idioma y los signos ★ y ✓. Comprobado en rojo metiendo un emoji en el carrito.
- **No tocar:** no volver a poner emojis «para alegrar». Un ícono nuevo se agrega a la lista de `Icono.tsx`.

## C-FOTOS — Fotos de restaurantes y platos (11 oct 2026)

- **Cómo funciona:** el panel reduce la foto en el navegador (máximo 1200 px, WebP) y la manda tal cual a `POST /datos/mi-restaurante/fotos`. El servidor mira los primeros bytes (JPG, PNG o WebP; nada de SVG), corta en 3 MB, la guarda en el almacén del sitio (`env.BUCKET`) en `fotos/<restaurante>/<id>.<ext>` y devuelve la ruta `/media/fotos/…`. Esa ruta la sirve `GET /media/fotos/:restaurante/:archivo`, con caché de un año (el nombre nunca se repite).
- **El campo `imagen`** de restaurantes y platos solo acepta rutas `/media/fotos/…` (esquema `RUTA_FOTO` en compartido): nada de enlaces a sitios ajenos.
- **Fallo que se arregló de paso:** al editar un plato o el restaurante, la foto se borraba sola porque el panel no la mandaba. Ahora viaja siempre.
- **Pruebas:** `apps/servidor/src/rutas/fotos.test.ts` (con un almacén de mentira en memoria; rojo comprobado quitando la revisión de bytes y la del esquema) y `apps/panel/src/panel/SubirFoto.test.tsx`.
- **Cómo se comprueba en vivo:** subir una foto en Mi restaurante, guardar, recargar: la foto sigue. `https://tumbite.com/datos/salud` debe decir `almacen: ok`.
- **No tocar:** no servir las fotos bajo `/api`; no aceptar SVG (puede llevar código).

## C-BORRADOR-BASE — Lo guardado no reaparece como borrador (11 oct 2026)

- **Qué pasaba:** en Mi restaurante, después de guardar y recargar salía «Recuperamos lo que estabas escribiendo». Al llenar el formulario con lo del servidor, eso mismo se guardaba como borrador.
- **Arreglo, en la pieza común:** `useBorrador` tiene `cargarBase(v)` (lo que vino del servidor al abrir; si había algo a medio escribir, eso manda) y `cargar(v)` (lo recién guardado; borra el borrador). Solo cuenta como borrador lo que la persona cambie después.
- **Además:** zonas, billetera, regalos, dinero y el buscador de la portada no guardaban lo escrito; ahora sí.
- **Candado:** `apps/servidor/src/formulariosConBorrador.test.ts` falla si un `<form>` del panel no usa `useBorrador` (rojo comprobado), y dos pruebas nuevas en `borrador.test.tsx` (rojo comprobado).

## C-CORREO — Correos del sitio y recuperar contraseña (11 oct 2026)

- **Pieza única:** `apps/servidor/src/correo.ts` → `enviarCorreo(env, {de, para, asunto, texto})`. Manda por la API de YaDominios Cloud (`POST yapanel.yadominios.com/api/hosting/correo/enviar`) con `YAD_TOKEN` (variable del panel; NUNCA en el repo). Remitentes en inglés: no-reply, support, sales, orders, billing y hello, todos @tumbite.com.
- **Canario:** `/datos/salud` → `correo: pendiente` (sin token) / `ok` / `error` (último envío falló o rebotó). Un rebote permanente cuenta como fallo, no como enviado.
- **Recuperar contraseña:** `POST /datos/cuentas/recuperar` responde siempre igual (no revela si el correo existe), guarda el hash del token en `recuperaciones` (vence en 30 min, un solo uso) y manda el enlace `/restablecer?token=…`. `POST /datos/cuentas/restablecer` cambia la clave y cierra todas las sesiones. Límite: 5 intentos por minuto.
- **Pantallas:** `/olvide` y `/restablecer` en el sitio web; las apps abren `/olvide` en el navegador.
- **Pruebas:** `apps/servidor/src/rutas/recuperar.test.ts` (transporte de mentira, nunca el servicio real; rojo comprobado quitando el «un solo uso») y `apps/panel/src/panel/Restablecer.test.tsx`.
- **Pendiente de Richard para que funcione en vivo:** activar correos en Mis dominios → tumbite.com (el servicio respondió `dominio_sin_activar` el 11 oct) y poner `YAD_TOKEN` en Variables de entorno.
- **No tocar:** no mandar correos por fuera de `enviarCorreo`; no guardar el token de recuperación en claro.

## C-AVISOS — Los cinco correos automáticos (11 oct 2026)

- **Pieza:** `apps/servidor/src/avisos.ts`, todos por `enviarCorreo`, bilingües según el idioma de la persona. Nunca frenan el flujo: si el correo falla, el pedido o el registro siguen y el fallo queda en el canario.
  1. **Confirmar el correo** al registrarse (remitente no-reply): enlace `/confirmar?token=…`, vence en 2 días, un solo uso, marca `usuarios.correo_confirmado_en`. No bloquea entrar. `POST /datos/cuentas/confirmar/reenviar` lo manda otra vez (3 por minuto).
  2. **Recibo del pedido** al cliente (remitente orders), al llegar el aviso de pago de Stripe. Con el desglose y el enlace para seguirlo.
  3. **Aviso al restaurante** (orders) en el mismo momento, con las líneas, las notas y lo que recibe.
  4. **Restaurante nuevo** a cada correo de `ADMIN_CORREOS` (no-reply, responder al dueño). Solo al crearlo, no al editarlo.
  5. **Bienvenida a la lista de espera** (hello, responder a support).
- **Migración:** columna `usuarios.correo_confirmado_en` (en `esquema.ts`, se agrega sola) y tabla `confirmaciones`.
- **Pruebas:** `apps/servidor/src/avisos.test.ts` (rojo comprobado quitando el enganche del pedido pagado) y `apps/panel/src/panel/Confirmar.test.tsx`.
- **No tocar:** los correos del pedido salen SOLO desde el aviso firmado de Stripe (nunca al crear el pedido, que aún no está pagado).

## C-ETAPA-2 — Mapa en vivo, pin de dirección, WhatsApp y avisos al celular (11 oct 2026)

- **Seguimiento (`GET /datos/pedidos/:id/seguimiento`)** devuelve además `restaurante {lat,lng}` y `minutosEstimados` (cocina que falta + viaje a 25 km/h, mínimo 5). El repartidor solo se expone mientras está `en_camino`.
- **Mapa en vivo** (`apps/cliente/src/MapaEntrega.tsx`, react-native-maps): restaurante, casa y repartidor con línea punteada, reencuadre solo. **Pin de dirección** (`ElegirEnMapa.tsx`): tocar o arrastrar rellena la dirección por geocodificación inversa de expo-location. Los `.web.tsx` son respaldos para la vista web del programador. iOS usa Apple Maps; **Android necesita la llave de Google Maps** en `apps/cliente/app.json` (`android.config.googleMaps.apiKey`, hoy un marcador) — 👤.
- **WhatsApp de soporte:** variable del sitio `WHATSAPP_SOPORTE` (solo dígitos con prefijo), servida por `GET /datos/publico` (caché 5 min). La landing y el menú de la cuenta de las tres apps muestran el botón solo si existe. Cuando llegue el número se pone con `guardar_variable` + `republicar`, sin tocar código.
- **Avisos al celular:** tabla `dispositivos` (token de Expo por teléfono), `POST/DELETE /datos/cuentas/dispositivo`, pieza `apps/servidor/src/notificaciones.ts` (API de Expo; un teléfono borrado se apaga solo; canario `avisosCelular`). Enganches: pedido aceptado, en camino y entregado → cliente; oferta nueva → repartidor; pedido pagado → restaurante. Las apps registran el token en `useAvisosCelular` SOLO si existe el proyecto de EAS (`extra.eas.projectId`) — 👤; hasta entonces lo dicen en consola y no fallan.
- **Candado de robo de token:** un token de avisos solo cambia de cuenta si la anterior ya cerró sesión (`activo = 0`); si no, 409. La app da de baja el teléfono al salir (`darDeBajaAvisos`). Probado en `notificaciones.test.ts`.
- **Pruebas:** `operacion.test.ts` (mapa y tiempo), `notificaciones.test.ts` (rojo comprobado quitando el aviso de «en camino»), `app.test.ts` y `Landing.test.tsx` (WhatsApp).
- **Sin probar en pantalla:** el mapa nativo no se puede ver sin Xcode ni emulador (👤 abrir Xcode). El código compila y los tipos pasan.

## C-RELOJ — Reloj externo (11 oct 2026)

- **Qué:** YaDominios Cloud no tiene tareas programadas. El workflow `.github/workflows/reloj.yml` llama cada 5 minutos a `POST /datos/reloj` en producción y en pruebas con la cabecera `x-reloj-secreto`. Hoy reparte ofertas pendientes y vence las viejas aunque nadie abra la app del repartidor.
- **Secreto:** `RELOJ_SECRETO` (variable secreta en los dos sitios, secreto `RELOJ_SECRETO` del repositorio en GitHub, copia en el llavero de la Mac `-s tumbite-reloj-secreto`). Sin secreto, la ruta responde 404 a todos. Comparación en tiempo constante.
- **Cómo se comprueba:** Actions → reloj → el último tic en verde; la respuesta dice `ok` y cuántos pedidos esperan repartidor.
- **Prueba:** `operacion.test.ts` («reloj externo»).
- **No tocar:** no mover trabajo pesado al reloj sin medir (GitHub da 2.000 minutos al mes; 5 min × 288 tics al día son ~1 min diario de uso).

## C-RESPALDO — Copia de seguridad diaria (11 oct 2026)

- **Qué:** `POST /datos/respaldo` (mismo secreto del reloj) vuelca cada tabla a `respaldos/AAAA-MM-DD/<tabla>.json` en el almacén del sitio (`env.BUCKET`), sin la tabla `sesiones`, y borra lo más viejo que 30 días. El workflow `reloj.yml` lo pide a las 08:00 UTC (3 am Miami) y a mano con «Hacer también la copia de seguridad».
- **Canario:** `/datos/salud` → `respaldo: ok/error`. Ojo: `ultimoRespaldo` vive en memoria de cada instancia del Worker, así que puede salir `null` aunque el respaldo haya corrido; la prueba de verdad es la lista del almacén (`listar_archivos` → `respaldos/<día>/…`). Primer respaldo real: 11 oct 2026, 19 tablas.
- **Cómo se restaura:** bajar el JSON de la tabla del almacén (listar_archivos / el panel) e insertarlo con `consultar_base`. Es un respaldo lógico, no de archivos: las fotos ya viven en el mismo almacén.
- **Prueba:** `apps/servidor/src/respaldo.test.ts` con almacén de mentira.

## C-DOCS — Sección Docs (11 oct 2026)

- **Qué:** `/docs`, estilo Wikipedia como manda la regla: barra lateral con secciones e íconos que nunca se pierde (el contenido cambia a la derecha y la guía activa queda resaltada), buscador con ⌘K que filtra mientras se escribe, cada guía en su propia dirección `/docs/<seccion>/<guia>`, «← Docs» arriba en celular, colores de Tumbite. Bilingüe: `apps/panel/src/sitio/docs/guias.ts` (una prueba exige que las dos lenguas tengan las mismas guías).
- **Dónde se enlaza:** menú y pie de la landing, menú de la cuenta en las tres apps («Guías de ayuda»), mapa del sitio (23 direcciones). En el servidor, `/docs` y `/docs/*` son rutas públicas con caché de borde y canónica propia.
- **Cuidado:** el buscador vive siempre en el mismo sitio del árbol; si se mueve entre modos, pierde el foco al escribir (pasó en la primera versión).
- **Pruebas:** `apps/panel/src/sitio/docs/Docs.test.tsx`.

## C-PIE — Pie de página profesional y páginas por lugar (12 oct 2026)

- **Qué:** `apps/panel/src/sitio/Pie.tsx`: fondo oscuro estilo DoorDash con muchos enlaces reales; arriba el bloque de cobertura estilo Uber Eats con pestañas Ciudades / Países / Tipos de comida. Lo activo va en verde con «Activo»; lo que viene, en gris con «Muy pronto». Las tres listas van completas en el HTML (nav oculto) aunque solo una se vea: Google las lee todas.
- **Datos en un solo lugar:** `cobertura.ts` (países: EE.UU. activo; Rumanía, Colombia, México, Venezuela, Guatemala, Bolivia «muy pronto»; ciudades: Miami activa; Orlando, Tampa, Ocala próximas; 12 tipos de comida). Para activar un país o ciudad se cambia `estado` ahí y se agrega al mapa del sitio.
- **Páginas SEO:** `/pais/<slug>`, `/ciudad/<slug>`, `/comida/<slug>` (`Lugar.tsx`): título con el lugar, estado, texto bilingüe y los tres formularios de lista de espera. Rutas públicas con caché y canónica propia en el servidor; 23 direcciones nuevas en `sitemap.xml`.
- **Franquicias:** en el pie dice «Franquicias por ciudad · Muy pronto» sin enlace, hasta tener la investigación y la página.
- **Pruebas:** `apps/panel/src/sitio/Pie.test.tsx`.

## C-PRERENDER — Las páginas públicas llegan armadas en HTML (12 oct 2026)

- **Qué:** después de `vite build`, `apps/panel/scripts/prerender.mjs` renderiza con React en un navegador de mentira (jsdom) las 50 páginas públicas (portada, legales, Docs, países, ciudades, comidas) y escribe `dist/<ruta>/index.html` con el contenido ya puesto, la canónica de esa ruta y en español. Al cargar, React toma el control igual que antes.
- **Por qué:** el pie con países y las páginas por lugar son para el SEO; con la app vacía, Google dependía de ejecutar JavaScript. Ahora el HTML crudo trae títulos, textos y enlaces (como DoorDash).
- **Candado en el semáforo:** `scripts/semaforo.sh` exige que `/pais/colombia` traiga un `<h1>` en el HTML crudo antes de publicar en producción.
- **Cuidado:** el guion reemplaza `#raiz` hasta `</body>` (es repetible); se prerrenderiza en español a propósito. Una página nueva pública se agrega a la lista de rutas del guion y al mapa del sitio.

## C-CONFIGURACION — Configuración de la cuenta; borrar nunca a un toque (12 oct 2026)

- **Qué pasaba:** «Borrar mi cuenta» estaba suelto en el menú de la cabecera del panel, a un toque. Richard: «cualquiera puede borrar la cuenta… eso es una estupidez».
- **Ahora:** pantalla `/panel/configuracion` (tuerquita) para TODOS los roles: mis datos (nombre, celular, cumpleaños, idioma), contraseña (exige la actual; cierra las otras sesiones), correo (exige la contraseña; el nuevo queda sin confirmar y recibe enlace). Borrar la cuenta vive en los tres puntos de esa pantalla y pide escribir BORRAR / DELETE. En las apps, el menú de la cuenta lleva a Configuración en lugar de borrar.
- **Servidor:** `GET /datos/cuentas/perfil`, `PATCH /datos/cuentas/yo`, `POST /datos/cuentas/clave`, `POST /datos/cuentas/correo`.
- **Pruebas:** `cuentas.test.ts` («configuración de la cuenta») y `PanelApp.test.tsx` (borrar no está a la vista).

## C-PAGO-SIN-SALTO — el pago queda dentro de la app (11 oct 2026)

- **Qué se rompía:** al pagar, la app saltaba a la página de Stripe Checkout y al volver la persona no caía en su pedido. Richard: «el salto mata la magia».
- **Cómo quedó:** el servidor crea PaymentIntent + cliente de Stripe + CustomerSession en `POST /datos/pedidos` y devuelve `clientSecret` y `sesionCliente`. La web pinta `PaymentElement` dentro del carrito (`apps/cliente/src/PagoTarjeta.web.tsx`, `redirect: 'if_required'`); el celular usa la hoja de pago (`PagoTarjeta.tsx`). El aviso `payment_intent.succeeded` marca pagado si el monto y el intento cuadran.
- **El plugin de Stripe en `app.json`** necesita opciones (`merchantIdentifier`), si no la exportación web se cae.
- **Prueba:** `apps/servidor/src/pagoSinSalto.test.ts` (comprobada en rojo cambiando `if_required` por `always`) y las pruebas de `pedidos.test.ts` «pago dentro de la app».
- **No tocar:** no volver a `Linking.openURL` para cobrar; no quitar `payment_intent.succeeded` del endpoint del aviso en Stripe.
- **12 oct 2026 — el botón de pagar giraba para siempre:** el carrito esperaba la clave pública de `/datos/publico`, que la caché del borde servía vieja (sin la clave) hasta una hora. Ahora la clave viaja dentro de la respuesta de `POST /datos/pedidos` (`clavePublica`), el botón solo gira mientras se crea el pedido, y `/datos/publico` ya no se sirve viejo (`s-maxage=60`, sin `stale-while-revalidate`). Candado en `pagoSinSalto.test.ts` (comprobado en rojo).
- **Modo oscuro forzado por algunos navegadores del celular:** `claro.mjs` pone `color-scheme: only light`, que es lo que esos navegadores respetan.

## C-PAGO-FORMULARIO — el formulario de tarjeta no salía y el botón giraba (12 oct 2026)

- **Qué se rompía:** al tocar «Continuar al pago» aparecía el título «Tu tarjeta» y debajo nada, o el botón girando para siempre. Richard lo vio en su celular dos veces y la IA dijo dos veces que estaba arreglado sin probarlo.
- **Causa real (reproducida en local con `wrangler dev` + la app web en el navegador):** Stripe se negaba a pintar el `PaymentElement` con este error, que solo sale escuchando `loaderror`: _«You must provide setup_future_usage on the Payment Intent when setting payment_method_save=enabled in the Customer Session»_. La sesión del cliente permite guardar la tarjeta, pero el intento de pago no decía para qué se guardaba. La app no escuchaba ese error, así que no se veía nada.
- **Qué se hizo:** el intento de pago lleva `setup_future_usage: 'off_session'` (`apps/servidor/src/rutas/pedidos.ts`). La web escucha `onLoadError` y `onReady` del `PaymentElement` (`apps/cliente/src/PagoTarjeta.web.tsx`): mientras carga dice «Cargando el formulario de pago…», si falla muestra el mensaje de Stripe, y el botón de pagar solo aparece con el formulario listo.
- **Prueba:** `pedidos.test.ts` exige `setup_future_usage=off_session` en la llamada a Stripe (rojo comprobado quitándolo); `pagoSinSalto.test.ts` exige `onLoadError`/`onReady` (rojo comprobado).
- **Cómo se comprueba a mano:** en local, servidor con las llaves de Stripe por `--var`, app web en el 8081, carrito → «Continuar al pago» → tiene que salir Tarjeta/Banco/Cash App Pay con la casilla «Guardar los datos de pago».
- **No tocar:** no quitar `setup_future_usage` ni `payment_method_save`; van juntos.

## C-REPARTIDOR-WEB — la app del repartidor en tumbite.com/repartidor (12 oct 2026)

- **Para qué:** la segunda prueba en la calle necesita al repartidor y Expo Go no abre la sesión. La app del repartidor se exporta a la web igual que la del cliente.
- **Cómo quedó:** `apps/repartidor/app.json` con `experiments.baseUrl = "/repartidor"`; script `npm run build:repartidor-web` (usa el mismo `claro.mjs` del cliente, que ahora recibe la carpeta); el Action la copia a `out-deploy/repartidor`; el servidor manda las rutas internas a `/repartidor/` con `raizDeApp()`; el semáforo exige 200 en `/app/` y `/repartidor/`.
- **Fallo encontrado al probarlo:** «Conectarme» no hacía nada si el navegador no daba la ubicación o el GPS tardaba (sin `try`, sin tope de tiempo), y la recarga automática de cada pocos segundos borraba cualquier aviso. Ahora dice «Buscando tu ubicación…», corta a los 15 segundos (usa la última ubicación conocida), muestra el error, y el error de la recarga va aparte (`errorCarga`).
- **Ojo al probar en local:** `expo export` guarda en caché la dirección del servidor; para apuntar a `localhost:8787` hay que exportar con `--clear`, si no la app local le habla a tumbite.com.
- **Prueba:** `apps/servidor/src/repartidorWeb.test.ts` (rojo comprobado) y `app.test.ts` «app del repartidor en versión web».
- **Comprobado en pantalla (local):** crear cuenta de repartidor, ver inicio, «Conectarme» sin permiso (aviso que se queda) y con ubicación (pasa a «Conectado: recibiendo pedidos»).

## C-LEGALES-TIENDAS y C-BORRADO-COMPLETO — legales para Apple y Google (12 oct 2026)

- **Qué hay:** privacidad completa, términos para clientes, restaurantes y repartidores, página pública `/borrar-cuenta` y soporte, en español e inglés (`apps/panel/src/sitio/legales.ts`). Prerenderizadas, en el sitemap, con su canónica y en el pie. Mapa de requisitos en `docs/LEGALES-TIENDAS.md`.
- **Fallo encontrado y arreglado:** borrar la cuenta dejaba la dirección, las indicaciones y la ubicación en los pedidos viejos, el texto de las calificaciones, los teléfonos de avisos y la anotación en la lista de espera. Ahora se limpian; los importes quedan sin nombre.
- **Aviso al crear cuenta** en las apps y en el panel, con enlaces a los términos que tocan.
- **Menú de 3 puntos de las apps:** «Términos y privacidad» y «Borrar mi cuenta» (va a `/borrar-cuenta`, que tiene el botón directo).
- **Prueba:** `apps/panel/src/sitio/legales.test.tsx` (rojo comprobado quitando el botón de borrar) y `cuentas.test.ts` «borrar la cuenta también limpia…» (rojo comprobado antes del arreglo).
- **No tocar:** si se cambia lo que guarda o borra el servidor, se cambia el texto de privacidad y de `/borrar-cuenta` en el mismo trabajo.
