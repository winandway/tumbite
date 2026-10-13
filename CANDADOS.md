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
