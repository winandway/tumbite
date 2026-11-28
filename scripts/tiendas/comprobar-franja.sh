#!/bin/bash
# C-FRANJA-SOLO-EN-PRUEBAS (18 nov 2026): antes de subir a una tienda, el paquete de producción se
# instala en el emulador, se abre la pantalla de entrar y se NIEGA la subida si aparece la franja
# «PRUEBAS». Leer el código no basta: la 46 y la 42 pasaron todas las pruebas y la pintaban.
#   bash scripts/tiendas/comprobar-franja.sh <cliente|repartidor|restaurante> <ruta.aab>
set -euo pipefail
APP="$1"; AAB="$2"
case "$APP" in
  cliente) PAQ=com.windoce.tumbite ;;
  repartidor) PAQ=com.windoce.tumbite.driver ;;
  restaurante) PAQ=com.windoce.tumbite.restaurants ;;
  *) echo "App desconocida: $APP"; exit 2 ;;
esac
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
con_limite() { perl -e 'alarm shift; exec @ARGV' -- "$@"; }
esperar() { perl -e 'select(undef,undef,undef,shift)' "$1"; }
TMP="$(mktemp -d)"
if unzip -l "$AAB" | grep -q "staging.tumbite"; then echo "NO: el paquete nombra el sitio de pruebas"; exit 1; fi
bundletool build-apks --bundle="$AAB" --output="$TMP/a.apks" --mode=universal \
  --ks="$HOME/.android/debug.keystore" --ks-pass=pass:android --ks-key-alias=androiddebugkey --key-pass=pass:android >/dev/null
unzip -o -q "$TMP/a.apks" universal.apk -d "$TMP"
# La dirección del sitio de pruebas no puede viajar en la configuración embebida.
unzip -p "$TMP/universal.apk" assets/app.config | grep -q "staging.tumbite\|tumbite-pruebas" && { echo "NO: la configuración embebida apunta al sitio de pruebas"; exit 1; }
con_limite 60 "$ADB" uninstall "$PAQ" >/dev/null 2>&1 || true
con_limite 180 "$ADB" install "$TMP/universal.apk" >/dev/null
con_limite 30 "$ADB" shell pm grant "$PAQ" android.permission.ACCESS_FINE_LOCATION 2>/dev/null || true
con_limite 30 "$ADB" shell pm grant "$PAQ" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
con_limite 30 "$ADB" shell am start -n "$PAQ/.MainActivity" >/dev/null
# C-FRANJA-LECTURA-FRESCA (27 nov 2026): el archivo de la lectura anterior se borra antes de leer. Si
# Android no logra leer la pantalla (pasa con una animación que nunca para), «uiautomator dump» falla
# y antes se leía el archivo VIEJO: la pantalla de entrar de OTRA app (o de una versión anterior) podía
# dar por buena una subida. Además, la lectura solo cuenta si es de ESTE paquete.
pantalla() {
  con_limite 20 "$ADB" shell rm -f /sdcard/franja.xml >/dev/null 2>&1 || true
  con_limite 40 "$ADB" shell uiautomator dump /sdcard/franja.xml >/dev/null 2>&1 || true
  con_limite 20 "$ADB" shell cat /sdcard/franja.xml 2>/dev/null | grep "package=\"$PAQ\"" || true
}
tocar() {
  local caja; caja=$(pantalla | grep -o "text=\"$1\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" | head -1 | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' || true)
  [ -z "$caja" ] && return 1
  set -- $(echo "$caja" | tr '[],' '   ')
  con_limite 20 "$ADB" shell input tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 ))
}
# C-FRANJA-AVISO-SISTEMA (28 nov 2026): el aviso «precisión de la ubicación» es de los servicios de
# Google (otro paquete) y tapaba la pantalla de la app de clientes: se cierra con «No, gracias».
cerrarAvisoSistema() {
  local caja
  con_limite 20 "$ADB" shell rm -f /sdcard/sistema.xml >/dev/null 2>&1 || true
  con_limite 40 "$ADB" shell uiautomator dump /sdcard/sistema.xml >/dev/null 2>&1 || true
  caja=$(con_limite 20 "$ADB" shell cat /sdcard/sistema.xml 2>/dev/null | grep -o 'text="\(No thanks\|No, gracias\)"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | head -1 | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' || true)
  [ -z "$caja" ] && return 1
  set -- $(echo "$caja" | tr '[],' '   ')
  con_limite 20 "$ADB" shell input tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 ))
}
VISTA=""
for _ in $(seq 1 20); do
  cerrarAvisoSistema || true
  X="$(pantalla)"
  # El emulador puede estar en español o en inglés (19 nov 2026: en inglés no se reconocía la pantalla).
  if echo "$X" | grep -q 'text="Contraseña"\|text="Password"'; then VISTA="$X"; break; fi
  tocar "Mientras se usa la aplicación" || tocar "While using the app" || tocar "Permitir" || tocar "Allow" || tocar "Mi cuenta" || tocar "Account" || true
  esperar 3
done
[ -z "$VISTA" ] && { echo "NO: no se llegó a la pantalla de entrar; no se puede dar por buena"; exit 1; }
mkdir -p apks-pruebas/franja
con_limite 30 "$ADB" exec-out screencap -p > "apks-pruebas/franja/$APP-entrar.png" || true
if echo "$VISTA" | grep -q 'text="PRUEBAS"\|text="TEST"\|no es la de la tienda\|not the store version'; then
  echo "NO: el paquete de producción de $APP pinta la franja PRUEBAS en la pantalla de entrar"; exit 1
fi
echo "BIEN: $APP abre la pantalla de entrar sin franja de pruebas (captura en apks-pruebas/franja/$APP-entrar.png)"
