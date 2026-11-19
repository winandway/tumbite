#!/bin/bash
# Igual que compilar-y-subir.mjs, pero compilando en esta Mac (sin gastar compilaciones de Expo, que
# en el plan gratis son limitadas por mes). Usa las credenciales de firma guardadas en Expo.
# Uso: bash scripts/tiendas/compilar-local-y-subir.sh [cliente repartidor restaurante]
set -euo pipefail
cd "$(dirname "$0")/../.."
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export EXPO_TOKEN="$(cat "$HOME/.config/tumbite/expo-token")"
# Lo que la nube de Expo pone sola y esta Mac no: avisos y llave del mapa (C-COMPILA-EN-ESTA-MAC).
export GOOGLE_SERVICES_JSON="$HOME/.config/tumbite/google-services.json"
export GOOGLE_MAPS_ANDROID_KEY="$(cat "$HOME/.config/tumbite/google-maps-android-key")"
[ -f "$GOOGLE_SERVICES_JSON" ] && [ -n "$GOOGLE_MAPS_ANDROID_KEY" ] || { echo "Faltan los archivos de avisos o del mapa: no se compila."; exit 1; }
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
    node --input-type=module -e "import('./scripts/tiendas/guardia-nube.mjs').then((g) => g.autorizarCompilacion({ donde: 'local', app: '$a', plataforma: 'android', perfil: 'production' }))"
    # C-VERSION-VISIBLE: la versión nativa 0.1.<compilación> (vacía si la consulta falla: queda app.json).
    NUMERO="$(node scripts/tiendas/numero-compilacion.mjs "$a" production)"
    (cd "apps/$a" && DIVOOX_NUMERO_COMPILACION="$NUMERO" npx eas-cli build --local --platform android --profile production --non-interactive --output "$SALIDA/$a.aab")
    if unzip -p "$SALIDA/$a.aab" base/manifest/AndroidManifest.xml | grep -a -q "PON_AQUI_LA_LLAVE"; then echo "$a: salió SIN la llave del mapa; no se sube."; exit 1; fi
    node scripts/tiendas/publicar-google-play.mjs "$(paquete "$a")" "$SALIDA/$a.aab" "local $(date +%Y-%m-%d)"
  }
done
