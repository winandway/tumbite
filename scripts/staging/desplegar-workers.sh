#!/usr/bin/env bash
# Fase 2 · Despliega los dos Workers SOLO para el sitio de pruebas, en la cuenta de Cloudflare de
# Tumbite. Nunca muestra un secreto: los genera aquí, los guarda en un archivo privado fuera del
# repositorio (permiso 600) y los carga con `wrangler secret put` por la entrada estándar.
# Uso: bash scripts/staging/desplegar-workers.sh <correo-de-la-cuenta-de-cloudflare-de-tumbite>
set -euo pipefail
ESPERADO="${1:?Falta el correo de la cuenta de Cloudflare de Tumbite}"
cd "$(dirname "$0")/../../apps/tiempo-real"

# 1) La cuenta es parte del proyecto: se comprueba ANTES de crear nada.
QUIEN="$(npx wrangler whoami 2>&1)"
if ! grep -qi "associated with the email ${ESPERADO}" <<<"$QUIEN"; then
  echo "PARADA: la sesión de Cloudflare no es la de ${ESPERADO}. No se creó nada." >&2
  exit 1
fi

# 2) Secretos de PRUEBA, nuevos, en un archivo privado fuera del repositorio.
ARCHIVO="${HOME}/.tumbite-staging-tiempo-real.env"
if [[ ! -f "$ARCHIVO" ]]; then
  umask 077
  gen() { openssl rand -hex 32; }
  {
    echo "INTERNO_LLAVE_ID=int-$(date +%Y%m%d)"
    echo "INTERNO_SECRETO=$(gen)"
    echo "AVISOS_LLAVE_ID=av-$(date +%Y%m%d)"
    echo "AVISOS_SECRETO=$(gen)"
    echo "PASE_LLAVE_ID=pase-$(date +%Y%m%d)"
    echo "PASE_SECRETO=$(gen)"
  } >"$ARCHIVO"
fi
chmod 600 "$ARCHIVO"
# shellcheck disable=SC1090
source "$ARCHIVO"

# 3) Desplegar los dos Workers (apuntan a https://staging.tumbite.com en su configuración).
npx wrangler deploy >/dev/null
npx wrangler deploy -c wrangler.reloj.jsonc >/dev/null

# 4) Secretos por la entrada estándar (no quedan en el historial ni en pantalla).
poner() { printf '%s' "$3" | npx wrangler secret put "$2" ${1:+-c "$1"} >/dev/null; }
poner "" INTERNO_LLAVE_ID "$INTERNO_LLAVE_ID"
poner "" INTERNO_SECRETO "$INTERNO_SECRETO"
poner "" AVISOS_LLAVE_ID "$AVISOS_LLAVE_ID"
poner "" AVISOS_SECRETO_ACTUAL "$AVISOS_SECRETO"
poner "" PASE_LLAVE_ID "$PASE_LLAVE_ID"
poner "" PASE_SECRETO_ACTUAL "$PASE_SECRETO"
poner wrangler.reloj.jsonc INTERNO_LLAVE_ID "$INTERNO_LLAVE_ID"
poner wrangler.reloj.jsonc INTERNO_SECRETO "$INTERNO_SECRETO"

echo "Listo: los dos Workers están desplegados para pruebas."
echo "Los valores para el panel del sitio de pruebas están en ${ARCHIVO} (no se muestran aquí)."
