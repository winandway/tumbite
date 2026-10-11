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
