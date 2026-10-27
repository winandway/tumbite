# Abrir las cuentas de Apple y Google para Divoox (25 oct 2026)

Plan paso a paso. 👤 = lo haces tú (identidad, contraseñas, pagos, aceptar contratos). 🤖 = lo hago yo, mirando la misma pantalla contigo en Chrome (Claude en Chrome) o en el navegador de la app.

## Cómo lo hacemos juntos

- **En esta misma sesión**, no hace falta abrir otra: aquí tengo todo el contexto del proyecto (nombres de las apps, identificadores, textos de las fichas, capturas, direcciones legales).
- **En tu Chrome de siempre** (Claude en Chrome): tú entras con tu cuenta y yo veo la página, te digo qué falta, leo los requisitos y lleno los datos de la empresa (nombre, dirección, sitio web, teléfono, descripciones), siempre con tu «sí» antes de enviar.
- **Lo que no hago yo, por seguridad (lo haces tú):** escribir contraseñas y códigos de verificación, pagar con tarjeta, escribir números de identificación personal, subir la foto de tu documento y aceptar contratos o términos. En esos pasos te aviso y tú lo tocas.
- **No existe una herramienta (MCP) ni un token para crear las cuentas de desarrollador**: eso se hace a mano, una sola vez. Lo que sí existe es para **después**: una llave de App Store Connect (Apple) y una cuenta de servicio de Google Play. Con esas dos, Expo y yo compilamos y subimos las apps solos, sin que tengas que entrar. Las guardo en esta computadora, fuera del repositorio, y no te las vuelvo a pedir.

## Estado (26 oct 2026)

