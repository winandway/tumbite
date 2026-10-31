#!/bin/bash
# Apps de Android para el EMULADOR, apuntando al sitio de pruebas (31 oct 2026). Repaso de las apps
# nativas antes de subir la versión acumulada a Google Play: prebuild de Android, APK de Release
# firmado con la llave de depuración e instalación en el emulador encendido. No toca las tiendas.
# La llave del mapa y la de avisos se leen de ~/.config/tumbite (nunca del repositorio).
# Uso: bash scripts/tiendas/emulador-android.sh [cliente|repartidor|restaurante ...]
set -euo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export ANDROID_HOME="$HOME/Library/Android/sdk"
ADB="$ANDROID_HOME/platform-tools/adb"
cd "$(dirname "$0")/../.."
RAIZ=$(pwd)
SALIDA="$RAIZ/apks-pruebas/emulador"
mkdir -p "$SALIDA"
APPS=("$@")
[ ${#APPS[@]} -eq 0 ] && APPS=(cliente repartidor restaurante)
"$ADB" get-state >/dev/null 2>&1 || { echo "No hay un emulador encendido."; exit 2; }
CONF="$HOME/.config/tumbite"
[ -f "$CONF/google-maps-android-key" ] && export GOOGLE_MAPS_ANDROID_KEY=$(cat "$CONF/google-maps-android-key")
[ -f "$CONF/google-services.json" ] && export GOOGLE_SERVICES_JSON="$CONF/google-services.json"

for app in "${APPS[@]}"; do
  echo "── $app: prebuild de Android contra el sitio de pruebas"
  cd "$RAIZ/apps/$app"
  EXPO_PUBLIC_API_URL=https://staging.tumbite.com npx expo prebuild -p android --clean --no-install >/dev/null
  # El prebuild reescribe los comandos «ios»/«android» de package.json: se dejan como estaban.
  git checkout -- package.json
  echo "── $app: compilando el APK de Release"
  (cd android && EXPO_PUBLIC_API_URL=https://staging.tumbite.com ./gradlew assembleRelease -q)
  APK=$(ls android/app/build/outputs/apk/release/*.apk | head -1)
  cp "$APK" "$SALIDA/tumbite-$app.apk"
  "$ADB" install -r "$SALIDA/tumbite-$app.apk" >/dev/null
  echo "── $app: instalada en el emulador"
done
