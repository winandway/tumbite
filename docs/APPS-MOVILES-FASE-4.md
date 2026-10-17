# Fase 4 — Apps móviles listas para teléfonos reales (17 oct 2026)

Rama `apps-moviles` (publicada en staging como `fase-apps-moviles`). Producción no se tocó. Sin dinero real.

## Resultado

- **Los tres APK de pruebas ya existen**, compilados en esta computadora sin ninguna cuenta externa, apuntando a staging:
  - `apks-pruebas/tumbite-cliente-pruebas.apk` (~114 MB)
  - `apks-pruebas/tumbite-repartidor-pruebas.apk` (~124 MB)
  - `apks-pruebas/tumbite-restaurante-pruebas.apk` (~101 MB)
  - La carpeta está fuera de GitHub (`.gitignore`). Firmados con la llave de depuración: sirven para instalar a mano en Android, no para Google Play.
- **Probados en un emulador Android** (Android 16, `telefono_pruebas`): las tres abren sin errores; inglés y español con el selector estilo Amazon y bandera de España; el cliente habla con staging (respuesta del servidor al entrar); el repartidor entra, pide el permiso de ubicación, lee el GPS, lo manda a staging y el servidor responde pidiendo la foto de identidad (paso correcto del flujo).
- Las tres apuntan solo a `https://staging.tumbite.com` (comprobado dentro de cada paquete: 0 menciones de producción).

## Errores encontrados y corregidos

| #   | Fallo                                                                                                                                                                          | Arreglo                                                                                                                                              | Candado                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | La compilación de Android se caía (lint `ExtraTranslation`): las frases de permisos de iPhone en `idiomas/es.json` se copiaban también a Android. Habría fallado igual en EAS. | Las frases van bajo `"ios"`. Comprobado que el iPhone las sigue recibiendo en español.                                                               | `configMovil.test.ts` (rojo comprobado)                                               |
| 2   | Los avisos al celular no iban por el canal «pedidos» de máxima prioridad: en Android caían en el canal genérico de Expo y podían llegar sin sonar ni aparecer arriba.          | El servidor manda `channelId: 'pedidos'`.                                                                                                            | `notificaciones.test.ts` (rojo comprobado)                                            |
| 3   | El restaurante solo oía la alarma de pedido nuevo con la app abierta.                                                                                                          | La app incluye `alarma.wav` en el canal de avisos y el aviso de pedido nuevo la pide (iOS y Android). Necesita los avisos activos (ver «Qué falta»). | `notificaciones.test.ts`, `configMovil.test.ts`                                       |
| 4   | Repartidor: si la persona no activa la «precisión de ubicación» de Google, la app no leía el GPS y no dejaba conectarse.                                                       | Si la precisión alta falla, se pide con precisión normal y después la última conocida. Comprobado en el emulador.                                    | Prueba manual en emulador (el código de las apps no tiene pruebas automáticas de GPS) |
| 5   | El error de ubicación decía «tu navegador» dentro de la app.                                                                                                                   | Ahora dice «que Tumbite tenga permiso de ubicación» (es/en).                                                                                         | —                                                                                     |
| 6   | Campo vencido `privacy` en las tres configuraciones y 7 parches de Expo atrasados.                                                                                             | Quitado y actualizado. `expo-doctor`: 21/21 en las tres.                                                                                             | `configMovil.test.ts`                                                                 |
| 7   | Los perfiles de compilación no decían APK.                                                                                                                                     | `pruebas` y `preview` generan APK; perfil nuevo `simulador` (iPhone sin cuenta de Apple, a staging).                                                 | `configMovil.test.ts`, `publicacion.test.ts`                                          |

## Revisión pedida

- **Conexión con staging:** OK (emulador).
- **GPS:** OK con la app abierta. **Segundo plano: NO.** La ubicación se manda solo con la app abierta (`watchPositionAsync`). DoorDash y Uber siguen al repartidor con la app en segundo plano. Hacerlo es una función nueva (tarea en segundo plano, permiso de ubicación «siempre», servicio en primer plano en Android y la declaración para Google Play y Apple): queda anotada, no se empezó por la orden de no iniciar funciones nuevas.
- **Notificaciones:** el código registra el teléfono y el servidor manda los avisos, pero en los APK de hoy **no se activan**: falta el proyecto de Expo (sin él la app no pide permiso ni token) y, en Android, Firebase.
- **Restaurante en segundo plano:** la lista se refresca cada 5 s y la alarma suena solo con la app abierta (la pantalla no se apaga mientras está abierta). Con la app cerrada depende de los avisos al celular, que ya llevan la alarma; se activan con el punto anterior.
- **Permisos:** cliente (ubicación, notificaciones), repartidor (ubicación, cámara, notificaciones), restaurante (notificaciones, fotos). Ninguna pide micrófono ni almacenamiento.
- **Pruebas:** verify completo en verde (tipos, estilo, 656 pruebas, build, auditoría).

