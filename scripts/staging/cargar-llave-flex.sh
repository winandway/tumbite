#!/usr/bin/env bash
# Divoox Flex · Fase 3: pone la llave que cifra los secretos de las integraciones en el SITIO DE
# PRUEBAS (nunca en producción) y republica. La llave se genera aquí, al azar, y no se imprime.
# Uso (desde la raíz): bash scripts/staging/cargar-llave-flex.sh
set -euo pipefail
K="$(zsh -ic 'printf %s "$YADOMINIOS_LLAVE_PRUEBAS"' 2>/dev/null)"
[[ "$K" == ydk_* ]] || { echo "Falta la llave del sitio de pruebas. No se hizo nada."; exit 1; }
API=https://yapanel.yadominios.com/api/sitio/v1
SITIO="$(curl -s -X POST "$API/estado_del_sitio" -H "Authorization: Bearer $K" | python3 -c 'import sys,json; print((json.load(sys.stdin).get("resultado") or {}).get("nombre",""))')"
[[ "$SITIO" == "tumbite-pruebas" ]] || { echo "PARADA: la llave no es del sitio de pruebas ($SITIO). No se hizo nada."; exit 1; }
# Se guarda fuera del repo (regla: toda clave se guarda una vez). Si ya existe, se reutiliza.
GUARDADA="$HOME/.config/tumbite/flex-llave-webhooks-pruebas"
mkdir -p "$HOME/.config/tumbite" && chmod 700 "$HOME/.config/tumbite"
[[ -s "$GUARDADA" ]] || { openssl rand -hex 32 > "$GUARDADA"; chmod 600 "$GUARDADA"; }
LLAVE="$(cat "$GUARDADA")"
python3 -c 'import json,sys; print(json.dumps({"clave":"FLEX_LLAVE_WEBHOOKS","valor":sys.argv[1],"secreto":True}))' "$LLAVE" \
  | curl -s -X POST "$API/guardar_variable" -H "Authorization: Bearer $K" -H 'content-type: application/json' --data @- \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("FLEX_LLAVE_WEBHOOKS", "ok" if d.get("ok") else d.get("error"))'
curl -s -X POST "$API/republicar" -H "Authorization: Bearer $K" >/dev/null
echo "Listo: llave de integraciones cargada en el sitio de pruebas y republicado."
