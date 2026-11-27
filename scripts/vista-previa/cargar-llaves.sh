#!/usr/bin/env bash
# C-VISTA-PREVIA-RAMA: carga UNA sola vez las llaves que necesitan las vistas previas por rama en
# GitHub y las guarda en esta Mac (~/.config/tumbite, archivos 600, fuera del repositorio):
#   1. Token de Cloudflare de la cuenta windoce1 (Workers Scripts, D1 y R2: Edit).
#   2. Llaves de Stripe de MODO PRUEBA (sk_test_… y pk_test_…), las mismas del sitio de pruebas.
# Las llaves se pegan sin verse y no pasan por ningún chat. Se comprueban antes de guardarlas.
# Al final enciende la vista previa por rama (variable VISTA_PREVIA_POR_RAMA=si).
# Uso: bash scripts/vista-previa/cargar-llaves.sh
set -euo pipefail
CUENTA=4d9e131f2c18bc10ac4700d689d5556c
DIR="$HOME/.config/tumbite"
mkdir -p "$DIR" && chmod 700 "$DIR"

guardar() { umask 077; printf %s "$2" >"$DIR/$1"; chmod 600 "$DIR/$1"; }

CF="$(cat "$DIR/cloudflare-vistas-previas" 2>/dev/null || true)"
if [ -z "$CF" ]; then
  printf 'Pega el token de Cloudflare para las vistas previas (no se verá): '; IFS= read -rs CF; echo
fi
for r in workers/scripts d1/database r2/buckets; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $CF" "https://api.cloudflare.com/client/v4/accounts/$CUENTA/$r")
  [ "$c" = 200 ] || { echo "PARADA: el token no abre $r de la cuenta de Divoox ($c). No se guardó nada."; exit 1; }
done
guardar cloudflare-vistas-previas "$CF"
printf %s "$CF" | gh secret set CLOUDFLARE_TOKEN_VISTAS_PREVIAS
echo "Cloudflare: listo."

SK="$(cat "$DIR/stripe-prueba-secreta" 2>/dev/null || true)"
PK="$(cat "$DIR/stripe-prueba-publicable" 2>/dev/null || true)"
if [ -z "$SK" ] || [ -z "$PK" ]; then
  printf 'Pega la llave SECRETA de prueba de Stripe (sk_test_…, no se verá): '; IFS= read -rs SK; echo
  printf 'Pega la llave PUBLICABLE de prueba de Stripe (pk_test_…, no se verá): '; IFS= read -rs PK; echo
fi
[[ "$SK" == sk_test_* || "$SK" == rk_test_* ]] || { echo "PARADA: no es una llave secreta de PRUEBA. No se guardó."; exit 1; }
[[ "$PK" == pk_test_* ]] || { echo "PARADA: no es una llave publicable de PRUEBA. No se guardó."; exit 1; }
curl -sf https://api.stripe.com/v1/balance -H "Authorization: Bearer $SK" >/dev/null \
  || { echo "PARADA: Stripe no aceptó la llave secreta. No se guardó."; exit 1; }
guardar stripe-prueba-secreta "$SK"
guardar stripe-prueba-publicable "$PK"
printf %s "$SK" | gh secret set STRIPE_SECRET_KEY_PRUEBA
printf %s "$PK" | gh secret set STRIPE_PUBLISHABLE_KEY_PRUEBA
echo "Stripe de prueba: listo."

gh variable set VISTA_PREVIA_POR_RAMA --body si
echo "Vista previa por rama ENCENDIDA: cada rama fase-* se prueba en su propio sitio."
