#!/usr/bin/env bash
# Carga Stripe en MODO PRUEBA en el SITIO DE PRUEBAS (nunca en producción). Las llaves se pegan
# sin verse, no pasan por ningún chat y se rechazan si no son de prueba (sk_test_ / pk_test_).
# Crea el aviso (webhook) de prueba apuntando al sitio de pruebas y carga las tres variables con
# la llave de «Acceso para IA» del sitio de pruebas (YADOMINIOS_LLAVE_PRUEBAS). Después republica.
# Uso (desde la raíz del repositorio): bash scripts/staging/cargar-stripe-prueba.sh
set -euo pipefail
K="$(zsh -ic 'printf %s "$YADOMINIOS_LLAVE_PRUEBAS"' 2>/dev/null)"
[[ "$K" == ydk_* ]] || { echo "Falta la llave del sitio de pruebas. No se hizo nada."; exit 1; }
API=https://yapanel.yadominios.com/api/sitio/v1
SITIO="$(curl -s -X POST "$API/estado_del_sitio" -H "Authorization: Bearer $K" | python3 -c 'import sys,json; print((json.load(sys.stdin).get("resultado") or {}).get("nombre",""))')"
[[ "$SITIO" == "tumbite-pruebas" ]] || { echo "PARADA: la llave no es del sitio de pruebas ($SITIO). No se hizo nada."; exit 1; }

printf 'Pega la llave SECRETA de prueba de Stripe (sk_test_…, no se verá): '; IFS= read -rs SK; echo
printf 'Pega la llave PUBLICABLE de prueba de Stripe (pk_test_…, no se verá): '; IFS= read -rs PK; echo
[[ "$SK" == sk_test_* ]] || { echo "PARADA: esa no es una llave secreta de PRUEBA (sk_test_). No se hizo nada."; exit 1; }
[[ "$PK" == pk_test_* ]] || { echo "PARADA: esa no es una llave publicable de PRUEBA (pk_test_). No se hizo nada."; exit 1; }

CUENTA="$(curl -s https://api.stripe.com/v1/account -H "Authorization: Bearer $SK" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id",""), "·", (d.get("settings",{}).get("dashboard",{}) or {}).get("display_name") or d.get("business_profile",{}).get("name") or "")')"
[[ "$CUENTA" == acct_* ]] || { echo "Stripe no aceptó la llave. No se hizo nada."; exit 1; }
echo "Cuenta de Stripe (modo prueba): $CUENTA"

WHSEC="$(curl -s https://api.stripe.com/v1/webhook_endpoints -H "Authorization: Bearer $SK" \
  -d url=https://staging.tumbite.com/datos/stripe/aviso \
  -d "description=Tumbite sitio de pruebas" \
  -d "enabled_events[]=payment_intent.amount_capturable_updated" \
  -d "enabled_events[]=payment_intent.succeeded" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=transfer.created" \
  -d "enabled_events[]=transfer.reversed" \
  -d "enabled_events[]=account.updated" \
  -d "enabled_events[]=payout.failed" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("secret",""))')"
[[ "$WHSEC" == whsec_* ]] || { echo "No se pudo crear el aviso de prueba en Stripe. No se cargó nada."; exit 1; }

poner() { python3 -c 'import json,sys; print(json.dumps({"clave":sys.argv[1],"valor":sys.argv[2],"secreto":sys.argv[3]=="1"}))' "$1" "$2" "$3" \
  | curl -s -X POST "$API/guardar_variable" -H "Authorization: Bearer $K" -H 'content-type: application/json' --data @- \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("  ", sys.argv[1], "ok" if d.get("ok") else d.get("error"))' "$1"; }
poner STRIPE_SECRET_KEY "$SK" 1
poner STRIPE_PUBLISHABLE_KEY "$PK" 0
poner STRIPE_WEBHOOK_SECRET "$WHSEC" 1
curl -s -X POST "$API/republicar" -H "Authorization: Bearer $K" >/dev/null
echo "Listo: Stripe en modo prueba cargado en el sitio de pruebas y republicado."