## Qué falta para generar e instalar los tres APK

**Para instalarlos hoy en un Android real:** nada. Se pasan los tres archivos al teléfono y se instalan permitiendo «instalar apps desconocidas». Funcionan contra staging, con estas limitaciones: sin avisos al celular y con el mapa vacío.

**Para que funcionen completos:**

1. 👤 **Acceso a la organización de Expo `windoce-llc`** (la sesión de esta computadora es otra cuenta). Con eso se corre `eas init` en las tres apps y queda el identificador de proyecto. Destranca: los avisos al celular y las compilaciones en la nube de Expo.
2. 👤 **Proyecto de Firebase** (gratis) con las tres apps Android registradas (`com.windoce.tumbite`, `com.windoce.tumbite.driver`, `com.windoce.tumbite.restaurants`), sus archivos `google-services.json` y la llave de FCM subida a Expo. Destranca: los avisos en Android.
3. 👤 **Llave de Google Maps para Android**, restringida a esos tres paquetes. Destranca: el mapa en Android (hoy sale vacío).
4. **iPhone:** 👤 cuenta de Apple Developer de Windoce LLC y registrar cada iPhone de prueba (o TestFlight). El perfil `simulador` ya permite probar en el simulador de iPhone de esta computadora (falta instalar CocoaPods para compilarlo aquí).
5. **Para Google Play** (no para probar): llave de firma de la empresa; EAS la crea sola con el punto 1.

## Cómo se rehacen los APK

```bash
cd /Users/windocellc/tumbite/apps/cliente && EXPO_PUBLIC_API_URL=https://staging.tumbite.com npx expo prebuild -p android --clean --no-install && cd android && ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home EXPO_PUBLIC_API_URL=https://staging.tumbite.com ./gradlew assembleRelease
```

(Igual para `repartidor` y `restaurante`.) El APK queda en `android/app/build/outputs/apk/release/app-release.apk`. Las carpetas `android/` e `ios/` son generadas: no van a GitHub ni a la revisión de estilo.

## Publicación y los seis APK (17 oct 2026)

- Producción publicada con el flujo permanente: commit `f77122e0` (paquete yapanel-build `66f81e54`), idéntico al código aprobado en staging (`db176dac`; solo cambian documentos). Etiquetas de restauración: `restauracion-antes-apps-main` (ed0250ee) y `restauracion-antes-apps-paquete` (4a74590e). Verificador «despues» en VERDE.
- Los seis APK, en la carpeta `apks-pruebas/` del proyecto (fuera de GitHub):

| App         | Producción (tumbite.com)             | Pruebas (staging.tumbite.com)     |
| ----------- | ------------------------------------ | --------------------------------- |
| Cliente     | `tumbite-cliente-produccion.apk`     | `tumbite-cliente-pruebas.apk`     |
| Repartidor  | `tumbite-repartidor-produccion.apk`  | `tumbite-repartidor-pruebas.apk`  |
| Restaurante | `tumbite-restaurante-produccion.apk` | `tumbite-restaurante-pruebas.apk` |

- Comprobado dentro de cada paquete: los de producción no contienen la dirección de staging; los de pruebas llevan staging como servidor configurado (la única mención de tumbite.com es la dirección de respaldo del código, que no se usa cuando hay servidor configurado).
- **Ojo:** la versión de pruebas y la de producción de una misma app tienen el mismo identificador. En un mismo teléfono, instalar una reemplaza a la otra.
- **No pagar desde los APK de producción:** usan Stripe real.
- Para rehacerlos: `bash apks.sh https://tumbite.com produccion` o `bash apks.sh https://staging.tumbite.com pruebas` (guion descrito arriba: prebuild + gradlew assembleRelease por app).
