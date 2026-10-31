#!/bin/bash
# Apps de iPhone para el SIMULADOR, apuntando al sitio de pruebas (31 oct 2026). Sirve para el repaso
# de las apps nativas antes de que lo vea Richard o el revisor de Apple: prebuild de iOS, compilación
# Release para el simulador firmada ad hoc (sin firma se rompe el llavero y no se puede entrar) e
# instalación en el simulador encendido. No usa la cuenta de Apple ni toca las tiendas.
# Uso: bash scripts/tiendas/simulador-ios.sh [cliente|repartidor|restaurante ...]
set -euo pipefail
# CocoaPods falla con texto Unicode si la terminal no está en UTF-8.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd "$(dirname "$0")/../.."
RAIZ=$(pwd)
SALIDA="$RAIZ/apks-pruebas/ios-simulador"
mkdir -p "$SALIDA"
APPS=("$@")
[ ${#APPS[@]} -eq 0 ] && APPS=(cliente repartidor restaurante)
SIM=$(xcrun simctl list devices booted | grep -m1 -oE '\([0-9A-F-]{36}\)' | tr -d '()')
[ -n "$SIM" ] || { echo "No hay un simulador encendido."; exit 2; }

for app in "${APPS[@]}"; do
  echo "── $app: prebuild de iOS contra el sitio de pruebas"
  cd "$RAIZ/apps/$app"
  EXPO_PUBLIC_API_URL=https://staging.tumbite.com npx expo prebuild -p ios --clean --no-install >/dev/null
  # El prebuild reescribe los comandos «ios»/«android» de package.json: se dejan como estaban.
  git checkout -- package.json
  (cd ios && pod install >/dev/null)
  WS=$(ls -d ios/*.xcworkspace | head -1)
  ESQUEMA=$(basename "$WS" .xcworkspace)
  echo "── $app: compilando $ESQUEMA para el simulador"
  EXPO_PUBLIC_API_URL=https://staging.tumbite.com xcodebuild \
    -workspace "$WS" -scheme "$ESQUEMA" -configuration Release -sdk iphonesimulator \
    -destination "id=$SIM" -derivedDataPath ios/build \
    CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=NO -quiet
  APP=$(ls -d ios/build/Build/Products/Release-iphonesimulator/*.app | head -1)
  rm -rf "${SALIDA:?}/tumbite-$app.app"
  cp -R "$APP" "$SALIDA/tumbite-$app.app"
  xcrun simctl install "$SIM" "$SALIDA/tumbite-$app.app"
  echo "── $app: instalada en el simulador ($SIM)"
done
