#!/usr/bin/env bash
# Guarda en esta computadora la llave de «Acceso para IA» del SITIO DE PRUEBAS de YaDominios.
# La llave se escribe sin verse en pantalla, no pasa por ningún chat y se comprueba ANTES de
# guardarla: si abre el sitio de producción (tumbite.com) o no tiene permiso de escritura, se
# rechaza. Uso: bash scripts/staging/guardar-llave-pruebas.sh
set -euo pipefail
printf 'Pega la llave del sitio de pruebas (no se verá) y presiona Enter: '
IFS= read -rs LLAVE
echo
[[ "$LLAVE" == ydk_* ]] || { echo "Eso no parece una llave de YaDominios (empieza por ydk_). No se guardó nada."; exit 1; }
RESP="$(curl -s -X POST https://yapanel.yadominios.com/api/sitio/v1/estado_del_sitio -H "Authorization: Bearer ${LLAVE}")"
SITIO="$(printf '%s' "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get("resultado") or {}; print(r.get("nombre") or "")')"
DOMINIOS="$(printf '%s' "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get("resultado") or {}; print(" ".join(r.get("dominios") or []))')"
if [[ -z "$SITIO" ]]; then echo "La llave no funcionó. No se guardó nada."; exit 1; fi
if [[ "$SITIO" == "tumbite" || " $DOMINIOS " == *" tumbite.com "* ]]; then
  echo "PARADA: esa llave es del sitio de PRODUCCIÓN ($SITIO). No se guardó nada. Crea la llave en la tarjeta del sitio de pruebas."
  exit 1
fi
PERMISO="$(curl -s https://yapanel.yadominios.com/api/sitio/v1 -H "Authorization: Bearer ${LLAVE}" | grep -c guardar_variable || true)"
[[ "$PERMISO" -gt 0 ]] || { echo "La llave es de solo lectura. Crea una de «Lectura y escritura». No se guardó nada."; exit 1; }
sed -i '' '/^export YADOMINIOS_LLAVE_PRUEBAS=/d' ~/.zshrc 2>/dev/null || true
printf 'export YADOMINIOS_LLAVE_PRUEBAS=%q\n' "$LLAVE" >>~/.zshrc
chmod 600 ~/.zshrc
echo "Listo: guardada la llave del sitio de pruebas «${SITIO}» (${DOMINIOS})."
