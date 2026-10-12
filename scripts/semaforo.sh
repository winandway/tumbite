#!/usr/bin/env bash
# Semáforo antes de producción: espera a que el sitio de pruebas sirva la versión recién
# empujada (hasta 12 minutos) y exige 200 en las rutas críticas. Rojo = no se publica en producción.
set -u
URL="${1%/}"; VERSION="$2"
echo "Esperando que $URL sirva la versión $VERSION…"
for i in $(seq 1 48); do
  if curl -fsS "$URL/?v=$RANDOM" | grep -q "name=\"version\" content=\"$VERSION\""; then
    echo "Pruebas ya sirve $VERSION (tras $((i*15)) s)."
    ok=1
    for r in / /como-funciona /llms.txt /panel /app/ /repartidor/ /privacidad /terminos /terminos-restaurantes /terminos-repartidores /borrar-cuenta /soporte /datos/salud /sitemap.xml; do
      code=$(curl -s -o /dev/null -w '%{http_code}' "$URL$r")
      echo "  $r → $code"
      [ "$code" = "200" ] || ok=0
    done
    # El HTML tiene que llegar armado (prerender): Google no debe depender del JavaScript.
    if curl -fsS "$URL/pais/colombia" | grep -q '<h1>'; then echo "  prerender → ok"; else echo "::error::El HTML de /pais/colombia llega vacío: falló el prerender."; ok=0; fi
    [ "$ok" = "1" ] && exit 0
    echo "::error::Una ruta crítica no responde 200 en pruebas. No se publica en producción."
    exit 1
  fi
  sleep 15
done
echo "::error::Pruebas no sirvió la versión $VERSION en 12 minutos. No se publica en producción."
exit 1
