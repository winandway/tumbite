#!/usr/bin/env bash
# Fase 2 · Despliega los dos Workers SOLO para el sitio de pruebas, en la cuenta de Cloudflare de
# Tumbite. Nunca muestra un secreto: los genera aquí, los guarda en un archivo privado fuera del
# repositorio (permiso 600) y los carga con `wrangler secret put` y `gh secret set` por la entrada
# estándar. Uso (desde la raíz del repositorio):
#   bash scripts/staging/desplegar-workers.sh <correo-de-la-cuenta-de-cloudflare-de-tumbite>
set -euo pipefail
ESPERADO="${1:?Falta el correo de la cuenta de Cloudflare de Tumbite}"
cd "$(dirname "$0")/../../apps/tiempo-real"

# 1) La cuenta es parte del proyecto: se comprueba ANTES de crear nada.
if ! npx wrangler whoami 2>&1 | grep -qi "associated with the email ${ESPERADO}"; then
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
URL_TR="$(npx wrangler deploy 2>&1 | grep -Eo 'https://[a-z0-9.-]+\.workers\.dev' | head -1 || true)"
npx wrangler deploy -c wrangler.reloj.jsonc >/dev/null
if [[ -z "$URL_TR" ]]; then
  echo "No se obtuvo la dirección del Worker de tiempo real." >&2
  exit 1
fi
grep -q '^TIEMPO_REAL_URL=' "$ARCHIVO" || echo "TIEMPO_REAL_URL=${URL_TR}" >>"$ARCHIVO"

# 4) Secretos de los Workers por la entrada estándar (no quedan en el historial ni en pantalla).
poner() { printf '%s' "$2" | npx wrangler secret put "$1" "${@:3}" >/dev/null; }
poner INTERNO_LLAVE_ID "$INTERNO_LLAVE_ID"
poner INTERNO_SECRETO "$INTERNO_SECRETO"
poner AVISOS_LLAVE_ID "$AVISOS_LLAVE_ID"
poner AVISOS_SECRETO_ACTUAL "$AVISOS_SECRETO"
poner PASE_LLAVE_ID "$PASE_LLAVE_ID"
poner PASE_SECRETO_ACTUAL "$PASE_SECRETO"
poner INTERNO_LLAVE_ID "$INTERNO_LLAVE_ID" -c wrangler.reloj.jsonc
poner INTERNO_SECRETO "$INTERNO_SECRETO" -c wrangler.reloj.jsonc

# 5) Lo que necesita la prueba en vivo, a GitHub por la entrada estándar (no se muestra).
printf '%s' "$AVISOS_LLAVE_ID" | gh secret set AVISOS_LLAVE_ID_PRUEBAS >/dev/null
printf '%s' "$AVISOS_SECRETO" | gh secret set AVISOS_SECRETO_PRUEBAS >/dev/null
gh variable set TIEMPO_REAL_URL_PRUEBAS --body "$URL_TR" >/dev/null

echo "Listo: los dos Workers están desplegados para pruebas."
echo "Los valores para el panel del sitio de pruebas están en ${ARCHIVO} (no se muestran aquí)."
