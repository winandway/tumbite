#!/bin/bash
# Igual que compilar-y-subir.mjs, pero compilando en esta Mac (sin gastar compilaciones de Expo, que
# en el plan gratis son limitadas por mes). Usa las credenciales de firma guardadas en Expo.
# Uso: bash scripts/tiendas/compilar-local-y-subir.sh [cliente repartidor restaurante]
set -euo pipefail
cd "$(dirname "$0")/../.."
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export EXPO_TOKEN="$(cat "$HOME/.config/tumbite/expo-token")"
paquete() {
  case "$1" in
    cliente) echo com.windoce.tumbite ;;
    repartidor) echo com.windoce.tumbite.driver ;;
    restaurante) echo com.windoce.tumbite.restaurants ;;
  esac
}
SALIDA="$(mktemp -d)"
APPS="${*:-cliente repartidor restaurante}"
for a in $APPS; do
  {
    (cd "apps/$a" && npx eas-cli build --local --platform android --profile production --non-interactive --output "$SALIDA/$a.aab")
    node scripts/tiendas/publicar-google-play.mjs "$(paquete "$a")" "$SALIDA/$a.aab" "local $(date +%Y-%m-%d)"
  }
done
