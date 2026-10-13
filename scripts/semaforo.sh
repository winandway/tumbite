#!/usr/bin/env bash
# Semáforo antes de producción: espera a que el sitio de pruebas sirva la versión recién
# empujada (hasta 25 minutos; a los 8 minutos le da un empujón a la rama de pruebas si se le
# pasó la publicación) y exige 200 en las rutas críticas. Rojo = no se publica en producción.
set -u
URL="${1%/}"; VERSION="$2"; RAMA="${3:-}"
INTENTOS="${SEMAFORO_INTENTOS:-100}" # cada 15 s = 25 minutos
EMPUJON="${SEMAFORO_EMPUJON:-32}"  # a los 8 minutos
echo "Esperando que $URL sirva la versión $VERSION…"
for i in $(seq 1 $INTENTOS); do
  if curl -fsS "$URL/?v=$RANDOM" | grep -q "name=\"version\" content=\"$VERSION\""; then
    echo "Pruebas ya sirve $VERSION (tras $((i*15)) s)."
    ok=1
    for r in / /es /es/how-it-works /how-it-works /llms.txt /panel /app/ /driver/ /privacy /terms /restaurant-terms /driver-terms /delete-account /support /datos/salud /sitemap.xml; do
      code=$(curl -s -o /dev/null -w '%{http_code}' "$URL$r")
      echo "  $r → $code"
      [ "$code" = "200" ] || ok=0
    done
    # El HTML tiene que llegar armado (prerender): Google no debe depender del JavaScript.
    if curl -fsS "$URL/country/colombia" | grep -q '<h1>'; then echo "  prerender → ok"; else echo "::error::El HTML de /country/colombia llega vacío: falló el prerender."; ok=0; fi
    [ "$ok" = "1" ] && exit 0
    echo "::error::Una ruta crítica no responde 200 en pruebas. No se publica en producción."
    exit 1
  fi
  # La plataforma a veces deja pasar una publicación (13 oct 2026, dos veces): se le vuelve a
  # avisar con un commit vacío en la misma rama, sin cambiar nada de lo publicado.
  if [ "$i" = "$EMPUJON" ] && [ -n "$RAMA" ]; then
    echo "Pruebas sigue sin $VERSION tras 8 minutos: empujón a la rama $RAMA."
    # En una carpeta aparte (worktree): no toca lo que el paso siguiente publica en producción.
    TMP="$(mktemp -d)"
    ( git fetch -q origin "$RAMA" && git worktree add -q --detach "$TMP/rama" "origin/$RAMA" \
      && git -C "$TMP/rama" -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
         commit -q --allow-empty -m "empujón: republicar $VERSION" \
      && git -C "$TMP/rama" push -q origin "HEAD:$RAMA" ) || echo "::warning::No se pudo dar el empujón a $RAMA."
    git worktree remove --force "$TMP/rama" 2>/dev/null; true
  fi
  sleep 15
done
echo "::error::Pruebas no sirvió la versión $VERSION en 25 minutos. No se publica en producción."
exit 1
