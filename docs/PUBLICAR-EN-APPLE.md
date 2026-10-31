# Publicar una app de iPhone en Apple (receta probada con Divoox, 30–31 oct 2026)

Las tres apps de Divoox (cliente, Driver y Restaurants) llegaron a «Esperando revisión» con esta receta.
Sirve para cualquier app de la cuenta de Windoce LLC. Se escribe para que otra sesión, sin memoria, lo haga
sola. Los guiones citados están en este repositorio (`scripts/tiendas/`) y se pueden copiar como modelo.

## Lo que ya existe y NO se le pide a Richard

| Qué                                                           | Dónde                                                                           | Para qué                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Cuenta Apple Developer (empresa)                              | go@windoce.com, equipo `7KM9P6R682`, pagada el 30 oct 2026                      | Todo                                                       |
| Llave de la API de App Store Connect «Divoox EAS» (rol Admin) | `~/.config/tumbite/apple-asc/` (`AuthKey.p8`, `key-id`, `issuer-id`, `team-id`) | Compilar, subir, fichas, enviar a revisión, sin contraseña |
| Llave de notificaciones (APNs), Sandbox y Production          | `~/.config/tumbite/apple-apns/`                                                 | Avisos push de cualquier app del equipo                    |

Las dos llaves son **de la cuenta**, no de una app: sirven para todas. Cada proyecto las copia a su propia
carpeta `~/.config/<proyecto>/` (carpeta 700, archivos 600) y nunca entran a un repositorio.

## Lo único que necesita a Richard

- La sesión de App Store Connect abierta en su Chrome (para los dos pasos que Apple no deja hacer por API:
  **crear la app** y **la privacidad de la app**). Nunca se escribe su contraseña.
- Si un paso pide aceptar un acuerdo nuevo de Apple, lo acepta él.

## Los pasos, en orden

1. **Identificador de la app (Bundle ID)** en el portal de Apple, con sus capacidades (notificaciones,
   Apple Pay si cobra con Apple Pay). Se puede por API (`/v1/bundleIds`, `/v1/bundleIdCapabilities`).
2. **Crear la app en App Store Connect** desde el Chrome de Richard (Apps → «+» → Nueva app): nombre
   único en la tienda, idioma principal, el Bundle ID, SKU. Anotar el número de la app (`ascAppId`).
3. **Textos de permiso** (cámara, ubicación, fotos, movimiento…) en `app.json` → `expo.ios.infoPlist`.
   **Ojo:** un plugin con el permiso en `false` (por ejemplo `expo-location` con
   `motionUsagePermission: false`) BORRA el texto al compilar. Comprobar con
   `npx expo config --type introspect` dentro de la app: tienen que salir todos los `NS…UsageDescription`.
   También `ITSAppUsesNonExemptEncryption: false` si la app no usa cifrado propio.
4. **Compilar con EAS** (`eas build --platform ios --profile production`) con las variables
   `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`,
   `EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION` y `EXPO_NO_CAPABILITY_SYNC=1`.
   - La **primera** compilación de cada app pide credenciales en modo interactivo: se responde con `expect`
     y a «¿configurar notificaciones?» se dice **No** (pide Apple ID). La llave APNs se carga después por la
     API GraphQL de Expo (`iosAppCredentials.setPushKey`).
   - Desde la segunda corre sin preguntas. Modelo: `scripts/tiendas/compilar-ios.mjs`.
5. **Subir a App Store Connect** con `eas submit --platform ios --latest`. La llave va en `eas.json`
   (`ascApiKeyPath`, `ascApiKeyIssuerId`, `ascApiKeyId`) SOLO durante el envío y el archivo se restaura
   después (el escáner de secretos bloquea el commit si quedan).
6. **Comprobar que Apple la aceptó.** Expo dice «subida» aunque Apple la rechace después. La verdad está en
   `GET /v1/apps/<id>/buildUploads` → `state` (`COMPLETE` o `FAILED` con `errors`). El error 90683 es
   un texto de permiso que falta (ver paso 3).
7. **Ficha por API** (modelo `scripts/tiendas/fichas-app-store.mjs`): categorías, nombre y subtítulo por
   idioma, URL de privacidad, clasificación por edad (sin nulos: booleanos o `NONE`), copyright,
   descripción, palabras clave, URL de soporte, datos del revisor con una cuenta de prueba.
   Precio gratis y disponibilidad (hay que nombrar todos los territorios).
8. **Capturas** (modelo `scripts/tiendas/capturas-app-store.mjs`): celular 1320×2868
   (`APP_IPHONE_67`) y, si la app admite tableta, iPad (`APP_IPAD_PRO_3GEN_129`). Capturas reales de la app.
9. **Privacidad de la app** desde el Chrome de Richard (no hay API): qué datos usa la app de verdad,
   sacado del código; para cada uno, propósito, si se vincula al usuario y si se usa para seguimiento.
   Después «Publicar».
10. **Derechos de contenido** por API: `PATCH /v1/apps/<id>` con `contentRightsDeclaration`.
11. **Adjuntar la compilación** a la versión (`PATCH /v1/appStoreVersions/<id>/relationships/build`)
    cuando esté `VALID`, y **enviar a revisión** (modelo `scripts/tiendas/enviar-revision-ios.mjs`). La
    versión queda en `WAITING_FOR_REVIEW`.

## Diferencias con Google Play

- Apple **no** cancela la revisión si se sube otra compilación a TestFlight; Google sí.
- Apple revisa en uno a tres días y avisa a go@windoce.com.
- Si la app NO es Expo (nativa, Flutter…), el paso 4 cambia (Xcode o su propia compilación en la nube); el
  resto es igual.

## Probar en un iPhone antes de que la tienda apruebe: enlace público de TestFlight

`node scripts/tiendas/testflight-publico.mjs` crea en cada app el grupo «Prueba pública» con enlace abierto
(hasta 1000 personas), le pone la última compilación válida y la manda a la revisión de prueba de Apple
(aparte de la de la tienda; suele tardar menos de un día). Mientras esa revisión no termine, el enlace
abre pero dice que la prueba no está disponible todavía. Enlaces de Divoox (31 oct 2026):

- Divoox (cliente): https://testflight.apple.com/join/mvQVYtxU
- Divoox Driver: https://testflight.apple.com/join/T41qAYNU
- Divoox Restaurants: https://testflight.apple.com/join/MT6VQ7Cs

Quien lo abre en el iPhone instala la app TestFlight de Apple y, desde ahí, la nuestra. Cada compilación
nueva hay que ponerla en el grupo con el mismo guion. Ojo: en la API el texto «Qué probar» se llama
`whatsNew`.
