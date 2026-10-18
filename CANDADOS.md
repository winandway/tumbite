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
- **C-GPS-SERIO (14 oct, punto 4 de la Etapa 2¾, de los estudios de Richard):** tablas `ubicaciones_recientes` y `excepciones_ubicacion`. La regla vive en `packages/compartido/src/gps.ts` (`llegadaConfiable`: dos lecturas en 90 s, precisión ≤ 60 m, coherentes entre sí a menos de 100 m y las dos dentro del radio; `saltoImposible`: más de 50 m/s entre lecturas) con `gps.test.ts`. El servidor (`guardarMuestra` en `operacion.ts`) guarda cada `POST /datos/repartidor/ubicacion` con su `precision`, descarta los saltos imposibles (responde `salto: true`, anota `gps_salto` en la bitácora y no mueve la ficha) y solo marca el hito `llego_cliente` con la llegada confiable. `POST …/entregado` exige ese hito o la excepción autorizada (409 «Todavía no confirmamos tu ubicación…»), además del radio de 200 m de siempre. Excepción: `POST /datos/repartidor/pedidos/:id/no-puedo-confirmar {motivo}` (correo al equipo, `ubicacion_sin_confirmar`), `POST /datos/admin/pedidos/:id/autorizar-ubicacion` (soporte; guarda nombre y hora, `ubicacion_autorizada`); la ficha del pedido en el panel de soporte muestra el motivo y el botón, y la app del repartidor manda `precision` con cada ubicación, muestra «Confirmando tu ubicación…» cerca de la puerta y el botón «No puedo confirmar mi ubicación». Las pruebas (`m.entregar` manda dos lecturas precisas antes, `m.ubicar`, `m.envejecerGps`) están en «GPS serio» de `operacion.test.ts`, comprobadas en rojo quitando la exigencia del hito en `entregado`. Recorrido: el repartidor pide la excepción, soporte la autoriza por la API y se toma la captura `repartidor-sin-gps`. **Qué NO tocar:** nunca marcar `llego_cliente` con una sola lectura; la excepción la autoriza una cuenta admin, nunca el repartidor ni el restaurante; en las pruebas, dos ubicaciones en el mismo segundo a más de 50 m son un salto (usar `envejecerGps`).
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
