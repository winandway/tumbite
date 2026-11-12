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

- Qué se rompió (10 oct 2026, primera versión en vivo): `tumbite.com/privacy`, `/panel`, `/og.png` y todo lo que no era la portada daba 500.
- Causa: la respuesta de los estáticos trae cabeceras de solo lectura y el middleware de seguridad intentaba escribirles.
- Arreglo: `cabecerasSeguridad` copia la respuesta antes de tocar las cabeceras, y la ruta de estáticos devuelve una copia (`new Response(res.body, res)`).
- Candado: `apps/servidor/src/seguridad.test.ts` (comprobado en rojo).
- Cómo comprobar en vivo: las rutas `/`, `/privacy`, `/terms`, `/support`, `/panel`, `/og.png`, `/robots.txt` deben dar 200.

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

## C-REPARTIDOR-WEB — la app del repartidor en tumbite.com/driver (12 oct 2026)

- **Para qué:** la segunda prueba en la calle necesita al repartidor y Expo Go no abre la sesión. La app del repartidor se exporta a la web igual que la del cliente.
- **Cómo quedó:** `apps/repartidor/app.json` con `experiments.baseUrl = "/repartidor"`; script `npm run build:repartidor-web` (usa el mismo `claro.mjs` del cliente, que ahora recibe la carpeta); el Action la copia a `out-deploy/repartidor`; el servidor manda las rutas internas a `/repartidor/` con `raizDeApp()`; el semáforo exige 200 en `/app/` y `/repartidor/`.
- **Fallo encontrado al probarlo:** «Conectarme» no hacía nada si el navegador no daba la ubicación o el GPS tardaba (sin `try`, sin tope de tiempo), y la recarga automática de cada pocos segundos borraba cualquier aviso. Ahora dice «Buscando tu ubicación…», corta a los 15 segundos (usa la última ubicación conocida), muestra el error, y el error de la recarga va aparte (`errorCarga`).
- **Ojo al probar en local:** `expo export` guarda en caché la dirección del servidor; para apuntar a `localhost:8787` hay que exportar con `--clear`, si no la app local le habla a tumbite.com.
- **Prueba:** `apps/servidor/src/repartidorWeb.test.ts` (rojo comprobado) y `app.test.ts` «app del repartidor en versión web».
- **Comprobado en pantalla (local):** crear cuenta de repartidor, ver inicio, «Conectarme» sin permiso (aviso que se queda) y con ubicación (pasa a «Conectado: recibiendo pedidos»).

## C-LEGALES-TIENDAS y C-BORRADO-COMPLETO — legales para Apple y Google (12 oct 2026)

- **Qué hay:** privacidad completa, términos para clientes, restaurantes y repartidores, página pública `/delete-account` y soporte, en español e inglés (`apps/panel/src/sitio/legales.ts`). Prerenderizadas, en el sitemap, con su canónica y en el pie. Mapa de requisitos en `docs/LEGALES-TIENDAS.md`.
- **Fallo encontrado y arreglado:** borrar la cuenta dejaba la dirección, las indicaciones y la ubicación en los pedidos viejos, el texto de las calificaciones, los teléfonos de avisos y la anotación en la lista de espera. Ahora se limpian; los importes quedan sin nombre.
- **Aviso al crear cuenta** en las apps y en el panel, con enlaces a los términos que tocan.
- **Menú de 3 puntos de las apps:** «Términos y privacidad» y «Borrar mi cuenta» (va a `/delete-account`, que tiene el botón directo).
- **Prueba:** `apps/panel/src/sitio/legales.test.tsx` (rojo comprobado quitando el botón de borrar) y `cuentas.test.ts` «borrar la cuenta también limpia…» (rojo comprobado antes del arreglo).
- **No tocar:** si se cambia lo que guarda o borra el servidor, se cambia el texto de privacidad y de `/delete-account` en el mismo trabajo.

## C-SESION-APP y C-ENSAYO-CALLE — ensayo general de la prueba en la calle, en local (12 oct 2026)

Se recorrió completo en esta computadora: cliente pide → formulario de tarjeta en el carrito → aviso de pago firmado igual que Stripe → el restaurante acepta y marca listo → el repartidor conectado recibe la oferta ($7.80 con $2.80 de propina), acepta, recoge, entrega → billeteras: restaurante $12.25 y repartidor $7.80, al centavo → el cliente califica. Cómo repetirlo: servidor con `--var STRIPE_WEBHOOK_SECRET:<secreto local>` y `scratchpad/aviso.mjs` (firma con HMAC igual que Stripe); cuentas de prueba locales en `apps/servidor/.dev.vars` (fuera de git).

Fallos encontrados y arreglados:

- **La app y el panel se pisaban la sesión.** En la web comparten sitio y la app mandaba la cookie del navegador: con el panel abierto como restaurante, la app del cliente preguntaba por el pedido como restaurante y decía «Ese pedido no existe»; y cerrar sesión en el panel mataba la sesión de la app. Ahora las apps (con token) usan `credentials: 'omit'` y el panel (sin token) sigue con la cookie (`packages/compartido/src/api.ts`). Prueba en `api.test.ts` (rojo comprobado).
- **Pantallas internas sin sesión.** Si la sesión caducaba, la pantalla del pedido seguía sola. Ahora toda la app del cliente va dentro de `ConSesion` (`packages/movil/src/ConSesion.tsx`): pide entrar ahí mismo y, al entrar, sigue en la misma pantalla.
- **Una cuenta de otro papel quedaba abierta en la app** (un restaurante en la app del cliente). Al abrir la app ahora se revisa el papel.
- **La web mostraba coordenadas en vez de mapa.** Ahora Leaflet con OpenStreetMap (`apps/cliente/src/mapaWeb.ts`): seguimiento del repartidor y pin de entrega. Los mosaicos de openstreetmap.org son para poco tráfico; si la web crece, se cambia el proveedor ahí.
- **Enter en la contraseña no entraba** en las apps; ahora sí. **Los botones de propina** dicen su porcentaje al lector de pantalla.
- Pruebas: `pagoSinSalto.test.ts` («la app del cliente no funciona sin sesión», «ensayo general»), rojo comprobado.
- Los dos intentos de pago que quedaron sin pagar en Stripe durante las pruebas locales se cancelaron.

## C-RESPALDO-REAL, C-CABECERA-ANGOSTA y recorrido completo (12 oct 2026, tarde)

- **El respaldo diario automático nunca se había hecho (solo había uno manual, del 11 oct) y el canario decía «ok».** Desde el arreglo ya hay respaldo del 12 oct, comprobado en el almacén (19 tablas). Causa: GitHub no corre los horarios a la hora exacta (el reloj «cada 5 minutos» corrió 4 veces en el día) y el paso de las 08:00 UTC nunca coincidió; además el canario miraba una variable en memoria que se pierde en cada reinicio. Arreglo: el reloj pide `POST /datos/respaldo?siHaceFalta=1` en cada vuelta y el servidor lo hace solo si hoy no hay uno; el canario lee la fecha real del almacén (`fechaUltimoRespaldo`) y dice `ok` (hoy o ayer) o `atrasado`. Pruebas en `respaldo.test.ts` (rojo comprobado).
- **Las ofertas siguen repartiéndose sin el reloj** mientras haya un repartidor conectado (la app pregunta cada pocos segundos y eso reparte). El reloj solo hace falta cuando no hay nadie conectado. Si se quiere un reloj puntual de verdad, va en Cloudflare (Worker con cron); crear ese recurso necesita el sí de Richard.
- **Cabecera en celulares de 320 px:** el selector de idioma quedaba 32 px afuera. Regla `@media (max-width: 380px)` en `estilos.css`: logo más chico y nombre de la cuenta recortado. Medido en pantalla a 320 y 375: sin desplazamiento lateral. Prueba en `apps/servidor/src/cabeceraAngosta.test.ts`.
- **Recorrido completo como en la calle** en `operacion.test.ts`: pago por aviso firmado de Stripe → restaurante → oferta → recoge → entrega → billeteras iguales al desglose → calificación. Rojo comprobado rompiendo el aviso.

## C-PIE-ENLACES, C-PAISES, C-SEO-IA y «Cómo funciona» (12 oct 2026, noche)

- **Países:** 32, por región (Norteamérica, Caribe, Centroamérica, Sudamérica, Europa, África): todos los de habla hispana, Brasil y toda Sudamérica, España, Portugal, Italia, Francia, Alemania, Países Bajos, Reino Unido y Rumanía. Cada uno con su página `/pais/<slug>` y texto propio (primeras ciudades, idioma, moneda, región, franquicia y vecinos). Datos en `apps/panel/src/sitio/cobertura.ts`.
- **«Cómo funciona Tumbite»** en `/how-it-works` (`ComoFunciona.tsx`): los tres públicos, a dónde va cada dólar (cifras de la portada), franquicias y arranque en frío (25 a 50 motos, entrenamiento, kit con tablet por restaurante, primeros clientes), la rueda de la sinergia, lo que nos hace distintos, ideas («Lo que viene») y preguntas frecuentes. **El precio de la franquicia no se publica** (lo decide Richard por ciudad).
- **Mapa del sitio y `llms.txt` se generan solos** en el prerender con la misma lista de páginas (79 hoy). Se quitó `public/sitemap.xml` (estaba a mano). Datos estructurados: Organization y WebSite en la portada, FAQPage en «Cómo funciona». `robots.txt` invita por nombre a GPTBot, ClaudeBot, PerplexityBot, Google-Extended y demás.
- **Pie:** «Cómo funciona», «Franquicias por ciudad» y «Cómo abrimos una ciudad» ya llevan a la página nueva; «Pide/Reparte desde el navegador» llevan a /app y /repartidor. Prueba `Pie.test.tsx` «ningún enlace del pie lleva a una página que no existe» (rojo comprobado).
- **Auditoría (375 y 1280):** sin desplazamiento lateral, un solo h1 por página, todas las imágenes con texto alternativo. Se agrandaron los enlaces del pie y «← Volver» (eran difíciles de tocar) y el código postal ya no corta su ayuda.
- El semáforo exige 200 también en `/how-it-works` y `/llms.txt`.

## C-INGLES-SEO — cada página pública también en inglés bajo /en (12 oct 2026, noche)

- **Por qué:** Google solo veía el español (el inglés salía después de cargar). Para un producto de EE.UU. eso era perder la mitad del SEO.
- **Cómo quedó:** el prerender escribe cada página dos veces (`/pais/brasil` y `/en/pais/brasil`, 158 en total), cada una con `lang`, título, descripción y canónica propios, y las dos se señalan con `hreflang` (es, en y x-default = español). El mapa del sitio trae las dos. En la web, cambiar de idioma en una página pública lleva a la dirección de ese idioma; los enlaces internos dentro de /en se quedan en /en (`apps/panel/src/rutaIdioma.ts`, `Enlace.tsx`). El panel y las apps no llevan prefijo.
- **Prueba:** `apps/panel/src/rutaIdioma.test.tsx`. Comprobado en pantalla: Brasil en español → inglés (/en/pais/brasil, lang en, vecinos con /en) → español otra vez; el panel no cambia de dirección.

## C-TICKETS, C-SUPERADMIN y C-FRANQUICIAS (12 oct 2026, noche)

- **Tickets** (`apps/servidor/src/rutas/tickets.ts`, tablas `tickets` y `ticket_mensajes`): la lista de espera, el formulario de franquicias y las quejas abren un ticket. La persona recibe su enlace privado `/t/<código de 43 caracteres>` (no se adivina; el servidor manda `X-Robots-Tag: noindex` y `robots.txt` bloquea `/t/`); a los correos de `ADMIN_CORREOS` les llega el aviso desde no-reply con el enlace a su superadmin. Cada respuesta avisa al otro lado. Pruebas `tickets.test.ts`.
- **Superadmin**: `/panel/control-<24 hex>`; el id sale de un HMAC de `ADMIN_SEMILLA` (variable del sitio, nunca en el repo). Solo una cuenta admin recibe la dirección (`GET /datos/admin/ruta`); para cualquier otro, con o sin sesión, la página dice «no existe» y no muestra el login. El admin en `/panel` va solo a su dirección. Resumen (franquicias, vendidas, activas, interesados, tickets, motos, y por ciudad: pedidos, ventas, ganancia, restaurantes, repartidores), bandeja de tickets con respuesta y cierre, y alta/edición de franquicias.
- **Franquicias** (`rutas/franquicias.ts`, tabla `franquicias`, una por zona): el dueño entra a `/panel/franquicia-<ciudad>-<20 hex>` con su cuenta (se enlaza por correo); otra cuenta, otra ciudad en la dirección o un código distinto → no existe. Pruebas `franquicias.test.ts`.
- **En local** hay que crear las tablas nuevas a mano: `npx wrangler d1 execute DB --local --file=../../schema.sql` desde `apps/servidor` (en producción las crea la publicación).
- Comprobado en pantalla (local): formulario de franquicia → enlace privado → superadmin con la dirección secreta → bandeja → respuesta → la persona ve la respuesta en su enlace. Una dirección de control inventada dice «no existe» sin login.

## C-QUEJAS, «Mi cuenta», C-BILLETERA-REP, C-TABLERO-REST y burbuja de ayuda (12 oct 2026, noche)

- **Quejas con tickets en las tres apps:** cliente desde su pedido (`ReportarProblema` en `packages/movil`, antes era un correo a una cuenta personal), repartidor desde su pantalla (atado a la entrega activa si hay), restaurante desde los tres puntos de cada pedido (`ReportarPanel`). Van a la bandeja del superadmin y a la del franquiciado de esa ciudad. Prueba `quejasApps.test.ts`.
- **«Mi cuenta» del cliente** (`apps/cliente/src/app/cuenta.tsx`): historial de pedidos, tarjetas guardadas (`GET /datos/mis-tarjetas` y quitar con `POST /datos/mis-tarjetas/:id/quitar`, que comprueba que la tarjeta sea de ese cliente en Stripe antes de quitarla; quitar va escondido en los tres puntos y con confirmación), datos y ayuda. Prueba en `pedidos.test.ts`.
- **Billetera del repartidor** (`apps/repartidor/src/Billetera.tsx`): saldo grande, ganado, propinas y retirado del mes, y cada movimiento con su pedido; menú de tres rayas dibujadas (el símbolo ☰ cuenta como emoji y lo frena `sinEmojis.test.ts`).
- **Tablero del restaurante** (`GET /datos/restaurante/tablero`, `TableroRestaurante.tsx`): pedidos esperando, 7 y 30 días (pedidos, ventas, lo que recibe, ticket promedio), platos más vendidos, tiempo real de cocina contra el prometido y calificación. Prueba en `operacion.test.ts`.
- **Burbuja de ayuda** (`AyudaBurbuja.tsx`): respuestas al instante, algunas con sus datos reales («todavía no puedes cobrar: te falta conectar tu banco; tu saldo está guardado»), buscador y «hablar con una persona» (ticket). Sin IA hasta que Richard apruebe el tope de gasto.
- **Pruebas del servidor:** cada `mundo()` usa su propia red de mentira (el límite de intentos vive en memoria y las pruebas de un mismo archivo chocaban).
- Comprobado en pantalla (local): tablero con datos del ensayo, la burbuja respondiendo con el saldo real, la billetera del repartidor con sus movimientos y «Mi cuenta» con el historial.

## C-SUPERADMIN-ESCALA y C-KYC (12 oct 2026, noche)

- **Superadmin por ciudades** (`rutas/superadmin.ts`, `SuperFichas.tsx`): Ciudades → restaurantes, repartidores y clientes de cada una; buscador por ID, número, nombre, correo o teléfono; listas de a 50 con «cargar más» (paginación por clave, sin OFFSET); fichas completas de repartidor (datos, vehículo, licencia y seguro con vigente/vencido/por vencer, antecedentes, seguro de Tumbite, tipo, ubicación, historial, dinero, calificación, quejas), de cliente (datos, compras, gastado, quejas) y de restaurante (empresa, dueño, manager, cuenta, menú, ventas, comisión, calificación, pedidos, quejas). La ruta vieja que listaba todos los repartidores de golpe se retiró. Detalle en `docs/SUPERADMIN.md`.
- **ID del repartidor** `US-MIA-000123`: contador por ciudad con `INSERT … ON CONFLICT … RETURNING` (sin choques). Se asigna al crear su ficha, al empezar el KYC y, de a 200, al abrir el superadmin.
- **Migraciones seguras** (`esquema.ts`): `zonas.codigo_ciudad` y `repartidores.codigo` se agregan solas; índices para buscar con millones de filas.
- **Repartidor «Mis datos y vehículo»** (`MisDatos.tsx`) y **restaurante «Mi empresa»** (`MiEmpresa.tsx`), los dos con borrador.
- **KYC** (`rutas/kyc.ts`, `Verificacion.tsx` en la app, `VerificacionPanel.tsx` en el panel, `SuperKyc.tsx`): fotos a `kyc/<usuario>/` (la carpeta pública solo sirve `fotos/`; prueba que `/media/kyc/…` da 404), vistas solo por el admin sin caché, rechazo con motivo por correo, aprobación con revisión anual para restaurantes, foto del local con distancia a la dirección. Interruptor `KYC_OBLIGATORIO` apagado hasta que Richard lo decida. Borrar la cuenta borra las fotos y los datos. Pruebas `kyc.test.ts`, `superadmin.test.ts`.
- **Privacidad** actualizada (vehículo, licencia, seguro, verificación de identidad, sin plantillas biométricas, se borra con la cuenta).

## C-MANAGER-1: ningún pedido pagado se queda olvidado (12 oct 2026, noche)

- **Qué se arregló:** un pedido pagado podía quedarse para siempre esperando al restaurante, con el dinero del cliente cobrado y sin nadie que se diera cuenta. El cliente tampoco podía arrepentirse, aunque los términos lo prometen.
- **Pieza única de cancelación** (`apps/servidor/src/manager.ts`, `cancelarConReembolso`): primero aparta el pedido (nadie más lo acepta), después pide la devolución a Stripe con llave de idempotencia `reembolso-<pedido>`, y si Stripe falla lo deja como estaba y devuelve error. **Nunca queda un pedido cancelado con el dinero sin devolver.** La usan el rechazo del restaurante, la cancelación del cliente (`POST /datos/pedidos/:id/cancelar`, solo en `pago_pendiente` o `pagado` y solo su dueño) y el Manager.
- **Manager con reglas, sin IA ni costo** (`vigilarPedidos`): a los 3 y 6 minutos sin aceptar, aviso al celular del restaurante (una sola vez cada uno); a los 10, cancela y devuelve el dinero y avisa a los dos; si un pedido aceptado lleva 15 minutos sin repartidor, correo a `ADMIN_CORREOS` una sola vez. Los tiempos están en `REGLAS`. Corre en el reloj (`/datos/reloj`) y también en el seguimiento del cliente, que pregunta cada 5 segundos: así no depende de que GitHub sea puntual.
- **Bitácora** (tabla `bitacora_pedidos`, un evento por pedido y tipo con `UNIQUE`, que es lo que impide repetir avisos): se ve en el superadmin en `/<dirección secreta>/pedidos/<id>` (`SuperPedido.tsx`, ruta `GET /datos/admin/pedidos/:id`), con estados, quién, hora y lo que hizo el Manager. Se llega desde las compras del cliente y los últimos pedidos del restaurante.
- **App del cliente:** «Cancelar el pedido» en el seguimiento, con confirmación, solo antes de que acepten.
- **Pruebas (comprobadas en rojo):** `operacion.test.ts` bloque C-MANAGER-1 (cancelar, no cancelar ajeno ni aceptado, Stripe caído no cancela, recordatorios una vez, cancelación a los 10 con una sola devolución, seguimiento dispara la regla, alerta sin repartidor una vez, bitácora solo admin), `cancelarApp.test.ts`, `SuperPedido.test.tsx`.
- **No tocar:** el orden «apartar → devolver → si falla, volver atrás». Al revés, una carrera dejaba el dinero devuelto y el pedido aceptado.
- **Sin probar con Stripe real:** anotado en rojo en `VERIFICAR-PAGOS.md`.

### Datos de relleno en producción (12 oct 2026)

Cuatro ciudades con código (MIA, NOV, ORL, TPA; Orlando y Tampa creadas inactivas y con «(pruebas)» en el nombre), seis repartidores y cinco clientes por ciudad, todos con correo `prueba.<rep|cli>.<ciudad>.<n>@ejemplo.com` y «(prueba)» en el nombre. Para borrarlos antes del lanzamiento abierto (con el sí de Richard): primero sus filas en `repartidores`, `repartidor_datos`, `sesiones` y `pedidos`, después `DELETE FROM usuarios WHERE correo LIKE 'prueba.%@ejemplo.com'`, y por último las zonas `US-FL-ORLANDO` y `US-FL-TAMPA` si siguen sin restaurantes reales.

### C-MANAGER-1, segunda parte: semáforo, pedidos en curso y KYC en las fichas (12 oct 2026, noche)

- **Semáforo** (`packages/compartido/src/semaforo.ts`, `semaforoPedido`): una sola pieza que usan el servidor y el panel. Sin aceptar: amarillo a los 3 min, rojo a los 6 (a los 10 el Manager cancela). En cocina: amarillo al pasar el tiempo prometido, rojo 10 min después. Lista sin repartidor: amarillo a los 5, rojo a los 15. En camino: amarillo a los 30, rojo a los 45. Las fechas de la base son UTC sin zona (`fechaBase`). Se muestra con `LuzSemaforo.tsx` (punto de color, minutos u horas, y el porqué si no va bien).
- **Dónde se ve:** en la lista de pedidos del restaurante y en el superadmin «Pedidos en curso» (`GET /datos/admin/pedidos?zona=`, hasta 300 pedidos vivos, rojos primero, se refresca cada 15 s, cada uno enlaza a su bitácora).
- **KYC en las fichas:** la ficha del repartidor y la del restaurante (el KYC es del dueño) traen `kyc` con el estado; si hay fotos, enlace a la revisión.
- **Pruebas (comprobadas en rojo):** `semaforo.test.ts`, `operacion.test.ts` (pedidos en curso solo admin y ordenados, KYC en la ficha), `SuperPedido.test.tsx` (tablero y semáforo del restaurante), `SuperFichas.test.tsx` (estado y enlace del KYC).
- **No tocar:** las reglas del semáforo y las de `REGLAS` en `manager.ts` van juntas; si se cambia una, se cambia la otra.

## C-DOCS-PUBLICOS y C-TIENDAS-PERMISOS (12 oct 2026, noche)

- **Regla de Richard:** todo lo nuevo se explica al público en Docs, en español e inglés, con capturas y sin nada técnico ni privado. Las guías aceptan `explicacion` (párrafos de «Cómo funciona») y `capturas` (imagen + texto alternativo + pie), en `apps/panel/src/sitio/docs/guias.ts`; las imágenes van en `apps/panel/public/docs/<nombre>-<es|en>.webp`.
- **Guías nuevas:** sección «Cómo cuidamos cada pedido» (`/docs/confianza/…`: el Manager, el semáforo, restaurantes y repartidores verificados), «Cancelar un pedido» para clientes y «Verificar tu restaurante» / «Verificar tu identidad». Corregidas las viejas: el pago ya no salta a otra página; los pedidos del restaurante tienen semáforo y se cancelan solos a los 10 minutos.
- **Prueba `guiasPublicas.test.tsx`** (comprobada en rojo borrando una captura): mismas guías en los dos idiomas, las nuevas publicadas, ninguna palabra interna (superadmin, rutas internas, variables), cada captura con su archivo, su texto alternativo y su idioma.
- **Verificación del restaurante:** los botones de subir foto eran los del navegador (salían en el idioma de la computadora, en español sobre la página en inglés). Ahora es un botón propio «Tomar foto / Take photo».
- **Permisos de las apps** (`tiendasPermisos.test.ts`, comprobada en rojo): fuera los textos genéricos de Face ID, ubicación siempre, movimiento y micrófono; fuera almacenamiento y grabación en Android; cámara del repartidor con su motivo; textos de permisos en español (`apps/<app>/idiomas/es.json`). Detalle en `docs/TIENDAS.md`.

## C-INGLES-PRINCIPAL: el inglés es el idioma principal y todas las direcciones van en inglés (13 oct 2026)

- **Qué estaba mal:** el sitio salía en español por defecto, el inglés vivía bajo `/en`, y las direcciones estaban en español (`/privacidad`, `/terminos-restaurantes`, `/borrar-cuenta`, `/pais/brasil`, `/docs/comensales/…`, `/panel/pedidos`, `/repartidor`). Eso es lo que íbamos a dar a Apple y Google. Richard: «estás haciendo una página web en los Estados Unidos… todo va en inglés como idioma principal».
- **Cómo quedó:** sin prefijo = inglés; `/es/…` = la misma página en español (`apps/panel/src/rutaIdioma.ts`). Mapa único de direcciones en `packages/compartido/src/rutasPublicas.ts` (`PAGINAS`, `direccionNueva`, `panelNuevo`, `enIdiomaDireccion`). Países, comidas, Docs, panel, anclas de la portada, la app web del cliente (`/app/order/…`, `/app/cart`, `/app/account`, `/app/restaurant/…`) y la del repartidor (`/driver`) en inglés. La dirección privada del franquiciado empieza con `franchise-` (la vieja `franquicia-` sigue valiendo).
- **Redirecciones 301 en el servidor** (`apps/servidor/src/app.ts`, primer `app.use`): dirección vieja en español sin prefijo → `/es/<nueva>` (era la página en español); `/en/<lo que sea>` → `/<nueva>`; `/panel/<viejo>` → `/panel/<nuevo>`; `/repartidor/…` → `/driver/…`. Conservan los parámetros (los enlaces de confirmar correo y recuperar clave traen el código después del «?»). Solo GET y HEAD.
- **Correos:** confirmar correo y recuperar clave llevan a la página en el idioma de la persona; el recibo lleva a `/app/order/<id>` (antes llevaba a `/pedido/<id>`, que no existía y caía en la portada).
- **Apps:** los enlaces a términos, privacidad, Docs y borrar cuenta abren la versión en el idioma de la app.
- **Legales:** privacidad y los tres términos dicen arriba que rige el inglés y que el español es traducción de cortesía (`idiomaQueRige` en `legales.ts`).
- **Prerender:** inglés primero; `hreflang` en/es y `x-default` = inglés; `llms.txt` en inglés; base `index.html` con `lang="en"`.
- **Quien eligió español** en el selector vuelve solo a `/es/…` al entrar sin prefijo.
- **Pruebas (comprobadas en rojo):** `rutasPublicas.test.ts`, `rutaIdioma.test.tsx`, `app.test.ts` bloque C-INGLES-PRINCIPAL (cada dirección vieja con su 301 y lo nuevo sin redirigir), Landing, Pie y Docs con las direcciones nuevas.
- **No tocar:** las rutas internas de la API bajo `/datos` siguen como estaban (no se ven en el navegador y las apps ya las usan). La regla de nombres «Soporte» para nuestras cuentas tampoco cambia.

### C-INGLES-PRINCIPAL, segunda parte: nada solo en español dentro de las pantallas (13 oct 2026)

- **Mensajes del servidor:** se escriben en español en el código y salen en inglés cuando la app o el panel lo piden (cabecera `x-idioma`, que ahora manda el cliente de la API en cada petición; sin cabecera manda `accept-language` y, si no, inglés). Tabla en `apps/servidor/src/mensajesEn.ts`; la traducción se hace en `app.onError`, en el 404 de `/datos` y en el límite de intentos. **Prueba `mensajesEn.test.ts`** (comprobada en rojo): busca cada `new ErrorDatos('…')` y cada mensaje de validación y falla si alguno no tiene su inglés.
- **Idioma por defecto = inglés:** `IDIOMA_POR_DEFECTO` en compartido, el registro (`esquemaRegistro`), el panel (español solo si el navegador está en español) y las apps (idioma del teléfono; si no es español, inglés).
- **Páginas de países en inglés:** ciudades con su nombre en inglés (Berlin, Mexico City, The Hague…) y «the» delante de los países que lo llevan (`ciudadEnIdioma`, `paisEnFrase` en `cobertura.ts`).
- **Candado en la publicación:** `scripts/prerender.mjs` detiene el build si una página en inglés trae una frase en español (comprobado en rojo).
- **Conversaciones privadas `/t/…`:** salen en el idioma que la persona eligió (antes siempre en inglés).
- **Docs nuevas:** tablero del restaurante, «Mi cuenta» del cliente, billetera del repartidor, ayuda con enlace privado y franquicias (sección «Para emprendedores»), con capturas en los dos idiomas.

## C-PAGO-SIN-ESPERA-ETERNA, C-VERDE-EXITO y lo que salió del recorrido completo (13 oct 2026)

- **Pago sin espera eterna:** `PagoTarjeta.web.tsx` tiene tope de 20 s (si Stripe no aparece ni da error, se dice en pantalla y hay «Intentar de nuevo», que recarga Stripe desde cero); `loadStripe(...).catch` para cuando el script no carga; la vuelta del banco va a `/app/order/<id>`. `PagoTarjeta.tsx` (celular): `initStripe` dentro de `try`, tope de 20 s y el botón deja de girar si hay error. Prueba en `pagoSinSalto.test.ts` (comprobada en rojo).
- **Stripe simulado para ensayar:** `usarStripeLocal` en `stripe.ts`, solo acepta `http://localhost` o `127.0.0.1`; cualquier otra dirección se ignora (prueba en `app.test.ts`). En producción no existe la variable.
- **Verde para el éxito:** `MARCA.colores.exito` (#0D7A3A). Barra del seguimiento en verde, «Entregado» en verde en «Mi cuenta», insignias «respondido/cerrado» verdes, la insignia neutra ahora es gris (antes rojiza), franquicia activa en verde, verificación del repartidor en gris mientras espera. Prueba `colorExito.test.ts`.
- **Categoría del plato en inglés:** columna `platos.categoria_en` (migración segura en `esquema.ts`), casilla nueva en el menú del panel, la app muestra la del idioma (`categoriaPlato`).
- **Motivo de la cancelación** en el seguimiento (`motivoCancelacion`: cliente, restaurante o sin respuesta) y la app lo dice en palabras.
- **Pedidos abandonados:** el Manager (solo en el reloj) anula en Stripe el cobro de los pedidos sin pagar de más de 2 horas y los cierra (`abandonado_sin_pagar` en la bitácora). Si Stripe no deja anular (porque sí se pagó), no se tocan. Prueba en `operacion.test.ts` (comprobada en rojo).
- **Direcciones viejas de la app web** (`/app/pedido`, `/app/restaurante`, `/app/carrito`, `/app/cuenta`) redirigen con 301 a las nuevas.
- **Capturas originales** en `docs/capturas/` (PNG); las de Docs en `apps/panel/public/docs/` (WebP).

### Capturas en las guías que eran solo texto (13 oct 2026)

- Guías con capturas nuevas en los dos idiomas: primer pedido (menú y carrito), seguir el pedido, calificar, menú y agotado del restaurante, recibir pedidos, ofertas y niveles del repartidor. Originales en `docs/capturas/` (34 en total).
- Arreglos que salieron al sacarlas: el plato ya agregado al carrito se marca en verde (antes rojo); el repartidor tiene una **barra verde de avance** a su siguiente nivel (`nivelDe(...).avance`, de 0 a 1; pruebas en `niveles.test.ts` y `colorExito.test.ts`); la tarjeta «Conectado» usa el verde de la marca; las guías ahora dicen los botones reales («Ya lo recogí», «Cómo llegar», la tarjeta «Tu nivel») y la categoría del plato en los dos idiomas.

## Capturas en las últimas guías de texto, regalo aplicado en verde y correo de muestra en inglés (13 oct 2026)

- **Qué se rompía:** el regalo ya aplicado en el carrito salía en rojo (borde `C.acento`), y en inglés las casillas de correo mostraban «correo@ejemplo.com» (nueve formularios: entrar, registro de las apps, olvidé, configuración, mi empresa, lista de espera, franquicias y superadmin). La guía de beneficios decía «Conectar mi banco» y «tu neto», que no existen en la pantalla.
- **Arreglo:** el regalo aplicado lleva borde y monto en `C.exito` con fondo verde suave; el correo de muestra sale de `correoEjemplo(idioma)` en `packages/compartido/src/idiomas.ts`; las guías usan las palabras exactas de la pantalla («Conectar mi cuenta bancaria», «Te toca» / «Your payout», «Volver a mandar el enlace»).
- **Candados:** `colorExito.test.ts` (el plato en el carrito y el regalo aplicado en verde) y `correoEjemplo.test.ts` (nadie escribe «correo@ejemplo.com» a mano en las apps ni en el panel). Los dos comprobados en rojo.
- **Capturas nuevas** (originales en `docs/capturas/`, web en `apps/panel/public/docs/`, español e inglés): mi-restaurante, regalos-restaurante, billetera-restaurante, regalo-carrito, registro-repartidor, olvide-clave, cambiar-clave, correo-estado, borrar-cuenta. Para el estado del correo, el correo de prueba local se cambió solo en pantalla por uno neutro antes de capturar.
- **No tocar:** el correo de muestra nunca se escribe a mano; siempre `correoEjemplo(idioma)`.

## Las dos últimas guías con captura: el Manager y la verificación (13 oct 2026)

- El Manager lleva la captura nueva del pedido que canceló solo porque el restaurante no confirmó a tiempo (`manager-cancela-es/en`, sacada de un pedido local cancelado por el Manager), más la del semáforo del restaurante. La verificación reutiliza las capturas del restaurante y del repartidor.
- Con esto ninguna guía pública de Docs queda solo con texto.

## C-SEMAFORO-PACIENCIA: la publicación ya no se frena sola cuando pruebas tarda (13 oct 2026)

- **Qué pasaba:** dos veces el mismo día, el sitio de pruebas tardó más de 12 minutos en servir la versión nueva; el semáforo daba rojo y producción no se publicaba hasta repetir a mano (al repetir, pruebas ya la servía en dos minutos).
- **Arreglo:** `scripts/semaforo.sh` espera hasta 25 minutos (100 vueltas de 15 s) y en la vuelta 32 (8 minutos) da un empujón: un commit vacío en `yapanel-pruebas`, hecho en un worktree aparte para no tocar `out-deploy` ni la rama de trabajo. Si el empujón falla, deja un aviso y sigue esperando. El paso del flujo tiene `timeout-minutes: 30`.
- **Se comprobó** con un repositorio de prueba local: el commit vacío llegó a la rama y la carpeta de trabajo quedó intacta.
- **Candado:** `apps/servidor/src/semaforoPublicacion.test.ts`, comprobado en rojo. Las rutas críticas y el chequeo del prerender no cambiaron: el semáforo sigue frenando si algo responde mal.
- **Además (mismo día):** dos publicaciones arrancaron a la vez y una falló al empujar la rama de pruebas («cannot lock ref»). `publicar.yml` lleva `concurrency: publicar` sin cancelar: la segunda espera a la primera. Lo vigila la misma prueba.

## Revisión de las pantallas en inglés (13 oct 2026)

- **Cómo se revisó:** las apps del cliente, del repartidor y del restaurante y el panel del restaurante, en inglés, con un detector de frases en español sobre el texto de cada pantalla (comprobado que sí detecta), más un barrido del código que ignora los diccionarios en español y los textos con su versión en inglés al lado. El panel de administración y el de franquicias se cubrieron con el barrido del código.
- **Qué salió en español y se arregló:** «La fecha debe ser AAAA-MM-DD.» al registrarse (y otros cuatro mensajes del servidor sin traducción: token de avisos, firma, nombre del restaurante y celular). La prueba `mensajesEn.test.ts` no los veía porque solo reconocía mensajes escritos con `message:` y su detector de español no miraba mayúsculas; ahora reconoce `error:` y no distingue mayúsculas. Comprobado en rojo: con la regla nueva salieron justo esos cinco.
- **Inglés de EE.UU.:** «canceled» con una sola ele en todo el texto (la dirección vieja `/payment/cancelled` se queda: ya circuló). Lo vigila `correoEjemplo.test.ts`, comprobado en rojo. Las capturas de Docs con la palabra se volvieron a tomar.

## Revisión de las pantallas en español (13 oct 2026)

- **Pantallas:** apps del cliente, del repartidor y del restaurante, y el panel del restaurante con la burbuja de ayuda, en español, con un detector de frases en inglés (comprobado que detecta). Limpias. Barrido del código: ninguna fecha con formato fijo en inglés y ningún texto o etiqueta escrito a mano en inglés.
- **C-BORRADOR-EMPEZAR:** dos formularios de las apps («Mis datos y vehículo» y «Tengo un problema») avisaban «Recuperamos lo que estabas escribiendo» sin «Empezar de nuevo». Ahora las apps usan una sola pieza, `AvisoBorrador` de `packages/movil`, también en entrar y crear cuenta. Candado: `apps/servidor/src/avisoBorrador.test.ts` (en rojo comprobado).
- **«Empezar de nuevo» ya no vacía el formulario:** antes volvía a los valores iniciales en blanco aunque el formulario tuviera datos guardados en el servidor (se podían guardar casillas vacías encima). Ahora tira solo el borrador y vuelve a lo guardado. Prueba nueva en `borrador.test.tsx` (en rojo comprobado). Comprobado en pantalla en «Mis datos y vehículo».
- **C-TITULO-IDIOMA:** al navegar dentro del sitio y del panel, la pestaña se quedaba con el título de la portada en inglés. Ahora `tituloPagina` (misma regla del prerender) la pone según la página y el idioma. Prueba: `tituloPagina.test.tsx`.
- **Nota del semáforo (mismo día, 15:10–15:45):** el sitio de pruebas tardó unos 45 minutos en tomar una versión, aun con el empujón; el semáforo dio rojo a los 25 y al repetirlo pasó en 15 segundos. Producción nunca recibió nada sin probar. Si se repite seguido, el problema es de la plataforma (republicación de la rama de pruebas), no del código.

## C-RECORRIDO: el recorrido completo en el navegador y «¿Cómo hago…?» (13 oct 2026)

- **Qué es:** `npm run recorrido` arma Tumbite como en producción en esta computadora y recorre un pedido completo en inglés y en español (detalle en `docs/RECORRIDO.md`). Corre en cada publicación (paso «Recorrido completo de un pedido» de la revisión de GitHub); si falla, no se publica y quedan los rastros para ver qué pasó.
- **Comprobado en rojo:** con la firma del aviso de Stripe rota, la prueba falla enseguida.
- **Lo que destapó y se arregló en el camino:** nada roto en el producto; sí en la prueba: la oferta se iba a un repartidor de una corrida anterior (ahora la base sale nueva y el repartidor se desconecta al terminar) y las fotos se tomaban antes de que la pantalla cambiara (ahora espera cada cambio).
- **Capturas de Docs:** `npm run recorrido:capturas` las rehace con datos limpios. Las guías de pedir, seguir, calificar, empezar como restaurante, menú, pedidos, empezar a repartir, ofertas, el pedido de punta a punta y la guía nueva «Crear tu cuenta» las usan.
- **«¿Cómo hago…?»:** cada guía lleva sus preguntas (`preguntas` en `guias.ts`), hay una página que las junta con su enlace (`/docs/how-to` y `/es/docs/how-to`), el buscador de Docs encuentra por pregunta, cada guía muestra al final las preguntas que responde y la burbuja de ayuda del panel lleva ahí. Candados en `guiasPublicas.test.tsx` y `Docs.test.tsx` (en rojo comprobado).
- **No tocar:** si se cambia el texto de un botón que usa el recorrido, se cambia también en `e2e/recorrido/textos.ts` en el mismo trabajo.

## Los otros caminos en el recorrido y C-UBICACION-NO-FRENA (13 oct 2026)

- **Caminos nuevos en el recorrido:** regalo de cumpleaños, el cliente cancela, el restaurante rechaza y el Manager cancela solo, con sus capturas en las guías de regalos, cancelar, pedidos, el Manager y el semáforo (detalle en `docs/RECORRIDO.md`).
- **Fallo real que destapó (C-UBICACION-NO-FRENA):** la portada del cliente esperaba la ubicación antes de pedir los restaurantes; si el teléfono o el navegador no contestaban, la lista no salía nunca y tampoco decía nada. Ahora la lista sale enseguida y se reordena por cercanía cuando llega la ubicación, que además tiene un tope de 8 segundos (`conLimite` en `packages/compartido/src/limite.ts`). Candados: `ubicacionNoFrena.test.ts` y `limite.test.ts` (en rojo comprobado) y el propio recorrido, que fallaba una de cada pocas corridas y pasó cinco seguidas con el arreglo.
- **Detalle de pantalla:** el aviso «Guardado» quedaba pegado al botón de guardar en los formularios del panel; ahora lleva aire (`.ok + .boton`).

## El dinero de cada uno en el recorrido y C-BILLETERA-MENSAJES (13 oct 2026)

- **Recorrido:** beneficios del restaurante (lo que le toca = su venta entregada), billetera del repartidor con conectar el banco y retirar (saldo en cero al final) y una oferta rechazada que no se le asigna. Capturas en las guías de beneficios y de billetera.
- **Fallo real que destapó (C-BILLETERA-MENSAJES):** en la billetera del repartidor, «Retirar a mi banco» no mostraba ni la confirmación ni el error; solo salían en la pantalla de inicio. Ahora salen en la misma billetera. Candado: `billeteraMensajes.test.ts` (en rojo comprobado).
- **Detalles:** la fecha de los movimientos del restaurante salía con segundos («10/13/2026, 7:26:33 PM»); ahora sale como en la billetera del repartidor («13 oct, 19:28»). El ejemplo de dinero de la guía «Un pedido de punta a punta» venía de un plan anterior; ahora cuenta lo que pasa en la prueba con el plan Inicial (restaurante 17.11, repartidor 8.70, Tumbite 0.37).
- **Para que la segunda corrida no se trabe:** al final de cada corrida no queda ningún pedido aceptado sin repartidor (si quedaba, la oferta le llegaba al repartidor de la corrida siguiente).

## C-EQUILIBRIO: ningún pedido deja pérdida a Tumbite (13 oct 2026)

- **Qué pasaba:** con envío desde 2,99 y servicio mínimo de 0,99, el pedido normal de la prueba (18,50 de comida, plan Inicial) dejaba a Tumbite en −0,69 después del cobro de Stripe (2,9 % + 30 centavos), porque Tumbite completa el pago mínimo de 5 dólares del repartidor. 307 combinaciones de pedido quedaban en pérdida.
- **Arreglo (decidido por Richard: punto de equilibrio y competir):** envío desde 3,99 y servicio con mínimo de 1,99 en `CONFIG_DINERO_INICIAL`. Comisiones al restaurante y pago al repartidor sin cambios. Producción se actualiza sola al arrancar con `preciosDeFabrica` en `apps/servidor/src/esquema.ts`, que solo cambia la configuración guardada si era exactamente la de fábrica anterior (`CONFIG_DINERO_ANTERIOR`).
- **Candados:** `packages/compartido/src/equilibrio.test.ts` (recorre pedidos de 10 a 150 dólares, distancias, propinas y planes, más el regalo que cubre todo el plato; en rojo comprobado: 307 pérdidas con los precios viejos) y la prueba de la actualización segura en `esquema.test.ts` (en rojo comprobado).
- **Números, competencia y fuentes:** `docs/MODELO-DE-DINERO.md`. Guía pública nueva «Tumbite comparado con otras apps» (sección «Cómo cuidamos cada pedido»), solo con datos de las páginas oficiales de DoorDash y Uber Eats y la fecha de consulta.
- **No tocar:** si alguien baja el envío o el servicio desde el superadmin, el candado no lo ve (vigila la fábrica); antes de bajar precios se corre la cuenta de `docs/MODELO-DE-DINERO.md`.

## C-EJEMPLOS-AL-DIA y C-COMPARA-REST (13 oct 2026)

- **Precios viejos que quedaban publicados:** la página «Cómo funciona» decía que el repartidor recibía 6,99 en un pedido de 30 dólares (estaba mal ya antes: con el mínimo garantizado recibe 9,00) y que Tumbite recibía 3,24. Ahora muestra lo que calcula la app con los precios vigentes (cliente 39,98; restaurante 27,75; repartidor 9,00; Tumbite 3,23). También se pusieron al día `docs/REQUISITOS.md` y el plan de la prueba en la calle.
- **Candado C-EJEMPLOS-AL-DIA:** `apps/servidor/src/ejemplosDinero.test.ts` recalcula los ejemplos de «Cómo funciona» y de «Un pedido de punta a punta» con la calculadora y los precios de fábrica; si cambian los precios y un ejemplo queda viejo, se pone en rojo (comprobado).
- **Calculadora en Beneficios (C-COMPARA-REST):** el restaurante ve, con sus ventas entregadas de los últimos 30 días (o con 1.000 dólares de ejemplo si todavía no vendió), cuánto le queda con Tumbite y con DoorDash y Uber Eats en el plan equivalente. Las comisiones de la competencia viven en un solo lugar (`COMPETENCIA` en `packages/compartido/src/competencia.ts`, con la fecha de consulta). El servidor agrega `mes` y `plan` al resumen del restaurante. Pruebas: `competencia.test.ts`, `operacion.test.ts` y el recorrido (revisa el recuadro en los dos idiomas).
- **No tocar:** si DoorDash o Uber Eats cambian sus comisiones, se cambia `COMPETENCIA` y la guía pública «compare» en el mismo trabajo, con la fecha nueva.

## C-CALCULADORA: la calculadora pública (13 oct 2026)

- **Qué es:** la página «Calculadora» del sitio (inglés en «/calculator», español en «/es/calculator») con cuatro pestañas: restaurante, repartidor, cliente y franquicia. La pestaña va en el «#» de la dirección para poder compartirla.
- **De dónde salen los números:** `packages/compartido/src/calculadora.ts` usa la misma `calcularPedido` de la app y `COMPETENCIA` de `competencia.ts`; los supuestos del mercado con su fuente están en `SUPUESTOS_MERCADO` y en `docs/MODELO-DE-DINERO.md`. Si cambian los precios en la app, la calculadora cambia sola.
- **Candados:** `calculadora.test.ts` (las cuentas: con 10.000 de ventas quedan 9.250 / 8.500 / 8.000; ciudad de ejemplo de 10.000 habitantes) y `apps/panel/src/sitio/Calculadora.test.tsx` (la página abre en las dos lenguas, tiene cuatro pestañas y cambia de pestaña; comprobado en rojo quitando la ruta). `Pie.test.tsx` exige que el enlace del pie lleve a una página que existe.
- **Qué NO tocar:** el aviso de que son proyecciones y no promesas, la línea de que la parte del franquiciado se acuerda por contrato, y las fuentes al pie de la página.

## C-CAPTURAS-TIENDAS: las capturas de la App Store y Google Play salen solas (14 oct 2026)

- **Qué es:** `npm run recorrido:tiendas` corre el recorrido completo dos veces (Apple y Google, inglés y español) con `TIENDA=apple|google` y guarda cada foto al tamaño exacto de la tienda en `capturas-tiendas/<app>/<tienda>/<idioma>/<Celular|Tableta>/NN-que-pantalla-es.png` (fuera de git; nota para Richard en `capturas-tiendas/LEEME.txt`).
- **Cómo funciona:** los tamaños están en `PANTALLAS` y el nombre de cada foto en `PARA_TIENDA` (`e2e/recorrido/recorrido.spec.ts`). En ese modo el inicio suma tres restaurantes de prueba locales, la app del restaurante se arma para web en «/restaurant» (`build:restaurante-web`, solo en la base local) y no se tocan las capturas de Docs.
- **Comprobado:** 76 capturas, las dos corridas en verde; Apple 1320 × 2868 y 2752 × 2064, Google 1080 × 1920 y 1920 × 1080. El recorrido normal sigue pasando.
- **Qué NO tocar:** el lado de Google no puede pasar del doble del otro (por eso 1080 × 1920 y no 1080 × 2400); el iPad va acostado.

## C-RECOGIDA-FOTO y C-ENTREGA-EN-PUERTA: el pedido sale con foto confirmada y se entrega en la puerta (14 oct 2026)

- **Qué se pidió (Richard):** que nadie se lleve una bolsa sin rastro ni marque «entregado» desde otro lado. Antes había un «Ya lo recogí» sin foto y «Entregado» funcionaba desde cualquier lugar.
- **Cómo funciona:** tabla `evidencias` (`schema.sql`). El repartidor, con el pedido «listo», sube la foto en `POST /datos/repartidor/pedidos/:id/foto-recogida?lat&lng` (a menos de 200 m del restaurante, `RADIO_LLEGADA_M` en `packages/compartido/src/llegada.ts`). El pedido sigue «listo» hasta que el restaurante toca «Confirmar: se lo entregué al repartidor» (`POST /datos/restaurante/pedidos/:id/confirmar-recogida`); ahí pasa a «en camino» y se avisa al cliente. «Entregado» (`POST /datos/repartidor/pedidos/:id/entregado?lat&lng`) exige la foto y estar a menos de 200 m de la dirección. Las fotos se ven en `GET /datos/pedidos/:id/evidencia/:tipo` solo con la sesión del cliente, el restaurante, el repartidor o el equipo.
- **En pantalla:** repartidor, «Aceptar», «Tomar foto del pedido», «Cómo llegar» y «Tomar foto de la entrega» en verde; «Cómo llegar» se quita al llegar a la puerta y aparece la foto de la entrega con la advertencia de no fotografiar caras. Restaurante (panel y app): la foto con el botón verde de confirmar. Cliente: la foto del pedido cerrado en camino y la de la entrega.
- **Revisores de las tiendas:** los correos en `CORREOS_REVISOR` no tienen la regla de distancia (prueban desde otra ciudad); la foto sí.
- **Candados:** `operacion.test.ts` («recogida con foto y entrega en la puerta»: sin foto no se suelta, lejos no vale, sin ubicación no vale, el extraño no ve la foto, lejos de la casa no se entrega ni se acredita dinero, el revisor sí con foto), comprobados en rojo quitando la regla de distancia y la exigencia de la foto; `llegada.test.ts`; y el recorrido completo en el navegador (foto, confirmación, «Cómo llegar» verde lejos, llegada a la casa y foto de la entrega).
- **Qué NO tocar:** no volver a un «Ya lo recogí» sin foto ni a un «Entregado» sin distancia; no bajar el radio de 200 m sin probar en la calle (el GPS se equivoca en edificios).

## Etapa 2½: el ciclo del pedido como lo hacen los grandes (14 oct 2026)

Sale de `docs/COMPARACION-CICLO-PEDIDO.md`. Todo con su prueba comprobada en rojo donde se indica.

- **C-DESPACHO-RELOJ:** la oferta sale cuando «viaje del repartidor + 3 min» alcanza lo que falta para la hora de listo (`packages/compartido/src/despacho.ts`, `debeOfrecer`); «Listo» antes de tiempo la saca al instante. La oferta y el pedido activo llevan `minutosParaListo`. Pruebas: `despacho.test.ts` y «despacho con reloj» en `operacion.test.ts` (rojo comprobado quitando la regla). Las pruebas que esperan la oferta al instante aceptan con 5 minutos.
- **C-LLEGADAS:** tabla `hitos_pedido`. Con cada ubicación del repartidor (`POST /datos/repartidor/ubicacion`, y la foto de recogida) el servidor marca `llego_restaurante` (200 m), `casi_llega` (500 m de la casa, aviso al cliente) y `llego_cliente` (200 m, aviso al cliente). Prueba «el restaurante ve venir al repartidor» en `operacion.test.ts`.
- **C-MOSTRADOR:** `/datos/restaurante/pedidos` devuelve `repartidor` (nombre, `minutosParaLlegar`, `llego`, `esperandoDesde` = lo más tarde entre su llegada y la hora de listo prometida, `esperaEvitableSeg` guardado al salir, `verificado`). Textos y amarillo en `packages/compartido/src/mostrador.ts` (`lineaRepartidor`, `fotoSinConfirmar` a los 2 minutos, `avisoLlegada` a 5 min y al llegar) con `mostrador.test.ts`. Panel y app del restaurante: línea verde, amarillo con alarma, sonido corto una vez por pedido.
- **C-QR:** el QR (`tumbite:pedido:<id>`) y el número de 4 caracteres salen junto al pedido listo (panel con `qrcode`, app con `CodigoQR` dibujado con cuadritos). `POST /datos/repartidor/pedidos/:id/verificar` acepta el id, el texto del QR o los 4 caracteres; con código + foto (en cualquier orden) el pedido sale solo (`salirEnCamino`); sin código, el restaurante confirma. Pruebas «código QR…» en `operacion.test.ts`.
- **Entrega en mano / lugar seguro:** `preferencias_entrega` (puerta o mano, se elige en el carrito). `POST …/entregado` acepta foto (puerta o `?modo=seguro&nota=`) o JSON `{lat,lng,modo:'mano'}`; siempre a menos de 200 m. «No aparece» (`POST …/no-aparece`) solo en la puerta, avisa al cliente y abre 5 minutos; después, lugar seguro con foto y nota obligatoria. `evidencias.modo/nota`; el cliente ve `entregadoComo` y `notaEntrega`.
- **C-CHAT:** `mensajes_pedido`; `GET/POST /datos/pedidos/:id/mensajes` solo cliente, repartidor (y equipo); cerrado al terminar; aviso al celular del otro. Pieza `ChatPedido` en `packages/movil`.
- **C-SOLTAR y C-PERDIDO:** `POST …/soltar` antes de recoger (vuelve a la fila, el que soltó no lo vuelve a ver; ya recogido no se puede). El Manager reasigna un pedido cuyo repartidor lleva 10 minutos sin ubicación y no llegó (`REGLAS.repartidorPerdido`), con correo al equipo.
- **Avisos nuevos al cliente:** repartidor asignado (nombre y vehículo), comida lista, casi llega, en tu puerta, no te encuentra, mensaje del chat. «Llega a más tardar» = aceptó + preparación + viaje + 10 min (`llegaAMasTardar` en el seguimiento).
- **Qué NO tocar:** no volver a ofrecer al aceptar sin reloj; no permitir «entregado» lejos; no abrir el chat a cuentas ajenas; no bajar la espera de 5 minutos del protocolo sin decidirlo con Richard.
- **C-AGOTADO (14 oct):** tabla `ajustes_pedido`. `POST /datos/restaurante/pedidos/:id/falta {platoId}` (pagado o aceptado, sin repartidor) avisa al cliente y bloquea «aceptar» hasta que decida; `POST /datos/pedidos/:id/ajuste {quitar|cancelar}` (`aplicarAjuste` en `pedidos.ts`): quitar recalcula el pedido con `calcularPedido` sin ese plato y **devuelve la diferencia en Stripe (`/refunds` con `amount`) antes de tocar el pedido**; si queda vacío o el cliente cancela, `cancelarConReembolso`. El Manager quita solo a los 5 minutos (`REGLAS.ajusteSinRespuesta`) y su reloj de «sin aceptar» cuenta desde que el cliente decidió. `PATCH /datos/restaurante/pedidos/:id/tiempo` sube el tiempo solo sin repartidor. Pruebas «algo agotado y ajustar el tiempo» en `operacion.test.ts`. **La devolución parcial en Stripe real no está probada** (anotado en `VERIFICAR-PAGOS.md`).
- **C-CAPTURA y C-PIN (14 oct, de los estudios de Richard):** cobro autorizado al pedir y capturado al entregar (`capturarCobro` en `operacion.ts`, webhook `amount_capturable_updated` en `pedidos.ts`, `cancelarConReembolso` anula la autorización si no se capturó). PIN opcional de 4 dígitos en la entrega en mano (`pines_entrega`; se genera al pedir si `pin: true`; solo el cliente lo ve en el seguimiento; `entregado` en mano lo exige). Pruebas «cobrar al entregar y PIN en mano» en `operacion.test.ts`, comprobadas en rojo quitando la captura y la comprobación del PIN. **Qué NO tocar:** nunca acreditar dinero a las billeteras antes de capturar; nunca mandar el PIN al repartidor.
- **C-HORARIOS y C-OPCIONES (14 oct, punto 3 de la Etapa 2¾):** tablas `horarios_restaurante`, `grupos_opciones`, `opciones`. La regla de «¿está abierto?» vive en `packages/compartido/src/horarios.ts` (`abiertoPorHorario`, `proximaApertura`, `textoApertura`; cierre después de medianoche incluido) con `horarios.test.ts`; el servidor la aplica en `aRestaurante` (`abiertoAhora` = botón encendido Y dentro del horario) y en `POST /datos/pedidos` (409 fuera de horario). Sin turnos cargados manda solo el botón. `PUT /datos/mi-restaurante/horarios` reemplaza todos los turnos. Opciones: `PUT /datos/mi-restaurante/platos/:id/opciones` reemplaza los grupos; `POST /datos/pedidos` recibe `opciones: [ids]` por línea, valida mínimo/máximo/disponible y congela nombre y precio en `lineas_json` (`precioCentavos` por unidad ya con las opciones; `calcularPedido` no cambia). `textoLinea` en `catalogo.ts` pinta «Pizza (Grande, Extra queso)» en las cinco pantallas. Pruebas «horarios reales y opciones de los platos» en `operacion.test.ts`; recorrido con horario, opción Grande (+4) y capturas. **Qué NO tocar:** el precio de la línea lo fija el servidor, nunca la app; `abiertoAhora` es el que decide, `abierto` solo es el botón.
- **C-GPS-SERIO (14 oct, punto 4 de la Etapa 2¾, de los estudios de Richard):** tablas `ubicaciones_recientes` y `excepciones_ubicacion`. La regla vive en `packages/compartido/src/gps.ts` (`llegadaConfiable`: dos lecturas en 90 s, precisión ≤ 30 m desde C-GPS-ESTUDIOS (antes 60), coherentes entre sí a menos de 100 m y las dos dentro del radio de la puerta (80 m desde C-GPS-ESTUDIOS); `saltoImposible`: más de 50 m/s entre lecturas) con `gps.test.ts`. El servidor (`guardarMuestra` en `operacion.ts`) guarda cada `POST /datos/repartidor/ubicacion` con su `precision`, descarta los saltos imposibles (responde `salto: true`, anota `gps_salto` en la bitácora y no mueve la ficha) y solo marca el hito `llego_cliente` con la llegada confiable. `POST …/entregado` exige ese hito o la excepción autorizada (409 «Todavía no confirmamos tu ubicación…»), además del radio de 200 m de siempre. Excepción: `POST /datos/repartidor/pedidos/:id/no-puedo-confirmar {motivo}` (correo al equipo, `ubicacion_sin_confirmar`), `POST /datos/admin/pedidos/:id/autorizar-ubicacion` (soporte; guarda nombre y hora, `ubicacion_autorizada`); la ficha del pedido en el panel de soporte muestra el motivo y el botón, y la app del repartidor manda `precision` con cada ubicación, muestra «Confirmando tu ubicación…» cerca de la puerta y el botón «No puedo confirmar mi ubicación». Las pruebas (`m.entregar` manda dos lecturas precisas antes, `m.ubicar`, `m.envejecerGps`) están en «GPS serio» de `operacion.test.ts`, comprobadas en rojo quitando la exigencia del hito en `entregado`. Recorrido: el repartidor pide la excepción, soporte la autoriza por la API y se toma la captura `repartidor-sin-gps`. **Qué NO tocar:** nunca marcar `llego_cliente` con una sola lectura; la excepción la autoriza una cuenta admin, nunca el repartidor ni el restaurante; en las pruebas, dos ubicaciones en el mismo segundo a más de 50 m son un salto (usar `envejecerGps`).
- **C-ACTIVACION y C-COLA-SIN-RED (14 oct, punto 5 de la Etapa 2¾):** la lista de activación vive en `packages/compartido/src/activacion.ts` (`listaActivacion`, `textoActivacion`; obligatorio: teléfono, dirección con pin, horario con al menos un turno, un plato disponible con precio; recomendado: 5 platos con foto y cuenta de cobro) con `activacion.test.ts`. El servidor la calcula en `activacionDe` (`catalogo.ts`): `GET /datos/mi-restaurante` la devuelve en `restaurante.activacion` y `PATCH /datos/mi-restaurante/abierto` responde 409 (`campo: 'activacion'`) si falta algo obligatorio. Panel «Mi restaurante» (tarjeta «Lista para abrir», `aria-label`) y app del restaurante (lo obligatorio que falta). Prueba «lista de activación» en `catalogo.test.ts`, en rojo quitando el bloqueo. **En las pruebas se abre con `m.abrir(token)`** (carga horario toda la semana) y siempre después de crear un plato; `RESTAURANTE_BASE` lleva teléfono. Cola sin señal: `packages/compartido/src/colaEntrega.ts` (`crearCola` con almacén inyectado, `reintentar`, `esFalloDeRed` = `ErrorApi` con estado 0) y `colaEntrega.test.ts`; la app del repartidor guarda la foto de la entrega (como `data:`) o el «entregado en mano» en AsyncStorage (`tumbite.cola-entregas`) cuando no hay red, muestra «Pendiente de confirmar: N» y reintenta cada 10 s; lo que el servidor rechaza sale de la cola con su motivo. El recorrido entrega con `setOffline(true)` y comprueba que el pedido sigue en camino hasta que vuelve la señal (captura `repartidor-sin-senal`). **Qué NO tocar:** la recogida no se encola (la confirma el restaurante en persona); no abrir un restaurante sin la lista; no borrar la cola sin mostrar el motivo del rechazo.
- **C-DESPACHO-COMPLETO (14 oct, punto 6 de la Etapa 2¾):** tablas `bonos_pedido` y `cocina_ocupada`. Reglas en `packages/compartido/src/despacho.ts` (`RECHAZOS_PARA_ABRIR` 3, `BONO_OFERTA_ABIERTA` 100 centavos, `OPCIONES_COCINA_OCUPADA` 0/10/20, `prepSugerida`: promedio real de los últimos 20 pedidos de aceptado a listo, redondeado a 5, entre 10 y 60, más la cocina ocupada; con menos de 3 pedidos manda el configurado) con `despacho.test.ts`. Servidor (`operacion.ts`): el reparto (`repartirPendientes`) abre la oferta a todos los candidatos (hasta 20) con bono cuando el pedido ya lo vieron 3 (todos rechazos o vencimientos), anota `oferta_abierta`; `aceptar` vence las demás ofertas abiertas; `GET /datos/repartidor/ofertas` y el pedido activo traen `bono` y `pagoRepartidor` ya con el bono; `entregado` acredita envío + complemento + bono. `GET /datos/restaurante/pedidos` devuelve `prepSugerida` y `cocinaOcupada`; `PATCH /datos/restaurante/cocina {extraMin}`. El Manager avisa al equipo a los **5 minutos** sin repartidor (`REGLAS.sinRepartidor`, antes 15). Panel y app del restaurante: botón verde «sugerido» primero y selector «Cocina ocupada»; app del repartidor: línea verde «Incluye un bono de $1». Pruebas «despacho completo» en `operacion.test.ts` (5 repartidores, 3 rechazan, 2 la ven con bono, uno acepta, el otro la pierde, cobra el bono al entregar; promedio real 25 y +10 de cocina). Recorrido: cocina ocupada +10 → «Aceptar · 30 min · sugerido», capturas `restaurante-cocina-ocupada` y `repartidor-oferta-bono` (bono insertado en la base para verlo). **Qué NO tocar:** el bono lo paga Tumbite (no sale del restaurante ni del cliente); la oferta abierta no castiga a quien rechazó; el tiempo sugerido nunca baja de 10.
- **C-AVISOS-COMPLETOS (14 oct, punto 7 de la Etapa 2¾):** tablas `sms_enviados`, `llamadas` y `avisos_pedido` (los avisos por tiempo `llega_5` y `sal_a_recibir` van ahí y NO en `hitos_pedido`, que tiene lista cerrada de valores y ya existe en producción: un valor nuevo se descartaría en silencio). En `registrarHitos` (`operacion.ts`) los avisos por tiempo salen con `minutosDeViaje` a la casa: `llega_5` (≤ 5 min, push `AVISOS.llega5`) y `sal_a_recibir` (≤ 2 min, solo con entrega en mano). `avisarAlCliente(…, smsTipo)` manda además un SMS de respaldo para «en tu puerta» (`llego`) y «no te encuentran» (`no_aparece`). Todo lo de Twilio vive en `apps/servidor/src/sms.ts`: `smsConfigurado` (SID + token + número), `enviarSms` (anota en `sms_enviados`, nunca frena), `telefonoE164`, `llamarConNumeroOculto` (Twilio llama primero a quien pidió, con `Url` al puente) y el puente `GET /datos/twilio/puente?t=` que devuelve TwiML `<Dial callerId=número de Tumbite>` solo con un pase firmado (HMAC con el token, 10 minutos). `POST /datos/pedidos/:id/llamar` (cliente o repartidor del pedido en marcha). Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, y `TWILIO_API_URL` solo para localhost (simulador `scripts/recorrido/twilio-simulado.mjs`, puerto 12112). Canario: `piezas.sms` en `/datos/salud`. Sin Twilio todo se apaga solo (sin SMS, llamar responde 409 con mensaje). Botones «Llamar … (número oculto)» en la app del repartidor (en camino) y en el pedido del cliente. Pruebas «C-AVISOS-COMPLETOS» en `operacion.test.ts` (espía de Twilio: To/From/Body del SMS, Calls.json con Url al puente, TwiML con el número del otro, pase inventado 404, extraño 409). **Qué NO tocar:** nunca mandar el teléfono real de uno al otro; el pase del puente siempre firmado y con vencimiento; sin Twilio no se rompe nada.
- **C-MANAGER-TIEMPOS (14 oct, punto 8 de la Etapa 2¾):** el Manager pasa a los tiempos de los grandes: `REGLAS.recordatorio1` 1 min, `recordatorio2` 3 min, `cancelar` 6 min (`manager.ts`; decisión de la IA entre los 3-8 de DoorDash y los 11,5 de Uber), `sinRepartidor` 5 min (punto 6). La oferta al repartidor dura `SEGUNDOS_OFERTA` = 45 s (`operacion.ts`; la app lee `segundos` del servidor). El semáforo del pedido nuevo acompaña: amarillo al minuto, rojo a los 3 (`semaforo.ts`, `luz(m, 1, 3)`) con `semaforo.test.ts`. Textos en `SuperPedido.tsx`, `LuzSemaforo.tsx`, los avisos del Manager y las guías (restaurante, cliente, repartidor) actualizados en los dos idiomas; el recorrido adelanta el reloj a 4 y 7 minutos. Prueba «recuerda al minuto y a los 3 … cancela a los 6» en `operacion.test.ts`. **Qué NO tocar:** si se cambian estos números, se cambian TODOS juntos (reglas, semáforo, textos, guías y recorrido); un número suelto engaña al restaurante.
- **C-DINERO-VIGILADO (14 oct, punto 9 de la Etapa 2¾):** tablas `conciliaciones` y `abonos_fallidos`; columna `evidencias.borrada_en` (por `esquema.ts`). `apps/servidor/src/conciliacion.ts`: `conciliar(db, dia)` suma lo entregado del día y comprueba tres cosas: abonos a restaurantes = `pago_restaurante`, abonos a repartidores (entrega + propina) = `pago_repartidor` + bonos, y capturado en Stripe = total de los pedidos con cobro autorizado; guarda la fila con `cuadra` y el detalle. `conciliarAyer` corre desde `/datos/reloj` una vez al día y manda correo al equipo si no cuadra; `/datos/salud` → `piezas.dinero` (`pendiente` sin conciliación, `ok`, `error`). `depurarFotos` (también desde el reloj) borra del almacén las fotos de más de 30 días (`DIAS_FOTOS`) salvo pedidos con un ticket sin cerrar, deja `clave = ''` y `borrada_en`. Webhook `payout.failed` (Connect, `evento.account`) → fila en `abonos_fallidos`, aviso al celular y correo a quien es el dinero, correo al equipo. Superadmin: `GET /datos/admin/conciliacion` (últimos 14 días, `?dia=` recalcula) y `POST /datos/admin/stripe/dominio` (registra el dominio en Stripe para Apple Pay y Google Pay en la web). Apps: hoja de pago nativa con `applePay`/`googlePay` y `merchantIdentifier` `merchant.com.tumbite.cliente` (necesita la cuenta de Apple de Richard para que Apple Pay funcione de verdad). Pruebas «C-DINERO-VIGILADO» en `operacion.test.ts`, en rojo quitando la comprobación de abonos. **Qué NO tocar:** nunca «arreglar» una conciliación tocando `movimientos` a mano; si no cuadra, se busca la causa. Las fotos con reclamo abierto no se borran.
- **C-ANTECEDENTES (14 oct, punto 10 de la Etapa 2¾):** tablas `antecedentes_checkr` y `selfies_control`. Checkr en `apps/servidor/src/antecedentes.ts`: `pedirAntecedentes` crea el candidato y la invitación (paquete `driver_pro`, FL) y guarda la `invitacion_url`; los datos sensibles se escriben en la página de Checkr, nunca aquí; `POST /datos/checkr/aviso` exige la firma HMAC-SHA256 del cuerpo con la llave (`x-checkr-signature`); `report.completed` con «clear» pone `repartidor_datos.antecedentes = 'aprobado'`, cualquier otro resultado queda `revisar` y avisa al equipo por correo. Variables: `CHECKR_API_KEY`, `CHECKR_API_URL` solo localhost (simulador compartido con Twilio en el recorrido). Sin llave, `POST /datos/kyc/antecedentes/pedir` responde 409 con texto claro. Selfie de control (identidad continua): en `POST /datos/repartidor/conectar` se elige al azar (`PROBABILIDAD_SELFIE` 0,2, nunca más de una por 7 días; `SELFIE_CONTROL_SIEMPRE=1` en pruebas y recorrido) y mientras esté pendiente responde 409 `campo: 'selfie'`; la app muestra la tarjeta y sube a `POST /datos/kyc/selfie-control` (clave `kyc/<usuario>/control-<id>`); `GET /datos/repartidor/estado` trae `selfieControlPendiente`; el superadmin la ve en la verificación (`GET /admin/kyc/:id` → `selfiesControl`, foto por `/control/:cid`) y la califica (`PATCH …/control/:cid` coincide / no_coincide). Pruebas «C-ANTECEDENTES» en `kyc.test.ts` (en rojo quitando el 409 de la selfie pendiente). **Qué NO tocar:** nunca pedir número de seguro social ni licencia en Tumbite; el aviso de Checkr sin firma no toca nada; la selfie de control no sustituye el KYC.
- **C-ETAPA-2¾-FINAL (14 oct, punto 11): recogida, cambio de dirección, propina después, agrupados y mayoría de edad.** Tablas `recogidas`, `propinas_extra`, `grupos_pedido`; columna `platos.requiere_edad` (por `esquema.ts`). Recogida: `entrega: 'recoger'` en `POST /datos/pedidos` (la dirección es la del restaurante; `calcularPedido({recogida})` → envío 0, sin repartidor, `COMISION_RECOGIDA_PB` 5 %, la propina va al restaurante); el reparto y el Manager la saltan (`NOT EXISTS recogidas`); el restaurante cierra con `POST /datos/restaurante/pedidos/:id/entregado-local {pin, mayorEdad?}` (captura el cobro, acredita la venta, evidencia modo `local`); `entrega` en el seguimiento vale `recoger`. Cambio de dirección: `PATCH /datos/pedidos/:id/direccion` (antes de en_camino, nunca en recogida; recalcula con `calcularPedido`; si el total cambia responde 409 `campo: 'total'` con `nuevoTotal` y solo aplica con `aceptarTotal`; actualiza el monto del PaymentIntent autorizado; `direccion_cambiada` en la bitácora). `ErrorApi` ahora trae `datos` con la respuesta para que la app lea el nuevo total. Propina después: `POST /datos/pedidos/:id/propina {centavos}` (solo entregado, una vez, 7 días; cobra un PaymentIntent `off_session` con la tarjeta del PaymentIntent original y el cliente de Stripe; movimiento `ajuste` con referencia `propina-extra` al repartidor; `propinaExtra` en el seguimiento). Agrupados: en el reparto, si no hay libres, `agrupablesPara` ofrece a un repartidor con otro pedido del mismo restaurante sin recoger y entrega a menos de `KM_DESVIO_AGRUPAR` (2 km); `aceptar` lo permite y crea el `grupo_id`; `salirEnCamino` saca también a los hermanos listos; `registrarHitos` marca los hitos de TODOS los activos; `/repartidor/estado` trae `agrupados` y la app pinta una tarjeta por cada uno. Mayoría de edad: la línea del pedido congela `requiereEdad`; `entregado` exige en mano y `mayorEdad: true` (409 `campo: 'edad'` con foto o sin confirmar); la app del repartidor muestra la casilla. Pruebas «C-ETAPA-2-3-4-FINAL» en `operacion.test.ts` (5 pruebas), en rojo quitando la exigencia de `mayorEdad`. **Qué NO tocar:** la recogida no se ofrece a repartidores; el cambio de dirección nunca después de salir; la propina extra nunca dos veces; sin confirmación de edad no hay entrega.
- **C-INICIO-DISENO (14 oct): el inicio del cliente con el diseño aprobado de Richard.** Solo frontend en `apps/cliente`: `src/Inicio.tsx` compone las piezas de `src/inicio/` (`Cabecera` con logotipo, hamburguesa decorativa, campana, cupón y el `SelectorIdioma` de siempre; `Buscador` que filtra los restaurantes reales y «solo abiertos»; `Servicios` con los 8 íconos, solo «comida» funciona y el resto abre `ModalMuyPronto`; `AvisoPago` SOLO con un carrito armado y sin pagar (monto real); `Ofertas` con las fotos de muestra del diseño marcadas «Ejemplo» (tocar abre «Muy pronto», nunca se cobra); `Restaurantes` con foto real o de muestra por categoría, tiempo, envío con `calcularEnvio` real y abierto/cerrado; `BarraInferior` Inicio / Pedidos / Favoritos (muy pronto) / Mi cuenta). Imágenes en `apps/cliente/assets/inicio/` (recortes de `diseno-frontend/`, achicados; `src/inicio/recursos.ts` las mapea; `estilos.d.ts` declara `*.png`). Los acentos van en escarlata (regla de marca), no en el azul de la maqueta. Textos ES/EN en `src/inicio/textos.ts`. Los datos de muestra existen a propósito (Richard, 14 oct): la pantalla nunca se ve vacía delante de un socio; se sustituyen solos cuando haya datos reales. **Qué NO tocar:** nada falso se puede comprar ni pagar; sin cambios en servidor, base, rutas ni sesión; los paquetes compartidos no se tocaron. El recorrido (`cliente-inicio`) sigue tocando el restaurante por su nombre y «Ver carrito».
- **C-DRIVER-DISENO (14 oct): la app del repartidor con el diseño aprobado de las siete pantallas.** Solo frontend en `apps/repartidor`: `src/Inicio.tsx` conserva TODA la lógica (conectar, ofertas con reloj real, recogida con foto y QR, salida, GPS serio, entrega en todos sus casos, cola sin señal, chat, llamada, selfie de control, agrupados, billetera) y solo cambió el render: un `lienzo` común con `piezas/CabeceraDriver` (logotipo + «Driver», campana, `SelectorIdioma` de siempre), `piezas/BarraInferior` (Inicio / Pedidos / Ganancias / Perfil) y `piezas/ModalMuyPronto`. Inicio: `piezas/ResumenDia` (ganancias y entregas de hoy reales desde los movimientos; tiempo conectado contado en el celular en esta sesión), `piezas/Mapa` (+ `Mapa.web.tsx` con Leaflet; celular con `react-native-maps`, mismas librerías que el cliente; mascota como marcador), estado «Disponible para pedidos», las ofertas reales encima y el interruptor grande (rol `switch`, textos «Conectado: recibiendo pedidos» / «Desconectado»). Pedido activo: cabecera escarlata con la distancia real al objetivo (`metrosEntre`), mapa con la ruta, tarjeta Recoge en / Entrega en, `piezas/BotonRedondo` (abrir en mapas = mapa externo de siempre, llamar = número oculto o teléfono del restaurante, mensaje = chat) y `piezas/Progreso` (Recoger → Entregar → Completar por estado); debajo, los bloques de siempre sin cambios. Ganancias: pestañas Hoy / Semana / Mes calculadas en el celular con los movimientos reales + `BilleteraRepartidor`. Pedidos: historial real de entregas. Perfil: iniciales, insignia Verificado (desde `/datos/kyc`), Mi vehículo (`MisDatos`), Documentos (`Verificacion`), Mis lugares y Preferencias = Muy pronto, Idioma, Soporte (`ReportarProblema` + `MenuCuenta`), cerrar sesión. Sin seguimiento en segundo plano ni permisos nuevos; sin navegación interna (nada de instrucciones de giro). Íconos recortados de la imagen aprobada en `assets/driver/`. El recorrido toma las fotos del repartidor desde el principio de la pantalla (`foto()` en el spec). Candado textual `billeteraMensajes.test.ts` actualizado a la pantalla de ganancias. **Qué NO tocar:** los textos que usa el recorrido («Conectado: recibiendo pedidos», «Desconectarme», «Ver mi billetera y movimientos», «Aceptar», «No, gracias», «Entrega en:», etc.); los datos de las pantallas operativas son reales, nunca de muestra.
- **C-COMIDA-DISENO (14 oct): las pantallas de Comida del cliente con el diseño aprobado de diez pantallas.** Solo frontend en `apps/cliente`. «Comida» (y «Ver todos» del inicio, que antes no hacía nada) abren `app/restaurants.tsx`: buscador, botones por las categorías de los restaurantes reales, tarjetas con foto, distancia, tiempo y Abierto; el corazón abre «Muy pronto» (no hay favoritos). Menú (`app/restaurant/[id].tsx`): foto grande con flecha, pestañas Menú e Información (descripción, dirección, teléfono y horario reales; no hay pestaña de opiniones porque el servidor no las publica), botones por categoría con «Todos» primero (el recorrido busca platos de todas las categorías), botón + redondo con la misma etiqueta «Agregar {plato}», y el detalle del producto a pantalla completa (tamaños en losetas con rol radio, extras con casillas, cantidad, «Agregar al carrito · $» desactivado hasta elegir lo obligatorio). El carrito guarda la foto del plato en cada línea (`imagen`, solo para mostrar). Carrito (`app/cart.tsx`): misma lógica de pago, nueva presentación con piezas de `src/comida/piezas.tsx`. Pedido (`app/order/[id].tsx`): con `?nuevo=1` (al pagar dentro de la app y al volver de Stripe) muestra «¡Pedido realizado!» con número, total y el estado, «Ver seguimiento» y «Volver al inicio»; el seguimiento tiene cuatro pasos en verde, mapa, tarjeta del repartidor con llamar (número oculto, misma etiqueta) y mensaje (lleva al chat), detalle del pedido, entregado con foto real y calificación. Las fotos de relleno de restaurantes se recortaron: traían pegados «Ver todos», títulos y corazones de la maqueta (los originales quedaron fuera del repo); el corazón del inicio era un recorte de foto y se dibujó de nuevo en escarlata. Prueba `apps/servidor/src/comidaDiseno.test.ts` (comprobada en rojo quitando la navegación de Comida). **Qué NO tocar:** las etiquetas que usa el recorrido («Agregar {plato}», «Grande», «Agregar al carrito», «Ver carrito», «En la puerta», «Llamar al repartidor (número oculto)», «Ver seguimiento») y la regla de no dibujar lo que no existe (estrellas de restaurantes, opiniones, favoritos, foto del repartidor, desglose en el pedido: esperan datos del servidor).
- **C-RESTAURANTE-DISENO (14 oct): la app del restaurante con el diseño aprobado de ocho pantallas.** Solo frontend en `apps/restaurante` (más una portada opcional en el `Acceso` compartido que cliente y repartidor no usan). `src/Inicio.tsx` conserva toda la lógica (consulta cada 5 s, alarma que repite con pedidos nuevos y con fotos sin confirmar, aviso de llegada del repartidor, pantalla encendida, abrir / pausar, cocina ocupada, aceptar con tiempo, +5 min, falta un plato, rechazar en los tres puntos, listo, QR `tumbite:pedido:<id>`, confirmar recogida, entregar en el local con PIN y mayoría de edad) y solo cambió el render: cabecera blanca con logotipo «Restaurante» y el selector de idioma, tarjeta oscura del restaurante, contadores reales, pedido nuevo con reloj de espera, tiempos en botones (el sugerido en verde) y «Aceptar pedido» (etiqueta accesible «Aceptar · N min · sugerido», la misma que usa el recorrido), lista «En cocina», detalle del pedido con `piezas/ui.tsx` (`Pasos`, tiempo transcurrido y restante con barra verde que pasa a rojo si se atrasa, «Marcar como listo», banner verde y QR grande, foto del repartidor con «Marcar como recogido»), Pedidos (en curso y últimas 24 h, lo que manda el servidor), `Estadisticas.tsx` (resumen de hoy y tablero de semana y mes; sin gráfica por hora porque el servidor no la da) y `MiMenu.tsx` (las mismas rutas del panel: crear, editar, disponible y borrar con confirmación dentro de los tres puntos; foto con `expo-image-picker`, la misma versión del repartidor, solo galería, con permiso explicado en inglés y español; borrador guardado con `useBorrador`; tamaños y extras siguen en el panel). En tableta (ancho ≥ 768) el inicio va en dos columnas. El logotipo de `assets/rest/logo.png` se limpió del fondo azulado de la maqueta. El recorrido ahora compila y maneja la app del restaurante en cada corrida (acepta, marca listo, ve código y foto, y queda en camino tras la verificación del repartidor) y fotografía sus cinco pestañas. Desde el 15 oct también se publica en la web en tumbite.com/restaurant (Action `publicar` compila `build:restaurante-web` y lo copia a `out-deploy/restaurant`; el servidor manda sus rutas internas a su raíz con `raizDeApp`, sin tocar `/restaurant-terms`). Prueba `apps/servidor/src/restauranteDiseno.test.ts` (comprobada en rojo quitando la alarma y quitando la compilación web). **Qué NO tocar:** las etiquetas accesibles «Aceptar · N min», «¡Listo!» y «Confirmar: se lo entregué al repartidor», el texto del QR, y la regla de no dibujar lo que no existe (entrar con Google, contactar al cliente, imprimir ticket, foto del restaurante, gráfica por hora).
- **C-RETIROS-SEGUROS (15 oct 2026, Fase 0, rama `fase-0-seguridad-financiera`): un retiro nunca se paga dos veces.** Antes, en `POST /datos/billetera/retirar`, un `try/catch` envolvía la transferencia y la escritura en la base, y cualquier error devolvía el saldo: si Stripe transfería y la respuesta se perdía (o daba 500), el mismo dinero se podía retirar otra vez con otra clave. Ahora (`apps/servidor/src/retiros.ts` + `schema.sql`): tabla `retiros` con estados; pedir = una sentencia que descuenta el saldo (disparador `retiros_descuenta_saldo`); Stripe con la clave fija `retiro:<id>`, que también es su `transfer_group`; **un resultado incierto nunca devuelve el saldo**: se verifica con `GET /v1/transfers?transfer_group=…` y se reintenta con la misma clave; solo un rechazo comprobado (400/402/403/404 con la verificación hecha) devuelve el saldo, una vez (disparador `retiros_fallido_devuelve` + índice único `movimientos_retiro_revertido`); un confirmado no retrocede (`retiros_transicion_valida`). Bandera `config.retiros_activos` (`PUT /datos/admin/retiros`) y variable de emergencia `RETIROS_APAGADOS=1`. El reloj reintenta y concilia; el aviso `transfer.created` confirma; la salud tiene la pieza `retiros`. Pruebas: `rutas/retiros.test.ts` (21), comprobadas en rojo rompiendo 6 protecciones. Documento: `docs/FASE-0-SEGURIDAD-FINANCIERA.md`. **Qué NO tocar:** nunca devolver saldo en el `catch` de una llamada a Stripe; nunca generar una clave de idempotencia nueva para el mismo retiro; nunca borrar los disparadores. Si algo se ve raro, se apaga con `RETIROS_APAGADOS=1` y se revisa en Stripe.
- **C-RETIROS-APAGADOS-POR-DEFECTO (15 oct 2026, Fase 0):** sin la fila `config.retiros_activos = '1'` los retiros están apagados (`retirosActivos` en `apps/servidor/src/retiros.ts`). La billetera manda `retirosActivos` y `retirosEnProceso`; la app del repartidor y el panel muestran «en pausa» en lugar del botón y «En proceso» para un retiro pendiente, nunca «Retirado». Pruebas: `retiros.test.ts` («sin bandera nacen APAGADOS»), `apps/panel/src/panel/BilleteraRetiro.test.tsx` (3, comprobadas en rojo) y el recorrido completo. **Qué NO tocar:** no cambiar el valor por defecto a encendido.
- **C-ANULACION-VERIFICADA (15 oct 2026, Fase 0):** en `cancelarConReembolso` (`apps/servidor/src/manager.ts`), si la llamada a Stripe falla, `devolucionHecha` consulta a Stripe (cobro `canceled` si estaba autorizado; reembolso vivo si estaba capturado) **antes** de revivir el pedido. Si Stripe ya devolvió, el pedido queda cancelado. Antes, una respuesta perdida dejaba vivo un pedido con la autorización anulada: el restaurante cocinaba y la captura fallaba al entregar. Pruebas: `rutas/operacion.test.ts` («C-ANULACION-VERIFICADA», 2), comprobadas en rojo. **Qué NO tocar:** nunca revertir el estado sin consultar; nunca cambiar las claves fijas `anular-<pedido>` y `reembolso-<pedido>`.
- **C-DIAGNOSTICO-PRUEBAS (15 oct 2026, Fase 0):** `apps/servidor/src/rutas/diagnostico.ts` corre S2–S5, S7 y S11 dentro del worker. Responde **solo** en el dominio de pruebas (o localhost) y con el secreto del reloj; en tumbite.com siempre es 404. S11 se niega si la llave de Stripe no empieza con `sk_test_`. Lo llama `scripts/staging/probar-staging.mjs` desde `pruebas-rama.yml`. Pruebas: `diagnostico.test.ts` (4; el cerrojo de dominio, comprobado en rojo). **Qué NO tocar:** nunca agregar tumbite.com a la lista de dominios; nunca quitar la condición de modo prueba de S11.

- **C-SERVICIOS-IMPLEMENTADOS (15 oct 2026, Fase 1, rama `multiservicio-fase-1`): Moto y Carro no se pueden encender.**
  - Tres capas:
    1. `SERVICIOS_IMPLEMENTADOS` en `apps/servidor/src/esquema.ts` (solo `comida`) escribe `servicios_implementados` al arrancar.
    2. Los disparadores `servicios_exige_implementado(_alta)` y `servicios_zona_exige_implementado(_alta)` de `schema.sql` no dejan encender lo que no esté ahí.
    3. `bloquearPasajeros` en `rutas/servicios.ts` rechaza encender un servicio de pasajeros en esta fase.
  - Canario: pieza `servicios` de `/datos/salud`.
  - Pruebas: `rutas/servicios.test.ts`, comprobadas en rojo.
  - **Qué NO tocar:** no agregar un servicio a la lista sin su fase aprobada; no quitar los disparadores; no escribir `servicios_implementados` desde el panel.
- **C-COMIDA-INTACTA (15 oct 2026, Fase 1):**
  - Ninguna ruta de Comida lee las tablas del catálogo.
  - Un repartidor sin filas nuevas sale habilitado y activo en Comida («legado»).
  - Una ciudad que se prende abre Comida sola (disparadores `zonas_catalogo_alta` y `zonas_catalogo_activa`), salvo que el equipo ya la haya tocado (`actualizado_por`).
  - Pruebas: `servicios.test.ts`, `migracionFase1.test.ts` y el recorrido completo, comprobadas en rojo.
  - **Qué NO tocar:** el despacho de Comida solo pasa a leer la elegibilidad con M6, con bandera y su propia prueba.

- **C-IDENTIDAD-VERIFICADA (15 oct 2026, Fase 2):** la identidad de un repartidor solo queda «aprobada» con verificación real.
  - Es decir: fila `kyc` aprobada por un usuario admin, con `doc_frente`, `selfie` y `revisado_en`, y sin vencer.
  - La base lo exige siempre, con los disparadores `cumplimientos_identidad_exige_kyc` y `_cambio` en `schema.sql`.
  - La M5 solo copia esas identidades, con el vencimiento de la propia revisión.
  - Pruebas: `migracionFase1.test.ts`, comprobadas en rojo.
  - **Qué NO tocar:** nunca aprobar identidad con fuente distinta de `kyc` ni sin evidencia.
- **C-PUERTA-INTERNA (15 oct 2026, Fase 2):** `apps/servidor/src/rutas/interno.ts`.
  - Solo `RUTAS_INTERNAS` aceptan la llave interna, con firma HMAC, 60 s de margen y un nonce de una sola vez (`peticiones_internas`).
  - El reloj interno corre una vez por minuto (`tareas_programadas`).
  - El lote solo mueve a repartidores conectados y **sin pedido en curso**, hacia adelante en el tiempo.
  - Pruebas: `interno.test.ts` e `integracion.test.ts`, comprobadas en rojo.
  - **Qué NO tocar:** no agregar rutas de dinero a `RUTAS_INTERNAS`; no quitar el filtro de pedido en curso (la ubicación de Comida durante la entrega sigue por la ruta actual).
- **C-TIEMPO-REAL (15 oct 2026, Fase 2):** `apps/tiempo-real/src/nucleo.ts`. Avisos sin duplicar y sin colarse a otra persona (etiquetas `|usuario|`). Saltos de GPS descartados (más de 70 m/s). Límite de mensajes por conexión. El pase va en el protocolo y nunca en la dirección. Pruebas: `nucleo.test.ts` e `index.test.ts`, comprobadas en rojo. **NO desplegado.**

- **C-RELOJ-UNA-VEZ (15 oct 2026, validación en staging):** `/datos/reloj` (GitHub Actions) y `/datos/interno/reloj` (Worker externo) pasan por `correrRelojUnaVez` (`apps/servidor/src/rutas/operacion.ts`). Una fila de `tareas_programadas` por minuto, creada en una sola sentencia: el segundo que llega en ese minuto no corre nada. Pruebas: `retiros.test.ts` (los dos relojes a la vez → una sola transferencia), comprobada en rojo; F2 en D1 real. **Qué NO tocar:** ningún reloj llama a `correrReloj` directo.
- **C-DIAGNOSTICO-STAGING (15 oct 2026):** las rutas `/datos/interno/diagnostico/{f1,f2,migraciones,migraciones-prueba,vivo}` siguen el doble cerrojo de C-DIAGNOSTICO-PRUEBAS (solo dominio de pruebas y secreto del reloj). Todo lo que crean lleva `zz-` y se borra. Las migraciones que corren son idénticas a `docs/fase-1` (`migraciones/fase1.test.ts`). **Qué NO tocar:** nunca permitir `revertir` desde el sitio ni el dominio de producción.

- **C-ESQUEMA-COMPLETO (15 oct 2026):** `revisarColumnas` en `apps/servidor/src/esquema.ts` compara al arrancar cada columna de `schema.sql` (lista generada en `esquemaColumnas.ts` con `node scripts/generar-columnas.mjs`) con la base real; si falta una, la salud dice `esquema: error` y el semáforo frena la publicación. Nació por `evidencias.modo` y `evidencias.nota`, que nunca llegaron a la base (repartidor sin «Conectarme», fotos de entrega fallando). D1: no se puede cruzar `sqlite_master` con `pragma_table_info` y acepta hasta 5 partes por consulta (por eso bloques de 5 en un lote). Pruebas: `esquemaCompleto.test.ts` (en rojo comprobado). **Qué NO tocar:** una columna nueva en una tabla que ya existe va SIEMPRE en COLUMNAS; regenerar la lista al cambiar `schema.sql`.
- **C-APPS-APUNTAN-BIEN (15 oct 2026):** las apps web se construyen sin caché (`expo export --clear`) y en `pruebas-rama` con la dirección del sitio de pruebas, con un paso que falla si una app de pruebas apunta a producción. **Pendiente** en `publicar.yml`.

- **C-EXCLUSIVIDAD (16 oct 2026, Fase 3, rama `fase-3-exclusividad`, NO publicado en producción):** un conductor nunca tiene dos cosas incompatibles a la vez y dos conductores nunca se llevan la misma operación.
  - La base lo garantiza: `conductor_ocupacion` (una fila por conductor ocupado; la clave primaria impide dos ocupaciones), los disparadores `pedidos_*ocupa*` / `pedidos_libera_*` sobre `pedidos` y `operaciones_*` / `viajes_*`, y el índice único `operaciones_una_activa`.
  - Comida toma pedidos con `tomarPedidoComida` (`rutas/operacion.ts`): una sentencia que exige que el repartidor siga con los pedidos que se vieron (0, o 1 al agrupar) y que no esté en una operación.
  - Aceptar una operación es UNA sentencia con `RETURNING` (`aceptarOperacion` en `operaciones.ts`); el reintento con la misma clave responde «ya es tuya» sin repetir nada.
  - **Los disparadores, las vistas y el cuadre NO van en `schema.sql`:** viven en `apps/servidor/src/esquemaFase3.ts` y los crea `esquema.ts` al arrancar, una sentencia a la vez, después de las columnas nuevas. Lo que pasó (16 oct 2026): con ellos en `schema.sql`, la plataforma dividió mal el archivo (disparadores con CASE), aplicó 101 de 183 sentencias y se detuvo; faltaron las tablas, el reparto de Comida falló en el sitio de pruebas y el semáforo frenó la publicación. Además, el del vehículo fijo y la vista de elegibles usan `repartidores.vehiculo_activo_id`, que llega por COLUMNAS.
  - Prueba que lo fija: «el bloque de la Fase 3 en schema.sql solo trae tablas, índices y datos» (`fase3.test.ts`).
  - Cada arranque cuadra el conteo con los pedidos activos (idempotente; los disparadores ya existen antes del cuadre).
  - La salud cuenta los 17 disparadores (`DISPARADORES_EXCLUSIVIDAD`) además de las inconsistencias.
  - Un pedido que nace con repartidor cuenta y uno que se borra libera (`pedidos_ocupa_al_crear`, `pedidos_libera_al_borrar`): sin ellos, borrar un pedido en curso dejaba al conductor «ocupado» para siempre (lo destapó la limpieza de la prueba en vivo del 16 oct).
  - **Arranque rápido:** `asegurarFase3` (esquema.ts) hace UNA consulta y solo crea si falta algo, en un lote. Creándolos uno por uno, la primera respuesta tardaba más de 5 s y el tiempo real se cortaba (16 oct). Prueba «si los disparadores ya existen, el arranque no vuelve a crearlos», en rojo comprobado.
  - D1 acepta como máximo 5 partes por consulta compuesta: la vista de inconsistencias se arma con dos vistas de 4 (falló así en el sitio de pruebas el 16 oct; prueba «ninguna sentencia de la Fase 3 une más de 5 consultas»).
  - Canario: pieza `exclusividad` de `/datos/salud` (vista `inconsistencias_operaciones` en cero).
  - Pruebas: `fase3.test.ts` (21 casos, 2.000 acciones al azar) y F3 en D1 real (`diagnostico.ts`, `probar-staging.mjs`), comprobadas en rojo.
  - Vuelta atrás: `docs/fase-3/revertir.sql` (y vaciar `ESQUEMA_FASE3`).
  - **Qué NO tocar:** no aceptar pedidos de Comida con otra sentencia; no quitar la condición de conteo ni la de ocupación; no crear operaciones desde una ruta pública hasta la fase de Moto y Carro.

- **C-LOTE-NO-SE-ATASCA (16 oct 2026):** `apps/tiempo-real/src/nucleo.ts`. Un lote que el servidor rechaza (4xx, salvo 408 y 429) se descarta y queda en el registro con su código; un fallo de red o 5xx se reintenta. Lo pendiente de más de 10 minutos se suelta. Pruebas en `nucleo.test.ts`, en rojo comprobado. **Qué NO tocar:** nunca volver a reintentar sin límite ni a fallar sin registro.

- **C-RELOJ-AISLADO (16 oct 2026, rama `fase-reloj-seguro`, integrada con la Fase 3, NO publicado):** la tarea `operaciones` de la Fase 3 es una tarea crítica más de la lista, sin `catch` propio. cada tarea del reloj (`TAREAS_RELOJ` en `rutas/operacion.ts`) corre con su propio manejo de errores (`correrTareas` en `apps/servidor/src/reloj.ts`); si una falla, las demás corren igual. Cada resultado queda en `reloj_tareas` (una fila por tarea y vuelta). Lo que pasó: en el sitio de pruebas, la primera tarea fallaba cada minuto y frenaba al Manager y a la conciliación (00:39–00:50 UTC del 16 oct), y la salud no se enteraba.
  - Pieza `reloj` de la salud (`saludReloj`): con el reloj externo configurado, `error` si no hubo una vuelta buena en 5 minutos, si hubo 3 o más vueltas con error en 15 minutos, o si la última vuelta tuvo una tarea crítica fallida. Solo con GitHub, `atrasado` pasadas 6 horas (nunca error por la impuntualidad). Se recupera sola con la siguiente vuelta buena.
  - Pruebas: `reloj.test.ts` (14) y el diagnóstico `reloj` en el sitio de pruebas (D1 real y Stripe de prueba), comprobadas en rojo.
  - **Qué NO tocar:** ninguna tarea del reloj se llama fuera de `correrRelojUnaVez`; no volver a encadenar tareas sin su `try`; no tragar errores con `catch` vacío dentro de una tarea (la tarea tiene que fallar para que se vea).

- **C-CATALOGO-ESTABLE (16 oct 2026, Hito 1, rama `hito1-catalogo-sesion`, NO publicado):** la lista de restaurantes del cliente no desaparece ni se pisa con una respuesta vieja. Lo que pasaba: el inicio y la pantalla de Comida pedían cada uno su lista, primero sin ubicación y después con ella; si la respuesta sin ubicación llegaba tarde, borraba la buena. Además se repetía la consulta al cambiar la sesión o el idioma.
  - Una sola lista compartida: `crearListaRestaurantes` (`packages/compartido/src/listaRestaurantes.ts`), que usan `apps/cliente/src/comida/useRestaurantes.ts`, el inicio y Comida. Solo vale la última consulta de cada tipo; una sin ubicación nunca pisa a una con ubicación; consultas iguales en curso se comparten; recuerdo de 60 s.
  - La ubicación sale de la dirección, después de la guardada (el mapa del carrito la guarda) y al final del GPS.
  - Estados claros en los dos idiomas (`EstadoCatalogo.tsx`): zona sin restaurantes, fuera de zona, error con «Intentar de nuevo», y «no se pudo actualizar» conservando la lista.
  - Pruebas: `listaRestaurantes.test.ts` (7), comprobadas en rojo. Guía pública: Docs → «¿Por qué no veo restaurantes?».
  - **Qué NO tocar:** no volver a pedir la lista desde cada pantalla; no hacer depender la consulta de la sesión ni del idioma.

- **C-SESION-CON-LIMITE (16 oct 2026, Hito 1, rama `hito1-catalogo-sesion`, NO publicado):** al abrir una app, la comprobación de la sesión guardada tiene un tiempo máximo (8 s, `confirmarSesion` en `packages/compartido/src/confirmarSesion.ts`). Lo que pasaba: si el servidor no respondía, la pantalla de carga escarlata se quedaba para siempre.
  - 401 o 403: la sesión no vale y se borra. Tiempo agotado, sin red o error del servidor: la sesión NO se da por buena ni se borra; se ve «No pudimos confirmar tu sesión» con «Reintentar» y «Entrar con otra cuenta» (`ConSesion.tsx`), y nada protegido se abre mientras tanto.
  - Pruebas: `confirmarSesion.test.ts` (6), comprobadas en rojo.
  - **Qué NO tocar:** nunca autenticar una sesión sin respuesta del servidor; nunca borrar la sesión guardada por un fallo de conexión.

- **C-VERSION-DEL-ARTEFACTO (16 oct 2026, rama `versionado-visible`, NO publicado):** cada pieza dice la versión y el commit con que SE COMPILÓ, nunca el último de GitHub.
  - Servidor: `scripts/construir-servidor.mjs` compila con `wrangler --define COMMIT_PUBLICADO / VERSION_PUBLICADA` (commit de `VERSION` o `GITHUB_SHA`). Se lee en `/datos/version` (público, `no-store`, sin secretos) y en el campo `version` de `/datos/salud`.
  - Web y panel (la misma compilación de Vite): `define: VERSION_WEB` en `apps/panel/vite.config.ts`, además del `<meta name="version">` de siempre. Se ve en el pie del sitio (`VersionPublicada`) y en el menú de la cuenta del panel, junto con la del servidor: si no coinciden, se ve a simple vista.
  - Apps: `EXPO_PUBLIC_COMMIT` lo pega Expo dentro del paquete; en la web lo pone `scripts/empaquetar.sh` y en las tiendas el gancho `eas-build-post-install` (`scripts/version-app.mjs`, con `EAS_BUILD_GIT_COMMIT_HASH`). El número es el de `app.json`. Se ve en el menú de tres puntos de la cuenta. Sin actualizaciones por aire, así que lo que dice es lo instalado. **El gancho de las tiendas todavía no se probó en una compilación de EAS.**
  - Sin compilación (la computadora del equipo, las pruebas), dice «local»: nunca un commit inventado.
  - Candado: `verificar-paquete.mjs <carpeta> <entorno> <commit>` frena el paquete si el servidor, la web o UNA de las tres apps no lleva el commit de ESTA publicación. Pruebas: `version.test.ts` (compartido y servidor) y `publicacion.test.ts`, comprobadas en rojo.
  - **Qué NO tocar:** no leer la versión de GitHub ni de una variable del panel; no quitar el tercer argumento del revisor en `empaquetar.sh`.

- **C-FALLOS-CRITICOS (16 oct 2026, rama `fallos-criticos`, NO publicado):** cinco fallos encontrados leyendo el código y **reproducidos en rojo** antes de tocar nada (`apps/servidor/src/fallosCriticos.test.ts`; detalle en `docs/RESULTADOS-FALLOS-CRITICOS.md`).
  1. Idempotencia persistente de los avisos de Stripe: `avisos_stripe.estado` (`procesando` → `hecho`; columna nueva por COLUMNAS, con `hecho` por defecto para los avisos viejos). Solo quien crea la marca procesa; `hecho` responde `repetido` sin tocar nada; una marca `procesando` ajena responde **409** para que Stripe reintente (nunca «repetido» con los efectos sin aplicar); una marca `procesando` abandonada hace más de 5 minutos se reclama y se vuelve a procesar; si el procesamiento falla, se borra SOLO la marca propia (`AND estado = 'procesando'`) y se relanza (5xx). Pruebas de cruce real en `avisosConcurrencia.test.ts` (7, tres de ellas en rojo con el diseño anterior).
  2. Cancelar en `pago_pendiente` anula el PaymentIntent de `stripe_sesion` (`manager.ts`, `intento`; `stripe_sesion` guarda el `pi_…` que devolvió Stripe al crear el pedido), con la misma clave `anular-{id}` y la verificación C-ANULACION-VERIFICADA (respuesta perdida, ya cancelado, fallo temporal). Pruebas: `cancelacionAutorizaciones.test.ts` (8, cinco en rojo con el código anterior) y **S12** en el sitio de pruebas contra Stripe en modo prueba.
  3. La propina posterior solo se anota con `status = 'succeeded'`; si no, 409 y nada en la base (`pedidos.ts`).
  4. `entregaActiva` ordena por la oferta aceptada más antigua, después `creado_en` e `id`: nunca `LIMIT 1` sin `ORDER BY` (`operacion.ts`). Dos pedidos del mismo segundo empatan por `creado_en`: por eso manda la oferta.
  5. `soltarPedido` borra la fila de `grupos_pedido` en el mismo lote.
  - **Qué NO tocar:** no marcar un aviso como procesado fuera del `try`; no anotar movimientos de dinero sin el `status` de Stripe; no quitar el `ORDER BY`.

- **C-TRANSICIONES-PEDIDO (16 oct 2026, Entrega 1, rama `transiciones-pedido`, NO publicado):** la base rechaza cualquier cambio de estado de un pedido de Comida que no esté en `transiciones_pedido` (12 filas en `schema.sql`: 9 normales y 3 de vuelta atrás). Antes, la regla vivía solo en el `WHERE estado = …` de cada `UPDATE`, y la base dejaba, por ejemplo, aceptar un pedido sin pagar o cancelar uno entregado.
  - El disparador `pedidos_transicion_valida` vive en `apps/servidor/src/esquemaPedidos.ts`. **No va en `schema.sql`** (C-EXCLUSIVIDAD). Lo crea `asegurarFase3` al arrancar, con la misma consulta única que la Fase 3.
  - Vuelta atrás del Manager (cuando Stripe falla al devolver): solo vale si el mismo `UPDATE` borra `cancelado_en` y la cancelación tiene 2 minutos o menos.
  - Salud: pieza `transiciones` (disparador presente y 12 filas).
  - Pruebas:
    - `transicionesPedido.test.ts`: las 42 parejas de cambio real (9 permitidas, 33 rechazadas), las vueltas atrás y 2.000 cambios al azar;
    - `transicionesCodigo.test.ts`: cada cambio de estado que escribe el código está en la tabla, y cada fila de la tabla la usa el código;
    - `transicionesRutas.test.ts`: aceptar y rechazar a la vez, cancelar y aceptar a la vez, reintentos, cancelar desde «en camino», un lote con dinero que se deshace entero, y registros viejos en cada estado.
    - Siete de las doce se comprobaron en rojo quitando el disparador.
  - Las pruebas ya no pueden poner un estado «a mano»: usan `llevarA` (`pruebas/ayuda.ts`), que camina las transiciones legales.
  - **Qué NO tocar:**
    - no abrir una excepción en el disparador para las pruebas;
    - toda transición nueva se agrega a la tabla, a `PERMITIDAS` de la prueba y la detecta `transicionesCodigo.test.ts`;
    - no mover el disparador a `schema.sql`.

- **C-PAUSA-SIN-SENAL (16 oct 2026, Entrega 3, rama `pausa-sin-senal`, NO publicado):** como el «Tablet Heartbeat» de DoorDash. Si la app o el panel del restaurante no preguntan por pedidos en 5 minutos, la tienda no recibe pedidos, y vuelve sola cuando vuelven a preguntar.
  - **La señal:** `GET /datos/restaurante/pedidos` anota `restaurantes.senal_en`, con una escritura cada 30 s como mucho (`anotarSenal` en `apps/servidor/src/pausa.ts`).
  - **La pausa se calcula al leer**, sin depender del reloj: `conSenal` (`packages/compartido/src/senal.ts`) dentro de `abiertoAhora` (`aRestaurante`, `catalogo.ts`) y al crear el pedido (`pedidos.ts`), que responde 409 con el motivo en los dos idiomas.
  - **Sin marca todavía (NULL) cuenta como con señal:** al publicar no se cierra ninguna tienda de golpe.
  - **Interruptor:** `config.pausa_sin_senal_minutos` (5 por defecto; 0 la apaga).
  - **Avisos:** la tarea del reloj `pausa_sin_senal` (**no crítica**) avisa UNA vez al dueño, al celular y por correo, y al equipo; avisa la vuelta; usa `UPDATE` condicionales sobre `pausa_aviso_en`.
  - **Columnas por COLUMNAS:** `senal_en` y `pausa_aviso_en`.
  - **Pruebas:** `pausaSinSenal.test.ts` (6) y `senal.test.ts` (5), comprobadas en rojo de dos formas: con la regla siempre «con señal» y sin anotar la señal.
  - **Guía pública:** Docs → restaurantes → «¿Por qué mi tienda aparece sin recibir pedidos?».
  - **Qué NO tocar:**
    - no mover la pausa solo al reloj (en producción el reloj es impuntual);
    - no tratar NULL como «sin señal» sin una migración que siembre la marca;
    - no tocar `abierto` desde la pausa (el dueño no tiene que reabrir a mano).

- **C-COBRO-AL-ENTREGAR (16 oct 2026, Entrega 1b, rama `cobro-al-entregar`, NO publicado):** la entrega se **registra primero y se cobra después**.
  - **Lo que pasaba antes:**
    - se capturaba en Stripe antes de registrar la entrega: si el registro fallaba, el dinero quedaba cobrado y el pedido sin entregar;
    - un 500 de Stripe bloqueaba la entrega.
  - **Cómo funciona ahora:**
    - **Registro:** un lote con `INSERT liquidaciones` (clave única por pedido, deshace una entrega repetida), el pedido a «entregado» con su estado en el WHERE, y los abonos.
    - **Captura:** `liquidar` (`apps/servidor/src/liquidaciones.ts`) reclama la liquidación con un UPDATE condicional y captura con una clave por intento (Stripe guarda los 500 con su clave durante 24 h). Si algo falla, consulta el estado con GET.
    - **Reintentos:** espera creciente; a los 6 intentos pasa a `revision` y avisa al equipo.
    - **Reloj:** tarea crítica `liquidaciones`.
    - **Aviso de Stripe:** `payment_intent.succeeded` también cierra la liquidación.
    - **Retiros:** solo cuentan lo cobrado (`SOLO_LO_COBRADO`).
    - **Salud:** pieza `cobros`.
  - **Decisión de Richard en revisión:** se conserva el saldo, se bloquea su retiro, se avisa una vez (`alertado_en`), no se cobra otra tarjeta y la resuelve un administrador (`GET /datos/admin/liquidaciones`).
  - **L1:** `POST /datos/interno/diagnostico/l1` (Stripe TEST, solo en el sitio de pruebas), ejecutada en la computadora con `l1Diagnostico.test.ts`.
  - **Pruebas:** `cobroAlEntregar.test.ts` (15), con un Stripe simulado fiel a su documentación: una sola captura por pago y la respuesta guardada por clave, incluidos los 500.
  - **Qué NO tocar:**
    - nunca volver a capturar antes de registrar la entrega;
    - nunca reintentar una captura con una clave que ya devolvió error;
    - no quitar la liquidación del lote de la entrega.

## C-INICIO-GRANDES: el inicio del cliente copia el estándar del mercado (18 oct 2026)

- **Qué se rompió y cómo se veía:** Richard entró con la cuenta demo y la campana, el cupón y el buscador no hacían nada real (mandaban a «Mi cuenta» o filtraban la lista cargada); los servicios que vienen abrían una ventana «¡Muy pronto!» en vez de su pantalla; el orden de los servicios no era el suyo; «Comida» entraba «sosa».
- **Causa real:** el inicio aprobado el 14 oct era un diseño con piezas de muestra; no leía el catálogo de servicios del servidor ni tenía buscador ni avisos de verdad.
- **Qué se hizo (ficha `docs/investigaciones-rea/2026-10-18-inicio-cliente.md`):** regla «No inventemos la rueda» (se copia el estándar de DoorDash, Uber Eats y Rappi). Servidor: `GET /datos/buscar` (restaurantes y platos de la ciudad, sin acentos ni mayúsculas, abiertos primero, tope 10+10) y `GET /datos/mis-avisos` (pedidos en curso, sellos y descuentos por volver, próximas aperturas; sin tabla nueva); `licores` y `mas` en `schema.sql`; `/datos/servicios` y `/datos/buscar` caen en la ciudad inicial cuando no hay ubicación (como `/datos/restaurantes`). Compartido: `ORDEN_SERVICIOS` (Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores, Más) y `filtrarRestaurantes`. App: la cuadrícula pinta el catálogo real con etiqueta «Pronto / En pausa / Actualiza»; cada servicio abre `app/service/[id]` con `FranjaEstado` (nunca un modal); `app/search` (espera 300 ms, solo la última respuesta manda); `app/notifications` (pestañas Todos / Regalos, punto rojo en la campana con pedidos en curso); Comida con título, «n abiertos ahora» y filtros rápidos; regalos reales en vez de ofertas de muestra cuando los hay.
- **Pruebas:** `packages/compartido/src/servicios.test.ts`, `filtrosComida.test.ts`; `apps/servidor/src/rutas/buscar.test.ts`, `avisos.test.ts`, `servicios.test.ts` (licores/mas); `apps/servidor/src/inicioGrandes.test.ts` (candado de archivos); recorrido (`e2e/recorrido`): servicio con franja, buscador con plato, campana con pedido en curso y punto rojo.
- **Cómo se comprueba:** entrar con la cuenta demo en staging: la cuadrícula en ese orden, Moto abre su pantalla con la franja gris, el buscador encuentra «pizza» en Restaurantes y Platos, la campana dice «No tienes avisos» y, con un pedido pagado, lo lista con punto rojo.
- **Qué NO tocar:** el orden vive en `ORDEN_SERVICIOS` (no en la columna `orden` de la base, que en producción ya tiene envíos después de mercado); la regla «lo que viene lleva franja, nunca modal»; `ESPERA_BUSQUEDA_MS` en 300.

## C-REPARTIDOR-GRANDES: la app del repartidor copia el estándar del mercado (18 oct 2026)

- **Qué faltaba y cómo se veía:** la oferta era una tarjeta sin cuenta regresiva ni sonido y con la distancia equivocada (local→cliente, no repartidor→local); el repartidor no veía sus calificaciones; las ganancias eran un total por pedido y la propina posterior entraba como «ajuste»; la campana decía «Muy pronto»; si el restaurante cancelaba o el cliente cambiaba la dirección, nadie le avisaba; no podía pausar sin desconectarse; no había «llegué», «no está listo» ni ayuda dentro del pedido.
- **Causa real:** la app se construyó pantalla por pantalla sin estudiar el proceso completo de Dasher y Uber Driver (ficha `docs/investigaciones-rea/2026-10-18-repartidor.md`).
- **Qué se hizo:** servidor `rutas/repartidorGrandes.ts` (`GET /datos/repartidor/calificaciones`, `GET /datos/repartidor/ganancias`, `GET /datos/repartidor/avisos`, `POST /datos/repartidor/pausar`, `POST /datos/repartidor/pedidos/:id/llegue`, `POST /datos/repartidor/pedidos/:id/no-esta-listo`), `PUT /datos/cuentas/idioma`; `/datos/repartidor/ofertas` trae `distanciaAlLocalKm`, `distanciaTotalKm`, `minutosEstimados`, `articulos`; `conectar` devuelve `cobertura`; `libresEn` excluye `pausado = 1`; columna `repartidores.pausado` (en COLUMNAS) y tabla `abandonos_repartidor` (la escribe `soltarPedido`); push al repartidor en `listo`, `rechazar` del restaurante y cambio de dirección (`AVISOS.repListo/repCancelado/repDireccion`), y al dueño en `restNoListo`. App: `apps/repartidor/src/grandes/` (Oferta en pantalla completa con cuenta regresiva y vibración, Calificaciones, Ganancias con desglose, Avisos, Alta guiada, AyudaPedido con motivos y 911) conectadas en `Inicio.tsx`; el idioma de la app actualiza el de los avisos.
- **Pruebas:** `apps/servidor/src/rutas/repartidorGrandes.test.ts` (9, en rojo primero); recorrido: «Llegué al restaurante», ganancias con desglose, calificaciones y campana con fotos para Docs.
- **Cómo se comprueba:** con la cuenta demo del repartidor en staging: al aceptar un pedido, la oferta sale en pantalla completa con los segundos corriendo; Perfil → Mis calificaciones; Ganancias → Ver desglose; la campana lista los avisos; «Pausar ofertas» deja de traer ofertas.
- **Qué NO tocar:** los mínimos (4,2 y 90 %) son referencia, no desactivan a nadie (decisión de negocio no tomada); el orden del despacho y la oferta de 45 s no cambian; `abandonos_repartidor` es lo que alimenta la finalización: no borrar filas.

## C-SUPER-PEDIDO-RUTA: la ficha del pedido abre desde las listas del superadmin (18 oct 2026)

- **Qué se rompió y cómo se veía:** en el superadmin, tocar un pedido en «Pedidos en curso» o en la ficha de un cliente o restaurante dejaba la pantalla en blanco.
- **Causa real:** los enlaces de las listas llevaban a `…/orders/<id>` (las direcciones del panel van en inglés desde el 13 oct) y `seccionAdmin` en `PanelApp.tsx` solo reconocía `…/pedidos/<id>`.
- **Qué se hizo:** `PanelApp.tsx` acepta `/(orders|pedidos)/<id>` (la vieja sigue por si alguien la guardó). Hallado en la auditoría final (`docs/AUDITORIA-FINAL-2026-10-18.md`, F1).
- **Prueba:** `apps/panel/src/panel/PanelApp.test.tsx` → «C-SUPER-PEDIDO-RUTA» renderiza `seccionAdmin('/orders/<id>')` y exige que pida `/datos/admin/pedidos/<id>` (en rojo antes del arreglo). `SuperPedido.test.tsx` fija que los enlaces usan `/orders/`.
- **Cómo se comprueba:** superadmin → Pedidos en curso → tocar un pedido: se abre la bitácora.
- **Qué NO tocar:** si se renombra la dirección, cambiar los dos lados (enlaces y `seccionAdmin`) y la prueba.

## C-FALLOS-DINERO: F6, F7, F8 y F10 de la auditoría final (18 oct 2026)

- **Qué se rompía:** (F6) la app del cliente calculaba el total CON envío al elegir «recoger en el local» y nunca comparaba su total con el del servidor; (F7) cambiar la dirección antes del pago no actualizaba el cobro en Stripe (el intento vive en `stripe_sesion` hasta el aviso) y después del pago un rechazo de Stripe salía como 500 con la dirección ya cambiada; (F8) al quitar un plato agotado, el recálculo ignoraba la recogida y devolvía menos; (F10) los avisos de las cuentas conectadas de Stripe (`account.updated`, `payout.failed`) vienen firmados con OTRO secreto y se rechazaban: `pagos_activos` no se activaba solo.
- **Qué se hizo:** `cart.tsx` pasa `recogida` a `calcularPedido` y manda `totalEsperado`; `POST /datos/pedidos` responde 409 con `nuevoTotal` si no coincide; `calcularSinPlato` consulta `recogidas`; `PATCH /pedidos/:id/direccion` actualiza `stripe_pago ?? stripe_sesion` (solo `pi_`) dentro de `try` y responde 409 sin tocar el pedido si Stripe rechaza; el webhook acepta `STRIPE_WEBHOOK_SECRET` y `STRIPE_WEBHOOK_SECRET_CONECTADAS` (canario `webhookStripeConectadas`).
- **Pruebas:** `apps/servidor/src/fallosDinero.test.ts` (7, todas en rojo primero).
- **Cómo se comprueba:** en staging, carrito con «Recojo en el local»: el total no lleva envío y coincide con el que cobra Stripe; cambiar la dirección de un pedido sin pagar y pagar: Stripe cobra el total nuevo.
- **Qué NO tocar:** el `totalEsperado` es opcional (apps viejas siguen pidiendo) pero la app siempre lo manda; el segundo secreto es obligatorio para que la activación de pagos funcione en real (👤 Richard, `VERIFICAR-PAGOS.md`).

## C-INTENTOS: tope del PIN de entrega y límite de entrada persistente (F19, 18 oct 2026)

- **Qué faltaba:** el PIN de entrega (en mano y recogida) se podía probar sin límite; el límite de intentos de entrar/registro/recuperar vivía en la memoria de un aislado (se reinicia solo y no se comparte).
- **Qué se hizo:** `apps/servidor/src/pin.ts` → `verificarPinEntrega` (a la quinta equivocación, 423 y el PIN queda bloqueado; `pines_entrega.intentos` en COLUMNAS); `limiteIntentosPersistente` en `seguridad.ts` con la tabla `intentos_limite` (UPSERT con ventana) para entrar, registro, recuperar y restablecer.
- **Pruebas:** `apps/servidor/src/seguridadIntentos.test.ts` (5; incluye que `operacion.ts` ya no compara el PIN a mano y que `app.ts` usa el persistente).
- **Qué NO tocar:** no volver a `pin !== pinFila.pin` suelto; la tabla se crea sola en el middleware porque corre ANTES de `asegurarEsquema`.

## C-CANARIO-AVISA: el canario se pone en rojo si el reloj lleva un día sin vuelta buena y avisa al equipo (F11, 18 oct 2026)

- **Qué faltaba:** solo con el reloj de GitHub, «atrasado» nunca pasaba a error, y nadie recibía nada cuando una pieza de `/datos/salud` se ponía en rojo.
- **Qué se hizo:** `reloj.ts` → `HORAS_ERROR_GITHUB = 24` (de 6 a 24 h «atrasado», pasado un día «error»); `canario.ts` → `alertarCanario` manda UN correo a `ADMIN_CORREOS` cuando una pieza pasa a error y otro al recuperarse (estado anterior en `alertas_canario`); `/datos/salud` lo llama al final; `.github/workflows/canario.yml` consulta la salud cada 30 min y falla (GitHub avisa) si producción no responde 200.
- **Pruebas:** `reloj.test.ts` (GitHub: 25 h → error), `canario.test.ts` (2).
- **Qué NO tocar:** el aviso es por cambio de color, nunca por consulta; el vigía de GitHub no reemplaza al correo del servidor (los dos juntos).

## C-TURNSTILE-APPS: el escudo anti-robots viaja desde la web y las tres apps (F5, 18 oct 2026)

- **Qué faltaba:** el servidor exigía el pase de Turnstile al entrar y registrarse si `TURNSTILE_SECRET_KEY` estaba puesta, pero ni la web ni las apps lo mandaban: configurar la llave habría dejado a todo el mundo afuera (403).
- **Qué se hizo:** el servidor publica la clave pública en `/datos/publico` (`turnstileSitio`, variable `TURNSTILE_SITE_KEY`) y el canario `turnstile` se pone en error si hay secreta sin pública. Web: `apps/panel/src/panel/Turnstile.tsx` pinta el widget y deja el pase en `window.tumbitePase` (que `api.ts` ya mandaba); `Acceso.tsx` lo pinta y lo reinicia tras un 403. Apps: `packages/movil/src/Turnstile.tsx` abre `/turnstile.html` (en `apps/panel/public`) en una vista web (`react-native-webview`) y recibe el pase por `postMessage`; `sesion.tsx` lo manda con `pase: paseTurnstile`; `Acceso.tsx` lo pinta y lo olvida tras un 403. Sin clave pública no se pinta nada y el servidor no la exige.
- **Pruebas:** `apps/servidor/src/turnstileApps.test.ts` (3), `apps/panel/src/panel/Turnstile.test.tsx` (2).
- **Cómo se comprueba:** con las dos llaves en el sitio de pruebas, la pantalla de entrar muestra el recuadro de Cloudflare y se entra normal; sin llaves, nada cambia.
- **Qué NO tocar:** las dos llaves van juntas (👤 Richard, PENDIENTES); el dominio `tumbite.com` (y `staging.tumbite.com`) tiene que estar en la lista de dominios del widget en Cloudflare, si no el widget falla en las apps.

## C-VERSION-APP: las apps dicen quiénes son, el servidor puede pedir «actualiza» y el idioma vive en la cuenta (F16, 18 oct 2026)

- **Qué faltaba:** las apps no mandaban su nombre ni su versión; el servidor no podía retirar una versión rota; el idioma elegido en la app del cliente no llegaba a la cuenta (los avisos salían en el idioma viejo).
- **Qué se hizo:** `crearApi` manda `x-tumbite-app: <app>/<versión>` (`app:` en `packages/movil/src/sesion.tsx`, versión de `expo-constants`); `apps/servidor/src/versionApp.ts` responde 426 `{ actualizar: true }` en toda la API (menos `/datos/publico`, `/datos/version`, `/datos/salud`) cuando `APP_VERSION_MINIMA` («cliente=0.2.0,repartidor=0.1.5» o «0.2.0») dice que esa versión ya no sirve; `cambiarIdioma` de la sesión móvil hace `PUT /datos/cuentas/idioma` si hay sesión.
- **Pruebas:** `apps/servidor/src/versionApp.test.ts` (3).
- **Qué NO tocar:** la web no manda cabecera y nunca recibe 426; la variable vacía no cambia nada.

## C-RESTAURANTE-ESTADO: «Recibiendo pedidos» de verdad, ítem de cobro real y correo al dueño (F13 y F14, 18 oct 2026)

- **Qué se rompía:** la app del restaurante y el panel decían «Recibiendo pedidos» según el botón, aunque estuviera fuera de horario o sin señal; el ítem «cobro» de la activación se marcaba con solo crear la cuenta de Stripe (sin pagos activos); al aprobar, pausar o rechazar un restaurante el dueño no recibía nada.
- **Qué se hizo:** la etiqueta usa `abiertoAhora` (verde solo si recibe de verdad; «Abierto, fuera de horario» en gris si no) en `apps/restaurante/src/Inicio.tsx` y `apps/panel/src/panel/MiRestaurante.tsx`; `PATCH /datos/mi-restaurante/abierto` devuelve `abiertoAhora`; la activación cuenta `cuentas_stripe.pagos_activos = 1`; `PATCH /datos/admin/restaurantes/:id` acepta `motivo` y manda `correoEstadoRestaurante` (es/en) al dueño en cada cambio de estado.
- **Pruebas:** `apps/servidor/src/restauranteEstado.test.ts` (3), `apps/panel/src/panel/Admin.test.tsx` («fuera de horario»).
- **Qué NO tocar:** el verde es solo para «recibiendo de verdad» (regla «lo que salió bien va en verde»); un cambio solo de plan no manda correo.

## C-SUPER-DINERO: el superadmin ve y resuelve el dinero que antes no tenía pantalla (18 oct 2026)

- **Qué faltaba (auditoría final, punto 7):** el interruptor de retiros solo existía por API; las liquidaciones en revisión, los abonos rechazados por el banco y el historial de la conciliación vivían en la base sin pantalla.
- **Qué se hizo:** `apps/panel/src/panel/ControlDinero.tsx` (dentro de Dinero): interruptor de retiros con confirmación (`PUT /datos/admin/retiros`), cobros en revisión con «Reintentar ahora» (`POST /datos/admin/liquidaciones/:id/reintentar` → `liquidar`) y «Ya está cobrado en Stripe» (`POST …/confirmar`: solo anota si Stripe responde `succeeded`), abonos rechazados (`GET/PATCH /datos/admin/abonos-fallidos`, columna `resuelto_en` en COLUMNAS) y conciliación de 14 días con detalle y «Recalcular hoy». Textos en inglés corregidos («Elite plan», «Km included in the base fee»).
- **Pruebas:** `apps/servidor/src/superDinero.test.ts` (4), `apps/panel/src/panel/ControlDinero.test.tsx` (3).
- **Qué NO tocar:** «confirmar» nunca inventa un cobro (pregunta a Stripe); encender retiros sigue siendo decisión de Richard (él es el superadmin): el botón pide confirmación y la variable `RETIROS_APAGADOS` manda sobre él.

## C-SUPER-OPERACION: soporte cancela con devolución, quita al repartidor, busca cerrados y suspende cuentas (18 oct 2026)

- **Qué faltaba (auditoría final, punto 26):** desde el superadmin no se podía cancelar ni devolver, ni reasignar el repartidor, ni buscar pedidos ya cerrados, ni suspender cuentas.
- **Qué se hizo:** `POST /datos/admin/pedidos/:id/cancelar` (motivo obligatorio → `cancelarConReembolso`, evento `cancelado_por_soporte`), `POST …/soltar-repartidor` (→ `soltarPedido`, el pedido vuelve a la fila; evento `repartidor_quitado_por_soporte`), `GET /datos/admin/pedidos?cerrados=1&q=` (entregados y cancelados, por número, cliente o restaurante), `PATCH /datos/admin/usuarios/:id` (`activo` + motivo: mata sesiones y desconecta al repartidor; las fichas devuelven `activo`). Panel: botones en la ficha del pedido (`SuperPedido.tsx`), buscador y casilla «cerrados» en la lista, `BotonSuspender` en las fichas de cliente y repartidor.
- **Pruebas:** `apps/servidor/src/superadminOperacion.test.ts` (4), `apps/panel/src/panel/SuperPedido.test.tsx`.
- **Qué NO tocar:** cancelar pasa SIEMPRE por `cancelarConReembolso` (anulación o reembolso verificados con Stripe); una cuenta admin no se suspende desde aquí.

## C-DEVOLUCIONES-DISPUTAS: impuesto de ventas, devoluciones después de entregar y disputas (A.12, 18 oct 2026)

- **Qué faltaba:** ningún impuesto de ventas (Florida: 6 % estatal + condado, Tumbite es «marketplace facilitator»); no había forma de devolver dinero después de entregar; los contracargos de Stripe no se registraban.
- **Qué se hizo:** `ConfigDinero.impuestoPb` (0 por defecto; se fija en Dinero → Impuesto de ventas con el contador) → `Desglose.impuesto` sobre la comida cobrada, va al total, se guarda en `pedidos.impuesto` (COLUMNAS), sale en el carrito y en el recibo; no es ganancia (se retiene para remitir). `POST /datos/admin/pedidos/:id/devolver` (pedido entregado y cobrado; reembolso parcial en Stripe con clave `devolucion-<id>-<n>`; tabla `devoluciones`; si se carga al restaurante o al repartidor, movimiento `ajuste` negativo con `referencia devolucion:<pedido>:<id>:por:<admin>`; evento `devolucion_parcial`; la conciliación lo suma a «devuelto»). Webhook `charge.dispute.*` → `disputas.ts` (`registrarDisputa`: fila, bitácora `disputa_abierta/cerrada`, correo al equipo con el plazo), `GET /datos/admin/disputas`, canario `disputas` (rojo si una sin responder vence en menos de 2 días), lista en el panel de Dinero.
- **Pruebas:** `packages/compartido/src/bolsillos.test.ts` (impuesto), `apps/servidor/src/devolucionesDisputas.test.ts` (4).
- **Decisiones de Richard (docs/DECISIONES-RICHARD-FASE-2.md):** tasa y qué se grava (envío/servicio), código fiscal de comida con el contador, registro en Florida (Stripe Tax o a mano), quién asume cada devolución (hoy Tumbite por defecto), y si una disputa abierta bloquea el retiro de ese dinero (hoy no).
- **Qué NO tocar:** `impuesto` nunca entra en `gananciaPlataforma`; la devolución nunca supera el total del pedido ni se hace sin reembolso real en Stripe; la evidencia de una disputa se manda en el panel de Stripe (no hay API aquí todavía).

## C-COBRO-DIRECTO: libro mayor, saldo prepago, cobro directo y recargas (Fase 2, 18 oct 2026)

- **Qué se construyó:** ficha `docs/investigaciones-rea/2026-10-18-cobro-directo-tumbite.md`. Servidor: `internacional/paises.ts` (interruptores por país en `config`), `internacional/libro.ts` (tabla `libro`, reserva/cobro/liberación idempotentes, `descontarSiAlcanza` en una sentencia), `internacional/cobroDirecto.ts` (abrir pedido directo, puede tomar, reservar al aceptar, cobré, no pagó, conciliar), `internacional/recargas.ts` (puntos, códigos con hash, canje atómico, bloqueo por intentos, recarga Stripe), `rutas/internacional.ts`. Enganches: `POST /datos/pedidos` (`metodoPago`), ofertas (filtro por saldo), aceptar (reserva; si falla suelta el pedido), `soltarPedido` y `cancelarConReembolso` (liberan), entregado (sin `movimientos` en directo; concilia), webhook (recargas). Transición nueva `en_camino → cancelado` (13 filas; `saludTransiciones`).
- **Pruebas:** `apps/servidor/src/internacional.test.ts` (9); `transicionesPedido.test.ts` y `transicionesRutas.test.ts` ajustadas a la transición nueva.
- **Qué NO tocar:** el saldo prepago jamás se descuenta fuera de `descontarSiAlcanza`; el `libro` no se edita ni se borra (ajustes = filas compensatorias con autor); en EE.UU. todo apagado hasta que Richard lo encienda (`PUT /datos/admin/paises/US`); un pedido directo nunca acredita `movimientos`.

## C-CUENTAS-COBRO: cuentas del repartidor para las transferencias del cliente (B.5, 18 oct 2026)

- **Qué se construyó:** `internacional/cuentasCobro.ts` + rutas `GET/POST /datos/repartidor/cuentas-cobro`, `POST …/:id/desactivar`, `PATCH /datos/admin/cuentas-cobro/:id`, `POST /datos/pedidos/:id/disputa-cobro`. El alta exige la contraseña, desactiva la anterior, deja historial con autor, avisa por correo y entra en vigor a las 24 h (el equipo puede confirmarla antes; «confirmada» nunca significa «verificada por el banco»). El seguimiento del pedido por transferencia muestra al cliente del pedido (solo a él) el nombre del beneficiario y la cuenta vigente. El cobro lo confirma el repartidor (`cobro_confirmado_por = 'repartidor'`); el cliente puede disputarlo (ticket de queja ligado al pedido).
- **Pruebas:** `apps/servidor/src/cuentasCobro.test.ts` (2).
- **Qué NO tocar:** nunca se piden credenciales de banca ni se lee el banco del repartidor; sin contraseña no hay cambio; la espera de 24 h solo la salta el equipo.

## C-COBRO-DIRECTO (pantallas, C.6, 18 oct 2026)

- Cliente: en el carrito, «¿Cómo pagas?» (tarjeta / efectivo al recibir / transferencia al repartidor) solo si `GET /datos/pais` lo permite; «Pedir y pagar al recibir» crea el pedido sin tarjeta; el seguimiento muestra «Pagas al recibir» con el monto sin propina o la cuenta publicada del repartidor, y «Tengo un problema con el cobro» (ticket de queja).
- Repartidor: en la puerta, tarjeta «Cobra al cliente» con el monto sin propina, lo recibido, «Cobré» y «El cliente no pagó» (confirmación); en Ganancias, «Saldo para comisiones» (disponible, apartado, canje de código) cuando el país lo permite.
- Restaurante: en el pedido, «El repartidor paga este pedido en el mostrador… entrégale el ticket».
- Docs: guías `pay-on-delivery` (clientes) y `cash-orders-and-top-ups` (repartidores), es/en.
- Prueba: `internacional.test.ts` → «pantallas del cobro directo…». Capturas del recorrido: cuando Richard encienda un país en staging (hoy todo apagado).

## C-PEDIDOS-FAVORITOS: pestaña Pedidos real, Favoritos reales y recibo (puntos 12 y 13, 18 oct 2026)

- **Qué faltaba:** la pestaña «Pedidos» mandaba a Mi cuenta; «Favoritos» abría «Muy pronto»; el seguimiento no mostraba el desglose.
- **Qué se hizo:** `apps/cliente/src/app/orders.tsx` (historial con estado, resumen de platos, «Ver pedido y recibo», «Repetir pedido» que rearma el carrito con los platos que siguen en el menú y avisa de los que no), `apps/cliente/src/app/favorites.tsx` (lista cruzada con el catálogo de la ciudad; corazón para quitar), corazón real en `restaurants.tsx` (`PUT/DELETE /datos/favoritos/:id`, `GET /datos/favoritos`, tabla `favoritos`), pestañas de la barra inferior conectadas, y «Recibo» en el seguimiento (comida, regalo, envío, servicio, pedido pequeño, impuesto, propina, total).
- **Pruebas:** `apps/servidor/src/rutas/favoritos.test.ts` (2); `comidaDiseno.test.ts` ajustada.
- **Qué NO tocar:** el corazón nunca vuelve a abrir un «Muy pronto»; repetir pedido vacía el carrito antes (un carrito de otro restaurante no se mezcla).

## C-CUPONES-DIRECCIONES: direcciones guardadas y cupones reales (puntos 14 y 15, 18 oct 2026)

- **Qué faltaba:** sin direcciones guardadas ni instrucciones de entrega reutilizables; las «ofertas» del inicio eran de muestra y no había cupones.
- **Qué se hizo:** `rutas/direcciones.ts` (`GET/POST/DELETE /datos/mis-direcciones`, tope 10, la misma dirección se actualiza) y en el carrito chips «Tus direcciones» (rellenan dirección, punto, instrucciones y modo) y «Guardar esta dirección para la próxima». `rutas/cupones.ts` (`POST /datos/cupones/validar`, `GET /datos/cupones/destacados`, `GET/POST/PATCH /datos/admin/cupones`; tipos monto / porcentaje / envío gratis; mínimo, usos totales y por cliente, solo primer pedido, restaurante o ciudad, vencimiento); `calcularPedido` con `descuento` (baja el total y la ganancia de Tumbite; restaurante y repartidor cobran igual; nunca más que lo cobrable); `POST /datos/pedidos` revalida el cupón, guarda `cupon`/`descuento` y el uso en `usos_cupon`; el carrito tiene «Cupón o código promocional» con «Aplicar»; el inicio muestra las promociones destacadas reales en vez de las de muestra; el panel de Dinero crea y administra cupones (formulario con borrador).
- **Pruebas:** `apps/servidor/src/rutas/cupones.test.ts` (4), `bolsillos.test.ts` (descuento).
- **Decisión de Richard:** quién paga cada campaña (hoy Tumbite). **Qué NO tocar:** el cupón se valida siempre en el servidor al crear el pedido; el descuento nunca toca `pagoRestaurante` ni `pagoRepartidor`.

## C-QUEJA-GUIADA: comentario en la calificación y queja guiada con reembolso parcial (punto 16, 18 oct 2026)

- **Qué faltaba:** la calificación no pedía comentario; la queja era un texto libre sin motivo ni platos; no existía reembolso parcial por faltante.
- **Qué se hizo:** la app manda `comentario` al calificar (campo opcional). `POST /datos/quejas` acepta `motivo` (faltó algo, pedido incorrecto, frío o dañado, tarde, repartidor, otro) y `platoIds`; con «faltó algo» calcula la **propuesta** (valor de esos platos) y la deja en el ticket; si el superadmin encendió `quejas.reembolsoAuto` (Dinero → Quejas con artículo faltante, con tope), devuelve ya ese monto con `devolverParcial` (lo absorbe Tumbite, actor «sistema»). La devolución vive en `apps/servidor/src/devoluciones.ts` (también la usa el superadmin). `ReportarProblema` (las tres apps) muestra motivos y, con un pedido, los platos para marcar; informa si se devolvió o si queda en revisión.
- **Pruebas:** `apps/servidor/src/quejasGuiadas.test.ts` (3).
- **Decisión de Richard:** encender el reembolso automático y su tope (hoy apagado, tope 15 dólares de fábrica). **Qué NO tocar:** nunca se devuelve sin pedido entregado y cobrado; el tope manda.

## C-RESTAURANTE-MAS: reseñas con respuesta, orden del menú, festivos y equipo con roles (puntos 19 a 22, 18 oct 2026)

- **Qué faltaba:** el restaurante no veía las reseñas ni podía responder; los platos no se reordenaban; no había festivos ni cierres; un solo usuario por restaurante.
- **Qué se hizo:** `rutas/restauranteMas.ts`: `GET /datos/mi-restaurante/resenas` y `POST …/resenas/:pedidoId/responder` (`calificaciones.respuesta`; el cliente la ve en `resena` del seguimiento), `PUT /datos/mi-restaurante/orden-platos` (orden dentro de la categoría) y `PUT …/orden-categorias` (`restaurantes.categorias_orden`, aplicado por `ordenarPlatos` en el menú público y el propio), `GET/POST/DELETE /datos/mi-restaurante/cierres` (`cierres_restaurante`; `abiertoAhora` es falso ese día con `fechaLocal` de la zona), `GET/POST/DELETE /datos/mi-restaurante/equipo` (`miembros_restaurante` con `manager` y `staff`; solo el dueño cambia el equipo; `restauranteDe` resuelve dueño o miembro y las consultas por `dueno_id` del catálogo, operación, regalos y KYC aceptan miembros). Panel: Reseñas (`/panel/reviews`), Equipo (`/panel/team`), Festivos (en Mi restaurante) y ↑/↓ de platos y categorías en Menú.
- **Pruebas:** `apps/servidor/src/rutas/restauranteMas.test.ts` (5).
- **Qué NO tocar:** las rutas de orden NO cuelgan de `/platos/:id` (chocan con editar plato); el staff nunca responde reseñas ni toca el equipo; la billetera sigue siendo del dueño.

## C-GPS-FONDO: GPS en segundo plano y entrega con documento en pedidos para mayores (puntos 23 y 24, 18 oct 2026)

- **Qué faltaba:** la ubicación solo se mandaba con la app abierta; en pedidos con alcohol bastaba un interruptor «es mayor de 21» sin ninguna constancia.
- **Qué se hizo:** `apps/repartidor/src/ubicacionFondo.ts` (tarea `tumbite-ubicacion-fondo` con `expo-task-manager`: pide el permiso «Siempre», `startLocationUpdatesAsync` cada 30 m o 15 s con servicio en primer plano en Android, y manda la posición a `/datos/repartidor/ubicacion` con el token guardado; `leerTokenGuardado` en `@tumbite/movil`); se enciende al conectarse y se apaga al desconectarse; `app.json` con `UIBackgroundModes: location`, permisos de fondo y el plugin de `expo-location` en modo fondo. Entrega en mano con edad: el servidor exige `documento` (licencia, pasaporte, otro), `documentoUltimos4` y `nombreRecibe`, y los deja en la nota de la evidencia («ID licencia ••1234 · recibió …»); la app los pide debajo del interruptor. La navegación sigue abriendo Google Maps o Apple Maps (como DoorDash).
- **Pruebas:** `apps/servidor/src/repartidorFondo.test.ts`, `operacion.test.ts` (entrega con edad).
- **Qué NO tocar:** sin el permiso de fondo la app sigue mandando posición con la pantalla abierta (nunca se bloquea al repartidor); los últimos 4 dígitos nunca son el documento completo.

## C-OPERACION-D1: aviso de verificaciones, bandeja paginada, salud en el panel y restauración de respaldos (puntos 27 y 28, 18 oct 2026)

- **Qué faltaba:** al enviar una verificación nadie avisaba al equipo; la bandeja mostraba 50 y callaba; el canario no se veía en el panel; nunca se había probado restaurar un respaldo.
- **Qué se hizo:** correo a `ADMIN_CORREOS` en `POST /datos/kyc/enviar`; `SuperKyc` muestra totales por pestaña y «Ver más» con `siguiente`; `SaludPiezas` en el Resumen del superadmin lee `/datos/salud`; `restaurarDesdeRespaldo` + `POST /datos/respaldo/restaurar?dia=` (solo hosts de pruebas y con el secreto del reloj): vacía y vuelve a llenar cada tabla de la copia en una sola transacción, con las llaves foráneas diferidas y los disparadores quitados y recreados.
- **Pruebas:** `apps/servidor/src/respaldoRestaurar.test.ts` (respaldar → dañar → restaurar), `tiendasPermisos.test.ts` ajustada (el repartidor pide ubicación «Siempre»).
- **Qué NO tocar:** restaurar en producción NO existe por diseño (se hace a mano con el equipo delante); el cerrojo de host de pruebas no se quita.

## C-WEB-HONESTA: la web solo promete lo que existe (punto 33 y F17, 18 oct 2026)

- Planes Crece y Élite: «promociones destacadas» y «ayuda con fotos y marketing» dicen **muy pronto** (el plan hoy no cambia el orden del catálogo); «soporte local» pasó a «soporte en tu idioma»; «música en vivo» se presenta como lo que viene; un solo buzón público `support@tumbite.com` (antes hello@ y sales@); Miami en `cobertura.ts` queda «muy pronto» hasta el lanzamiento público (decisión de Richard el día que lance).

## C-ARRANQUE-RAPIDO: la revisión de columnas al arrancar va en un solo lote (18 oct 2026)

- **Qué se rompió y cómo se veía:** en staging, con el bloque C, el recorrido falló tres veces en el mismo paso: al recargar la app del cliente salía «No pudimos confirmar tu sesión» y la búsqueda nunca cargaba. Con `curl`, `/datos/cuentas/yo` (sin token, sin consultas propias) tardaba 2 s o se colgaba más de 15 s en algunas peticiones.
- **Causa real:** cada arranque del servidor corre `asegurarEsquema` antes de contestar. Recorría `COLUMNAS` con **una consulta a `pragma_table_info` por columna**: 40 viajes seguidos a la base. La lista creció con la Fase 2 y el primer arranque de cada copia del servidor tardaba más que los 8 s que la app espera para confirmar la sesión (C-SESION-CON-LIMITE).
- **Qué se hizo:** `migrar` (`apps/servidor/src/esquema.ts`) lee las columnas de todas las tablas de la lista en **un solo `db.batch`** (bloques de 5 `UNION ALL`, como `revisarColumnas`) y solo hace `ALTER TABLE` de lo que falte.
- **Prueba (comprobada en rojo):** `esquema.test.ts` «el arranque no hace una consulta por columna» cuenta las consultas sueltas a `pragma_table_info`: antes 40, ahora 0.
- **Cómo se comprueba en vivo:** `curl` repetido a `/datos/cuentas/yo` de staging contesta en menos de 1 s y el recorrido pasa el paso del buscador.
- **Qué NO tocar:** nada de consultas por columna o por tabla en el arranque; todo lo que corre en `asegurarEsquema` va en lotes.

## C-COBRO-DIRECTO-LOCAL: el repartidor paga la comida en el local y todo queda registrado (18 oct 2026)

- **Qué faltaba:** el recorrido aprobado por Richard dice que el repartidor paga la comida al recoger (efectivo o su tarjeta), recibe el ticket y lo entrega con el pedido. El código suponía ese pago sin registrarlo: no había monto pagado, ni ticket, ni método; una cancelación después de comprar no dejaba rastro del dinero del repartidor; una transferencia repetida no dejaba el excedente escrito; una devolución en un pedido pagado en mano intentaba usar Stripe; y soporte no podía cancelar un pedido «listo» (la base lo rechazaba con un error interno aunque el superadmin lo ofrecía).
- **Qué se hizo:** tabla `pagos_local` y módulo `apps/servidor/src/internacional/pagoLocal.ts`. Rutas `GET/POST /datos/repartidor/pedidos/:id/pago-local` (monto pagado, total del ticket, `efectivo` o `tarjeta_propia`; una sola vez), `GET /datos/restaurante/pedidos/:id/pago-local` y `POST /datos/repartidor/pedidos/:id/transferencia-pendiente`. Compuerta: sin el pago registrado no se acepta la foto de recogida ni la confirmación del restaurante (`exigirPagoLocal`); al confirmar, el restaurante confirma el pago. Las diferencias de pago o ticket se anotan y la conciliación sale «con diferencia». Cancelación, cliente que no paga o repartidor soltado por soporte después de comprar → `comida_comprada_sin_entregar` en el libro (pendiente de decisión, una sola vez). Excedente del cliente (sin contar la propina) → `excedente_cliente_por_devolver`. La confirmación del cobro queda como **manual del repartidor** (quién, cuánto y cuándo). `devolverParcial` rechaza los pedidos pagados en mano. Transición nueva `listo → cancelado` (14 filas en `saludTransiciones`). Apps: `apps/repartidor/src/grandes/PagoEnLocal.tsx`, botón «La transferencia aún no me llega», y «Cobra al repartidor» en la app del restaurante. Recorrido local con el pedido en efectivo hasta la compra y la cancelación por soporte.
- **Pruebas (comprobadas en rojo quitando cada pieza):** `internacional.test.ts` (8 nuevas: compuerta en la foto y en la confirmación, ticket distinto, cancelación antes y después de comprar, cliente que no paga, transferencia pendiente/duplicada/propina, transferencia que no llegó + disputa, devolución sin Stripe, reservas simultáneas), `transicionesPedido.test.ts`, `transicionesRutas.test.ts`.
- **Qué NO tocar:** el saldo prepago es SOLO para comisiones, nunca para comprar comida; Tumbite no presta ni financia la compra; nada de saldos negativos ni crédito; una confirmación del repartidor nunca se presenta como verificación bancaria.

## C-LLAMADA-METODO: la llamada con número oculto pide el puente con GET y la ruta acepta GET y POST (F9, 18 oct 2026)

- **Qué se rompía:** `llamarConNumeroOculto` creaba la llamada sin `Method`; Twilio pide la dirección con POST por defecto y la ruta solo existía en GET: la llamada habría caído con 404.
- **Qué se hizo:** `Method: 'GET'` en la llamada (`apps/servidor/src/sms.ts`) y la ruta `/datos/twilio/puente` acepta GET y POST.
- **Prueba (en rojo comprobado):** `operacion.test.ts`, «llamada con número oculto». **Falta:** probarla con la cuenta real de Twilio (👤).

## C-NOTAS-CULPA: las malas notas por culpa del restaurante no cuentan al repartidor (F18, 18 oct 2026)

- **Qué se rompía:** Docs, la web y los términos prometen que esa nota no cuenta; el promedio del repartidor (su app y el superadmin) la contaba. Los términos además decían que el nivel dependía de estrellas y puntualidad y daba prioridad «en pedidos grandes»; el sistema sube el nivel por entregas y lo usa para desempatar ofertas a igual distancia.
- **Qué se hizo:** `GET /datos/repartidor/calificaciones` y la ficha del superadmin excluyen `culpa_restaurante = 1` (la app recibe `excluidas`); los términos del repartidor (es/en, actualizados el 18 oct) dicen exactamente lo que calcula el sistema.
- **Prueba (en rojo comprobado, las dos partes):** `repartidorGrandes.test.ts`, «F18».

## C-STRIPE-AVISOS: los avisos de Stripe se consultan y se crean desde el servidor (19 oct 2026)

- **Por qué:** la llave secreta de Stripe solo vive como secreto en el panel de YaDominios (nadie la ve). Para comprobar si existe el segundo aviso (cuentas conectadas, F10) y crearlo sin pedirle a Richard que entre al panel de Stripe, el servidor lo hace con su propia llave.
- **Qué se hizo:** `apps/servidor/src/rutas/stripeAvisos.ts`. `GET /datos/interno-stripe/avisos` lista los avisos (id, dirección, estado, modo prueba o real, eventos) **sin secretos** y dice si falta el de cuentas conectadas. `POST /datos/interno-stripe/avisos/conectadas` lo crea una sola vez (`connect=true`, `account.updated` y `payout.failed`, `metadata.tumbite=conectadas`, apuntando a `SITIO_URL/datos/stripe/aviso`) y devuelve su secreto **solo al crearlo**, para guardarlo directo como `STRIPE_WEBHOOK_SECRET_CONECTADAS` (variable secreta del sitio) sin mostrarlo. Solo con el secreto del reloj, comparado en tiempo constante; sin él, 404.
- **Prueba (en rojo comprobado):** `rutas/stripeAvisos.test.ts` (4).
- **Qué NO tocar:** la ruta nunca devuelve la llave ni el secreto de un aviso existente; crear el aviso de producción exige la autorización de Richard.
- **19 oct, noche:** la cuenta de Stripe de Windoce es **compartida con otros negocios**; la consulta solo muestra los avisos cuya dirección es la de este sitio (perímetro de Tumbite). Prueba en rojo comprobada.

## C-FOTO-TICKET: foto del ticket del restaurante en el pago en el local (19 oct 2026)

- `POST /datos/repartidor/pedidos/:id/foto-ticket` (después de registrar el pago en el local), guardada en el almacén privado; columna `pagos_local.ticket_clave` (en `COLUMNAS`); `GET /datos/pedidos/:id/evidencia/ticket` para el repartidor, el dueño del restaurante, el cliente y soporte. Botón «Tomar foto del ticket (opcional)» en la app del repartidor.
- **Prueba (en rojo comprobado):** `internacional.test.ts`, «foto del ticket».

## C-MONEDA-LOCAL: formato de montos por moneda (19 oct 2026)

- `formatearMonto(monto, moneda, idioma)` en `@tumbite/compartido`: USD con dos decimales, COP sin decimales, VES con dos; moneda desconocida = dólares. Prueba en `dinero.test.ts`.
- **Conectado el 19 oct junto con C-TARIFAS-PAIS** en las pantallas del cobro en mano: pago en el local y «Cobré» del repartidor, aviso de cobro del restaurante. `textoAMonto` y `montoATexto` convierten lo que se escribe a la unidad menor de cada moneda (con pesos, «12000» son 12000 pesos). El resto de las pantallas sigue en dólares porque solo Estados Unidos recibe pedidos; antes de un piloto fuera de EE. UU. se pasan todas (menú, carrito, historial, ganancias).

## C-TARIFAS-PAIS: tarifas y moneda del país en cada pedido (19 oct 2026)

- **Qué se rompía:** el servidor calculaba TODOS los pedidos con la configuración global en dólares. Un pedido en una zona de Colombia se habría aceptado con un envío de «399» (centavos de dólar leídos como pesos) y la tarjeta habría cobrado en dólares. Prueba en rojo comprobada: el pedido en una zona colombiana sin tarifas devolvía 201.
- **Cómo quedó:** `apps/servidor/src/internacional/tarifas.ts`. `tarifasDeZona` saca país y moneda de la zona del restaurante: Estados Unidos usa la configuración global de siempre (sus totales no cambian); cualquier otro país usa `tarifas` de su configuración de país (`PUT /datos/admin/paises/:pais`, validadas con el mismo esquema que la global y con mínimo ≤ máximo). **Sin tarifas escritas, el país no recibe pedidos (409).** La tarjeta solo se acepta en USD (409 antes de crear el pedido y sin llamar a Stripe): Stripe trata los pesos con dos decimales y esa conversión no está construida ni probada.
- **Lo que guarda cada pedido:** `pedidos.moneda` y `pedidos.tarifas_json` (la configuración aplicada). Quitar un plato agotado o cambiar la dirección recalcula con esas tarifas, no con las de hoy. Pedidos viejos sin `tarifas_json`: la global, como antes.
- **Las cifras de cada país las fija Richard.** Hoy ningún país distinto de EE. UU. tiene tarifas; en producción y staging solo hay zonas de EE. UU. (consultado el 19 oct).
- **Prueba:** `apps/servidor/src/tarifasPais.test.ts` (5): EE. UU. idéntico a la global y guardado en USD; país sin tarifas = 409 y cero pedidos; con tarifas en pesos se calcula con ellas y guarda COP; cambiar después las tarifas no reescribe el pedido; tarjeta en pesos = 409 sin Stripe; validación de mínimos. Rojo comprobado quitando la guarda.
- **No tocar:** no volver a leer `leerConfigDinero` directo al crear un pedido; no convertir monedas en el servidor; no encender la tarjeta fuera de USD sin construir y probar la conversión de unidades de Stripe.

## C-CONCILIACION-DIRECTA: la conciliación diaria no mezcla el cobro en mano (19 oct 2026)

- **Qué se rompía:** la conciliación del día sumaba los pedidos en efectivo o transferencia al repartidor como si hubieran pasado por Stripe y la billetera. Desde el primer pedido en mano el día salía «no cuadra» (se esperaba un abono al restaurante que nunca existe) y un pedido en mano cancelado contaba como «devuelto».
- **Cómo quedó:** `apps/servidor/src/conciliacion.ts` cuenta solo `metodo_pago = 'tarjeta'` en vendido, abonos, capturado y devuelto. Los pedidos en mano van aparte en el detalle, por moneda: `directos_<MONEDA>`, `directosConDiferencia_<MONEDA>`, `directosPendientes_<MONEDA>`. Cada pedido en mano tiene su propia conciliación (`conciliacion_estado`). Estados Unidos con tarjeta no cambia.
- **Prueba:** `internacional.test.ts`, «la conciliación diaria no mezcla el cobro en mano…». Rojo comprobado sin el arreglo (`cuadra` daba falso).
- **No tocar:** no sumar montos de monedas distintas en una misma cifra.

## C-SIN-LUGAR-SEGURO-DIRECTO: un pedido cobrado en mano no se deja en un lugar seguro (19 oct 2026)

- **Qué se rompía:** en un pedido en efectivo o por transferencia al repartidor, «Dejar en lugar seguro» marcaba el pedido como entregado sin que nadie cobrara. Rojo comprobado: la ruta respondía 200.
- **Cómo quedó:** la entrega con `modo=seguro` de un pedido directo responde 409 y explica que el camino es «El cliente no pagó». La app del repartidor no muestra el campo del lugar seguro en esos pedidos (`testID="sin-lugar-seguro"`). Igual que DoorDash con los pedidos en efectivo.
- **Prueba:** `internacional.test.ts`, «un pedido cobrado en mano no se deja en un lugar seguro…», y la comprobación de piezas de las apps.

## C-RIESGOS-19OCT: revisión de riesgos del 19 oct 2026 (dinero, permisos, evidencias, GPS)

Cada arreglo tiene su prueba, comprobada en ROJO quitando el arreglo. No tocar sin repetir la prueba.

| Qué se rompía                                                                                                                             | Cómo quedó                                                                                                                                  | Prueba                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| El repartidor podía confirmar el cobro y después marcar «El cliente no pagó»: cancelaba, recuperaba la comisión y dejaba deuda al cliente | `clienteNoPago` exige `cobro_estado = 'pendiente'` (lectura y UPDATE)                                                                       | `internacional.test.ts`, «después de confirmar el cobro…»         |
| La propina posterior se escribía con referencia `propina-extra` y Ganancias leía `propina-extra-<pedido>`: nunca aparecía                 | Referencia `propina-extra-<pedido>`; en un pedido pagado en mano, 409 (antes 500)                                                           | `fallosCriticos.test.ts`, «la propina posterior cobrada llega…»   |
| Volver a calificar borraba la respuesta pública del restaurante                                                                           | `ON CONFLICT DO UPDATE` en vez de `INSERT OR REPLACE`                                                                                       | `restauranteMas.test.ts`, reseñas                                 |
| Cuenta de Stripe compartida: las disputas de otros negocios llegaban como de Tumbite (correo y salud en rojo)                             | Solo se guardan las de un pedido o una recarga de Tumbite; la de una recarga avisa y **no toca el saldo** (decisión de Richard)             | `devolucionesDisputas.test.ts`, «cuenta de Stripe compartida…»    |
| El equipo del restaurante (manager, staff) no veía las fotos ni el ticket                                                                 | Se acepta al miembro del restaurante del pedido                                                                                             | `internacional.test.ts`, foto del ticket                          |
| Roles decorativos: el staff podía cambiar precios, borrar platos, horarios y datos del negocio                                            | Staff: pedidos, agotar platos, abrir y cerrar. Manager: menú y horarios. Dueño: datos del negocio                                           | `restauranteMas.test.ts`, equipo                                  |
| El GPS de fondo seguía encendido después de cerrar sesión                                                                                 | La tarea se apaga sola sin sesión o con 401; Inicio la apaga al desmontarse                                                                 | `repartidorFondo.test.ts`                                         |
| Fondeo de un punto con un comprobante repetido respondía 200 sin sumar                                                                    | 409 que lo explica; punto inactivo no se fondea                                                                                             | `internacional.test.ts`, «recargas endurecidas…»                  |
| Un código de un punto desactivado se podía canjear; soporte no podía anular                                                               | El canje exige punto activo; `POST /datos/admin/codigos-recarga/:id/anular` (marca y devuelve el fondo en un lote)                          | ídem                                                              |
| Código quemado sin saldo si el lote fallaba después de marcarlo                                                                           | El reintento del mismo repartidor termina la acreditación (referencia única: una sola vez)                                                  | ídem                                                              |
| El tope semanal de recargas no valía para la tarjeta                                                                                      | Cuenta acreditadas y pendientes, también con tarjeta                                                                                        | `internacional.test.ts`, «el tope semanal…»                       |
| Entrega y cancelación al mismo tiempo: la entrega abonaba aunque el pedido ya estuviera cancelado                                         | El UPDATE de la entrega no filtra por estado: el disparador de transiciones rechaza cancelado → entregado y el lote entero se deshace (409) | `fallosCriticos.test.ts`, «entrega y cancelación al mismo tiempo» |
| La foto del ticket nunca se borraba y la anterior quedaba huérfana                                                                        | Se borra a los 30 días solo si el pedido quedó conciliado y sin reclamo; repetirla borra la anterior                                        | `internacional.test.ts`, foto del ticket                          |
| El aviso de cuentas conectadas creado a mano no se reconocía (se crearía otro) y la lista no paginaba                                     | Se reconoce por URL y evento `account.updated`; se recorren todas las páginas                                                               | `stripeAvisos.test.ts`                                            |
| Reserva de comisión en dos pasos: una caída dejaba el saldo descontado sin reserva                                                        | Las dos patas en un lote; el reintento la termina (C-RESERVA-ATOMICA)                                                                       | `internacional.test.ts`, «reserva atómica…»                       |

**Quedan abiertos (anotados en `docs/RECONCILIACION-FASE-2.md`):** qué hacer con el saldo de una recarga disputada (decisión de Richard; la recarga con tarjeta sigue apagada); monto de Stripe que no cuadra en una recarga (queda pendiente y en el registro de errores, sin alarma en el canario); emitir y anular un código y cerrar la conciliación de un pedido en mano siguen en dos pasos (con referencias únicas, sin duplicar dinero); sesiones vencidas sin purga; agregar un miembro al equipo no es atómico.

## C-LIMITE-PARAMETROS: nunca más de 100 parámetros por consulta (19 oct 2026)

- **Qué se rompió:** en staging, al pasar de 100 restaurantes en Miami, `GET /datos/restaurantes` respondía 500 y la app decía «No pudimos cargar los restaurantes». El recorrido en español falló por eso (el de inglés había pasado minutos antes, con 99). Producción tenía 5 restaurantes y habría fallado igual al llegar a 100 en una zona.
- **Causa:** Cloudflare D1 acepta como máximo 100 parámetros por consulta; la consulta de horarios y cierres armaba `IN (?, ?, …)` con un parámetro por restaurante. Lo mismo con los grupos de opciones de un menú grande. La base de pruebas (SQLite local) no tenía ese límite, así que ninguna prueba lo veía.
- **Cómo quedó:** `apps/servidor/src/trozos.ts` (`enTrozos`, trozos de 90) en `conHorarios` y `gruposDe` (`rutas/catalogo.ts`) y en la búsqueda de platos (`rutas/buscar.ts`, que también falló en staging después del primer arreglo). Las demás listas variables del servidor están acotadas (zonas, áreas de una franquicia, cuentas de diagnóstico, filtros, 100 vehículos como máximo). Además, una prueba exige que ninguna tabla llegue a 100 columnas, porque el respaldo restaura una fila con un parámetro por columna. **La base de pruebas ahora imita el límite de D1** (`pruebas/d1.ts`: más de 100 parámetros es un error), así cualquier consulta nueva que lo pase se pone en rojo sola.
- **Prueba:** `limiteParametros.test.ts` (una zona con 130 restaurantes). Rojo comprobado sin el arreglo: el mismo error que en staging.
- **No tocar:** no armar `IN (…)` con listas de largo variable sin `enTrozos`; no quitar el límite de la base de pruebas.

## C-BANDEJA-DINERO: bandeja de soporte del cobro en mano (19 oct 2026)

- **Por qué:** requisito antes de encender el efectivo o la transferencia al repartidor en cualquier país (cruce con los grandes, vacío 5). Sin ella, las diferencias, excedentes, comida perdida y transferencias por verificar quedaban en el libro sin que nadie las atendiera.
- **Cómo quedó:** `apps/servidor/src/internacional/bandeja.ts`. Los casos **salen** de lo que ya existe (pedidos, `pagos_local`, libro, recargas, disputas e `incidencias_dinero`); no hay contabilidad aparte. Tipos: transferencia por verificar, diferencia, excedente, comida pagada y no entregada, pago en el local sin confirmar, incidencia, recarga disputada, recarga sin confirmar. Cada caso trae importes y moneda, pedido, participantes, evidencias, bitácora, libro, historial, responsable, estado y «espera decisión» cuando la resolución económica es de Richard (decisiones 20 y 22, recarga disputada).
- **Acciones:** `tomar`, `nota`, `resolver` (con nota obligatoria) para todos; `excedente_devuelto` (escribe el hecho en el libro con referencia única) y `confirmar_restaurante` (confirma el pago en el local por otra vía). Cada acción queda en `casos_dinero_historial` con autor y clave de idempotencia única: un reintento no repite nada. **Ninguna acción borra movimientos ni aplica plazos, tolerancias o compensaciones no aprobadas.**
- **Rutas (solo admin):** `GET /datos/admin/bandeja-dinero`, `GET /datos/admin/bandeja-dinero/:clave`, `POST /datos/admin/bandeja-dinero/:clave/acciones`. Pantalla: superadmin → «Cobro en mano» (`apps/panel/src/panel/SuperBandeja.tsx`, nota con borrador). Canario: pieza `bandeja` en «pendiente» si hay casos abiertos.
- **Pruebas:** `internacional.test.ts` (describe C-BANDEJA-DINERO) y `SuperBandeja.test.tsx`.

## C-CONCILIACION-ATOMICA, C-RESERVA-AJUSTE y recuperación tras interrupciones (19 oct 2026)

| Qué se rompía                                                                                                                                                         | Cómo quedó                                                                                                                     | Rojo comprobado                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Recarga con tarjeta cuyo monto o moneda en Stripe no coincide: solo un `console.error`                                                                                | No se acredita y abre una incidencia única en la bandeja                                                                       | Sí                                                                                                             |
| Emitir un código: el fondo bajaba y después se insertaba el código; un corte dejaba fondo descontado sin código                                                       | Descuento y código en un lote; el código solo nace si el descuento entró                                                       | Sí (disparador que corta la inserción)                                                                         |
| Cerrar la conciliación de un pedido en mano: se marcaba «conciliado» y después se cobraba la comisión; un corte lo dejaba conciliado sin comisión y nadie lo retomaba | Comisión, deuda, excedente, pago en el local y estado en un lote; tarea del reloj `conciliacion_directa` retoma los pendientes | Sí                                                                                                             |
| Plato agotado quitado mientras un repartidor ya había aceptado el pedido en mano: se cobraba la comisión del pedido original                                          | `ajustarReservaDirecta` devuelve lo apartado de más al prepago, una vez                                                        | Sí (250 frente a 150)                                                                                          |
| Alta de un miembro del equipo desde dos restaurantes a la vez                                                                                                         | Una sola sentencia con `WHERE NOT EXISTS`                                                                                      | **No reproducible en local** (la base de pruebas no intercala las dos altas); la prueba fija el comportamiento |
| Sesiones vencidas sin purga                                                                                                                                           | Tarea del reloj `sesiones_vencidas` (500 por vuelta, vencidas hace más de un día)                                              | Prueba del comportamiento                                                                                      |

La anulación de códigos ya iba en un lote (C-RIESGOS-19OCT). Las llamadas a Stripe no se meten en lotes: cada paso con un servicio externo usa clave de idempotencia y el estado local se escribe de forma que un reintento termine el trabajo sin duplicar.

## C-MONEDA-RECORRIDO: la moneda del pedido de punta a punta (19 oct 2026)

- **Qué se rompía:** el servidor ya calculaba cada pedido con las tarifas y la moneda de su país (C-TARIFAS-PAIS), pero casi todas las pantallas seguían con `formatearDolares` y los importes escritos con `dolaresACentavos`. Un restaurante en pesos habría visto «$120.00» por un plato de 12000 pesos, y al escribir «12000» en el menú se habrían guardado 1 200 000. La app del cliente calculaba el carrito con la configuración global en dólares (`GET /datos/config-dinero`): en un país con tarifas propias el total del carrito no coincidía con el del servidor y el pedido se rechazaba con 409. Los totales del repartidor, del restaurante, de las ciudades y de las fichas del superadmin sumaban pedidos de monedas distintas en una sola cifra. Los correos del pedido y los avisos (plato quitado, oferta, propina) salían en dólares.
- **Cómo quedó:**
  - `GET /datos/config-dinero?restauranteId=…` (ahora en `rutas/catalogo.ts`, porque `internacional/tarifas.ts` importa `rutas/dinero.ts`) devuelve `{ config, moneda, pais }` con `tarifasDeZona`: EE. UU. = la global de siempre; país sin tarifas = 409 con el mensaje del servidor. Sin `restauranteId`, la global como antes.
  - El restaurante público (`aRestaurante`, lista, ficha, búsqueda de platos, admin) lleva `moneda` (la de su zona, leída en `conHorarios`). Los cupones destacados y los del superadmin llevan la moneda de su zona o de su restaurante.
  - `@tumbite/compartido`: `montoEscrito(texto, moneda)` (en USD es exactamente `dolaresACentavos`; con pesos «12.000» y «12000» son 12000), `totalesPorMoneda` y `formatearTotales` (dólares primero, nunca mezcla).
  - Cliente: menú, carrito (con las tarifas del país del restaurante, guardadas junto al restaurante para el que se pidieron; fuera del dólar el desglose solo se muestra con esas tarifas cargadas), propina «otra», seguimiento, historial, cuenta, búsqueda, aviso de pago, ofertas y reembolsos de una queja, en la moneda del restaurante o del pedido. El envío estimado de la lista (tarifa base de EE. UU.) solo se muestra en restaurantes en dólares.
  - Restaurante (app y panel): menú (escribir y mostrar en su moneda; con pesos, sin decimales), pedidos, estadísticas, tablero, regalos y ventas del día. `resumen` y `tablero` solo cuentan pedidos en la moneda del restaurante y la devuelven.
  - Repartidor: oferta, pedido activo y agrupados en la moneda de cada pedido; `GET /datos/repartidor/ganancias` devuelve `totalesPorMoneda` (`totales` queda en la primera moneda: en EE. UU., los dólares de siempre); la campana lleva la moneda de cada propina.
  - Superadmin: lista y ficha del pedido (devolución escrita en la moneda del pedido con `textoAMonto`, que en USD es el mismo cálculo de antes), fichas de repartidor (`porMoneda`), cliente (`gastadoPorMoneda`) y restaurante (su moneda); métricas de ciudades y franquicias solo en la moneda de la ciudad (`metricas.moneda`). La conciliación dice «con tarjeta, en USD».
  - Servidor: recibo al cliente y aviso al restaurante con `moneda` (además el recibo ahora sí lee `impuesto`), oferta al repartidor, plato quitado y propina posterior en la moneda del pedido.
  - Docs: una línea en «Pagar al recibir», «Tu menú» y «Ganancias con desglose» (es/en): los montos van en la moneda de la ciudad, en las ciudades donde Tumbite opere.
- **Lo que sigue en dólares a propósito (Stripe solo cobra en USD):** billetera del restaurante y del repartidor (saldo, retiros, movimientos, «Hoy» del repartidor, que sale de los movimientos), retiros, liquidaciones y disputas del control de dinero, avisos de abono fallido y disputas por correo, la configuración global (son las tarifas de EE. UU.) y la calculadora pública.
- **Pruebas:** `apps/servidor/src/monedaRecorrido.test.ts` (8): tarifas por restaurante (US = global; CO con tarifas = las de CO y COP; CO sin tarifas = 409; restaurante inexistente = 404); `moneda` en el restaurante público, la lista y la búsqueda; el carrito calculado con esas tarifas da el mismo total que el servidor en USD y en COP (y con la global el servidor lo rechaza); ganancias, tablero, resumen, fichas y ciudades por moneda; correos y avisos en pesos sin decimales y en dólares igual que antes; y la prueba estática que exige que ninguna pantalla de cliente, restaurante, repartidor, paneles ni piezas móviles use `formatearDolares`, `dolaresACentavos` o `centavosATexto` (salvo Billetera, AdminDinero y Calculadora). `packages/compartido/src/dinero.test.ts`: `montoEscrito` y totales por moneda. **Rojo comprobado** quitando cada arreglo (ruta, moneda del restaurante, correo, ganancias, ciudades, tablero, pantalla en dólares, pesos con puntos de miles).
- **Huecos anotados (no se tocaron: son lógica de dinero o validación del servidor, deciden Richard y su equipo):** el bono de la oferta abierta (`BONO_OFERTA_ABIERTA`, 100) es fijo y se aplicaría como 100 pesos; las opciones de un plato tienen un máximo de 10000 (unidad menor) y la propina de 50000: con pesos se quedan cortos; los cupones globales (sin zona ni restaurante) y el tope de reembolso de quejas son un solo número para todos los países.
- **No tocar:** no volver a `formatearDolares`/`dolaresACentavos` en pantallas de pedidos (la prueba estática salta); no calcular el carrito con la configuración global para un restaurante de otro país; no sumar montos de monedas distintas en una sola cifra; no quitar el filtro `moneda = ?` de resumen, tablero, ficha del restaurante y métricas de ciudad.

## C-RESTAURACION-AISLADA: un respaldo real se restaura y la app funciona, sin tocar staging (19 oct 2026)

- `apps/servidor/src/restauracionAislada.test.ts`: copia la base del recorrido local (una corrida completa, con pedidos, libro y cobro en mano), la respalda con el mismo `respaldarBase` de producción, la restaura con `restaurarDesdeRespaldo` en una base nueva y comprueba: mismas filas tabla por tabla (salvo `sesiones`, que no se respaldan a propósito), `PRAGMA foreign_key_check` vacío, mismos saldos del libro por cuenta, bolsillo y moneda, salud en verde, la lista de restaurantes responde y una cuenta real del recorrido entra y ve sus pedidos.
- Corre solo si existe la base del recorrido (en CI se salta). Para repetirla: `node scripts/recorrido/preparar.mjs`, una corrida del recorrido y `npx vitest run apps/servidor/src/restauracionAislada.test.ts`.
- Comprobado el 19 oct 2026 con la base del recorrido de ese día. **No reemplaza** una restauración en staging (con su R2 y su D1 reales), que sobrescribe los datos de pruebas y espera la autorización de Richard.
- **Alcance exacto (19 oct, noche).** Verificado sobre la base: filas de cada tabla, llaves foráneas, saldos del libro por cuenta, bolsillo y moneda, disparadores recreados, salud, lista de restaurantes, entrada de una cuenta real y sus pedidos. **No verificado:** (1) los archivos del almacén (fotos de entregas y tickets, documentos de identidad): el respaldo copia solo la base, no el almacén; si se pierde el almacén, esas fotos no vuelven; (2) las variables y secretos del sitio (no están en la base; se recuperan del panel de YaDominios y del llavero); (3) el entorno alojado: la restauración real corre en el D1 de YaDominios en un solo lote, y no se probó su tamaño máximo ni su tiempo con la base de staging; (4) la recuperación operativa: cuánto tarda de punta a punta, quién la decide y cómo se avisa; (5) las sesiones no se restauran (todos vuelven a entrar). Los puntos 1, 3 y 4 son los que comprueba la restauración real en staging cuando Richard la autorice; el 1 además necesita decidir si se respalda el almacén.

## C-SESION-REINTENTA: un corte puntual no deja la app en «No pudimos confirmar tu sesión» (19 oct 2026)

- **Qué pasó:** en staging, un corte de conexión del alojamiento hizo fallar una vez la consulta de la sesión al abrir el buscador; la app del cliente mostró «No pudimos confirmar tu sesión» y se quedó ahí hasta que alguien tocara «Reintentar». El recorrido se agotó por tiempo esperando.
- **Cómo quedó:** `confirmarSesionConReintentos` (`packages/compartido/src/confirmarSesion.ts`): reintenta sola dos veces (0,8 s y 2,5 s) si no se pudo confirmar por red, servidor o tiempo; un 401 o 403 no se reintenta. `packages/movil/src/sesion.tsx` la usa. La pantalla de reintento sigue existiendo si los tres intentos fallan.
- **Pruebas:** `confirmarSesion.test.ts` (corte puntual, 401 sin reintento, tres cortes) y la comprobación de que las apps la usan.

## C-COBRO-DIRECTO-STAGING: el cobro en mano se recorre completo también en staging (19 oct 2026)

- `e2e/recorrido/recorrido.spec.ts`, paso 18: ya no es solo local. Enciende el efectivo, la transferencia y las recargas en EE. UU. solo durante la corrida y los apaga al final (`finally`). Pantalla: recarga por código, oferta con «efectivo» y adelanto (`oferta-cobro-en-mano`), aviso de cobro del restaurante, pago en el local y ticket. Por las rutas del producto: recogida y entrega en la puerta (con la excepción autorizada si el pedido no tiene coordenadas), «Cobré» y conciliación; transferencia pendiente (caso en la bandeja) y confirmada; cliente ausente con lugar seguro rechazado, «El cliente no pagó» y pérdida; bandeja con tomar y nota, y su pantalla en es/en.
- Con más de cien restaurantes en staging la lista es virtual: la prueba busca el restaurante por su nombre, como una persona. No se esperan tiempos fijos: se espera la condición (llegada confirmada, estado del pedido).
- Verde en staging el 19 oct (corrida 39310077342).

## C-TOPES-PAIS: topes por país y moneda; un país incompleto no se enciende (19 oct 2026)

- **Qué se rompía:** cinco cifras eran únicas para todos los países, en dólares: bono de la oferta abierta (100), precio máximo de una opción (10000), propina máxima (50000) y propina posterior (100 a 10000), monto de cupones (cupones sin ciudad valían en cualquier país) y el tope del reembolso automático por queja. En pesos no servían.
- **Cómo quedó:** `ConfigPais.topes` (`internacional/paises.ts`) y `topesDePais` / `topesDeZona` (`internacional/tarifas.ts`). **Estados Unidos lee las mismas cifras de siempre** (`TOPES_EEUU`; el tope de quejas, el que fija soporte). Otro país usa los suyos, en su moneda. Se aplican en: el despacho (bono), las opciones del menú, la propina al pedir, la propina posterior, la creación y validación de cupones (sin ciudad = solo EE. UU.) y las quejas.
- **País incompleto:** sin tarifas o sin topes no se enciende ningún método de pago ni recarga (409 con el campo que falta), no se activa una ciudad de ese país y no recibe pedidos. Un intento rechazado no guarda nada a medias.
- **Superadmin:** Dinero → país → «Tarifas del país» y «Topes del país» (`TarifasTopesPais.tsx`), en la moneda del país, con el aviso de qué falta y borrador de lo escrito. EE. UU. no se edita ahí.
- **App del cliente:** la propina posterior (con tarjeta) solo se ofrece en pedidos pagados con tarjeta.
- **Cifras:** ninguna para Colombia o Venezuela; las fija Richard. Las de las pruebas son ficticias y viven solo en `apps/servidor/src/pruebas/paisPrueba.ts`.
- **Pruebas:** `topesPais.test.ts` (EE. UU. idéntico; país incompleto; país con topes), `TarifasTopesPais.test.tsx`, y las de tarifas y moneda ajustadas. Rojo comprobado quitando cada parte.

## C-BANDEJA-PAGINAS: la bandeja no esconde casos; textos del sistema en el idioma de la pantalla (19 oct 2026)

- **Qué se rompía:** cada tipo de caso se cortaba en 500 filas sin orden y los resueltos se quitaban después: con muchos casos, uno abierto podía quedar fuera de la vista sin aviso. El detalle de una incidencia (texto del sistema) salía en español aunque la pantalla estuviera en inglés.
- **Cómo quedó:** `listarCasos` (`internacional/bandeja.ts`) cuenta el total por tipo y pagina dentro de cada tipo (50 por página, los más viejos primero), filtrando los resueltos EN la consulta; responde `{ casos, totales, hayMas }`. Un caso se busca por su clave sin recorrer la bandeja. La pantalla muestra el total en cada pestaña, «Ver más casos» y, sin tipo elegido, avisa que hay más. El texto de una incidencia conocida se arma en los dos idiomas desde los datos; el detalle guardado queda como registro original. Las notas de soporte se muestran tal como se escribieron, marcadas como tales.
- **Pruebas:** `internacional.test.ts` («la bandeja no esconde casos: 120 de un tipo…», rojo comprobado con la versión anterior) y `SuperBandeja.test.tsx`.

## C-MIEMBRO-UNICO: una persona en un solo equipo, garantizado por la base (19 oct 2026)

- **Evidencia:** la carrera (dos dueños agregan a la misma persona a la vez) se probó 25 veces contra el motor real de la base en el servidor local de Cloudflare (`e2e/recorrido/carreras.spec.ts`): gana uno y el otro recibe 409. **Con el código anterior (comprobar y después insertar) tampoco se reprodujo en local**: en ese motor las dos altas no se intercalan. Por eso la protección no se apoya solo en la sentencia única: se agregó `miembros_restaurante_una_persona`, un índice ÚNICO sobre `usuario_id` en `schema.sql`, que la base hace cumplir aunque las escrituras se intercalen.
- **Antes de agregarlo** se consultó (solo lectura) que en producción y en pruebas nadie estuviera en dos equipos: 0 miembros en ambas. Si algún día hubiera duplicados, `schema.sql` fallaría al publicar y lo diría.
- **Ser dueño y miembro a la vez** lo impide la sentencia (`NOT EXISTS` en restaurantes), no el índice.
- **Pruebas:** `restauranteMas.test.ts` (la base rechaza un segundo equipo; rojo comprobado quitando el índice) y la carrera local.

## C-RECORRIDO-INTERNACIONAL y C-PAIS-DEL-RESTAURANTE: el cobro en mano en pesos y bolívares (19 oct 2026)

- **Recorrido:** `e2e/recorrido/internacional.spec.ts`, **solo en esta computadora** (base local de `.recorrido`; se salta en staging). Crea un país y una ciudad de prueba con tarifas y topes **ficticios** (solo en esa prueba y en esa base), lo apaga al terminar, y aísla cada corrida (desconecta repartidores y cancela pedidos colgados de esa ciudad de prueba). Capturas en `.recorrido/capturas-internacional/` (fuera de git, de la web y de Docs).
- **En pantalla, en COP (español) y VES (inglés):** el menú y el carrito con la moneda; «Efectivo al recibir» (y sin «Tarjeta», que solo cobra en dólares); la oferta con «efectivo» y el adelanto; aceptar la oferta; el pago en el local escribiendo pesos o bolívares; «Cobré» en la puerta; la bandeja de soporte en esa moneda. **Por la API del producto:** país incompleto rechazado, recarga y canje, reserva de comisión en la unidad menor, listo, recogida, llegada con GPS, entrega, transferencia pendiente con excedente, pago de menos con deuda, cliente ausente con pérdida, conciliación del día por moneda.
- **Defectos que encontró y quedaron arreglados:** (1) la ruta del pago en el local no devolvía la moneda: la app caía en dólares y multiplicaba los pesos por cien; (2) el carrito preguntaba las formas de pago por la ciudad guardada del cliente y no por la del restaurante (un cliente nuevo nunca veía el efectivo de su país); (3) las tarifas de un país no aceptaban montos de más de 100 000 unidades (en bolívares no cabía un envío máximo de 1 200); (4) el carrito ofrecía «Tarjeta» en pesos aunque el servidor la rechaza.
- **Pruebas:** el recorrido, `topesPais.test.ts` (país del restaurante, montos amplios) y las comprobaciones de piezas de `internacional.test.ts`; rojo comprobado de cada arreglo de servidor.
- **Lo que NO prueba:** staging con zonas de otro país (falta permiso para crearlas allí), teléfono real, cifras reales (no existen), dinero real, pasarelas locales.

## C-ERRORES-VISIBLES y C-FOTO-RECOGIDA-REINTENTO: cada error no controlado queda escrito (20 oct 2026)

- **Qué se rompió:** el 19 oct en staging (corrida 39327502810) la foto de recogida respondió 500 y no había forma de saber por qué: `app.onError` solo hacía `console.error` y el alojamiento no conserva la consola. Informe completo: `docs/INCIDENTE-FOTO-RECOGIDA-2026-10-19.md`. **Causa sin confirmar.**
- **Qué se hizo:** `apps/servidor/src/errores.ts` guarda cada 500 en `errores_servidor` (método, ruta, mensaje, seis renglones de pila; máximo 1000 filas; nunca el cuerpo). Pieza `errores` en `/datos/salud` («pendiente» si hubo errores en la última hora; no tumba la salud). Ruta `GET /datos/admin/errores` (los UUID salen como `:id`). Tabla «Errores del servidor» en el resumen del superadmin. El verificador «después» exige la pieza y avisa si está en pendiente.
- **Si guardar el error falla**, se escribe en la consola y la respuesta sigue siendo el 500 normal: nunca se tapa el error original.
- **Pruebas:** `operacion.test.ts` «C-FOTO-RECOGIDA-REINTENTO» (inyecta la falla con un disparador después de guardar la evidencia, exige 500 + error escrito + canario pendiente, y que el reintento responda 200 sin duplicar la evidencia); comprobada en rojo quitando `guardarError`. `Superadmin.test.tsx` «C-ERRORES-VISIBLES».
- **No tocar:** el `async` de `app.onError` ni el `catch` alrededor de `guardarError`.

## C-RESTAURACION-SIEMPRE: la restauración se prueba en cada corrida, con datos fijos (20 oct 2026)

- **Qué estaba mal:** la prueba de restauración (C-RESTAURACION-AISLADA) solo corría si existía la base del recorrido local; en CI y en una computadora nueva se saltaba y `npm run verify` quedaba en verde sin haber restaurado nada.
- **Qué se hizo:** `restauracionAislada.test.ts` tiene ahora dos partes. **Completa (siempre corre):** arma por la API un restaurante, un cliente, un repartidor y dos pedidos entregados con su dinero, respalda con el código de producción, restaura en otra base y exige mismas filas por tabla, ninguna llave rota, el mismo libro, la misma billetera por persona, la salud en ok y que el cliente entre y vea sus pedidos (`pruebas/restauracion.ts`). **Parcial (con la base del recorrido):** si no hay corrida, se salta con el texto «NO EJECUTADA», nunca en silencio.
- **Comprobada en rojo:** quitando una tabla del respaldo, falla con «movimientos: 6 → 0».
- **Lo que sigue sin probar:** la restauración sobre la base real de staging (espera autorización: sobrescribe datos) y los archivos del almacén (no se respaldan hoy; ver `docs/RECUPERACION-COMPLETA-2026-10-20.md`).

## C-RECORRIDO-AISLADO: el recorrido en pesos y bolívares solo toca lo suyo (20 oct 2026)

- **Qué estaba mal:** para no chocar con corridas anteriores, `internacional.spec.ts` desconectaba a TODOS los repartidores y cancelaba TODOS los pedidos pendientes de la ciudad de prueba con SQL directo, y al final apagaba el país en vez de devolverlo como estaba.
- **Qué se hizo:** cada corrida crea su propia ciudad (`CO-DC-P<corrida>`, `VE-DC-P<corrida>`); antes apaga por la API solo las ciudades de prueba anteriores con su mismo prefijo (el despacho nunca cruza de ciudad, así que lo viejo no interfiere y no se modifica). Guarda la configuración del país al empezar y la devuelve igual al final. En un `finally` desconecta a su repartidor, cierra su restaurante y apaga su ciudad, aunque la prueba falle, y exige que esa limpieza salga bien. Sin SQL en todo el archivo salvo, en staging, volver admin a la cuenta del equipo de la corrida (como el recorrido principal).
- **Staging:** solo con `RECORRIDO_INTERNACIONAL=autorizado`; sin esa variable se salta con «NO EJECUTADA en staging». La variable NO está puesta en el flujo de CI: espera la autorización de Richard (solicitud del 20 oct, grupo «datos de prueba en staging»).
- **Comprobado:** dos corridas locales verdes (COP en español, VES en inglés) el 20 oct; al terminar, las cuatro ciudades de prueba quedaron apagadas y los tres países con el cobro en mano apagado.

## C-BORRADO-VEHICULO: borrar la cuenta borra también los documentos del vehículo (20 oct 2026)

- **Qué estaba mal:** al borrar la cuenta se vaciaba la carpeta de identidad (`kyc/<persona>/`) pero no la de los documentos del vehículo (`vehiculos/<persona>/`: registro, seguro, fotos de la placa). Además la lista del almacén se leía una sola vez (máximo 1000 claves).
- **Qué se hizo:** `cuentas.ts` recorre las dos carpetas con paginación y deja `vehiculo_documentos.clave` vacía. Encontrado al inventariar el almacén (`docs/RECUPERACION-COMPLETA-2026-10-20.md`).
- **Promesa rota:** la política de privacidad (es y en) y la página de borrar la cuenta ya decían que se borran «tu vehículo, licencia y seguro».
- **Prueba:** `borradoVehiculo.test.ts`, comprobada en rojo quitando la carpeta del vehículo; un archivo de otra persona no se toca.

## C-MARCA-DIVOOX: el nombre visible es Divoox; lo interno sigue siendo Tumbite (22 oct 2026)

- **Decisión de Richard:** Divoox es la marca pública; Tumbite queda como nombre interno del proyecto. Solo se cambió el texto visible (web, Docs, legales, apps, correos, avisos, nombres de las apps). Imágenes, logos y capturas se cambian después, con el logo nuevo.
- **Qué se hizo:** se reemplazó la palabra «Tumbite» escrita sola por «Divoox» en apps, paneles, servidor, paquetes y pruebas (798 cambios en 116 archivos, rama `marca-divoox`). **No se tocó:** nombres internos pegados a otras palabras (`seguroTumbite`, `CUENTA_TUMBITE`, `conTumbite`…), claves guardadas en el navegador (`tumbite.idioma`, `tumbite.sesion`), la cuenta interna del libro (`'tumbite'`), las tablas, los identificadores de las apps (`com.windoce.tumbite…`), el sitio de pruebas y los dominios y correos `@tumbite.com` (siguen funcionando hasta que divoox.com esté registrado y con correo).
- **Trampa encontrada:** el título de la pestaña y el prerender buscaban «tumbite» en minúscula para no repetir la marca (`/tumbite/i`); se cambió a `/divoox/i`. La prueba `tituloPagina.test.tsx` lo cubre.
- **Cuando divoox.com esté listo:** cambiar las direcciones y correos visibles de tumbite.com a divoox.com y redirigir tumbite.com.

## C-RECORRIDO-REINTENTA-RED: un corte de conexión del alojamiento no tumba el recorrido (22 oct 2026)

- **Qué pasaba:** en el sitio de pruebas, llamadas a la API del recorrido fallaban de vez en cuando con «read ECONNRESET» (corte de conexión del alojamiento, no de la app). El 22 oct falló dos veces seguidas el recorrido en inglés, en lugares distintos.
- **Qué se hizo:** `e2e/recorrido/fixtures.ts` envuelve el `request` de Playwright y agrega `maxRetries: 3` a cada llamada. Playwright reintenta SOLO errores de red, nunca una respuesta 4xx o 5xx: un fallo real de la app sigue fallando. `recorrido.spec.ts` e `internacional.spec.ts` importan `test` de ahí.
- **Ojo en local:** si se corre el recorrido varias veces sin preparar la base, se acumulan restaurantes con el mismo nombre y la prueba falla por «strict mode». Se arregla con `SIN_COMPILAR=1 node scripts/recorrido/preparar.mjs`.

## C-IDENTIDAD-DIVOOX: la identidad visual sale solo de los vectores aprobados (23 oct 2026)

- **Archivos maestros:** `identidad-divoox/` (manual de marca v1, seis SVG aprobados, PNG, favicon). No se editan.
- **Generador:** `node scripts/marca/generar-identidad.mjs` produce TODAS las piezas: logo y variantes SVG de la web (`apps/panel/public/marca/divoox-*.svg`), favicon, íconos de la web, tarjeta para redes (`og.png`), íconos de las tres apps (cliente fondo rojo, repartidor negro, restaurante blanco; adaptativos y monocromo de Android), logo de la cabecera de cada app y la mascota vieja reemplazada por el isotipo. Todo con `object-fit: contain`: nada se estira.
- **Dos ajustes, sin tocar trazos:** (1) la «palabra sola» se guarda sin los trazos del isotipo que el SVG tenía fuera del recuadro (aparecían si se estiraba); (2) sobre fondo rojo, el isotipo para fondo oscuro perdía el punto rojo (su anillo es transparente): se pone un disco blanco solo dentro del hueco, como el ícono rojo del manual.
- **Regla del manual:** el logo completo para fondo oscuro lleva la X roja: nunca sobre rojo (en la portada, las placas rojas llevan solo el isotipo blanco).
- **Colores:** rojo `#F20D20`, acento `#C20A1A`, negro `#101010`, gris `#666B73` (`packages/compartido/src/marca.ts` y CSS).
- **Fotos de marketing con la marca vieja** (banners, cartel, local, entrega, repartidor): ya no se muestran; en su lugar van placas con el logo (`PlacaMarca` en `Landing.tsx`) hasta que marketing entregue fotos nuevas.
- **Capturas:** rehechas con `npm run recorrido:capturas` (158 capturas para Docs y la portada).

## C-DOMINIO-DIVOOX: divoox.com es la dirección principal (23 oct 2026)

- divoox.com registrado y conectado al sitio el 23 oct. `apps/servidor/src/dominio.ts`: las páginas pedidas en tumbite.com, www.tumbite.com o www.divoox.com pasan con 301 a https://divoox.com con la misma ruta; `/sitemap_index.xml` (mapa viejo del dueño anterior) lleva a `/sitemap.xml`.
- **No se redirige** `/datos/*` (apps compiladas y aviso de Stripe siguen llamando a tumbite.com; un 301 rompería un POST) ni `/media/*`. El sitio de pruebas sigue en staging.tumbite.com.
- Canónica, Open Graph, mapa del sitio, robots, pie, legales, Docs y enlaces de los correos en divoox.com; variable `SITIO_URL=https://divoox.com` en producción. Desde el 23 oct la web y los avisos muestran el buzón go@windoce.com (decidido por Richard el 23 oct; prueba: webHonesta.test.tsx). El REMITENTE de los envíos sigue en tumbite.com hasta verificar divoox.com en el proveedor de correo. Ojo: el 23 oct ni divoox.com ni tumbite.com tenían registros MX, así que el buzón de soporte no recibe correo hasta activar el reenvío.
- El semáforo de `publicar.yml` y el verificador de producción consultan divoox.com (curl sin -L se quedaba en el 301).
- **Ojo (visto en vivo el 23 oct):** la plataforma sirve «/» y las páginas prerenderizadas directo, sin pasar por el servidor, así que el 301 solo alcanza a las rutas que no son archivos. Por eso `apps/panel/public/dominio.js`, cargado al principio del `<head>` de `index.html` (y de todas las páginas prerenderizadas), hace el mismo salto en el navegador con la misma lista. La etiqueta canónica ya dice divoox.com para los buscadores.
- Prueba: `dominio.test.ts` (comprobada en rojo quitando el filtro).
- Desde el 25 oct la etiqueta canónica que pone el servidor sale de `urlCanonica` (divoox.com, prueba en rojo comprobada) y las apps de producción llaman a https://divoox.com (`eas.json`); la API sigue respondiendo también en tumbite.com para las apps ya instaladas. La prueba del salto del navegador ejecuta `dominio.js` con cada dominio de `SECUNDARIOS` y exige divoox.com (comprobada en rojo quitando www.divoox.com).

## C-SESION-REINTENTA-SOLA: la app reintenta sola cuando no puede confirmar la sesión (23 oct 2026)

- Qué pasaba: con un corte de conexión al abrir la app, la persona quedaba en «No pudimos confirmar tu sesión» hasta tocar «Reintentar» (se vio en el sitio de pruebas, corrida 40005515113).
- Arreglo: `packages/movil/src/ConSesion.tsx` (`SesionSinConfirmar`) reintenta en silencio con esperas de 3, 6, 12, 24 y luego cada 30 segundos (`ESPERAS_REINTENTO_MS`); `reintentarSesion(true)` en `sesion.tsx` no pasa por la pantalla de carga para que no parpadee. El botón «Reintentar» sigue. Línea nueva `reintentandoSolo` en los textos.
- Prueba: `e2e/recorrido/sesion.spec.ts` corta la ruta de la sesión, ve la pantalla, devuelve la conexión y exige que la app entre sola sin tocar nada. Comprobada en rojo quitando el reintento.
- No tocar: la sesión guardada no se borra al fallar la confirmación.

## C-FORMULARIO-ANTES: a los inversionistas, primero el formulario y después el WhatsApp (25 oct 2026)

- Pedido de Richard: en campañas anteriores, un botón directo de WhatsApp trajo mensajes de gente que tocó por tocar. La página de los anuncios de franquicias (`/franchise`, `/es/franchise`, `apps/panel/src/sitio/Inversionistas.tsx`) muestra la oferta, las tres apps reales y el formulario de franquicia.
- El WhatsApp de ventas (variable `WHATSAPP_VENTAS` en el sitio, leída por `/datos/publico`) aparece SOLO después de enviar el formulario y SOLO si la persona marcó capital de 50 000 USD o más (`FormFranquicia.tsx`). Cada solicitud llega igual como caso de franquicia al panel.
- Prueba: `Inversionistas.test.tsx` (comprobada en rojo dejando el botón para cualquier capital).
- Pendiente de Richard: el número de WhatsApp de ventas. Sin él, la página funciona y solo falta el botón final.

## C-DOMINIO-WEB-APPS (27 oct 2026)

- **Qué se rompió:** en divoox.com/app, /driver y /restaurante, crear cuenta y entrar daban «Sin conexión». La web le hablaba a tumbite.com (que redirige a divoox.com) y el navegador bloqueaba la petición.
- **Causa:** `entornoDeHost` (packages/compartido/src/entornos.ts) no conocía divoox.com, así que la web caía en la dirección fija de construcción (tumbite.com).
- **Arreglo:** divoox.com y www.divoox.com son producción; `SERVIDOR_PRODUCCION` y el `URL_API` por defecto de `build:*-web` pasan a https://divoox.com. Commit b03c867 (producción, verificador «despues» en verde).
- **Candado:** entornos.test.ts exige que la web servida desde divoox.com le hable a divoox.com (comprobado en rojo).
- **Junto con esto:** casilla «Acepto los términos» obligatoria al crear cuenta (apps y panel; solo el cuadrito marca), aviso si el correo no es un correo, y cada pantalla dice qué cuenta es (cliente, repartidor, restaurante). Pruebas en PanelApp.test.tsx e idiomas.test.ts, y el recorrido de staging marca la casilla.
- **Cómo se comprueba:** abrir https://divoox.com/app/, «Crea tu cuenta»: debe decir «Cuenta de cliente», tener la casilla y crear la cuenta sin «Sin conexión».

## C-REVISORES: creación atómica y contraseñas estables (27 oct 2026)

- **Fallo:** cada clic cambiaba las tres claves; un fallo al crear el restaurante dejaba usuarios a medias. Una cuenta registrada con un correo reservado podía ser sobrescrita.
- **Causa:** escrituras secuenciales y cambio de contraseña incluido en crear.
- **Arreglo:** `POST /datos/admin/revisores` prepara las inserciones y las ejecuta en un único `DB.batch`. Las cuentas existentes marcadas conservan su clave (`clave: null` en la respuesta); las no marcadas producen 409 sin cambios. Una colisión concurrente revierte el lote. Las claves nunca se guardan en claro.
- **Rotación:** `POST /datos/admin/revisores/:rol/clave` exige admin y `{ confirmar: true }`, cambia solo esa clave y revoca sus sesiones en el mismo lote. Respuestas con claves: `Cache-Control: no-store`.
- **Panel:** bloqueo mientras hay una solicitud pendiente, claves existentes conservadas en la pantalla, cambio individual dentro de ⋮ con confirmación, accesos apilados en celular. No mandar contraseñas por chat.
- **Pruebas:** `revisores.test.ts`: acceso solo admin, tres logins, repetir sin cambiar claves, reversión por fallo, colisión concurrente, no sobrescribir cuenta ajena, rotación individual y sesiones revocadas. Los fallos de repetición/reversión/sobrescritura se reprodujeron en rojo antes del arreglo; la nueva ruta dio 404 antes de implementarla. `Superadmin.test.tsx`: doble clic, repetir, confirmación/cancelación y cuentas existentes.
- **Verificación visual local:** navegador integrado, panel real contra servidor y SQLite locales; crear y repetir, ancho 375px, consola sin errores. Captura y límites: [Acceso de revisores](docs/ACCESO-REVISORES.md).
- **Commit:** localizar por `git log --all --grep='fix(revisores): conserva claves y crea cuentas de forma atómica'`.
- **No tocar:** no volver a unir crear con cambiar claves; no quitar el lote atómico ni la revocación de sesiones.
- **Límite importante:** esto prepara identidades, NO un entorno aislado de demostración. El restaurante cerrado no garantiza aislamiento; faltan recorrido completo de revisión y comprobación en los Android entregados a Google. No considerar estas pruebas locales una validación de producción.

## C-GPS-FONDO, nota del 27 oct 2026: Android sin ACCESS_BACKGROUND_LOCATION

- Google Play solo aprueba el permiso «ubicación todo el tiempo» con un video de demostración. En
  la versión 1 el Driver de Android no lo pide: `isAndroidBackgroundLocationEnabled: false`, el
  permiso va en `blockedPermissions`, y `ubicacionFondo.ts` solo pide el permiso de fondo en iPhone.
  El servicio en primer plano con notificación (`foregroundService`) iniciado con la app abierta
  sigue mandando la posición con la pantalla apagada: expo-location no exige el permiso de fondo
  cuando hay servicio en primer plano (LocationModule.kt, `startLocationUpdatesAsync`).
- Prueba: `repartidorFondo.test.ts` (comprobada en rojo volviendo a encender el permiso).

## C-CORREOS-DIVOOX: remitente y plantilla de los correos (27 oct 2026)

- **Qué pasaba:** los correos salían de no-reply@tumbite.com con pie «tumbite.com» y una plantilla
  pobre (Richard: «confunde a la gente»; «las plantillas son feitas»).
- **Arreglo:** Richard activó «Correos desde tu dominio» para divoox.com en YaDominios Cloud. En
  `correo.ts`, `DOMINIO_CORREO = 'divoox.com'` y `remitente(env, de)` decide por `SITIO_URL`: en
  divoox.com (producción) sale de divoox.com; en staging.tumbite.com sigue tumbite.com (divoox.com no
  está conectado al sitio de pruebas y el envío sería rechazado). Plantilla única `aHtml`: logo real
  (`/marca/divoox-logo-correo.png`, generado del SVG con sharp), botón con etiqueta según la página
  (`etiquetaBoton`) y la dirección completa debajo, detalle «Etiqueta: valor» en tabla, pie con
  soporte y Windoce LLC. Commit 4208dc6 (producción, verificador «despues» en verde; correo real de
  recuperación enviado con el canario `correo: ok`).
- **Pruebas:** `recuperar.test.ts` (pie sin tumbite.com, remitente por sitio, botones y tabla,
  sin HTML colado) y `tickets.test.ts`. Comprobadas en rojo.
- **No tocar:** `DOMINIO_CORREO_PRUEBAS` mientras divoox.com no esté conectado al sitio de pruebas.
- **Revisión a fondo (27 oct 2026, pedido de Richard):** se sacaron los 28 tipos de correo que manda
  el sistema (todos pasan por `aHtml`; ninguno trae HTML propio) y se dibujaron en
  `docs/capturas/correos/`. Arreglos: el enlace al final de una frase o en la línea de abajo también
  es botón; botones «Ver la conversación» y «Responder en el panel»; idioma de botones y pie por
  `correo.idioma` o, si no viene, por `pareceEspanol` (acentos y palabras típicas), no por tres
  palabras sueltas. Para volver a revisarlos: correr las pruebas del servidor con una variable que
  vuelque cada envío a archivos y dibujarlos (procedimiento en este mismo candado).
- **De paso, el recorrido de staging:** la bandeja de dinero pagina 50 casos (los más viejos primero)
  y el inicio del cliente no muestra todos los restaurantes; staging acumulaba casos y restaurantes
  de corridas anteriores. El recorrido consulta el caso por su clave, lo resuelve al final y pausa
  los restaurantes de corridas de hace más de 30 minutos (nunca los de la corrida en curso).

## C-REVISORES, notas del 27 oct 2026 (tarde)

- **Sin selfie de control para el revisor:** `operacion.ts` (`/repartidor/conectar`) salta la selfie de
  control cuando `esRevisor`. Visto en staging con `SELFIE_CONTROL_SIEMPRE=1`: el revisor quedaba en
  409 al conectarse. Prueba en `revisores.test.ts` (comprobada en rojo).
- **Botón del superadmin, versión del otro asistente (checkpoint 13:03):** crea solo las cuentas que
  faltan en un lote atómico; repetir no cambia contraseñas; cada cuenta tiene «cambiar contraseña» en
  sus tres puntos con confirmación y cierre de sesiones; un correo existente que no es revisor da 409.
  Documentado en `docs/ACCESO-REVISORES.md`.
- **Accidente evitado para siempre:** un árbol de trabajo aparte (`git worktree`) con enlaces
  simbólicos `node_modules` → carpeta principal coló esos enlaces en un commit (`node_modules/` del
  .gitignore no cubre un enlace). Al fusionar, git reemplazó los `node_modules` reales por enlaces a sí
  mismos. Arreglo: `.gitignore` también ignora `node_modules` sin barra; se reinstaló con `npm ci`.
  Regla: en un worktree nunca enlazar `node_modules`; correr `npm ci` dentro.
- **Google Play, 27 oct:** Divoox (cliente) y Divoox Restaurants enviadas a revisión. El Driver
  espera la declaración de `FOREGROUND_SERVICE_LOCATION` (exige video en YouTube): se graba en el
  emulador con el APK de pruebas y se sube no listado a la cuenta go@windoce.com.

## C-FLEX-ESQUEMA · Divoox Flex, Fase 1: diecinueve tablas nuevas, ninguna existente tocada (27 oct 2026)

- Qué: bloque «DIVOOX FLEX · FASE 1» en `schema.sql` (antes del bloque de la Fase 3): `empresas`, `empresa_miembros`, `empresa_invitaciones`, `empresa_centros`, `empresa_conductores`, `empresa_claves`, `empresa_auditoria`, `envios`, `paquetes`, `transiciones_paquete`, `paquete_eventos`, `idempotencia_flex`, `importaciones`, `importacion_filas`, `lotes`, `lote_paquetes`, `rutas_flex`, `ruta_paradas`, `ruta_asignaciones`. Disparadores de una sola sentencia (como los de `retiros`): `paquetes_transicion_valida`, `paquete_eventos_inmutable_*`, `empresa_auditoria_inmutable_*`.
- Por qué va antes de la Fase 3: `fase3.test.ts` exige que desde «FASE 3 · EXCLUSIVIDAD» hasta el final no haya `TRIGGER` ni `BEGIN`.
- Candados: `esquemaCompleto.test.ts` (la lista de columnas regenerada con `node scripts/generar-columnas.mjs`), `flex.test.ts` (los disparadores rechazan saltos de estado y borrados de eventos).
- No tocar: `conductor_ocupacion`, `operaciones`, `pedidos`, el dinero. La Fase 2 agregará `tipo = 'ruta_flex'` a la ocupación por migración aparte. Diseño: `docs/AUDITORIA-DIVOOX-FLEX-2026.md`; resultados: `docs/DIVOOX-FLEX-FASE-1-RESULTADOS.md`.

## C-FLEX-INVITACIONES · Nadie entra a una empresa por registrar un correo

- Qué: el acceso a una empresa es SOLO por una fila activa en `empresa_miembros` (`apps/servidor/src/flex/autorizacion.ts`, `actorDeEmpresa`). Esa fila nace al crear la empresa (dueño) o al ACEPTAR una invitación: token aleatorio de 32 bytes, en la base solo su SHA-256, vence a los 7 días, uso único (`UPDATE … WHERE estado = 'pendiente'` en el mismo lote que la membresía), MISMO correo y `correo_confirmado_en` no nulo, revocable, auditado.
- Candado: `apps/servidor/src/flex/flex.test.ts` («solo el hash queda en la base…», «vencida o revocada…»), comprobado en rojo el 27 oct 2026.
- No tocar: `tieneCorreoConfirmado` en la aceptación ni el `WHERE estado = 'pendiente'`.

## C-FLEX-API · Claves de integración acotadas e idempotencia obligatoria

- Qué: `empresa_claves` guarda solo el hash y el prefijo; el secreto `dvxk_…` se devuelve una vez. Permisos de una clave ⊆ `PERMISOS_CLAVE_API` (nunca miembros, claves ni dinero: `soloPersona()` en las rutas de equipo, conductores y claves). Una clave de otra empresa responde 401 sin pistas. 60 peticiones por minuto por clave (429). Toda creación exige `Idempotency-Key` (`conIdempotencia`: reserva la clave con `INSERT OR IGNORE` ANTES de hacer nada; misma clave + mismo cuerpo = misma respuesta; otro cuerpo = 409).
- Candado: `flex.test.ts` («la clave se muestra una vez…», «límite…», «la misma Idempotency-Key…»).

## C-FLEX-PAQUETES · Custodia con máquina de estados en la base y eventos inmutables

- Qué: `transiciones_paquete` + disparador `paquetes_transicion_valida` (la base rechaza cualquier salto); el código lo repite con `puedeTransitar` (`packages/compartido/src/flex.ts`, la misma tabla). Cada evento lleva `idempotencia UNIQUE` y no se puede editar ni borrar. Crear un envío con N paquetes y sus eventos «creado» es un solo `batch`. Códigos opacos (`DVX` + 10 letras; etiqueta de 12 letras; alfabeto sin 0/O/1/I/L). El seguimiento público solo da estado y fechas.
- Candado: `flex.test.ts` («la custodia sigue la máquina de estados…», «crea un envío con varios paquetes…»), `packages/compartido/src/flex.test.ts`.

## C-FLEX-IMPORTACION · CSV en dos pasos, reanudable, sin cruzar empresas

- Qué: previsualizar valida columnas y filas, marca duplicados (en la hoja y contra `envios_referencia_unica`), guarda las filas con su error y no vuelve a previsualizar la misma hoja (`huella`). Confirmar crea solo las válidas pendientes, 100 por llamada en lotes de 10 sentencias por fila (D1), y se puede volver a llamar hasta `terminada`. Tope de filas: 500 (`FLEX_IMPORTACION_MAX`).
- Candado: `flex.test.ts` («previsualiza con errores por fila…», «rechaza una hoja…»).

## C-FLEX-PANEL · Panel de empresa en /panel/business

- Qué: `apps/panel/src/panel/flex/*` (es/en; móvil y escritorio); toda creación manda `Idempotency-Key` (`crear()` en `apps/panel/src/panel/api.ts`); el menú se arma con los permisos que declara el servidor; los formularios usan `useBorrador`; etiquetas con QR (`qrcode`) y Code 128 propio (`barrasCode128`) imprimibles; la billetera es «próximamente» sin saldos ni botones.
- Candado: `apps/panel/src/panel/flex/PanelEmpresa.test.tsx`. Visto en pantalla el 27 oct 2026 (capturas en `docs/capturas/flex/`).

## C-FRANQUICIA-CORREO-CONFIRMADO · El acceso por correo exige el correo confirmado (27 oct 2026)

- Qué se rompía: la auditoría de Divoox Flex encontró que registrar (o cambiar la cuenta a) el correo del dueño o de un manager de una franquicia sin cuenta abría su panel; lo mismo con `revisores` y `CORREOS_REVISOR` (se saltaba la regla de distancia).
- Arreglo mínimo: `rolEn`, `/mi-franquicia` y `enlazarDueno` en `rutas/franquicias.ts` solo aceptan el correo si `usuarios.correo_confirmado_en` no es nulo (el acceso por `dueno_id` sigue igual); `esRevisor` en `rutas/operacion.ts` exige lo mismo; las cuentas que crea el superadmin para los revisores nacen confirmadas (`rutas/superadmin.ts`).
- Candado: `rutas/franquicias.test.ts` («registrar una cuenta con el correo del dueño… NO abre la franquicia»), comprobado en rojo sin la corrección el 27 oct 2026; `revisores.test.ts` (cuentas confirmadas). Las pruebas que asignan por correo ahora confirman con `m.confirmarCorreo(id)`.
- No tocar: la condición `correo_confirmado_en IS NOT NULL`.

## C-FLEX-OCUPACION · Una ruta Flex = UNA sola ocupación del conductor (Fase 2, 27 oct 2026)

- Qué: `conductor_ocupacion` admite `tipo = 'ruta_flex'` con `ruta_id`. La ocupación la toman y la sueltan disparadores de `rutas_flex` (`apps/servidor/src/esquemaFlex.ts`: `rutas_flex_conductor_libre`, `rutas_flex_ocupa_conductor`, `rutas_flex_libera_conductor`, `rutas_flex_conductor_fijo`, `rutas_flex_transicion_valida`) en la MISMA sentencia que cambia el estado: dos empresas que asignan al mismo conductor a la vez no ganan las dos. Los disparadores de Comida ya rechazan un pedido si hay una ocupación que no es de comida: no se tocaron.
- Migración: `rehacerFlex` rehace `conductor_ocupacion` y `rutas_flex` si vienen de antes, SIN perder filas (patrón de `rehacerFranquicias`): suelta primero los disparadores y vistas que las usan (y las vistas que dependen de esas vistas) y `asegurarFase3` los vuelve a crear justo después.
- Ojo, lo que casi rompe la publicación: el índice único `conductor_ocupacion_ruta` NO va en `schema.sql` (schema.sql corre en cada publicación ANTES del servidor y la tabla vieja no tiene `ruta_id`). Lo crea `rehacerFlex` en cada arranque.
- Cada lote de una acción de ruta pone `ultima_clave` en el cambio de estado y todo lo demás del lote lleva `guardaClave`: si otra petición ganó la carrera, el lote perdedor no mueve ni reserva nada.
- Candados: `esquemaFlex.test.ts` (definiciones iguales a schema.sql, migración con filas, schema.sql reaplicado sobre una base vieja: comprobado en rojo devolviendo el índice a schema.sql) y `flex/flexRutas.test.ts` («dos empresas asignan al mismo conductor a la vez»: comprobado en rojo quitando el disparador de ocupación).

## C-FLEX-ESCANEO · La carga se hace escaneando, sin duplicar

- Qué: `POST /datos/v1/flex/conductor/rutas/{r}/escanear` acepta el QR `dvx:…`, el Code 128 (12 letras) o el código de seguimiento (`leerCodigoEscaneado`). Solo paquetes ACTIVOS de esa ruta (`ruta_paquetes`, un paquete en una sola ruta activa por `ruta_paquetes_activo`). Lo ajeno responde 404 sin pistas. Repetir responde `yaCargado` y el evento lleva idempotencia `escaneo:<ruta>:<paquete>`. Sin todo cargado (o marcado faltante) no se sale.
- Candado: `flexRutas.test.ts` («escaneo repetido no duplica…»). La app lee `qr` y `code128` (`apps/repartidor/src/flex/MiRuta.tsx`).

## C-FLEX-ENTREGA · Sin las pruebas exigidas no hay entrega

- Qué: `configEntrega(empresa, envío)` + `pruebasFaltantes` (`packages/compartido/src/flex.ts`): foto, PIN, firma; «sin contacto» reemplaza PIN y firma pero exige foto. Fotos y firmas van al almacén privado (`flex/<empresa>/<ruta>/<parada>/…`), en la base solo la referencia (`flex_pruebas`); se sirven solo a la empresa dueña con `cache-control: private, no-store`. El PIN se genera una vez, se guarda hash con sal (`flex_pines`) y se verifica en el servidor (5 intentos). La prueba tiene que ser de ESA parada, ruta y conductor.
- Candado: `flexRutas.test.ts` («sin la foto exigida no se entrega», «PIN…», «firma… sin contacto»). Visto en pantalla el 27 oct 2026: «El servidor no aceptó esta acción: Para entregar falta: la foto.»

## C-FLEX-DEVOLUCIONES · La devolución se completa solo con la recepción del centro

- Qué: incidencia con motivo y próxima acción (nunca marca entregado); reintento solo si la empresa lo permite o lo autorizó; lo no entregado pasa a `en_devolucion`; el conductor lo escanea al dejarlo (`traspaso_centro`); una PERSONA con `devoluciones.recibir` confirma (`registrado_centro` o `devuelto`). El cierre exige todo final o traspasado, libera la ocupación una sola vez y guarda el resumen; las recepciones posteriores lo ponen al día.
- Candado: `flexRutas.test.ts` («fallida → reintento… devolución… cierre y liberación»), ruta de 40 paquetes de punta a punta (5 eventos por paquete exactos, una sola ocupación).

## C-FLEX-COLA · La cola sin conexión de Flex no duplica ni da por hecho lo no confirmado

- Qué: `crearColaFlex` (`packages/compartido/src/flex.ts`): orden de captura, se detiene sin red, lo rechazado queda en «error» visible hasta descartarlo, un solo sincronizador a la vez; cada acción viaja con su id como `Idempotency-Key` y sus fotos con `<id>:foto`. En la app, «N acciones guardadas esperan señal».
- Candado: `packages/compartido/src/flex.test.ts` («la cola sin conexión sincroniza en orden…»).

## C-FLEX-PANEL-RUTAS · Panel de rutas operativas

- Qué: `apps/panel/src/panel/flex/PantallasRutas.tsx`: lista con filtros, detalle con asignar/ofrecer (según el vínculo del conductor), progreso en verde, paradas reordenables, incidencias con autorizar reintento, pruebas, resumen, seguimiento cada 20 s solo con la ruta activa; cancelar y retirar dentro de los tres puntos; devoluciones e incidencias; pruebas exigidas en el perfil; PIN y corrección de coordenadas en el envío. Formularios con `useBorrador`.
- Candado: `PantallasRutas.test.tsx`.

## Mensajes con datos variables (27 oct 2026)

- `MENSAJES_EN_PATRONES` en `apps/servidor/src/mensajesEn.ts` traduce mensajes con cantidades o códigos conservando los datos. Candado: `mensajesEn.test.ts`.

## C-FLEX-EVENTOS · La bandeja de eventos la escribe la base (Fase 3, 27 oct 2026)

- Qué: `flex_eventos` se llena con disparadores de `esquemaFlex.ts` (`flex_eventos_custodia` sobre `paquete_eventos`, `flex_eventos_ruta_asignada` y `flex_eventos_ruta_estado` sobre `rutas_flex`, `flex_eventos_incidencia` sobre `flex_incidencias`), en la MISMA transacción que el cambio. Repetir una petición no repite la custodia (idempotencia) y por eso tampoco el evento. Sin datos del destinatario.
- Ojo: `registrado_centro` solo es `package.returned` si el evento anterior del paquete era `en_devolucion` (el alta en el centro no cuenta). Las tablas nuevas vienen de `schema.sql`, que corre ANTES del servidor en cada publicación; en local hay que aplicarlo a mano (`npx wrangler d1 execute tumbite-local --local --file ../../schema.sql` desde `apps/servidor`) o los disparadores fallan con «no such table».
- Candado: `flex/flexFase3.test.ts` («la base deja un evento…», «volver al centro…»), comprobado en rojo quitando el disparador.

## C-FLEX-VENCIMIENTO · Las ofertas vencen solas, en el reloj existente

- Qué: `vencerOfertasFlex` (`flex/automatizacion.ts`) dentro de `TAREAS_RELOJ` (`flex_ofertas`, crítica). Reutiliza `volverABorrador` (clave + `guardaClave`): si el conductor acepta en el mismo instante, gana uno solo. Auditoría `ruta.oferta_vencida` con actor sistema; avisos a la empresa y al conductor. `flex_ofertas_por_vencer` avisa a 10 minutos, una vez.
- No tocar: no hay un segundo reloj. Candado: `flexFase3.test.ts` (vencimiento, carrera y «las tareas de Flex van en el reloj existente»).

## C-FLEX-AVISOS · Cada aviso al celular sale una sola vez y sin datos personales

- Qué: `flex/avisosFlex.ts`. Se reserva la clave en `flex_avisos` ANTES de mandar; si ya existía, no se manda. Textos es/en según la cuenta; solo el nombre de la ruta y cuántas paradas. `despues()` usa `waitUntil` (en pruebas espera en línea); un fallo nunca deshace la operación. La app abre «Mi ruta» con `useToqueAviso` (`packages/movil/src/avisos.ts`).
- Candado: `flexFase3.test.ts` («conductor y empresa reciben cada aviso una vez…»), comprobado en rojo quitando la comprobación de la clave.

## C-FLEX-INTEGRACIONES · Avisos firmados al sistema de la empresa

- Qué: `flex/integraciones.ts`. Secreto `whsec_dvx_…` mostrado una vez y guardado con AES-GCM (`FLEX_LLAVE_WEBHOOKS`; si falta, derivada del secreto del reloj, marcada `r`; sin ninguna, 503). Firma `t=…,v1=…` (HMAC-SHA256 sobre `"{t}.{cuerpo}"`), dos firmas durante la gracia de rotación. Cola `flex_webhook_entregas` (UNIQUE por destino y evento) tomada con `UPDATE … RETURNING` (dos vueltas no mandan lo mismo); esperas 1, 5, 15, 60, 180, 360, 720 min; 15 fallos seguidos desactivan (auditoría). Despacho tras cada escritura (middleware de `flex/index.ts`) y en el reloj (`flex_integraciones`, hasta 20 vueltas de reparto).
- No tocar: `redirect: 'manual'`, el registro sin cuerpos ni secretos, el 404 a lo ajeno.
- Candado: `flexFase3.test.ts` (firma, reintentos, desactivación, carrera, rotación, aislamiento), la redirección comprobada en rojo con `redirect: 'follow'`.

## C-FLEX-SSRF · Ninguna integración apunta a una red interna

- Qué: `revisarFormaDestino` + `revisarDestino` + `ipPrivada` (`flex/integraciones.ts`): solo HTTPS 443, sin usuario ni IP escritas, sin sufijos internos ni dominios propios; DNS sobre HTTPS y rechazo si alguna IP es privada o reservada (v4, v6, v4 en v6). Al registrar Y antes de cada envío.
- Candado: `flexFase3.test.ts` (bloque «anti-SSRF»), comprobado en rojo quitando la comprobación de las IP.

## C-FLEX-OPTIMIZAR · El orden sugerido nunca se aplica solo

- Qué: `optimizarRuta` (`packages/compartido/src/flexOptimizar.ts`, puro): vecino más cercano + 2-opt sin romper reglas (ventanas, urgentes), sin coordenadas al final, distancia en línea recta marcada como estimada, sin tiempos. `POST …/optimizar` no escribe; aplicar es `PUT …/orden`, que solo vale antes de salir.
- Candados: `flexOptimizar.test.ts` (12 pruebas, 150 paradas en menos de 1 s) y `flexFase3.test.ts`.

## C-FLEX-CAPACIDAD · Aviso ANTES de asignar si no cabe; lo desconocido no se inventa

- Qué: `flex_capacidad_vehiculo` (aparte de `vehiculos` de Comida), `evaluarCapacidad` (compartido) y `comprobarCapacidad` en `asignar`/`ofrecer`: `409 capacidad` salvo `confirmarCapacidad`. Sin capacidad o sin medidas: «desconocida».
- Candado: `flexFase3.test.ts` («avisa antes de asignar…»), comprobado en rojo quitando la comprobación. Visto en pantalla el 27 oct 2026: «La ruta no cabe en este vehículo: paquetes 8 de 6».

## C-FLEX-RETENCION · Nada sensible se borra sin una política aprobada

- Qué: `limpiarFlex` (`flex/automatizacion.ts`): simulación y ejecución; categorías técnicas aprobadas de fábrica; `ubicacion` y `pruebas` solo con política aprobada por una persona (`flex_retencion.aprobada = 1`); de las pruebas se borra el archivo y la fila queda con `purgada_en`; nunca una prueba de una incidencia abierta; ejecutar a mano exige simulación de la última hora; solo superadmin.
- Candado: `flexFase3.test.ts` (bloque «retención»), comprobado en rojo quitando `pol.aprobada`.

## C-FLEX-KPI · Indicadores sin dinero y sin inventar

- Qué: `GET …/operaciones` (`flex/operaciones.ts`): «a tiempo» solo sobre entregas con ventana (si no hay, `null`, nunca 100 %); duración medida, no estimada; ningún campo de dinero. Pantalla «Operación» en el panel.
- Candado: `flexFase3.test.ts` y `PantallasFase3.test.tsx`.

## C-FLEX-PANEL-FASE3 · Pantallas de la Fase 3

- Qué: `PantallasFase3.tsx` (Operación, Integraciones, Vehículos, sugerencia de orden, capacidad al asignar). Formularios con borrador; el secreto se ve una vez; lo destructivo en los tres puntos; los menús de tres puntos de Flex tienen estilo de menú (blanco, lo destructivo en rojo: `.menu-tres-puntos .cuenta-menu`). Números con coma decimal en español.
- Candado: `PantallasFase3.test.tsx` (5 pruebas). Capturas: `docs/capturas/flex/panel-fase3-*.jpg`.

## C-REVISORES-CONFIRMADOS · Las cuentas de revisión viejas se confirman con el botón del superadmin

- Qué: `POST /datos/admin/revisores` confirma el correo de las cuentas YA marcadas como revisor con su mismo rol (las creadas antes de C-FRANQUICIA-CORREO-CONFIRMADO), sin cambiar sus claves y sin tocar ninguna otra cuenta.
- Candado: `rutas/revisores.test.ts` («volver a tocar el botón confirma…»), comprobado en rojo.

## C-FIN-POLITICAS · Ninguna tarifa en el código; nunca retroactiva (Fase 4 de Flex, 27 oct 2026)

- Qué: la capa común `packages/compartido/src/finanzas.ts` (`elegirPolitica`, `calcularComision`, `tarifaUnitaria`, `desgloseServicioLogistico`) y la tabla `politicas_financieras`. Gana la más específica (empresa > ciudad > país > todos), después la prioridad. Sin política, no se cobra nada. El prepago de conductores no rige sin `revision_legal_aprobada`. Disparadores (`esquemaFlex.ts`): `politicas_financieras_inmutables`, `politicas_financieras_cierre_adelante`, `politicas_financieras_sin_borrar`.
- Candados: `finanzas.test.ts` (compartido, 11 pruebas) y `apps/servidor/src/finanzas/finanzas.test.ts` («las políticas no se editan ni se cierran hacia atrás», «la tarifa queda congelada»), comprobado en rojo quitando el control de fecha.

## C-FIN-BILLETERA · El saldo vive solo en el libro, y el libro es inmutable

- Qué: cuenta `empresa:<id>`; bolsillos `prepago`, `reservado`, `deuda_cliente`. `libro_inmutable_update/delete` (disparadores nuevos: nunca se edita ni se borra una fila del libro), `finanzas_auditoria` y `comprobantes` inmutables. Ajustes manuales solo con rol admin, su contraseña y motivo.
- Candado: `finanzas.test.ts` («ajuste manual…», «una empresa no ve la billetera de otra…»).

## C-FIN-RECARGAS · Se acredita solo con el aviso firmado de Stripe, una vez

- Qué: `crearRecargaEmpresa` (Idempotency-Key → misma recarga y mismo intento de Stripe), `acreditarRecargaEmpresa` (monto, moneda, empresa e intento tienen que cuadrar; referencia `recarga_empresa:<id>`), comprobante en el mismo lote. El navegador nunca acredita: la pantalla pregunta al servidor.
- Candado: `finanzas.test.ts` («queda pendiente hasta el aviso FIRMADO…», «no acredita si…»), comprobado en rojo con una referencia al azar y sin el control de empresa.

## C-FIN-RESERVAS / C-FIN-COMISION · Se aparta antes de salir; cada paquete se cobra una vez

- Qué: `finanzas/cobrosRuta.ts`. `reservarCobroRuta` (lote atómico que solo entra si alcanza; índice único de una reserva abierta por ruta), `sentenciasCobroEntrega` dentro del lote de la entrega (referencia `comision_flex_paquete:<paquete>`), `ajustarCobroAlSalir`, `cerrarCobroRuta`, `liberarCobroRuta` (lo liberado paga primero la deuda), `recuperarCobrosHuerfanos` en el reloj.
- Candados: `finanzas.test.ts` (ejemplo de 50 / 40 × 0,25, entrega repetida, saldo insuficiente, dos rutas a la vez, liberaciones), comprobados en rojo quitando el control de saldo y con la referencia por paquete al azar.

## C-FIN-REEMBOLSOS / C-FIN-DISPUTAS · Sin saldos negativos

- Qué: `reembolsoDeRecarga` descuenta solo la diferencia contra lo ya descontado; lo que el disponible no cubre queda como deuda y frena rutas nuevas. `disputaDeRecarga` retiene, libera o quita una sola vez cada paso.
- Candado: `finanzas.test.ts` (reembolso doble, deuda, disputa ganada y perdida), comprobado en rojo.

## C-FIN-CONCILIACION · Lo perdido se recupera y lo descuadrado se ve

- Qué: `finanzas/reloj.ts` (`fin_conciliacion` en el reloj existente): recargas pendientes contra Stripe, reservas huérfanas, invariantes del libro, pieza `billeteras` de la salud.
- Candado: `finanzas.test.ts` («recupera una recarga cuyo aviso se perdió…»).

## C-FIN-CONDUCTOR · Prepago de conductores solo con revisión legal; nunca toca lo retirable

- Qué: `finanzas/conductor.ts` (`cobrarComisionConductor`, `saldosConductor`). No está enchufado a Food. Ver `docs/REQUISITO-MONETIZACION-PREPAGO-MULTISERVICIO.md`.
- Candado: `finanzas.test.ts` (bloque C-FIN-CONDUCTOR).

## C-FIN-PANEL · Billetera y superadmin financiero

- Qué: `apps/panel/src/panel/flex/PantallasBilletera.tsx` (Resumen, Recargar con el formulario de Stripe dentro de la pantalla, Comisiones, Comprobantes con impresión, Configuración) y `apps/panel/src/panel/SuperFinanzas.tsx`.
- Candados: `PantallasBilletera.test.tsx` (5) y `SuperFinanzas.test.tsx`.

## C-LLAMADAS-CON-LIMITE · Ninguna llamada a un servicio externo espera para siempre (27 oct 2026)

- Qué se rompía: en staging, dos recorridos de Comida quedaron colgados (uno 47 minutos en «no puedo confirmar», que manda un correo al equipo). El correo, los avisos de Expo y Stripe se llamaban sin límite de tiempo: si el servicio no contestaba, la petición de la persona tampoco.
- Arreglo: `AbortSignal.timeout` en `correo.ts` (10 s, `TIEMPO_CORREO_MS`), `notificaciones.ts` (10 s) y `stripe.ts` (25 s; toda escritura a Stripe lleva clave de idempotencia, repetir es seguro). Los fallos ya se manejaban: ahora llegan a tiempo.
- Candado: `correoLimite.test.ts`, comprobado en rojo quitando el límite (la prueba se queda colgada).
- **Ampliado el 3 nov 2026:** Twilio (`sms.ts`, 10 s, `usarTiempoTwilio`) no tenía límite. El SMS de respaldo de «llegó a la puerta» sale dentro de la ubicación del repartidor: con Twilio lento, esa petición quedó colgada más de 30 s y el recorrido de staging cayó en el pedido en efectivo (no era LAN-2a). También llevan límite ahora Checkr (`antecedentes.ts`, 15 s), el DNS de las integraciones de Flex (5 s), Open Food Facts (`tiendas.ts`, 8 s) y Turnstile (`turnstile.ts`, 5 s; si no contesta se deja pasar, como antes). Candado: `smsLimite.test.ts`, comprobado en rojo sin el límite (la llamada se queda «colgado»).

## C-STRIPE-AVISO-PRINCIPAL · El aviso principal es el que recibe los pagos

- Qué: `POST /datos/interno-stripe/avisos/principal/eventos` busca el aviso de este sitio que escucha `payment_intent.succeeded` (aunque también escuche `account.updated`, como el de staging creado a mano) y le agrega los eventos que falten; nunca quita ninguno ni toca avisos de otros negocios de la cuenta.
- Candado: `rutas/stripeAvisos.test.ts`, comprobado en rojo con la regla vieja (que lo confundía con el de cuentas conectadas).

## C-PEDIDO-CON-LIMITE (27 oct 2026)

- **Qué se rompió:** en el sitio de pruebas una petición del panel quedó sin respuesta; la pantalla del superadmin se quedó cargando y el recorrido de Comida esperó «la red quieta» hasta agotar sus 15 minutos (dos corridas seguidas).
- **Arreglo:** el cliente común (`packages/compartido/src/api.ts`, `pedir`) corta a los 30 segundos (`TIEMPO_PEDIDO_MS`) y lo cuenta como «sin conexión» (estado 0), con lo escrito intacto. El recorrido ya no usa `networkidle`: espera a que desaparezca el formulario de entrar.
- **Prueba:** `api.test.ts` («una respuesta que nunca llega se corta a tiempo»), comprobada en rojo.
- **No tocar:** no volver a `waitForLoadState('networkidle')` en el panel (consulta cada pocos segundos).

## C-MOTO-SOLO-PRUEBAS · Moto existe solo en el sitio de pruebas (28 oct 2026)

- **Qué protege:** Moto de pasajeros se está construyendo (docs/PLAN-MOTO-PASAJEROS.md). Encenderla en producción sería ofrecer un servicio sin aprobación legal ni seguro.
- **Cómo funciona:** `SERVICIOS_EN_PRUEBA` en `apps/servidor/src/esquema.ts` (solo `moto`) se suma a lo implementado ÚNICAMENTE cuando la petición llega por el dominio del sitio de pruebas (`entornoDe`, en `entorno.ts`). En divoox.com la sincronización la sigue suspendiendo, `bloquearPasajeros` la rechaza y la salud de servicios dice «error» si apareciera encendida. Carro sigue bloqueado en todas partes.
- **Prueba:** `rutas/viajesPasajero.test.ts` («en producción Moto no se enciende ni se cotiza»), comprobada en rojo cambiando la condición del entorno.
- **No tocar:** no mover `moto` a `SERVICIOS_IMPLEMENTADOS` sin la orden de Richard de encender Moto en producción (con aprobación legal y aseguradora).

## C-VIAJE-PRECIO-FIJO · Tarifa versionada y cotización con precio fijo (28 oct 2026)

- **Cómo funciona:** la tarifa de cada servicio de pasajeros por ciudad vive en `tarifas_viaje` (una sola activa; cambiar = cerrar y abrir otra, con auditoría). `POST /datos/viajes/cotizar` calcula base + km + minuto, nunca menos que el mínimo, recargo dinámico acotado por el tope y redondeo de la ciudad (`packages/compartido/src/viajes.ts`), y GUARDA la cotización en `cotizaciones_viaje` con vencimiento de 5 minutos: al pedir solo viaja su id.
- **Supuesto anotado [INF]:** sin mapa de rutas todavía, distancia = línea recta × 1,3 y tiempo a 24 km/h en moto. Se reemplaza por la ruta real cuando haya llave de mapas.
- **Prueba:** `packages/compartido/src/viajes.test.ts` y `rutas/viajesPasajero.test.ts`.
- **No tocar:** no aceptar un precio que venga de la app; no editar una tarifa en el lugar (las cotizaciones viejas apuntan a la suya).

## C-VIAJE-PASOS-REALES · El conductor no cobra sin haber ido (28 oct 2026, encontrado con REA)

- **Qué estaba mal:** en las rutas del conductor de la Fase 3, «Llegué» se marcaba desde cualquier lugar, «No se presentó» al segundo de llegar y el código de inicio aceptaba intentos sin límite. No afectó a nadie (ninguna ruta creaba viajes y Moto está apagada en producción), pero con viajes reales un conductor podía cobrar un «no se presentó» sin haber ido.
- **Cómo se encontró:** comparando con REA nuestro flujo contra Namma Yatri, que valida la llegada por radio, la espera cumplida y el código (docs/investigaciones-rea/2026-10-28-moto-rea.md).
- **Arreglo (`apps/servidor/src/rutas/viajes.ts`):** «Llegué» exige ubicación del conductor de menos de 2 minutos y a 200 m o menos del punto de recogida; «No se presentó» exige que haya pasado la espera gratis de la tarifa copiada en la cotización (300 s si no hay); el código admite 5 intentos (`viajes.intentos_pin`) y después responde 429.
- **Prueba:** `fase3.test.ts` («C-VIAJE-PASOS-REALES»), tres casos comprobados en rojo quitando el arreglo.
- **No tocar:** no quitar ninguna de las tres condiciones para «que la app no se trabe»; si el GPS falla, la salida es soporte, no saltarse la regla.

## C-VIAJE-PEDIR-CANCELAR · Pedir con cotización de un solo uso y cancelar con la regla del mercado (28 oct 2026)

- **Pedir (`POST /datos/viajes`):** solo con una cotización vigente del mismo pasajero. En un solo lote se marca usada y nacen la operación y el viaje con su código de 4 dígitos; repetir el pedido devuelve el mismo viaje; un pasajero tiene un solo viaje activo a la vez. Al pedir se busca conductor de una vez. M2 es solo efectivo (la tarjeta llega en M7).
- **Cancelar (`POST /datos/viajes/:id/cancelar`):** gratis mientras se busca; con conductor, gratis durante la ventana de la tarifa contada desde la asignación; después, el cargo. Un viaje en curso no se cancela desde la app. En efectivo, el cargo y el de «no se presentó» quedan en `deudas_pasajero` (uno por viaje y motivo) para el próximo viaje.
- **Sin conductor:** a los 10 minutos buscando (desde la última vez que volvió a buscar) el reloj lo cierra como «sin conductor».
- **Prueba:** `rutas/viajesPasajero.test.ts` (M2), con el pedido único y la deuda comprobados en rojo.
- **No tocar:** el cargo sale de la copia de la tarifa en la cotización, nunca de la tarifa vigente ni de la app.

## C-OFERTA-COMPLETA · El conductor ve lo que gana antes de aceptar, y el viaje no espera al reloj (28 oct 2026)

- **Oferta:** `GET /datos/conductor/operaciones/ofertas` trae la ganancia (precio fijo menos la comisión de la política de conductor que rija para «ride»; sin política, todo), la distancia a la recogida, el destino, la distancia y duración del viaje, la moneda y la forma de pago. Así lo hace Uber Moto [DOC].
- **Despacho sin reloj:** el sitio no tiene reloj propio (el de afuera pasa cada 5 minutos). Por eso se despacha al pedir, al rechazar, al soltar el viaje y cuando el pasajero consulta su viaje sin oferta abierta. Uno a uno, el más cercano primero (equivale a un radio que crece).
- **Prueba:** `rutas/viajesPasajero.test.ts` (M3), comprobada en rojo quitando la ganancia y el redespacho.

## C-VIAJE-SEGURIDAD · Emergencia y viaje compartido (28 oct 2026)

- **Emergencia:** el pasajero (`POST /datos/viajes/:id/emergencia`) y el conductor (`POST /datos/conductor/operaciones/:id/emergencia`) tienen botón de emergencia. Queda en `emergencias_viaje` con la ubicación, le llega por correo al equipo (ADMIN_CORREOS), y la app llama al número del país (`numeroEmergencia`: 911 en EE. UU., Venezuela y México; 123 en Colombia). La app llama PRIMERO aunque falle el aviso.
- **Compartir el viaje:** `POST /datos/viajes/:id/compartir` da un enlace largo y secreto (`/ride/<código>`) que muestra el viaje en vivo sin cuenta (`GET /datos/publico/viaje/:código`). Solo se guarda la huella del código; la página no se indexa ni se guarda en caché, y deja de mostrar el viaje cuando termina.
- **Prueba:** `rutas/viajesPasajero.test.ts` (M6); el apagado al terminar comprobado en rojo.
- **No tocar:** nunca guardar el código del enlace en claro; nunca mostrar el viaje compartido después de terminado.

## C-VIAJE-COMISION · Comisión del prepago, espera y deudas en la cuenta del viaje (28 oct 2026)

- **Comisión:** donde rige una política de prepago de conductores (con revisión legal aprobada), al aceptar se aparta la comisión prevista del prepago (`reservarComisionViaje`); sin saldo, no se acepta. Al terminar se cobra para Divoox; si el viaje no se hace (cancelado, soltado, sin señal, no se presentó o no se lo quedó) vuelve al prepago. Cada pata con su referencia única `reserva_viaje:<viaje>:<conductor>:…`: repetir no duplica. Sin política (EE. UU. hoy), no se aparta nada.
- **Cuenta final (`cerrarCuentaViaje`):** precio fijo + espera pasada la gratis de la tarifa copiada + deudas pendientes del pasajero (quedan «cobradas» con el viaje que las cobró). Se calcula una sola vez.
- **Clave de idempotencia:** lleva al conductor (dos conductores con la misma clave chocaban con un 500).
- **Conciliación:** pieza `viajes` de `/datos/salud`: rojo si un viaje cerrado hace más de 10 minutos conserva comisión apartada, o si hay deudas cobradas sin su viaje.
- **Prueba:** `rutas/viajesPasajero.test.ts` (M7 y su salud), el cobro comprobado en rojo.
- **Pendiente de decisión de negocio:** en efectivo, el cargo de cancelación o de «no se presentó» lo cobra el conductor del SIGUIENTE viaje y queda en su mano; el estándar (Uber) es que vaya al conductor afectado. Se resuelve con el pago con tarjeta.

## C-VIAJE-CALIFICACION · Los dos lados califican una vez (28 oct 2026)

- `calificaciones_viaje`: una por lado y viaje, solo con el viaje terminado; repetir no la cambia. La del pasajero entra en el promedio del conductor junto con las de Comida (`/datos/repartidor/calificaciones`).
- **Prueba:** `rutas/viajesPasajero.test.ts` (M8).
- **Propina:** queda para el pago con tarjeta de los viajes (en efectivo se da en mano).

## C-FLEX-UBICACION · La ubicación exacta del destinatario, por país (28 oct 2026)

- **País:** Venezuela (ubicación confirmada obligatoria) y EE. UU. (dirección escrita basta), según el perfil de `packages/compartido/src/flexPaises.ts` (una sola pieza: «cada país es su propio sistema»).
- **Cómo funciona:** cada envío guarda `ubicacion_estado` (sin_coordenadas, pendiente, confirmada) y su fuente (empresa, importación, app del cliente, enlace del destinatario). Con teléfono o correo se vincula a la cuenta Divoox del destinatario y, si tiene UNA casa con pin, la usa. El enlace «confirma dónde recibes» (`/deliver/<código>`) se manda por WhatsApp; el código sale de un HMAC con el secreto del reloj y el vencimiento, así es el MISMO mientras dure (solo se guarda su huella). En Venezuela `rutaLista` no deja asignar ni ofrecer una ruta con paradas sin confirmar. La etiqueta lleva el punto de referencia y el código plus.
- **Fallos encontrados al tomar las capturas reales y corregidos:** (1) pedir la ubicación otra vez invalidaba el enlace que ya se había mandado; (2) si varias cuentas compartían el teléfono, el envío se le podía vincular a la persona equivocada: ahora solo se vincula por teléfono si UNA cuenta lo tiene (o por correo).
- **Prueba:** `apps/servidor/src/flex/ubicacion.test.ts` (regla de Venezuela, enlace estable y destinatario único comprobados en rojo), `packages/compartido/src/flexPaises.test.ts` (código plus contra los valores oficiales del estándar), `apps/servidor/src/rutas/lugares.test.ts`.
- **No tocar:** nunca vincular por teléfono cuando hay más de una cuenta; nunca mostrar el teléfono en el enlace público; nunca guardar el código del enlace en claro.

## C-FLEX-SEGUIMIENTO · El rastreo público no muestra datos personales (28 oct 2026)

- `/track/<código>` (web) y `GET /datos/v1/flex/seguimiento/:codigo`: solo estados y fechas. La investigación con REA del 28 oct 2026 encontró que el rastreo público de MRW devuelve el nombre y la cédula de otra persona con una guía inventada; el nuestro no muestra nombres, teléfonos ni direcciones.
- **No tocar:** no agregar al seguimiento público ningún dato del destinatario ni del remitente.

## C-DIRECCION-SUGERENCIAS · Toda casilla de dirección sugiere direcciones reales (28 oct 2026)

- **Qué se rompió:** la portada de divoox.com (y casi toda casilla de dirección) no sugería direcciones: la llave de Google solo estaba conectada a la página del destinatario de Flex. Richard probó escribiendo «30080 Montmor» y no salió nada.
- **Arreglo:** una sola pieza para web y apps (`useSugerenciasDireccion` en `packages/compartido/src/lugares.ts`; `CampoDireccion` en la web y en `packages/movil`). Conectada en: la portada, el carrito de comida, cambiar la dirección de un pedido, Moto (recogida y destino), «Mis paquetes», el envío de Flex, los centros de Flex y el local del restaurante. Con país en la pantalla (Flex), solo ese país; sin país (portada, app del cliente) se busca en todo el mundo y el país de la conexión (`cf-ipcountry`) solo va primero (`regionCode`). Limitarlo a la conexión escondía Venezuela a quien buscaba desde EE. UU. (visto por Richard el 28 oct). Guía: `docs/COMO-BUSCAR-DIRECCIONES-VENEZUELA.md`.
- **Llave:** «Divoox servidor Places» en Google Cloud (proyecto divoox-apps), solo Places API (New); topes de 2000 búsquedas y 1000 puntos al día; variable `GOOGLE_PLACES_KEY` en los dos sitios.
- **Prueba:** `packages/compartido/src/lugares.test.tsx`, `apps/panel/src/sitio/CampoDireccion.test.tsx`, `apps/servidor/src/rutas/lugares.test.ts`.
- **No tocar:** nunca una casilla de dirección suelta; nunca la llave en una app o en la web.

## C-GOOGLE-POR-SERVIDOR · La llave de Google Places nunca sale del servidor (28 oct 2026)

- `apps/servidor/src/rutas/lugares.ts`: sugerencias y punto exacto por el servidor, con tope por red y tiempo límite. Sin `GOOGLE_PLACES_KEY` la búsqueda se apaga (503) y se usa el pin. Prueba: `rutas/lugares.test.ts`.

## C-FLEX-COBRO · Cobro contra entrega en Venezuela (28 oct 2026)

- **País:** Venezuela (perfil `cobroContraEntrega`). En EE. UU. el envío con cobro se rechaza (422), también fila por fila en la importación.
- **Cómo funciona:** el envío guarda `cobro_monto` y `cobro_moneda` (USD o VES, en centavos) con `cobro_estado` pendiente → cobrado → liquidado. `POST …/paradas/:id/entregar` exige el cobro si está pendiente: método (efectivo en dólares o bolívares, pago móvil, transferencia, Zelle, punto de venta), monto completo en la misma moneda (otra moneda se acepta y queda marcada), referencia en los métodos digitales, nombre y cédula de quien paga; nunca «sin contacto». El cobro se escribe en el MISMO lote que la entrega. Reglas puras en `packages/compartido/src/flexCobro.ts`. La caja: `GET /conductor/cobros` (efectivo en la mano), `GET /empresas/:id/cobros` y `POST /empresas/:id/rutas/:rutaId/cobros/recibir` (solo personas con permiso de recibir en el centro o de finanzas; una sola vez, con auditoría). Divoox no mueve ese dinero: lo registra.
- **Fallos encontrados al tomar las capturas reales y corregidos:** un envío que ya salió seguía ofreciendo «Pedir la ubicación», «Marcar el punto» y «Generar PIN» (el servidor lo rechazaba); ahora el envío dice `ubicacionEditable` y el panel lo explica. En la app del conductor, el nombre de quien paga decía «opcional».
- **Prueba:** `apps/servidor/src/flex/cobros.test.ts`, `packages/compartido/src/flexCobro.test.ts` y la caja en `apps/panel/src/panel/flex/PantallasRutas.test.tsx`, comprobadas en rojo.
- **No tocar:** nunca permitir entregar un envío con cobro pendiente sin registrarlo; nunca «sin contacto» con cobro; el «recibí el efectivo» nunca desde una clave de API.

## C-FLEX-TASA · Doble moneda con la tasa del día (Venezuela, 28 oct 2026)

- La tasa oficial (bolívares por dólar) se lee una vez al día de la página pública del Banco Central (`leerTasaBcv` en `packages/compartido/src/flexCobro.ts`; `apps/servidor/src/flex/tasas.ts`) y se guarda en `tasas_cambio`. Si no responde, se usa la última con su fecha (`deHoy: false`). La tasa que pone la empresa manda ese día. La caja suma todo en dólares (`enDolares`). Evidencia: `docs/investigaciones-rea/2026-10-28-tasa-bcv.md`.
- **Prueba:** `apps/servidor/src/flex/cobros.test.ts` (la página del Banco Central siempre simulada), `flexCobro.test.ts`, y la caja en `PantallasRutas.test.tsx`; comprobada en rojo.
- **No tocar:** las pruebas nunca llaman a la página real; Divoox no cambia dinero, solo muestra la equivalencia.

## C-TIENDAS-CATALOGO · Catálogo de tiendas: ficha, oferta y planilla estándar (28 oct 2026)

- **País:** todos (abre en EE. UU., Venezuela y Colombia). Estándar de DoorDash, Uber Eats, Rappi e Instacart (`docs/investigaciones-rea/2026-10-28-tiendas-fuentes-publicas.md` y `evidencia-rea-tiendas-2026-10-28.json.gz`).
- **Cómo funciona:** `restaurantes.tipo_comercio` (restaurante, mercado, conveniencia, farmacia, licores, ferreteria, mascotas, belleza, tienda) decide el servicio (`servicioDeComercio`). Ficha en `catalogo_productos` (SKU único por comercio, código de barras con dígito verificador, venta por unidad o peso, restricción) y oferta en `catalogo_ofertas` (precio en centavos, disponible, existencias, pasillo, agotado hasta). Planilla con vista previa y errores por fila (`leerPlanillaProductos`), actualiza por SKU. Rutas en `apps/servidor/src/rutas/tiendas.ts`; pantalla `apps/panel/src/panel/Productos.tsx` (`/panel/products`).
- **Fallos encontrados construyendo y corregidos:** un encabezado «codigo de barras» sin acento no se reconocía y el código se saltaba sin validar (ahora se comparan sin acentos ni espacios); los avisos de error salían en el idioma del país de la tienda y no en el de quien usa el panel.
- **No tocar:** las tiendas no salen entre los restaurantes (`tipo_comercio = 'restaurante'` en la lista y el buscador de comida); los medicamentos con receta siguen bloqueados hasta una orden legal de Richard; un producto nunca se borra.
- **Prueba:** `packages/compartido/src/tiendas.test.ts`, `apps/servidor/src/rutas/tiendas.test.ts` (rojo comprobado quitando el filtro), `apps/panel/src/panel/Productos.test.tsx`.

## C-TIENDAS-VITRINA · El cliente ve y compra en las tiendas cercanas (28 oct 2026)

- **País:** todos. Encendido SOLO en el sitio de pruebas (`SERVICIOS_EN_PRUEBA` en `apps/servidor/src/esquema.ts`: mercado, farmacia, licores, mas); en producción las rutas responden 404 «muy pronto» hasta que Richard diga en qué país abre.
- **Cómo funciona:** `GET /datos/tiendas?servicio&lat&lng` (aprobadas, de la zona y del área activa, con productos a la venta; abiertas y más cercanas primero, con el mismo «abierto ahora» de los restaurantes: horario, cierres y señal), `GET /datos/tiendas/:id` (ficha y pasillos), `GET /datos/tiendas/:id/productos` (de 50 en 50, buscador y pasillo) y `GET /datos/tiendas-buscar` (un producto en todas las tiendas cercanas). Solo se ve lo disponible hoy (`DISPONIBLE_HOY`: activo, o agotado «por hoy» que ya venció) y nunca lo que pide receta. App: `apps/cliente/src/app/stores.tsx` y `store/[id].tsx`, abiertas desde el botón «Ver tiendas cerca» del servicio.
- **Lista de activación:** en una tienda, «platos vendibles» cuenta sus productos con precio (si no, una tienda no podía abrir nunca).
- **Prueba:** `apps/servidor/src/rutas/tiendasVitrina.test.ts`, rojo comprobado poniendo `DISPONIBLE_HOY` en verdadero (un agotado salía a la venta).

## C-TIENDAS-COMPRA · Comprar en una tienda con el circuito de siempre (28 oct 2026)

- **País:** todos. `POST /datos/pedidos` mira `tipo_comercio`: en una tienda las líneas salen de `lineasDeTienda` (`apps/servidor/src/rutas/tiendas.ts`), nunca de la app. Precio de la oferta o el rebajado; agotados fuera (409); lo pesable al peso estimado (`precioEstimado`) y marcado `pesable`; alcohol y tabaco con `requiereEdad`; cada línea con `sustitucion` (reembolsar por defecto, similar o contactar). Todo lo demás (pago, repartidor, «falta un producto» con reembolso) es el de comida.
- **Regla de dinero:** «uno parecido» se entrega SIN cobrar de más; el cobro nunca sube después de pagar. Lo que falta o pesa menos se devuelve con «falta un producto».
- **La tienda lo ve:** `notaSustitucion` en el panel (`Pedidos.tsx`) y en la app del restaurante (`Inicio.tsx`).
- **Prueba:** `tiendasVitrina.test.ts` (rojo comprobado quitando la sustitución de las líneas) y `packages/compartido/src/tiendas.test.ts`.

## C-TIENDAS-CODIGO · Rellenar la ficha con el código de barras (28 oct 2026)

- **Cómo funciona:** `GET /datos/mi-restaurante/productos/codigo/:codigo` consulta Open Food Facts por el servidor (base abierta ODbL, fotos CC BY-SA, se nombra la fuente en el panel), con agente propio y tope de 30 por minuto. Solo rellena lo vacío; la tienda revisa y guarda. Si Open Food Facts no responde, se dice y se escribe a mano.
- **Prueba:** `tiendasVitrina.test.ts` («rellenar con el código de barras»), con Open Food Facts simulado: las pruebas nunca le pegan al servicio real.

## C-AVISO-PAQUETE · Avisos push al destinatario con sonido propio, no SMS (28 oct 2026)

- **Por qué:** un SMS a Venezuela cuesta 0,2257 dólares en Twilio, más que los 0,20 que cobra Divoox por caja (`docs/investigaciones-rea/2026-10-28-avisos-push-vs-sms.md`). El push es gratis.
- **Cómo funciona:** `avisarDestinatarios` en `apps/servidor/src/flex/avisosFlex.ts` avisa al destinatario vinculado (`destinatario_usuario_id`): «va en camino» al salir la ruta, «eres la próxima parada» al resolverse la anterior, «entregado» y «listo para retirar». Una vez por envío y por paso (`flex_avisos`). Sonidos propios: `apps/cliente/assets/sonidos/aviso.wav` y `apps/repartidor/assets/sonidos/oferta.wav` (hechos por Divoox), declarados en `app.json` y en `extra.sonidoAvisos`. Al tocar el aviso, la app del cliente abre «Mis paquetes» (`apps/cliente/src/AbrirAvisos.tsx`).
- **Ojo:** Android fija el sonido al crear el canal; en un teléfono que ya tenía la app, el sonido nuevo sale al reinstalar. Llega a los teléfonos con la próxima versión de las apps en las tiendas.
- **Prueba:** `apps/servidor/src/flex/avisoPaquete.test.ts`, comprobada en rojo.

## C-FLEX-RETIRO · Retiro en un punto con plazo (28 oct 2026)

- **País:** todos; la cédula se exige donde el perfil la pide (Venezuela). Como la agencia de MRW: 5 días hábiles, cédula y número de seguimiento, tercero autorizado anotado, cobro al retirar, devolución al vencer.
- **Cómo funciona:** el envío guarda `entrega_tipo = 'punto'`, `punto_centro_id`, `retiro_disponible_en` y `retiro_vence`. Sin estados nuevos (la base no deja tocar el CHECK de `paquetes.estado`): el paquete está «registrado_centro» y se agregaron las transiciones registrado_centro → entregado y → devuelto. Rutas en `apps/servidor/src/flex/retiro.ts`; pantalla `RetiroEnPunto.tsx`. Lo que va a un punto no entra a una ruta a domicilio (409).
- **Prueba:** `apps/servidor/src/flex/retiro.test.ts` (rojo comprobado quitando la comparación de la cédula), `RetiroEnPunto.test.tsx`, `flexPaises.test.ts` (5 días hábiles).
- **No tocar:** nunca entregar en el mostrador sin el número de seguimiento del envío; en Venezuela, nunca con otra cédula sin marcar el tercero.

## C-COLA-ERROR-PASAJERO · Un error pasajero del servidor no bota una entrega (28 oct 2026)

- **Qué se vio:** en la verificación de producción del recorrido, el repartidor entregó sin señal; al volver la red el servidor respondió 500 una vez y la app SACÓ la entrega de la cola (la trataba como rechazo): la foto se perdió y el pedido se quedó «en camino». Se encontró leyendo el rastro de red de la corrida.
- **Arreglo:** `sePuedeReintentar` en `packages/compartido/src/colaEntrega.ts` (sin red, 5xx, 429 y 408 se quedan y se reintentan). Lo usan la cola de comida (`apps/repartidor/src/Inicio.tsx`, también en el primer intento) y la de las rutas de paquetes (`apps/repartidor/src/flex/MiRuta.tsx`). Solo un rechazo de verdad (409, 422…) sale de la cola con su motivo.
- **Causa del 500:** no quedó registro; desde ahora la verificación en la nube muestra los errores del servidor (`playwright.recorrido.config.ts`).
- **Prueba:** `colaEntrega.test.ts`, comprobada en rojo antes del arreglo.

## C-ENTREGA-REINTENTO · Reintentar «entregado» no da error ni paga dos veces (28 oct 2026)

- **Qué se rompió y cómo se vio:** en el recorrido del sitio de pruebas, la respuesta de «entregado» se perdió en el camino; la app reintentó y el servidor contestó «Este pedido no está en camino contigo» (409) aunque el pedido YA estaba entregado. Con mala señal (Venezuela) el repartidor vería un error en la puerta. Se encontró leyendo el rastro de red del recorrido.
- **Arreglo:** `POST /datos/repartidor/pedidos/:id/entregado`: si el pedido ya está entregado por ESE repartidor, responde 200 con `yaEntregado: true`; otro repartidor sigue recibiendo 409. No se acredita nada de nuevo.
- **Prueba:** `rutas/operacion.test.ts` («de pagado a entregado, con dinero acreditado una sola vez»), comprobada en rojo.

## C-ESQUEMA-SIN-ATASCO (29 oct 2026) — todos los países

- **Qué se rompía:** en el sitio de pruebas, algunas peticiones (la sesión y el resumen del superadmin) se quedaban colgadas minutos, mientras otras contestaban al instante. Una respuesta vacía tardaba uno o dos segundos.
- **Causa:** cada servidor que arranca en frío corre la revisión del esquema (unas diez consultas a la base, varias de escritura) y TODAS sus peticiones esperan esa promesa compartida. Si una consulta se trababa, la promesa no terminaba nunca y ese servidor colgaba todo lo que le llegaba. Además, la sincronización de servicios reescribía la fecha de despliegue en cada arranque, así que la base se ocupaba con escrituras sin cambios.
- **Arreglo (`apps/servidor/src/esquema.ts`):** ninguna petición espera más de `ESPERA_ESQUEMA_MS` (8 s); una migración que pasa de `ESQUEMA_TRABADO_MS` (30 s) se descarta y se reintenta, y `ultimoErrorEsquema` lo deja visible en la salud. La sincronización de servicios solo escribe si cambió el contrato.
- **Prueba:** `apps/servidor/src/esquemaSinAtasco.test.ts` (tres casos, comprobados en rojo quitando cada parte del arreglo).
- **No tocar:** no quitar el tope de espera ni volver a escribir `desplegado_en` en cada arranque.

## C-TIENDAS-FALTANTES (29 oct 2026) — todos los países

- **Qué se rompía:** en la compra de prueba de Richard en Mercado Demo, la tienda marcó un producto como faltante y después no podía aceptar el pedido: el sistema esperaba hasta cinco minutos la decisión del cliente, aunque el cliente ya había elegido «Reembolsar» en el carrito. Además, solo se podía marcar un faltante por pedido.
- **Arreglo:** en una tienda, `/restaurante/pedidos/:id/falta` aplica en el acto la preferencia de la línea: «reembolsar» y «uno parecido» quitan el producto y devuelven su parte (`aplicarAjuste`); solo «avísame» espera al cliente. Cuando el faltante anterior quedó resuelto («quitado»), se puede marcar otro (la fila de `ajustes_pedido` se reutiliza; la historia queda en los eventos). La devolución en Stripe lleva una llave por producto (`ajuste-<pedido>-<producto>`), para que dos faltantes no choquen. En el panel y en la app de la tienda, `puedeMarcarFalta` (compartido) deja marcar el siguiente.
- **Textos:** en una tienda el carrito dice «Productos» en vez de «Comida», el seguimiento habla de «la tienda» y el panel dice «Falta un producto».
- **Prueba:** `tiendasVitrina.test.ts` («C-TIENDAS-FALTANTES»: en rojo sin el arreglo) y `tiendas.test.ts` (puedeMarcarFalta).
- **No tocar:** un restaurante sigue con un faltante por pedido y la decisión del cliente.

## C-EDAD-EN-MANO (29 oct 2026) — todos los países

- **Qué se rompía:** el carrito dejaba elegir «En la puerta» en un pedido con alcohol (visto en la compra de prueba de Richard con cerveza). Al llegar, el repartidor no podía entregarlo: el sistema exige en mano con documento.
- **Arreglo:** en `POST /pedidos`, si alguna línea `requiereEdad` y la entrega es «puerta», pasa a «mano» (con su PIN). En la app, las líneas guardan `requiereEdad`; con alcohol o tabaco, «En la puerta» sale apagada y aparece el aviso de los 21 años.
- **Prueba:** `tiendasVitrina.test.ts` («C-EDAD-EN-MANO», en rojo sin el arreglo).

## C-PUBLICAR-VERSION-EXACTA (29 oct 2026) — todos los países

- **Qué se rompía:** con dos cambios subidos seguidos, la publicación del primero bajaba el código del segundo (el `checkout` de `workflow_run` toma la punta de main) y su control la frenaba: «index.html: la web no lleva el commit …». Visto tres veces (b781d13, bff3eeb, 17103cc): el sitio de pruebas se quedaba en una versión vieja.
- **Arreglo (`.github/workflows/publicar.yml`):** un paso «revisar» publica solo si la versión verificada es la última de main (sin contar los cambios con [skip ci]); si hay una más nueva, avisa y deja que esa publique al terminar su verificación. El `checkout` baja exactamente `workflow_run.head_sha`.
- **No tocar:** nunca volver al checkout sin `ref`; nunca publicar una versión vieja encima de una más nueva.

## C-DIRECCION-CERCA (29 oct 2026) — todos los países

- **Qué se rompía:** al escribir «100 Biscayne» en el carrito, desde Miami, las primeras sugerencias eran de Canadá y Ohio. La mayoría de las casillas de dirección no mandan la ubicación de la persona, y sin ella Google no sabe qué va primero.
- **Arreglo:** `/datos/lugares/sugerencias` usa la ubicación que manda la pantalla y, si no hay, la ciudad aproximada de la conexión (`request.cf` de Cloudflare, o las cabeceras `cf-iplatitude`/`cf-iplongitude`), con un radio de 30 km como preferencia (no como límite). En el carrito, sin GPS, se usa la ubicación de la tienda.
- **Prueba:** `lugares.test.ts` («C-DIRECCION-CERCA», en rojo sin el arreglo).

## C-ENTREGA-REAL (29 oct 2026) — todos los países

- **Qué se rompió:** el detalle del pedido del cliente decía «Tipo de entrega: Dejar en la puerta» mientras arriba decía «Te lo entregaron en mano» (pedido 5A2F, con cerveza, hecho antes de C-EDAD-EN-MANO).
- **Causa:** la pantalla mostraba siempre lo que se pidió, nunca cómo se entregó.
- **Arreglo:** `entregaMostrada()` en `packages/compartido/src/entregaMostrada.ts`: si ya se entregó manda `entregadoComo` («seguro» cuenta como puerta); si no, lo pedido. La usa `apps/cliente/src/app/order/[id].tsx`.
- **Prueba:** `packages/compartido/src/entregaMostrada.test.ts` (en rojo sin la función).

## C-FOOD-POLITICAS y C-CANCELACION-POLITICA (29 oct 2026) — todos los países; EE. UU. sigue con Stripe Connect

- **Qué faltaba:** la comida en cobro directo calculaba su comisión aparte (la del país), fuera de la capa común de políticas; y al cancelar, la comisión apartada siempre volvía completa, sin regla configurable por servicio.
- **Arreglo 1:** `comisionFood()` en `apps/servidor/src/internacional/cobroDirecto.ts`. Si hay política de conductor en prepago para `food` con revisión legal aprobada, manda ella; si no, `comisionDirecta()`, igual que antes. La usan aceptar (reserva) y el ajuste por plato quitado.
- **Arreglo 2:** tabla nueva `politicas_cancelacion` (schema.sql), regla `esquemaCancelacion` y `comisionPorCancelacion()` en `packages/compartido/src/finanzas.ts` (liberar, porcentaje o fijo, antes y después de recoger; nunca más de lo apartado). `cerrarReservasPorCancelacion()` reemplaza a `liberarReservasDe` en la cancelación del gerente (`manager.ts`). `cerrarReservaCancelada()` en `libro.ts`, con referencias únicas (no cobra dos veces). Rutas del superadmin: GET y POST `/datos/admin/finanzas/cancelaciones`, auditadas; crear una nueva cierra la anterior.
- **Sin política aprobada no cambia nada:** todo vuelve al prepago del repartidor.
- **Pruebas:** `internacional/comisionFood.test.ts`; en `internacional.test.ts` las tres «C-CANCELACION-POLITICA» (en rojo con `liberarReservasDe`); `compartido/finanzas.test.ts`.

## C-CIUDADES-WEB (F17, 29 oct 2026) — todos los países

- **Qué faltaba:** el estado público de cada ciudad («Ya estamos» o «Muy pronto») estaba fijo en el código de la web; anunciar Miami exigía publicar.
- **Arreglo:** tabla `ciudades_web` (schema.sql); rutas `GET /datos/web/ciudades` (pública, caché 60 s), `GET` y `PUT /datos/admin/web/ciudades/:slug` (solo admin) en `apps/servidor/src/rutas/ciudadesWeb.ts`. La web usa `useCiudadesEnVivo()` (`apps/panel/src/sitio/ciudadesEnVivo.ts`) en el pie, las páginas de ciudad, el banner y la portada; sin respuesta del servidor manda la lista fija (todas «muy pronto»), así nunca se anuncia una ciudad por error. Superadmin → Zonas → «Ciudades en la web» (`CiudadesWeb.tsx`), con confirmación.
- **Encender la web NO abre pedidos:** eso sigue siendo la zona.
- **Pruebas:** `rutas/ciudadesWeb.test.ts`, `panel/CiudadesWeb.test.tsx`, y en `sitio/Pie.test.tsx` «C-CIUDADES-WEB» (en rojo si el gancho ignora al servidor).

## C-PEDIR-OTRA-VEZ (29 oct 2026) — todos los países

- **Qué se rompía:** «Repetir pedido» (pestaña Pedidos) armaba el carrito en el celular con el menú del restaurante: con una TIENDA no funcionaba (el menú de tiendas es otro), vaciaba el carrito sin preguntar, no revisaba las opciones y el aviso de «lo que falta» se perdía al abrir el carrito. No había «Pedir otra vez» al terminar un pedido.
- **Arreglo:** `GET /datos/pedidos/:id/repetir` (`apps/servidor/src/rutas/pedidos.ts`), solo el dueño del pedido: pasa cada línea vieja por las mismas validaciones del pedido nuevo (`lineasDeRestaurante` / `lineasDeTienda`), con el precio de HOY, y devuelve aparte lo que ya no está. En la app: `usePedirOtraVez()` (`apps/cliente/src/pedirOtraVez.ts`) pregunta antes de reemplazar otro carrito, usa `llenar()` del carrito y avisa lo que falta; lo usan la pestaña Pedidos, la pantalla del pedido entregado o cancelado y la fila «Pedir otra vez» del inicio (`apps/cliente/src/inicio/PedirOtraVezInicio.tsx`, un comercio por tarjeta, solo pedidos entregados). Docs: guía «my-orders-and-reorder».
- **Pruebas:** `rutas/pedirOtraVez.test.ts` (restaurante) y en `rutas/tiendasVitrina.test.ts` «C-PEDIR-OTRA-VEZ» (tienda, precio nuevo, agotado aparte y solo el dueño).

## C-VERIFY-SOLO-LA-ULTIMA (29 oct 2026) — infraestructura

- **Qué se rompía:** con varios push seguidos corrían tres verificaciones a la vez (más de 40 minutos cada una) y, como solo se publica la última (C-PUBLICAR-VERSION-EXACTA), producción se quedó horas en una versión vieja.
- **Arreglo:** `concurrency: verify-${{ github.ref }}` con `cancel-in-progress: true` en `.github/workflows/verify.yml`.
- **Qué NO tocar:** `publicar` sigue con `cancel-in-progress: false` (nunca se corta una publicación a medias).

## C-PEDIDO-PROGRAMADO (29 oct 2026) — todos los países

- **Qué faltaba:** solo se podía pedir «ahora». DoorDash y Uber Eats dejan programar día y franja (fuentes: preguntas frecuentes de DoorDash en sus páginas de restaurante; Uber Eats Manager y su sala de prensa).
- **Cómo quedó:** franjas de 30 minutos, desde 1 hora adelante hasta 6 días, solo con el comercio abierto y fuera de sus festivos (`packages/compartido/src/programado.ts`: `franjasProgramables`, `validarProgramado`, `textoFranja`). Columna `pedidos.programado_para` (vía COLUMNAS en `esquema.ts`). `GET /datos/restaurantes/:id/franjas` da las franjas al carrito; `POST /datos/pedidos` acepta `programadoPara` y, si viene, no exige el local abierto ni con señal AHORA.
- **Aviso «empieza a prepararlo»:** 45 minutos antes de la franja, el Manager avisa al dueño una sola vez (evento `programado_preparar` en la bitácora), como el segundo aviso de Uber Eats.
- **Tiempos:** el Manager cuenta la espera del restaurante y el «sin repartidor» desde 45 minutos antes de la franja (`manager.ts`); `repartirOfertas` no lo ofrece antes de eso y quiere la comida lista 15 minutos antes de la franja (`operacion.ts`).
- **Pantallas:** carrito «¿Cuándo lo quieres?» (`apps/cliente/src/app/cart.tsx`), tarjeta «Programado para» en el pedido, etiqueta «Programado» en el panel (`Pedidos.tsx`) y en la app del restaurante (`Inicio.tsx`). Docs: guía «schedule-an-order».
- **Pruebas:** `compartido/programado.test.ts`; en `rutas/operacion.test.ts` «C-PEDIDO-PROGRAMADO» (las dos en rojo sin el arreglo del Manager y de las ofertas).

## C-RENDIMIENTO-REST (29 oct 2026) — todos los países

- **Qué faltaba:** el tablero del restaurante no tenía horas ni días fuertes, clientes nuevos frente a los que repiten, ni cancelados (estándar de DoorDash Merchant y Uber Eats Manager).
- **Arreglo:** `rendimientoRestaurante()` (`packages/compartido/src/rendimiento.ts`, en la hora del restaurante); `GET /datos/restaurante/tablero` suma `porHora`, `porDia`, `clientes`, `canceladosMes` y `zonaHoraria`. Se ve en el panel (`TableroRestaurante.tsx`) y en la app (`apps/restaurante/src/Estadisticas.tsx`). Docs: guía «dashboard».
- **Pruebas:** `compartido/rendimiento.test.ts`, «C-TABLERO-REST» en `rutas/operacion.test.ts`, `panel/TableroRestaurante.test.tsx`.

## C-ROLES-INTERNOS (29 oct 2026) — todos los países

- **Qué faltaba:** toda cuenta del equipo (rol admin) podía cambiar todo, y no quedaba registro de quién hizo qué.
- **Arreglo:** perfiles Total, Soporte, Finanzas y Solo lectura (`packages/compartido/src/perfilesInternos.ts`, `permiteAccionInterna`). Tablas `perfiles_internos` y `acciones_equipo`. El intermedio `permisosInternos` (`apps/servidor/src/rutas/equipo.ts`, montado en `/datos/admin/*` en `app.ts`) frena con 403 lo que el perfil no permite y anota cada cambio (método, ruta, resultado). Rutas `GET /datos/admin/equipo`, `GET /datos/admin/equipo/acciones`, `PUT /datos/admin/equipo/:id` (solo Total, nunca a sí mismo). Pantalla: superadmin → «Equipo interno» (`SuperEquipo.tsx`).
- **Sin perfil guardado = Total:** ninguna cuenta existente pierde acceso.
- **Pruebas:** `compartido/perfilesInternos.test.ts`, `rutas/equipo.test.ts` (en rojo sin el intermedio), `panel/SuperEquipo.test.tsx`.

## C-INFORMES (29 oct 2026) — todos los países

- **Qué faltaba:** no había informe por rango de fechas ni forma de bajarlo para la contabilidad.
- **Arreglo:** `GET /datos/admin/informes?desde&hasta[&formato=csv]` (`apps/servidor/src/rutas/informes.ts`): por ciudad y moneda (nunca mezcla monedas), pedidos, entregados, cancelados, ventas, cobrado, propinas y lo que queda para la plataforma. El CSV escapa comas y comillas y nunca deja una celda que la hoja de cálculo lea como fórmula (`celdaCsv`). Pantalla: superadmin → «Informes» (`SuperInformes.tsx`), con el rango guardado como borrador.
- **Pruebas:** `rutas/informes.test.ts`, `panel/SuperInformes.test.tsx`.

## C-TICKETS-EQUIPO (29 oct 2026) — todos los países

- **Qué faltaba:** los tickets no tenían prioridad, nadie quedaba a cargo y cada respuesta se escribía desde cero.
- **Arreglo:** columnas `tickets.prioridad` (urgente, alta, normal, baja; por defecto normal) y `tickets.asignado_a` (vía COLUMNAS); tabla `respuestas_guardadas`. `PATCH /datos/admin/tickets/:id` acepta estado, prioridad y asignadoA (solo alguien del equipo); la bandeja ordena por prioridad y filtra `asignado=mios|sin`; `GET`, `POST` y `DELETE /datos/admin/tickets/plantillas` (declaradas antes de `/admin/tickets/:id`). Pantalla del ticket en `Superadmin.tsx`: Prioridad, A cargo de, Respuesta guardada y «Guardar este texto como respuesta».
- **Pruebas:** «C-TICKETS-EQUIPO» en `rutas/tickets.test.ts` y en `panel/Superadmin.test.tsx`.

## C-RESENAS-SUGERIDAS (29 oct 2026) — todos los países

- **Qué faltaba:** cada respuesta a una reseña se escribía desde cero (Uber Eats Manager ofrece respuestas rápidas).
- **Arreglo:** `respuestasSugeridas(estrellas, cliente, idioma)` (`packages/compartido/src/respuestasResena.ts`): dos textos para buenas (4 y 5) y dos para malas, con el primer nombre y SIN prometer dinero, descuentos ni regalos. En `apps/panel/src/panel/Resenas.tsx` aparecen como botones que llenan la respuesta, editable antes de publicar. Docs: guía de reseñas.
- **Pruebas:** `compartido/respuestasResena.test.ts`, `panel/Resenas.test.tsx`.

## C-AVISOS-EQUIPO (29 oct 2026) — todos los países

- **Qué faltaba:** todos los avisos por correo del equipo iban a la lista fija `ADMIN_CORREOS`; nadie podía elegir qué recibir ni sumarse.
- **Arreglo:** `correosEquipo(env, tipo)` (`apps/servidor/src/avisosEquipo.ts`) con cuatro tipos: pedidos, dinero, verificaciones y sistema. Base = `ADMIN_CORREOS`; cada cuenta del equipo se suma o se sale (tabla `avisos_equipo`). El de sistema NUNCA se apaga para la lista fija y si todos se salen de un tipo vuelve a la lista fija (un aviso que no le llega a nadie es un fallo en silencio). Lo usan canario, Manager, pausa sin señal, reloj de finanzas, conciliación, liquidaciones, ubicación sin confirmar, verificación de identidad, avisos de Stripe (transferencias, abonos fallidos, disputas), restaurante nuevo, emergencia de viaje y antecedentes. Los tickets siguen yendo a la lista fija.
- **Pantalla:** superadmin → Equipo interno → «Mis avisos por correo». Rutas `GET` y `PUT /datos/admin/mis-avisos` (permitidas a todos los perfiles).
- **Pruebas:** `avisosEquipo.test.ts`, `panel/SuperEquipo.test.tsx`.

## C-TURNOS-REPARTIDOR (29 oct 2026) — todos los países

- **Qué faltaba:** el repartidor no podía reservar horas (DoorDash tiene «Schedule»: turnos de 30 minutos hasta una semana, con prioridad y turno perdido si no se conecta a tiempo).
- **Arreglo:** regla `validarTurno` (`packages/compartido/src/turnos.ts`: 1 a 12 horas, franjas de 30 min, hasta 7 días). Tabla `turnos_repartidor`. Rutas `GET`, `POST` y `DELETE /datos/repartidor/turnos` (`apps/servidor/src/rutas/turnos.ts`, no se cruzan turnos). `actualizarTurnos` (activo al conectarse, perdido a los 30 min sin conectarse, cumplido al terminar) corre en cada vuelta del Manager. En `repartirOfertas`, a igual distancia va primero quien está en su turno (`en_turno` en `libresEn`). App Driver: menú → «Mis turnos» (`apps/repartidor/src/grandes/Turnos.tsx`). Docs: guía «driver-shifts».
- **Pruebas:** `compartido/turnos.test.ts`; «C-TURNOS-REPARTIDOR» en `rutas/operacion.test.ts` (la prioridad en rojo sin el arreglo).

## C-PEDIDO-GRUPO (29 oct 2026) — todos los países

- **Qué faltaba:** no se podía armar un pedido entre varias personas (DoorDash «Group Order»).
- **Cómo quedó:** tablas `pedidos_grupo` (código secreto de 22 caracteres) y `pedidos_grupo_items`. Rutas en `apps/servidor/src/rutas/grupos.ts`: crear, ver (con el precio de hoy y quién agregó qué), agregar (validado como un pedido normal con `lineasDeRestaurante`), quitar (lo suyo; el anfitrión, cualquiera), cerrar (solo el anfitrión; devuelve las líneas para su carrito) y cancelar. Topes: 100 platos y 20 personas. Este módulo NO cobra: paga el anfitrión desde su carrito, como siempre.
- **App del cliente:** «Hacer un pedido en grupo» en el menú (`app/restaurant/[id].tsx`, con `?grupo=` agrega al grupo) y la pantalla `app/group/[codigo].tsx` (compartir, agregar, quitar, cerrar y pagar; se refresca cada 8 segundos). Docs: guía «group-order». También en tiendas (C-PEDIDO-GRUPO-TIENDA): precio del catálogo con `lineasDeTienda`, `sustitucion` por producto (columna vía COLUMNAS), botón en `app/store/[id].tsx` con `?grupo=`. Dividir el pago queda para después.
- **Hora de cierre (C-PEDIDO-GRUPO-HORA):** `PATCH /datos/grupos/:codigo {cierraEn}` (solo el anfitrión, de 15 min a 24 h; null la quita; columnas `cierra_en` y `avisado_en` vía COLUMNAS). Pasada la hora nadie agrega; el Manager avisa al anfitrión UNA vez (`avisarGruposVencidos`) y él sigue pudiendo cerrar y pagar. En la app: «Hora de cierre» (sin hora, 30 min, 1 h, 2 h) y «Se cierra a las…».
- **Prueba:** `rutas/grupos.test.ts` (las dos).

## C-RECORRIDO-BOTON-RESTAURANTE (29 oct 2026) — pruebas

- **Qué se rompió:** al llegar la fila «Pedir otra vez» al inicio, el nombre del restaurante aparece dos veces y el recorrido (`getByText(restaurante, { exact: true })`) fallaba por ambigüedad: la verificación de GitHub se puso en rojo y no se publicó.
- **Arreglo:** el recorrido toca la tarjeta DENTRO de la lista de restaurantes (`getByTestId('lista-restaurantes')`, en `apps/cliente/src/inicio/Restaurantes.tsx`). Con `.last()` fallaba a veces en GitHub: si la lista todavía no había cargado, la última tarjeta era la de «Tus regalos» y la prueba se quedaba esperando hasta los 10 minutos y las comprobaciones de que se ve usan `.first()`. La fila no cambia.

## C-REPARTIDOR-DESTACADO (29 oct 2026) — todos los países

- **Qué faltaba:** las métricas del repartidor no daban ningún beneficio (DoorDash tiene «Top Dasher»).
- **Arreglo:** `requisitosDestacado` (`packages/compartido/src/destacado.ts`: 4,7 estrellas, 70 % de aceptación, 95 % completados, 100 entregas en 30 días, 200 en total). `metricasRepartidor` y `evaluarDestacado` (`apps/servidor/src/rutas/repartidorGrandes.ts`) guardan `repartidores.destacado` (vía COLUMNAS) al abrir Calificaciones y al conectarse. En `repartirOfertas`, a igual distancia: primero quien está en turno, después el destacado. App Driver: tarjeta «Repartidor destacado» con cada requisito en Calificaciones. Nadie se desactiva por no cumplir. Docs: guía «top-driver».
- **Pruebas:** `compartido/destacado.test.ts`; «C-REPARTIDOR-DESTACADO» en `rutas/operacion.test.ts`.

## C-SEGUIMIENTO-COMPARTIDO (29 oct 2026) — todos los países

- **Qué faltaba:** el cliente no podía mostrarle a otra persona cómo iba su pedido (Uber Eats lo tiene; Moto ya lo tenía con su viaje).
- **Arreglo:** tabla `pedidos_compartidos` (solo la huella del código). `POST /datos/pedidos/:id/compartir` (solo el dueño, pedido vivo) y `GET /datos/publico/pedido/:codigo` (`apps/servidor/src/rutas/pedidoCompartido.ts`): estado, restaurante, primer nombre del repartidor y su ubicación SOLO en camino; nunca dirección, nombre del cliente ni dinero; sin indexar; terminado = sin datos. Página `/order-status/<código>` (`apps/panel/src/sitio/PedidoCompartido.tsx`), botón «Compartir el seguimiento» en el pedido del cliente. Docs: guía «share-tracking».
- **Prueba:** «C-SEGUIMIENTO-COMPARTIDO» en `rutas/operacion.test.ts`.

## C-FLEX-OPTIMIZAR-TIEMPO (29 oct 2026) — pruebas

- **Qué pasó:** la prueba «150 paradas en menos de un segundo» falló en GitHub (1,28 s) con todas las pruebas corriendo a la vez; en esta computadora tarda unos 0,3 s. No fue un cambio del optimizador.
- **Arreglo:** en GitHub (`CI`) el tope es 2,5 s; en la computadora sigue en 1 s, así una lentitud real del optimizador se sigue viendo aquí.

## C-CALIFICA-CLIENTE (29 oct 2026) — todos los países

- **Qué faltaba:** el repartidor no podía decir cómo le fue con un cliente (Uber lo tiene).
- **Arreglo:** tabla `calificaciones_cliente` (una por pedido). `GET /datos/repartidor/por-calificar` (entregas de las últimas 24 h sin calificar) y `POST /datos/repartidor/pedidos/:id/calificar-cliente` (solo su repartidor, una vez; motivo solo con 3 estrellas o menos) en `rutas/repartidorGrandes.ts`. Superadmin: «Nota de los repartidores» en la ficha del cliente. App Driver: «Califica a tus clientes de hoy» en Pedidos (`grandes/CalificarCliente.tsx`). Solo lo ve soporte; no bloquea a nadie. Docs: guía «rate-customer».
- **Prueba:** «C-CALIFICA-CLIENTE» en `rutas/operacion.test.ts`.

## C-SEGURIDAD-REPARTIDOR (29 oct 2026) — todos los países

- **Qué faltaba:** el repartidor de comida no tenía centro de seguridad (Dasher y Uber Driver sí; Moto tenía el botón del viaje).
- **Arreglo:** tablas `incidentes_repartidor` y `recorridos_compartidos`. Rutas en `apps/servidor/src/rutas/seguridadRepartidor.ts`: `POST /datos/repartidor/emergencia` (anota y avisa al equipo con el tipo «sistema», que nunca se apaga; devuelve el número de emergencias del país), `POST /datos/repartidor/incidentes` (aviso tipo «pedidos»), `POST /datos/repartidor/compartir-recorrido` (enlace secreto de 12 horas, solo la huella), `GET /datos/publico/recorrido/:codigo` (primer nombre y ubicación, sin indexar) y `GET /datos/admin/seguridad`. App Driver: menú → «Seguridad» (`grandes/Seguridad.tsx`). Página `/driver-trip/<código>`. Docs: guía «driver-safety».
- **Prueba:** `rutas/seguridadRepartidor.test.ts`.

## C-COMANDA (29 oct 2026) — todos los países

- **Qué faltaba:** el restaurante no podía imprimir la comanda (DoorDash y Uber Eats tienen impresora).
- **Arreglo:** `htmlComanda` e `imprimirComanda` (`apps/panel/src/panel/comanda.ts`): impresión del navegador en 80 mm, número, modo, programado, platos con opciones y notas (escapadas); nada de dirección ni dinero. En Pedidos: «Imprimir comanda» en aceptados y listos, e «Imprimir la comanda al aceptar» guardado en ese navegador. Docs: guía «print-tickets».
- **Prueba:** `panel/comanda.test.tsx`.

## C-API-POS (29 oct 2026) — todos los países

- **Qué faltaba:** no había forma de conectar el sistema de caja del restaurante (DoorDash y Uber Eats tienen integraciones).
- **Arreglo:** tabla `claves_restaurante` (solo la huella; la llave `dvx_pos_…` se muestra una vez; máximo 5 activas). Rutas en `apps/servidor/src/rutas/apiPos.ts`: el dueño crea, lista y revoca (`/datos/mi-restaurante/claves-api`); la API `/datos/v1/pos/pedidos` (leer), `/aceptar` y `/listo` con `x-api-key`, 120 por minuto. Aceptar y listo usan las mismas funciones que el panel (`aceptarPedido`, `marcarListo` en `operacion.ts`). Nunca devuelve dirección, teléfono ni dinero. Panel: «Conectar tu punto de venta» en Mi restaurante (`ClavesPos.tsx`, revocar en los tres puntos). Documento técnico: `docs/API-POS-V1.md`. Docs: guía «pos-integration».
- **Pruebas:** «C-API-POS» en `rutas/operacion.test.ts`, `panel/ClavesPos.test.tsx`.

## C-FILTROS-DIETA (29 oct 2026) — todos los países

- **Qué faltaba:** no se podía marcar un plato como vegetariano, vegano, sin gluten, halal o picante, ni filtrar por eso (DoorDash y Uber Eats lo tienen).
- **Arreglo:** lista cerrada `ETIQUETAS_DIETA` con sus nombres y `leerEtiquetasDieta` en `packages/compartido/src/catalogo.ts`; `esquemaPlato.etiquetas` (sin repetir, orden fijo). Columna `platos.etiquetas` (texto «vegano,halal») por COLUMNAS de `esquema.ts`, nunca en schema.sql. El buscador (`rutas/buscar.ts`) acepta `dieta=` con o sin `q`; con marca, el restaurante sale solo si tiene un plato con ella. Panel (Menu.tsx) y app del restaurante (MiMenu.tsx) envían SIEMPRE las marcas al guardar: un PUT sin ellas las borraría. Cliente: filtros en el buscador y marcas en verde en el menú. Docs: guía «dietary-filters».
- **Prueba:** `apps/servidor/src/filtrosDieta.test.ts`.

## C-MAPA-DEMANDA (29 oct 2026) — todos los países

- **Qué faltaba:** el repartidor no sabía hacia dónde moverse para tener más ofertas (DoorDash tiene «Dash Now» y Uber Driver sus zonas).
- **Arreglo:** `GET /datos/repartidor/demanda?lat&lng` (`apps/servidor/src/rutas/demanda.ts`): pedidos de la última hora de la ciudad del repartidor, agrupados por geohash de 6 letras desde el LOCAL (nunca la casa del cliente); celdas con un solo pedido no salen; cinco o más es «alta». Solo devuelve centro, cantidad y nivel: nada de nombres, direcciones, pedidos ni dinero. App Driver: círculos rojos translúcidos en el mapa del inicio (`zonasDemanda` en `piezas/Mapa.tsx` y `Mapa.web.tsx`), se lee cada minuto. Docs: guía «busy-areas».
- **Prueba:** `apps/servidor/src/mapaDemanda.test.ts`.

## C-TE-PUEDE-GUSTAR (29 oct 2026) — todos los países

- **Qué faltaba:** el inicio no recomendaba restaurantes nuevos según lo que la persona ya pidió (DoorDash «You might like»).
- **Arreglo:** `recomendarRestaurantes` (`packages/compartido/src/recomendados.ts`): mismo tipo de comida que sus pedidos entregados, abiertos, sin los ya probados, el más cercano primero; sin historial no muestra nada. En `apps/cliente/src/Inicio.tsx` la fila «Te puede gustar» usa la misma tarjeta de `Restaurantes` con `titulo` y `testID="te-puede-gustar"` (la lista normal sigue siendo `lista-restaurantes`, la que usa el recorrido). Docs: guía «you-might-like».
- **Prueba:** `compartido/recomendados.test.ts`.

## C-PRESENTACIONES (29 oct 2026) — todos los países

- **Qué es:** presentaciones en PDF horizontal (1280×720) con capturas ORIGINALES de la app, para clientes y para charlas con restaurantes, en español e inglés.
- **Cómo se rehacen:** `CLAVE_DEMO=… node scripts/presentaciones/capturas.mjs` (capturas del sitio de pruebas: pedido en grupo, punto de venta, pedidos, comanda), `CLAVE_DEMO=… node scripts/presentaciones/capturas-repartidor.mjs` (inicio, turnos, seguridad y calificaciones de la app Driver) y `node scripts/presentaciones/generar.mjs` (arma los ocho PDF: clientes, restaurantes, vendedores y repartidores con las capturas de `docs/capturas/` y los logos oficiales). Salen en `apps/panel/public/docs/presentaciones/` y se publican con la web.
- **En Docs:** sección «courses» (Cursos y presentaciones), la PRIMERA de la lista, con una guía por presentación y «presentations» con las cuatro; el campo `descargas` lo dibuja `Docs.tsx`. En el inicio de Docs va arriba, en el bloque oscuro de cursos.
- **Regla:** cada vez que cambie una de esas pantallas, se rehacen las capturas y los PDF en el mismo trabajo.

## C-DOCS-ENCONTRAR (29 oct 2026) — todos los países

- **Qué se rompió:** Richard no encontraba las presentaciones. Tocaba un resultado del buscador y «no abría nada» (la guía se abría, pero el texto buscado quedaba guardado y la pantalla seguía mostrando los resultados). La dirección `/docs/restaurants/presentations` o `/docs/<guia>` caía en el inicio sin decir nada. Secciones y guías del menú tenían la misma letra.
- **Arreglo (`apps/panel/src/sitio/docs/Docs.tsx`):** al cambiar de ruta se limpia la búsqueda; Enter abre el primer resultado; la guía se busca en TODAS las secciones si la dirección trae otra o ninguna (las guías pueden cambiar de sección sin romper enlaces); una guía inexistente muestra un aviso (`noExiste`). Íconos por guía en `iconosGuia.ts`. Estilo en `estilos.css`: sección en mayúsculas pequeñas, negrita y con raya arriba; guía en gris, más chica, con su ícono.
- **Prueba:** `apps/panel/src/sitio/docs/Docs.test.tsx` (cuatro casos comprobados en rojo quitando cada arreglo, y que los cuatro PDF existen en los dos idiomas).
- **No tocar:** la sección «courses» va primera; no se quita el campo de búsqueda del mismo lugar (perdería el foco al escribir).

## C-TURNOS-HORARIO (29 oct 2026) — todos los países

- **Qué se rompió:** en «Mis turnos» del Driver el domingo 1 de noviembre salía dos veces y, desde ahí, cada día empezaba a las 11 p. m. del anterior: se sumaban 24 horas y el día del cambio de hora dura 25.
- **Arreglo:** `inicioDelDia(ahora, n)` en `packages/compartido/src/turnos.ts` (por calendario, con `setDate`); `apps/repartidor/src/grandes/Turnos.tsx` lo usa para los días y para las horas de cada día.
- **Prueba:** `packages/compartido/src/turnos.test.ts`, en la hora de Miami aunque la nube corra en UTC; comprobada en rojo con la suma de 24 horas.

## C-AYUDA-PEDIDO (29 oct 2026) — todos los países

- **Qué faltaba frente al «Get help» de DoorDash:** la queja guiada solo devolvía por plato cuando FALTABA; no servía para el plato equivocado o dañado, no aceptaba foto y — hueco de dinero — el mismo pedido podía recibir dos reembolsos automáticos con dos quejas.
- **Arreglo:** `apps/servidor/src/rutas/tickets.ts`: `MOTIVOS_POR_PLATO` (faltante, equivocado, dañado) calculan el valor de los platos marcados; UN solo reembolso automático por pedido (si ya hay una fila en `devoluciones`, la queja va al ticket con su propuesta). `POST /datos/quejas/:id/foto` (quien se quejó, 24 h, foto real JPG/PNG/WebP de hasta 3 MB, guardada en `quejas/<ticket>/…` del almacén, nunca en /media) y `GET` de la misma ruta (quien se quejó y soporte; `private, no-store`). La clave queda en `datos_json.foto` del ticket. App: `packages/movil/src/ReportarProblema.tsx` (platos para los tres motivos y foto opcional solo si la app pasa `elegirFoto`); la del cliente la pasa con `expo-image-picker` (las otras dos apps no lo tienen instalado: no importar el selector dentro de `packages/movil`).
- **Sigue apagado:** el reembolso automático se enciende en el superadmin (Control de dinero → Quejas) por decisión de Richard; hasta entonces todo va a soporte con el monto propuesto.
- **Prueba:** `apps/servidor/src/quejasGuiadas.test.ts` (dos casos nuevos, comprobados en rojo antes del arreglo).

## C-DISPUTAS-PRUEBAS (29 oct 2026) — todos los países

- **Qué faltaba:** las disputas (contracargos) ya llegaban por el aviso de Stripe y se veían con su plazo, pero las pruebas había que juntarlas a mano.
- **Arreglo:** `pruebasDisputa` en `apps/servidor/src/disputas.ts` arma, con los nombres de campo de Stripe y en inglés, los hechos guardados del pedido: cliente y correo, platos, dirección, fecha de entrega, cómo se entregó, metros por GPS, si hay foto, calificación y lo ya devuelto. `GET /datos/admin/disputas/:id/pruebas` las muestra; `POST` las guarda en la disputa de Stripe con `submit=false` (BORRADOR): las envía una persona desde Stripe. Superadmin: botón «Pruebas» en Control de dinero → Disputas.
- **No tocar:** nunca `submit=true` automático (una vez enviadas no se pueden cambiar).
- **Prueba:** `apps/servidor/src/devolucionesDisputas.test.ts` y `apps/panel/src/panel/ControlDinero.test.tsx` (C-DISPUTAS-PRUEBAS).

## C-MODO-TABLETA (29 oct 2026) — todos los países

- **Qué faltaba:** en el panel web (lo que muchos restaurantes abren en una tableta) la pantalla se apagaba y el botón de salir quedaba a la vista. La app del restaurante ya usaba `useKeepAwake`.
- **Arreglo:** `apps/panel/src/panel/modoTableta.ts` (`useModoTableta`): pantalla completa, candado de pantalla encendida del navegador (Screen Wake Lock, se vuelve a pedir al volver a la pestaña) y clase `modo-tableta` en el body que esconde `.cabecera` y `.panel-menu`. Botón «Modo tableta» en Pedidos, que también enciende la alarma. Docs: guía «tablet-mode».
- **Prueba:** `apps/panel/src/panel/modoTableta.test.tsx` (comprobada en rojo quitando el volver a pedir el candado).

## C-RESUMEN-ANUAL (29 oct 2026) — EE. UU. primero; los demás países con su moneda

- **Qué es:** «Tu año» en Ganancias del Driver (como el resumen de Dasher): por mes, entregas, distancia estimada (km y millas) y lo ganado por moneda, con CSV para el contador.
- **Cómo:** `resumenAnual` y `csvResumenAnual` en `packages/compartido/src/resumenAnual.ts`; `GET /datos/repartidor/resumen-anual?anio=` en `rutas/repartidorGrandes.ts` (misma cuenta que «Ganancias»); tarjeta `apps/repartidor/src/grandes/ResumenAnual.tsx` (CSV con el Compartir del teléfono). Docs: «year-summary».
- **Honestidad:** la distancia es `pedidos.distancia_km` (restaurante → cliente en línea recta), NO el camino recorrido: así se dice en la app y en Docs. Medir el camino real necesita GPS en segundo plano (pendiente de la auditoría, punto 23).
- **Prueba:** `compartido/resumenAnual.test.ts` y `rutas/repartidorGrandes.test.ts` (C-RESUMEN-ANUAL).

## C-HISTORIAL-DINERO y C-CALCULADORA-EN-VIVO (29 oct 2026) — todos los países

- **Historial:** cada `PUT /datos/admin/config-dinero` (EE. UU.) y `PUT /datos/admin/paises/:pais` deja una fila en `auditoria_admin` (objeto `config-dinero` o `config-pais:XX`) con autor, antes y después (`anotarCambioDinero` en `rutas/dinero.ts`). `GET /datos/admin/config-dinero/historial` lo lista con los campos que cambiaron; se ve en Superadmin → Dinero, «Historial de cambios». Nunca se borra.
- **Calculadora en vivo:** la calculadora pública (`apps/panel/src/sitio/Calculadora.tsx`) lee `/datos/config-dinero` y usa esa comisión, envío y servicio; los nombres de los planes muestran el porcentaje real. Sin respuesta del servidor, usa `CONFIG_DINERO_INICIAL`.
- **Prueba:** `apps/servidor/src/historialDinero.test.ts` (rojo comprobado quitando el registro), `apps/panel/src/panel/AdminDinero.test.tsx` y `apps/panel/src/sitio/Calculadora.test.tsx`.

## C-RECOGER-PUNTA-A-PUNTA (2 nov 2026, BRE-7) — todos los países

- **Qué protege:** «Recoger en el local» completo en el navegador: el cliente elige «Recojo en el local», paga (Stripe simulado), ve su PIN; el restaurante acepta, marca listo y entrega en SU APP con el PIN; un PIN equivocado no entrega; la tarjeta se cobra al entregar (liquidación por el total) y no hay pago de repartidor.
- **Dónde:** `e2e/recorrido/recogerCompleto.spec.ts` (en y es), corre en cada `npm run recorrido`. Con `CAPTURAS=1` rehace las capturas `cliente-recoger-*` y `restapp-recoger-pin` de las guías de recogida.
- **Arreglo que fijó:** en la recogida, la tarjeta del PIN decía «El repartidor lo necesita para entregarlo en mano»; ahora dice «Muéstralo en el mostrador cuando recojas tu pedido» (`tuPinRecoger` en `apps/cliente/src/app/order/[id].tsx`). Comprobado en rojo antes del arreglo.

## C-RECOGER-MAPA (29 oct 2026) — todos los países

- **Qué es (como el «Pickup» de Uber Eats):** en Comida, arriba, «Entrega | Recoger». En Recoger: mapa con los locales abiertos (`apps/cliente/src/comida/MapaLocales.tsx` nativo y `.web.tsx` con Leaflet), lo más cerca primero y «Listo en X min» (tiempo de preparación). Al elegir un local, `marcarRecoger(true)` del carrito y el carrito arranca en «Recojo en el local» (una vez; luego se apaga).
- **No tocar:** el modo de la lista es estado propio de la pantalla; el carrito solo recibe la intención al elegir el local (si se apagara desde el carrito, la lista cambiaría sola al volver).
- **Prueba:** `e2e/recorrido/recoger.spec.ts` (restaurantes simulados; solo en esta computadora).

## C-PRECISION-PEDIDOS (29 oct 2026) — todos los países

- **Qué es (como la «precisión de pedidos» de DoorDash Merchant):** el tablero del restaurante (`GET /datos/restaurante/tablero` en `rutas/operacion.ts`) suma `pedidosConProblemasMes` (pedidos con queja de plato faltante, equivocado o dañado en 30 días), `precisionPct` (entregados sin problema) y `reembolsosMes` (devoluciones del mes en su moneda). Se ve en el panel (`TableroRestaurante.tsx`) y en la app (`Estadisticas.tsx`, «Con problemas»). Docs: guía «dashboard».
- **Prueba:** `rutas/operacion.test.ts` (tablero).

## C-EMBUDO (29 oct 2026) — todos los países

- **Qué es:** en los informes del superadmin (`GET /datos/admin/informes`), `embudo`: pedidos que empezaron a pagar en el rango, los pagados, los que aceptó el restaurante y los entregados, con el porcentaje que pasa de cada paso al siguiente (`embudo()` en `rutas/informes.ts`). Se ve en `SuperInformes.tsx`.
- **Prueba:** `rutas/informes.test.ts` y `SuperInformes.test.tsx` (C-EMBUDO).

## C-TIENDAS-REEMPLAZOS (29 oct 2026) — todos los países

- **Qué es (como Instacart):** al marcar un producto que falta, la tienda propone hasta tres reemplazos de su catálogo (disponibles, con su precio rebajado). Con «avísame», el cliente elige uno con un toque; con «uno parecido», va solo el primero. La línea cambia de producto y queda con el MENOR precio entre el original y el reemplazo: nunca se cobra de más.
- **Dónde:** columnas `ajustes_pedido.propuestas_json` y `reemplazo_id` (por COLUMNAS); `calcularSinPlato(…, reemplazo)` y `aplicarAjuste(…, 'reemplazar', …, platoId)` en `rutas/pedidos.ts`; validación en `rutas/operacion.ts` (catálogo con `lineasDeTienda`); aviso `platoReemplazado`. Panel (`Pedidos.tsx`), app del restaurante (`FaltaTienda.tsx`), app del cliente (pedido) y Docs (`shop-stores`, `store-orders`). Ficha: `docs/investigaciones-rea/2026-10-29-tiendas-reemplazos.md`.
- **No tocar:** el estado `quitado` sirve también para el reemplazo (la tabla tiene un CHECK con tres estados; cambiarlo exigiría rehacer la tabla en producción).
- **Prueba:** `rutas/tiendasVitrina.test.ts` (C-TIENDAS-REEMPLAZOS, en rojo antes del arreglo) y `PedidosReemplazos.test.tsx`.

## C-VIAJE-TARJETA (29 oct 2026) — todos los países; solo donde Moto esté encendido (hoy, el sitio de pruebas)

- **Qué es (como Uber, con el circuito de Comida):** `POST /datos/viajes` con `metodoPago: 'tarjeta'` deja el viaje en `pago_pendiente` y abre una autorización por el precio fijo (`abrirCobroViaje`, `apps/servidor/src/viajesCobro.ts`, tabla `cobros_viaje`). Solo el aviso firmado `payment_intent.amount_capturable_updated` con el monto exacto lo pasa a `buscando`. Al terminar se captura lo final, nunca más de lo autorizado, y lo cobrado se acredita entero al conductor en `movimientos` (la comisión sigue saliendo de su prepago). Cancelar: sin cargo se anula la autorización; con cargo se captura solo el cargo y no queda deuda. «No se presentó» cobra su cargo igual. Sin conductor, o un pago que nunca se autorizó en 20 minutos: se anula.
- **App:** `PedirMoto.tsx` con «Efectivo | Tarjeta» y la hoja de pago de siempre (`PagoTarjeta`).
- **Prueba:** `apps/servidor/src/viajeTarjeta.test.ts` (rojo comprobado quitando el cobro al terminar).
- **Sin probar con dinero real.** Moto sigue apagada en producción.

## C-FOTO-VERIFICADA y C-IDENTIDAD-UNICA (29 oct 2026, pedido de Richard) — todos los países

- **Foto verificada (como Uber):** la selfie de la verificación, una vez aprobada contra el documento, es la foto de perfil del repartidor. La ve él (`GET /datos/kyc/mi-foto`), el cliente de un pedido que lleva (`GET /datos/pedidos/:id/repartidor/foto`, también en el seguimiento como `repartidor.foto`) y el equipo; nadie más. No se puede reemplazar desde la app; soporte la libera con motivo (`POST /datos/admin/kyc/:id/liberar-foto`), vuelve a verificación y queda en `auditoria_admin`. App del cliente (`FotoRepartidor.tsx`), Driver (`Verificacion.tsx`), panel (`SuperKyc.tsx`), Docs («verify»).
- **Identidad única:** `correoCanonico` y `telefonoCanonico` (`packages/compartido/src/identidadUnica.ts`); columnas `usuarios.correo_canonico` y `telefono_canonico`. Al registrarse: el mismo correo escrito de otra forma no entra; el mismo teléfono no abre dos cuentas del mismo tipo (un repartidor sí puede pedir como cliente). Tabla `bloqueos_identidad`: «Cerrar por mala conducta» en la ficha del superadmin guarda su correo y su teléfono; con ellos no se vuelve a registrar. Borrar la cuenta borra también las formas únicas.
- **Pendiente (K5, decide Richard):** comparar caras con IA (selfie contra documento y contra los bloqueados). Ficha: `docs/investigaciones-rea/2026-10-29-identidad-repartidores.md`.
- **Prueba:** `apps/servidor/src/identidadRepartidores.test.ts` (rojo comprobado quitando las comprobaciones) y `compartido/identidadUnica.test.ts`.

## C-VIAJE-PROPINA (29 oct 2026) — todos los países; donde Moto esté encendido

- **Qué es:** propina después de un viaje pagado con tarjeta (`POST /datos/viajes/:id/propina`, `propinaViaje` en `viajesCobro.ts`), con la tarjeta guardada, una vez y hasta 7 días después; va entera al conductor (`movimientos`, concepto `propina`, referencia `propina-viaje-<id>`) y solo si Stripe confirmó el cobro. App: botones de propina en `ViajeEnCurso.tsx`.
- **Prueba:** `viajeTarjeta.test.ts`.

## C-KYC-DOCUMENTO (29 oct 2026) — EE. UU. y pasaportes de todos los países

- **Qué es:** el primer bloque del motor propio de verificación (`apps/verificador`, diseño en `docs/investigaciones-rea/2026-10-29-kyc-automatico.md`, copiado de Idswyft, MIT): `leerAamva` lee el código de barras PDF417 de las licencias e identificaciones de EE. UU. (estándar AAMVA); `leerMrz` lee la franja del pasaporte (TD3 de la OACI) y comprueba sus dígitos de control; `revisarDocumento` exige vigencia y edad mínima (18, o 21 para licores); `cruzarConFrente` cruza el código con lo que el OCR lee en el frente (umbral 0,75, como Idswyft).
- **Todavía no:** decodificar el código de barras y leer el frente desde la FOTO (K6b), la cara (K7) y el servicio que lo corre (K9, decide Richard dónde).
- **Prueba:** `apps/verificador/src/documento.test.ts` (con el ejemplo oficial de la OACI; rojo comprobado cambiando los pesos del dígito de control).

## C-KYC-CODIGO-FOTO (29 oct 2026) — EE. UU.

- `leerCodigoDeFoto` (`apps/verificador/src/codigoBarras.ts`): pasa la foto a grises con sharp (Apache 2.0) y decodifica el PDF417 con ZXing (Apache 2.0); prueba también girada 90, 180 y 270 grados. Una foto sin código devuelve null.
- **Prueba:** `codigoBarras.test.ts` (un PDF417 real dibujado con bwip-js, MIT, derecho y de lado).

## C-KYC-OCR (29 oct 2026) — todos los países

- `leerFrente` y `leerMrzDeFoto` (`apps/verificador/src/ocr.ts`): Tesseract (Apache 2.0) con los datos de idioma del paquete @tesseract.js-data/eng (MIT), sin bajar nada de internet al verificar.
- **Franja del pasaporte (K6c, 29 oct noche):** `corregirMrz` (`mrz.ts`) corrige por posición como los lectores de pasaportes: donde va un número, O→0; donde va una letra, 0→O; en los campos mixtos (número del pasaporte y dato opcional) prueba las letras parecidas hasta que cuadra el dígito de control. Si el OCR mete una letra de más en la segunda línea, se prueba quitando cada una. Nunca inventa: una corrección solo vale si su dígito de control la confirma. Con letra de ancho fijo lee la franja de la OACI completa; con Courier la rechaza (correcto).
- **Nombres (sin dígito de control):** el relleno del final que el OCR lee como L o K se limpia con la regla del formato (después del segundo «<<» todo es relleno; una cola de cuatro o más K/L también). Lo destapó el servidor de pruebas en Linux el 29 oct: los controles cuadraban y el nombre traía «LLLL».
- **Límite del estándar:** en algunas posiciones «1» y «L» dan el mismo dígito de control; por eso el número también se cruza con el frente y el código de barras.
- **Frente:** `datosDelFrente` (`documento.ts`) busca en el texto del OCR los datos del código (número sin las letras que el OCR confunde; fecha en MM/DD/AAAA, DD/MM/AAAA o AAAA-MM-DD) y, si el frente trae otro número u otra fecha con su etiqueta, los devuelve para que el cruce marque la diferencia.
- **Prueba:** `ocr.test.ts` (corrección con la lectura real del OCR, rojo comprobado quitando la corrección; una franja aceptada siempre trae los datos correctos; el frente de la misma persona coincide y el de otra no) y `documento.test.ts`.

## C-KYC-CARAS (29 oct 2026) — todos los países

- `apps/verificador/src/caras.ts`: @vladmandic/face-api 1.7.15 (MIT) sobre TensorFlow 4.22 con WASM (Apache 2.0), como Idswyft. Modelos y WASM salen de los paquetes instalados (el WASM se entrega en línea porque Node no lee archivos con fetch): **nada se baja de internet al verificar**.
- `compararSelfieConDocumento`: la cara más grande de cada foto, huella de 128 números, distancia euclídea; hasta **0,6** es la misma persona (corte estándar de face-api y de Idswyft). Medido: la misma cara impresa chica y en gris da 0,24; otra persona, 0,66.
- `decidirVida` / `pruebaDeVida`: tres tomas (de frente, a un lado y al otro). Pasa si las tres son de la misma persona y la nariz se movió al menos **0,08** entre los extremos de la mandíbula hacia los DOS lados. Una foto de una foto da el mismo giro en las tres y no pasa.
- `buscarParecidas`: la huella contra la lista de cuentas cerradas por mala conducta; las parecidas van a revisión del equipo, nunca a rechazo automático.
- **Prueba:** `caras.test.ts` con las fotos de muestra que trae face-api (no se copian al repo). Rojo comprobado subiendo el umbral: otra persona pasaba.
- **No tocar:** el umbral 0,6 ni el giro mínimo sin medir de nuevo con fotos reales del sitio de pruebas.

## C-KYC-MOTOR (29 oct 2026) — todos los países

- `verificar` (`apps/verificador/src/verificar.ts`) junta todo en un paso y decide al instante: **verificado** (sin motivos), **repetir** (ilegible, vencido, sin cara, cara distinta, sin prueba de vida, otra persona en las tomas) o **revisión** del equipo (menor de edad, cédula sin código estándar, frente que no cuadra, cara parecida a una cuenta cerrada). Devuelve la huella de la selfie para guardarla.
- `servidor.ts`: la puerta del motor (POST /verificar y GET /salud). Firma HMAC-SHA256 de «hora.cuerpo» con VERIFICADOR_CLAVE (32+ caracteres) y una ventana de cinco minutos; sin firma válida no mira nada. Cuerpo máximo 25 MB.
- `leerCara` busca la cara en la imagen entera y, si no aparece (en un documento la foto es chica), en cada mitad.
- **Hallazgo:** la huella de face-api cambia si la cara está muy inclinada (no la endereza). Una selfie torcida puede salir «cara distinta» y pedir repetir; la app pide la cara derecha y de frente.
- **Prueba:** `verificar.test.ts` (licencia completa armada en la prueba: lee el código, cruza el frente, compara la cara; vencida y otra persona piden repetir; cara de cuenta cerrada a revisión) y `servidor.test.ts` (firma buena, mala, vieja, cuerpo cambiado).

## C-KYC-AUTO (29 oct 2026) — todos los países (apagado hasta conectar el motor)

- **Interruptor:** VERIFICADOR_URL y VERIFICADOR_CLAVE en el servidor. Sin las dos, todo sigue como hoy (revisión del equipo). Hoy NO están puestas en ningún sitio: el motor espera que Richard apruebe dónde corre (PENDIENTES 👤).
- **App Driver** (`apps/repartidor/src/Verificacion.tsx`): con el motor, pide el consentimiento escrito (texto en borrador, lo aprueba el abogado) y dos tomas girando la cabeza (`giro_1`, `giro_2`, solo repartidores); el botón dice «Verificar ahora» y el resultado sale en el momento.
- **Servidor** (`verificacionAuto.ts` + `/datos/kyc/enviar`): solo llama al motor si hay consentimiento, las dos tomas, el frente y la selfie. Firma HMAC igual que el motor. Verificado → aprobado por «motor»; repetir → rechazado con el motivo en palabras de la persona (es/en); revisión → pendiente para el equipo. Si el motor falla, queda pendiente y se anota «sin_respuesta» (nunca se aprueba sola).
- **Huellas:** `huellas_caras` guarda solo los 128 números; al cerrar por mala conducta se marca y viaja al motor en cada verificación; al borrar la cuenta se borra (salvo la de mala conducta). `verificaciones_auto` guarda cada decisión y el equipo la ve en el detalle.
- **Prueba:** `apps/servidor/src/verificacionAuto.test.ts` (motor simulado; rojo comprobado apagando el interruptor).

## C-CARGO-AL-AFECTADO (30 oct 2026) — todos los países (Moto y lo que venga: Carro)

- **Qué estaba mal:** el cargo de cancelación o de «no se presentó» no le llegaba al conductor que fue a buscar al pasajero. Con tarjeta se cobraba y quedaba sin dueño; en efectivo se sumaba al viaje siguiente y se lo quedaba el conductor de ESE viaje.
- **Cómo quedó (como Uber):** `deudas_pasajero.conductor_id` guarda al afectado. Con tarjeta, `soltarCobroViaje` le acredita lo capturado (`movimientos`, referencia `cargo-viaje-<viaje>`). En efectivo, al cobrarse la deuda en otro viaje, `pasarDeudasAlAfectado` (`rutas/viajes.ts`) le descuenta al que la cobró (ajuste negativo) y se la acredita al afectado (referencias `deuda-viaje:<deuda>:…`). Todo una sola vez.
- **[INF]** El cargo va entero al conductor; si Richard decide cobrar comisión sobre él, se descuenta aquí.
- **Prueba:** `viajesPasajero.test.ts` (C-CARGO-AL-AFECTADO, rojo comprobado antes del arreglo) y `viajeTarjeta.test.ts`.

## C-VIAJE-SEGURIDAD-2 (30 oct 2026) — todos los países (Moto, solo en pruebas)

- Copiado del kit de seguridad de Uber. Reglas puras en `packages/compartido/src/seguridadViaje.ts`; servidor en `apps/servidor/src/rutas/seguridadViaje.ts`; app en `apps/cliente/src/viajes/Seguridad.tsx`.
- **Contactos de confianza:** hasta 5 por pasajero (`contactos_confianza`, teléfono canónico, sin repetir). Compartir «nunca», «siempre» o «solo de noche» (9 p. m. a 6 a. m. en la hora de la CIUDAD del viaje). Al iniciar el viaje, `avisarContactos` crea el enlace en vivo y lo manda por mensaje en el idioma del pasajero (Twilio; sin Twilio no se manda nada y el viaje sigue).
- **«¿Todo bien?» (RideCheck):** en curso, si el conductor está a más de 1,5 km (o un cuarto del largo del viaje) del tramo recto, se crea UN aviso (`alertas_viaje`); la app pregunta. «Estoy bien» lo cierra; «Necesito ayuda» registra la emergencia y llama al número del país.
- **Horas al volante:** con 12 horas manejando (de aceptar a terminar) en las últimas 24, no acepta viajes hasta 6 horas sin manejar desde el último (`revisarHorasAlVolante` en aceptar).
- **Prueba:** `seguridadViaje.test.ts` (servidor, rojo comprobado quitando las revisiones) y `packages/compartido/src/seguridadViaje.test.ts`.

## C-MOTO-CIUDAD (30 oct 2026) — todos los países (Moto, solo en pruebas)

- Interruptores por ciudad y servicio (`ajustes_viaje_zona`), como Uber en cada mercado: **código para empezar** («siempre», «noche» = 9 p. m. a 6 a. m. en la hora de la ciudad, o «nunca») y **selfie con casco** antes de aceptar (vale 12 horas, `selfies_casco`, foto privada en `casco/<conductor>/…`). Sin ajuste: código siempre y sin selfie (lo de antes).
- El código se decide AL PEDIR el viaje (`viajes.pin_requerido`): el pasajero y el conductor ven lo mismo aunque cambie la hora en medio.
- Servidor: `apps/servidor/src/rutas/ajustesViaje.ts` (rutas del equipo con registro en `auditoria_admin`). Panel: Superadmin → Moto · Viajes → «Interruptores por ciudad». Driver: sin código no pide el número; si la ciudad pide la selfie, al aceptar sale la tarjeta para tomarla.
- **Prueba:** `ajustesViaje.test.ts` (rojo comprobado quitando las dos reglas).

## C-DOCS-MOTO-BORRADOR (30 oct 2026) — todos los países

- Las guías públicas de Moto (pasajero: pedir, pagar/cancelar/propina, seguridad; conductor: conducir, descanso y seguridad) están escritas en español e inglés en `apps/panel/src/sitio/docs/borradores/moto.ts`, FUERA de `DOCS`.
- **Para publicarlas** el día que Richard encienda Moto: agregar `BORRADORES_MOTO[idioma].pasajero` a la sección «ordering» y `.conductor` a «drivers» en `guias.ts`, tomar las capturas reales y quitar la prueba de «todavía no están publicadas».
- **Prueba:** `borradores.test.tsx` (completas en los dos idiomas, sin publicar, sin nada interno).

## C-CARRO-PRUEBAS (30 oct 2026) — todos los países (solo en pruebas)

- Ficha REA: `docs/investigaciones-rea/2026-10-30-carro.md` (Uber «Ride options» y «Driver requirements» como visitante).
- Carro va sobre el motor de Moto: `SERVICIOS_EN_PRUEBA` incluye «carro» (en producción no existe). Requisitos del conductor ya cargados (identidad, antecedentes, historial de manejo, licencia, 21 años, seguro de pasajeros, inspección). El despacho solo ofrece el viaje a quien está habilitado para Carro con un carro aprobado.
- App del pasajero: la pantalla de viajes recibe `servicio=carro` (desde la pantalla del servicio). Driver: la oferta dice «Nuevo viaje en Carro» y en Carro no se confirma casco.
- **Prueba:** `apps/servidor/src/rutas/carro.test.ts` (producción apagada; viaje completo en pruebas; el conductor de moto no lo recibe). La ayuda `conductorDeMoto(m, donde, zona, 'carro')` arma un conductor de carro.
- **Carro XL (C-CARRO-XL, 30 oct 2026):** como «Extra room» de Uber, una opción DENTRO de Carro (no otro botón del inicio). La tarifa de la ciudad lleva `xlPb` (columna `tarifas_viaje.xl_pb`; 15 000 = × 1,5) y sin él no hay XL. La cotización y el viaje guardan `categoria`; el despacho solo ofrece un XL a vehículos con 6 plazas o más (`PLAZAS_XL`, filtro en `candidatosParaOperacion`). Panel: el formulario de tarifas elige Moto o Carro y el factor XL. App: «Carro» / «Carro XL (6 plazas)». Prueba en `carro.test.ts` (rojo comprobado quitando el filtro).

## C-ENVIOS (30 oct 2026) — todos los países (solo en pruebas)

- Ficha REA: `docs/investigaciones-rea/2026-10-30-envios.md` (Uber Courier como visitante: «tan fácil como pedir un viaje», seguimiento en vivo y PIN de entrega).
- Envíos va SOBRE EL MOTOR DE VIAJES (no sobre Flex): la operación es de tipo «envio_paquete» y el viaje lleva su paquete en `envios_persona` (qué es, valor declarado, quién recibe, PIN de entrega, foto, recogido y entregado). OJO: el nombre `paquetes_envio` ya es un índice de Flex; no reutilizarlo.
- Al pedir: paquete obligatorio, valor ≤ `valorMaximo` de la tarifa de la ciudad (sin él, 100 en la moneda local), celular válido de quien recibe y «no envío nada prohibido». Sin código al recoger (`pin_requerido = 0`). Quien recibe recibe por mensaje el enlace en vivo y su PIN (Twilio; sin Twilio, el que envía ve el PIN en su app para pasárselo).
- Conductor: sin la foto del paquete no sale (`/conductor/operaciones/:id/foto-paquete`); sin el PIN de quien recibe no entrega (5 intentos). `revisarPaquete` en `rutas/viajes.ts`.
- Un envío y un viaje del mismo cliente no se mezclan: `/datos/viajes/actual?servicio=envios`.
- Apps: pasajero (la pantalla de viajes con `servicio=envios`, formulario del paquete y PIN visible) y Driver (foto y PIN). Panel: tarifa de Envíos con su valor máximo.
- **Prueba:** `apps/servidor/src/rutas/envios.test.ts` (rojo comprobado quitando la revisión del paquete).
- **Falta:** guías de Docs de Envíos (se escriben como borrador, igual que Moto) y las decisiones de Richard (valor máximo real, seguro del paquete, precio).

## C-EXPLORAR (30 oct 2026) — todos los países

- «Más» (`apps/cliente/src/app/service/[id].tsx` con id «mas») muestra todos los servicios en grupos, como «Services» de Uber: `agruparServicios` y `GRUPOS_EXPLORAR` en `packages/compartido/src/servicios.ts` (viajes, pedidos, envíos y «otros» para lo que el código no conoce; «Más» nunca se lista a sí mismo). Debajo sigue «Ver tiendas».
- Ficha: `docs/investigaciones-rea/2026-10-30-mas.md`. Pruebas: `servicios.test.ts` y `e2e/recorrido/mas.spec.ts` (captura en `docs/capturas/mas-servicios-*.png`).

## C-MARCA-PUBLICA (30 oct 2026) — todos los países

- La descripción de «Más» decía «Todo lo que viene en Tumbite» al público (lo destapó la captura del recorrido de «Más»). Corregido en el catálogo de `schema.sql` y con un `UPDATE` idempotente para las bases que ya tenían el texto viejo.
- **Prueba:** `carro.test.ts` («ningún servicio le muestra Tumbite al público»), rojo comprobado.

## C-TEXTOS-POR-SERVICIO (30 oct 2026) — todos los países

- El formulario de pedir (`apps/cliente/src/viajes/PedirMoto.tsx`) es el mismo para Moto, Carro y Envíos, pero cada uno dice lo suyo: el casco y «un pasajero con mochila» solo en Moto; Carro dice hasta 4 pasajeros (6 en XL); Envíos pregunta «Dónde recogemos el paquete» y «¿A dónde lo llevamos?».
- Lo destapó el repaso en el celular del 30 oct en el sitio de pruebas. Prueba: `e2e/recorrido/mas.spec.ts` («cada servicio dice lo suyo»), rojo comprobado.

## C-COLORES-DRIVER (30 oct 2026) — todos los países

- La barra de abajo y la campana del Driver eran imágenes azules (fuera de la paleta) con un punto rojo PINTADO en la campana y en Perfil, que parecía un aviso aunque no hubiera ninguno. Ahora son íconos vectoriales (`@expo/vector-icons` 15.0.2, Ionicons, MIT) en los colores de la marca: activo en rojo, el resto gris, campana en negro; el punto rojo solo sale con avisos reales.
- Piezas: `apps/repartidor/src/piezas/BarraInferior.tsx` y `CabeceraDriver.tsx`. Prueba: `e2e/recorrido/coloresDriver.spec.ts` (rojo comprobado con el código viejo; captura en `docs/capturas/driver-colores-es.png`).

## C-RECORRIDO-CARRO-ENVIOS (30 oct 2026) — todos los países

- `e2e/recorrido/envios.spec.ts`: un envío de punta a punta en las apps web (PIN visible para el cliente, «Cancelar el envío», foto del paquete en el Driver, «Llevando el paquete a…» y entrega con el PIN). `e2e/recorrido/carro.spec.ts`: un viaje en Carro (el Driver pide el código y no el casco).
- En el sitio local (que no cuenta como sitio de pruebas) los dos encienden su servicio en la base con `servicios_implementados`, igual que las pruebas del servidor.
- Lo destapó el recorrido: Envíos decía «Llevando a Paula» y «Cancelar el viaje»; arreglado con textos propios y rojo comprobado. Capturas en `docs/capturas/envio-*.png` y `carro-driver-codigo-es.png` (para Docs cuando se enciendan).

## C-MAS-RESTAURANTE (30 oct 2026) — todos los países

- **Qué se rompió:** la pestaña «Más» de la app del restaurante solo tenía «Cerrar sesión» y unos tres puntos sueltos; el dueño no encontraba sus datos, horario, ganancias, reseñas ni equipo desde el celular.
- **Arreglo:** lista como la de DoorDash Merchant, armada por una sola pieza (`opcionesMasRestaurante` en `packages/compartido/src/masRestaurante.ts`) y pintada por `apps/restaurante/src/Mas.tsx`: «Tu restaurante» (datos y horario, ganancias, reseñas, equipo, configuración) y «Ayuda» (guías, soporte por WhatsApp si está configurado, términos). Cerrar sesión al final y la versión debajo. Borrar la cuenta sigue dentro de Configuración.
- **Candados:** `masRestaurante.test.ts` (opciones, destinos sin direcciones internas, inglés) y `e2e/recorrido/masRestaurante.spec.ts` (en rojo con la versión vieja, en verde con la nueva; capturas `docs/capturas/restapp-mas-*.png`).

## C-FLEX-ACTIVIDAD (30 oct 2026) — todos los países

- **Qué se rompió:** en el panel de Divoox Flex la actividad reciente mostraba códigos internos («empresa.crear»), los permisos de las claves de la API salían como códigos sin explicar, y las horas salían en formato de la base y en hora universal («2026-10-30 12:23:05»).
- **Arreglo:** `packages/compartido/src/flexTextos.ts`: `textoAccionFlex` (frase en los dos idiomas para cada acción que anota el servidor; si aparece una nueva sin frase, «Cambio en la empresa», nunca el código), `textoPermisoClave` (nombre claro, con el código al lado para quien programa) y `fechaHoraLocal` (hora local y en el idioma). Aplicado en actividad, claves, billetera (movimientos, recargas, comisiones, comprobantes), envíos, trazabilidad e importaciones. El comprobante sigue diciendo UTC a propósito.
- **Candado:** `apps/servidor/src/flex/flexTextos.test.ts` recorre el código del servidor y exige frase para cada `sentenciaAuditoria` (una acción nueva sin frase pone la prueba en rojo).

## C-CALIFICACION-PUBLICA (30 oct 2026) — todos los países

- **Qué faltaba:** el cliente no veía la calificación de ningún restaurante real (solo estrellas inventadas en las tarjetas de ejemplo, que ni se pintaban).
- **Cómo funciona:** `conCalificaciones` en `apps/servidor/src/rutas/catalogo.ts` suma promedio y cuenta de `calificaciones` (pedidos verificados) a la lista, la ficha y el buscador; `GET /datos/restaurantes/:id/resenas` da las 20 reseñas más nuevas con comentario y la respuesta del restaurante, solo con el nombre de pila. La regla de 10 opiniones vive en `packages/compartido/src/calificacionPublica.ts`. En la app: `apps/cliente/src/comida/Calificacion.tsx`.
- **Candados:** las tres pruebas de la ficha `docs/investigaciones-rea/2026-10-30-calificacion-publica.md`. Captura: `docs/capturas/calificacion-ficha-es.png`.
- **No tocar:** nunca mostrar el apellido ni el número de pedido en lo público; nunca bajar el mínimo de 10 sin decisión escrita.

## C-ACEPTAR-SOLO (30 oct 2026) — todos los países

- **Qué es:** el «auto-confirm» de DoorDash. Columna `restaurantes.aceptar_solo` (vía COLUMNAS), ruta `PATCH /datos/mi-restaurante/aceptar-solo` (dueño o manager), pieza `aceptarSiEsAutomatico` en `apps/servidor/src/rutas/operacion.ts`.
- **Dónde corre:** al final de `correosDePedidoPagado` (todos los caminos de pago: tarjeta, aviso de Stripe, cobro directo), en un `finally` para que un correo caído no la salte, y en el vigilante (`manager.ts`) para los programados cuya ventana se abrió y los que esperaban la decisión de un plato agotado.
- **Candados:** `operacion.test.ts` («aceptación automática») y `PedidosAceptarSolo.test.tsx`. Ficha: `docs/investigaciones-rea/2026-10-30-aceptar-solo.md`. Guía pública: Docs → Para restaurantes → «Aceptar pedidos automáticamente».
- **No tocar:** nunca aceptar un pedido con un plato agotado pendiente ni un programado fuera de su ventana.

## C-NOTA-PLATO (30 oct 2026) — todos los países

- **Qué es:** «Instrucciones especiales» por plato (Uber Eats y DoorDash). La nota viaja en cada línea (`nota`, máximo 140 letras, limpia con `limpiarNotaPlato`), el mismo plato con otra nota es otra línea del carrito (`claveDeLinea` la incluye) y `textoLinea` la escribe («· Nota: …»), así que sale sola en el carrito, el panel, la comanda, la app del restaurante, la del repartidor y los correos.
- **Candados:** `packages/compartido/src/notaPlato.test.ts`, `pedidos.test.ts` («nota por plato») y `e2e/recorrido/notaPlato.spec.ts` (en rojo con la versión anterior). Captura: `docs/capturas/nota-plato-carrito-es.png`. Guía: Docs → «Instrucciones especiales para un plato».

## C-AGOTADO-HOY (30 oct 2026) — todos los países

- **Qué es:** como DoorDash Merchant, un plato se agota «por hoy» (vuelve solo) o «sin fecha». Columna `platos.agotado_hasta` (vía COLUMNAS) con la medianoche del restaurante en UTC (`limitesDelDia`); la tarea del reloj `platos_vuelven` (`volverPlatosAgotados`) los reactiva. Panel: «Agotado por hoy» en los tres puntos; app: «Agotado por hoy» y «Agotado sin fecha».
- **Candados:** `catalogo.test.ts` («agotado por hoy») y `Menu.test.tsx` (en rojo sin el cambio). Guía: Docs → «Marcar un plato como agotado».

## C-CORREO-ENTREGA (30 oct 2026) — todos los países

- **Qué es:** como DoorDash, al entregar le llega al cliente un correo con la foto de la entrega y el enlace para calificar (`correoDeEntrega` en `apps/servidor/src/avisos.ts`, llamado después de la entrega; si el correo falla, la entrega ya quedó).
- **Privacidad:** la foto sigue privada; el correo usa un enlace propio (`fotos_entrega_publicas`, ficha de 32 letras al azar) servido por `GET /datos/entregas/foto/:token`, que vence a los 7 días (`DIAS_FOTO_ENTREGA`) y no se indexa. Entrega en mano (sin foto): correo sin imagen.
- **Candado:** `apps/servidor/src/correoEntrega.test.ts` (imagen en el correo, enlace sin sesión, inventado y vencido dan 404).

## C-DIRECCION-APTO (30 oct 2026) — todos los países

- **Qué es:** como DoorDash y Uber Eats, «Apto, piso o edificio» en su propia casilla del carrito (con borrador). Se guarda en `pedidos.apto` y `direcciones_cliente.apto` (vía COLUMNAS) y se suma a `pedidos.direccion` («… · Apto 4B»), así lo ven sin cambios el repartidor, el restaurante, los correos y el seguimiento. También al cambiar la dirección de un pedido en curso.
- **Candados:** `pedidos.test.ts` («apartamento, piso o edificio») y `e2e/recorrido/notaPlato.spec.ts` (la casilla existe y no se pierde al recargar; en rojo con la versión anterior).

## C-MENU-PLANILLA (30 oct 2026) — todos los países

- **Qué es:** el menú de comida desde una hoja de cálculo (plantilla de menú de DoorDash y Uber Eats) y el alta asistida del estudio E2, página 3 (nuestro equipo carga el menú por el restaurante). Lector: `packages/compartido/src/menuPlanilla.ts` (columnas en los dos idiomas y alias comunes, precio en la moneda del restaurante, errores por fila). Rutas: `POST /datos/mi-restaurante/platos/importar` (dueño o manager) y `POST /datos/admin/restaurantes/:id/platos/importar` (equipo, queda en `auditoria_admin` como `menu_importado`). Sin «confirmar» es vista previa. Mismo nombre = se actualiza, nunca se duplica.
- **Pantalla:** `apps/panel/src/panel/ImportarMenu.tsx`, en Menú y en la ficha del restaurante del superadmin.
- **Candados:** `menuPlanilla.test.ts`, `catalogo.test.ts` («menú desde una planilla») e `ImportarMenu.test.tsx`. Guía: Docs → «Cargar el menú desde una planilla».

## C-OPCIONES-ANIDADAS (30 oct 2026) — todos los países

- **Qué es:** los «nested modifier groups» de Uber Eats (estudio E2, pág. 3): una opción abre otro grupo del mismo plato (combo → bebida → tamaño), de un solo nivel. Columna `opciones.abre_grupo_id` (vía COLUMNAS); `gruposDe` marca `anidado` y `abreGrupoId`; `gruposActivos` (compartido) decide qué grupos cuentan: la usan el servidor al validar y cobrar (`lineasDeRestaurante`) y la app al mostrar. El panel tiene «Al elegirla, pide también» por opción y «Copiar las opciones de otro plato» (los mismos grupos en varios platos).
- **Candados:** `opcionesAnidadas.test.ts`, `operacion.test.ts` («el combo pide la bebida…»: sin el anidado no se pide, una opción de un anidado cerrado no vale, el precio suma), `Menu.test.tsx` (copiar y abrir grupo; en rojo sin el cambio) y `e2e/recorrido/notaPlato.spec.ts` (el grupo aparece y desaparece; captura `docs/capturas/opciones-anidadas-es.png`).

## C-MENU-HORARIO (30 oct 2026) — todos los países

- **Qué es:** menús por horario (estudio E1, pág. 3; DoorDash y Uber Eats): franja diaria por categoría en `horarios_categoria`, editada en el panel (`HorariosMenu.tsx`, `PUT /datos/mi-restaurante/horarios-categoria`). Fuera de su franja, la ficha pública no muestra esos platos y devuelve `fueraDeHorario` (la app dice cuándo se sirven); `lineasDeRestaurante` rechaza pedirlos (con la hora de la franja si el pedido es programado). Regla única: `categoriaEnHorario` (compartido).
- **Candados:** `catalogo.test.ts` («menús por horario») y `HorariosMenu.test.tsx`. Guía: Docs → «Horarios del menú».

## C-APP-RESTAURANTE-PAR (30 oct 2026) — todos los países

- **Qué es:** como DoorDash Merchant y Uber Eats Manager, la app del restaurante hace en el celular lo que antes solo hacía el panel: «Horario y cierres» (`apps/restaurante/src/Horario.tsx`: turnos por día y festivos) y «Reseñas» (`Resenas.tsx`: lista y respuesta pública, con borrador). Se abren desde «Más» (`pantalla` en `opcionesMasRestaurante`).
- **Opciones (C-APP-OPCIONES, mismo día):** las opciones y extras, con grupos anidados, también se editan en la app (`apps/restaurante/src/EditorOpciones.tsx`, formulario en el borrador del plato; conversión en `packages/compartido/src/opcionesFormulario.ts`). Candados: `opcionesFormulario.test.ts` y la prueba «crea un grupo de opciones desde la app» de `masRestaurante.spec.ts`.
- **Candados:** `masRestaurante.test.ts` y `e2e/recorrido/masRestaurante.spec.ts` (guarda un turno y lo comprueba en el servidor; abre reseñas). Capturas: `docs/capturas/restapp-horario-*.png`.

## C-CHAT-FOTOS (30 oct 2026) — todos los países

- **Qué es:** fotos dentro del chat del pedido (brecha 2 de `docs/investigaciones-rea/2026-10-29-tiendas-reemplazos.md`, estilo Instacart). `POST /datos/pedidos/:id/mensajes/foto` (bytes, solo imágenes reales, 3 MB, chat abierto) guarda en `chat/<pedido>/…` y anota `mensajes_pedido.foto_clave`; `GET /datos/pedidos/:id/mensajes/:mid/foto` solo para los del pedido y soporte. `ChatPedido` recibe `elegirFoto` (cliente: galería; Driver: cámara) y muestra la foto con `api.verFoto`.
- **Candado:** `operacion.test.ts` («el chat lleva fotos…»: texto disfrazado da 415, un extraño no la ve).
- **C-CHAT-FOTOS, lección (30 oct):** el botón se llamaba «Send a photo» y el recorrido buscaba «Send»: dos botones y la verificación en la nube cayó, frenando la publicación de todo el día. Ahora se llama «Adjuntar una foto» / «Attach a photo». Antes de publicar algo que agrega botones a pantallas del recorrido, correr el recorrido completo en local.

## C-PLAY-NO-CANCELAR (30 oct 2026) — todos los países

- **Qué se rompió:** cada subida a Google Play cancelaba el envío en revisión anterior. Divoox y Divoox Driver tenían nueve envíos «Cancelada» en su Actividad de envío y la lista de apps decía «Aún no se envió a revisión». El script decía «a revisión de Google» y eso se le repitió a Richard sin comprobarlo en la consola.
- **Arreglo:** `scripts/tiendas/publicar-google-play.mjs` no sube si existe `~/.config/tumbite/play-en-revision/<paquete>` (sale con código 3 y explica por qué); al subir, pone el candado. Se quita a mano cuando Google aprueba. `FORZAR=1` solo si Richard lo pide.
- **Cómo se comprueba:** consola de Google Play, cuenta go@windoce.com (cuenta 2 del Chrome) → app → Descripción general de la publicación → Actividad de envío: el último envío dice «En revisión» y ninguno nuevo lo cancela.

## C-CSP-ESTADISTICAS (30 oct 2026) — todos los países

- **Qué se rompió:** en cada pantalla que sirve el servidor la consola marcaba un error: el borde de Cloudflare inyecta su script de estadísticas (`static.cloudflareinsights.com`) y la política de seguridad lo bloqueaba. Hallado con REA en el repaso de pantallas (`docs/investigaciones-rea/2026-10-30-repaso-pantallas.md`).
- **Arreglo:** `apps/servidor/src/seguridad.ts` permite ese dominio en `script-src`, y nada más de afuera además de Stripe y Turnstile.
- **Candado:** `app.test.ts` («la política deja cargar las estadísticas de Cloudflare y nada más…») compara la lista exacta de `script-src`; comprobada en rojo.
- **Lección del recorrido del 30 oct:** el sitio de pruebas guarda las cuentas de corridas anteriores y tiene todos los servicios encendidos; toda prueba que registre cuentas usa teléfonos propios por corrida y no da por hecho qué servicio está «por venir».

## C-LECTURA-REINTENTO (30 oct 2026) — todos los países

- **Qué se rompió:** en el sitio de pruebas, de vez en cuando una sola petición de lectura se perdía en el camino y la pantalla del caso de dinero del panel de soporte se quedaba en «…» hasta el corte de 30 segundos (el recorrido falló dos veces el 30 oct por eso). El servidor respondía en 1,4 s; el problema era la petición perdida.
- **Arreglo:** `packages/compartido/src/api.ts`: una lectura (GET) se corta a los 15 s y se repite una vez con el límite normal; los envíos (POST, PUT, PATCH, DELETE) nunca se repiten solos, para no duplicar acciones. Una lectura que responde con error tampoco se repite.
- **Candado:** `api.test.ts` (tres pruebas: la lectura perdida se repite y entrega, el envío no se repite, el error no se repite); comprobado en rojo.

## C-PILOTO (30 oct 2026) — todos los países

- **Qué es:** la lista de participantes autorizados del piloto en producción controlada (`docs/PLAN-LANZAMIENTO-PILOTO.md`). Superadmin → «Piloto»: agregar por el correo de la cuenta, quitar desde los tres puntos con confirmación, y el registro de quién entró, quién salió y quién lo hizo. Servidor: `apps/servidor/src/rutas/piloto.ts` (`esParticipante`), tablas `piloto_participantes` y `piloto_eventos`, sin claves foráneas a usuarios (lección de C-REWARDS-LIMPIEZA).
- **Candado:** `piloto.test.ts` (alta por correo sin importar mayúsculas, sin duplicar, baja anotada, correo sin cuenta con mensaje claro, solo el equipo) y `SuperPiloto.test.tsx` (agregar, lo escrito no se pierde al fallar ni al volver, quitar escondido en los tres puntos).

## C-PILOTO-SERVICIOS (30 oct 2026) — todos los países

- **Qué es:** un servicio encendido «solo piloto» en una ciudad (`servicios_piloto`). Los participantes lo ven «disponible» en `/datos/servicios` y pueden usarlo (Tiendas y viajes de Envíos); el público y quien no está en el piloto lo siguen viendo «muy pronto». Solo `SERVICIOS_PILOTO` (Envíos, Mercado, Farmacia, Licores, Más): **Moto y Carro no**, porque llevan pasajeros y esperan lo legal y el seguro (409 si se intenta).
- **Ojo:** `/datos/servicios` con sesión responde `private, no-store`: la lista es de esa persona y no puede quedar en la caché compartida.
- **Candado:** `piloto.test.ts` (participante sí, otro cliente y visitante no, Tiendas 200/404, apagar lo cierra, Moto y Carro rechazados) y `SuperPiloto.test.tsx` (la casilla manda el cambio).

## C-PILOTO-LIMITES (30 oct 2026) — todos los países

- **Qué es:** topes de dinero solo para los participantes del piloto: por pedido y por día (por defecto 50 y 150 dólares; se cambian en Superadmin → Piloto, guardados en `config` como `piloto_tope_pedido` y `piloto_tope_dia`). `exigirTopePiloto` corre en `POST /datos/pedidos` antes de guardar; el día suma los pedidos de hoy que no se cancelaron. Quien no está en el piloto no cambia nada.
- **Candado:** `piloto.test.ts` (fuera del piloto sin tope, dentro 409 con campo `total`, la suma del día).

## C-REWARDS-PILOTO (30 oct 2026) — todos los países

- **Qué es:** Rewards sale del modo sombra para el piloto. `modoRewards`: «sombra» en el sitio de pruebas (todos), «piloto» en producción solo con la variable `REWARDS_MODO=piloto` y solo para los participantes (`piloto_participantes`), «apagado» en cualquier otro caso. `/datos/repartidor/estado` trae `reputacion` (puntaje, nivel, provisional, lo que falta para el siguiente) cuando está activo para esa persona, y Driver la muestra en lugar del nivel viejo por puntos.
- **Para encender en producción:** variable `REWARDS_MODO=piloto` en YaDominios Cloud → sitio tumbite. Para apagar: quitarla o poner `apagado`. Nada se paga en este paso.
- **Candado:** `sombra.test.ts` (fuera del piloto no aparece, dentro con el modo sí, el reloj de producción calcula solo a los participantes).

## C-REWARDS-MI-NIVEL (30 oct 2026) — todos los países

- **Qué es:** `GET /datos/repartidor/mi-nivel` (solo si Rewards está activo para esa persona; si no, 404) con los cinco componentes del puntaje y su máximo (30/25/20/15/10), la experiencia por servicio, la elegibilidad y el avance al primer hito. En Driver, la tarjeta `MiNivel` debajo del nivel explica cada parte en palabras simples, como «Ratings» de Dasher.
- **Candado:** `sombra.test.ts` (los cinco componentes en orden, máximo 30 en finalización, experiencia de comida, hito de 100; 404 sin Rewards activo).

## C-REWARDS-AJUSTES (30 oct 2026) — todos los países

- **Qué es:** Superadmin → «Rewards» cambia sin publicar: umbrales de Plata, Oro y Diamante (en orden, si no 400), porcentaje del margen (0 a 50), tope por premio, entregas por hito y presupuesto por ciudad y mes (`rewards_presupuesto`). Se guardan en `config.rewards_ajustes`; el cálculo diario y «Mi nivel» los leen (`leerAjustes`). Arranca con porcentaje 0 y sin presupuesto: nada se paga hasta que el equipo los fije.
- **Candado:** `sombra.test.ts` (los umbrales nuevos cambian el nivel; el presupuesto se guarda; fuera de orden se rechaza), `reputacion.test.ts` (umbrales ajustables) y `SuperRewards.test.tsx` (el formulario manda los valores en centavos).

## C-REWARDS-PRIORIDAD (30 oct 2026) — todos los países

- **Qué es:** al ofrecer un pedido, dentro del mismo tramo de medio kilómetro, el repartidor de mejor nivel de reputación recibe primero (como Platinum de DoorDash). Va después del turno reservado y antes del destacado; nunca salta la distancia. Apagada por defecto: se enciende en Superadmin → Rewards (`prioridadDespacho`). Solo cuenta el nivel de los participantes del piloto (`nivel_rep` en `libresEn`).
- **Candado:** `prioridadNivel.test.ts` (apagada = orden de siempre; encendida = gana el nivel dentro del tramo; el turno sigue primero).

## C-REWARDS-PREMIO-VARIABLE (30 oct 2026) — todos los países

- **Qué es:** decisión de Richard: el premio es un porcentaje configurable del margen de contribución real de las entregas que cuentan, con tope. `montoPremio(margen, porcentaje, tope)` en compartido; `margenDe` suma `pedidos.ganancia` de las últimas entregas pagadas (tantas como el hito). El hito y el porcentaje salen de Superadmin → Rewards. Con porcentaje, tope o margen en cero no se registra ningún premio (ninguna obligación). Viajes y Flex todavía no aportan margen (Fase 3).
- **Candado:** `rewardsHitos.test.ts` (porcentaje, tope, ceros) y `sombra.test.ts` (10 % de 10 entregas de 6,50 = 6,50 de premio «ganado»; con 0 % no hay fila).

## C-REWARDS-PAGO (30 oct 2026) — todos los países

- **Qué es:** `pagarPremios` (corre al final del cálculo diario): un premio «ganado», con 14 días sin reclamos (`DIAS_RETENCION`) y su presupuesto reservado, pasa a «pagado» con UNA sentencia condicionada y acredita la billetera con un movimiento `ajuste`, referencia `premio:<programa>:<hito>` e id fijo `premio-<repartidor>-<programa>-<hito>` (nunca dos veces). Paga el menor entre el monto del hito y lo reservado. Sin reserva no paga. Queda en `rewards_eventos`.
- **Ojo:** la tabla `movimientos` no admite el concepto «premio» (su CHECK); por eso es `ajuste` con su referencia. Para reportes, filtrar `referencia LIKE 'premio:%'`.
- **Candado:** `sombra.test.ts` (diez a la vez = un pago y un evento; dentro de los 14 días no paga; sin reserva no paga).

## C-REWARDS-APELACIONES (30 oct 2026) — todos los países

- **Qué es:** en Driver («Mi nivel»), el repartidor elige una de sus últimas 10 entregas y cuenta qué pasó (10 a 500 letras, el borrador no se pierde). Solo sus propias entregas (si no, 404) y una vez por entrega (409). Soporte la ve en Superadmin → Rewards y la acepta o no (una sola vez: sentencia condicionada a «abierta»). Una entrega con apelación aceptada deja de contar en `unidadesPedidos`.
- **Candado:** `sombra.test.ts` (apelar, no repetir, aceptar sube el puntaje, la ve como aceptada; entrega ajena 404).

## C-COLOR-LOGISTICA (30 oct 2026) — todos los países

- **Qué es:** decisión de Richard: logística (Flex y Envíos) tiene su propio color, distinto de comida, para reconocer una captura de un vistazo. Tomado del bloque real de Amazon Flex: `MARCA.colores.logistica` #1F4D69 (fondo), `logisticaAccion` #4AA5DC (botones) con texto `logisticaTexto` #0B1F2B, y `logisticaSuave`. Driver «Mi ruta» lleva arriba la franja «DIVOOX FLEX» y sus botones y la parada actual en ese color; el cliente lo ve en Envíos; el panel de empresas (`.flex-panel`) cambia `--primario` a logística.
- **Candado:** `colorLogistica.test.ts` (distinto del rojo, del acento y del verde; contraste de lectura de 4.5 o más).

## C-FLEX-GEOCERCA (30 oct 2026) — todos los países

- **Qué es:** como «Fuera de área de entrega» de Amazon Flex: con la ubicación del celular, el servidor rechaza entregar una parada a más de 200 m de la dirección del envío (`RADIO_ENTREGA_M` en `flex/conductor.ts`, 409 con campo `ubicacion` y los metros). La app avisa antes de intentar, con el mismo radio. Sin ubicación del celular se acepta como antes (la cola sin conexión). El mapa de la ruta dibuja el círculo del área (200 m) alrededor de la parada siguiente, en el azul de logística, en el celular y en la web.
- **Candado:** `flexRutas.test.ts` («lejos de la dirección no deja entregar; en la puerta sí»).

## C-FLEX-LUGAR y C-FLEX-DESLIZAR (30 oct 2026) — todos los países

- **Qué es:** como Amazon Flex: al entregar, el conductor elige dónde quedó el paquete (`LUGARES_ENTREGA`: destinatario, recepción, puerta, buzón, otro); el servidor lo valida y lo guarda en el evento de entrega (`metadatos_json.lugar`). La foto lleva el consejo «que se vea el lugar y sin personas». Se termina con `Deslizar` (piezas de Flex), no con un toque; con lector de pantalla, la acción «activar».
- **Candado:** `flexRutas.test.ts` («se guarda una de las cinco opciones; otra cosa se rechaza»).

## C-FLEX-FOTO-ANTERIOR (30 oct 2026) — todos los países

- **Qué es:** como Amazon Flex: `GET …/conductor/rutas/:rutaId/paradas/:paradaId/foto-anterior` devuelve la foto de la última entrega hecha en la misma dirección (misma empresa, parada entregada, foto no purgada), solo durante la ruta en curso del propio conductor; sin entrega previa, 404. En Driver, la tarjeta de la parada la muestra como «Entrega anterior en esta puerta».
- **Candado:** `flexRutas.test.ts` («en la misma dirección muestra la foto de la entrega anterior; sin entrega previa, nada»).

## C-IOS-TEXTOS-PERMISO (30 oct 2026) — EE. UU. (App Store)

- **Qué se rompió:** las compilaciones de iPhone de Divoox y Divoox Driver «se subieron» bien según Expo, pero nunca aparecieron en App Store Connect. Apple las rechazó al procesarlas con el error 90683: faltaba `NSMotionUsageDescription` (una librería toca el sensor de movimiento aunque la app no lo pida).
- **Cómo se ve el motivo:** `GET /v1/apps/<id>/buildUploads` con la llave de la API muestra `state.errors` de cada subida (el listado de compilaciones no muestra las rechazadas).
- **Causa real:** `expo-location` estaba configurado con `motionUsagePermission: false`, y ese `false` BORRA el texto al generar el proyecto nativo (el primer arreglo, solo en `infoPlist`, dio verde y Apple siguió rechazando la compilación 7 del cliente y la 2 de Driver). Se comprueba con `npx expo config --type introspect` dentro de la app: tiene que salir `NSMotionUsageDescription`.
- **Arreglo:** el texto en `expo.ios.infoPlist` de las tres apps y en `motionUsagePermission` de `expo-location`. La prueba `packages/compartido/src/textosPermisosIos.test.ts` se pone en rojo si a una app le falta un texto exigido o si un plugin tiene el permiso de movimiento en `false` (las dos comprobadas en rojo).
- **No tocar:** ningún texto de permiso se quita de `app.json` sin comprobar antes en `buildUploads` que Apple acepta la compilación.

## C-PAGO-APPLE-PAY (31 oct 2026) — EE. UU. (app de iPhone del cliente)

- **Qué se rompió:** en el iPhone, al llegar al pago, la hoja de Stripe no abría y salía en rojo «`merchantIdentifier` is required…». No se podía pagar ni con tarjeta. Lo vio Richard en la compilación 8 (la que Apple revisaba).
- **Causa real:** `initPaymentSheet` pedía Apple Pay (`applePay`) y `initStripe` no recibía el identificador de comercio de Apple.
- **Arreglo:** Apple Pay solo se pide si la compilación trae `EXPO_PUBLIC_APPLE_PAY_COMERCIO` (el identificador `merchant.com.tumbite.cliente` ya dado de alta con su certificado de Apple Pay en Stripe); entonces va también a `initStripe`. Sin la variable: tarjeta y Google Pay. Prueba `packages/compartido/src/pagoApplePay.test.ts` (comprobada en rojo).
- **No tocar:** no se vuelve a poner `applePay` suelto en la hoja. Para encender Apple Pay: certificado en Stripe → variable en `eas.json` → compilar.

## C-NO-RECIBE-AHORA (31 oct 2026) — todos los países

- **Qué se veía:** un restaurante abierto todo el día pero sin su panel o app escuchando aparecía «Abre mañana a las 12:00» (la próxima apertura inventada) y el texto se cortaba en la tarjeta. Visto en el simulador de iPhone con Pizzería Demo Novi.
- **Arreglo:** `textoNoDisponible` (`packages/compartido/src/horarios.ts`): en horario pero sin recibir → «No recibe pedidos ahora»; fuera de horario → cuándo abre; cerrado a mano o sin horario → «Cerrado». Lo usan la lista de restaurantes, el inicio y la ficha del restaurante. La fila del estado baja de línea en vez de cortarse. Pruebas en `horarios.test.ts`.

## C-RUTA-SIN-BARRA (31 oct 2026) — todos los países

- **Qué se veía:** al entrar al panel del restaurante por «/panel/» (con barra final) salía «Esta sección llega en el siguiente paso» en vez del tablero.
- **Arreglo:** `sinBarraFinal` en `apps/panel/src/ruta.ts`: la dirección se lee sin la barra del final (salvo «/»). Prueba `apps/panel/src/ruta.test.tsx`.

## C-RECORRIDO-NO-PISA (31 oct 2026) — sitio de pruebas

- **Qué pasó:** una prueba manual en el simulador de iPhone (pedido de Pizzería Demo Novi, Michigan) quedó «cancelado» sin historial justo después de aceptarse. Causa: el recorrido automático, al arrancar en el sitio de pruebas, cancelaba TODOS los pedidos aceptados sin repartidor y desconectaba a TODOS los repartidores.
- **Arreglo:** el recorrido solo cancela pedidos de restaurantes del propio recorrido (dueños `@recorrido.test`) y solo desconecta repartidores de Miami (donde corre); carro y envíos igual. Prueba `packages/compartido/src/recorridoNoPisa.test.ts` (comprobada en rojo).
- **Regla:** ninguna limpieza automática del sitio de pruebas toca datos que no sean suyos: ahí también prueban las personas (guía de pruebas con teléfonos).

## C-DISTANCIA-POR-PAIS (31 oct 2026) — EE. UU. y todos los países

- **Qué se veía:** en el iPhone en español, en Michigan, la lista de restaurantes y la oferta del repartidor decían «6.4 km». En EE. UU. el estándar (DoorDash, Uber Eats) es millas en cualquier idioma.
- **Arreglo:** `textoDistancia` / `usaMillas` en `packages/compartido/src/distancia.ts`: la unidad la decide el país del servicio (millas en US y PR, kilómetros en el resto). El servidor manda `pais` con cada restaurante (de la tabla `zonas`) y con cada pedido u oferta del repartidor (del código de la zona). Sin país conocido se mantiene lo de antes (por idioma). Pruebas: `distancia.test.ts`, `catalogo.test.ts`, `operacion.test.ts`.

## C-CARRITO-NO-SE-BORRA-SOLO (31 oct 2026) — todos los países

- **Qué se veía:** en el simulador de iPhone, «Pedir otra vez» abría el carrito lleno y a los pocos segundos quedaba «Tu carrito está vacío», sin tocar nada.
- **Causa real:** la pantalla del pedido pregunta el seguimiento cada 5 segundos y en cada vuelta vaciaba el carrito si el pedido no estaba en «pago pendiente». Al abrir el carrito encima, la pantalla seguía viva detrás y borraba el carrito nuevo. Le pasaba a cualquiera con un pedido abierto detrás que empezara otro carrito.
- **Arreglo:** se vacía una sola vez y solo al llegar recién pagado (`?nuevo=1`, que usan el pago en la app, el pago en la web con 3D Secure y el cobro directo). Prueba `packages/compartido/src/carritoNoSeBorra.test.ts` (comprobada en rojo).

## C-STRIPE-ES419 (31 oct 2026) — EE. UU. (app de iPhone del cliente)

- **Qué se veía:** en la hoja de pago, en español, «permites que {Divoox} cargue en tu tarjeta…» (con llaves).
- **Causa real:** la traducción es-419 del SDK de Stripe para iPhone trae «{%@}» (la es-ES está bien). Nuestro `merchantDisplayName` es correcto.
- **Arreglo:** `plugins/stripe-espanol.js` agrega al `post_install` del Podfile un paso que cambia «{%@}» por «%@» en las traducciones de StripePaymentSheet. Comprobado: después de `pod install` el texto sale sin llaves. Prueba `packages/compartido/src/stripeEspanol.test.ts`. Se quita cuando Stripe corrija su traducción.

## C-VUELTA-VERIFICA (31 oct 2026) — todos los países

- **Qué es:** como DoorDash al volver a la app (capturas de Richard), si el repartidor lleva 14 días o más sin conectarse (su última ubicación), la foto de control se pide SIEMPRE antes de conectarse, aparte de la del azar semanal. Evita que otra persona use una cuenta que estaba quieta (alquiler o robo de cuenta).
- **Sin bucle:** si ya tomó una foto de control en esos 14 días, no se le vuelve a pedir.
- **Dónde:** `apps/servidor/src/rutas/operacion.ts` (`DIAS_PARA_VERIFICAR_AL_VOLVER`). Prueba en `kyc.test.ts` (comprobada en rojo).

## C-PRUEBA-DE-VIDA (31 oct 2026) — todos los países

- **Qué es:** como DoorDash («Mira ligeramente a la derecha»), la foto de control son dos fotos: de frente y con la cabeza girada a la derecha. Una foto de una foto o de una pantalla no gira. El equipo ve las dos en el panel (Super › identidad) y marca si coincide. La comparación automática con IA sigue esperando el proveedor que decida Richard (K5).
- **Servidor:** `POST /datos/kyc/selfie-control?pose=frente` y después `?pose=giro` (guardado como `<clave>-giro`); la foto queda «tomada» al llegar el giro. Sin `pose` funciona como antes (una sola foto) para las versiones de las apps que ya están en revisión. `estado.selfieControlFalta` dice cuál falta.
- **Prueba:** `kyc.test.ts` (comprobada en rojo).

## C-TERMINOS-ACTUALIZADOS (31 oct 2026) — todos los países

- **Qué es:** como DoorDash («Acuerdo de términos y condiciones actualizado»), si los términos de los repartidores cambian, cada repartidor los lee y los acepta antes de conectarse. Queda registrado quién aceptó qué versión y cuándo (tabla `terminos_aceptados`, sin llave foránea para no trabar el borrado de cuentas).
- **Cómo se cambia la versión:** `VERSION_TERMINOS` en `packages/compartido/src/terminos.ts` = la fecha de «Actualizado» de `apps/panel/src/sitio/legales.ts`. Al registrarse se acepta la vigente. Al revisor de las tiendas no se le pide.
- **Prueba:** `apps/servidor/src/rutas/terminos.test.ts` (comprobada en rojo).

## C-FLEX-CARGA-LISTA, C-FLEX-MAPA-ENCUADRE y C-FLEX-DISTANCIA-PAIS (31 oct 2026) — todos los países (millas en EE. UU.)

- **Cómo se vio:** repasando «Mi ruta» en el simulador de iPhone con una ruta de prueba en Michigan (`scripts/staging/armar-ruta-flex-novi.mjs`). Con los tres paquetes cargados seguía «Escanear siguiente» y «Salir a la ruta» quedaba abajo, debajo de «escanea todos los paquetes»; el mapa de la ruta no mostraba las paradas; la distancia a la parada salía en kilómetros.
- **Arreglo:** con la carga completa (todo escaneado o marcado como faltante) el botón principal es «Salir a la ruta», también en la pantalla de «Paquete cargado» (como Amazon Flex). `MapaRuta` encuadra en `onMapReady` (el mismo fallo de C-MAPA-ENCUADRE). El detalle de la ruta trae `pais` de la empresa y la app usa `textoDistancia` (C-DISTANCIA-POR-PAIS).
- **Prueba:** `packages/compartido/src/flexMiRutaRepaso.test.ts` (comprobada en rojo).

## C-FLEX-DESLIZAR-SCROLL, C-FLEX-AVISO-AL-DAR, C-FLEX-TERMINAR-A-LA-VISTA, C-FLEX-SIN-DEVOLUCIONES, C-FLEX-RUTA-EN-INICIO (31 oct 2026) — todos los países

- **Deslizar:** tras un primer intento rechazado («elige dónde lo dejaste»), «Desliza para finalizar» ya no cerraba la entrega: el gesto se rearmaba en cada render y el iPhone se quedaba con el primero (ancho 0). Ahora el gesto se arma una vez (`useState`) y lee el ancho y la acción en una referencia; toma el toque y no lo cede a la lista. Comprobado en el simulador: segundo intento cierra la entrega.
- **Avisos:** al elegir dónde se dejó, al firmar o al tomar la foto, el aviso de lo que faltaba se borra. «Firma lista» va en verde.
- **Final de la ruta:** con todas las paradas hechas, «Terminar entregas y volver al centro» es el botón principal verde arriba; sin devoluciones dice «Ya puedes cerrar la ruta» en vez de una caja vacía.
- **Inicio:** la ruta de paquetes activa o por aceptar sale como tarjeta en el inicio del Driver; con la ruta en curso no dice «Buscando pedidos».
- **Fuera del área:** en EE. UU. en pies o millas (`textoDistanciaCorta`).
- **Prueba:** `packages/compartido/src/flexMiRutaRepaso.test.ts` y `distancia.test.ts` (comprobadas en rojo).

## C-FLEX-OSCURO, C-FLEX-LISTA-UNIDA y C-FLEX-PANTALLA-COMPLETA (31 oct 2026, Richard con las capturas de Amazon Flex) — todos los países

- **Qué es:** «Mi ruta» va en fondo oscuro azul petróleo (no cansa la vista en horas de reparto), con texto blanco por defecto (`Texto` en `flex/piezas.tsx`, toda la paleta vive ahí) y botones secundarios con borde azul claro (`Boton oscuro`). Dentro de la ruta no va la cabecera del logo: la franja de Divoox Flex lleva la flecha para salir y «Ayuda de emergencia». La lista de paradas va unida por una línea que se pone verde a medida que se entrega, con el chulito verde, la hora y la siguiente parada resaltada.
- **No tocar:** no volver a `lienzo(...)` para `miRuta`, ni usar `C.secundario` (negro) como color de texto en Flex: sobre el fondo oscuro no se ve.
- **Prueba:** `flexMiRutaRepaso.test.ts` (comprobada en rojo). Captura original: `docs/capturas/flex-lista-unida-es.png`.

## C-FLEX-ESCANEO-PARADA y C-FLEX-PARADA-ACTUAL (31 oct 2026, como Amazon Flex) — todos los países

- **Escaneo en la parada:** «X de Y paquetes escaneados»; no se puede deslizar para entregar sin escanear (o escribir) cada paquete de la parada; uno de otra parada se rechaza con «Ese paquete no es de esta parada». Lógica en `paqueteDeEscaneo` / `faltanPorEscanear` (`packages/compartido/src/flex.ts`). El escaneo vive en el celular (no se manda al servidor): el servidor sigue validando paquetes y parada al entregar.
- **Parada actual:** botón fijo abajo en la ruta en curso, fuera de lo que se desplaza (`ponerPie` → `pieFlex` en `Inicio.tsx`).
- **Prueba:** `flexEscaneoParada.test.ts` y `flexMiRutaRepaso.test.ts` (comprobadas en rojo). Captura: `docs/capturas/flex-escaneo-parada-es.png`.

## C-CUENTA-EN-LA-APP (31 oct 2026, Richard grabando el video para Apple) — todos los países

- **Qué pasó:** en Driver no se encontraba «Cerrar sesión» ni «Borrar la cuenta» (estaban escondidos en Soporte y mandaban a la web); en la app del restaurante borrar la cuenta mandaba a la web. Apple (5.1.1 v) pide borrar desde la app.
- **Arreglo:** pieza única `OpcionesCuenta` (`packages/movil`): tarjeta «Tu cuenta» con «Cerrar sesión» y, en los tres puntos, «Borrar la cuenta» con la palabra escrita (BORRAR / DELETE) y `DELETE /datos/cuentas/yo`, sin salir de la app. Va al final del Perfil del Driver y de «Más» del restaurante.
- **Prueba:** `packages/compartido/src/cuentaEnLaApp.test.ts` (comprobada en rojo).

## C-MAS-EN-LA-APP (31 oct 2026, Richard grabando el video para Apple) — todos los países

- **Qué es:** en la app del restaurante, Más → «Datos del restaurante», «Ganancias», «Equipo» y «Configuración» se abren DENTRO de la app (`apps/restaurante/src/MasPantallas.tsx`), como DoorDash Merchant; antes mandaban a la web. Solo el alta de cobros en Stripe se abre afuera (es de Stripe). Formularios con borrador; contraseñas nunca en el borrador; quitar a un miembro va en los tres puntos.
- **Prueba:** `packages/compartido/src/cuentaEnLaApp.test.ts` (comprobada en rojo).

## C-LIKE-CORTO, C-ENVIO-SIN-SILENCIO, C-TECLADO-NO-TAPA, C-BLOQUE-EN-LA-APP, C-MOSAICO-UNA-LINEA y C-LETRA-NO-BLACK (31 oct 2026, Richard en TestFlight) — todos los países

- **C-LIKE-CORTO:** cancelar cualquier viaje o envío fallaba con «LIKE or GLOB pattern too complex»: D1 no acepta patrones LIKE de más de 50 caracteres y el de las reservas medía 60. Se compara comienzo y final de la referencia. Prueba `apps/servidor/src/likeCorto.test.ts`.
- **C-ENVIO-SIN-SILENCIO:** «Enviar» no hacía nada: la casilla de prohibidos (que parecía un botón) no estaba marcada y el aviso salía arriba, fuera de la vista. Ahora es una casilla de verdad y el aviso sale junto al botón.
- **C-TECLADO-NO-TAPA:** las pantallas con formularios suben la casilla activa sobre el teclado y lo esconden al deslizar.
- **C-BLOQUE-EN-LA-APP:** «Bloque de logística» abre `/business` dentro de la app (qué es Divoox Flex, cuatro pasos y el registro en la misma app).
- **C-MOSAICO-UNA-LINEA / C-LETRA-NO-BLACK:** con la letra grande del iPhone, «Deliverie-s» se partía; el nombre va en una línea y se achica. La app del cliente deja la letra «Black» (900) y «Heavy» (800): máximo «Bold» (700), como Uber Eats y DoorDash.
- **Prueba:** `packages/compartido/src/clienteEnviosTestflight.test.ts` (comprobada en rojo).

## C-EMPRESA-LEGAL y C-PASE-WEB (31 oct 2026, LG1, pedido de Richard) — todos los países

- **Qué es:** la empresa de logística se registra DENTRO de la app del cliente (`apps/cliente/src/app/business.tsx`) con nombre, razón social, país, moneda, número fiscal validado por país (EIN, RIF, NIT, RFC: `numeroFiscalValido` en `flexPaises.ts`), dirección fiscal, representante, teléfono y su centro de carga con el punto exacto. Columnas nuevas de `empresas` en COLUMNAS (`numero_fiscal`, `direccion_fiscal`, `representante`, `telefono`). Borrador del formulario; lo escrito no se pierde si falla.
- **Panel dentro de la app:** `POST /datos/cuentas/pase-web` da un código de un solo uso (2 minutos; se guarda solo su hash en `pases_web`); `GET /datos/cuentas/pase-web/:codigo?ir=/panel/business` abre la sesión en la vista web y redirige; nunca a otro sitio.
- **Prueba:** `apps/servidor/src/flex/empresaLegal.test.ts` y `packages/compartido/src/empresaLegal.test.ts` (comprobadas en rojo).

## C-FLEX-ENCUENTRO (31 oct 2026, LG2, pedido de Richard) — todos los países

- **Qué es:** además de «a domicilio» y «retiro en el centro», un envío puede entregarse en un **punto de encuentro de la vía** («Estación Doña María»), como los transportistas que entregan sobre la Panamericana. Se crea con `entrega: 'encuentro'`, `puntoEncuentro` (nombre) y el punto en el mapa (`lat`/`lng`, obligatorios). Columna `envios.punto_encuentro` en COLUMNAS. El panel lo ofrece al crear el envío; Driver lo muestra en la lista y en la parada.
- **Prueba:** `apps/servidor/src/flex/encuentro.test.ts` (comprobada en rojo) y `flexMiRutaRepaso.test.ts`.

## C-FLEX-RASTREAR (31 oct 2026, LG3, pedido de Richard) — todos los países

- **Qué es:** en la app del cliente, «Mis paquetes» → «Rastrear un paquete» (también desde Envíos → «Espero un paquete»): se escribe o se escanea el número de seguimiento (DVX…). `POST /datos/v1/flex/mis-paquetes/seguir`: si el envío es para esa persona (su correo o los últimos 7 dígitos de su teléfono coinciden), queda vinculado a su cuenta y aparece completo con su ubicación; si no, lo sigue solo con el estado público (tabla `paquetes_seguidos`, sin dirección ni nombres). Los avisos push de cada paso llegan también a quien lo sigue (`avisarDestinatarios`).
- **Seguridad:** con solo el número nadie ve la dirección ni el nombre de otra persona.
- **Prueba:** `apps/servidor/src/flex/rastrear.test.ts` (comprobada en rojo) y `clienteEnviosTestflight.test.ts`.

## C-FLEX-YA-LLEGA (31 oct 2026, LG4, pedido de Richard) — todos los países

- **Qué es:** con la ruta en curso, cada vez que Driver manda su ubicación (cada 30 s), si está a menos de 800 m de la próxima parada (1,5 km si es un punto de encuentro de la vía), quien recibe (y quien sigue el número) recibe UNA vez el aviso «Tu paquete ya llega»: el nombre del conductor, la marca, el modelo, el color y la placa del vehículo, y el punto de encuentro si lo hay. `avisarYaLlega` en `flex/avisosFlex.ts`; clave única en `flex_avisos`.
- **Falta:** la llamada automática por teléfono, que necesita las claves de Twilio de Richard (LG5).
- **Prueba:** `apps/servidor/src/flex/yaLlega.test.ts` (comprobada en rojo).

## C-FLEX-INVITAR y llamada «ya llega» (31 oct 2026, LG5) — todos los países

- **Invitación:** al crear un envío (uno o en lote), si quien recibe no tiene cuenta, se le manda UNA vez un SMS (Twilio) y un correo (si lo dieron) con el número de seguimiento y el enlace `/track/<código>` (en inglés si la empresa es de EE. UU., en español si no). `invitarDestinatarios` en `flex/avisosFlex.ts`; clave `d:invitacion:<envío>` en `flex_avisos`.
- **Llamada:** el aviso «ya llega» también llama con voz al teléfono de quien recibe, una vez por envío (`llamarConVoz` en `sms.ts`).
- **Se encienden solos** cuando el sitio tenga `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_FROM`. Sin ellas no hace nada ni falla.
- **Costo:** un SMS a Venezuela cuesta unos 0,23 USD; se manda uno solo por envío y solo a quien no tiene la app.
- **Prueba:** `apps/servidor/src/flex/invitar.test.ts` (comprobada en rojo).

## C-TWILIO-LLAVE (1 nov 2026) — todos los países

- Twilio acepta la llave de API (`TWILIO_API_KEY` SK… + `TWILIO_API_SECRET`) en vez del Auth Token para mandar SMS y llamar (`credencialTwilio` en `sms.ts`). Las claves de la cuenta «Numeros de BOT» están en `~/.config/tumbite/twilio`; el número es el +1 231 800 8096.
- **Costos medidos el 1 nov 2026:** SMS a Venezuela (Movilnet) 0,2257 USD, entregado. Llamadas a Venezuela: bloqueadas hasta encender el permiso de país en la consola de Twilio.

## C-SMS-LEGAL — la privacidad explica los mensajes de texto (31 oct 2026, EE. UU.)

- **Por qué:** Twilio exige, para verificar el número gratuito (sin eso los SMS a EE. UU. fallan con el error 30034), que la política de privacidad diga cómo se aceptan los mensajes, STOP/HELP, tarifas y que el número no se comparte para publicidad. Rechazan si falta.
- **Qué hay:** sección 12 «Mensajes de texto (SMS)» con `id: 'sms'` en `PRIVACIDAD` (es y en) de `apps/panel/src/sitio/legales.ts`. Ancla pública: divoox.com/privacy#sms.
- **Prueba:** `legales.test.tsx` → «mensajes de texto (verificación de Twilio y CTIA)». Comprobada en rojo.
- **No tocar:** las cuatro piezas (opt-in, STOP, HELP, tarifas, no compartir) mientras haya un número verificado.

## C-SMS-CONSENTIMIENTO — la casilla de SMS, aparte y sin marcar (9 nov 2026, todos los países)

- **Qué se rompió:** Twilio rechazó la verificación del número gratuito con el error 30513: no había prueba del consentimiento para SMS. La política decía «los aceptas al darnos tu número», y eso no vale: CTIA y Twilio piden una casilla PROPIA, separada de los términos, sin marcar, que diga «text messages», qué mensajes, frecuencia, tarifas, STOP/HELP y que no es condición de compra, y la prueba como una imagen pública.
- **Qué hay:**
  - Texto y versión en una sola pieza: `packages/compartido/src/smsConsentimiento.ts` (`VERSION_CONSENTIMIENTO_SMS = 'sms-2026-11-09'`, `TEXTO_CONSENTIMIENTO_SMS` en inglés y español). Si cambia el texto, cambia la versión.
  - Casilla única por plataforma: web `apps/panel/src/panel/CasillaSms.tsx` (registro de restaurantes y empresas en `Acceso.tsx`, y «Configuración» en `Configuracion.tsx`); apps `packages/movil/src/CasillaSms.tsx` (registro de cliente y repartidor en `Acceso.tsx`; `PreferenciaSms` en `OpcionesCuenta` —Driver y restaurante— y en «Mi cuenta» del cliente). Va en el borrador del formulario (`sms`).
  - Servidor: `esquemaRegistro.smsConsentimiento` (zod, por defecto `false`) y `canal` web/app; `PUT /datos/cuentas/sms {acepta, canal}`; `GET /datos/cuentas/perfil` devuelve `smsConsentimiento`. Columnas `usuarios.sms_consentido_en`, `sms_consentimiento_version`, `sms_consentimiento_canal` en COLUMNAS de `esquema.ts` (no en schema.sql).
  - `enviarSms` (`apps/servidor/src/sms.ts`) NO manda nada al titular sin `sms_consentido_en`. Excepciones escritas en `smsSinConsentimientoDelTitular`: el código que la persona pide en ese momento (`codigo_telefono`), los mensajes únicos a terceros que el titular comparte a propósito (regalo, paquete, viaje compartido, invitaciones de Flex) y los avisos internos del equipo (`equipo_…`).
  - STOP/HELP/START: no hay webhook de entrada propio; en el número gratuito los maneja Twilio por defecto y bloquea el envío a quien respondió STOP. Desmarcar la casilla en la cuenta también da de baja.
  - Página pública `/sms-consent` (y `/es/sms-consent`), en el mapa del sitio y en el pie, con la captura REAL del registro de la app del cliente: `https://divoox.com/sms-consent/opt-in.png` (la que se le da a Twilio) y `.webp`. Originales en `docs/capturas/sms-consentimiento-{en,es}.png`. Sección «Text messages (SMS)» con `id: 'sms'` en Privacidad (12) y Términos (11). Guía de Docs `account/text-messages`.
- **Cómo se rehace la captura:** `URL_API=http://localhost:8799 npm run build:app-web`, servir `apps/cliente/dist-web` bajo `/app` y abrir `/app/sign-in?crear=1` a 430×932 con escala 2.
- **Pruebas:** `apps/servidor/src/smsConsentimiento.test.ts` (sin marcar no guarda nada; marcada guarda fecha+versión+canal; sin consentimiento no sale SMS; el código pedido sí), comprobada en ROJO quitando el freno de `enviarSms` y el guardado del registro (2 fallan). `apps/panel/src/panel/Acceso.test.tsx` (casilla aparte y sin marcar), `apps/panel/src/sitio/ConsentimientoSms.test.tsx` (la página existe en los dos idiomas con la imagen y el texto exacto), `legales.test.tsx` (Privacidad y Términos).
- **No tocar:** que la casilla arranque sin marcar, que vaya aparte de la de términos y que no sea obligatoria. No quitar el freno de `enviarSms`. No mover la imagen `/sms-consent/opt-in.png`: su dirección está en la verificación de Twilio.

## C-SMS-PAISES — los SMS y las llamadas automáticas solo salen a los países encendidos (31 oct 2026, EE. UU.)

- **Por qué:** medido el 31 oct, un SMS a Venezuela cuesta 0,2257 dólares; a EE. UU., 0,0083. Richard decidió dejar Twilio para EE. UU. y buscar otro proveedor para Venezuela.
- **Qué hay:** `destinoPermitido(env, para)` en `apps/servidor/src/sms.ts`, usado por `enviarSms` y `llamarConVoz`. Sin la variable `SMS_PREFIJOS` solo sale a «+1». Para ampliar: `SMS_PREFIJOS=+1,+57`.
- **Prueba:** `apps/servidor/src/smsPaises.test.ts`, comprobada en rojo.
- **Twilio de Divoox:** subcuenta «Divoox» (la principal tiene un perfil personal viejo y Twilio no deja verificar desde ella). Número gratuito +1 866 569 5258, verificación de número gratuito HHad9f853f48db6e35442954fb9f1620d4 enviada el 31 oct con los datos de Windoce LLC. Claves en `~/.config/tumbite/twilio-divoox`. Hasta que Twilio apruebe, los SMS a EE. UU. no salen (error 30032/30034).

## C-ALCOHOL-HORARIO — el alcohol solo se pide en la hora legal del estado (1 nov 2026, EE. UU. y todos los países)

- **Por qué:** estándar de DoorDash y Uber Eats; brecha que quedó en la ficha de tiendas (`docs/investigaciones-rea/2026-10-29-tiendas-reemplazos.md`, punto 3).
- **Qué hay:** tabla única por estado en `packages/compartido/src/horarioAlcohol.ts` (`alcoholPermitido`): Florida 7:00–0:00, Michigan 7:00–2:00 y domingo desde 12:00; lo no cargado, 8:00–22:00. El servidor rechaza el pedido con alcohol fuera de hora (`pedidos.ts`, a la hora de entrega si es programado) y la ficha de la tienda trae `alcohol: {ok, abre}` (`tiendas.ts`, `alcoholAhora`). La app marca el producto «Alcohol disponible desde las…» y apaga el botón.
- **Recorrido local:** `ALCOHOL_SIN_HORARIO=1` (solo con entorno local; en los sitios no hace nada) para que el recorrido corra a cualquier hora.
- **Pruebas:** `horarioAlcohol.test.ts` (tabla y pantalla) y `tiendasVitrina.test.ts` → «C-ALCOHOL-HORARIO». Comprobadas en rojo.
- **No tocar:** la tabla solo se amplía con la ley citada de cada estado o país.

## C-TELEFONO-VUELTA — el repartidor confirma su teléfono por SMS al volver (1 nov 2026, D8, todos los países donde sale el SMS)

- **Por qué:** como DoorDash al volver a la app; evita que otra persona use la cuenta con otro número.
- **Qué hay:** `apps/servidor/src/telefonoVuelta.ts` (14 días sin conectarse y sin confirmación reciente → código de 6 números, solo el hash, 10 minutos, 5 intentos, 1 por minuto y 5 por día). `/repartidor/conectar` responde 409 con campo `telefono`; `/repartidor/estado` trae `telefonoPorVerificar` (últimos 4); rutas `/repartidor/telefono/codigo` y `/verificar`. Tabla `codigos_telefono` y columna `usuarios.telefono_verificado_en`. App Driver: `ConfirmarTelefono.tsx`.
- **No traba a nadie:** sin Twilio o fuera de los países encendidos (`SMS_PREFIJOS`, C-SMS-PAISES) no se exige. Al revisor de las tiendas no se le pide.
- **Pruebas:** `telefonoVuelta.test.ts` (servidor, comprobada en rojo) y `telefonoVueltaApp.test.ts` (pantalla).

## C-SMS-EQUIPO — lo urgente también llega al equipo por SMS (1 nov 2026, EE. UU.)

- **Qué hay:** `smsEquipo(env, tipo, texto)` en `apps/servidor/src/avisosEquipo.ts`: manda SMS a los administradores activos con teléfono que reciben ese tipo de aviso (`correosEquipo`). Se usa en el botón de emergencia del repartidor (`seguridadRepartidor.ts`) y cuando una pieza del canario pasa a rojo (`canario.ts`; la recuperación va solo por correo).
- **Respeta** los países encendidos (C-SMS-PAISES) y nunca frena: si el SMS no sale, el correo ya salió.
- **Prueba:** `apps/servidor/src/smsEquipo.test.ts`, comprobada en rojo.

## C-PAGO-PICO — pago por hora pico en las zonas con mucha demanda (1 nov 2026, D7, todos los países)

- **Por qué:** estándar de DoorDash («Peak Pay») y Uber («Boost»). Arranca APAGADO: monto y presupuesto diario en cero hasta que el equipo los fije en Superadmin → Rewards → «Pago por hora pico».
- **Qué hay:** `apps/servidor/src/pagoPico.ts` (celda de geohash 6 con 5 pedidos o más en la última hora = demanda alta, la misma que el mapa; presupuesto diario contra la suma de `bonos_pedido` con motivo `hora_pico` de hoy). En el despacho (`operacion.ts`), la primera oferta de un pedido en esa celda guarda el bono `hora_pico`; si después pasa a oferta abierta, ese bono se suma (UPSERT) y el motivo pasa a `oferta_abierta`. Se paga al entregar por el mismo camino del bono de siempre (no toca el cobro). El mapa (`/repartidor/demanda`) trae `pico` en las zonas altas y `moneda`; la oferta trae `bonoMotivo`. Rutas `/admin/pago-pico` (GET/PUT). Panel: `SuperPagoPico.tsx`. App Driver: burbuja «+$2.00 por pedido» sobre la zona y «Incluye pago por hora pico» en la oferta.
- **Pruebas:** `operacion.test.ts` → «C-PAGO-PICO» (con la oferta abierta de siempre en verde) y `SuperPagoPico.test.tsx`.

## C-UNIDAD-ELEGIDA — el repartidor elige millas o kilómetros (1 nov 2026, pedido de Richard, todos los países)

- **Qué hay:** `elegirUnidadDistancia` en `packages/compartido/src/distancia.ts` (lo elegido manda sobre el país en `textoDistancia` y `textoDistanciaCorta`). App Driver: `piezas/UnidadDistancia.tsx` («Distancias en: Millas | Kilómetros» en el perfil), guardado en el celular y cargado al abrir (`useUnidadDistancia` en `Inicio.tsx`). Sin elección, manda el país (C-DISTANCIA-POR-PAIS). `/repartidor/estado` trae `zonaId`.
- **Prueba:** `distancia.test.ts` → «C-UNIDAD-ELEGIDA», comprobada en rojo.

## C-FLEX-CUENTA-EMPRESA y C-FLEX-REGISTRO-UNICO — la empresa de logística entra y se registra bien (1 nov 2026, todos los países)

- **Qué se rompía:** quien llegaba a /panel/business sin cuenta creaba una cuenta de RESTAURANTE («Crear cuenta de restaurante»). La web pedía 4 datos y la app pedía los datos legales y el centro: dos registros distintos.
- **Qué hay:** `Acceso` recibe `tipo="empresa"` en /panel/business (rol cliente, textos «Divoox Flex», sin términos de restaurantes). Una sola pieza `packages/compartido/src/registroEmpresaFlex.ts` (`PAISES_FLEX`, `faltaEnRegistro`, `cuerposRegistro`) que usan la web (`PanelEmpresa.tsx`) y la app (`apps/cliente/src/app/business.tsx`): nombre, razón social, país, moneda, número fiscal del país, dirección fiscal, representante, teléfono y primer centro con punto exacto. El Perfil del panel edita los datos legales (con borrador).
- **Pruebas:** `Acceso.test.tsx`, `registroEmpresaFlex.test.ts`, `PanelEmpresa.test.tsx` («crea una nueva…»). Comprobadas en rojo.

## C-FLEX-PRIMEROS-PASOS — el inicio del panel guía a la empresa nueva (1 nov 2026, todos los países)

- **Qué hay:** `apps/panel/src/panel/flex/primerosPasos.ts` (siete pasos: empresa, centro, conductor, primer envío, etiquetas, ruta asignada, primera entrega) que se marcan solos con el resumen del servidor (`GET /empresas/:id` trae `rutas` y `rutasAsignadas`). Las etiquetas se marcan al imprimir (guardado en el navegador). Barra de avance en verde y un botón «Hacer este paso» en lo que falta.
- **Pruebas:** `apps/servidor/src/flex/primerosPasos.test.ts` y `PanelEmpresa.test.tsx` → «C-FLEX-PRIMEROS-PASOS», comprobadas en rojo.

## C-FLEX-MENU-GRUPOS y C-FLEX-RUTAS-UNA — el panel de la empresa ordenado (1 nov 2026, todos los países)

- **Qué confundía:** 18 entradas sueltas en el menú; la ruta se creaba en «Lotes y rutas» y se asignaba en «Rutas en curso», sin enlace entre las dos; no se elegía el centro de la ruta.
- **Qué hay:** menú en tres grupos (Día a día: Inicio, Envíos, Rutas, Etiquetas, Devoluciones, Incidencias; Configuración: Centros, Conductores, Vehículos, Equipo, Perfil; Más: Paquetes, Importar, Reportes, Integraciones, Billetera, API). «Rutas» trae el botón «Nueva ruta»; al crearla (con su centro) se abre su página para asignarla u ofrecerla. La lista de rutas enlaza a cada detalle.
- **Prueba:** `PanelEmpresa.test.tsx` → «C-FLEX-MENU-GRUPOS».

## C-FLEX-INVITAR-CONDUCTOR — la empresa invita a su conductor como en Onfleet y Spoke (1 nov 2026, todos los países)

- **Qué fallaba:** para sumar un conductor había que saber el correo de una cuenta de Driver que ya existiera; si no, «créala primero». Y quedaba vinculado sin enterarse ni aceptar.
- **Qué hay:** tabla `invitaciones_conductor` (solo el hash del enlace, vence a los 14 días). `POST /empresas/:id/conductores/invitaciones` (nombre + celular o correo + vínculo) manda SMS (países encendidos), correo y aviso al celular si ya usa Driver, y devuelve el enlace `/driver/join/<token>` para mandarlo por WhatsApp. `GET /empresas/:id/conductores` trae las pendientes; cancelar con `DELETE …/invitaciones/:id` (en el menú de tres puntos). Página pública `InvitacionConductor.tsx` (quién invita, tres pasos, tiendas). En Driver, `flex/InvitacionesEmpresa.tsx` lista las invitaciones de su celular o correo (`GET /conductor/invitaciones`) y las acepta o rechaza; al aceptar nace la fila en `empresa_conductores`. El vínculo directo por correo sigue en «¿Ya trabaja con Divoox Driver…?».
- **Pruebas:** `apps/servidor/src/flex/invitarConductor.test.ts` (comprobada en rojo), `PanelEmpresa.test.tsx`, `InvitacionConductor.test.tsx`, `flexInvitarApp.test.ts`.

## C-FLEX-VEHICULO-DRIVER — el vehículo del conductor sale de lo que registró en Driver (1 nov 2026, todos los países)

- **Qué fallaba:** «Vehículos», la capacidad al asignar y la placa del aviso «ya llega» leían la tabla `vehiculos`, que ninguna app llenaba (Driver guarda en `repartidor_datos`).
- **Qué hay:** `apps/servidor/src/flex/vehiculoDriver.ts` (`asegurarVehiculoDesdeDriver`): crea una sola vez su vehículo (origen «migracion») y lo deja activo. Se llama al aceptar la invitación, al vincular por correo y antes del aviso «ya llega».
- **Prueba:** `invitarConductor.test.ts` → «C-FLEX-VEHICULO-DRIVER», comprobada en rojo.

## C-FLEX-ASIGNAR-A-LA-VISTA — en la página de la ruta, «Asignar» se ve de entrada (1 nov 2026, todos los países)

- **Qué confundía (visto en las capturas reales de producción):** la lista de conductores empezaba vacía y los botones «Asignar» u «Ofrecer» solo aparecían al elegir uno: parecía que no había cómo asignar la ruta.
- **Qué hay:** el primer conductor queda elegido (valor derivado `conductorId`, sin efecto), título «Asignar la ruta», bloque desde y hasta marcados «(opcional)». Cancelar y retirar siguen en los tres puntos.
- **Prueba:** `PantallasRutas.test.tsx` → «asigna la ruta a un conductor propio…» sin tocar la lista, comprobada en rojo.

## C-FLEX-VEHICULO-DRIVER (ampliado) — aceptar nunca falla con el conductor en operación

- **Qué falló en producción el 1 nov:** aceptar la invitación dio 500 porque el conductor de la demostración tenía una ruta en curso y el disparador `repartidores_vehiculo_fijo_en_operacion` no deja cambiar el vehículo activo.
- **Arreglo:** el vehículo se crea igual, y queda como activo solo si no tenía uno y no está en operación; todo dentro de `asegurarVehiculoSinFrenar` (nunca frena aceptar, vincular ni avisar). El aviso «ya llega» usa el activo o, si falta, el último registrado.
- **Prueba:** `invitarConductor.test.ts` → «aceptar nunca falla aunque el conductor esté en plena operación», comprobada en rojo.
- **Ampliado el 1 nov:** también se acepta con el enlace (`POST /conductor/invitacion-enlace/:token/aceptar`), porque en Divoox una cuenta tiene un solo papel: quien ya usa su celular o su correo como cliente crea su cuenta de Driver con otros y pega el enlace en el inicio de Driver («¿Una empresa te invitó? Pega su enlace»). El enlace sirve una sola vez. Prueba en `invitarConductor.test.ts`, comprobada en rojo.

## C-CHAT-SIN-DOBLES — un mensaje del chat nunca se ve dos veces (1 nov 2026, todos los países)

- **Qué se vio:** en el recorrido del sitio de pruebas (red lenta), el mensaje del cliente salió dos veces en su chat: la consulta de cada 4 s y la de después de enviar se cruzaban y las dos traían el mismo mensaje.
- **Qué hay:** `unirMensajes` en `packages/compartido/src/chatMensajes.ts` (une por número de mensaje, sin repetir, en orden) y `ChatPedido.tsx` la usa; el «desde» guarda el número mayor visto.
- **Prueba:** `chatMensajes.test.ts`, comprobada en rojo.

## C-SOPORTE-UN-BUZON — el correo de soporte de cada app (1 nov 2026, orden de Richard, todos los países)

- **Qué hay:** `packages/compartido/src/correosSoporte.ts` (`CORREOS_SOPORTE`: divoox, driver, restaurantes, con etiqueta en el buzón de Windoce). La web (`CONTACTO`, pie, legales, Docs, datos estructurados), `/datos/publico` (`correoSoporte`) y los «responder a» de los correos del servidor (clientes y lista de espera: divoox; restaurantes: restaurantes; cuentas de cobro del repartidor: driver) salen de ahí. La dirección vieja go@windoce.com sigue recibiendo.
- **Pruebas:** `webHonesta.test.tsx` y `legales.test.tsx`.

## C-GERENTE-TICKETS y C-AYUDA-EN-LA-APP — el gerente de correo contesta los casos y las apps los muestran (1 nov 2026, pedido de Richard, todos los países)

- **La puerta del gerente** (`apps/servidor/src/rutas/gerente.ts`): `GET /datos/gerente/tickets?estado=abiertos` (casos de soporte y quejas, con app «divoox», «divoox.driver» o «divoox.restaurantes» según el papel de la cuenta, nombre, idioma, asunto y chat; sin correo, pagos ni direcciones) y `POST /datos/gerente/tickets/:id/responder` ({texto, plantilla P1–P9, cerrar}): guarda el mensaje como Soporte, avisa al celular y manda el correo «Te respondimos tu caso N»; devuelve {aviso: ok | error | sin_app, correo: ok | error}; un fallo queda en `errores_servidor` (canario «errores»). Protegida con `Authorization: Bearer` contra la variable del panel `GERENTE_SECRETO` (comparación en tiempo constante sobre los hashes, 30 intentos por minuto); sin la variable, 401 para todos.
- **En las apps:** `packages/movil/src/MisCasos.tsx` («Mis casos de ayuda» con el chat dentro, borrador incluido) en la cuenta del cliente, en Soporte del conductor y en Configuración del restaurante (que suma «Reportar un problema»). Lista con `GET /datos/mis-tickets`; el número del caso sale de su id (`numeroDeTicket`), nunca del código secreto del enlace.
- **Pruebas:** `apps/servidor/src/rutas/gerente.test.ts` (401 sin secreto, responder con aviso y correo, el correo que falla se ve, mis casos) y `ayudaEnLaApp.test.ts`.
- **1 nov 2026:** la plantilla acepta de P1 a P99 (`/^P\d{1,2}$/`), pedido del gerente de correo para P10 («cómo va la app / cuándo sale»). Prueba en `gerente.test.ts`, comprobada en rojo.

## C-CASOS-CAPTURAS — capturas de pantalla en «Mis casos de ayuda» (1 nov 2026, pedido de Richard, todos los países)

- **Qué hay:** tabla `ticket_adjuntos` (nacen sueltas y se atan al mensaje). `POST /datos/tickets/:codigo/adjuntos?nombre=` (JPG, PNG, WebP o HEIC por sus primeros bytes, hasta 10 MB) y el mensaje acepta `adjuntos` (hasta 3, solo sueltas del mismo caso). Se ven solo con `GET /datos/adjuntos/:id?exp&firma` (HMAC con la variable del panel `ARCHIVOS_FIRMA`, 8 días, tiempo constante; sin firma o vencida, 403). Los mensajes del caso (persona y gerente) traen sus adjuntos con el enlace firmado. Piezas: `apps/servidor/src/adjuntosTicket.ts`, `packages/movil/src/MisCasos.tsx` (botón «Adjuntar captura», miniaturas con «Quitar», el texto no se borra si la subida falla), `packages/movil/src/elegirCapturas.ts` (galería de cada app), la página web del caso muestra las capturas. Guía de Docs «send-screenshot-to-support».
- **Llave:** `~/.config/tumbite/archivos-firma`, cargada en los dos sitios. Si se cambia, los enlaces viejos dejan de abrir (se generan nuevos al pedir la lista).
- **Pruebas:** `apps/servidor/src/rutas/adjuntos.test.ts` (comprobada en rojo) y `ayudaEnLaApp.test.ts`.

## C-GANAR-POR-TIEMPO — el repartidor elige cobrar por oferta o por tiempo (R-T1, 1 nov 2026, todos los países)

- **Por qué:** «Earn by Time» de DoorDash (REA ev_a50085e6…, página pública de pago de Dasher): mínimo garantizado por hora activa, desde que acepta hasta que entrega; propinas y promociones aparte.
- **Qué hay:** `apps/servidor/src/ganarPorTiempo.ts` (config `ganar_por_tiempo` {centavosHora, centavosMilla}; APAGADO en cero). Columna `repartidores.modo_pago`; `PUT /repartidor/modo-pago` (409 si está apagado); `GET /repartidor/estado` trae `ganarPorTiempo`. Al aceptar se anota `pagos_por_tiempo` con la tarifa vigente; al entregar, lo que falte para el garantizado se suma al bono del pedido (`bonos_pedido`, motivo `por_tiempo`), el mismo camino que la liquidación y la conciliación ya cuentan. Superadmin → Rewards → «Ganar por tiempo». Driver: `piezas/ModoPago.tsx`, solo encendido y sin cambiar conectado. Docs «earn-by-time».
- **Pruebas:** `operacion.test.ts` → «C-GANAR-POR-TIEMPO» (comprobada en rojo), `SuperGanarPorTiempo.test.tsx`, `ganarPorTiempoApp.test.ts`.

## C-ANUNCIOS — anuncios patrocinados que se pagan por pedido (R-T2, 1 nov 2026, todos los países)

- **Por qué:** «Sponsored Listings» de DoorDash (REA ev_a6fcb13f…, página pública para comercios): sale arriba en el inicio y en la búsqueda, se paga solo por los pedidos que llegan desde el anuncio (no por clics ni vistas), con presupuesto.
- **Qué hay:** `apps/servidor/src/anuncios.ts` (config `anuncios` {centavosPorPedido, maxEnLista}; APAGADO con precio en cero). Tablas `campanas_anuncio`, `anuncios_dia` y `pedidos_anuncio`. `GET /datos/restaurantes` pone hasta `maxEnLista` patrocinados abiertos primero con `patrocinado: true` y `anuncioId` y anota la vista. `POST /datos/anuncios/:id/toque` (estadística). `POST /pedidos` acepta `anuncioId` y lo anota solo si la campaña está vigente y es de ese restaurante. Al entregar (repartidor y recogida en el local) el lote suma un movimiento `ajuste` NEGATIVO al dueño con referencia `anuncio:<campaña>`: nunca toca `venta`, así la conciliación (reglas 1 a 3) queda igual. El presupuesto mira lo gastado en los últimos siete días. Panel del restaurante «Anuncios» (`/panel/ads`); superadmin → Rewards → «Anuncios patrocinados». App del cliente: etiqueta «Patrocinado» y `comida/anuncioTocado.ts` (el anuncio tocado viaja en el pedido). Docs «sponsored-listings».
- **No tocar:** el cobro va en el MISMO lote de la entrega (si la entrega falla, no se cobra). No usar el concepto `venta` para el anuncio.
- **Pruebas:** `operacion.test.ts` → «C-ANUNCIOS» (comprobada en rojo quitando el cobro de la entrega), `Anuncios.test.tsx`, `SuperAnuncios.test.tsx`, `packages/compartido/src/anunciosApp.test.ts`.

## C-PLUS — Divoox Plus, suscripción tipo DashPass (R-T3, 1 nov 2026, solo EE. UU.)

- **Por qué:** DashPass de DoorDash (REA ev_2ea6a124…, ayuda pública): envío en cero y servicio reducido en pedidos que llegan al mínimo; plan mensual que se renueva solo; cancelar mantiene el beneficio hasta el fin del periodo.
- **Qué hay:** `apps/servidor/src/plus.ts` (config `plus` {centavosMes, minimoSubtotal, servicioDescuentoPct}; APAGADO en cero). El servidor NO deja encender una cuota con llave real de Stripe (`sk_live_`/`rk_live_`) hasta probar el cobro (VERIFICAR-PAGOS). `POST /plus/suscribirse` crea una suscripción de Stripe con precio en línea sobre el producto «Divoox Plus» (se crea una vez y se guarda en config `plus_producto`), `payment_behavior=default_incomplete` y devuelve el secreto de la factura para la hoja de pago. SOLO el aviso firmado `invoice.paid` la activa (vence_en = fin del periodo de la línea); `customer.subscription.deleted` la termina; `POST /plus/cancelar` = `cancel_at_period_end`. El beneficio es `descuentoPlus` de `packages/compartido/src/plus.ts`, la misma cuenta en la app (`cart.tsx`) y en el servidor (`POST /pedidos`), sumado al descuento como un cupón: el restaurante y el repartidor cobran igual. Solo dólares y nunca en recogida. Tablas `suscripciones_plus` y `pedidos_plus`. App: `app/plus.tsx` y la entrada en Mi cuenta solo si está encendido. Superadmin → Rewards → «Divoox Plus». Docs «divoox-plus». El aviso principal de Stripe necesita los eventos `invoice.paid` y `customer.subscription.deleted` (`EVENTOS_PRINCIPAL`; se agregan con la ruta interna de avisos).
- **Pendiente cerrado (ETP-2, 3 nov 2026):** el recálculo al quitar un plato agotado conserva cupón y Plus desde BRE-5c (C-DESCUENTOS-RECALCULO); lo fija `descuentosRecalculo.test.ts`, «ETP-2 · Divoox Plus y plato agotado…».
- **Pruebas:** `operacion.test.ts` → «C-PLUS» (comprobada en rojo quitando el aviso), `packages/compartido/src/plus.test.ts`, `SuperPlus.test.tsx`.

## C-TARJETAS-REGALO — tarjetas de regalo y saldo de regalo (R-T4, 1 nov 2026, solo EE. UU.)

- **Por qué:** las tarjetas de regalo digitales de DoorDash y Uber Eats: monto elegido, correo y mensaje para quien la recibe, código que se canjea como saldo para pedidos.
- **Qué hay:** `apps/servidor/src/tarjetasRegalo.ts` (config `tarjetas_regalo` {activas, minimo, maximo}; APAGADAS; no se encienden con llave real de Stripe hasta probar el cobro). `POST /tarjetas-regalo` abre un PaymentIntent (metadata `tarjeta_regalo_id`); SOLO el aviso firmado `payment_intent.succeeded` con intento y monto que cuadran la deja `pagada` y manda el código por correo. `POST /tarjetas-regalo/canjear` (con límite de intentos) la pasa a `canjeada` una sola vez. El saldo NO se guarda: es lo canjeado menos lo usado en pedidos no cancelados (`pedidos_saldo_regalo`), así una cancelación por cualquier camino lo devuelve sola. `POST /pedidos` con `usarSaldoRegalo` aplica `saldoAplicable` (`packages/compartido/src/saldoRegalo.ts`: nunca la propina, deja 50 centavos a la tarjeta) como descuento y lo aparta en UNA sentencia condicionada al saldo; si otro pedido lo gastó a la vez, cancela el pedido nuevo y avisa. App: `app/gift-cards.tsx` (con borrador guardado), interruptor en el carrito y entrada en Mi cuenta solo si están encendidas. Superadmin → Rewards → «Tarjetas de regalo». Docs «gift-cards».
- **No tocar:** no guardar el saldo en una columna; la cuenta calculada es la que hace que las cancelaciones lo devuelvan.
- **Pruebas:** `operacion.test.ts` → «C-TARJETAS-REGALO» (comprobada en rojo contando los pedidos cancelados), `packages/compartido/src/saldoRegalo.test.ts`, `SuperTarjetasRegalo.test.tsx`.

## C-BANDEJA-UN-CASO — abrir un caso de dinero filtra dentro de la consulta (1 nov 2026, todos los países)

- **Qué se rompía:** el detalle de un caso de la bandeja de dinero calculaba TODOS los casos de su tipo y después filtraba por uno (`SELECT * FROM (todo) WHERE clave = ?`). Con muchos casos acumulados (el sitio de pruebas suma casos en cada corrida) tardaba más de 20 segundos y el recorrido automático fallaba a ratos en «caso-dinero». Con el tiempo le pasaría igual a producción.
- **Arreglo:** cada fuente de `apps/servidor/src/internacional/bandeja.ts` lleva `idCol` y la marca `{{id}}` en su WHERE; el detalle la cambia por `idCol = ?` y la bandeja por `1 = 1`.
- **Prueba:** `bandejaUnCaso.test.ts` (comprobada en rojo quitando la marca de una fuente) y las pruebas de la bandeja de siempre.

## C-ZONAS-ANTES-DE-CONECTAR — el mapa de zonas se ve antes de conectarse (1 nov 2026, todos los países)

- **Qué se rompía:** la app Driver solo conocía la ubicación estando conectada o en camino, así que desconectada nunca pedía `/datos/repartidor/demanda` y el mapa salía sin zonas. Lo destapó la captura para Docs pedida por Richard.
- **Arreglo:** `apps/repartidor/src/Inicio.tsx` lee la ubicación una vez estando desconectada, solo si el permiso ya está dado (nunca lo vuelve a pedir), como Dasher.
- **Prueba:** `packages/compartido/src/zonasAntesDeConectar.test.ts` (comprobada en rojo).

## C-CASO-EN-SU-IDIOMA — el caso de ayuda toma el idioma en que se usa la app (1 nov 2026, todos los países)

- **Qué se rompía:** el título del caso («Pedido de ayuda», «Reporte de un problema») salía en el idioma guardado en la cuenta, no en el de la app: una persona que usaba la app en español veía «Help request». Lo destapó la captura de Docs.
- **Arreglo:** `POST /datos/quejas` usa la cabecera `x-idioma` de la app y, si no viene, el idioma de la cuenta. El gerente de correo responde en ese idioma.
- **Prueba:** `tickets.test.ts` → «C-CASO-EN-SU-IDIOMA» (comprobada en rojo).

## C-VOLVER-AL-ORIGEN y C-MIS-PEDIDOS-MINIATURA — la flecha vuelve a donde se estaba y «Mis pedidos» con miniatura y colores (1 nov 2026, todos los países)

- **Qué se rompía (visto por Richard en el iPhone):** desde Mi cuenta → un pedido, la flecha de volver mandaba al inicio y sacaba a la persona de Mi cuenta. En «Mis pedidos», el botón «Ver pedido y recibo» salía como un óvalo deformado y «Repetir pedido» partía el texto en dos líneas; todo rojo, blanco y negro.
- **Arreglo:** `app/order/[id].tsx` vuelve con `router.back()` (al inicio solo con un pedido recién hecho o sin historial). `app/orders.tsx`: tarjeta con miniatura del local (`restauranteImagen` en `/datos/mis-pedidos`), fecha y artículos, estado en etiqueta de color (verde entregado, azul en curso, gris cancelado) y botones compactos de una línea: «Ver recibo» y «Pedir otra vez» en verde, o «Seguir mi pedido» si va en curso.
- **Prueba:** `packages/compartido/src/volverAlOrigen.test.ts` (comprobada en rojo).

## Repaso de pantallas del 1 nov (UX-3 y UX-4, primera tanda, todos los países)

- Barra de abajo de la app del cliente: íconos en un solo color, rojo la pestaña elegida y gris las demás (antes «Inicio» quedaba azul siempre).
- Buscador en la web sin el recuadro azul del navegador dentro de la cajita.
- Carrito vacío con mensaje y botón «Buscar comida», como los grandes.
- Títulos fijos de los casos de ayuda traducidos al idioma de la app (`packages/compartido/src/tituloCaso.ts`, prueba `tituloCaso.test.ts`).
- Para repetir el repaso: `node scripts/docs/repaso-pantallas.mjs <carpeta>` (sitio de pruebas, los dos idiomas, avisa palabras del otro idioma).

## C-GPS-ESTUDIOS (2 nov 2026, bloque G, punto G2) — todos los países

- **Qué faltaba:** la llegada confiable a la puerta aceptaba lecturas de hasta 60 m de error dentro de 200 m, y una ubicación simulada (una app que cambia el GPS de Android) contaba como cualquier otra. Los estudios de Richard piden 30 m de precisión, unos 80 m de radio y detectar la ubicación simulada (E1 p.20).
- **Qué se hizo:** en `packages/compartido/src/gps.ts`, `PRECISION_MAXIMA_M = 30`, `RADIO_PUERTA_M = 80` (radio por defecto de `llegadaConfiable`) y el motivo nuevo `simulada` cuando una de las dos lecturas viene marcada. El servidor (`POST /datos/repartidor/ubicacion`, esquema `puntoConPrecision`) acepta `simulada`; si es verdadera no guarda la muestra, no mueve la ficha, anota `gps_simulado` en la bitácora del pedido activo y responde `{ simulada: true }`. La app Driver manda `simulada: p.mocked === true` en las cuatro lecturas (vigilante, lectura cada 5 s, antes de «Llegué» y la tarea en segundo plano) y cambia «Confirmando tu ubicación…» por el aviso de apagar la app que la cambia. Guías de Docs (cliente y repartidor, ES y EN) con 30 m y unos 80 m.
- **Qué sigue igual:** el tope duro de «entregado» y la llegada al restaurante siguen en `RADIO_LLEGADA_M` (200 m); la excepción «No puedo confirmar mi ubicación» que autoriza soporte sigue siendo la salida en edificios.
- **Pruebas:** `gps.test.ts` («GPS como los estudios», 4) y `operacion.test.ts` («G2: una ubicación simulada…»), comprobadas en rojo sin el arreglo.
- **Qué NO tocar:** una lectura simulada nunca cuenta, ni para llegar ni para mover la ficha; si se cambian 30 m u 80 m, se cambian también las guías.

## C-EDAD-REPARTIDOR (2 nov 2026, bloque G, punto G3) — EE. UU.

- **Qué faltaba:** la edad del repartidor era 18 fija en todos lados; DoorDash pide 19 en Florida y Texas y 21 en California, y Uber 19 en moto o carro (estudios de Richard, E2 p.3).
- **Qué se hizo:** `packages/compartido/src/edadRepartidor.ts` (`edadMinimaRepartidor`, `estadoEeuuDeZona`, `edadEnAnios`; manda la mayor regla; fuera de EE. UU., 18). En `apps/servidor/src/rutas/kyc.ts`, al aprobar la verificación de un repartidor (`PATCH /datos/admin/kyc/:id`), si tiene fecha de nacimiento y no alcanza la edad de su zona y su vehículo, responde 409 con el motivo («Esta persona tiene 18 años; para repartir en FL hacen falta 19.»). El motor de verificación recibe `edadMinima` en vez de 18. Interruptor: `config.edad_repartidor_por_estado = '0'` vuelve a la regla de 18.
- **Pruebas:** `edadRepartidor.test.ts` (5) y «G3» en `kyc.test.ts` (3), en rojo sin la comprobación.
- **Qué NO tocar:** la zona manda el estado (`US-FL-…`); sin fecha de nacimiento la revisa el equipo con el documento.

## C-REQUISITOS-VEHICULO (2 nov 2026, bloque G, punto G4) — todos los países

- **Qué faltaba:** los requisitos iban solo por servicio; DoorDash pide licencia y seguro si se reparte en carro (E2 p.3).
- **Qué se hizo:** tabla nueva `servicio_vehiculo_requisitos` (schema.sql) con Comida, Mercado, Farmacia, Licores y Envíos: en carro `licencia` y `seguro_vehiculo`; en moto `licencia_moto` y `seguro_vehiculo`; a pie o en bici nada. `estadoDelConductor` (`rutas/servicios.ts`) suma esos requisitos según el vehículo activo aprobado. Sin vehículo registrado, Comida sigue igual (C-COMIDA-INTACTA).
- **Límite que queda:** Comida todavía no lee el catálogo de habilitaciones para repartir (eso es M6); hasta entonces el requisito se ve y se exige en el catálogo y en los servicios nuevos, no en el reparto de Comida. Punto G4b de la fila.
- **Pruebas:** «G4» en `servicios.test.ts` (3), en rojo sin la tabla.

## C-RESUMEN-1099 (2 nov 2026, bloque G, punto G5) — EE. UU.

- **Qué es:** quién pasa en el año el umbral del formulario 1099-NEC (2.000 dólares, estudios E2 p.11), con la misma cuenta que «Ganancias» y «Tu año» (envío + complemento + propina + bono + propina después de entregar), solo en dólares.
- **Cómo:** `GET /datos/admin/fiscal/1099?anio=` en `rutas/repartidorGrandes.ts` (solo admin; responde `umbral`, `emision: 'apagada'` y la lista); vista `apps/panel/src/panel/Resumen1099.tsx` al final de «Control del dinero» del superadmin.
- **Apagado:** no emite ni envía formularios; eso lo decide el contador (PENDIENTES).
- **Pruebas:** «G5» en `repartidorGrandes.test.ts` (en rojo sin la ruta) y `Resumen1099.test.tsx` (2).

## C-PAPELES-VEHICULO (2 nov 2026, bloque G, punto G4b) — todos los países

- **Qué faltaba:** el Driver escribía licencia y seguro en «Mis datos y vehículo», pero nada los exigía vigentes para repartir en carro o moto (DoorDash los pide, E2 p.3). El catálogo de requisitos (C-REQUISITOS-VEHICULO) no lo lee todavía el reparto de Comida.
- **Qué se hizo:** `faltaPapel` en `packages/compartido/src/papelesVehiculo.ts` (carro, moto o scooter: licencia con número y vencimiento vigente, seguro con póliza y vencimiento vigente; a pie o en bici nada). Con el interruptor `config.papeles_vehiculo_obligatorios = '1'`: `PUT /datos/repartidor/datos` pide la póliza en carro o moto, y `POST /datos/repartidor/conectar` responde 409 `campo: 'papeles'` con el texto de qué falta o qué venció (traducido en `mensajesEn.ts`); la app ya muestra ese mensaje. Interruptores del equipo (`GET/PUT /datos/admin/interruptores-repartidor`, pieza `InterruptoresRepartidor.tsx` arriba de «Verificaciones» del superadmin) para esto y para la edad por estado (C-EDAD-REPARTIDOR). Guía «verify» del repartidor (ES y EN) con licencia, seguro y edad.
- **Apagado de fábrica:** los papeles nacen apagados (se encienden en Superadmin → Verificaciones); la edad por estado nace encendida.
- **Pruebas:** `papelesVehiculo.test.ts` (5), «G4b» en `operacion.test.ts` (5, dos en rojo sin el freno), interruptores en `kyc.test.ts` y `InterruptoresRepartidor.test.tsx`.
- UX-3 (1 nov): verde donde algo sale bien o es una acción positiva: «Pedir otra vez» en verde en la lista, el detalle (`BotonAncho exito`) y el inicio; «Normal» de cocina ocupada en verde en la app del restaurante. El rojo queda para la marca, el pago y las alertas.

## C-CONTACTO — puerta pública de contacto que abre un caso real (2 nov 2026, pedido de Richard por el gerente de correo, todos los países)

- **Qué hay:** `POST /datos/contacto` (Turnstile, 5 intentos por minuto, zod) abre un caso de tipo `soporte` con `datos.origen = 'contacto'`, `soy`, `numeroUsuario` y la ciudad; el enlace privado `/t/…` SOLO va por correo (la respuesta es `{ ok: true }`). La puerta del gerente (`GET /datos/gerente/tickets`) entrega `origen: 'contacto'` (o `'app'`), `soy`, `numero_usuario` y `ciudad`. Web: `sitio/FormContacto.tsx` (borrador, sugerencia de correo con `sugerirCorreo`, Turnstile), página `/contact` y `/es/contact` con «Quiénes somos», botón flotante «¿Preguntas?» en las páginas públicas (no en /contact ni /support), columna «Empresa» en el pie y el formulario en `/support`.
- **Datos de la empresa:** «Windoce, LLC», empresa de Delaware con oficinas en Novi, Michigan, con enlace a https://windoce.com (`MARCA.empresa`, legales, datos para buscadores). Miami no se presenta como sede ni como ciudad confirmada.
- **Pendiente legal (no se toca sin el abogado):** la cláusula de ley aplicable de los términos sigue diciendo Florida y los tribunales de Miami-Dade.
- **Pruebas:** `gerente.test.ts` → «C-CONTACTO», `FormContacto.test.tsx`, `packages/compartido/src/contacto.test.ts`, `Pie.test.tsx` (el enlace /contact existe).

## C-PREPAGO-MERCADOS (2 nov 2026) — Venezuela y Colombia

- **Qué es:** Richard dio el permiso comercial y legal del prepago de conductores por país. `schema.sql` siembra (INSERT OR IGNORE, ids `prepago-ve-ride`, `prepago-ve-car`, `prepago-ve-express` y los mismos con `co`) políticas `tipo_cuenta = 'conductor'`, modalidad `prepago`, 10 % (`{"tipo":"porcentaje","pb":1000}`), con `revision_legal_aprobada = 1` y la nota del permiso.
- **Qué NO cambia:** EE. UU. sigue con Stripe Connect (sin política de prepago); Comida y Mercado siguen con `comisionPb` del país. Moto y Carro siguen apagados en producción hasta lo legal de pasajeros.
- **Fuentes y decisión:** `docs/investigaciones-rea/2026-11-02-comision-prepago-conductores.md`.
- **Prueba:** «C-PREPAGO-MERCADOS» en `finanzas/finanzas.test.ts` (en rojo sin la siembra).
- **Qué NO tocar:** el equipo puede cambiar el porcentaje desde el panel de finanzas; la siembra no lo pisa.

## C-CORREO-RESERVADO — no se gastan correos en direcciones que no existen (2 nov 2026) — todos los países

- **Qué se rompió:** la respuesta de soporte a un restaurante real (formulario de contacto) no salió: «Hoy ya se enviaron los 1000 correos incluidos de tu plan». El cupo es de la cuenta y lo gastó el sitio de pruebas: el recorrido creó 333 cuentas en `recorrido.test` y `prueba.invalid` y les mandó bienvenidas, recibos y avisos.
- **Qué se hizo:** `esCorreoDePrueba` en `apps/servidor/src/correo.ts` (terminaciones `.test`, `.invalid`, `.example`, `.localhost`; dominios `example.com/net/org` y `ejemplo.com`). `enviarCorreo` responde `ok` con id `omitido-de-prueba` sin llamar al servicio. Con un transporte simulado (pruebas) no se omite, salvo `usarTransporteCorreo(t, { omitirDePrueba: true })`.
- **Prueba:** `correoReservado.test.ts` (en rojo sin el freno).
- **Qué NO tocar:** no cambiar las cuentas del recorrido a dominios reales.

## C-PAGINA-EN-APP — términos, privacidad y guías se abren dentro de la app (2 nov 2026) — todos los países

- **Qué pasaba:** un restaurante reportó que al tocar «términos y condiciones» la app lo sacaba al navegador.
- **Qué se hizo:** `packages/movil/src/PaginaEnApp.tsx`: `abrirPagina(url)` y `<VisorPaginas />` (visor web dentro de la app con «Listo» y «Abrir en el navegador», como el navegador interno de DoorDash y Uber Eats), montado una vez en `SesionProvider`. En la web abre la dirección como siempre. Lo usan Acceso (términos, términos del repartidor, privacidad), el menú de la cuenta (guías, privacidad, borrar cuenta), la conversación de un caso y los términos del repartidor en el inicio del Driver.
- **Prueba:** `packages/compartido/src/paginaEnApp.test.ts` (en rojo si vuelve un `Linking.openURL` a una página legal).
- **Qué NO tocar:** lo del panel web con sesión (`/panel/...`) sigue en el navegador: dentro del visor pediría entrar otra vez.

## C-COBERTURA-DINERO — los archivos de dinero del servidor no bajan del 90 % (2 nov 2026, bloque COB) — todos los países

- **Qué pasaba:** la regla de la casa pide 90 % de pruebas en todo lo que toca dinero, pero el reloj de finanzas estaba en 65 %, las rutas de la billetera de las empresas en 70 %, las del superadmin en 77 %, el SMS de respaldo en 72 % y el resto entre 86 y 89 %. Los caminos de error (Stripe caído, avisos incompletos, claves repetidas, montos fuera de rango) no tenían ninguna prueba.
- **Qué se hizo:** pruebas nuevas que describen lo que el código ya hace, cada una comprobada en rojo rompiendo el código a propósito: en `apps/servidor/src/finanzas/finanzas.test.ts` (bloques COB-1 a COB-4), `apps/servidor/src/plusBordes.test.ts` (Plus, tarjetas de regalo, cobro de viajes y recargas internacionales) y `apps/servidor/src/smsTwilio.test.ts` (SMS y llamadas con Twilio simulado). Ninguna toca Stripe ni Twilio de verdad.
- **El candado:** `vitest.config.mts` exige 90 % de líneas en cada uno de esos once archivos (`finanzas/reloj`, `rutasEmpresa`, `rutasAdmin`, `billetera`, `cobrosRuta`, `conductor`, `plus`, `tarjetasRegalo`, `viajesCobro`, `internacional/recargas`, `sms`). Si alguno baja, `npm run test` y por lo tanto `npm run verify` y el pre-push fallan. Comprobado: sin `smsTwilio.test.ts`, la verificación sale en rojo con «Coverage for lines (71.79%) does not meet "apps/servidor/src/sms.ts" threshold (90%)».
- **Cómo se comprueba:** `npm run test` en verde.
- **No tocar:** no se baja el umbral ni se saca un archivo de la lista para que pase un cambio; se agregan las pruebas que falten.

## C-BUSQUEDAS-RECIENTES (2 nov 2026) — todos los países

- **Qué es:** el buscador del cliente muestra las últimas ocho búsquedas bajo la casilla (como DoorDash y Uber Eats); se tocan para repetirlas, se quita una o se borra todo.
- **Cómo funciona:** `packages/compartido/src/busquedasRecientes.ts` (lógica pura) y `apps/cliente/src/app/search.tsx`. Cuenta como búsqueda lo que se confirma: tecla «buscar» o tocar un resultado. Se guarda en el teléfono con la llave `divoox:busquedas-recientes:<cuenta>` (en un teléfono compartido nadie ve las de otro). Un valor roto devuelve lista vacía.
- **Prueba:** `busquedasRecientes.test.ts` (en rojo si la repetida se duplica).
- **Qué NO tocar:** la llave por cuenta y el tope de ocho.

## C-TARIFAS-EXPLICADAS (2 nov 2026) — todos los países

- **Qué es:** debajo del total del carrito, «¿Qué son estas tarifas?» abre qué es cada cargo (como «Fees & Estimated Tax» de DoorDash).
- **Cómo funciona:** `packages/compartido/src/explicacionTarifas.ts` arma los textos con la configuración REAL del país del restaurante (la misma que calcula el total); el impuesto solo aparece donde se cobra; la propina dice 100 % para el repartidor (REQUISITOS.md).
- **Prueba:** `explicacionTarifas.test.ts` (en rojo si un monto se escribe a mano).
- **Qué NO tocar:** nunca escribir montos fijos en esos textos.

## C-ORDENAR-COMIDA (2 nov 2026) — todos los países

- **Qué es:** en la lista de Comida, además de «Solo abiertos», «Más cerca» y «Más rápido»: «Mejor calificados» (los nuevos sin calificación pública al final), «Menos de 30 min» y «4,5 o más», como Uber Eats.
- **Cómo funciona:** `filtrarRestaurantes` en `packages/compartido/src/filtrosComida.ts`. «Menos de 30 min» usa el extremo largo que promete la tarjeta (preparación + 20 min, `MINUTOS_ENTREGA_EXTRA`), para no prometer de más; en «Recoger» no aparece.
- **Prueba:** «C-ORDENAR-COMIDA» en `filtrosComida.test.ts` (en rojo si se usa solo la preparación).

## C-MAS-PEDIDOS (2 nov 2026) — todos los países

- **Qué es:** «Lo más pedido» arriba del menú del restaurante, con «N.º 1 más pedido» en el primero (como «Most Ordered» de DoorDash).
- **Cómo funciona:** `GET /datos/restaurantes/:id` devuelve `masPedidos` (ids) con `contarMasPedidos` de `packages/compartido/src/masPedidos.ts`: unidades de pedidos ENTREGADOS de los últimos 30 días, solo platos visibles hoy, mínimo 3 unidades, máximo 5. La app los pinta en `apps/cliente/src/app/restaurant/[id].tsx`.
- **Prueba:** `apps/servidor/src/masPedidos.test.ts` (en rojo sin el mínimo de unidades).
- **Qué NO tocar:** el mínimo de unidades (evita un «N.º 1» con un solo pedido).

## C-ALERGIAS (2 nov 2026) — todos los países

- **Qué es:** casilla «Alergias» en el carrito, aparte de las indicaciones (como «Allergy requests» de Uber Eats). El restaurante la ve resaltada en rojo en su app y en el panel, y arriba del ticket impreso («*** ALERGIA: … ***»).
- **Cómo funciona:** columna `pedidos.alergias` (TEXT, vacía por defecto) que llega con `COLUMNAS` de `esquema.ts` (no en schema.sql). El esquema del pedido la acepta hasta 200 letras y `aPedido` la devuelve. Si el restaurante no puede cumplirla, usa «Rechazar» (devolución total, ya existía).
- **Prueba:** `apps/servidor/src/alergias.test.ts` (en rojo si el pedido no la devuelve).
- **Qué NO tocar:** el rojo es correcto aquí (es un riesgo, no un éxito); sin emojis (regla sinEmojis).

## C-REGALAR-PEDIDO (2 nov 2026) — todos los países

- **Qué es:** «Enviar como regalo» en el carrito (como «Send as a gift» de DoorDash y Uber Eats): nombre, celular y mensaje de quien recibe; se paga con el cobro normal.
- **Cómo funciona:** columnas `pedidos.para_nombre`, `para_telefono`, `para_mensaje` por `COLUMNAS`. El servidor exige un celular válido (`telefonoE164`) y rechaza el regalo en «Recoger». A las notas se suma «Regalo para <nombre>» (nunca el celular). Al pagarse, `avisoDeRegalo` crea un enlace de seguimiento compartido (sin dirección ni dinero) y manda el SMS; si el SMS no está encendido en ese país, no sale y el cliente comparte el enlace desde su pedido.
- **Prueba:** `apps/servidor/src/regalarPedido.test.ts` (en rojo sin la validación del celular).
- **Qué NO tocar:** el celular de quien recibe no se muestra al restaurante ni al repartidor.

## C-EQUIPO-APP y C-APP-SIN-CIERRES — «Equipo» cerraba la app del restaurante (2 nov 2026) — todos los países

- **Qué se rompió:** en la app de restaurantes, Más → Equipo cerraba la app («Divoox Restaurants falló»). Causa real: la pantalla esperaba `{ miembros }` y el servidor manda `{ miRol, equipo }`; `d.miembros.map` sobre algo que no existe tiró la app entera, porque ninguna app tenía red de seguridad.
- **Qué se hizo:** (1) `MasPantallas.tsx` lee `equipo`. (2) Cada app exporta `ErrorBoundary` en `src/app/_layout.tsx` con `PantallaConFallo` (`packages/movil/src/PantallaConFallo.tsx`): si una pantalla falla se ve «Algo falló en esta pantalla» con «Volver» (atrás o al inicio) y la app no se cierra. (3) El fallo llega a `POST /datos/app/error` (`rutas/erroresApp.ts`) y queda en `errores_servidor` con método `APP` y ruta `<app>:<pantalla>`.
- **Pruebas:** «C-EQUIPO-APP» en `rutas/restauranteMas.test.ts` y `rutas/erroresApp.test.ts` (las dos en rojo sin el arreglo).
- **Qué NO tocar:** no quitar el `ErrorBoundary` de ningún `_layout.tsx`.

## C-PUENTE-PANEL — el panel web se abre dentro de la app con la sesión (2 nov 2026) — todos los países

- **Pedido de Richard:** «que no tenga que salir afuera para nada… 100 % nativa la navegación».
- **Qué se hizo:** `POST /datos/cuentas/puente` (con sesión) da un código de un solo uso (60 s, se guarda su hash en `puentes_sesion`); `GET /datos/cuentas/puente/:codigo?a=/ruta` deja la cookie de sesión y lleva a la ruta, solo del propio sitio. En la app, `abrirPanel(api, URL_SERVIDOR, '/panel/...')` abre esa dirección en el visor interno (C-PAGINA-EN-APP). Lo usan Configuración (cliente y menú de cuenta), Ganancias y las opciones de «Más» del restaurante. Stripe, la verificación y los antecedentes del repartidor, y «Olvidé mi contraseña», también se abren dentro.
- **Lo único que sale de la app:** llamar por teléfono, la app de mapas para navegar y WhatsApp (como DoorDash y Uber).
- **Pruebas:** `rutas/puentePanel.test.ts` (una vez, vencido, inventado, nunca afuera) y el tercer caso de `packages/compartido/src/paginaEnApp.test.ts` (en rojo si vuelve un `Linking.openURL` a una página).

## C-REFERIDOS — «Invita a un amigo» (CLI-7, 2 nov 2026) — todos los países (crédito en dólares)

- **Qué es:** como DoorDash y Uber Eats. Cada cliente tiene un código (nombre de pila y cuatro letras). El amigo lo escribe antes de su primer pedido (Mi cuenta → Invita a un amigo) y recibe su crédito al momento; quien invitó recibe el suyo cuando ese primer pedido se entrega (las dos formas de entregar, en `rutas/operacion.ts`, llaman a `premiarReferidoDelPedido`). Una vez por amigo, nunca a uno mismo, nunca con pedidos anteriores.
- **Dónde:** `apps/servidor/src/referidos.ts`; tablas `codigos_referido`, `referidos` y `creditos_regalo` (referencia única: un crédito nunca se repite). Los créditos suman al saldo de regalo (`SALDO` en `tarjetasRegalo.ts`), que se usa en el carrito (hoy solo en dólares). App: `apps/cliente/src/app/invite.tsx`. Superadmin: `SuperReferidos.tsx` en Rewards.
- **Apagado y en cero:** nace `activos: false` y montos 0; el servidor no deja encenderlo sin un monto. El dinero lo fija Richard.
- **Pruebas:** `referidos.test.ts` (en rojo si el crédito no suma al saldo) y `SuperReferidos.test.tsx`.

## C-VERSION-PANEL — la publicación se frenaba con «la web no lleva el commit» (2 nov 2026) — todos los países

- **Qué se rompió:** la corrida 299 de «publicar» falló en el paquete de pruebas: «index.html: la web no lleva el commit a50aa06». Producción quedó en ce6642d y pruebas en e3dfc71.
- **Causa real:** GitHub no deja cambiar `GITHUB_SHA` en un paso (el `env: GITHUB_SHA:` de `publicar.yml` no hace nada); en un `workflow_run` vale la punta de main. La punta era un cambio `[skip ci]` posterior (5960912), y el panel (`apps/panel/vite.config.ts`) grababa ese commit en `<meta name="version">` en vez del verificado. El servidor y las apps ya usaban `VERSION` primero.
- **Arreglo:** `vite.config.ts` usa `process.env.VERSION || process.env.GITHUB_SHA || 'local'` (VERSION es la versión verificada, puesta a nivel del trabajo).
- **Prueba:** «C-VERSION-PANEL» en `apps/servidor/src/version.test.ts` (en rojo sin el arreglo).

## C-ICONOS-TRANSPARENTES — la barra de abajo del cliente salía con cuadros grises (2 nov 2026) — todos los países

- **Qué se veía:** en la app del cliente (web y iPhone, desde UX-3), los cuatro íconos de la barra de abajo eran cuadros grises y uno rojo.
- **Causa real:** UX-3 los pinta con `tintColor`, y los PNG `apps/cliente/assets/inicio/nav-*.png` tenían fondo blanco opaco: se pintaba el cuadro entero.
- **Arreglo:** los cuatro PNG ahora tienen fondo transparente (el trazo oscuro pasó a ser la opacidad).
- **Prueba:** `packages/compartido/src/iconosTransparentes.test.ts` revisa las esquinas de todos los íconos que se pintan (en rojo con los PNG viejos).

## C-GUSTO-PLATOS (2 nov 2026) — todos los países

- **Qué es:** pulgar arriba o abajo por plato al calificar el pedido, y «Le gustó al 92 % (40)» en el menú, como DoorDash. El restaurante lo ve en Reseñas («Tus platos según los clientes»).
- **Cómo funciona:** `POST /datos/pedidos/:id/calificar` acepta `platos: [{ platoId, gusta }]` (opcional). Solo se guardan los platos que estaban en ese pedido (`platosDelPedido` de `packages/compartido/src/gustoPlatos.ts`) y calificar otra vez reemplaza los votos. Tabla nueva `calificaciones_platos` (CREATE IF NOT EXISTS, sin migración). El menú público devuelve `gustoPlatos` y `/datos/mi-restaurante/resenas` devuelve `platos`, con `resumenGusto` (mínimo 5 votos).
- **Prueba:** `packages/compartido/src/gustoPlatos.test.ts`, `apps/servidor/src/gustoPlatos.test.ts` y `apps/panel/src/panel/Resenas.test.tsx` (en rojo sin el cambio).
- **Qué NO tocar:** el mínimo de 5 votos y el filtro de platos del pedido (evita votos inventados a platos que no se pidieron).

## C-AUDITIVA-REPARTIDOR (2 nov 2026) — todos los países

- **Qué es:** el repartidor con sordera o dificultad auditiva lo enciende en Driver → Seguridad, como en Uber y DoorDash. El cliente ve «tiene sordera o dificultad auditiva: escríbele por el chat» en la tarjeta del repartidor; el panel y la app del restaurante lo ven en la línea del repartidor; las ofertas (comida y viajes) vibran más largo.
- **Cómo funciona:** tabla nueva `accesibilidad_repartidor` (CREATE IF NOT EXISTS). `GET/PUT /datos/repartidor/accesibilidad` (solo el repartidor). El seguimiento del cliente y `/datos/restaurante/pedidos` devuelven `repartidor.dificultadAuditiva`. `lineaRepartidor` (packages/compartido/src/mostrador.ts) suma el aviso; `patronVibracionOferta` da el patrón de vibración.
- **Prueba:** `apps/servidor/src/auditivaRepartidor.test.ts`, `packages/compartido/src/mostrador.test.ts` y `packages/compartido/src/accesibilidadRepartidor.test.ts` (en rojo sin el cambio).
- **Qué NO tocar:** que nazca apagado y que solo lo cambie el propio repartidor (es un dato de salud: nadie más lo marca).

## C-CALORIAS (2 nov 2026) — EE. UU.

- **Qué es:** calorías opcionales por plato, como Uber Eats: el restaurante las escribe en el menú (panel y app) y el cliente ve «$12.00 · 520 cal» junto al precio.
- **Cómo funciona:** columna `platos.calorias` (INTEGER, por COLUMNAS en `apps/servidor/src/esquema.ts`). `esquemaPlato` la acepta entre 0 y 10.000 o `null`; POST y PUT de `/datos/mi-restaurante/platos` la guardan y `aPlato` la devuelve.
- **Prueba:** `apps/servidor/src/caloriasPlato.test.ts` y `apps/panel/src/panel/Menu.test.tsx` (en rojo sin el cambio).
- **Qué NO tocar:** los DOS editores (panel `Menu.tsx` y app `apps/restaurante/src/MiMenu.tsx`) mandan `calorias`; si uno deja de mandarla, el PUT la borra al editar el plato.

## C-PLANILLA-PEDIDOS (2 nov 2026) — todos los países

- **Qué es:** «Descargar tus pedidos» al final del tablero del panel del restaurante: planilla CSV de un rango de fechas, como el reporte de pedidos de Uber Eats Manager.
- **Cómo funciona:** `GET /datos/mi-restaurante/pedidos/planilla?desde=&hasta=` en `apps/servidor/src/rutas/informes.ts` (dueño o manager, hasta 5.000 pedidos, sin `pago_pendiente`). Columnas: fecha, pedido (6 letras), estado, artículos, moneda, subtotal, comisión, tu pago y propina, con decimales (`montoATexto`) y celdas seguras (`celdaCsv`). Nada del cliente. El enlace del panel viaja con la cookie de la sesión (`apps/panel/src/panel/PlanillaPedidos.tsx`).
- **Prueba:** `apps/servidor/src/planillaPedidos.test.ts` (en rojo sin la ruta) y `apps/panel/src/panel/PlanillaPedidos.test.tsx`.
- **Qué NO tocar:** que no salgan nombre, teléfono ni dirección del cliente, y que solo vea los pedidos de su propio restaurante.

## C-PLANILLA-GANANCIAS (2 nov 2026) — todos los países

- **Qué es:** «Exportar en planilla (CSV)» en Ganancias de Driver, como el estado de cuenta de Uber Driver: una fila por entrega del periodo elegido (hoy, semana o mes), compartida con la hoja del teléfono.
- **Cómo funciona:** `planillaGanancias` y `celdaCsv` en `packages/compartido/src/planillas.ts` (la misma celda segura que usan los informes del servidor). La app arma el texto con los pedidos que ya trae `/datos/repartidor/ganancias` y lo comparte con `Share.share`, sin librerías nuevas.
- **Prueba:** `packages/compartido/src/planillas.test.ts` (en rojo sin el archivo) y `apps/servidor/src/rutas/informes.test.ts` (celda segura).
- **Qué NO tocar:** la celda segura (evita que un nombre de restaurante que empiece con «=» se ejecute como fórmula).

## C-CONTRATO-APPS (2 nov 2026, CON-1) — todos los países

- **Qué se rompió:** «Equipo» cerraba la app del restaurante: la pantalla esperaba una lista y el servidor manda `{ equipo, miRol }`. Nadie lo notó porque cada lado tenía su prueba por separado.
- **Candado:** `apps/servidor/src/rutas/contratoAppsTodas.test.ts` lee el código de las tres apps, toma cada `api.pedir<…>('GET', '/datos/…')` con dirección fija, la llama con una cuenta del rol de la app (el restaurante ya creado) y exige las llaves obligatorias del tipo, o una lista si el tipo es una lista. Hoy cubre unas cuarenta lecturas.
- **Comprobado en rojo:** devolviendo la app al tipo viejo (`Miembro[]`) y cambiando una llave del tipo, la prueba falla con el archivo y la dirección.
- **No tocar:** si una pantalla nueva lee con variables en la dirección, no entra; para esas se escribe su prueba propia (como `contratoApps.test.ts`).

- **C-APP-SIN-CIERRES, 2 nov (CON-3):** en Superadmin → Resumen → errores, el selector «Origen» separa el servidor de cada app, y cada fallo de app se ve como «App restaurante · /equipo». Prueba en `apps/panel/src/panel/Superadmin.test.tsx` (C-ERRORES-VISIBLES), comprobada en rojo sin el cambio.
- **C-CONTRATO-APPS, 2 nov (CON-4):** la misma prueba recorre el panel web; como el panel no dice el rol de cada pantalla, prueba con superadmin, restaurante, repartidor y cliente y vale la primera que entra. Comprobado en rojo cambiando la llave de los errores del superadmin.

## C-ABANDONADOS (2 nov 2026, CON-5) — todos los países

- **Qué se vio:** el embudo de producción cuadra (31 pedidos empezados, 11 pagados, 11 aceptados, 11 entregados, 18 abandonados sin pagar y cerrados), pero dos pedidos del 12 oct seguían «esperando el pago» tres semanas después, aunque el vigilante corre bien cada pocas horas.
- **Causa:** si Stripe no deja anular el cobro (ya venció, ya se anuló o no existe con la llave actual), el vigilante lo atrapaba, lo escribía solo en la consola y lo volvía a intentar para siempre.
- **Arreglo:** `apps/servidor/src/manager.ts` mira el estado real del cobro: anulado o inexistente → el pedido se cierra; pagado o sin respuesta → no se toca y queda en el registro de errores del superadmin («manager:abandonado:…»), que pone la salud en «pendiente».
- **Prueba:** `operacion.test.ts`, «si Stripe no deja anular porque el cobro ya venció…», comprobada en rojo.
- **Cómo se comprueba en producción después de publicar:** `SELECT COUNT(*) FROM pedidos WHERE estado = 'pago_pendiente' AND creado_en < datetime('now','-1 day')` tiene que dar cero después de la siguiente vuelta del reloj.

## C-SEGUIMIENTO-HONESTO (2 nov 2026, BRE-2) — todos los países

- **Qué es:** el seguimiento del pedido (app del cliente y enlace compartido) dice «Actualizado hace X s», avisa «Perdimos la señal del repartidor» si su última ubicación tiene más de 60 s (el punto se ve en gris y sin línea de ruta; en el enlace, «Ver su última ubicación conocida») y da la llegada como rango («Llega entre 12:40–12:50») además de «a más tardar». Estudios de Richard: mostrar rango y última actualización, indicar si el mapa se congela. Ficha: `docs/investigaciones-rea/2026-11-02-seguimiento-honesto.md`.
- **Cómo funciona:** una sola pieza, `packages/compartido/src/seguimientoHonesto.ts` (`segundosDesde`, `senalPerdida` con `SENAL_PERDIDA_S` 60, `rangoLlegada` de 10 min que no pasa del «a más tardar» y nunca baja de 5, `textoActualizado`, `textoRango`, y `estimacionLlegada`, que ahora usan igual `GET /datos/pedidos/:id/seguimiento` en `rutas/operacion.ts` y `GET /datos/publico/pedido/:codigo` en `rutas/pedidoCompartido.ts`). El servidor manda `repartidor.haceSegundos` y `senalPerdida` (con su reloj, no el del celular) y `llegadaRango`; la app (`apps/cliente/src/app/order/[id].tsx`, `MapaEntrega.tsx` con `sinSenal`) y la página (`apps/panel/src/sitio/PedidoCompartido.tsx`) suman los segundos que pasan entre consultas.
- **Pruebas (comprobadas en rojo):** `packages/compartido/src/seguimientoHonesto.test.ts` (sin la pieza, y la app sin `textoActualizado`/`sinSenal`), `operacion.test.ts` «C-SEGUIMIENTO-HONESTO» (con el servidor viejo falla en `haceSegundos`) y `apps/panel/src/sitio/PedidoCompartido.test.tsx` (con la página vieja fallan las dos).
- **Docs:** guías «Seguir tu pedido en vivo» y «Compartir el seguimiento», español e inglés. **Falta:** rehacer la captura del pedido en camino (`npm run recorrido:capturas`) cuando esto llegue al sitio de pruebas (FILA, BRE-2b).
- **Qué NO tocar:** el enlace compartido usa la dirección del cliente solo para la cuenta y nunca la devuelve; un punto con más de 60 s nunca se presenta como en vivo.

## C-ELOGIOS-MOTIVOS (2 nov 2026, BRE-3) — todos los países

- **Qué es:** al calificar, con 5 estrellas el cliente elige elogios ya escritos para el repartidor («Amable», «Rápido», «Cuidó la comida», «Siguió las instrucciones», «Buena comunicación») y para el restaurante («Bien empacado», «Porciones generosas», «Muy sabroso», «Llegó caliente»); con 3 o menos, «¿Qué salió mal?» con motivos. Con 4, nada. Como Uber Eats (elogios en el perfil del repartidor; motivos solo para la plataforma) y DoorDash. Ficha: `docs/investigaciones-rea/2026-11-02-elogios-y-pedido-prueba.md`.
- **Cómo funciona:** pieza única `packages/compartido/src/etiquetasCalificacion.ts` (`ETIQUETAS_CALIFICACION`, `tipoEtiquetas`, `etiquetasValidas`, `resumenEtiquetas`, `textoEtiqueta`). Tabla nueva `calificaciones_etiquetas` (PK pedido + para + etiqueta) en `schema.sql`, con su lista en `esquemaColumnas.ts` (regenerada con `node scripts/generar-columnas.mjs`). `POST /datos/pedidos/:id/calificar` (`rutas/operacion.ts`) recibe `etiquetasRestaurante` y `etiquetasRepartidor`, guarda solo las que tocan según las estrellas y las reemplaza al volver a calificar. Lo leen: `GET /datos/repartidor/calificaciones` (`elogios`, nunca motivos), `GET /datos/mi-restaurante/resenas` (`elogios`, `motivos` y `etiquetas` por reseña) y la ficha del repartidor del superadmin (`elogios` y `motivos`). Pantallas: `apps/cliente/src/app/order/[id].tsx` (`Etiquetas`), `apps/repartidor/src/grandes/Elogios.tsx` (en Calificaciones y Mi nivel), `apps/restaurante/src/Resenas.tsx`, `apps/panel/src/panel/Resenas.tsx` y `SuperFichas.tsx`.
- **Pruebas (comprobadas en rojo):** `apps/servidor/src/elogiosMotivos.test.ts` (sin la tabla ni las rutas fallan las tres) y `packages/compartido/src/etiquetasCalificacion.test.ts` (sin la pieza no carga; con la app del cliente sin mandar las etiquetas falla la de las apps).
- **Docs:** guía nueva «Elogios y motivos al calificar» (`ordering/compliments-and-reasons`) y párrafos en «Calificar la comida y al repartidor», «Reseñas de tus clientes» y «Mis calificaciones», español e inglés. **Falta:** su captura real al llegar al sitio de pruebas (está en `ESPERAN` de `guiasPublicas.test.tsx`; FILA, BRE-3b).
- **Qué NO tocar:** los motivos sobre el repartidor nunca salen en su app; las etiquetas son códigos de la lista (texto libre no); un código retirado se descarta al mostrar, no rompe nada.

## C-PEDIDO-PRUEBA (2 nov 2026, BRE-4) — todos los países

- **Qué es:** «Enviar un pedido de prueba» en Pedidos del panel y en Inicio de la app del restaurante, como «Create test order» de DoorDash Merchant: llega un pedido marcado PRUEBA/TEST con uno o dos platos del menú, suena, se acepta, se imprime, se marca listo y se termina («Terminar la prueba»). Sin cobro, sin repartidor, sin cliente. Ficha: `docs/investigaciones-rea/2026-11-02-elogios-y-pedido-prueba.md`.
- **Cómo funciona:** tabla APARTE `pedidos_prueba` (en `schema.sql`), nunca `pedidos`: así no lo ven la conciliación, los informes, el embudo, el despacho, el Manager, los cobros ni ninguna consulta futura. Pieza `apps/servidor/src/pedidoPrueba.ts` (`crearPedidoPrueba`, `pedidosPrueba`, `avanzarPrueba`, prefijo `prueba-`). En `rutas/operacion.ts`: `POST /datos/restaurante/pedido-prueba`, `POST /datos/restaurante/pedidos/:id/terminar-prueba`, y `aceptar`, `listo` y `rechazar` desvían los `prueba-…` a la pieza antes de tocar `pedidos` o Stripe; `GET /datos/restaurante/pedidos` los pone arriba con `prueba: true`. Pantallas: `apps/panel/src/panel/Pedidos.tsx` y `apps/restaurante/src/Inicio.tsx` (insignia, sin «falta un plato» ni «más tiempo», texto de listo y botón de terminar). Uno abierto a la vez; hace falta un plato disponible.
- **Pruebas (comprobadas en rojo):** `apps/servidor/src/pedidoPrueba.test.ts` (sin la ruta fallan las cuatro del servidor con 404; sin `/terminar-prueba` en la app falla la de las pantallas).
- **Docs:** guía nueva «Enviarte un pedido de prueba» (`restaurants/test-order`), español e inglés. **Falta:** su captura real al llegar al sitio de pruebas (en `ESPERAN`; FILA, BRE-4b).
- **Qué NO tocar:** nunca mover los pedidos de prueba a `pedidos` ni darles cobro o repartidor; cualquier acción nueva sobre pedidos del restaurante debe desviar el prefijo `prueba-` igual que aceptar, listo y rechazar.

## C-PROMO-RESTAURANTE (2 nov 2026, BRE-5) — todos los países

- **Qué es:** el restaurante arma su propia promoción (porcentaje del 1 al 50 % con tope opcional, envío gratis, o «gasta X y ahorra Y»), con fechas, pedido mínimo y máximo de pedidos, desde el panel (Promociones) y desde la app (Más → Promociones). Se aplica sola en los pedidos con tarjeta y el cliente ve la insignia en la lista, la ficha y el carrito. Como «Promotions» de DoorDash Merchant. Ficha: `docs/investigaciones-rea/2026-11-02-promociones-y-destino.md`.
- **Dinero:** `calcularPedido` (`packages/compartido/src/bolsillos.ts`) recibe `descuentoRestaurante`: baja `totalCliente` y `pagoRestaurante`; la comisión se calcula ANTES de la promoción; `gananciaPlataforma` y `pagoRepartidor` no cambian; nunca deja el pago del restaurante en negativo ni toca la propina. La misma cuenta en servidor y app con `calcularConPromocion` y `mejorPromocion` (`packages/compartido/src/promociones.ts`). Como sale de `pedidos.pago_restaurante`, el movimiento «venta» y la conciliación cuadran sin tocarlos.
- **Dónde vive:** tablas nuevas `promociones_restaurante` y `pedidos_promocion` (con la copia de la promoción) en `schema.sql`; `apps/servidor/src/promociones.ts`; rutas `GET/POST /datos/mi-restaurante/promociones`, `PATCH /datos/mi-restaurante/promociones/:id`, `GET/PUT /datos/admin/promociones` en `apps/servidor/src/rutas/promociones.ts`; aplicación en `POST /datos/pedidos` y recálculo con la copia en «plato agotado» y «cambio de dirección» (`apps/servidor/src/rutas/pedidos.ts`); insignia en `GET /datos/restaurantes` y la ficha (`rutas/catalogo.ts`). Pantallas: `apps/panel/src/panel/Promociones.tsx`, `SuperPromociones.tsx` (dentro de Rewards del superadmin), `apps/restaurante/src/Promociones.tsx`, carrito, lista y ficha del cliente.
- **Interruptor:** nace APAGADO (`config` clave `promociones_restaurante`, `{"encendidas": false}`). Apagado, nadie las crea y no se aplica ninguna.
- **Pruebas (comprobadas en rojo):** `packages/compartido/src/promociones.test.ts` (sin el cambio de `bolsillos.ts` fallan 3), `apps/servidor/src/promocionesRestaurante.test.ts` (sin las rutas fallan las 6), `apps/panel/src/panel/Promociones.test.tsx`. `equilibrio.test.ts` sigue verde. Umbral de 90 % de líneas en `vitest.config.mts` para `bolsillos.ts`, `compartido/promociones.ts`, `servidor/promociones.ts` y `rutas/promociones.ts`.
- **Docs:** guía «Promociones que creas y pagas tú» (`restaurants/promotions`), español e inglés. **Falta:** captura real al llegar al sitio de pruebas (en `ESPERAN`; FILA, BRE-5b).
- **Sin probar con dinero:** construido, probado con Stripe simulado; ver `VERIFICAR-PAGOS.md`.
- **Qué NO tocar:** la promoción nunca baja la ganancia de Divoox ni el pago del repartidor; los recálculos de un pedido usan la copia guardada en `pedidos_promocion`, no la promoción de hoy; si se agrega otro recálculo de pedido, tiene que pasar por `calcularConPromocion`.

## C-MODO-DESTINO (2 nov 2026, BRE-6) — todos los países

- **Qué es:** en Divoox Driver, tarjeta «Modo destino» en Inicio: el repartidor pone su destino (con la casilla de sugerencias, C-DIRECCION-SUGERENCIAS) y solo le llegan ofertas cuya entrega lo deja al menos 0,5 km más cerca. Hasta dos veces por día de su ciudad; se apaga solo a menos de 0,5 km del destino o con «Apagar». Como «Driver Destinations» de Uber. Ficha: `docs/investigaciones-rea/2026-11-02-promociones-y-destino.md`.
- **Dónde vive:** reglas en `packages/compartido/src/modoDestino.ts` (`acercaAlDestino`, `llegoAlDestino`, `diaLocal`, `USOS_DESTINO_DIA`); tablas `modo_destino` y `usos_modo_destino` en `schema.sql`; rutas `GET/PUT/DELETE /datos/repartidor/destino` en `apps/servidor/src/modoDestino.ts`; filtro en `repartirOfertas` y apagado al llegar en `POST /repartidor/ubicacion` (`apps/servidor/src/rutas/operacion.ts`); pantalla `apps/repartidor/src/piezas/ModoDestino.tsx` en `Inicio.tsx`.
- **Pruebas (comprobadas en rojo):** `apps/servidor/src/modoDestino.test.ts` (sin rutas fallan las cinco; sin el filtro falla la de ofertas), `packages/compartido/src/modoDestino.test.ts`.
- **Docs:** guía «Modo destino: pedidos de camino a casa» (`drivers/destination-mode`), español e inglés. **Falta:** captura real al llegar al sitio de pruebas (en `ESPERAN`; FILA, BRE-6b).
- **Qué NO tocar:** el contador sube con `ON CONFLICT … WHERE usos < 2` en un solo paso (nunca leer y después escribir); cualquier camino nuevo que elija repartidores para una oferta tiene que pasar por el mismo filtro de destino.
- **Nota (BRE-R3, revisor):** en `repartirOperaciones` (`apps/servidor/src/operaciones.ts`, viajes, envíos y Flex) el filtro de destino usa la ÚLTIMA ubicación del conductor guardada en la base (`conductores_elegibles`), aunque la lista de candidatos venga del tiempo real. Es a propósito y vale (la base se actualiza con cada `POST /repartidor/ubicacion`), pero si algún día el tiempo real trae una ubicación más fresca, el filtro debe usar esa.

## C-DESCUENTOS-RECALCULO (2 nov 2026, BRE-5c) — EE. UU.

- **Qué se rompió y cómo se veía:** los recálculos de un pedido ya creado («plato agotado» en `calcularSinPlato` y «cambio de dirección» en `PATCH /pedidos/:id/direccion`, `apps/servidor/src/rutas/pedidos.ts`) llamaban a `calcularPedido` SIN el descuento del cupón, de Divoox Plus ni del saldo de regalo. El cliente que usó un cupón de 5 y cambiaba la dirección veía su total subir 5 dólares de más; con un plato agotado, la devolución salía 5 dólares más baja; y `pedidos.descuento` quedaba en 500 mientras `total` y `ganancia` ya no lo restaban (el reparto dejaba de cuadrar).
- **Arreglo:** pieza única `recalcularConDescuentos` + `guardarDescuentos` en `apps/servidor/src/descuentosPedido.ts`. Cada descuento sigue su regla, igual que al pedir: cupón de monto, el mismo monto; de porcentaje, sobre el subtotal nuevo; de envío gratis, el envío nuevo; Plus, envío nuevo + la parte del servicio (sin volver a exigir el mínimo); saldo de regalo, el apartado, recortado por `saldoAplicable` si el total nuevo no lo admite. Se guardan al día `pedidos.descuento` (y `impuesto` en el plato agotado), `pedidos_plus.descuento`, `pedidos_saldo_regalo.centavos` y `usos_cupon.descuento`. La promoción del restaurante sigue con su copia (C-PROMO-RESTAURANTE).
- **Pruebas (comprobadas en rojo):** `apps/servidor/src/descuentosRecalculo.test.ts`: con el `pedidos.ts` anterior fallan las cuatro. Comparan el pedido recalculado con un pedido nuevo hecho así desde el principio, exigen total = restaurante + repartidor + Divoox + impuesto y la conciliación en «sí» después de entregar. Umbral de 90 % de líneas para `descuentosPedido.ts` en `vitest.config.mts`.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/descuentosRecalculo.test.ts`.
- **Qué NO tocar:** ningún recálculo de un pedido ya creado llama a `calcularPedido` o `calcularConPromocion` directo: pasa por `recalcularConDescuentos`. `pedidos.descuento` es la suma cupón + Plus + saldo de regalo; la parte del cupón se deduce restando `pedidos_plus` y `pedidos_saldo_regalo`.

## C-REVISOR-BRE-R (2 nov 2026) — arreglos del revisor para BRE-1 a BRE-4. Todos los países.

- **Retraso honesto:** `rangoLlegada` (`packages/compartido/src/seguimientoHonesto.ts`) marca `atrasado` cuando ni el rango mínimo cabe antes del «a más tardar»; la app del cliente y el enlace compartido dicen «Viene con retraso» y esconden el «a más tardar». Pruebas: `seguimientoHonesto.test.ts`, `PedidoCompartido.test.tsx`.
- **Pedido de prueba:** sin «Reportar un problema» y sin QR de recogida (panel `Pedidos.tsx`, app `Inicio.tsx`); tope `PRUEBAS_POR_DIA` = 10 en `pedidoPrueba.ts` (429). Pruebas: `PedidosPrueba.test.tsx`, `pedidoPrueba.test.ts`. Todas comprobadas en rojo.
- **Guías:** «test-order» y «compliments-and-reasons» llevan capturas reales (panel local y app web del cliente compilada); originales en `docs/capturas/`.

## C-PROMO-REVISION (2 nov 2026, BRE-R2) — EE. UU. lo de dinero; todos los países el modo destino

- **Qué se rompió:** (1) con Divoox Plus o un cupón de envío gratis, la promoción «envío gratis» del restaurante volvía a descontar el envío (el cliente pagaba de menos y Divoox quedaba en negativo); (2) al quitar un plato agotado, si el subtotal bajaba del mínimo de «gasta X y ahorra Y» (o aparecía el cargo por pedido pequeño), el total SUBÍA y la captura de Stripe por más de lo autorizado fallaba; (3) la promoción contaba el porcentaje y el mínimo con el plato regalado por el restaurante; (4) el modo destino solo filtraba comida (viajes y envíos de `repartirOperaciones` no miraban el destino); (5) guardar el destino contaba el uso antes de guardar; (6) una zona horaria mala en `diaLocal` se callaba.
- **Arreglo:** `basePromocion` y `OpcionesPromocion` (`envioCubierto`, `sinMinimo`) en `packages/compartido/src/promociones.ts`, usadas igual en `POST /datos/pedidos` (cupón y Plus se deciden ANTES de la promoción), en el carrito (`apps/cliente/src/app/cart.tsx`) y en `recalcularConDescuentos` (`apps/servidor/src/descuentosPedido.ts`, con `totalMaximo` = total cobrado en el plato agotado: lo que sobre lo absorbe Divoox como descuento). Filtro de destino en `repartirOperaciones` (`apps/servidor/src/operaciones.ts`, con la última ubicación del conductor). `PUT /repartidor/destino` guarda el destino apagado, cuenta el uso y recién entonces lo enciende.
- **Pruebas (comprobadas en rojo):** `apps/servidor/src/promocionesRevision.test.ts` (4), `packages/compartido/src/promociones.test.ts` (BRE-R2, 2), `apps/servidor/src/modoDestinoRevision.test.ts` (2), `packages/compartido/src/modoDestino.test.ts` (zona mala anotada), `guiasPublicas.test.tsx` (ESPERAN vacío).
- **Docs:** las guías «Promociones que creas y pagas tú» y «Modo destino» llevan MAQUETAS fieles (`apps/panel/public/docs/maqueta-*.webp`, originales en `docs/capturas/maquetas/`, guion `scripts/docs/maquetas-bre-r2.mjs`), marcadas en `guias.ts` para reemplazar por las reales en BRE-5b y BRE-6b.
- **Qué NO tocar:** la promoción del restaurante nunca paga un envío que ya cubrió Divoox; un recálculo que quita algo nunca sube el total cobrado; todo camino que ofrezca trabajo a un conductor pasa por el filtro de destino.

## C-ENVIO-UNA-VEZ (2 nov 2026, BRE-R3) — EE. UU.

- **Qué se rompió y cómo se veía:** con Divoox Plus y además un cupón de «envío gratis», el envío se descontaba DOS veces: el cupón restaba el envío y `descuentoPlus` volvía a sumar el mismo envío (el cupón no baja el campo `envio`). Pedido de 30,00 + envío 3,99 + servicio 1,99 + propina 3,00 cobraba 30,00 en vez de 33,99 y Divoox quedaba en −5,75. Pasaba al crear (`POST /datos/pedidos`), en el recálculo (`recalcularConDescuentos`) y en el carrito de la app.
- **Arreglo (regla: el envío se descuenta una sola vez):** con Plus el envío ya va en cero, así que un cupón de envío gratis no tiene nada que descontar y se RECHAZA (409, campo `cupon`, «Ya tienes el envío gratis con Divoox Plus.»), como DoorDash con DashPass. `validarCupon` (`apps/servidor/src/rutas/cupones.ts`) recibe `plusCubreEnvio`; `POST /datos/cupones/validar` lo calcula (Plus vigente + dólares + envío > 0 + mínimo de Plus) y `POST /datos/pedidos` lo pasa con `plusAplica && previo.envio > 0` (Plus se decide ANTES del cupón). Un pedido viejo con los dos se recalcula con el cupón de envío en 0 (`apps/servidor/src/descuentosPedido.ts`).
- **El carrito:** sin cambios de código: valida el cupón con `/datos/cupones/validar`, que ahora lo rechaza con Plus, así que la app no lo suma. Caso que queda (BRE-R3b en FILA): cupón validado antes de llegar al mínimo de Plus y el carrito crece después; la app mostraría el doble descuento, pero el servidor rechaza el pedido (409) y no se cobra nada.
- **Pruebas (comprobadas en rojo, cada parte por separado):** `apps/servidor/src/envioUnaVez.test.ts` (2): sin el arreglo de la validación falla la primera; sin `plusCubreEnvio` al crear, el pedido sale con 201 y falla; sin el cero del recálculo falla la segunda. Exigen total = restaurante + repartidor + Divoox + impuesto y conciliación en «sí» después de entregar. `rutas/pedidos.ts` y `rutas/cupones.ts` quedan con umbral de 90 % de líneas en `vitest.config.mts`.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/envioUnaVez.test.ts`.
- **Qué NO tocar:** ningún descuento vuelve a descontar un envío que ya cubrió otro (Plus, cupón o promoción del restaurante, ver C-PROMO-REVISION). Plus se decide antes que el cupón al crear.

## C-RECOGER-SIN-REPARTIDOR (BRE-7b, 2 nov 2026). Todos los países.

- **Qué se rompía:** en un pedido para recoger, la app del cliente hablaba de repartidor («Buscando repartidor…», «Llega en…», paso «En camino», «A más tardar … · undefined»), dejaba una tarjeta vacía al entregar, el carrito pedía «Propina para tu repartidor» con 20 % (la propina va al restaurante) y el pedido podía salir sin PIN si el cliente lo había apagado en «En mano».
- **Arreglo:** `apps/cliente/src/app/order/[id].tsx` (`recoge`, `estadosRecoger`, `pasosRecoger`, `listoEn`, `pediste.recoger`), `apps/cliente/src/app/cart.tsx` + `textos.ts` (`propinaRecoger`, `propinaNotaRecoger`, `notasRecoger`, propina en 0 % al elegir recoger), `apps/servidor/src/rutas/pedidos.ts` (la recogida crea PIN siempre).
- **Candados:** `e2e/recorrido/recogerCompleto.spec.ts` (comprobado en rojo quitando el arreglo de la pantalla) y la prueba BRE-7b de `apps/servidor/src/rutas/cupones.test.ts`.

## C-HOJAS-AREA-SEGURA (3 nov 2026, lo vio Richard grabando para Apple). Todos los países.

- **Qué se rompía y cómo se veía:** en la app del cliente de iPhone, en la hoja de detalle de un plato, el botón de volver quedaba debajo de la barra de estado (la hora y «◀ TestFlight») y no se podía tocar: había que cerrar la app. Apple rechaza eso por la pauta 2.1.
- **Causa real:** las ventanas (`Modal`) de pantalla completa en iPhone empiezan detrás de la barra de estado. Había seis así: el detalle del plato (`app/restaurant/[id].tsx`), elegir la dirección (`inicio/ElegirDireccion.tsx`), el lector de códigos del paquete (`RastrearPaquete.tsx`), el lector del repartidor (`apps/repartidor/src/Inicio.tsx`), los dos lectores de Mi ruta (`flex/MiRuta.tsx`) y los permisos (`packages/movil/src/PantallaPermisos.tsx`).
- **Qué se hizo:** las seis abren con `presentationStyle="pageSheet"`, la hoja de iOS de las apps de Apple. Empieza debajo de la barra de estado, se cierra deslizando hacia abajo y llama a `onRequestClose`. Las transparentes (avisos al centro, la oferta de abajo, el selector de idioma) no cambian.
- **Candado:** `apps/servidor/src/hojasAreaSegura.test.ts` recorre todas las `<Modal` de las tres apps y del paquete compartido, y exige `pageSheet` en toda la que no sea transparente. Estuvo en rojo en las seis antes del arreglo.
- **Qué NO tocar:** una ventana nueva de pantalla completa nace como hoja; nada se dibuja detrás de la barra de estado.

## C-REVISION-SIN-SENAL (3 nov 2026, meta urgente de Gerencia). Todos los países.

- **Qué se rompía y cómo se veía:** en la app del cliente, «Divoox Review Kitchen» salía cerrado salvo que alguien tuviera abierta su app o su panel (C-PAUSA-SIN-SENAL, como el «Tablet Heartbeat» de DoorDash). Ni Richard al grabar ni el revisor de Apple lo tienen abierto.
- **Qué se hizo:** columna `restaurantes.revision_sin_senal` (en `COLUMNAS` de `esquema.ts`, se agrega sola al publicar), en 0 para todos. En 1 se exime de la señal en tres sitios: `aRestaurante` (`catalogo.ts`, el «abierto ahora» de la lista y la ficha), la creación del pedido (`pedidos.ts`) y el aviso de pausa del reloj (`pausa.ts`). Solo se pone en 1 en producción en el restaurante de la cuenta de revisión (d479c28e…), y sus horarios van de 00:00 a 23:59 todos los días mientras dure la revisión de Apple. Al aprobarse, se vuelve a 7:00–23:00. Para quitar la exención: `UPDATE restaurantes SET revision_sin_senal = 0 WHERE id = 'd479c28e-115d-44ac-b9bb-59d62f915c0c'`.
- **Candado:** `apps/servidor/src/revisionSinSenal.test.ts`, en rojo sin el cambio de `catalogo.ts`. Comprueba que el de revisión, sin señal hace una hora, sale abierto en la ficha y en la lista, y que uno normal sin señal sigue cerrado.
- **Qué NO tocar:** la marca nunca va en un restaurante real: sin su app abierta, los pedidos no le llegarían a nadie.

## C-ENTREGA-PRACTICA (3 nov 2026, ordenado por Gerencia para el video de Apple). Todos los países.

- **Qué faltaba:** Apple pide ver «the typical user flow». Para Divoox Driver eso es recibir una oferta, aceptarla, recoger y entregar, y en producción no había cómo hacerlo sin un pedido pagado de verdad. Probar con tarjeta real está prohibido.
- **Qué se hizo:** el «Send a test order» de una cuenta de revisión del restaurante (C-PEDIDO-PRUEBA), una vez que el restaurante lo acepta, le llega como oferta de práctica SOLO a las cuentas de revisión del repartidor (`esRevisor`: tabla `revisores` o `CORREOS_REVISOR`, con el correo confirmado). Módulo `apps/servidor/src/entregaPractica.ts`. `rutasPractica` va montado en `app.ts` ANTES que las demás rutas y atiende solo los números «prueba-…»: aceptar y rechazar la oferta, llegué, verificar, recoger, entregar, soltar, el chat (vacío) y la llamada (aviso). `GET /repartidor/ofertas` agrega `ofertasPractica` cuando no hay ofertas reales, y `GET /repartidor/estado` devuelve `practicaActiva` como `activo` cuando no hay entrega real. La práctica tiene la forma de un pedido, con `practica: true`, `pagoRepartidor: 0` y la nota «Practice delivery: nothing is charged or paid», así que la app de Driver la pinta sin compilación nueva. Vive en su tabla `entregas_practica` (schema.sql) y nunca toca `pedidos`, `ofertas` ni `libro`.
- **Candado:** `apps/servidor/src/entregaPractica.test.ts`, en rojo antes del módulo. Comprueba cuatro cosas: solo el revisor ve la oferta; un repartidor real recibe 403 al intentar tomarla; el recorrido completo; y las cuentas de `pedidos`, `ofertas` y `libro` no cambian. Además, el pedido de un restaurante que no es de revisión no se ofrece a nadie.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/entregaPractica.test.ts`. En producción, con las dos cuentas de revisión: Restaurants → «Send a test order» → «Accept order» → a Driver le llega la oferta con $0.00.
- **Qué NO tocar:** la práctica nunca entra a `pedidos`, `ofertas` ni el libro; solo la ven las cuentas de revisión; las rutas de práctica dejan pasar todo número que no empiece por «prueba-».

## C-PUBLICAR-SE-RECUPERA (3 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** producción se quedó más de una hora en be18d4f. Las dos publicaciones de 7bc0bb9 (14:56Z y 15:17Z) salieron «canceladas» sin correr ningún trabajo, con su verify en verde.
- **Causa real:** `pruebas-rama.yml` y `publicar.yml` comparten la fila de concurrencia `publicar` (a propósito: las dos empujan `yapanel-pruebas`). GitHub deja UNA sola corrida esperando por fila; la que entra cancela a la que esperaba, aunque `cancel-in-progress` sea `false`. La publicación de 14:56 se canceló a las 14:59:36, dos segundos después de que entrara la `pruebas-rama` de c109f2d; la de 15:17 a las 15:24:27, uno después de la de da359b7.
- **Arreglo:** `publicar.yml` acepta `workflow_dispatch`; llamado a mano, toma la última versión de main con su verify en verde (`actions/workflows/verify.yml/runs?branch=main&status=success`) y no hace nada si producción ya la sirve. `pruebas-rama.yml` tiene el trabajo `republicar` (`needs: pruebas`, `if: always()`, permiso `actions: write`): al terminar, si divoox.com no sirve esa versión, corre `gh workflow run publicar.yml`; la publicación espera a que la prueba suelte la fila. Si una prueba nueva la vuelve a cancelar, esa prueba la vuelve a llamar al terminar.
- **Candado:** `apps/servidor/src/publicarSeRecupera.test.ts` (en rojo sin el trabajo `republicar`).
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/publicarSeRecupera.test.ts`; en Actions, después de una `pruebas-rama`, su trabajo `republicar` dice «producción ya sirve …» o lanza `publicar`.
- **Qué NO tocar:** las dos siguen en la misma fila (separarlas haría que una rama pise el sitio de pruebas mientras `publicar` espera su semáforo); no se quita `republicar`.

## C-SOLO-LO-TERMINADO y C-LOGO-PORTADA (3 nov 2026, Richard). Todos los países.

- **Qué se rompía y cómo se veía:** la portada del cliente no llevaba el logo de Divoox. «Más» abría con una franja «Estamos construyendo este servicio», un dibujo de cuatro cuadros de colores gigante y «Todo lo que viene en Divoox», y debajo los servicios con «Pronto», en cuadros angostos que partían las palabras («Mercad / o», «Farmaci / a»); Envíos quedaba fuera de la pantalla. Richard: «no es un MVP… ya no ponga pronto… vamos a mostrar lo que esté terminado».
- **Qué se hizo (estándar: pestaña Services de Uber y «Todos los servicios» de Grab, estudio REA del 3 nov):**
  - `serviciosTerminados` y `hayMasServicios` en `packages/compartido/src/servicios.ts`: Comida siempre y solo los servicios con `accion === 'abrir'`.
  - `inicio/Servicios.tsx`: los chips usan `serviciosTerminados`; «Más» sale solo si hay algo más que Comida.
  - `inicio/PantallaMas.tsx` (nueva; `app/service/[id].tsx` la usa para `mas`): logo, «Bienvenido a Divoox», una frase, y los servicios listos en una cuadrícula pareja de dos en dos (`width: '48%'`, sin estirar), con dibujo, nombre en una línea y su frase (`lemaServicio`).
  - Pantalla de un servicio abierto: sin franja y sin la tarjeta «Lo que vas a poder hacer · Ejemplo»; ícono a 96.
  - `inicio/Cabecera.tsx`: arriba el logo (`IMG.logo`, `testID="inicio-logo"`), la campana y el idioma; debajo «Entregar en».
- **Candados:** `packages/compartido/src/servicios.test.ts` («solo lo terminado», en rojo sin las funciones); `e2e/recorrido/mas.spec.ts` (catálogo fijo con Farmacia por venir: no aparece, no hay «Pronto» ni franja); el recorrido comprueba el logo y que ningún servicio por venir sale en la portada ni en «Más».
- **Cómo se comprueba:** `npx vitest run packages/compartido/src/servicios.test.ts` y `npm run recorrido -- e2e/recorrido/mas.spec.ts`; mirar `docs/capturas/mas-servicios-es.png` y `docs/capturas/recorrido/cliente-inicio-es.png`.
- **Qué NO tocar:** no vuelven «Pronto», la franja de construcción ni los grupos que dejan un cuadro solo estirado; el logo no se quita de la portada.

## C-PORTADA-CLIENTE (POR-1, 2 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** la portada de la app del cliente no parecía de una app grande: ocho cuadros grandes de servicios con «Pronto» ocupaban media pantalla, el botón de idioma era una pastilla roja enorme, Comida salía con una hamburguesa, los restaurantes solo en un carrusel de tres, no había dirección arriba y la portada terminaba en «Cerrar sesión».
- **Qué se hizo (estándar de DoorDash y Uber Eats):** `apps/cliente/src/Inicio.tsx` es UN solo `ScrollView` con `stickyHeaderIndices={[0]}` (buscador + filtros pegados arriba al bajar). Arriba, fuera del scroll, `inicio/Cabecera.tsx`: «Entregar en ▾» con la dirección (abre `inicio/ElegirDireccion.tsx`, que usa `CampoDireccion`, las direcciones guardadas de `/datos/mis-direcciones` y «Usar mi ubicación actual»), campana real y `SelectorIdioma` con la variante nueva `sobreClaro` (letras negras). La dirección elegida a mano se guarda en el teléfono (`tumbite.direccionEntrega`, `comida/useRestaurantes.ts` → `elegirDireccion`) y manda sobre el GPS. `inicio/Filtros.tsx` (Entrega/Recoger, Ofertas, Abiertos); `inicio/Servicios.tsx` en chips deslizables: Comida, los servicios con `accion === 'abrir'` y «Más» (lo que viene vive dentro de «Más», sin «Pronto»); `inicio/Ofertas.tsx` banner deslizable SOLO con cupones reales (sin muestras); `inicio/Categorias.tsx` círculos con las categorías reales (abren `/restaurants?categoria=`); `inicio/Restaurantes.tsx` con `FilaRestaurantes` («Más rápidos cerca de ti», «Te puede gustar») y `ListaRestaurantes` vertical («Todos los restaurantes», tandas de 25 que se cargan al bajar, `testID="lista-restaurantes"`), corazón real con `inicio/useFavoritos.ts`. Comida con pizza: `assets/inicio/servicio-comida-pizza.png` (recorte redondo de la foto de pizza). «Cerrar sesión» y los tres puntos pasaron a Mi cuenta (`app/account.tsx`). La barra de abajo ya tenía los íconos transparentes (C-ICONOS-TRANSPARENTES).
- **Candados:** `packages/compartido/src/portadaCliente.test.ts` (comprobado en rojo con la portada vieja); el recorrido (`e2e/recorrido/recorrido.spec.ts`) abre «Entregar en», cierra, comprueba que el buscador sigue a la vista al bajar a la lista, y llega a un servicio que viene por «Más» (`servicio-mas` → `explorar-<id>`).
- **Cómo se comprueba:** `npx vitest run packages/compartido/src/portadaCliente.test.ts` y `CAPTURAS=1 npm run recorrido`; mirar `docs/capturas/recorrido/cliente-inicio-es.png`, `cliente-inicio-lista-es.png` y `cliente-inicio-direccion-es.png` (y sus `-en`).
- **Qué NO tocar:** en la portada no vuelve el «Pronto» en cada servicio ni la cuadrícula de ocho; la dirección se cambia siempre con `CampoDireccion`; «Cerrar sesión» no vuelve a la portada; Comida nunca con hamburguesa.

## C-OCUPADO-VISIBLE (BRF-1, 2 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** en el sitio de pruebas, un pedido a domicilio en Novi pagado con la tarjeta de prueba no le llegaba como oferta al repartidor demo (22a50a23, cancelado con devolución; reproducido otra vez con 178b9168). La causa real: el repartidor tenía una ruta de paquetes de Divoox Flex «en curso» desde el 31 oct (una ruta de prueba de `armar-ruta-flex-novi.mjs` que nunca se cerró), y una ruta ocupa al conductor como UNA sola operación (C-FLEX-OCUPACION, fila `ruta_flex` en `conductor_ocupacion`), así que `libresEn` lo dejaba fuera. Eso es correcto, pero nadie lo veía: el servidor no decía que estaba ocupado y la app decía «Buscando pedidos cerca de ti…» si la ruta estaba asignada, aceptada o cargando. No era el modo destino (ya estaba apagado) ni la zona.
- **Arreglo:** `GET /datos/repartidor/estado` devuelve `ocupadoEn` (`'ruta_flex' | 'operacion' | null`), leído de `conductor_ocupacion` con `tipo <> 'comida'` (la misma fila que usa el reparto). `apps/repartidor/src/Inicio.tsx` muestra en su lugar «Mientras tengas la ruta de paquetes no te llegan pedidos de comida…» (o el de viaje), en español e inglés, nunca «Buscando pedidos». Guía «Mi ruta» (`my-route-packages`) al día en los dos idiomas. La ruta atascada del sitio de pruebas se cerró como conductor (entregando la última parada); con eso la oferta llegó al instante.
- **Prueba (comprobada en rojo):** `apps/servidor/src/rutas/ocupadoEnRuta.test.ts`: sin la lectura de `conductor_ocupacion` falla («expected null to be 'ruta_flex'»).
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/rutas/ocupadoEnRuta.test.ts`. En pruebas: si una oferta no le llega al repartidor demo, mirar primero `GET /datos/v1/flex/conductor/rutas` con su sesión (una ruta en `asignada`, `aceptada`, `en_carga` o `en_curso` lo ocupa).
- **Qué NO tocar:** la fila de `conductor_ocupacion` sigue siendo la única verdad de «ocupado» para el reparto y para la app; no se calcula aparte en la app.

## C-CORREO-RESPONDER-A (2 nov 2026). Todos los países.

- **Qué se rompía:** divoox.com no tiene registro MX; las respuestas de un cliente a support@divoox.com (avisos «Te respondimos tu caso») no llegaban a nadie (Gmail: 4.4.1, se agota el tiempo).
- **Arreglo:** `enviarCorreo` (apps/servidor/src/correo.ts) pone siempre `reply_to` = `CORREOS_SOPORTE.divoox` (soporte+divoox@windoce.com), salvo que el correo pida otro con `responderA`.
- **Candado:** apps/servidor/src/correoResponderA.test.ts (rojo sin el arreglo).
- **Regla (4 nov 2026, tarde, Gerencia con autorización de Richard: «Sí, actívalo»): divoox.com recibe correo por Cloudflare Email Routing hacia windoce.com.** Reemplaza la regla de la mañana («divoox.com nunca recibe»). En la cuenta de Cloudflare del proyecto (zona 17be8495…, comprobada), Email Routing está activo en la raíz: MX route1, route2 y route3.mx.cloudflare.net, SPF de la raíz `v=spf1 include:_spf.mx.cloudflare.net ~all` y DKIM cf2024-1 (los puso Cloudflare; cf-bounce y el DMARC no se tocaron). Reglas: support@, soporte@, orders@ y sales@divoox.com se reenvían a soporte@windoce.com (destino verificado el 4 nov a las 16:45 UTC); no-reply@divoox.com se descarta; la regla general (catch-all) sigue APAGADA. Prueba real: un correo a support@divoox.com quedó «forward / delivered» en el registro de Cloudflare (4 nov, 17:10 UTC, spf, dkim y dmarc en pass). El primero rebotó con 550 porque salió un minuto antes de que las reglas sincronizaran. Los remitentes de envío siguen igual y el «responder a» sigue en windoce.com (`CORREOS_SOPORTE`): el código nunca muestra una dirección de divoox.com para recibir.
- **Candado C-CORREO-SIN-RECIBIR-DIVOOX** (sigue igual: el código no muestra ni usa para responder ninguna dirección de divoox.com salvo no-reply): apps/servidor/src/correoSinRecibirDivoox.test.ts. Se pone en rojo si en el código vivo (apps y packages, sin pruebas) aparece escrita una dirección de divoox.com distinta de no-reply, si un buzón de `CORREOS_SOPORTE` no es de windoce.com, o si un correo sale con «responder a» en divoox.com (`enviarCorreo` lo cambia por el buzón de soporte). Comprobado en rojo el 4 nov antes del arreglo (el user-agent de Open Food Facts en rutas/tiendas.ts decía soporte@divoox.com).

## C-MENU-RAPIDO (4 nov 2026, Richard: «la pantalla queda en blanco 3 a 5 segundos»). Todos los países.

- **Qué se veía:** al tocar un restaurante, la ficha quedaba en blanco debajo de «Menu / Info» entre 3 y 5 segundos.
- **Causa real:** `GET /datos/restaurantes/:id` hacía ~12 consultas a la base una detrás de otra (0,6 a 1,8 s medidos en producción por 4 KB), y la app no mostraba nada mientras esperaba ni guardaba el menú.
- **Arreglo:** servidor (apps/servidor/src/rutas/catalogo.ts): tres tandas con `Promise.all` (el restaurante; platos, horarios, pausa, franjas, más pedidos, votos y promociones; calificación y grupos de opciones). App: apps/cliente/src/comida/fichaRestaurante.ts guarda cada ficha en memoria (un minuto), la portada pide por adelantado las de los primeros restaurantes (`adelantarFichas`), la ficha sale al instante de lo guardado, y mientras llega muestra renglones grises (`MenuEsperando`), nunca la pantalla en blanco.
- **Prueba (comprobada en rojo: 504 ms con 12 consultas demoradas 40 ms, contra menos de 260):** apps/servidor/src/rutas/menuRapido.test.ts.
- **Memoria del borde (mismo día):** la ficha sale con `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=120` (es igual para todos); la prueba lo exige.
- **Qué NO tocar:** no volver a encadenar consultas que no dependen entre sí en las rutas que ve el cliente.

## C-DESFILE-FLOTA y C-MENU-MOVIL (4 nov 2026, Richard: «está genial, envíalo a producción»). Todos los países.

- **Desfile:** DesfileFlota (apps/panel/src/sitio/DesfileFlota.tsx): la flota real pasa de a uno, grande (150 px; 100 en el celular), sobre una línea roja, alternando el sentido, se detiene en el centro y sale, con sombra y reflejo. Cada vehículo lleva su `--proporcion` (ancho/alto de su foto) para salir entero de la vista (sin ella se amontonaban en el borde). Va en la portada y en las páginas de ciudad, país y comida (`BannerArriba`, estilo por defecto) con «Muy pronto en …» arriba, y en la calculadora. La avenida negra (C-AVENIDA-DIVOOX) queda SOLO en «Cómo funciona» (`estilo="avenida"`).
- **Menú del celular:** en pantallas de menos de 900 px el menú de la web va en la hamburguesa (tres rayitas) de la cabecera, con todas las secciones, «Panel» y «Descarga las apps». Se cierra al elegir o con Escape. En menos de 600 px, «Panel» sale de la cabecera y queda dentro del menú.
- **Pruebas:** apps/panel/src/sitio/menuMovil.test.tsx y BannerCarretera.test.tsx.

## C-AVENIDA-DIVOOX (4 nov 2026, Richard). Todos los países.

- **Qué es:** el banner de arriba (BannerCarretera) con la flota real de Divoox (foto con fondo transparente que mandó Richard), recortada en seis vehículos en apps/panel/public/marca/vehiculos/<nombre>-izq.webp y -der.webp. Los de la derecha son la foto volteada con el logo vuelto a poner al derecho. Dos carriles: adelante sedán, moto y camioneta hacia la izquierda; atrás, más chicos, compacto, robot y moto hacia la derecha. En cada carril todos van a la misma velocidad y separados, para que nadie se monte sobre otro. El texto va arriba de la vía. Con «reducir movimiento» quedan quietos.
- **Prueba:** apps/panel/src/sitio/BannerCarretera.test.tsx.

## C-DESCARGAS (4 nov 2026, Richard). Todos los países.

- **Qué es:** la zona de descarga /download (y /es/download): las tres apps con su ícono real (apps/panel/public/marca/app-*.webp, sacados de los íconos de cada app), para qué es cada una, el botón de Android en verde (Google Play, funciona) y el de iPhone en gris y sin enlace («En revisión de Apple») hasta que Apple apruebe. «Get the app» / «Descarga la app» de la cabecera y el botón del banner principal llevan ahí; las secciones de la portada y el pie llevan directo a cada app, y el pie también a «Todas las apps». Está en `RUTAS_PUBLICAS` del servidor y en el prerender.
- **Prueba:** apps/panel/src/sitio/enlacesTiendas.test.tsx («la zona de descarga trae las tres apps…») y C-PIE-ENLACES con /download.

## C-CORREO-VARIANTE (4 nov 2026, Richard grabando el video). Todos los países.

- **Qué se veía:** al crear una cuenta con go+cliente6@windoce.com salía «An account with that email already exists. Sign in with your password.», aunque ese correo nunca se había usado. Richard probó con otros números y otras contraseñas y siempre salía lo mismo.
- **Causa real (no es un fallo):** C-IDENTIDAD-UNICA trata «nombre+algo@dominio» (y los puntos en Gmail) como el mismo buzón, para que nadie abra varias cuentas con un solo correo y repita los regalos de bienvenida. Ya existía go+cliente1@windoce.com. Lo que estaba mal era el mensaje.
- **Arreglo:** en `cuentas.post('/registro')`, si el correo es exactamente el mismo, el mensaje sigue igual; si es el mismo buzón escrito de otra forma, dice «Ya hay una cuenta con este mismo correo escrito de otra forma (por ejemplo, con un «+» o con puntos)…», en los dos idiomas.
- **Prueba (comprobada en rojo):** apps/servidor/src/rutas/correoObligatorio.test.ts, «el correo repetido se explica».
- **C-CORREO-EQUIPO (mismo día):** en el dominio propio (windoce.com, `DOMINIOS_EQUIPO` en packages/compartido/src/identidadUnica.ts) el «+algo» NO se quita: cada go+clienteN@windoce.com es una cuenta de prueba distinta del equipo. En los demás dominios la regla sigue igual. Prueba en rojo: packages/compartido/src/identidadUnica.test.ts, «correos de prueba del equipo».
- **Qué NO tocar:** la regla de identidad única sigue igual para todos los demás dominios.

## C-CARRITO-INVITADO (4 nov 2026, Richard grabando el video para Apple). Todos los países.

- **Qué se rompía y cómo se veía:** sin cuenta, el carrito quedaba guardado en el teléfono: al cerrar y abrir la app salía «Tienes $18.00 en tu carrito sin pagar», y como el carrito es de la cuenta (C-MIRAR-SIN-CUENTA) no se podía vaciar sin entrar. Para grabar de nuevo había que borrar y reinstalar la app. Además, al crear la cuenta desde el carrito se perdían los platos elegidos: la llave del carrito cambiaba de «anonimo» a la cuenta y se leía el carrito vacío de la cuenta nueva.
- **Arreglo:** apps/cliente/src/carritoGuardado.ts (`llaveCarrito`, `carritoAlEntrar`, `LLAVE_CARRITO_INVITADO`) y apps/cliente/src/carrito.tsx. Sin cuenta no hay llave: el carrito vive en memoria y, al abrir, se borra lo que quedó guardado como invitado. Al entrar o crear la cuenta, lo elegido sin cuenta pasa a la cuenta. Con cuenta se guarda como siempre; al cerrar sesión queda guardado en la cuenta y la pantalla arranca vacía.
- **Prueba (comprobada en rojo el 4 nov):** apps/servidor/src/carritoInvitado.test.ts.
- **Qué NO tocar:** no volver a guardar el carrito del invitado en el teléfono.

## C-ENLACES-TIENDAS (4 nov 2026, Richard con capturas de Google Play en Android). Todos los países.

- **Qué pasaba:** las tres apps ya estaban publicadas en Google Play (fichas abiertas, comprobadas ese día), pero al buscar «Divoox» Google sugería «iVoox» y no las mostraba: el buscador tarda días en poner en la búsqueda una app nueva. Los que iban a probar no las encontraban. La web decía «Muy pronto en App Store y Google Play», sin enlaces.
- **Arreglo:** `GOOGLE_PLAY` (packages/compartido/src/enlacesTiendas.ts, una sola lista) y `BotonGooglePlay` (apps/panel/src/sitio/Tiendas.tsx). Los enlaces están en la cabecera («Get the app», en el celular solo el logo), la portada, cada sección (clientes, restaurantes, repartidores), el pie (las tres apps) y la invitación del conductor. Se abren en pestaña nueva con `rel="noopener noreferrer"`. El App Store no se muestra hasta que Apple apruebe (solo lo terminado).
- **Prueba (comprobada en rojo el 4 nov):** apps/panel/src/sitio/enlacesTiendas.test.tsx.
- **Qué NO tocar:** ningún enlace a una tienda escrito a mano; todos salen de `GOOGLE_PLAY`.

## C-BORRAR-DESDE-SUPERADMIN (4 nov 2026, Gerencia con autorización de Richard). Todos los países.

- **Qué faltaba:** una cuenta creada con un correo equivocado (go+cliente2@gmail.com, del video para Apple) solo se podía borrar entrando con ella: el único camino era DELETE /datos/cuentas/yo, con su sesión. Soporte no tenía cómo, y borrar a mano en la base está prohibido.
- **Arreglo:** el borrado vive en UNA pieza, `borrarCuenta` (apps/servidor/src/borrarCuenta.ts), que usan la app (`cuentas.delete('/yo')`) y el superadmin (`POST /datos/admin/usuarios/:id/borrar`, solo admin, pide `confirmar: BORRAR|DELETE` y un motivo). Deja en `auditoria_admin` quién la borró y cuándo (`accion = 'cuenta_borrada'`, con el rol, la fecha de alta, el motivo y el correo recortado). No borra las cuentas de revisión de las tiendas (revisor.*@windoce.com) ni una con un pedido en curso (409). En el panel, ficha del cliente o del repartidor: los tres puntos → «Borrar la cuenta», escribir BORRAR y el motivo (apps/panel/src/panel/SuperFichas.tsx).
- **Prueba (comprobada en rojo el 4 nov, 5 de 5):** apps/servidor/src/rutas/borrarCuentaAdmin.test.ts.
- **Qué NO tocar:** nadie más escribe las instrucciones del borrado; toda forma nueva de borrar una cuenta llama a `borrarCuenta`.

## C-MIRAR-SIN-CUENTA (4 nov 2026, Gerencia con el dictamen previo del auditor de tiendas, Apple 5.1.1 v). Todos los países.

- **Qué estaba mal:** la app del cliente no dejaba ver ni un restaurante sin cuenta (`ConSesion` envolvía toda la app en apps/cliente/src/app/_layout.tsx), y con C-CORREO-OBLIGATORIO tampoco sin confirmar el correo. Apple 5.1.1(v): «If your app doesn't include significant account-based features, let people use it without a login». Mirar restaurantes y menús no las tiene; DoorDash deja mirar sin cuenta.
- **Arreglo:** el armazón ya no exige sesión. Se ven sin cuenta la portada, la lista y la ficha de restaurantes y tiendas, la búsqueda y los servicios. Cada pantalla de la cuenta se exporta con `conCuenta(...)` (apps/cliente/src/ConCuenta.tsx): carrito y pago, pedidos y seguimiento, Mi cuenta, avisos, favoritos, tarjetas de regalo, invitar, Plus, paquetes, empresas, pedido en grupo y viajes. Ahí mismo pide entrar (con «Seguir mirando sin cuenta») y el correo confirmado (`PuertaCorreo`). La portada sin cuenta muestra «Sign in to order» con «Sign in» y «New here? Create your account» (apps/cliente/src/inicio/EntrarInvitado.tsx → /sign-in, que al entrar vuelve atrás a la portada sin apilar otra). Con sesión sin confirmar el correo, la portada muestra `AvisoCorreo` (no bloquea) y lo pone en verde al confirmarse. El corazón de favoritos y «pedido en grupo» sin cuenta llevan a /sign-in. Una sesión guardada que no se pudo confirmar sigue mostrando «No pudimos confirmar tu sesión» en la portada (C-SESION-CON-LIMITE).
- **Prueba (comprobada en rojo el 4 nov):** apps/servidor/src/cuentaEnLaApp.test.ts, «sin cuenta se mira; la cuenta y el correo confirmado se piden al ir a pagar». De punta a punta: e2e/recorrido/correoObligatorio.spec.ts (portada sin cuenta, crear la cuenta, aviso en la portada, puerta en el carrito, verificado, borrar).
- **Qué NO tocar:** no volver a poner `ConSesion` en el armazón del cliente; una pantalla nueva que sea de la cuenta se exporta con `conCuenta`.

## C-CORREO-OBLIGATORIO y C-BORRAR-EN-LA-APP (4 nov 2026, Richard grabando el video para Apple). Todos los países.

- **Qué se rompía y cómo se veía:** en el video para Apple, Richard creó la cuenta y la app lo dejó entrar de una, sin confirmar el correo (el enlace iba a una dirección mal escrita y nunca llegó). Después, «Delete my account» de los tres puntos de «My account» abría la página web (`/delete-account`) en una hoja del navegador: lo sacaba de la app y no se veía el borrado.
- **Arreglo, correo:** `GET /datos/cuentas/perfil` devuelve `debeConfirmarCorreo` (apps/servidor/src/rutas/cuentas.ts, `debeConfirmarCorreo`). Desde C-MIRAR-SIN-CUENTA la puerta está en las pantallas de la cuenta (carrito y pago, etc., con `conCuenta`, que pasa `exigeCorreo` a `ConSesion`) y `PuertaCorreo` (packages/movil/src/VerificarCorreo.tsx) muestra «Confirma tu correo» con la dirección, «Ya lo confirmé», «Mandar el enlace otra vez», «¿Correo equivocado? Cámbialo» (con contraseña, borrador sin la contraseña), «Cerrar sesión» y «Borrar esta cuenta» (una cuenta sin confirmar también se puede borrar, Apple 5.1.1 v). Mira sola cada 4 s y al volver a la app; al confirmar dice «Tu correo quedó verificado» y entra con «Continuar». `POST /datos/cuentas/confirmar` devuelve el `rol`, y la página del enlace (apps/panel/src/panel/Confirmar.tsx) le ofrece a un cliente «Abrir la app de Divoox» (`tumbite-cliente://`). Una cuenta ya confirmada no ve nada.
- **Excepción de las pruebas:** fuera de producción, las cuentas de dominios que no existen (las del recorrido, `esCorreoDePrueba`) no pasan por la puerta, salvo las que empiezan por `verificar.` (las que prueban la puerta). En producción pasan todas. Las cuentas de revisión de las tiendas (revisor.*@windoce.com) ya tienen el correo confirmado (comprobado en producción el 4 nov).
- **Arreglo, borrado:** `ConfirmarBorrado` (packages/movil/src/OpcionesCuenta.tsx) es la única ventanita de borrar en las tres apps: escribir DELETE / BORRAR, «Borrar mi cuenta», aviso «Tu cuenta quedó borrada» y «Entendido» vuelve a entrar. El menú de tres puntos (`MenuCuenta`, packages/movil/src/BorrarCuenta.tsx) la abre aquí mismo, sin la web.
- **Pruebas (comprobadas en rojo el 4 nov, 7 de 7):** apps/servidor/src/rutas/correoObligatorio.test.ts, apps/servidor/src/cuentaEnLaApp.test.ts, apps/panel/src/panel/Confirmar.test.tsx («a una cuenta de cliente le ofrece volver a la app»). De punta a punta: e2e/recorrido/correoObligatorio.spec.ts (crear la cuenta, puerta, verificado, borrar en la app; saca las capturas de Docs).
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/rutas/correoObligatorio.test.ts apps/servidor/src/cuentaEnLaApp.test.ts apps/panel/src/panel/Confirmar.test.tsx` y `npx playwright test -c playwright.recorrido.config.ts e2e/recorrido/correoObligatorio.spec.ts`. En el teléfono: crear una cuenta con un correo real, ver «Confirma tu correo», tocar el enlace, «Abrir la app de Divoox», ver «Tu correo quedó verificado».
- **Entrega del correo (comprobada el 4 nov):** la confirmación que salió de producción el 3 nov a un buzón de windoce.com llegó a la bandeja de entrada con `dkim=pass` (d=divoox.com, s=cf-bounce), `spf=pass` (el remitente del sobre es cf-bounce.divoox.com, que tiene su SPF) y `dmarc=pass`. El DMARC pasa por alineación con cf-bounce. Desde la tarde del 4 nov divoox.com también recibe, por Email Routing (C-CORREO-RESPONDER-A).
- **Qué NO tocar:** no volver a abrir `/delete-account` desde la app; no quitar `exigeCorreo` de `conCuenta`; la excepción de pruebas nunca vale en producción.

## C-PROMO-DIA-LOCAL (BRF-2, 2 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** al crear una promoción nueva (panel del restaurante y app del restaurante), las fechas que vienen puestas («Empieza» y «Termina») salían con un día de más por la noche: en Miami, después de las 7 u 8 de la noche, «Empieza» ya decía mañana, y la promoción no arrancaba hoy si el dueño no lo notaba.
- **Causa real:** `hoy()` y `enUnMes()` se calculaban con `new Date().toISOString().slice(0, 10)`, que da el día de Londres (UTC), no el de quien está mirando.
- **Arreglo:** pieza única `diaDeHoyLocal(ms, zona?)` en `packages/compartido/src/horarios.ts` (día AAAA-MM-DD en la zona del celular o la computadora, con `fechaLocal`; si el aparato no dice su zona, UTC). La usan `apps/panel/src/panel/Promociones.tsx` y `apps/restaurante/src/Promociones.tsx`.
- **Commit:** fc543e102.
- **Prueba (comprobada en rojo el 2 nov, revirtiendo el arreglo en una copia aparte):** `packages/compartido/src/horarios.test.ts`, «BRF-2: el día de hoy en la hora de quien lo ve» (01:30 UTC del 3 nov es todavía 2 nov en Nueva York).
- **Cómo se comprueba:** `npx vitest run packages/compartido/src/horarios.test.ts`. En pantalla: abrir «Nueva promoción» de noche en Miami; «Empieza» dice el día de hoy.
- **Qué NO tocar:** nunca volver a `toISOString().slice(0, 10)` para un día que ve una persona; toda fecha de calendario de pantalla pasa por `diaDeHoyLocal` o `fechaLocal`.

## C-PROMO-USOS-PAGADOS (BRF-3, 2 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** en «Promociones» del restaurante, la columna de usos contaba también pedidos que el cliente nunca pagó (estado `pago_pendiente`): el restaurante veía «1 uso» de una promoción sin que hubiera entrado ninguna venta.
- **Causa real:** `resumenPromociones` (apps/servidor/src/promociones.ts) usaba la misma cuenta `USOS` del tope (todo lo que no está cancelado) para mostrar los usos.
- **Arreglo:** dos cuentas. `USOS` (no cancelados, incluye los que esperan el pago) sigue mandando para el tope y para «disponible», así dos clientes no se llevan el último uso; `USOS_PAGADOS` (sin `cancelado` ni `pago_pendiente`) es la que ve el restaurante. Si el pago no llega, el pedido abandonado se cancela solo y libera el uso (C-ABANDONADOS).
- **Commit:** 3077e4418.
- **Prueba (comprobada en rojo el 2 nov, revirtiendo el arreglo en una copia aparte):** `apps/servidor/src/promocionesRestaurante.test.ts`, «BRF-3: un pedido sin pagar no aparece como uso…» (pedido con descuento sin pagar → `usos: 0`).
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/promocionesRestaurante.test.ts`.
- **Qué NO tocar:** el tope de usos sigue contando los `pago_pendiente`; no unificar las dos cuentas.

## C-PRUEBA-SIN-CODIGO (BRF-4, 2 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** en la app del restaurante, el pedido de prueba (C-PEDIDO-PRUEBA) marcado «listo» decía debajo de «Listo para recoger» la ayuda del código QR («muestra el código al repartidor»), aunque el de prueba no tiene QR ni repartidor.
- **Causa real:** en `apps/restaurante/src/Inicio.tsx` la línea de ayuda solo miraba `p.entrega !== 'recoger'`, no `p.prueba` (el QR de debajo ya lo miraba desde BRE-R).
- **Arreglo:** la condición es `p.entrega !== 'recoger' && !p.prueba`.
- **Commit:** 5e2706d7e.
- **Prueba (agregada el 2 nov, comprobada en rojo revirtiendo el arreglo en una copia aparte):** `apps/servidor/src/restauranteInicioBrf4.test.ts`, «BRF-4…» (mira el código de la app: la ayuda del QR exige `!p.prueba`).
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/restauranteInicioBrf4.test.ts`. En pantalla: «Enviar un pedido de prueba», aceptarlo, marcarlo listo: solo sale «Así se ve un pedido listo…» y «Terminar la prueba».
- **Qué NO tocar:** todo lo de recogida (QR, foto de recogida, repartidor) se apaga con `p.prueba`; no se le agrega un código de mentira al de prueba.

## C-INICIO-COLUMNAS (BRF-4b, 2 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** en el celular (y en la app web del restaurante a ancho de celular), con un pedido en cocina, el título «En cocina y por salir» se dibujaba encima de las tarjetas del inicio («Cocina ocupada» y los contadores).
- **Causa real:** las dos columnas del inicio (`columnaNuevos` y `columnaCocina`) llevaban `flex: 1` siempre. En la tableta van lado a lado y está bien; en el celular van una debajo de otra dentro del scroll, y en la web `flex: 1` les aplasta la altura y se enciman.
- **Arreglo:** `const columna = ancha ? { flex: 1 } : null;` (ancha = 768 px o más) y las dos columnas usan `style={columna}`.
- **Commit:** 531f4c61a.
- **Pruebas (comprobadas en rojo el 2 nov):** `apps/servidor/src/restauranteInicioBrf4.test.ts`, «BRF-4b…» (agregada el 2 nov; con `flex: 1` fijo falla), y en el recorrido del sitio de pruebas (`e2e/recorrido/recorrido.spec.ts`) el título de la cocina tiene que quedar DEBAJO de «Cocina ocupada»; captura `restapp-inicio-cocina-es/en`.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/restauranteInicioBrf4.test.ts` y `npm run recorrido`.
- **Qué NO tocar:** no volver a poner `flex: 1` fijo en columnas que en el celular van apiladas dentro de un ScrollView.

## C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026). Todos los países (Tiendas apagado en producción).

- **Qué faltaba y cómo se veía:** los productos por peso se cobraban al peso estimado (`peso_promedio`); si pesaban más, la tienda no podía cobrarlo y la diferencia solo se devolvía. La tienda no tenía dónde escribir el peso.
- **Qué se hizo (como Instacart y DoorDash, ficha `docs/investigaciones-rea/2026-11-02-tiendas-peso-real.md`):**
  - `packages/compartido/src/pesables.ts`: `margenPesables` (15 % de los pesables × max(1, total/subtotal), hacia arriba), `aplicarPesoReal` (importe = precio por peso × peso real, repartido por unidad con redondeo a favor del cliente; tope por línea = estimado × 1,15; siempre parte del estimado original), `textoPesoReal` es/en.
  - `lineasDeTienda` congela en cada línea pesable `precioPorPeso` y `pesoEstimado`.
  - Al pedir (`rutas/pedidos.ts`): fila en `autorizaciones_pedido` (autorizado, margen) y el PaymentIntent por `autorizado`; la respuesta trae `autorizado`. El aviso `amount_capturable_updated` compara con lo autorizado (COALESCE con el total si no hay fila). El cambio de dirección manda total nuevo + margen a Stripe y actualiza `autorizado`.
  - `rutas/tiendasPeso.ts`: `POST /datos/restaurante/pedidos/:id/pesos` (solo tiendas, solo `pagado`/`aceptado`, no con un faltante pendiente). Recalcula con `recalcularLineas` (pieza sacada de `calcularSinPlato`) con techo = autorizado y guarda con `sentenciasRecalculo` (la misma de «falta un producto»).
  - Pantallas: retención en el carrito del cliente, «Peso estimado → peso real» en el recibo, campo «Peso real» + «Guardar peso» en el panel (`Pedidos.tsx`) y en la app del restaurante (`PesoReal.tsx`). Guía de Docs `weighted-items` es/en con capturas reales del recorrido.
- **Commit:** el de SIG-3 (ver `git log --grep SIG-3`).
- **Pruebas (comprobadas en rojo el 2 nov):** `pesables.test.ts`, `rutas/tiendasPeso.test.ts`, `panel/PedidosPeso.test.tsx`, `pesoRealApps.test.ts` fallan sin el código; con el PaymentIntent por el total sin margen, el circuito falla; sin el tope, fallan tope y circuito. Recorrido: `e2e/recorrido/tiendas.spec.ts`.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/rutas/tiendasPeso.test.ts packages/compartido/src/pesables.test.ts` y `npm run recorrido` (tiendas). Estado del circuito real en VERIFICAR-PAGOS.md (en rojo hasta la compra con la 4242 en staging).
- **Qué NO tocar:** nunca capturar más que `autorizaciones_pedido.autorizado`; el techo del recálculo es lo autorizado (lo que sobre lo absorbe Divoox, nunca el cliente); no quitar el margen del PaymentIntent ni del aviso de Stripe (si no cuadran, el pedido no pasa a pagado).
- **Arreglos de la revisión (SIG-3x, 2 nov 2026), cada uno con su prueba en rojo en `rutas/tiendasPeso.test.ts` («arreglos de la revisión»):**
  1. **El reemplazo heredaba el peso.** `calcularSinPlato` copiaba `pesable`, `precioPorPeso`, `pesoEstimado`, `pesoReal`, `precioEstimadoCentavos` y `unidadPeso` del producto que faltaba: unas papas se pesaban y cobraban por kilo como bananas. Ahora el reemplazo los quita (`CAMPOS_PESO` en `rutas/pedidos.ts`) y pesarlo responde 422.
  2. **El cambio de dirección movía lo autorizado sin Stripe.** `autorizado = total nuevo + margen` se escribía aunque Stripe no se hubiera tocado (mismo total). Ahora solo se actualiza si Stripe aceptó el monto nuevo (`stripeActualizado`): lo autorizado en la base es siempre lo que Stripe tiene retenido. No afectaba a Comida (sin pesables no hay fila en `autorizaciones_pedido`) y Tiendas está apagado en producción.
  3. **El mismo producto en dos líneas.** `POST …/pesos` acepta `linea` (la posición); sin ella y con dos líneas iguales responde 409. El panel (`Pedidos.tsx`) y la app del restaurante (`Inicio.tsx`) mandan la posición y usan llaves por línea.
  - **Qué NO tocar:** no volver a actualizar `autorizaciones_pedido.autorizado` sin la confirmación de Stripe; el reemplazo nunca copia los campos de peso.

## C-CONTROL-DUAL (SIG-4, 2 nov 2026). Todos los países.

- **Qué faltaba:** una sola persona del equipo podía devolver un pedido, reembolsar una recarga, ajustar la billetera de una empresa de Flex, fondear un punto de venta o confirmar a mano un cobro, por cualquier monto. PENDIENTES.md lo pedía «obligatorio antes de encender pasajeros».
- **Referencia:** el control dual («maker-checker») de los bancos y la separación de funciones de la ley SOX [DOC]; lo interno de DoorDash y Uber es [NV]. El umbral inicial (unos 100 dólares por moneda: USD 10000, MXN 200000, COP 400000, VES 4000000 en unidad menor) es [INF] y lo cambia una cuenta Total.
- **Qué se hizo:**
  - `apps/servidor/src/finanzas/controlDual.ts`: `hacerOPedirAprobacion` (lo llaman las cinco rutas: `POST /admin/pedidos/:id/devolver`, `/admin/finanzas/recargas/:rid/reembolsar`, `/admin/finanzas/empresas/:eid/ajuste`, `/admin/puntos-venta/:id/fondo`, `/admin/liquidaciones/:id/confirmar`). Bajo el umbral ejecuta y responde 200; por encima (`>` estricto, en valor absoluto) guarda en `aprobaciones_dinero` y responde 202 con `pendiente`, `aprobadores` y el aviso en palabras. El mismo pedido dos veces no se duplica.
  - `ejecutarDual`: la ÚNICA forma de hacer cada movimiento (la usan la ruta y la aprobación). Importa las piezas de dinero al usarse para no entrar en el ciclo de importaciones (`internacional/paises.ts` se rompe si no).
  - Bandeja `GET /admin/aprobaciones-dinero`, `POST …/:id/aprobar` (contraseña; perfil Total o Finanzas; nunca quien lo pidió; se reclama con `UPDATE … WHERE estado='pendiente'` para no ejecutar dos veces; si falla queda `fallida` con el motivo), `POST …/:id/rechazar` (con motivo; quien lo pidió puede retirarlo), `PUT …/umbrales` (solo Total; config `control_dual_umbrales`; un valor dañado vuelve a los iniciales y queda en el registro de errores).
  - La base frena que quien pidió sea quien aprueba (CHECK en `aprobaciones_dinero`). La familia `aprobaciones-dinero` está en Soporte y Finanzas de `perfilesInternos.ts`; todo queda en `acciones_equipo`.
  - Panel: `SuperAprobaciones.tsx` («Para aprobar» en el menú del superadmin): explica en pantalla si tu perfil no aprueba o si no hay otra cuenta Total/Finanzas. `textoPendiente` muestra el aviso 202 en SuperPedido, SuperFinanzas y ControlDinero. Guía de Docs `trust/two-person-approval` es/en con captura real (`scripts/docs/capturas-doble-firma.mjs`).
- **Commit:** el de SIG-4 (ver `git log --grep SIG-4`).
- **Pruebas (comprobadas en rojo el 2 nov):** `apps/servidor/src/finanzas/controlDual.test.ts` (con `pasaUmbral` devolviendo siempre falso fallan 6 de 7) y `apps/panel/src/panel/SuperAprobaciones.test.tsx`. Cobertura de `finanzas/controlDual.ts` exigida al 90 % en `vitest.config.mts`. La conciliación sigue en `ok` después de aprobar.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/finanzas/controlDual.test.ts apps/panel/src/panel/SuperAprobaciones.test.tsx`.
- **Qué NO tocar:** ninguna ruta de dinero a mano llama directo a `devolverParcial`, `reembolsarRecarga`, `ajusteManual`, `fondearPunto` o `confirmarLiquidacion`: siempre por `hacerOPedirAprobacion`. No quitar el reclamo atómico ni el CHECK de la tabla.

## C-FOTOS-SIN-METADATOS (SIG-6, 2 nov 2026). Todos los países.

- **Qué faltaba:** las fotos se guardaban tal como las mandaba el celular, con la ubicación exacta (GPS), el modelo del teléfono, la hora y a veces el nombre del dueño dentro (EXIF y XMP). Las fotos de platos son públicas: cualquiera podía sacar de ahí dónde estaba el teléfono.
- **Referencia:** Cloudflare Images y las redes grandes quitan esos datos al publicar [DOC].
- **Qué se hizo:** `apps/servidor/src/fotoLimpia.ts`, una sola pieza. `guardarFoto(bucket, clave, bytes, tipo, op)` limpia y guarda; TODAS las subidas pasan por ahí (`rutas/fotos.ts`, `operacion.ts` (evidencias, ticket, chat), `viajes.ts`, `ajustesViaje.ts`, `tickets.ts` (capturas y quejas), `flex/conductor.ts`, `kyc.ts`, `servicios.ts`).
  - JPEG: fuera APP1 (EXIF/XMP), APP3–APP13, APP15 y comentarios; quedan JFIF, ICC (APP2) y Adobe (APP14); la orientación vuelve en un EXIF mínimo con SOLO ese dato (si no, las fotos se ven giradas). PNG: fuera eXIf, tEXt, zTXt, iTXt, tIME. WebP: fuera EXIF y XMP, marcas de VP8X apagadas y tamaño RIFF recalculado.
  - Sin nada que quitar, los bytes quedan idénticos. Un archivo cortado: lo que queda se copia si es imagen y se descarta si es un bloque oculto. Estructura rota (sin marcas JPEG) → 415 «La foto llegó dañada…».
  - El GPS que traía la foto se lee antes de quitarlo: en las evidencias de recogida/entrega y en las pruebas de Flex se guarda aparte en `fotos_gps` (clave, lat, lng).
  - Los documentos de identidad (`kyc/`) y de vehículos conservan el original (`conservarOriginal: 'evidencia'`): son la evidencia que se revisa y viven en carpetas privadas. HEIC y PDF pasan sin cambio (deuda vigilada: HEIC solo llega a capturas privadas de los casos de ayuda).
  - El tamaño máximo con mensaje claro ya estaba en cada ruta (3 MB fotos, 5 MB documentos, 10 MB capturas). Guía de Docs `pickup-and-delivery-photos` es/en con un párrafo nuevo.
- **Commit:** el de SIG-6 (ver `git log --grep SIG-6`).
- **Pruebas (comprobadas en rojo el 2 nov):** `apps/servidor/src/fotoLimpia.test.ts` arma JPEG, PNG y WebP con un EXIF que trae GPS de Miami y el modelo «PixelFone»; guardando sin limpiar fallan 3 de 5 (la foto pública del plato y la de entrega salen con los datos). Cobertura exigida al 90 % de líneas en `vitest.config.mts`.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/fotoLimpia.test.ts`.
- **Qué NO tocar:** ninguna ruta llama `BUCKET.put` directo con una foto (salvo `respaldo.ts`, que guarda JSON). No quitar el EXIF mínimo de orientación.

## C-VERSION-VISIBLE (SIG-7, 3 nov 2026). Todos los países.

- **Qué faltaba:** soporte no podía preguntar «¿qué versión tienes?»: en la app del cliente y en Divoox Driver la versión solo salía escondida en los tres puntos de la cuenta y en ninguna app se veía la compilación de la tienda (en la del restaurante salía sin compilación).
- **Referencia:** Uber y DoorDash muestran versión y compilación en Ajustes → Acerca de [OBS].
- **Qué se hizo:** `packages/movil/src/version.tsx` (antes `.ts`): `COMPILACION_APP` sale de `expo-application` (`nativeBuildVersion`: buildNumber de iOS, versionCode de Android; EAS lo pone al compilar con `appVersionSource: remote`, por eso no sirve app.json) y `VersionInstalada` pinta «Versión 1.0.1 (compilación 10) · a74309f» / «Version 1.0.1 (build 10) · a74309f», en gris y seleccionable. Va a la vista al final de Mi cuenta del cliente (`apps/cliente/src/app/account.tsx`), del Perfil de Driver (`apps/repartidor/src/Inicio.tsx`) y de Más del restaurante (`apps/restaurante/src/Mas.tsx`). `textoVersion` (compartido) dice «compilación N» / «build N». `expo-application` instalado en las tres apps (módulo nativo: entra en la próxima compilación de EAS). La web y el panel ya la mostraban (C-VERSION-DEL-ARTEFACTO: pie del sitio y menú de la cuenta del panel, con el commit del servidor). Guía de Docs `support` es/en: dónde se ve la versión.
- **Pruebas (comprobadas en rojo el 3 nov):** `packages/compartido/src/version.test.ts` (texto con la compilación en los dos idiomas) y `apps/servidor/src/versionVisibleApps.test.ts` (la pieza lee `nativeBuildVersion` y las tres pantallas la usan).
- **Cómo se comprueba:** en el teléfono, al final de Mi cuenta / Perfil / Más tiene que verse la versión con su compilación; en la web (sin compilación) sale «Versión 0.1.0 · <commit>».
- **Qué NO tocar:** no leer la compilación de app.json (con versiones remotas está vacía); no esconderla otra vez en un menú.

## C-SERVICIOS-RECORRIDO-LOCAL (SIG-8, 3 nov 2026). Todos los países.

- **Qué se rompía y cómo se veía:** en el recorrido local, «Carro: código sin casco» falló una vez (REP-T1, 2 nov) con «Este servicio todavía no está disponible en tu ciudad» al cotizar, y no se repetía sola.
- **Causa real (reproducida):** en la computadora (localhost) el servidor solo declaraba Comida. El servidor local del recorrido corre el código fuente (`main: ../apps/servidor/src/index.ts`) y wrangler lo recarga cuando cambia un archivo (otra sesión editando el servidor durante la corrida); cada arranque nuevo corre la migración y `sincronizarServicios` suspendía Carro y lo borraba de `servicios_implementados` justo después de que la prueba lo encendiera. Reproducido: con recargas forzadas cada 3 s, 1 de 10 corridas falla con ese mensaje; con el arreglo, 10 de 10 pasan. Además la prueba borraba los requisitos de Carro y no los devolvía: una segunda corrida contra la misma base no podía encenderlo (`servicio_pasajeros_sin_requisitos_minimos`, 9 de 10 en rojo con `--repeat-each=10`).
- **Qué se hizo:** `entornoDeServicios` en `apps/servidor/src/esquema.ts` (lo usa `app.ts`): con `SERVICIOS_PRUEBA_LOCAL=1` (solo lo pone `scripts/recorrido/preparar.mjs`) el servidor LOCAL declara los mismos servicios en prueba que el sitio de pruebas; en un sitio publicado no cambia nada. `e2e/recorrido/carro.spec.ts` devuelve los requisitos de fábrica de Carro antes de encenderlo y al terminar.
- **Pruebas:** `apps/servidor/src/serviciosRecorridoLocal.test.ts` (rojo comprobado: con `entornoDeServicios` devolviendo el entorno tal cual, falla «un arranque nuevo no apaga Carro»; en producción la variable no enciende nada). En el recorrido: `npx playwright test -c playwright.recorrido.config.ts e2e/recorrido/carro.spec.ts --repeat-each=10`, 10 de 10.
- **Qué NO tocar:** no hacer que `SERVICIOS_PRUEBA_LOCAL` valga fuera de localhost; si una prueba borra datos de fábrica para simplificar, los devuelve.

## C-CONTROL-DUAL · arreglos de la revisión (SIG-4x, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor de calidad):** (1) fraccionar saltaba el control: 20 ajustes de 99,99 de la misma persona pasaban todos sin segunda firma (casi 2.000 dólares); (2) una sola cuenta Total subía el límite, movía 50.000 dólares sola y lo bajaba otra vez; el recorrido internacional también subía el límite, una configuración compartida del sitio de pruebas; (3) «excedente devuelto» de la bandeja de casos escribía en el libro del repartidor con una sola firma.
- **Qué se hizo:** `apps/servidor/src/finanzas/controlDual.ts`: (1) lo movido a mano SIN segunda firma queda en la tabla `dinero_manual`; antes de ejecutar se suma lo de esa persona en esa moneda en 24 h y lo del mismo objeto (de cualquiera); si con este monto se pasa el límite, va a «Para aprobar» (límite acumulado de los bancos [DOC]); lo aprobado con dos firmas no suma. (2) `PUT /admin/aprobaciones-dinero/umbrales`: bajar es inmediato; SUBIR queda pendiente (tipo `umbral`) y lo aprueba OTRA cuenta Total (Finanzas no; nunca quien lo pidió); mientras tanto sigue el límite de antes. (3) `POST /admin/bandeja-dinero/:clave/acciones` con `excedente_devuelto` pasa por `hacerOPedirAprobacion` (monto = lo que falta devolver); `ejecutarDual` llama a `accionCaso`. `aprobaciones_dinero` acepta los tipos nuevos: en producción la tabla vieja se rehace una vez sin perder filas (`apps/servidor/src/esquemaDinero.ts`, desde `migrar`). El recorrido internacional ya no sube el límite: una segunda cuenta del equipo de la corrida aprueba el fondo. Panel: nombres de los tipos nuevos y aviso de «subir el límite» es/en.
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/finanzas/controlDualRevision.test.ts` (fraccionar, mismo objeto con dos personas, 24 h, subir el límite con otra Total, Finanzas no aprueba límites, excedente devuelto con dos firmas, tabla vieja rehecha: sin `rehacerAprobacionesDinero` falla) y `SuperAprobaciones.test.tsx`. Cobertura al 90 % en `controlDual.ts` y `esquemaDinero.ts`.
- **Qué NO tocar:** no ejecutar un movimiento manual sin anotarlo en `dinero_manual`; no aplicar una subida de límite sin la segunda firma; las pruebas no cambian configuraciones compartidas del sitio de pruebas.

## C-FOTOS-SIN-METADATOS · arreglos de la revisión (SIG-6x, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor):** (1) al llegar al primer escaneo (SOS) del JPEG se copiaba TODO el resto del archivo sin mirarlo: lo pegado después de la primera imagen (la segunda imagen MPF de iPhone y Samsung, el video de las fotos en movimiento de Pixel) pasaba con su EXIF, el modelo del teléfono y su GPS; (2) la foto del paquete al recogerlo en Envíos (`/conductor/operaciones/:id/foto-paquete`) perdía el GPS que traía.
- **Qué se hizo:** `limpiarJpeg` (`apps/servidor/src/fotoLimpia.ts`) recorre cada escaneo hasta el siguiente marcador de verdad (0xFF00 son datos; RST0–RST7 y el relleno 0xFFFF siguen dentro), así los marcadores entre escaneos de un JPEG progresivo pasan por la misma limpieza, y CORTA en el fin de la imagen (EOI): lo que venga detrás no se guarda. `rutas/viajes.ts` guarda el GPS de la foto del paquete en `fotos_gps` con `anotarGpsFoto`. Las fotos de prueba con GPS viven en `apps/servidor/src/pruebas/fotoConGps.ts`.
- **Pruebas (comprobadas en rojo el 3 nov):** `fotoLimpia.test.ts` (segunda imagen pegada, video de foto en movimiento, JPEG progresivo con comentario entre escaneos) y `rutas/envios.test.ts` (GPS de la foto del paquete en `fotos_gps`). Las reproducciones del revisor (`sig6r.test.ts`) pasan.
- **Qué NO tocar:** no volver a copiar «el resto del archivo» después del SOS; HEIC sigue como deuda vigilada (solo capturas privadas de los casos de ayuda).

## C-CONTROL-DUAL · apartado atómico (SIG-4y, 3 nov 2026). Todos los países.

- **SIG-4y (3 nov 2026), lo devolvió el revisor sobre ae5d1ef74:** con varios ajustes a la vez, todos leían «cero acumulado» y pasaban sin segunda firma (11 de 20 en la prueba con lecturas cruzadas). Ahora la suma y el apartado son UNA sola orden: `apartarManual` (`controlDual.ts`) hace `INSERT … SELECT … WHERE suma_persona + monto <= límite AND suma_objeto + monto <= límite` (atómico en SQLite/D1) ANTES de mover el dinero; si el movimiento falla, el apartado se borra. Prueba en `controlDualRevision.test.ts` («veinte ajustes A LA VEZ», con una pausa en cada lectura para que las peticiones se crucen como en D1: en rojo con el código anterior, 11 pasaban) y «si el movimiento falla, lo apartado se devuelve». **Qué NO tocar:** no volver a leer la suma y anotar después en dos pasos.

## C-FOTOS-SIN-METADATOS · PNG y WebP (SIG-6y, 3 nov 2026). Todos los países.

- **Qué se rompía:** el mismo agujero de SIG-6x en los otros formatos: un PNG sin bloques ocultos se devolvía ORIGINAL aunque llevara algo pegado después de IEND, y un WebP se recorría hasta el final del archivo sin mirar su largo RIFF; una foto con otra imagen (con su EXIF y GPS) pegada detrás pasaba entera.
- **Qué se hizo (`apps/servidor/src/fotoLimpia.ts`):** `limpiarPng` corta en IEND y cuenta lo de detrás como quitado; `limpiarWebp` recorre solo hasta 8 + largo RIFF (un largo imposible vale como «hasta el final») y lo de detrás se corta; si se cortó algo, el largo RIFF se reescribe.
- **Pruebas (comprobadas en rojo el 3 nov):** `fotoLimpia.test.ts` («PNG: lo pegado después de IEND no pasa…», «WebP: lo pegado después del largo RIFF no pasa»). Las reproducciones del revisor (`sig6xr.test.ts`, `sig6xr2.test.ts`) pasan.
- **Qué NO tocar:** los tres formatos se cortan en el fin real de la imagen (EOI, IEND, largo RIFF), siempre.

## C-RECORRIDO-NO-PISA · pedidos de las pruebas internas (SIG-9, 3 nov 2026). Todos los países.

- **Qué se rompía:** en el sitio de pruebas, «recorrido completo de un pedido (en)» falló tres corridas seguidas (41574943163, 41576672796, 41581669386) en «Llegué al restaurante»: la app decía «You’re still 8286 m from the store».
- **Causa real:** la prueba interna de la Fase 3 (`/datos/interno/diagnostico/f3/*`, cuentas `zz-f3…@prueba.invalid`) deja un pedido «aceptado» sin repartidor en Miami (25.7, −80.2) cuando su corrida se corta antes de `f3/cerrar`; estaba el `zz-f3q-c8d234c01b1d` del 3 nov 03:04. El repartidor recién conectado del recorrido en inglés recibía ESA oferta (a 8,3 km de su restaurante) en vez de la suya. La limpieza del arranque solo cancelaba los pedidos de restaurantes `@recorrido.test`.
- **Qué se hizo:** `e2e/recorrido/recorrido.spec.ts` cancela al empezar también los pedidos sin repartidor de los restaurantes de prueba `@prueba.invalid`. Nunca toca pedidos de personas reales.
- **Cómo se comprueba:** la corrida de `pruebas-rama` tiene que pasar «recorrido completo de un pedido (en)».
- **Qué NO tocar:** la limpieza solo mira cuentas de prueba (`@recorrido.test`, `@prueba.invalid`).

## C-FOTOS-SIN-METADATOS · foto que no cuadra = 415 (SIG-6z, 3 nov 2026). Todos los países.

- **Qué se rompía:** un WebP con largo RIFF imposible (mayor que el archivo o menor que 4) se devolvía ORIGINAL con lo pegado detrás (con su GPS); un PNG sin IEND copiaba el resto como «bloque cortado»; un largo RIFF menor que sus bloques guardaba en silencio una imagen mordida.
- **Regla (`apps/servidor/src/fotoLimpia.ts`):** PNG y WebP se recorren bloque a bloque y su estructura TIENE que cuadrar; si no (bloque que se sale del archivo, PNG sin IEND, largo RIFF menor que 4, mayor que el archivo o menor que la suma de sus bloques, WebP sin bloques), la foto se RECHAZA con el 415 de «La foto llegó dañada». Nunca se devuelve el original ni se guarda mordida. Lo pegado después del fin real (IEND, largo RIFF, EOI) se corta. Las fotos sanas salen idénticas (el mismo objeto).
- **Pruebas (comprobadas en rojo el 3 nov):** `fotoLimpia.test.ts` («WebP con un largo RIFF imposible…», «PNG sin IEND da el 415…»); la sonda del revisor (`sig6yr.test.ts`, 18 casos) da 415 o la imagen cortada sin «PixelFone» en todos. Las fotos de prueba del servidor (`pruebas/ayuda.ts` y las pruebas de subidas) pasaron a ser archivos que cuadran.
- **Qué NO tocar:** no volver a «copiar lo que queda» de un archivo que no cuadra.

## C-ALTA-COBROS-DENTRO — alta de cobros dentro de Divoox (SIG-5, 3 nov 2026) — EE. UU.

- **Qué era:** el restaurante y el repartidor salían de Divoox a la página de Stripe para conectar su banco.
- **Cómo funciona ahora:**
  - `POST /datos/billetera/sesion` (apps/servidor/src/rutas/dinero.ts) crea la sesión de Stripe Connect (`/v1/account_sessions` con `account_onboarding` y `external_account_collection`) sobre la misma cuenta Express de siempre (`cuentaDeCobros`, una sola por persona).
  - El panel (`apps/panel/src/panel/AltaCobros.tsx`) muestra el componente con los colores de Divoox y lo carga solo cuando hace falta.
  - Driver abre «Beneficios» del panel dentro de la app, con el puente de sesión (`abrirPanel` a `/panel/earnings`). La app del restaurante ya lo hacía.
- **Respaldo:** sin llave publicable (respuesta 422) o si el componente no carga, se abre la página de Stripe (`/billetera/conectar`).
- **Política de seguridad:** permite `https://connect-js.stripe.com` en `script-src` y `frame-src` (apps/servidor/src/seguridad.ts y app.test.ts).
- **Paquetes:** `@stripe/connect-js` 3.4.6 y `@stripe/react-connect-js` 3.4.4, versiones fijas.
- **Pruebas:** apps/servidor/src/rutas/billeteraAlta.test.ts y apps/panel/src/panel/AltaCobros.test.tsx, las dos en rojo sin el arreglo.
- **No tocar:**
  - los datos bancarios nunca pasan por nuestro servidor;
  - no quitar el respaldo a la página de Stripe.
- **Lo que se rompió el 3 nov (SIG-5b, main sin publicar unas tres horas):**
  - Síntoma: el recorrido fallaba en «la cuenta del banco del repartidor quedó creada» (e2e/recorrido/recorrido.spec.ts).
  - Causa 1: el panel no tiene menú para el repartidor y caía en «solo para el equipo» antes de llegar a `/panel/earnings`.
  - Causa 2: en la web, `abrirPanel` (packages/movil/src/PaginaEnApp.tsx) se saltaba el puente de sesión.
  - Arreglo, en b06a4d008:
    - rama propia para el repartidor en `PanelApp.tsx`;
    - el puente también en la web;
    - el recorrido toca «Conectar mi cuenta bancaria» dentro de «Beneficios».
  - Prueba: la tercera de AltaCobros.test.tsx, en rojo sin el arreglo.

## C-DINERO-30-DIAS (NXT-1, 3 nov 2026). Todos los países.

- **Qué se rompía:** la pieza «dinero» de `/datos/salud` solo miraba la ÚLTIMA conciliación (`ORDER BY dia DESC LIMIT 1`). Un día que no cuadraba desaparecía del canario al día siguiente, aunque la diferencia siguiera ahí (pasó con la del 15 oct).
- **Qué se hizo:**
  - `apps/servidor/src/conciliacion.ts`: `diasSinCuadrar` (los días de los últimos `DIAS_VIGILADOS` = 30 con `cuadra = 0`, cada uno con su excepción) y `saludDinero` (sin conciliaciones = pendiente; algún día sin cuadrar y sin excepción = error; si no, ok). `app.ts` usa `saludDinero` en la pieza «dinero».
  - Tabla propia `conciliacion_excepciones` (schema.sql): motivo (10 letras o más), quién (`creado_por`, `creado_por_nombre`), cuándo, y las cifras que se excusaron (`pedidos`, `vendido`, `detalle`). La excepción solo vale para ESAS cifras: si el día se recalcula con otra diferencia, vuelve el rojo hasta excusarla aparte. Nunca se borra y la fila de `conciliaciones` no se toca.
  - `apps/servidor/src/rutas/excepcionesConciliacion.ts`: `GET /datos/admin/conciliacion/excepciones` (la bandeja) y `POST` con `{dia, motivo, clave}`: solo perfil Total o Finanzas, con su contraseña; un día que cuadra o ya excusado responde 409. La acción queda además en `acciones_equipo`. `GET /datos/admin/conciliacion` dice `excusado` por fila.
  - Panel: `ExcepcionesConciliacion.tsx` dentro del Control de dinero del superadmin, es/en, con borrador (la contraseña no se guarda) y lo escrito se queda si falla.
  - **La diferencia conocida del 15 oct de producción** (compra de prueba de 7,18 USD, autorizada por Richard el 16 oct, ver `docs/EVALUACION-BLOQUEO-CONCILIACION.md`) se excusa sola desde schema.sql, solo si las cifras son exactamente 1 pedido y 718 centavos. Sin eso, el canario de producción se habría puesto en rojo al publicar. Producción no tenía ningún otro día sin cuadrar (consulta de solo lectura del 3 nov).
  - Los 10 pedidos de prueba de Novi del 11 y 12 oct no tienen fila de conciliación (empezó el 13): no ponen el canario en rojo. Si alguien recalcula esos días, aparecen en la bandeja para excusarlos con motivo.
  - La conciliación de billeteras de Flex (`finanzas/reloj.ts`) no tenía el mismo hueco: revisa las invariantes de TODO el libro en cada vuelta, así que una diferencia vieja sigue saliendo.
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/conciliacionExcepciones.test.ts` (con la lógica vieja, «solo la última», fallan 3 de 5) y `apps/panel/src/panel/ExcepcionesConciliacion.test.tsx`. Cobertura exigida al 90 % para `conciliacion.ts` y `rutas/excepcionesConciliacion.ts` en `vitest.config.mts`.
- **Cómo se comprueba:** `npx vitest run apps/servidor/src/conciliacionExcepciones.test.ts apps/panel/src/panel/ExcepcionesConciliacion.test.tsx`; en vivo, `/datos/salud` → `dinero: ok` en los dos sitios.
- **Qué NO tocar:** no volver a mirar solo la última conciliación; no excusar sin motivo ni contraseña; no escribir ni borrar filas de `conciliaciones` para que el canario pase.

## C-SQL-LOCAL-OCUPADA (3 nov 2026). Todos los países.

- **Qué fallaba:** la verificación de main del 3 nov (corrida 41621404862) cayó por azar en `e2e/recorrido/envios.spec.ts`: la prueba lee la base local con `wrangler d1 execute --local` mientras el servidor de pruebas escribe en el mismo archivo SQLite. Con la base tomada, wrangler NO dice «locked»: responde «Failed to get session commit token: internal error» y sale con error. Cada prueba tenía su propia copia de la consulta, sin reintento (o con uno ciego) y tirando la salida de error.
- **Qué se hizo:** una sola pieza, `e2e/recorrido/sqlLocal.ts` (`sqlLocal` filas, `sqlLocalTexto` texto), usada por recorrido, envios, carro, recogerCompleto, calificacion, notaPlato, tiendas e internacional. Reintenta SOLO la base ocupada (`SQLITE_BUSY`, «database is locked», «session commit token») hasta 8 veces con espera creciente; cualquier otro error sale enseguida con su mensaje.
- **Comprobado en rojo el 3 nov:** con el archivo bloqueado a propósito (`BEGIN EXCLUSIVE` con sqlite3 por 3 s) la consulta fallaba al primer intento; con el patrón, espera y responde (2,6 s). Envios, calificacion y notaPlato pasan en local.
- **Qué NO tocar:** ninguna prueba vuelve a llamar a wrangler local por su cuenta; no ampliar el reintento a cualquier error (escondería fallos de verdad).

## C-REGISTRO-PAUSADO y C-OCR-SIN-CACHE (3 nov 2026). Todos los países.

- **C-REGISTRO-PAUSADO:** el registro admite 10 cuentas por minuto por dirección (C-INTENTOS) y en GitHub todas las pruebas salen de la misma. Las pruebas de dinero en staging (control dual y circuitos a domicilio, NXT-2 y NXT-3) creaban cuentas seguidas, llenaban la ventana y Plus y el recorrido recibían «Demasiados intentos» (corrida 41624360597). `e2e/recorrido/registroPausado.ts` deja como mucho 5 registros por minuto, reintenta un 429 a los 20 s, y al final de cada archivo espera a que la ventana quede libre. **No tocar:** no subir el límite del servidor para que pasen las pruebas.
- **C-OCR-SIN-CACHE:** `apps/verificador/src/ocr.ts` usaba `cachePath` en la carpeta del paquete del idioma: cada lector escribía `eng.traineddata` y los demás lo leían primero; dos archivos de prueba a la vez leían uno a medio escribir y Tesseract fallaba con «initialization failed» y la prueba se colgaba 180 s (misma corrida). Ahora `cacheMethod: 'none'`: cada lector lee el `.gz` del paquete y nunca escribe (comprobado: borrado el archivo de caché, las 31 pruebas pasan y no se vuelve a crear). **No tocar:** no volver a poner `cachePath`.

## C-FOTOS-HEIC-LIMPIAS (NXT-4, 3 nov 2026). Todos los países.

- **Qué faltaba:** el HEIC del iPhone (capturas de los casos de ayuda) pasaba tal cual por `limpiarFoto`, con su GPS, el modelo del teléfono y la hora. Era la deuda vigilada de C-FOTOS-SIN-METADATOS.
- **Referencia:** el formato HEIF (ISO/IEC 23008-12) guarda el EXIF y el XMP como «ítems» aparte de la imagen: la caja `iinf` dice qué ítems hay y `iloc` dónde están sus bytes [DOC]. Apple y las redes grandes quitan esos ítems al compartir [DOC].
- **Qué se hizo (`apps/servidor/src/fotoLimpia.ts`, `limpiarHeif`):** se recorren las cajas; los ítems `Exif`, `mime` (XMP) y `uri ` se ubican con `iloc` (versiones 0, 1 y 2; datos en `mdat` o en `idat`) y sus bytes se llenan de ceros en una COPIA. La estructura y el largo quedan iguales, la imagen y sus miniaturas no se tocan. El GPS se lee antes (como en los otros formatos). Todo lo que no cuadre se rechaza con el 415 `HEIC_SIN_LIMPIAR` («Mándala en JPG… Ajustes → Cámara → Formatos → Más compatible»): cajas que se salen del archivo, basura o un JPEG pegado detrás, sin `ftyp` o sin `meta`, dos `meta`, una secuencia con `moov`, `infe` de versión vieja, un ítem oculto con sus datos en otro archivo o sin su `iloc`. Además, `limpiarFoto` ya no deja pasar ninguna OTRA imagen tal cual (`image/gif` y demás: 415); un PDF de evidencia sigue igual.
- **Pruebas (comprobadas en rojo el 3 nov: con HEIC pasando igual fallan 4):** `apps/servidor/src/fotoLimpia.test.ts` (HEIC con Exif en `mdat` y en `idat`, HEIF, barrido de archivos raros y de cortes en cada punto: nunca sale «PixelFone»; GIF da 415) y `apps/servidor/src/rutas/adjuntos.test.ts` (la captura HEIC del caso queda en el almacén sin el modelo; una rota da el 415 que pide JPG). El HEIC de prueba vive en `apps/servidor/src/pruebas/fotoConGps.ts` (`heicConGps`).
- **Docs:** guía `support` (es/en): las HEIC también salen sin datos ocultos y qué hacer si una no se abre.
- **Qué NO tocar:** no volver a devolver el HEIC (ni ninguna imagen desconocida) sin limpiar; la limpieza trabaja sobre una copia, nunca sobre los bytes que llegaron.

## C-DESPACHO-CATALOGO (NXT-6, 3 nov 2026). Todos los países.

- **Qué faltaba:** el reparto de Comida (`repartirOfertas`) ofrecía pedidos a cualquier repartidor libre de la zona; el catálogo de habilitaciones (vehículo, papeles, activación, bloqueos) solo lo leían Moto y Carro. Era M6 en PENDIENTES y el límite que dejó G4b.
- **Referencia:** estudio E2 p.3 [DOC]: DoorDash y Uber activan al repartidor por vehículo, con licencia y seguro si va en carro, antes de ponerlo en línea. Ficha: `docs/investigaciones-rea/2026-11-03-despacho-comida-catalogo.md`.
- **Qué se hizo:** `apps/servidor/src/despachoCatalogo.ts`. `motivoServicio` usa `estadoDelConductor` (`rutas/servicios.ts`, ahora exportado: la misma regla que ve el conductor) más `conductor_bloqueos` y la preferencia. `repartirOfertas` (`rutas/operacion.ts`), solo en zonas con el interruptor encendido, filtra los candidatos EN ORDEN con `filtrarPorCatalogo` y para en cuanto junta los que necesita (1, o 20 en la oferta abierta), con memoria por vuelta. `POST /datos/repartidor/conectar` responde 409 `campo: 'servicios'` con el porqué (textos es/en en `mensajesEn.ts`). Interruptor por zona: tabla `despacho_catalogo_zonas` (schema.sql), `GET/PUT /datos/admin/despacho-catalogo[/:zona]` (solo admin, con auditoría; no se enciende donde Comida no está disponible), pieza `apps/panel/src/panel/DespachoCatalogo.tsx` en Superadmin → Verificaciones. Guía de Docs `food-activation` (repartidores, es/en, con capturas reales).
- **Apagado de fábrica:** sin fila = apagado; apagado, el reparto queda exactamente como antes. El repartidor de siempre, sin fila en `habilitaciones`, sigue habilitado para Comida (legado).
- **Pruebas (comprobadas en rojo el 3 nov: sin el filtro fallan 3 de 5):** `apps/servidor/src/despachoCatalogo.test.ts` y `apps/panel/src/panel/DespachoCatalogo.test.tsx`.
- **Qué NO tocar:** no encender el interruptor en producción sin la orden de Richard; no escribir otra regla de elegibilidad para Comida aparte de `estadoDelConductor`; Moto y Carro siguen con `conductores_elegibles`.

## C-FOTOS-HEIC-LIMPIAS · lista blanca (NXT-4x, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor):** lo pegado DENTRO de una caja sobrevivía: `free`/`skip` de arriba, un segundo `mdat`, los bytes de `mdat` que ningún ítem usa y un `mdat` de largo 0 (hasta el final) guardaban entero un JPEG con GPS, marca y modelo; dentro de `meta`, un `xml `, un `uuid` o un `free` pasaban sin mirar.
- **Regla nueva (`limpiarHeif`, `apps/servidor/src/fotoLimpia.ts`):** LISTA BLANCA. De todo el archivo solo quedan los bytes que usan los ítems de imagen; en una copia se llenan de ceros los ítems Exif/XMP/uri, el contenido de `free`/`skip`, todo lo de `mdat` e `idat` fuera de los tramos de imagen (también un segundo `mdat` o uno hasta el final), los nombres de los ítems (`infe`) y del `hdlr`. Solo se aceptan: arriba `ftyp`, `meta`, `mdat`, `free`, `skip`; en `meta` `hdlr`, `pitm`, `iinf`, `iloc`, `iref`, `iprp`, `idat`, `dinf`; en `iprp` `ipco` e `ipma`; en `ipco` las propiedades de imagen conocidas (hvcC, av1C, ispe, colr, pixi, irot, imir, clap, auxC, clli, mdcv, …). `pitm`, `iref`, `ipma`, `dinf` (solo «este archivo») e `iloc` tienen que medir justo lo que dicen sus números; cada tramo de un ítem tiene que caer dentro de un `mdat` o del `idat`. Todo lo demás da el 415 que pide JPG. El largo no cambia (los desplazamientos de `iloc` siguen valiendo); sin nada que borrar, sale el mismo objeto.
- **Comprobado con archivos reales (3 nov):** las sondas del revisor (iPhone real, sips, fondos de macOS, con free/skip/mdat extra/mdat 0/mdat agrandado/xml/uuid/free en meta): ninguna salida conserva GPS, marca, modelo ni texto pegado; las reales abren con ImageIO y con los MISMOS píxeles que el original.
- **Pruebas (cada candado comprobado en rojo el 3 nov, quitando una línea a la vez: filtro de arriba, control «oculto sin iloc», lista de meta, lista de ipco, borrar free, borrar la cola de mdat, borrar el nombre del hdlr):** `fotoLimpia.test.ts`, bloque «NXT-4x» (casos de (1) y (2), iloc v0 y v2, infe v3, iinf v1, Exif sin iloc). `heicConGps` acepta esas versiones y cajas de más (`apps/servidor/src/pruebas/fotoConGps.ts`).
- **Qué NO tocar:** no volver a «dejar pasar lo que no se reconoce»; si un HEIC real nuevo trae otra propiedad de imagen, se agrega a `HEIF_PROPIEDADES` con su prueba, nunca se abre la lista.

## C-DESPACHO-CATALOGO · arreglos de la revisión (NXT-6x, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor):** (1) el filtro iba DESPUÉS de decidir si se ampliaba la búsqueda: un repartidor no habilitado en la celda del restaurante cortaba la búsqueda en toda la zona y en los agrupables, y el pedido se quedaba sin oferta con habilitados libres en la zona; (2) el freno de `/repartidor/conectar` dejaba sin conectarse a quien no podía Comida aunque sí otro servicio (Envíos, Moto, o Comida apagada a propósito), y así perdía también esos servicios.
- **Qué se hizo:** `repartirOfertas` (`apps/servidor/src/rutas/operacion.ts`), con el interruptor de la zona encendido, filtra por catálogo EN CADA ETAPA (vecinas, zona, agrupables) antes de pasar a la siguiente, junto con el saldo del cobro directo (`filtrarPorCatalogo(…, ademas)` en `despachoCatalogo.ts`), y para al juntar los que hacen falta. Apagado, el código de siempre sin cambios. `frenoAlConectar` deja conectar si puede otro servicio de la zona (devuelve `sinComida` con el motivo en la respuesta) y solo frena con el 409 si no puede NINGUNO. Guía `food-activation` es/en al día.
- **Pruebas (comprobadas en rojo el 3 nov):** `despachoCatalogo.test.ts`: «un no habilitado en la celda… no tapa…» y «sin Comida pero con Envíos… se conecta» fallan con el código anterior; «el agrupable… solo si está habilitado» falla si se quita el filtro de la etapa de agrupables.
- **Qué NO tocar:** no volver a filtrar al final; no frenar la conexión por Comida si hay otro servicio.
- **Nota para el revisor:** con el interruptor APAGADO sigue igual que antes, también un detalle viejo: si en la celda hay repartidores pero ninguno con saldo para el cobro directo, se salta la zona y va a los agrupables. No se tocó (apagado = como antes); queda anotado.

## C-VERSION-VISIBLE · capturas en Docs (NXT-5, 3 nov 2026). Todos los países.

- **Qué faltaba:** la guía de soporte decía dónde está la versión, pero no la mostraba.
- **Qué se hizo:** `e2e/recorrido/versionVisible.spec.ts` abre las tres apps (cliente en Mi cuenta, Driver en Perfil, restaurante en Más), en español e inglés, comprueba que se ve la línea «Versión … · commit» / «Version … · commit» (`version-app`) y, con `CAPTURAS=1` (`npm run recorrido:capturas`), guarda `docs/capturas/recorrido/version-{cliente,driver,restaurante-app}-{es,en}.png`; `a-docs.mjs` las pasa a `apps/panel/public/docs/recorrido-version-*.webp`. La guía `support` (es/en) las muestra con su pie.
- **Cómo se comprueba:** `npx playwright test -c playwright.recorrido.config.ts e2e/recorrido/versionVisible.spec.ts` (después de `node scripts/recorrido/preparar.mjs`).
- **Qué NO tocar:** la explicación de permisos del Driver sale un poco después de abrir; la prueba la cierra antes de la foto.

## C-FOTOS-HEIC-LIMPIAS · vía segura: el HEIC no se guarda (NXT-4y, 3 nov 2026). Todos los países.

- **Por qué cambia:** el revisor devolvió dos veces la limpieza del HEIC en el servidor (NXT-4, NXT-4x): con la foto real del iPhone, un ítem con el tipo cambiado (`zzzz`, `jpeg`, `hvc1`) guardaba el EXIF entero con GPS y modelo, y quedaban huecos sin candado. El formato deja demasiados lugares para esconder datos.
- **Regla nueva:** `limpiarFoto` (`apps/servidor/src/fotoLimpia.ts`) RECHAZA todo `image/heic` e `image/heif` con el 415 `HEIC_SIN_LIMPIAR` («Esta foto está en HEIC… Mándala en JPG (Ajustes → Cámara → Formatos → Más compatible) o haz una captura de pantalla», es/en). El limpiador de cajas se quitó. Los documentos de evidencia (`conservarOriginal`) siguen igual. Las tres apps piden a la galería del iPhone la versión «compatible» (JPEG): `selectorDeCapturas(galeria, UIImagePickerPreferredAssetRepresentationMode.Compatible)` (`packages/movil/src/elegirCapturas.ts`; cliente `account.tsx`, Driver `Inicio.tsx`, restaurante `MasPantallas.tsx`). Las demás subidas ya solo aceptaban JPG/PNG/WebP. Guía `support` es/en al día.
- **Pruebas (comprobadas en rojo el 3 nov con el limpiador anterior: fallan 3):** `fotoLimpia.test.ts` («NXT-4y: todo HEIC/HEIF se rechaza…», siete variantes, nada llega al almacén), `rutas/adjuntos.test.ts` (la captura HEIC del caso da 415 y no se anota) y `heicApps.test.ts` (el selector pasa el modo compatible y las tres apps lo usan).
- **Qué NO tocar:** no volver a aceptar HEIC en el servidor; si algún día hace falta, se convierte en el teléfono o en el navegador a JPEG/WebP antes de subir (NXT-7), nunca se limpia en el servidor.

## C-DESPACHO-CATALOGO · arreglos de la revisión (NXT-6y, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor):** (1) con un bloqueo GENERAL (`conductor_bloqueos.servicio_id` NULL) y Envíos habilitado se conectaba igual (`estadoDelConductor` no lee bloqueos); (2) el aviso de Comida no le llegaba a nadie: la app Driver ignoraba `sinComida` y el servidor mandaba un código sin texto; (3) faltaba candado del saldo del cobro directo con el interruptor encendido.
- **Qué se hizo:** `frenoAlConectar` (`apps/servidor/src/despachoCatalogo.ts`) cuenta como «otro servicio» solo el que `motivoServicio` da por `habilitado` (bloqueos incluidos). `/repartidor/conectar` devuelve además `avisoComida`, el texto de `errorSinComida` en el idioma de la petición; la app Driver (`apps/repartidor/src/Inicio.tsx`, `alternar`) lo muestra con `setAviso` sin bloquear.
- **Pruebas (cada una comprobada en rojo el 3 nov):** `despachoCatalogo.test.ts` («bloqueo GENERAL…», «…en su idioma» con es y en, «la app del Driver muestra el aviso…») e `internacional.test.ts` («NXT-6y · … el saldo del cobro directo sigue mandando»: cae si se quita `saldo` de las llamadas a `filtrarPorCatalogo`).
- **Qué NO tocar:** no contar un servicio como disponible sin pasar por `motivoServicio`; no mandar el motivo sin su texto.

## C-CONTROL-DUAL · conciliación de diagnóstico, arreglos de la revisión (NXT-2x, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor):** (1) los reembolsos de Stripe solo se miraban si el pedido tenía filas en `devoluciones`: un reembolso sin fila (la escritura que falló después de reembolsar, o uno hecho a mano en Stripe) salía «cuadra»; (2) sin candado de la cantidad ni del estado de los reembolsos; (3) en `controlDualStaging.spec.ts` el `finally` callaba con `.catch(() => undefined)` si fallaba quitarles el permiso de equipo a las dos cuentas.
- **Qué se hizo:** `POST /datos/interno/diagnostico/conciliacion` (`apps/servidor/src/rutas/diagnostico.ts`): para TODO pedido cobrado se piden sus reembolsos (hasta 100) y cada uno que mueve dinero (succeeded o pending) tiene que estar explicado: por su id en `devoluciones.stripe_reembolso`, por un plato agotado después de cobrar (metadata `pedido_id` de ese pedido y `motivo: plato_agotado`) o por la cancelación de un pedido cancelado (metadata `pedido_id`, sin motivo ni devolución). Si no: «reembolso re_… sin explicar en la base». Además, las filas de `devoluciones` y sus reembolsos tienen que coincidir en cantidad y suma. La limpieza de la prueba de punta a punta cierra el restaurante y lo comprueba, quita el permiso y comprueba que ninguna de las dos cuentas lo conserva; si algo falla lo escribe en la salida y la prueba queda en rojo (`expect.soft`, sin tapar el error de la corrida).
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/rutas/diagnostico.test.ts`: con el código anterior fallan 3 (reembolso sin fila, dos veces, plato agotado/cancelación); quitando el filtro de estado cae «un reembolso fallido o cancelado no cuenta»; quitando la comparación de la cantidad cae «dos devoluciones en la base y un solo reembolso…»; sin los no explicados caen 3.
- **Qué NO tocar:** no volver a mirar Stripe solo cuando la base tiene devoluciones; un reembolso nuevo de nuestro código tiene que llevar su marca en metadata y su explicación aquí.

## C-FOTOS-HEIC-LIMPIAS · toda galería en JPEG y aviso claro en el panel (NXT-4z, 3 nov 2026). Todos los países.

- **Qué faltaba (lo encontró el revisor):** (1) la foto de la queja y la del chat de la app del cliente (`elegirFotoQueja`, `apps/cliente/src/app/order/[id].tsx`) y la del plato en la app del restaurante (`MiMenu.tsx`) abrían la galería sin el modo compatible: el iPhone entregaba el HEIC crudo, el servidor daba 415 y se perdía la foto; (2) la verificación de identidad del panel aceptaba `image/*` y, con un HEIC en Chrome o Firefox, salía el texto técnico del navegador en inglés.
- **Qué se hizo:** todas las aperturas de la galería de las tres apps piden `UIImagePickerPreferredAssetRepresentationMode.Compatible` (JPEG); las de la cámara ya entregan JPEG (calidad menor que 1). En el panel, `reducirFoto` (`apps/panel/src/panel/SubirFoto.tsx`) no intenta abrir un `.heic`/`image/heic` y atrapa el fallo de `createImageBitmap` con `FotoIlegible`; `mensajeDeFoto` da el aviso en el idioma de la persona («No pudimos abrir esa foto. Si es HEIC… Más compatible» / «…Most Compatible»). `SubirFoto` y `VerificacionPanel` lo usan; la verificación acepta solo JPEG, PNG y WebP.
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/heicApps.test.ts` recorre TODO el código de las tres apps y del paquete móvil: cada `launchImageLibraryAsync` lleva el modo compatible y cada `launchCameraAsync` su calidad (cae con la queja del cliente como estaba); `apps/panel/src/panel/SubirFoto.test.tsx` (foto que el navegador no abre y archivo `.HEIC`: con el código anterior caen las dos).
- **Qué NO tocar:** ninguna galería nueva sin el modo compatible (la prueba la encuentra sola); nunca mostrar `String(error)` del navegador a la persona.

## C-FOTOS-LIVIANAS (NXT-7, 3 nov 2026). Todos los países.

- **Qué faltaba:** las fotos de platos y restaurantes se servían en un solo tamaño grande (requisito B del 16 oct): la lista y el carrito bajaban la foto entera.
- **Referencia:** DoorDash pide fotos de al menos 1400 × 800 y no agrandarlas [DOC]; las webs de Uber Eats y DoorDash se grabaron como visitante con REA y respondieron con su anti-robots (no se saltó): ficha `docs/investigaciones-rea/2026-11-03-fotos-livianas.md`.
- **Qué se hizo:** `packages/compartido/src/fotosLivianas.ts` (tamaños: miniatura 200 px / 40 KB / 0,7; tarjeta 640 / 200 KB / 0,78; completa 1400 / 0,82; `rutaFotoTamano`, `idDeFoto`, `medidasReducidas`, `medidasWebp`). Servidor (`apps/servidor/src/rutas/fotos.ts`): `POST /datos/mi-restaurante/fotos?de=<id>&tam=tarjeta|miniatura` guarda `<id>-m.webp`/`<id>-s.webp` solo si la completa existe en ESE restaurante, es WebP y cumple lado y peso (si no, 422); `/media` entrega la completa (WebP, JPG o PNG) con caché de 5 minutos cuando el tamaño no existe. Panel: `subirFotoLiviana` (`SubirFoto.tsx`) convierte con canvas. App del restaurante: `subirFotoLivianaApp` (`packages/movil/src/fotoLiviana.ts`) con `expo-image-manipulator` (instalado con `npx expo install`; módulo nativo: entra en la próxima compilación) en `MiMenu.tsx`. `urlFoto(ruta, tam)` en las apps y `rutaFotoTamano` en el panel: listas y carrito miniatura, tarjetas tarjeta, ficha completa. Guía `menu` de Docs (es/en) con la captura real del menú en la app.
- **Pruebas (comprobadas en rojo el 3 nov: con el código anterior fallan 9):** `rutas/fotos.test.ts` (bloque NXT-7), `fotosLivianas.test.ts`, `SubirFoto.test.tsx` y `fotosLivianasApps.test.ts`.
- **Qué NO tocar:** las fotos de evidencia y los documentos no pasan por aquí; no agrandar nunca; un tamaño chico que falla no rompe la foto (respaldo a la completa).

## C-TIENDAS-FOTO-PROPIA (NXT-8, 3 nov 2026). Todos los países. Tiendas sigue apagado en producción.

- **Qué faltaba:** la foto de un producto solo podía ser un enlace https o la de Open Food Facts; la tienda no podía subir la suya.
- **Referencia:** Instacart y DoorDash dejan subir la foto de cada producto en el alta del comercio [DOC]; DoorDash pide fotos de al menos 1400 × 800 (ficha de C-FOTOS-LIVIANAS).
- **Qué se hizo:** la foto se sube por la misma ruta de fotos (`POST /datos/mi-restaurante/fotos`, pieza única `guardarFoto`, sin datos ocultos, con los tres tamaños de C-FOTOS-LIVIANAS), ahora también para un manager del equipo (el staff no: 403). `rutas/tiendas.ts`: `imagen` acepta https o `/media/fotos/<comercio>/<archivo>`, y la foto tiene que ser de ESA tienda (si no, 422 «Esa foto no es de tu tienda»); el «Sin foto» del resumen baja solo. Panel: `SubirFoto` en el formulario de `Productos.tsx`. App: una tienda (tipo distinto de restaurante; `tipoComercio` viaja en el restaurante) ve «Productos» en «Más» (`opcionesMasRestaurante(idioma, { tienda })`), que abre el catálogo del panel dentro de la app con su sesión. Guía `store-catalog` (es/en) con dos capturas reales.
- **Pruebas (comprobadas en rojo el 3 nov):** `rutas/tiendas.test.ts` (bloque NXT-8: la foto sin «PixelFone», en el producto y el «Sin foto» de 1 a 0; foto de otra tienda 422; rutas inventadas 400; manager 201 y staff 403; con el código anterior caen las dos), `Productos.test.tsx` (sube y guarda con la foto; cae sin el cambio), `masRestaurante.test.ts` y `e2e/recorrido/fotoProducto.spec.ts` (navegador real: los tres tamaños existen, cada uno más liviano, y «Productos» en la app).
- **Qué NO tocar:** nunca aceptar en un producto la foto de otro comercio; la foto siempre pasa por `guardarFoto`.

## C-FOTOS-HEIC-LIMPIAS · candados que faltaban (NXT-4w, 3 nov 2026). Todos los países.

- **Qué faltaba (lo encontró el revisor):** (1) la verificación de identidad del panel no tenía prueba: volver a `accept="image/*"` o al `String(x)` del navegador dejaba todo en verde; (2) la prueba de las galerías no exigía calidad menor que 1 (en Android, con calidad 1 expo-image-picker copia el HEIC crudo).
- **Qué se hizo:** `apps/panel/src/panel/VerificacionPanel.test.tsx` (es y en: la entrada acepta solo JPEG, PNG y WebP; un archivo que el navegador no abre y un `.HEIC` dan el aviso claro, nunca el texto del navegador, y no se sube nada). `apps/servidor/src/heicApps.test.ts` exige `quality: 0.x` en cada `launchImageLibraryAsync` (las que pasan por `selectorDeCapturas` lo toman de `elegirCapturas.ts`, que también se revisa).
- **Comprobado en rojo el 3 nov:** con `accept="image/*"` caen las 2 del panel; con `String(x)` caen las 2; con `quality: 1` en la queja del cliente, en el plato del restaurante o en el selector de capturas, cae la de las galerías.

## C-FOTOS-LIVIANAS · candado de la limpieza en los tamaños chicos (NXT-7x, 3 nov 2026). Todos los países.

- **Qué faltaba (lo encontró el revisor):** el camino que guarda la tarjeta y la miniatura (`?de=…&tam=…` en `apps/servidor/src/rutas/fotos.ts`) no tenía prueba de C-FOTOS-SIN-METADATOS: cambiando `guardarFoto` por un `put` directo todo seguía en verde.
- **Qué se hizo:** prueba «NXT-7x» en `rutas/fotos.test.ts`: se sube como miniatura y como tarjeta un WebP con bloques EXIF (GPS de Miami, modelo «PixelFone») y XMP, y `/media` tiene que entregarlo sin ellos. Comprobada en rojo el 3 nov con el `put` directo.

## C-TIENDAS-FOTO-PROPIA para todos (NXT-8x, 3 nov 2026). Todos los países.

- **Qué faltaba (lo encontró el revisor):** la regla «nadie usa la foto de otro comercio» vivía solo en los productos; un restaurante podía guardar en un plato o en su portada la foto que subió otro.
- **Qué se hizo:** una sola pieza, `exigirFotoPropia` (`apps/servidor/src/fotoPropia.ts`), en crear y editar plato y en guardar el restaurante (`rutas/catalogo.ts`) y en los productos (`rutas/tiendas.ts`): 422 `campo: 'imagen'` con aviso es/en. Una cuenta sin restaurante tampoco estrena el suyo con la foto de otro.
- **Pruebas (comprobadas en rojo el 3 nov con `catalogo.ts` anterior):** `apps/servidor/src/fotoPropia.test.ts`; las de productos siguen en `rutas/tiendas.test.ts`.
- **Qué NO tocar:** toda ruta nueva que guarde una foto de un negocio pasa por `exigirFotoPropia`.

## C-DESPACHO-SALDO-ETAPAS (ETP-1, 3 nov 2026). Venezuela y Colombia (cobro directo); el resto no cambia.

- **Qué se rompía:** con el interruptor del catálogo APAGADO (producción hoy), `repartirOfertas` (`apps/servidor/src/rutas/operacion.ts`) aplicaba `conSaldoParaDirecto` DESPUÉS de decidir si ampliaba la búsqueda: si en la celda del restaurante había repartidores libres pero ninguno con saldo para la comisión del cobro directo, la lista quedaba en cero, se saltaba la zona y se iba directo a los agrupables. Un pedido en efectivo se quedaba sin oferta con repartidores con saldo libres en la zona.
- **Qué se hizo:** el saldo se revisa EN CADA ETAPA antes de ampliar (celda y vecinas → zona → agrupables), igual que la rama encendida. Los agrupables siguen como antes.
- **Prueba (comprobada en rojo el 3 nov con el código anterior):** `apps/servidor/src/internacional.test.ts`, «ETP-1 · un libre sin saldo en la celda del restaurante no tapa a uno con saldo en el resto de la zona».
- **Qué NO tocar:** no volver a filtrar el saldo al final de las etapas.

## C-DEVOLUCIONES-AJUSTE (ETP-2, 3 nov 2026). Todos los países.

- **Qué se rompía:** `ajustes_pedido` guarda una sola fila por pedido (llave `pedido_id`) y el segundo faltante la pisa: en una tienda con dos productos agotados después de cobrar, la primera devolución desaparecía de la base. La conciliación de diagnóstico explicaba un reembolso `plato_agotado` de Stripe solo por su marca, sin cruzar el monto.
- **Qué se hizo:** tabla `devoluciones_ajuste` (schema.sql: pedido, plato, monto, id del reembolso de Stripe, clave de idempotencia única, cuándo). `aplicarAjuste` (`apps/servidor/src/rutas/pedidos.ts`) escribe la fila en el MISMO lote que el recálculo del pedido, con el id que devuelve Stripe (sin id, 503 y el pedido no cambia). `POST /datos/interno/diagnostico/conciliacion` (`rutas/diagnostico.ts`): cada reembolso `plato_agotado` de este pedido tiene que tener su fila con el mismo id y el monto exacto, y cada fila su reembolso en Stripe; si no, rojo con el detalle.
- **Pruebas (comprobadas en rojo el 3 nov):** `rutas/tiendasVitrina.test.ts` «C-DEVOLUCIONES-AJUSTE (ETP-2): dos faltantes… dejan dos filas» (cae sin escribir la fila) y «…si Stripe no confirma el reembolso (sin id)…» (cae sin la compuerta del 503, lo pidió el revisor); `rutas/diagnostico.test.ts` «ETP-2: cada reembolso por plato agotado cuadra con su fila…» (monto distinto, sin fila y fila sin reembolso en rojo; cae con el código anterior).
- **Qué NO tocar:** ningún reembolso por plato agotado sin su fila en `devoluciones_ajuste`; no volver a explicar un reembolso solo por su marca.

## C-CONCILIACION-SEGUNDA-FIRMA (ETP-3, 3 nov 2026). Todos los países.

- **Qué se rompía:** una sola cuenta Total o Finanzas excusaba un día de la conciliación que no cuadró y el canario de dinero pasaba a verde (nota de NXT-1r). La excusa sembrada del 15 oct de producción comparaba solo 1 pedido y 718 centavos, no el detalle guardado. La bandeja mostraba el detalle como JSON crudo.
- **Qué se hizo:** `POST /datos/admin/conciliacion/excepciones` (`apps/servidor/src/rutas/excepcionesConciliacion.ts`) ya no excusa: con perfil, contraseña y motivo deja la solicitud `excusa_conciliacion` en «Para aprobar» (`pedirAprobacion`, `finanzas/controlDual.ts`) y responde 202; pedirla dos veces no la duplica. OTRA cuenta Total o Finanzas la aprueba (`ejecutarDual` → `excusarDia`): nunca la misma (la ruta de aprobar y `excusarDia` lo frenan, y el CHECK de la tabla), y solo si las cifras del día (pedidos, vendido y detalle) siguen siendo las pedidas; si cambiaron, 409 y nada se excusa. El canario sigue en rojo mientras espera. Quién aprobó queda en `aprobaciones_dinero.revisado_por` y sale en la bandeja (`aprobadoPorNombre`). `aprobaciones_dinero` acepta el tipo nuevo: la tabla de SIG-4x se rehace una vez sin perder filas (`esquemaDinero.ts`). La siembra del 15 oct en `schema.sql` exige además el detalle EXACTO leído de producción el 3 nov. Panel: `detalleEnPalabras` (`apps/panel/src/panel/detalleConciliacion.ts`): «Pagos con tarjeta, en dólares» y «Cobros directos en <moneda>», es/en, en la bandeja de días sin cuadrar y en «Para aprobar». Guía de Docs `two-person-approval` es/en con el párrafo del control diario.
- **Pruebas (comprobadas en rojo el 3 nov con el código anterior: fallan 4 del servidor y 5 del panel):** `apps/servidor/src/conciliacionExcepciones.test.ts` (la misma cuenta no aprueba lo suyo, el canario sigue en rojo mientras espera, cifras cambiadas al aprobar, la siembra no excusa con otro detalle), `finanzas/controlDualRevision.test.ts` (tabla de SIG-4x rehecha), `apps/panel/src/panel/ExcepcionesConciliacion.test.tsx`, `SuperAprobaciones.test.tsx` y `detalleConciliacion.test.ts` (esta última no corría en `npm run verify` hasta ETP-3x: el bloque del panel solo incluía `*.test.tsx`; desde la raíz cae en rojo con un `detalleEnPalabras` que devuelve el JSON).
- **Qué NO tocar:** ninguna ruta inserta en `conciliacion_excepciones` sin pasar por la segunda firma (salvo la siembra fija del 15 oct); no mostrar el detalle en JSON.

## C-PRUEBAS-SIN-HUERFANAS (ETP-3x, 3 nov 2026). Todos los países.

- **Qué se rompía:** `apps/panel/src/panel/detalleConciliacion.test.ts` (ETP-3) nunca corría en `npm run verify` ni en CI: el bloque `panel` de `vitest.config.mts` solo incluía `*.test.tsx`. Una prueba que no corre no protege nada y hace creer que el candado está puesto.
- **Qué se hizo:** el bloque `panel` incluye `apps/panel/src/**/*.test.{ts,tsx}`. Revisado con `git ls-files '*.test.ts' '*.test.tsx'`: era la única huérfana del repositorio. Candado general: `apps/servidor/src/pruebasHuerfanas.test.ts` lista todas las pruebas del repositorio y exige que cada una caiga en el `include` de algún bloque.
- **Prueba (comprobada en rojo el 3 nov):** con el include viejo del panel, `pruebasHuerfanas.test.ts` cae y nombra `detalleConciliacion.test.ts`.
- **Qué NO tocar:** un bloque nuevo de vitest o una carpeta nueva de pruebas entra en `projects`; no se escriben pruebas fuera de esos patrones.

## C-DESPACHO-LOTES (ETP-5, 3 nov 2026). Todos los países.

- **Qué faltaba:** con el despacho por catálogo encendido, cada candidato costaba unas 9 consultas (bloqueo + `estadoDelConductor`, nota de NXT-6xr): en una zona llena el reloj del reparto se frenaba. Era lo que faltaba para encender el interruptor por zona.
- **Qué se hizo:** `motivosServicio(db, ids, servicio)` (`apps/servidor/src/despachoCatalogo.ts`) revisa a todos los candidatos de una vuelta en lotes de 30 (D1 acepta 100 valores por consulta): bloqueos, cuenta y vehículo, habilitaciones, preferencias, requisitos faltantes (una consulta con `WITH … VALUES`), compatibilidad y el catálogo de cada zona una vez. La regla es UNA: `evaluarServicio` (`rutas/servicios.ts`), la misma que usa `estadoDelConductor` para lo que ve el conductor. `filtrarPorCatalogo` pide los motivos de los que la vuelta no conoce de una vez; `motivoServicio` (al conectarse) es el lote de uno.
- **Pruebas (comprobadas en rojo el 3 nov):** `despachoCatalogo.test.ts` «ETP-5: las consultas de una vuelta no crecen con los candidatos» (con el código anterior: 103 consultas con doce candidatos contra 33 con dos; ahora iguales) y «ETP-5: en lotes de más de 30…» (motivos de 33 repartidores, bloqueo general, preferencia apagada, uno que no existe). Las de C-DESPACHO-CATALOGO siguen en verde.
- **Qué NO tocar:** no volver a preguntar repartidor por repartidor; ninguna regla de elegibilidad de Comida fuera de `evaluarServicio`. El interruptor sigue apagado en producción hasta la orden de Richard.

## C-TIENDAS-REEMPLAZO-ELEGIDO (ETP-4, 3 nov 2026). Todos los países (Tiendas sigue solo en el sitio de pruebas).

- **Qué faltaba:** el cliente solo podía decir «reembolsar», «uno parecido» o «avísame» si faltaba un producto; no podía elegir el reemplazo exacto como en «Choose a specific replacement» de Instacart y DoorDash [DOC] (ficha `docs/investigaciones-rea/2026-10-29-tiendas-reemplazos.md`).
- **Qué se hizo:** cuarta opción `especifico` (`SUSTITUCIONES`, `packages/compartido/src/tiendas.ts`). `POST /datos/pedidos` acepta `reemplazoId` por línea; `lineasDeTienda` (`rutas/tiendas.ts`) lo exige con `especifico` (400 si falta o es el mismo producto), lo busca en la MISMA tienda y disponible hoy (409 si no) y lo congela en la línea (`reemplazo`: id, nombres y precio). «Pedir otra vez» lo conserva. `POST /restaurante/pedidos/:id/falta` (`rutas/operacion.ts`): si el elegido está hoy, va primero en las propuestas y se aplica en el acto con `aplicarAjuste('reemplazar')` (el techo de siempre: nunca se cobra más que el original, C-TIENDAS-PESO-REAL); si tampoco está, se devuelve el dinero de ese producto. `notaSustitucion` dice «Si no hay: <nombre> (lo eligió el cliente)» / «If out: <name> (chosen by the customer)»: lo ven el panel (`Pedidos.tsx`) y la app de la tienda (`apps/restaurante/src/Inicio.tsx`). App del cliente: «Elegir uno» en el carrito abre `ElegirReemplazo` (`apps/cliente/src/tiendas/ElegirReemplazo.tsx`), que busca en la tienda mientras se escribe; sin elegir, el carrito no deja pagar y lo dice. Docs `stores` (cliente) y la guía de la tienda, es/en, con capturas reales del recorrido.
- **Pruebas (comprobadas en rojo el 3 nov):** `rutas/tiendasVitrina.test.ts` (dos de ETP-4: validaciones, la línea congelada, el reemplazo aplicado sin cobrar de más, y el reembolso si el elegido tampoco está), `packages/compartido/src/tiendas.test.ts` (la nota es/en) y `apps/servidor/src/reemplazoElegidoApp.test.ts` (el carrito y las pantallas de la tienda). Recorrido: `e2e/recorrido/tiendas.spec.ts` elige el reemplazo de la cerveza y comprueba la nota en el panel (es y en).
- **Qué NO tocar:** el reemplazo elegido siempre es de la misma tienda y pasa por `lineasDeTienda`; nunca se cambia por otro que el cliente no eligió.

## C-TIENDAS-REEMPLAZO-ELEGIDO · arreglos de la revisión (ETP-4x, 3 nov 2026). Todos los países.

- **Qué se rompía (lo encontró el revisor):** (1) al aplicar el reemplazo, `calcularSinPlato` (`rutas/pedidos.ts`) dejaba la línea con «Elegir uno» y el reemplazo apuntando a sí misma; si la tienda marcaba que también faltaba, `/restaurante/pedidos/:id/falta` la «reemplazaba» por sí misma: no se devolvía nada y se cobraba un producto que no iba. (2) «Pedir otra vez» de ese pedido daba la línea por perdida (reemplazo igual al producto). (3) Con el reemplazo elegido agotado, también tiraba el producto original aunque sí había.
- **Qué se hizo:** la línea reemplazada queda sin `reemplazo` y con «reembolsar» (cualquier reemplazo, también «uno parecido»); `/falta` nunca propone el mismo producto que falta (también para pedidos viejos con el reemplazo apuntando a sí mismo). `GET /pedidos/:id/repetir` prueba primero con el reemplazo elegido y, si no se puede, trae el producto con la opción de siempre.
- **Prueba (comprobada en rojo el 3 nov con el código de ETP-4):** `rutas/tiendasVitrina.test.ts`, «ETP-4x: si el reemplazo ya aplicado también falta, se devuelve; y «Pedir otra vez» trae lo que sí hay».
- **Qué NO tocar:** una línea ya reemplazada no vuelve a tener reemplazo; un faltante sobre ella siempre devuelve.

## C-TIENDAS-REEMPLAZO-ELEGIDO · el original en la línea (ETP-4y, 3 nov 2026). Todos los países.

- **Qué faltaba (lo encontró el revisor):** al reemplazar, la línea perdía qué producto se había pedido: «Pedir otra vez» volvía a pedir el reemplazo y no el original.
- **Qué se hizo:** `calcularSinPlato` (`rutas/pedidos.ts`) guarda en la línea reemplazada `original` (id, nombres, sustitución y reemplazo elegidos), solo informativo: el cobro y el reparto salen del precio de la línea (la prueba lo comprueba con el total y el pago al restaurante). `GET /pedidos/:id/repetir` prueba en orden: el original con su preferencia, el original sin el reemplazo, el reemplazo que llegó, y si nada está, «faltan». Un pedido viejo con el reemplazo igual al propio producto: `/falta` devuelve sin proponerse a sí mismo y «Pedir otra vez» lo trae.
- **Prueba (comprobada en rojo el 3 nov con el código de ETP-4x):** `rutas/tiendasVitrina.test.ts`, «ETP-4y: la línea reemplazada guarda el original…».
- **Qué NO tocar:** `original` nunca entra en el cálculo del cobro; no se borra al volver a reemplazar (se conserva el primero).

## C-DEVOLUCION-SIN-ID (LAN-1, 3 nov 2026). Todos los países.

- **Qué se rompía:** la devolución después de entregar (`devolverParcial` en `apps/servidor/src/devoluciones.ts`, que usan el superadmin, la aprobación del control dual y la queja guiada) guardaba `reembolso.id` sin mirar si Stripe lo devolvió: con una respuesta sin id quedaba una fila en `devoluciones` sin reembolso y, si se cargaba al restaurante o al repartidor, su movimiento. Además el cuerpo llevaba `metadata.devolucion` al azar en cada intento, así que el reintento con la misma clave chocaba con la regla de Stripe (misma clave, mismos datos) y no se podía repetir. El reembolso de recarga de empresa (`reembolsarRecarga`, `finanzas/billetera.ts`) auditaba y descontaba el saldo aunque Stripe no confirmara. Un error de Stripe o una respuesta perdida salían como 500 genérico.
- **Qué se hizo:** pieza única `reembolsoConfirmado` (`apps/servidor/src/reembolsoStripe.ts`): pide el reembolso y devuelve su id solo si Stripe lo confirmó; sin id, con error 5xx o sin respuesta → 503 «Stripe no confirmó la devolución. Intenta otra vez…» (es/en en `mensajesEn.ts`); un 4xx de Stripe → 409 «Stripe no aceptó la devolución…». Quien llama no escribe nada hasta tener el id. `devolverParcial` usa la clave `devolucion-<pedido>-<n>` también como `metadata.devolucion` (nada al azar en el cuerpo): el reintento devuelve el mismo reembolso. `reembolsarRecarga` pasa por la misma pieza antes de auditar y descontar.
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/devolucionesSinId.test.ts` (superadmin sin id, con error, rechazado y con respuesta perdida; control dual «fallida»; queja guiada; Stripe simulado con su regla de idempotencia y la conciliación de diagnóstico en verde tras el reintento): las cuatro caen con el código anterior y también con `metadata.devolucion` al azar. `finanzas/finanzas.test.ts` «LAN-1 · C-DEVOLUCION-SIN-ID…» (recarga): cae con `stripe.post` directo.
- **Cómo se comprueba:** `npx vitest run src/devolucionesSinId.test.ts` y el «LAN-1» de `finanzas.test.ts` en `apps/servidor`.
- **LAN-1x (devuelto por el revisor):** la clave del reembolso de recarga salía de `reembolsado`, que el aviso `charge.refunded` mueve: respuesta perdida → aviso → reintento con OTRA clave = dos reembolsos. Ahora la clave es `reembolso-recarga-<id>-pedido-<n>`, con n = reembolsos ya confirmados (auditoría escrita solo con el id de Stripe), y lo devuelto en total se lee del cobro en Stripe (`latest_charge.amount_refunded`) antes de descontar; si Stripe no responde a esa lectura, descuenta el aviso. Prueba: «LAN-1x · C-DEVOLUCION-SIN-ID» en `finanzas/finanzas.test.ts` (cae con la clave anterior: dos reembolsos).
- **Qué NO tocar:** ningún reembolso guarda fila, movimiento, auditoría ni descuento sin el id de Stripe; nada al azar en el cuerpo de un reembolso con clave de idempotencia. Pendiente conocido: si Stripe hizo un reembolso que nunca se confirmó y después se pide otro monto distinto, Stripe rechaza la clave (409, nada se escribe) y la conciliación de diagnóstico marca el reembolso sin explicar hasta que soporte repite el monto original.

## C-TIENDAS-REEMPLAZO-ELEGIDO · «Pedir otra vez» como se pidió (LAN-5, 3 nov 2026). Todos los países (Tiendas sigue solo en el sitio de pruebas; el reemplazo propuesto también existe en restaurantes).

- **Qué faltaba (notas sin bloqueo de ETP-4yr):** si no estaban ni el original ni el reemplazo, «faltan» nombraba el reemplazo que llegó y no lo que el cliente pidió; y `original` no guardaba las opciones, así que «Pedir otra vez» devolvía el plato sin sus extras.
- **Qué se hizo:** `calcularSinPlato` (`apps/servidor/src/rutas/pedidos.ts`) guarda `original.opciones` (las de la línea pedida, si tenía); `GET /pedidos/:id/repetir` arma el original con SUS opciones (y la nota de la línea) y, si nada está, pone en «faltan» los nombres del original. El cobro y el reparto no cambian (`original` sigue fuera del cálculo).
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/rutas/repetirReemplazo.test.ts` (restaurante: pizza con extra queso reemplazada por calzone; vuelve al carrito con el queso; sin ninguno, «faltan» dice «Pizza»; total y pago del restaurante iguales) y el paso de «faltan» de «ETP-4y» en `rutas/tiendasVitrina.test.ts` (ahora exige «Spring water»).
- **Qué NO tocar:** «faltan» siempre con el nombre de lo pedido; `original.opciones` nunca entra en el precio.

## C-RUTAS-SIN-ARROBA (LAN-6, 3 nov 2026). Todos los países.

- **Qué pasaba:** las apps web (cliente, Driver y restaurante) publican la fuente de íconos de Expo en `assets/node_modules/@expo/…/Ionicons.<hash>.ttf` (y algunos íconos de expo-router como `…@2x.png`). YaDominios Cloud responde 307 a toda ruta con «@» hacia la misma con «%40»: un viaje de más en la primera carga de cada app (ficha docs/investigaciones-rea/2026-11-03-repaso-etp6.md).
- **Qué se hizo:** `scripts/sin-arroba.mjs <carpeta>` renombra cada archivo o carpeta con «@» («@» → «_») y corrige las referencias en los archivos de texto (primero las referencias, después los nombres, de lo más hondo a lo más alto). `scripts/empaquetar.sh` lo corre en `app`, `driver` y `restaurant` antes del revisor; `scripts/verificar-paquete.mjs` frena el paquete si queda una sola ruta con «@».
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/publicacion.test.ts`, bloque «LAN-6 · C-RUTAS-SIN-ARROBA» (el revisor frena un «@»; el script renombra, corrige la referencia de la fuente y el paquete pasa; el empaquetador lo corre en las tres apps antes de revisar). Comprobado también sobre la exportación real del Driver: 7 archivos renombrados y la fuente referenciada como `/driver/assets/node_modules/_expo/…/Ionicons.<hash>.ttf`.
- **Cómo se comprueba en vivo:** `curl -sI https://staging.tumbite.com/driver/assets/node_modules/_expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.<hash>.ttf` responde 200, sin «location».
- **Qué NO tocar:** no quitar el paso de `empaquetar.sh` ni la regla del revisor; el «@2x» de los mapas (Leaflet, mosaicos externos) no es una ruta nuestra.

## C-COMANDA-APP (LAN-3, 3 nov 2026). Todos los países.

- **Qué faltaba:** la comanda impresa solo existía en el panel web; la app del restaurante (celular y tableta) no imprimía, y DoorDash Merchant y Uber Eats Manager sí.
- **Qué se hizo:** la comanda pasó a una sola pieza compartida, `packages/compartido/src/comanda.ts` (`htmlComanda`, 80 mm, número, modo, programado, platos con opciones, alergia y notas escapadas; nunca dinero ni dirección; `ANCHO_COMANDA_PUNTOS` = 227). El panel (`apps/panel/src/panel/comanda.ts`) la usa con la impresión del navegador. La app del restaurante (`apps/restaurante/src/comanda.ts`) imprime con `expo-print` (AirPrint en iPhone/iPad, servicio de impresión en Android; en la versión web, un marco oculto). En `Inicio.tsx`: interruptor «Imprimir la comanda al aceptar» (guardado en el equipo con AsyncStorage, `divoox.comandaAlAceptar`) que imprime UNA vez cada pedido la primera vez que se ve aceptado (a mano o solo; los ya aceptados al abrir no se reimprimen) y botón «Imprimir comanda» en el pedido aceptado o listo. Sirve con el pedido de prueba. Docs: guía «print-tickets» es/en con capturas de la app.
- **Pruebas (comprobadas en rojo el 3 nov):** `packages/compartido/src/comanda.test.ts` (sin dinero ni dirección, 80 mm, el panel usa la pieza compartida, la app usa expo-print con botón, interruptor y el ancho); `e2e/recorrido/comandaApp.spec.ts` (app web del restaurante: enciende el interruptor, pedido de prueba, al aceptar sale una comanda, el botón la reimprime, el ticket no lleva dinero); `apps/panel/src/panel/comanda.test.tsx`.
- **Comprobado en el simulador de iPhone:** la compilación nativa con `expo-print` instala y abre (3 nov). Pendiente para el puesto de tiendas (LAN-7): las capturas de la hoja de impresión del iPhone, que este puesto no pudo tocar.
- **LAN-3x (devuelto por el revisor):** la comanda imprimía `notas`, que son las indicaciones para el repartidor (portón, timbre, apartamento de la dirección guardada). Se quitaron del panel y de la app (una sola pieza); la nota de cada plato y las alergias siguen. Prueba: `packages/compartido/src/comanda.test.ts` y `apps/panel/src/panel/comanda.test.tsx` (caen con la línea de notas).
- **LAN-3y:** la comanda lleva el nombre corto del cliente (`nombreCorto`: primer nombre e inicial de la segunda palabra, «Ana G.»), como DoorDash Merchant y Uber Eats Manager, para encontrar la bolsa. `GET /restaurante/pedidos` (`rutas/operacion.ts`) manda solo `clienteCorto`, nunca el nombre completo. Pruebas: `comanda.test.ts` (nombre corto es/en y la nota del plato, cada una en rojo sin su arreglo) y `rutas/comandaCliente.test.ts` (cae sin `clienteCorto`).
- **Qué NO tocar:** la comanda nunca lee el total, la dirección ni las indicaciones para el repartidor; el apellido completo ni el teléfono; una sola pieza (no copiar `htmlComanda` en otra app); `expo-print` en `apps/restaurante/package.json` (la próxima compilación de tiendas lo lleva).

## C-ACCESIBILIDAD-WEB (LAN-4, 3 nov 2026). EE. UU. (la web y la app web son las mismas en todos los países).

- **Qué faltaba:** ninguna revisión automática de accesibilidad antes de abrir Miami (Florida es de los estados con más demandas, ficha docs/investigaciones-rea/2026-11-03-accesibilidad-web.md).
- **Qué se hizo:** `e2e/recorrido/accesibilidad.spec.ts` con axe-core (`@axe-core/playwright`, MPL-2.0): portada, «Cómo funciona», Docs y una guía, lista de restaurantes, ficha, carrito y pedido, en inglés y español, celular y computadora; falla con cualquier infracción crítica o seria de WCAG 2.1 A/AA. Arreglos: nombre del selector de idioma con lo que se ve, lista del pie dentro de su panel, contrastes con el rojo oscuro de la marca (#C20A1A) y grises más oscuros, `aria-checked`/`aria-selected`/`aria-pressed` en la app (react-native-web ignora `accessibilityState`), corazón y «+» fuera de la tarjeta y de la fila del plato, nombre de la barra de pasos del pedido.
- **Prueba (comprobada en rojo el 3 nov con el código anterior: 39 infracciones):** `npx playwright test -c playwright.recorrido.config.ts e2e/recorrido/accesibilidad.spec.ts` (corre en el recorrido de la verificación de main).
- **Qué NO tocar:** no excluir reglas ni pantallas para que pase; el rojo principal (#F20D20) no va en texto chico ni detrás de texto blanco chico; todo radio, pestaña o interruptor de la app lleva su `aria-*` además de `accessibilityState`.

## C-DIRECCION-REAUTORIZA y C-PROPINA-DESPUES-CONCILIADA (LAN-2, 3 nov 2026). EE. UU. (todo pago con tarjeta).

- **Qué se rompía (encontrado con Stripe de prueba de verdad, corrida 41694004697):** con el pedido ya pagado (tarjeta autorizada, `requires_capture`), cambiar la dirección hacía `POST /payment_intents/<id>` con el monto nuevo y Stripe lo rechaza siempre en ese estado: el cliente recibía «No pudimos actualizar el cobro…» aunque el envío subiera o bajara. Los simuladores de las pruebas aceptaban el cambio y lo escondían.
- **Qué se hizo:** `PATCH /pedidos/:id/direccion` (`apps/servidor/src/rutas/pedidos.ts`): antes de pagar, igual que siempre (se cambia el monto). Ya pagado: si el total más el margen de los pesables no pasa lo retenido, Stripe no se toca (al entregar se captura menos); si lo pasa, se autoriza el total nuevo con la tarjeta guardada (off_session, captura manual, clave `reautoriza-<pedido>-<monto>`), el pedido pasa a `stripe_pago`/`stripe_sesion` nuevos en el mismo lote del recálculo y solo después se anula la autorización vieja (si no se puede, vence sola y queda en el registro). Si la tarjeta no autoriza, 409 y nada cambia. La conciliación de diagnóstico revisa además la propina posterior: su cobro aparte en Stripe por el monto exacto y el abono al repartidor.
- **Pruebas (comprobadas en rojo el 3 nov):** `apps/servidor/src/fallosDinero.test.ts`, «LAN-2 · C-DIRECCION-REAUTORIZA» (sube, no autoriza, baja; las de sube y baja caen con el código anterior); `rutas/diagnostico.test.ts` «LAN-2: la propina después de entregar cuadra…»; los simuladores de `tiendasPeso.test.ts` y `operacion.test.ts` ahora rechazan cambiar el monto de un intento retenido, como Stripe. En el sitio de pruebas: `e2e/recorrido/domicilioStaging.spec.ts` «LAN-2a» y «LAN-2b» (VERIFICAR-PAGOS.md).
- **LAN-2x (devuelto por el revisor):** dirección, total y autorización nueva van en UNA sola sentencia con `WHERE stripe_pago = <la autorización reemplazada>`; si otro cambio ganó la carrera no se escribe nada, se anula la nueva y 409. La clave de la reautorización es por intento (`reautoriza-<pedido>-<monto>-<marca>`), para que un error guardado por Stripe no se repita 24 h. La anulación de la vieja queda anotada (`bitacora_pedidos`, evento `cobro_reautorizado`, «vieja>nueva») y la conciliación de diagnóstico exige en Stripe que la vieja esté `canceled`; si la anulación falla, queda en los errores del servidor (C-ERRORES-VISIBLES), igual que una autorización sin respuesta. Pruebas: «LAN-2x» en `fallosDinero.test.ts` (carrera, clave por intento, anulación fallida; las tres caen con el código anterior) y en `rutas/diagnostico.test.ts`.
- **LAN-2z (devuelto por el revisor):** `bitacora_pedidos` admite un evento por pedido y nombre (`UNIQUE (pedido_id, evento)`), así que con dos cambios seguidos que suben el total el segundo `cobro_reautorizado` no se guardaba y la autorización del medio no se vigilaba. Ahora el evento es `cobro_reautorizado:<id de la autorización reemplazada>` (uno por cada una, sin tocar el esquema) y la conciliación de diagnóstico revisa en Stripe todas (y las del nombre viejo sin id). Pruebas: «LAN-2z» en `fallosDinero.test.ts` (dos cambios, dos registros) y en `rutas/diagnostico.test.ts` (la del medio sin anular sale en rojo); las dos caen con el código anterior.
- **Qué NO tocar:** nunca cambiar el monto de un intento retenido; nunca anular la autorización vieja antes de guardar la nueva en el pedido; los simuladores de Stripe tienen que portarse como el real en este punto.

## C-RECORRIDO-REINTENTA-RED · navegación colgada (3 nov 2026). Todos los países.

- **Qué pasó:** en la corrida 41705969872 del sitio de pruebas el alojamiento tardó 817 s en servir el HTML de `/app/` (200, pero colgado) y el recorrido en inglés llegó al límite de 15 minutos; el mismo código pasó en la corrida anterior. Fallo del alojamiento, no de la app.
- **Qué se hizo:** `e2e/recorrido/fixtures.ts` envuelve `page.goto` de toda página (la del fixture y las de `browser.newContext().newPage()`): si la carga no termina en 60 s, se repite hasta 3 veces; cualquier otro error sale tal cual.
- **Qué NO tocar:** solo se repite el tiempo agotado de la navegación; nunca una respuesta de error ni una espera de la app.

## C-MAPA-VERDAD — el mapa de la portada no dice «Live» donde no hay restaurantes (4 nov 2026) — todos los países

- **Qué se rompió:** la portada de divoox.com decía «Miami · Live» en el mapa de Florida, aunque en Miami no hay ni un restaurante. El auditor de tiendas lo marcó para Apple (regla 2.3: lo que se muestra tiene que ser verdad).
- **Causa real:** el mapa pintaba como «Live» toda zona que devuelve `/datos/zonas`, y la zona de Miami existe en el servidor para la cobertura de la app.
- **Arreglo:** `apps/panel/src/sitio/MapaCobertura.tsx` pregunta el estado público de cada ciudad (`useCiudadesEnVivo`, el interruptor del superadmin en `/datos/web/ciudades`). Solo dice «Live» la ciudad encendida; las demás dicen «Coming soon». Las zonas fuera de Florida (Novi, pruebas) no se dibujan en ese mapa.
- **Prueba:** `apps/panel/src/sitio/MapaCobertura.test.tsx` (comprobada en rojo).
- **No tocar:** el día del lanzamiento, Miami se enciende desde el superadmin (Ciudades de la web), no cambiando este código.

## C-REVISOR-SIN-PRUEBA — lo que ven las cuentas del revisor no dice «prueba» (4 nov 2026) — EE. UU.

- **Qué se vio:** la cuenta del revisor de Apple (cliente) tiene pedidos viejos cancelados de «Café Fountain Walk (prueba)», y también de «Pizzería Novi (prueba)» y «Tacos Twelve Oaks (prueba)». Apple rechaza el contenido temporal (2.1(a)).
- **Qué se hizo (orden de Gerencia, 4 nov, 21:40 hora del Este):** un solo UPDATE en producción por la API de consultas, sin borrar nada: a los cuatro restaurantes pausados de Novi se les quitó « (prueba)» del nombre. Siguen en estado `pausado` y cerrados, y no aparecen en la lista pública. Ahora se llaman Pizzería Novi, Tacos Twelve Oaks, Burger Town Center y Café Fountain Walk.
- **Revisado:** ningún plato, descripción, nota ni dirección de pedidos de las tres cuentas revisor.* dice prueba, test, sample, ejemplo o demo. El restaurante del revisor es Divoox Review Kitchen.
- **No tocar:** antes de una revisión de Apple, comprobar con la misma búsqueda que no volvió ninguna de esas palabras en lo que ven las cuentas revisor.*.

## C-CONNECT-APAGADO y C-STRIPE-SOLO-PRUEBA — no crear cuentas conectadas con la llave real hasta activar Connect (5 nov 2026) — EE. UU.

- **Qué pasó:** Stripe pausó la creación de cuentas conectadas en la cuenta de Windoce por «actividad sospechosa» en `POST /v1/accounts`.
- **Causa confirmada (registro `errores_servidor` de producción):** la billetera del panel (`AltaCobros.tsx`) pide `/datos/billetera/sesion` al abrirse y, si falla, `/datos/billetera/conectar`. Las dos llamaban a `cuentaDeCobros()`, que hace `POST /v1/accounts` con la llave REAL, con Connect sin activar. Hubo 17 intentos fallidos en `/datos/billetera/conectar`, del 27 oct 03:28 al 30 oct 22:02 (UTC). Todos devolvieron «temporarily restricted… suspicious activity». La prueba s11 del diagnóstico NO fue: ya se negaba con la llave real.
- **Arreglo:** `exigirConnect()` en `apps/servidor/src/rutas/dinero.ts`. Con la llave real no se llama a Stripe hasta que la variable `STRIPE_CONNECT_ACTIVO=1` esté puesta en el sitio. Mientras tanto responde 409: «Los cobros a tu cuenta bancaria todavía no están activados. Tu saldo está a salvo…». Con `sk_test_` (sitio de pruebas) sigue igual.
- **Candado de pruebas internas:** `connectApagado.test.ts` revisa que toda ruta de `diagnostico.ts` que use Stripe exija `startsWith('sk_test_')`. Las dos pruebas se comprobaron en rojo.
- **Para encender Connect:** primero Richard activa Connect y confirma en el panel de Stripe. Después se pone `STRIPE_CONNECT_ACTIVO=1` en YaDominios Cloud y se republica. No antes.

## C-RELOJ-SOLO-FALLAS — el reloj guarda solo lo que falló (7 nov 2026, todos los países)

- **Qué se rompía:** el parte de consumo de YaDominios del 6 nov (UTC) puso la base de pruebas en el 72 % de las escrituras de la cuenta: 152.794 filas escritas y 390,7 millones leídas. La que más escribía era `INSERT OR REPLACE INTO reloj_tareas`, con 62.424 filas.
- **Causa real:** `anotarTareas` guardaba una fila por tarea en cada vuelta del reloj, también las buenas. Son unas 43 por minuto, y la tabla llegó a 212.667 filas. Cada minuto, la limpieza `DELETE FROM reloj_tareas WHERE creado_en < -7 días` recorría la tabla entera, porque solo hay índice para las fallidas. Además, `saludReloj` leía 261.202 filas por llamada: MAX sobre todo `tareas_programadas` más un EXISTS por fila, y un COUNT y un ORDER BY sin índice.
- **Qué se hizo:**
  - `anotarTareas` guarda SOLO las tareas fallidas. La vuelta buena ya queda en `tareas_programadas`.
  - La limpieza borra por tandas de 5.000 las filas buenas que quedaron y las fallas de más de 7 días.
  - `saludReloj` camina el índice de `empezada_en` desde la vuelta más nueva, con LIMIT 1 y una ventana de 25 horas.
  - Medido contra la base de pruebas: la salud pasó de 261.202 a 392 filas leídas.
- **Candado:** `apps/servidor/src/reloj.test.ts`.
  - «anotarTareas no escribe nada si todas salieron bien…» se comprobó en rojo devolviendo el filtro a todas las tareas.
  - «vueltas buenas no escriben… y la limpieza quita las filas buenas viejas».
  - El diagnóstico de staging espera 1 fila, no 3.
- **No tocar:** no volver a guardar las tareas buenas en `reloj_tareas`. No agregar a la salud consultas sin la ventana de `empezada_en`.

## C-PRESUPUESTO-FILAS y C-SIN-CARGA-NUBE: orden de Gerencia del 7 nov 2026 (todos los países)

- **Qué midió Gerencia** (API de métricas de Cloudflare, del 31 oct al 7 nov), en la base `site-tumbite-pruebas-db`:
  1. Unas 5 millones de filas escritas por la prueba de carga S3. Usa tablas `zz_s3_*`, un INSERT … WITH RECURSIVE de 10.000 filas y un UPDATE de todas.
  2. 484.000 filas del INSERT OR REPLACE de reloj_tareas.
  3. 2.546 millones de filas leídas por la limpieza de reloj_tareas, que corría en cada vuelta.
- **Qué se hizo:**
  - **C-SIN-CARGA-NUBE:** `POST /datos/interno/diagnostico/s3` solo corre en localhost. En la nube responde «omitida» sin tocar la base. `scripts/staging/probar-staging.mjs`, que corre en cada publicación de rama, ya no la llama. Ninguna prueba de carga va contra una base de la nube.
  - **Limpieza una vez al día:** la limpieza de `tareas_programadas`, `reloj_tareas` y `lotes_ubicacion` corre solo en la vuelta de las 04:00 UTC (`esVueltaDeLimpieza`).
    - Las fallas viejas se borran con `ok = 0 AND creado_en < …`, por el índice parcial `reloj_tareas_fallidas(creado_en) WHERE ok = 0`.
    - Las filas buenas que quedaron de antes se borran por tandas de 50.000.
    - En cada minuto solo queda el borrado de `peticiones_internas`, que va por índice y lee 1 o 2 filas.
  - **C-PRESUPUESTO-FILAS** (`apps/servidor/src/presupuestoFilas.ts`): el reloj corre sus tareas con la base envuelta, que suma las filas leídas y escritas que informa D1.
    - El tope por vuelta es de 2.000 escritas y 250.000 leídas.
    - Si se pasa, las tareas que faltan no corren. La vuelta queda con «presupuesto» fallida en reloj_tareas, y la salud del reloj lo ve.
- **Pruebas** (comprobadas en rojo):
  - `reloj.test.ts`, «C-PRESUPUESTO-FILAS…»: una tarea que escribe 3.000 filas frena a la siguiente.
  - `reloj.test.ts`, «C-RELOJ-SOLO-FALLAS…»: la limpieza corre solo a las 04:00.
  - `rutas/diagnostico.test.ts`, «C-SIN-CARGA-NUBE».
- **No tocar:**
  - No volver a llamar S3 ni ninguna carga masiva contra staging ni contra producción.
  - No poner la limpieza otra vez en cada vuelta.
  - No subir los topes sin medir antes.

## C-RELOJ-PRUEBAS-PAUSA: el reloj del sitio de pruebas en pausa (7 nov 2026, todos los países)

- **Por qué:** Richard puso Divoox en pausa, así que el sitio de pruebas no debe gastar nada. El reloj de pruebas corría unas 72 veces por hora. Lo llamaban GitHub cada 5 minutos y el reloj externo de Cloudflare (`tumbite-reloj`) cada minuto.
- **Qué se hizo:**
  - `RELOJ_PRUEBAS_EN_PAUSA = true` en `apps/servidor/src/reloj.ts`. Con eso, `/datos/reloj` y `/datos/interno/reloj` en el sitio de pruebas responden `{ ok: true, pausado: true }` sin tocar la base. La salud muestra el reloj «pendiente».
  - El paso «Pruebas» de `.github/workflows/reloj.yml` quedó comentado.
  - Producción no cambia.
  - El lint de `presupuestoFilas.ts` (security/detect-object-injection) se arregló sin apagar la regla: `run` y `all` se llaman por su nombre.
- **Para encenderlo al retomar:**
  1. Poner `RELOJ_PRUEBAS_EN_PAUSA` en false.
  2. Descomentar el paso «Pruebas» del reloj de GitHub.
  3. Publicar.
  4. Comprobar que la salud de pruebas diga reloj «ok» a los 5 minutos.
- **Mientras dure la pausa:** las ofertas a repartidores que dependen del reloj NO se reparten solas en el sitio de pruebas.
- **Prueba:** `reloj.test.ts`, «C-RELOJ-PRUEBAS-PAUSA». Se comprobó en rojo con el interruptor en false.

## C-PRUEBAS-SIN-INDEXAR: el sitio de pruebas no sale en Google (8 nov 2026, Richard) — todos los países

- **Qué pasaba:** staging.tumbite.com servía una copia entera de la web de Divoox (portada, Docs, llms.txt, mapa del sitio) con `robots.txt` abierto y sin noindex. Google podía indexarla como contenido duplicado de divoox.com.
- **Qué se hizo:** `scripts/sin-indexar.mjs` corre SOLO al armar el paquete de pruebas (`scripts/empaquetar.sh pruebas`): `robots.txt` con `Disallow: /` y `<meta name="robots" content="noindex, nofollow">` en cada página. El servidor manda `X-Robots-Tag: noindex, nofollow` en todo lo que responde en pruebas (`app.ts`).
- **Candado:** `scripts/verificar-paquete.mjs` rechaza un paquete de pruebas sin noindex o con robots abierto, y rechaza un paquete de PRODUCCIÓN con noindex o robots cerrado. Prueba `app.test.ts` bloque C-PRUEBAS-SIN-INDEXAR (comprobada en rojo).
- **tumbite.com (producción):** sigue con lo de C-DOMINIO-DIVOOX: cada página lleva canónica a divoox.com y salta en el navegador (`dominio.js`); la API `/datos` sigue en tumbite.com porque las apps de las tiendas la llaman. La plataforma sirve las páginas fijas antes que el servidor, por eso no hay 301 de servidor en esas páginas.
- **Cómo se comprueba:** `curl -s https://staging.tumbite.com/robots.txt` dice `Disallow: /` y la portada de pruebas trae `name="robots" content="noindex`.
- **No tocar:** nunca correr sin-indexar sobre el paquete de producción.

## C-ENTRADAS-CON-FOTO: las tres entradas de la portada llevan foto real, sin íconos rojos (8 nov 2026, Richard) — todos los países

- **Qué pidió Richard:** los íconos rojos se leen como error o algo parado; las tres tarjetas («Quiero pedir comida», «Tengo un restaurante», «Quiero repartir») tenían que ser más atractivas.
- **Qué se hizo:** cada tarjeta lleva foto arriba (`apps/panel/public/marca/entradas/comida.webp`, `restaurante.webp`, `repartir.webp`, recortadas de las fotos de marca ya aprobadas), una etiqueta blanca con el público (Clientes / Restaurantes / Repartidores) y el botón con flecha. Todos los íconos de la portada (`.ld-icono`) pasan a negro sobre gris claro.
- **Candado:** `Landing.test.tsx` bloque C-ENTRADAS-CON-FOTO (comprobada en rojo): tres tarjetas, cada una con su foto y ninguna con `.ld-icono`.

## C-ALARMA-SIEMPRE: la alarma de pedidos del panel del restaurante suena sola (8 nov 2026, Richard) — todos los países

- **Qué se rompió:** el primer pedido de la prueba de las tres apps (E140, staging) entró pagado con el panel abierto y no sonó. A los 6 minutos el encargado automático lo canceló (regla `REGLAS.cancelar`).
- **Causa real:** `Pedidos.tsx` arrancaba con la alarma apagada (`sonido = false`) y solo sonaba si alguien tocaba «Activar sonido de alarma».
- **Qué se hizo:** la alarma nace encendida; con un pedido nuevo intenta sonar sola (entrar al panel ya cuenta como toque para el navegador). Si el navegador la bloquea, sale el aviso grande «El navegador silenció la alarma. Toca aquí…» y cualquier toque en la página la destraba.
- **Candado:** `apps/panel/src/panel/PedidosAlarma.test.tsx` (comprobada en rojo con el código viejo).
- **Cómo se comprueba:** en staging, panel del restaurante abierto, pedido nuevo → suena sin tocar nada.

## C-REPARTIDOR-UN-TELEFONO: un repartidor, un solo teléfono (8 nov 2026, Richard) — todos los países

- **Qué se rompió:** en la prueba de las tres apps, Richard entró con la misma cuenta de repartidor en dos teléfonos y los dos recibieron la misma oferta.
- **Qué se hizo:** `rutas/cuentas.ts` (`/entrar`): si la cuenta es de repartidor, al entrar se borran sus otras sesiones; el teléfono anterior recibe 401 y vuelve a la pantalla de entrar. Como Uber y DoorDash. Clientes, restaurantes y empresas siguen pudiendo tener varias pantallas.
- **Candado:** `cuentas.test.ts` bloque C-REPARTIDOR-UN-TELEFONO (comprobada en rojo).

## C-OFERTA-SUENA: la oferta al repartidor suena en la web (8 nov 2026, Richard) — todos los países

- **Qué se rompió:** la oferta llegó a los teléfonos (versión web) sin sonar: solo vibraba, y Safari en el iPhone no vibra.
- **Qué se hizo:** `apps/repartidor/src/sonidoOferta.ts`; `grandes/Oferta.tsx` y `viajes/OfertaViaje.tsx` lo llaman al mostrar la oferta. En las apps de las tiendas falta el sonido con la app abierta (va con la próxima compilación, que pide permiso a Gerencia).
- **Candado:** `apps/servidor/src/repartidorWeb.test.ts` (comprobada en rojo).

## C-COMANDA-COMPLETA: la comanda de cocina completa, en 58 u 80 mm (8 nov 2026, Richard) — todos los países

- **Qué se rompió:** la comanda del panel salía sin el nombre del restaurante (`Pedidos.tsx` le pasaba `''`) y muy pobre: número, hora y platos con las opciones entre paréntesis. Sin hora de listo, sin total de artículos, sin la preferencia «si no hay» y con las exclusiones mezcladas en la misma línea. Solo 80 mm.
- **Qué se hizo:** `packages/compartido/src/comanda.ts`: `estructuraComanda` arma UNA vez lo que va en el papel (restaurante, número grande, tipo con «PEDIDO DE PRUEBA», programado, nombre corto, hora del pedido y «Listo a las» = aceptado + `tiempoPrepMin`, cada plato con su cantidad y debajo cada opción sangrada: «+ Extra queso», «SIN CEBOLLA» en mayúscula y negrita, «CON tomate», la nota del plato y `notaSustitucion`; alergias en recuadro; total de artículos; pie «Divoox»). `htmlComanda(p, restaurante, idioma, ahora, { imprimirAlAbrir, ancho: 58 | 80 })` la dibuja (`@page` y letra por ancho; `COLUMNAS_COMANDA` 32/48). El panel lee `id` y `nombre` de `/datos/mi-restaurante` y pasa el nombre real; selector «Ancho del papel» guardado en `localStorage` (`divoox.anchoComanda.<id del restaurante>`, con try/catch). Las notas del pedido siguen fuera (LAN-3x). Ficha: `docs/investigaciones-rea/2026-11-08-comanda-cocina-e-impresora.md`. Docs: guía «print-tickets» es/en con capturas nuevas `comanda-ticket-80mm-*` y `comanda-ticket-58mm-*`.
- **Pruebas (comprobadas en rojo el 8 nov):** `packages/compartido/src/comanda.test.ts` bloque C-COMANDA-COMPLETA; `apps/panel/src/panel/PedidosComanda.test.tsx` (nombre real en la comanda, ancho guardado por restaurante).
- **Cómo se comprueba a mano:** Pedidos → «Enviar un pedido de prueba» → aceptar → «Imprimir comanda»: arriba el nombre del restaurante; las opciones debajo del plato; cambiar a 58 mm y el papel sale angosto.
- **Qué NO tocar:** una sola pieza para panel y app; nunca dinero, dirección ni las notas del pedido; el nombre del restaurante nunca vacío en el panel.

## C-IMPRESORA-NAVEGADOR: conectar la impresora de tickets desde el navegador (8 nov 2026, Richard) — todos los países

- **Qué faltaba:** el panel solo imprimía con el cuadro de impresión del navegador; DoorDash y Uber Eats imprimen directo en la impresora de la tableta.
- **Qué se hizo:** `packages/compartido/src/escpos.ts`: `escposComanda(estructura, ancho)` hace el ticket ESC/POS con los mismos datos que el HTML (ESC @, página de códigos 850 con ESC t 2, negrita, doble alto/ancho, alergias en blanco sobre negro, avance y corte parcial GS V 66 0) y `escposPrueba`. `apps/panel/src/panel/impresora.ts`: WebUSB (primer punto de salida «bulk», envíos de 4 KB) y Web Serial (9600 baudios), una conexión por página, `useImpresora`, y reconexión sola al volver con `navigator.usb.getDevices()` / `navigator.serial.getPorts()` según el tipo guardado (`divoox.impresora.tipo`). `apps/panel/src/panel/comanda.ts`: `imprimirComanda` manda a la impresora conectada; sin impresora o si falla, abre la impresión del navegador con el ancho elegido y devuelve `navegador-por-fallo` (el panel lo avisa). En Pedidos: «Conectar impresora (USB)», «Conectar por puerto serie o Bluetooth», «Impresora conectada», «Imprimir prueba», «Desconectar»; sin soporte (Safari, Firefox, celulares) explica que sale por el navegador. «Imprimir la comanda al aceptar» usa la impresora conectada.
- **Pruebas (comprobadas en rojo el 8 nov):** `packages/compartido/src/escpos.test.ts` (bytes de inicio y corte, mismos datos, renglones dentro de 32/48 columnas, página 850); `apps/panel/src/panel/comanda.test.tsx` (sin impresora → navegador con el ancho; con impresora → ESC/POS sin ventana; si falla → navegador; reconexión por puerto serie); `apps/panel/src/panel/PedidosComanda.test.tsx` (conectar USB, imprimir directo, «Imprimir prueba»).
- **Cómo se comprueba a mano:** Chrome en computadora con una impresora térmica USB → Pedidos → «Conectar impresora (USB)» → elegirla → «Imprimir prueba» sale un ticket corto con el ancho; recargar la página y sigue «Impresora conectada».
- **Qué NO tocar:** nunca quitar la caída a la impresión del navegador (una comanda no se pierde); la comanda ESC/POS y la HTML salen de `estructuraComanda`, nunca de dos armados distintos. En Windows, si el sistema ya tiene el controlador de la impresora, WebUSB puede no poder tomarla: ahí se usa el puerto serie o la impresión del navegador.

## C-POSICION-SIN-REESCRIBIR: la posición del repartidor no reescribe la base en cada lectura (9 nov 2026, parte de consumo de YaDominios) — todos los países

- **Qué se rompió:** el 8 nov la base de pruebas escribió 10.480 filas solo con `UPDATE repartidores SET lat, lng, zona_id, area_id, geohash…`, con el reloj de pruebas ya en pausa.
- **Causa real:** la app del repartidor en el navegador ignora el «cada 10 s / 30 m» del GPS (`watchPositionAsync` en web dispara con cada lectura) y además, en camino, manda cada 5 s. La ruta `/datos/repartidor/ubicacion` reescribía la ficha siempre, y cada UPDATE pesa unas cinco filas por los índices de `repartidores`. Dos teléfonos con la misma cuenta durante la prueba de las tres apps lo multiplicaron.
- **Arreglo:** `hayQueReescribirPosicion` en `rutas/operacion.ts`: solo se escribe si se movió 25 m o más, o si la última posición tiene 60 s o más. Las muestras recientes y los hitos siguen igual. Todos los umbrales de «sin señal» (Manager 10 min, operaciones 5 min, despacho 10 min) son de minutos, así que el refresco de 60 s no los toca.
- **Prueba:** `apps/servidor/src/posicionSinReescribir.test.ts`, comprobada en rojo devolviendo siempre «escribir».
- **No tocar:** no bajar el freno a cero ni quitarlo «para tener la posición más fresca»: el mapa del cliente ya lee cada pocos segundos y 25 m es menos de una cuadra.

## C-DISPONIBLE-MUNDO: la app dice dónde funciona Divoox y nadie queda fuera del registro (10 nov 2026, pedido de Richard, punto B2) — todos los países

- **Qué se hizo:** `GET /datos/disponibilidad` (`rutas/zonas.ts`) responde los países con ciudades encendidas (nombre del país en es/en desde `packages/compartido/src/paisesNombres.ts`) y lo que abre pronto; solo lee. La lista de espera (`rutas/espera.ts`) guarda además `pais`, `lat`, `lng` y `origen` (`web`/`app`), y quien ya entró a su cuenta pasa sin el escudo web (las apps no tienen el recuadro; el límite de intentos sigue). `PUT` y `GET /datos/mi-restaurante` devuelven `cobertura: dentro|fuera|sin_punto`: informa, nunca bloquea. Piezas únicas: apps `packages/movil/src/Disponibilidad.tsx` (`DondeFunciona` en el registro de `Acceso`, `AvisameCuandoLlegue` en `EstadoCatalogo` del cliente cuando la dirección está fuera de zona); web `apps/panel/src/panel/TraerDivoox.tsx` (`DondeFuncionaWeb` en el registro del panel y «Quiero traer Divoox a mi ciudad» en «Mi restaurante» cuando el local cae fuera de cobertura); el buscador de la portada también dice dónde ya funciona. El superadmin ve país y origen de cada anotación y el conteo por país (`AdminEspera`).
- **Fuente del estándar:** [OBS] DoorDash y Uber Eats muestran «no llegamos a tu zona todavía» con un formulario de correo para avisar, y sus páginas para comercios aceptan el registro desde cualquier ciudad y responden después.
- **Pruebas (comprobadas en rojo el 10 nov, antes de construir):** `apps/servidor/src/rutas/disponibilidad.test.ts` (cinco casos: lista por país, ciudad apagada no se anuncia, «Avísame» desde la app con sesión y sin escudo, país y origen para el superadmin, restaurante de Chile se registra y recibe `cobertura: fuera`) y `apps/panel/src/panel/TraerDivoox.test.tsx`.
- **Cómo se comprueba a mano:** en la app del cliente poner una dirección de otra ciudad (por ejemplo Santiago): debajo de «Todavía no llegamos a tu zona» sale el formulario «Avísame cuando llegue»; al enviarlo, confirma en verde. En el panel, un restaurante con dirección fuera de cobertura ve la tarjeta «Quiero traer Divoox a mi ciudad».
- **Qué NO tocar:** no agregar ninguna validación de país al registro (`esquemaRegistro` no lleva país a propósito). No quitar el salto del escudo para quien tiene sesión: sin él la app nativa no puede anotarse. Un país nuevo se enciende con su zona (`zonas.activa`) y aparece solo en la lista.
- **Tiendas (pendiente, [para: tiendas-lanzamientos]):** abrir las tres apps a todos los países en Google Play y App Store NO se hizo. Google tiene revisión en curso (candado `play-en-revision`) y Apple está congelada en la compilación 30. Cuando Google apruebe: Play Console → cada app → Producción → Países y regiones → agregar todos; en App Store Connect → Precios y disponibilidad → todos los países, junto con la próxima versión. Pasa antes por el auditor de tiendas.

## C-FLOTA-PROPIA: el restaurante reparte con sus propios repartidores y ellos reciben solo sus pedidos (10 nov 2026, pedido de Richard, punto B3) — Chile y todos los países

- **De dónde sale:** ficha `docs/investigaciones-rea/2026-11-10-flota-propia-restaurante.md` ([DOC] DoorDash Self-Delivery y Drive, Uber Eats con repartidores propios; Rappi y PedidosYa sin página oficial, [NV]). Caso real: un restaurante de Chile con 14 repartidores.
- **Qué se hizo:** tablas `flota_restaurante` e `invitaciones_flota`; columnas `restaurantes.flota_modo` (`divoox`/`propia`), `restaurantes.flota_respaldo` y `pedidos.flota_aviso_en`. Rutas en `apps/servidor/src/rutas/flota.ts`: el restaurante ve y cambia el modo (`GET/PUT /datos/mi-restaurante/flota`), invita con enlace y correo (mismo mecanismo que Flex, solo se guarda el hash del token), cancela invitaciones y retira repartidores; el repartidor ve y responde sus invitaciones (`/datos/repartidor/flota…`) o acepta con el enlace; página pública `/driver/fleet/<token>` (`apps/panel/src/sitio/InvitacionFlota.tsx`). Despacho (`repartirOfertas` en `rutas/operacion.ts`): con `flota_modo = 'propia'` el pedido se ofrece solo a los repartidores activos de ese restaurante (sin mirar zona, saldo prepago ni catálogo: les paga el restaurante); un repartidor de flota propia nunca recibe pedidos de otro restaurante (`flotasActivas`); si nadie de la flota está libre y el respaldo está encendido, pasa a la red de Divoox; con el respaldo apagado NO cae solo a la red: se marca `flota_aviso_en`, se avisa al dueño una sola vez y el panel lo muestra en «Pedidos esperando a tu equipo». Panel: `apps/panel/src/panel/Flota.tsx` en `/panel/fleet` («Mis repartidores»), que solo aparece en el menú donde está disponible (C-SOLO-LO-TERMINADO). App Driver: `apps/repartidor/src/InvitacionesFlota.tsx` en el inicio, y el recuadro «pega su enlace» acepta también el enlace del restaurante.
- **Encendido:** solo en el sitio de pruebas (`flotaPropiaDisponible`: entorno de pruebas o variable `FLOTA_PROPIA=1`). En producción `PUT` con `propia` responde 409 y el menú no muestra la pantalla. Se enciende en producción cuando Richard decida el reparto del dinero (👤 en PENDIENTES.md).
- **Pruebas (comprobadas en rojo el 10 nov quitando el filtro del despacho: tres fallaron):** `apps/servidor/src/rutas/flota.test.ts` (siete casos) y `apps/panel/src/panel/Flota.test.tsx` (cuatro).
- **Cómo se comprueba a mano:** en staging, entrar al panel de un restaurante → «Mis repartidores» → invitar con el correo de una cuenta de Driver → en Divoox Driver aparece la invitación → Aceptar → en el panel elegir «Mis propios repartidores» y Guardar → hacer un pedido: la oferta le llega solo a ese repartidor.
- **Qué NO tocar:** no quitar el filtro `flotas.get(d.id) ?? p.restaurante_id` (es lo que evita que un repartidor propio reciba pedidos ajenos). No hacer que un pedido de flota propia caiga a la red sin el respaldo encendido. La exclusividad vale solo mientras el restaurante esté en modo `propia`. El dinero con flota propia no se cambió: no tocarlo sin la decisión de Richard.

## C-PERFIL-CHILE: el perfil de Chile vive en una sola pieza y nace apagado (10 nov 2026, pedido de Richard, punto B4) — Chile

- **De dónde sale:** ficha `docs/investigaciones-rea/2026-11-10-perfil-chile.md` (fuentes [DOC]; sin ejecución de REA, dicho en la ficha). Mercado: PedidosYa, Uber Eats y Rappi.
- **Qué se hizo:** `packages/compartido/src/perfilChile.ts`: `PERFIL_CHILE` con `activo: false`, moneda CLP sin decimales, IVA 19 % incluido en el precio, celular +56 9 y ocho cifras, dirección con comuna y región, formas de pago habituales (tarjeta, Webpay, Mercado Pago, MACH, transferencia; ninguna conectada), documentos del restaurante y del repartidor, lo pendiente de la Ley 21.431, y `cobro.procesador: null`. Validadores `rutValido` (módulo 11) y `telefonoChileValido`. `DECIMALES_MONEDA` y `REGION_MONEDA` conocen CLP; `MONEDA_POR_PAIS` declara `CL: 'CLP'`; el número fiscal de Chile es el RUT (`numeroFiscalDe`, `numeroFiscalValido`).
- **Apagado:** no hay zona de Chile ni tarifas ni topes (`paisIncompleto` impide encender una zona sin ellos), no aparece en los selectores de país de Flex y no hay procesador. Encenderlo depende de Richard (cuenta de cobro local, 👤 en PENDIENTES.md) y de la revisión legal.
- **Prueba:** `packages/compartido/src/perfilChile.test.ts` (apagado y sin procesador, CLP sin decimales, RUT, celular, dirección y documentos).
- **Qué NO tocar:** no poner `activo: true` ni un procesador sin la cuenta de Richard. No usar las comisiones de Argentina como cifra de Chile (la ficha lo advierte). Los montos en CLP van en pesos enteros, nunca multiplicados por cien.

## C-CANCELAR-LISTO: un pedido ya listo se cancela pidiéndolo a soporte, con motivo y con quién asume la comida (10 nov 2026, pedido de Richard, punto D1) — todos los países

- **Qué pasaba:** en la prueba de las tres apps del 8 nov, el restaurante no tenía cómo cancelar un pedido que ya estaba «listo» (la opción «Rechazar» solo existe en pagado y aceptado, y está bien que así sea). El pedido de prueba 407F quedó así en staging: no se tocó.
- **Cómo lo hacen los grandes (ficha `docs/investigaciones-rea/2026-11-10-cancelar-pedido-listo.md`):** [DOC] DoorDash: el comercio cobra solo si el pedido estaba preparado y la cancelación no fue por su causa, con una lista de motivos; con caja integrada debe llamar a soporte. [DOC] Uber Eats: motivos cerrados en su API (agotado, cocina cerrada, el cliente llamó, muy ocupado, otro).
- **Qué se hizo:** `packages/compartido/src/motivosCancelacion.ts` (seis motivos, cada uno con quién asume la comida: restaurante, cliente, Divoox o por definir). Tabla `solicitudes_cancelacion`. Rutas en `apps/servidor/src/rutas/cancelaciones.ts`: `POST /datos/restaurante/pedidos/:id/pedir-cancelacion` (solo en `listo`, motivo de la lista, «otro» exige detalle, una pendiente por pedido; abre un caso de soporte con el pedido en prioridad alta y anota el evento), `GET /datos/restaurante/cancelaciones`, `GET /datos/admin/cancelaciones` y `POST /datos/admin/cancelaciones/:id/aprobar|rechazar`. Aprobar usa `cancelarConReembolso` (el cliente recibe todo su dinero), anota `cancelado_por_soporte` con el motivo y quién asume la comida, y avisa al restaurante; rechazar deja el pedido en curso. La lista de pedidos del restaurante trae `cancelacion` (estado de la última solicitud). Pantallas: panel `PedirCancelacion.tsx` dentro de los tres puntos de `Pedidos.tsx`; app del restaurante `apps/restaurante/src/PedirCancelacion.tsx` (hoja con los motivos); soporte `SolicitudCancelacion.tsx` en la ficha del pedido (`SuperPedido.tsx`).
- **Dinero:** la aprobación devuelve el total al cliente, como ya hacía la cancelación de soporte. Quién asume la comida queda REGISTRADO en la solicitud y en la bitácora, pero no mueve dinero todavía: es decisión de Richard (👤 en PENDIENTES.md). No se tocó Stripe.
- **Pruebas (comprobadas en rojo el 10 nov, antes de construir: cinco fallaron):** `apps/servidor/src/rutas/cancelaciones.test.ts` (seis casos) y `apps/panel/src/panel/PedirCancelacion.test.tsx` (dos).
- **Cómo se comprueba a mano:** en staging, llevar un pedido de prueba con tarjeta 4242 hasta «listo» → en el panel del restaurante, tres puntos → «Pedir cancelación a soporte» → elegir motivo → enviar. En el panel de soporte, abrir el pedido: aparece la solicitud; aprobar → el pedido queda cancelado y el cobro anulado en Stripe de prueba.
- **Qué NO tocar:** el restaurante sigue sin poder cancelar un pedido listo por su cuenta (`/rechazar` responde 409 en `listo`): no ampliar ese `desde`. Con el repartidor ya en camino no se pide cancelación desde el restaurante. No aprobar con la comida «por definir».

## C-ELEGIR-MAPAS: «Cómo llegar» deja elegir la app de mapas también en comida y en viajes (10 nov 2026, pedido de Richard, punto D2) — todos los países

- **Qué pasaba:** en comida, «Cómo llegar» abría Apple Maps en el iPhone y Google Maps en Android, sin preguntar y sin Waze. En Flex ya se podía elegir (C-FLEX-MAPAS, como Amazon Flex). Había tres copias de la misma lógica (comida, viajes y Flex).
- **Qué se hizo:** `packages/compartido/src/mapas.ts` (`appsDeMapa`: Google Maps y Waze; en el iPhone además Apple Maps, primero) y la pieza única `apps/repartidor/src/comoLlegar.ts`, que muestra la ventanita nativa «Elige la app de mapas». La usan comida (`Inicio.tsx`: al restaurante, al cliente y en pedidos agrupados), viajes (`ViajeActivo.tsx`) y Flex (`MiRuta.tsx`). En la web abre Google Maps (no hay otra app que elegir).
- **Prueba:** `packages/compartido/src/mapas.test.ts`: las apps por plataforma, la navegación por dirección escrita y el candado que revisa que ninguna pantalla de `apps/repartidor/src` arme por su cuenta un enlace de Apple Maps, Google Maps o Waze (comprobado en rojo el 10 nov con un archivo de más).
- **Qué NO tocar:** no volver a escribir enlaces de mapas dentro de una pantalla: todo pasa por `comoLlegar`. El cambio entra a los celulares con la próxima compilación de Driver (ninguna compilación sin permiso de Gerencia).

## C-CAMARA-EN-TODA-SUBIDA: toda casilla de subir imagen ofrece «Tomar foto» (regla global de Richard del 9 nov 2026, punto D8; hecho el 10 nov) — todos los países

- **Qué pasaba:** varias casillas solo dejaban elegir un archivo. Desde el celular no había cómo tomar la foto del plato o del problema.
- **Qué se hizo, web:** pieza única `apps/panel/src/panel/camara.tsx` (`BotonCamara`): en el celular abre la cámara trasera del teléfono; en la computadora, la cámara web en una ventanita con su botón «Tomar la foto»; sin cámara o sin permiso lo dice en palabras y se sigue con los archivos. `SubirFoto.tsx` (la casilla de las fotos de platos, productos y del restaurante) ahora tiene dos botones, «Subir desde archivos» y «Tomar foto»; la foto de la cámara pasa por la misma validación y compresión. `VerificacionPanel.tsx` ya abría la cámara del celular con `capture`.
- **Qué se hizo, apps:** pieza única `packages/movil/src/camara.ts` (parte nativa) sobre `camaraLogica.ts` (lógica probada sola): `fotoConCamara` y `capturasConCamara` preguntan «Tomar foto» o «Subir desde archivos», piden el permiso y entregan la foto. La usan: la foto del plato en la app del restaurante (`MiMenu.tsx`), la foto de un problema con el pedido en la app del cliente (`order/[id].tsx`) y las capturas de «Mis casos de ayuda» en las tres apps. La app del restaurante ahora declara el permiso de cámara (`apps/restaurante/app.json`).
- **Pruebas:** `apps/panel/src/panel/camara.test.tsx` (celular, computadora, sin permiso, y los dos candados que recorren el código: toda casilla web de imagen lleva `BotonCamara` o `capture`, y todo archivo de las apps que abre la galería usa `fotoConCamara` o `capturasConCamara`; el de las apps se vio en rojo con cinco archivos antes del arreglo) y `apps/servidor/src/camaraApps.test.ts` (la pieza de las apps).
- **Qué NO tocar:** ninguna casilla de imagen nueva con un `<input type="file">` o un `launchImageLibraryAsync` sueltos: siempre con la pieza. El candado de fotos compatibles (`heicApps.test.ts`) sigue igual.
- **Tiendas ([para: tiendas-lanzamientos] y auditor):** la app Restaurants pide ahora el permiso de cámara (antes lo tenía apagado). Entra con la próxima compilación; revisar la declaración de permisos y el texto antes de enviarla. En las apps el cambio llega con la próxima compilación (ninguna sin permiso de Gerencia); la web ya lo tiene al publicar.

## C-ENLACE-INVITACION: el enlace de invitación de un repartidor abre su página, no la app Driver (10 nov 2026) — todos los países

- **Qué se rompió y cómo se veía:** el enlace que una empresa de Flex le manda a su conductor (`/driver/join/<código>`) abría la app web Divoox Driver, que respondía «página no existe». Estaba así en producción (comprobado el 10 nov: la dirección devolvía la app Driver). Lo destapó el recorrido en el navegador del enlace nuevo de flota propia (`/driver/fleet/<código>`).
- **Causa real:** `raizDeApp` (`apps/servidor/src/app.ts`) manda todo lo que empieza por `/driver/` a la app Driver; las dos páginas de invitación viven en el sitio.
- **Arreglo:** `raizDeApp` devuelve la raíz del sitio para `/driver/join/…` y `/driver/fleet/…`.
- **Prueba:** `apps/servidor/src/app.test.ts` (comprobada en rojo antes del arreglo) y el recorrido `e2e/recorrido/novedadesNov10.spec.ts`, que abre el enlace en el navegador.
- **No tocar:** una página pública nueva bajo `/driver/`, `/app/` o `/restaurant/` necesita su excepción aquí y su paso en un recorrido; una prueba de componente sola no ve este fallo.

## Revisión de calidad del 10 nov 2026 (una pasada por paquete): lo que se corrigió — todos los países

- **Flota propia y cobro directo:** el despacho de flota propia ahora aplica el mismo filtro de saldo que la aceptación (`conSaldoParaDirecto`), para no ofrecer un pedido en efectivo que después no se puede aceptar. El reparto del dinero con flota propia sigue siendo decisión de Richard.
- **Flota propia, invitaciones:** invitar exige que la flota esté disponible en ese entorno (409 en producción), hay un tope de 30 invitaciones por restaurante cada 24 horas, e invitar otra vez a la misma persona reemplaza la pendiente. Aceptar exige que siga pendiente. Deuda anotada: la coincidencia por celular no exige celular verificado (igual que en Flex).
- **Cancelar un pedido listo:** al aprobar se avisa también al repartidor asignado (`avisarAlRepartidor`), y un índice único impide dos solicitudes pendientes del mismo pedido.
- **Lista de espera:** la sesión reemplaza al escudo web solo para anotar el correo de la propia cuenta; en la app, con la cuenta abierta, el aviso va siempre al correo de la cuenta.
- **Cámara web:** si se cierra la ventanita mientras el navegador pide el permiso, la cámara se apaga al llegar el permiso.
- **Comanda e impresora (COMANDA-8N-r):** cada envío a la impresora se comprueba y tiene tiempo límite de 8 segundos (si no responde, la comanda cae a la impresión del navegador), y los acentos «sueltos» de un texto pegado salen como su letra. Límite: no se probó con una impresora física.
- **Consentimiento de SMS (b099e59):** visto bueno; además, al cambiar el celular el permiso no pasa al número nuevo.
- **Pruebas nuevas:** en `flota.test.ts`, `disponibilidad.test.ts`, `smsConsentimiento.test.ts`, `escpos.test.ts` y `comanda.test.tsx`.

- **C-DISPONIBLE-MUNDO, ajuste del 10 nov tras verlo en vivo:** la zona interna «Novi (pruebas)» salía en la lista pública de ciudades (también en la frase «Ya estamos en» que ya existía). `/datos/disponibilidad` y `/datos/cobertura` ya no anuncian zonas cuyo nombre lleva «(pruebas)» o «(test)»; la zona sigue funcionando para el equipo. Prueba en `disponibilidad.test.ts`, comprobada en rojo. No se tocó ningún dato de producción.

## C-CIRCUITO-PAGOS-STAGING: el circuito de pagos de comida se prueba entero en el sitio de pruebas (punto A2, 10 nov 2026) — EE. UU.

- **Qué faltaba:** las piezas del cobro estaban probadas por separado (captura, propina, cambio de dirección, control dual), pero ninguna prueba en el sitio de pruebas recorría juntas la anulación por rechazo, la cancelación de un pedido listo por soporte, el reembolso parcial de una queja y el reparto en las billeteras.
- **Qué se hizo:** `e2e/recorrido/circuitoPagosStaging.spec.ts`, con Stripe en modo prueba de verdad: rechazo en «pagado» y en «aceptado» (autorización anulada), pedido listo que el restaurante no puede rechazar y soporte cancela a pedido suyo (C-CANCELAR-LISTO), compra completa con repartidor y captura al entregar, queja por un plato que faltó con UN reembolso parcial hecho por soporte, billeteras del restaurante y del repartidor, y la conciliación de los cuatro pedidos contra Stripe. Las piezas comunes de estas pruebas (cuentas, comercio, repartidor, pagar, repartir, cerrar) viven ahora en `e2e/recorrido/ayudaStaging.ts` y las usa también `domicilioStaging.spec.ts`.
- **Resultado del 10 nov (corrida 42924950320, dos intentos):** la prueba pasó las dos veces; en el primer intento fallaron tres pruebas ajenas por cortes del alojamiento y el segundo pasó entero; cifras, pedidos y pagos en `VERIFICAR-PAGOS.md`. No apareció ningún fallo de cobro.
- **Cómo se repite:** subir una rama `fase-*` (flujo `pruebas-rama`); el secreto de diagnóstico vive solo en GitHub, por eso no corre desde una computadora. Imprime una línea «A2-x» por paso.
- **Qué NO tocar:** la prueba solo LEE si los retiros y la cuenta de cobros están activos; no debe activar Connect ni retiros. No usa las cuentas demo de Novi ni el pedido 407F.

## C-RECORRIDO-SOLO-CONECTADOS: la limpieza del recorrido solo toca a los repartidores conectados (11 nov 2026, parte de consumo de YaDominios) — todos los países

- **Qué se rompió:** el 10 nov la base de pruebas subió a 12.420 filas escritas; la consulta culpable fue `UPDATE repartidores SET conectado = 0 WHERE zona_id = 'US-FL-MIAMI' …`, con 106.860 filas tocadas.
- **Causa real:** el recorrido automático (carpeta `e2e/recorrido`) desconecta a los repartidores de Miami antes de cada caso. La consulta reescribía a TODOS los repartidores de prueba acumulados en esa zona, aunque ya estuvieran desconectados, con sus índices.
- **Arreglo:** las cuatro limpiezas llevan `WHERE conectado = 1 AND …`: solo se escribe lo que cambia.
- **Prueba:** `packages/compartido/src/recorridoNoPisa.test.ts` (segundo bloque), comprobada en rojo quitando el filtro (4 fallos).
- **No tocar:** no quitar `conectado = 1` de esas limpiezas ni agregar otras sin ese filtro.

## Revisión para la prueba en la calle con tres celulares (11 nov 2026) — todos los países

### C-LISTO-SIN-AJUSTE: «Listo» espera la respuesta del cliente sobre el plato que falta

- **Qué pasaba:** el restaurante marcaba «Falta un plato» y, sin esperar al cliente, tocaba «Listo». Después `aplicarAjuste` solo acepta `pagado`/`aceptado`: el cliente ya no podía responder, el Manager fallaba en cada vuelta y el plato que faltaba se cobraba.
- **Causa:** `marcarListo` no miraba `ajustes_pedido`; solo `aceptarPedido` lo hacía.
- **Qué se hizo:** una sola guarda `sinAjustePendiente` en `operacion.ts`, usada por aceptar y por `marcarListo` (cubre app, panel y API de punto de venta): 409 «Espera a que el cliente decida sobre el plato que falta.» (en inglés ya traducido). La app del restaurante y el panel web esconden «Listo» mientras el ajuste está pendiente; el aviso de espera ya se ve en la tarjeta del pedido.
- **Pruebas:** `operacion.test.ts` («C-LISTO-SIN-AJUSTE»), `apps/panel/src/panel/PedidosListoAjuste.test.tsx` y `listoSinAjusteApp.test.ts`, las tres comprobadas en rojo.
- **No tocar:** no marcar «listo» por otro camino que no pase por `marcarListo`.

### C-REOFERTA-UNICO: con un solo repartidor, la oferta vuelve a quien la rechazó o la dejó vencer

- **Qué pasaba:** en `repartirOfertas` toda fila de `ofertas` del pedido sacaba para siempre a ese repartidor. Con un solo repartidor en la calle, un rechazo, una oferta vencida o un «soltar» dejaba el pedido en «Buscando repartidor…» sin fin.
- **Qué se hizo:** primero se busca entre quienes no la han visto (como siempre). Si no hay nadie, una segunda ronda admite a quien la vio hace más de 45 + 60 segundos (`SEGUNDOS_OFERTA + RESPIRO_REOFERTA`, medido desde `creada_en`). `soltarPedido` pone `creada_en` en la hora del abandono, para que el respiro cuente desde ahí. Nunca hay dos ofertas vivas del mismo pedido al mismo repartidor: la fila es una sola por (pedido, repartidor) y `libresEn` ya excluye a quien tiene una oferta `ofrecida`. La oferta abierta con bono sigue contando a todos los que la vieron.
- **Pruebas:** `operacion.test.ts`, las dos «C-REOFERTA-UNICO» (rechazo, vencimiento y soltar; y que con otro libre no vuelve a quien rechazó), comprobadas en rojo.
- **Efecto aparte:** si se le vuelve a ofrecer, la fila nueva reemplaza la del rechazo (las cuentas de aceptación por día ven la última respuesta).
- **No tocar:** no volver a excluir por cualquier fila de `ofertas` sin la segunda ronda; no quitar el `creada_en = datetime('now')` de `soltarPedido`.

### C-ACEPTAR-DOBLE-TOQUE: el segundo toque en «Aceptar» no muestra error

- **Qué pasaba:** al tocar dos veces «Aceptar» una oferta, el segundo toque encontraba la oferta ya `aceptada` y respondía 409 «Esta oferta ya no está disponible.»: el repartidor veía un error en rojo con el pedido ya en su mano.
- **Qué se hizo:** en `/repartidor/ofertas/:id/aceptar`, antes de mirar la oferta, si el pedido ya es de ese repartidor (aceptado, listo o en camino) responde `{ ok: true }`.
- **Prueba:** `operacion.test.ts` «C-ACEPTAR-DOBLE-TOQUE» (comprobada en rojo); también comprueba que otro repartidor sigue recibiendo 409.
- **No tocar:** la comprobación «ya es suyo» va antes de la de la oferta.

### C-QR-UNA-VEZ: el código QR del restaurante se lee una sola vez

- **Qué pasaba:** la cámara dispara `onBarcodeScanned` varias veces seguidas. La primera lectura verificaba el código y, si la foto ya estaba, el pedido salía (`en_camino`); la segunda llamada a `/verificar` encontraba el pedido fuera de `listo/aceptado` y dejaba «Este pedido no está contigo.» en rojo después del éxito.
- **Qué se hizo:** la app del repartidor tiene una guarda de un solo disparo (`qrLeido`), que se rearma al abrir el escáner. En el servidor, `/repartidor/pedidos/:id/verificar` acepta también un pedido suyo ya `en_camino`: con el código correcto responde `{ ok, correcto, salio: true }` sin escribir nada. Un código equivocado o un repartidor ajeno siguen con 409.
- **Pruebas:** `operacion.test.ts` («los 4 caracteres del número también valen…», con la segunda lectura) y `qrUnaVezApp.test.ts`, comprobadas en rojo.
- **No tocar:** no quitar la guarda ni el caso `en_camino` del verificador.

### C-PIN-SIN-FOTO: un pedido «en mano con PIN» no se entrega con foto

- **Qué pasaba:** la entrega con foto (`/repartidor/pedidos/:id/entregado` con imagen, en la puerta o en lugar seguro) no miraba `pines_entrega`, y la app ofrecía el botón de foto también en esos pedidos: el repartidor podía saltarse el PIN.
- **Decisión previa revisada:** en este archivo no hay ninguna decisión escrita de usar la foto como respaldo del PIN (C-PIN dice que «entregado en mano lo exige»). Por eso se cerró.
- **Qué se hizo:** `sinFotoConPin` en `pin.ts`, llamada antes de leer la foto: si el pedido tiene PIN sin usar, 409 «Este pedido se entrega en mano con el PIN del cliente. Pídeselo y escríbelo para entregar.» (con su inglés). Si el PIN quedó bloqueado por intentos, responde el mismo mensaje de siempre («Demasiados intentos con el PIN… confirme desde su app o escribe a soporte»): la foto tampoco abre esa puerta. La app del repartidor esconde «foto de la entrega» y «dejar en lugar seguro» cuando `pinRequerido`, y explica por qué.
- **Pruebas:** `operacion.test.ts` («PIN en mano…» y «C-PIN-SIN-FOTO: con el PIN bloqueado…») y `pinSinFotoApp.test.ts`, comprobadas en rojo.
- **No tocar:** no quitar la llamada a `sinFotoConPin` del camino con foto.

### C-LATIDO-UBICACION: conectado y quieto, el repartidor sigue mandando su posición

- **Qué pasaba:** el GPS de la app (y la tarea de fondo) solo avisaba al moverse 30 m. Un repartidor conectado y quieto (esperando en el restaurante o en su casa) no mandaba nada; el servidor solo ofrece pedidos a quien tiene ubicación de los últimos 10 minutos y el Manager le quita un pedido aceptado a los 10 minutos sin ubicación.
- **Qué se hizo:** `packages/compartido/src/latidoUbicacion.ts` (`LATIDO_UBICACION_MS` = 2 minutos, `tocaMandarUbicacion`). Con la app abierta, cada 2 minutos se manda la última lectura conocida. En segundo plano, Android recibe una lectura cada 15 s (`distanceInterval` 0) y la tarea solo la manda si se movió 25 m o pasaron 2 minutos. iOS no usa el tiempo en segundo plano: allí sigue con 30 m y el latido lo da la app abierta (límite conocido). El servidor ya escribe como mucho una vez por minuto si está quieto (C-POSICION-SIN-REESCRIBIR), así que el latido es como mucho una escritura cada 2 minutos.
- **Prueba:** `packages/compartido/src/latidoUbicacion.test.ts`, comprobada en rojo.
- **No tocar:** no volver a `distanceInterval: 30` en Android sin otro latido; no mandar el latido más seguido que cada 2 minutos.

### C-COBRO-MISMOS-DATOS: el carrito no reutiliza un cobro creado con otros datos

- **Qué pasaba:** tras «Continuar al pago» el pedido ya existe en el servidor. Si el cliente cambiaba la dirección, el apto, las notas, alergias, puerta o mano, el PIN o el regalo sin que cambiara el total, el carrito reutilizaba el cobro del pedido viejo y el pedido salía con los datos viejos.
- **Causa:** el cobro guardado solo se comparaba por el total.
- **Qué se hizo:** el carrito arma una sola vez el cuerpo del pedido (`cuerpoPedido`, sin el total) y su huella (`huellaPedido` en `packages/compartido`, JSON con las claves ordenadas). El cobro se guarda con su huella y solo se reutiliza si la huella y el total son iguales; si algo cambió, vuelve «Continuar al pago» y se crea el pedido de nuevo (el viejo, sin pagar, lo cierra C-PENDIENTE-ABANDONADO).
- **Prueba:** `packages/compartido/src/carritoMismosDatos.test.ts`, comprobada en rojo.
- **No tocar:** todo dato nuevo que se mande al crear el pedido va dentro de `cuerpoPedido`, nunca agregado aparte en la llamada.

### C-TOTAL-CORREGIDO: tras «El total cambió», el carrito muestra el total del servidor y deja pagar

- **Qué pasaba:** si el total que calculaba la app no coincidía con el del servidor, `POST /datos/pedidos` respondía 409 «El total cambió» con `nuevoTotal` y `desglose`, pero la app no los usaba: cada reintento mandaba el mismo total y daba el mismo 409, sin salida para el cliente.
- **Qué se hizo:** `cart.tsx` guarda el desglose del servidor junto a la huella de los datos (`corregido`). Mientras los datos sigan iguales, el carrito muestra ese desglose (el total corregido en la lista y en el botón) y lo manda como `totalEsperado`, así el siguiente toque paga. Si el cliente cambia algo, se vuelve a calcular en el celular. Mismo camino que ya usaba el cambio de dirección en `order/[id].tsx`.
- **Prueba:** `packages/compartido/src/carritoTotalCorregido.test.ts`, comprobada en rojo.
- **No tocar:** el servidor sigue sin cobrar si el total no coincide (C-FALLOS-DINERO F6); la app solo acepta el desglose que el servidor manda.

### C-PENDIENTE-ABANDONADO: el pedido sin pagar que queda atrás no retiene cupón ni saldo, y el cupón de un cancelado vuelve

- **Qué pasaba:** cada «Continuar al pago» crea un pedido en `pago_pendiente`. Si el cliente pedía de nuevo (por ejemplo, tras cambiar la dirección), el anterior seguía vivo hasta que el Manager lo cerraba a las 2 horas: retenía el cupón (`usos_cupon` lo contaba) y el saldo de regalo apartado. Además, el uso del cupón de un pedido cancelado nunca se devolvía.
- **Qué se hizo:** `cerrarPendientesSinPagar` en `rutas/pedidos.ts`, al crear un pedido y antes de mirar el cupón y el saldo: los `pago_pendiente` anteriores del mismo cliente se cierran con `cancelarConReembolso` (la pieza que ya cancela un pedido en pago pendiente y anula su PaymentIntent) y quedan con el evento `reemplazado_sin_pagar`. Antes se le pregunta a Stripe el estado del cobro: solo se anula si todavía no se pagó (`requires_payment_method`, `requires_confirmation`, `requires_action`, `canceled`); si ya está autorizado o Stripe no responde, no se toca. Uno sin cobro de Stripe solo se cierra si lleva más de 2 minutos (puede estar creándose en otra petición). En `cupones.ts`, los usos de pedidos cancelados ya no cuentan. El saldo de regalo ya no contaba los cancelados. Los cerrados así no aparecen en «Mis pedidos». El carrito olvida el cobro viejo al pedir de nuevo.
- **Pruebas:** `cupones.test.ts` (bloque «C-PENDIENTE-ABANDONADO», comprobado en rojo). Se ajustaron dos pruebas que contaban el comportamiento viejo: en `pedidos.test.ts` se cuentan solo las creaciones de cobro (ahora hay además una consulta), y en `piloto.test.ts` el tope del día se prueba con pedidos pagados (un pedido sin pagar que se reemplaza ya no suma).
- **No tocar:** no anular un cobro viejo sin preguntarle antes a Stripe su estado; no volver a contar los usos de cupón de pedidos cancelados.

## C-MAQUINA-DE-PRUEBAS, C-IOS-PRUEBAS-NO-A-REVISION, C-S11-CUENTA-RECIEN-CREADA y C-NAVEGADOR-SIN-APT (11 nov 2026, pedido de Richard) — EE. UU. (pagos) y todos los países (apps)

- **Máquina de pruebas:** `.github/workflows/pruebas-continuas.yml` corre cada tres horas contra el sitio de pruebas, sin publicar nada: retiros y cobros (S2–S12, L1), el circuito de dinero (`circuitoPagosStaging`, `controlDualStaging`, `domicilioStaging`, `plusRegalo`, `tiendasPesoStaging`, con un reintento) y la conciliación contra Stripe. Si falla, GitHub avisa por correo. Se puede lanzar a mano sobre una rama: `gh workflow run pruebas-continuas.yml --ref <rama>` (prueba lo que el sitio de pruebas sirva en ese momento).
- **Reembolso automático de quejas:** el recorrido A2 lo enciende solo durante un paso (tope 15,00), comprueba UN reembolso y deja la configuración como estaba. No dejarlo encendido: es decisión de Richard.
- **iPhone de pruebas por TestFlight:** perfil `pruebas-tienda` en los tres `eas.json` (firma de tienda, servidor de pruebas) y `node scripts/tiendas/compilar-ios.mjs --pruebas [apps]`. Cada número queda en `~/.config/tumbite/ios-compilaciones-de-pruebas` ANTES de enviarse y `enviar-revision-ios.mjs` se detiene si la compilación adjunta a la versión es una de esas. Pruebas: `apps/servidor/src/iosPruebas.test.ts` y `publicacion.test.ts`. El 11 nov: cliente 32, Driver 24, Restaurants 18, solo en el grupo interno. **Qué NO tocar:** nunca agregar una compilación de pruebas al grupo «Prueba pública» ni adjuntarla a una versión de la tienda. En esta Mac la compilación local de iPhone falla por la firma (hay otro certificado «Apple Distribution: Windoce LLC» en el llavero): se compila en la nube.
- **S11:** Stripe a veces tarda en dejar leer una cuenta conectada recién creada; la prueba espera y reintenta hasta cuatro veces (`diagnostico.ts`).
- **Navegador de las pruebas:** `npx playwright install --with-deps chromium || npx playwright install chromium` en `verify`, `pruebas-rama` y `pruebas-continuas`: el 11 nov los servidores de GitHub no resolvían los espejos de Ubuntu y la corrida moría antes de probar nada.

## C-FICHA-SOLO-LO-QUE-HAY (11 nov 2026) — todos los países

- **Qué pasó:** las fichas de Google Play seguían con el ícono y el gráfico negros del 26 oct (las tres apps se veían iguales) y la del Driver prometía «retiros cuando quieras» con una captura del retiro al banco, cuando los retiros están apagados. El auditor de tiendas dio NO APTO por eso (`~/Gerencia/auditorias-tiendas/2026-11-11-divoox-google-play.md`).
- **Arreglo:** `scripts/marca/graficos-google-play.mjs` hace el gráfico destacado con el color y el «para quién es» de cada app; `scripts/tiendas/imagenes-google-play.mjs` sube ícono, gráfico y capturas a todas las fichas y NO sube la captura del retiro; `fichas-google-play.json` ya no promete retiros (y el guion de textos también pone al día las fichas es-ES y es-US).
- **Cuándo se revierte:** el día que Richard encienda los retiros se devuelve la frase y la captura (quitar el filtro `retiro-al-banco`).
- **Candados de revisión:** las tres apps están publicadas desde el 30 oct (comprobado en la página pública de Google Play); los candados viejos se movieron a `~/.config/tumbite/play-aprobadas/`. Cada subida vuelve a poner el suyo.

## C-PRESUPUESTO-VUELTA-PRUEBAS (12 nov 2026, orden de Gerencia) — todos los países

- **Qué pasó:** el sitio de pruebas escribió 49.598 filas el 11 nov. Ese día corrieron contra pruebas tres vueltas de la máquina «pruebas-continuas», dos recorridos completos de la rama `fase-calle-3cel` y cinco publicaciones. Ninguna de esas pruebas tenía tope de filas.
- **Arreglo:** `apps/servidor/src/vueltaPruebas.ts`. Las pruebas automáticas contra el sitio de pruebas mandan la cabecera `x-vuelta-pruebas` (`continuas-<corrida>` o `rama-<corrida>`); el servidor cuenta las filas de cada petición y las suma en `vueltas_pruebas`. Pasado el tope de la vuelta o el tope diario, responde 429, la corrida queda en rojo y el canario `pruebasContinuas` sale en error. En producción la cabecera se ignora. La máquina pasó de cada tres horas a una vez al día.
- **Cómo se mide:** el último paso de cada corrida imprime `FILAS-VUELTA` (`scripts/staging/cuenta-vuelta.mjs`, ruta `/datos/interno/diagnostico/vuelta`).
- **Candado:** `vueltaPruebas.test.ts` (cinco pruebas; comprobado en rojo quitando la pieza del servidor).
- **Qué NO tocar:** no subir los topes ni la frecuencia sin una medida nueva de `FILAS-VUELTA`. Lo que no cuenta: los avisos de Stripe y el reloj, que no llevan la cabecera.
