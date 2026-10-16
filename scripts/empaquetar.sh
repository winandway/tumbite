#!/usr/bin/env bash
# Arma el paquete que se publica en UN entorno (pruebas o produccion), desde cero y con SU
# dirección. Nunca se reutiliza un paquete de otro entorno (C-ENTORNOS-SEPARADOS).
# Uso (desde la raíz, con el servidor y el panel ya compilados): bash scripts/empaquetar.sh <pruebas|produccion>
set -euo pipefail
ENTORNO="${1:?pruebas o produccion}"
case "$ENTORNO" in
  pruebas) URL_API="https://staging.tumbite.com" ;;
  produccion) URL_API="https://tumbite.com" ;;
  *) echo "Entorno desconocido: $ENTORNO" >&2; exit 1 ;;
esac
export URL_API
# El commit de ESTA publicación, grabado dentro de cada app web (C-VERSION-DEL-ARTEFACTO).
COMMIT="${VERSION:-${GITHUB_SHA:-local}}"
export COMMIT
SALIDA="out-${ENTORNO}"
rm -rf "$SALIDA" apps/cliente/dist-web apps/repartidor/dist-web apps/restaurante/dist-web
npm run build:app-web >/dev/null
npm run build:repartidor-web >/dev/null
npm run build:restaurante-web >/dev/null
mkdir -p "$SALIDA/app" "$SALIDA/driver" "$SALIDA/restaurant"
cp apps/servidor/.dist-worker/index.js "$SALIDA/_worker.js"
cp -r apps/panel/dist/* "$SALIDA/"
cp -r apps/cliente/dist-web/* "$SALIDA/app/"
cp -r apps/repartidor/dist-web/* "$SALIDA/driver/"
cp -r apps/restaurante/dist-web/* "$SALIDA/restaurant/"
cp schema.sql "$SALIDA/"
echo '{ "compatibility_date": "2026-09-01", "compatibility_flags": ["nodejs_compat"] }' >"$SALIDA/yadominios.json"
echo "$ENTORNO" >"$SALIDA/.entorno"
node scripts/verificar-paquete.mjs "$SALIDA" "$ENTORNO" "$COMMIT"
