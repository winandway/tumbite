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
- ✅ Google Play: las tres apps creadas el 26 oct (Divoox, Divoox Driver, Divoox Restaurants; idioma principal inglés de EE. UU.; gratis).
- ✅ Google Cloud: proyecto «Divoox Apps» (divoox-apps), API de Google Play activada, cuenta de servicio divoox-eas@divoox-apps.iam.gserviceaccount.com y su llave JSON guardada en ~/.config/tumbite/google-play-eas.json (600, fuera del repo). La regla de llaves se anuló solo en ese proyecto (Richard, 26 oct). ⏳ 👤 Richard: en Play Console → Usuarios y permisos → invitar esa cuenta con los permisos de la cuenta: ver información (solo lectura), lanzar a producción, lanzar a pruebas, administrar segmentos de pruebas y administrar la presencia en Play Store. Sin «Administrador» ni datos financieros.
- ⏳ Expo: siguiente.

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