- ✅ D-U-N-S de Windoce LLC: listo (guardado en el archivo privado de la empresa).
- ⏳ Apple Developer: inscripción enviada como organización el 26 oct (número de inscripción en el archivo privado). Apple verifica la autoridad para firmar y manda un correo; luego Richard acepta el contrato y paga 99 USD.
- ✅ Google Play: cuenta de organización CREADA, pagada y VERIFICADA COMPLETA el 26 oct (go@windoce.com, nombre «Divoox», id en el archivo privado). Organización verificada con la carta CP 575 del IRS, Richard verificado como representante, sitio windoce.com verificado (Search Console de go@windoce.com) y los dos teléfonos verificados. Ya se pueden crear las apps. Siguiente: crear las tres fichas (Richard marca las declaraciones) y la cuenta de servicio para subir desde Expo.
- ✅ Google Play, 26 oct: primera versión de Android de las tres apps compilada en Expo y subida a pruebas internas como BORRADOR (versión 3) con `node scripts/tiendas/subir-google-play.mjs <paquete> <aab>`. Fichas con nombre, descripción corta y larga en inglés de EE. UU. y en español (España, EE. UU. y Latinoamérica), cargadas a mano en la consola: la API acepta los textos pero Google responde 403 al confirmar fichas en apps nuevas (`scripts/tiendas/fichas-google-play.mjs` queda listo para cuando lo permita). Ícono 512, gráfico destacado 1024x500 (inglés y español) y capturas reales con su frase (celular; tablet de 7 y 10 pulgadas en Restaurants) cargados en los cuatro idiomas el 26 oct (`node scripts/marca/graficos-google-play.mjs` genera el ícono y el gráfico). Cuestionarios del 26 oct, en las tres apps: privacidad (https://divoox.com/privacy), sin anuncios, sin ID de publicidad (comprobado en el manifiesto compilado: no trae AD_ID), no es app de gobierno, sin funciones financieras, sin funciones de salud — guardados. Seguridad de los datos llenada y guardada como BORRADOR en las tres (cuenta con correo y contraseña; borrar cuenta en https://divoox.com/delete-account; datos cifrados en tránsito; nada compartido con terceros; tipos por app según docs/TIENDAS.md). Clasificación del contenido enviada en las tres el 26 oct (Richard autorizó aceptar las condiciones de IARC): «para todos» (Everyone / 3+). Faltan: 👤 cuentas de revisor en producción para «Detalles de acceso» (se crean el día del envío), después «Público objetivo» (18+) y enviar Seguridad de los datos; la declaración de ubicación en segundo plano de Driver (pide un video corto) y la lista de probadores. Retiros del repartidor: decisión de Richard (26 oct) — la ficha sigue diciendo «retiros cuando quieras»; los retiros se prueban en staging con Stripe de prueba como todo lo demás y se encienden en vivo después de probarlos.
- ✅ Google Play: las tres apps creadas el 26 oct (Divoox, Divoox Driver, Divoox Restaurants; idioma principal inglés de EE. UU.; gratis).
- ✅ Google Cloud: proyecto «Divoox Apps» (divoox-apps), API de Google Play activada, cuenta de servicio divoox-eas@divoox-apps.iam.gserviceaccount.com y su llave JSON guardada en ~/.config/tumbite/google-play-eas.json (600, fuera del repo). La regla de llaves se anuló solo en ese proyecto (Richard, 26 oct). Invitada en Play Console el 26 oct (activa) con: ver información, lanzar a producción, lanzar a pruebas, segmentos de prueba y presencia en Play Store; sin administrador ni datos financieros. Probado: la llave abre una edición en las tres apps (respuesta 200).
- ✅ Expo: organización windoce-llc (cuenta personal «tumbite» de Richard). Robot «desarrollador» con token guardado en ~/.config/tumbite/expo-token (600). Las tres apps conectadas a sus proyectos de Expo (projectId en cada app.json, 26 oct). La llave de firma de Android la creó y guarda Expo. Primera compilación falló porque el npm viejo de Expo no aceptaba el archivo de candados: arreglado fijando Node 24.15.0 en cada perfil de eas.json (con su prueba).

## Paso 0 — El número D-U-N-S de Windoce LLC (lo primero; lo piden Apple y Google)

- Qué es: el número de Dun & Bradstreet que identifica a la empresa. Es gratis.
- 👤 Buscar si Windoce LLC ya tiene uno con la herramienta de Apple («D-U-N-S Number lookup» en la ayuda de Apple Developer). Si no aparece, pedirlo ahí mismo, gratis.
- Datos que pide: nombre legal exacto (Windoce LLC, tal como está en Florida), dirección de la sede, dirección postal y tu contacto de trabajo. Dun & Bradstreet puede llamar para confirmar.
- Tiempo: hasta 5 días hábiles por la vía de Apple. Pagar para acelerarlo NO lo acorta.
- Importante: el nombre y la dirección deben ser idénticos a los que luego se ponen en Apple y en Google.
- 🤖 Te acompaño en la pantalla y reviso que los datos coincidan con los de la empresa.

## Paso 1 — Apple Developer (99 dólares al año)

1. 👤 Crear un Apple ID nuevo con un correo de la empresa (por ejemplo, de windoce.com; Apple pide correo del dominio de la empresa y sitio web funcionando), con verificación en dos pasos.
2. 👤 Inscribirse como **organización** (no como persona): Windoce LLC, con el D-U-N-S del paso 0. Tienes que tener autoridad para firmar por la empresa.
3. 🤖 Lleno contigo los datos de la empresa y el sitio web (https://divoox.com).
4. 👤 Pagar los 99 dólares y aceptar el contrato.
5. Apple revisa (puede llamar al teléfono que figura en D&B).
6. Cuando esté aprobada: 👤 crear la llave de App Store Connect con acceso de administrador (te paso el plano). 🤖 Con esa llave registro las tres apps (com.windoce.tumbite, .driver y .restaurants), subo las fichas y las capturas, y mando las compilaciones a TestFlight.

## Paso 2 — Google Play Console (25 dólares, una sola vez)

1. 👤 Entrar con una cuenta de Google de la empresa y abrir una cuenta de desarrollador de tipo **organización**.
2. 👤 Datos de la organización con el mismo D-U-N-S, nombre legal y dirección del paso 0 (si no coinciden exactamente, la verificación se traba).
3. 🤖 Lleno contigo teléfono, sitio web, tamaño y tipo de organización, y los datos de contacto públicos.
4. 👤 Pagar los 25 dólares, verificar la identidad y, si lo piden, subir los documentos de la empresa (por ejemplo, el certificado de la LLC en Florida).
5. Cuando esté aprobada: 👤 crear la cuenta de servicio para la API de Google Play (te paso el plano). 🤖 Con ella subo las tres apps, sus fichas, las capturas y las pruebas internas.

## Paso 3 — Expo y Firebase (gratis)

- 👤 Crear la organización de Expo de la empresa (y cambiar la clave de Expo que estuvo expuesta).
- 👤 Proyecto de Google Cloud de la empresa con facturación (de ahí salen Firebase y la llave del mapa de Android, que es gratis).
- 🤖 Todo lo demás: proyectos de Expo, Firebase para los avisos, llave del mapa restringida a las tres apps.

## Qué tener a mano antes de empezar

- Documento de constitución de Windoce LLC (Florida) y su dirección exacta.
- Un correo de la empresa y su teléfono.
- La tarjeta de la empresa para los 99 y los 25 dólares.
- Tu documento de identidad (Google puede pedir verificar quién eres).

## Fuentes

- Apple Developer, ayuda sobre D-U-N-S: https://developer.apple.com/support/D-U-N-S/ (requisito para organizaciones, búsqueda y solicitud gratis, hasta 5 días hábiles).
- Guía de terceros sobre los requisitos de organización en Google Play Console (D-U-N-S, nombre y dirección iguales, documentos): https://help.tapcart.com/en/articles/13800709-google-play-console-2026-requirements. Google no publicó una página oficial en esa búsqueda: se confirma dentro de Play Console al abrir la cuenta.

## Firebase y mapa (26 oct 2026)

- ✅ Firebase activado sobre el proyecto de Google Cloud «Divoox Apps» (sin Google Analytics, para no recoger el ID de publicidad). Las tres apps de Android registradas. El archivo google-services.json está en ~/.config/tumbite/google-services.json y en EAS como variable secreta GOOGLE_SERVICES_JSON de la organización windoce-llc; cada app lo lee desde su app.config.js. Nunca va al repositorio (candado en configMovil.test.ts).
- ✅ Avisos al celular: Richard generó la llave del SDK de Firebase (26 oct); guardada en ~/.config/tumbite/firebase-fcm.json y cargada en Expo como «FCM V1 service account key» en las tres apps.
- ✅ Mapa de Android: Richard creó la cuenta de facturación «Mi cuenta de facturación Divoox» (Chase Business Debit) y yo la vinculé al proyecto. «Maps SDK for Android» activado. Llave «Divoox Maps Android» restringida a Maps SDK for Android y a com.windoce.tumbite y com.windoce.tumbite.driver con la huella SHA-1 de firma de Google Play; guardada en ~/.config/tumbite/google-maps-android-key y en EAS como secreto GOOGLE_MAPS_ANDROID_KEY (app.config.js la lee). El mapa de celular no tiene costo por carga.

## Estado al 27 oct 2026 (tarde)

- ✅ Divoox (cliente): enviada a revisión (acceso del revisor, público 18+, seguridad de datos,
  categoría Comida y bebida, contacto go@windoce.com, ficha sin recursos de IA, versión 1.0.0 confirmada).
- ✅ Divoox Restaurants: enviada a revisión, mismos pasos.
- Divoox Driver: la declaración del permiso FOREGROUND_SERVICE_LOCATION lleva el video grabado en el
  emulador de Android (APK de pruebas, cuenta de revisor de staging) y subido como no listado a la
  cuenta de YouTube de go@windoce.com: https://www.youtube.com/watch?v=Cd5WkcxaeFg (archivo original en
  docs/videos/driver-servicio-primer-plano/). Cómo se grabó: `adb shell screenrecord` tras revocar el
  permiso de ubicación, para que se vea el diálogo, «Online» y la notificación fija.
- Cuentas del revisor: creadas por Richard con el botón del superadmin; guardadas en
  ~/.config/tumbite/revisores-tiendas.

## Lo que faltaba para enviar a revisión (27 oct 2026, madrugada)

Google Play encadena las tres declaraciones: «Detalles de acceso» pide las cuentas del revisor;
«Público objetivo» no se abre sin la anterior; «Seguridad de los datos» no se envía sin el público
objetivo (quedó guardada como borrador en las tres apps). Por eso TODO espera las cuentas.

1. **Accesos pendientes de verificación:** identificar la sesión del administrador real y seguir [Acceso de revisores](ACCESO-REVISORES.md). La corrección local separa crear de cambiar contraseñas; todavía no prueba las aplicaciones Android ni prepara un escenario aislado. No pasar claves por chat.
2. Después de comprobar el recorrido de cada app, guardar sus credenciales e instrucciones en inglés directamente en «Detalles de acceso» de Google Play. Solo entonces cerrar los formularios restantes y evaluar el envío a revisión. Un acceso correcto al panel web no acredita los tres Android.
3. ✅ Driver: la ubicación con la pantalla apagada ya NO pide el permiso «todo el tiempo» en Android
   (versión 1, 27 oct): el servicio en primer plano con notificación sigue mandando la posición. No
   hace falta el video. iPhone sigue igual.
4. 🔴 Antes de que Google apruebe: la compra real de 1 dólar (circuito de pagos sin probar con dinero real).
