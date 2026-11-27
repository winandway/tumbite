#!/usr/bin/env bash
# Semáforo antes de producción: espera a que el sitio de pruebas sirva la versión recién
# empujada (hasta 45 minutos; cada 8 minutos le da un empujón a la rama si la plataforma dejó
# pasar la publicación) y exige 200 en las rutas críticas. Rojo = no se publica en producción.
#
# C-SEMAFORO-INSISTE (20 nov 2026): la plataforma se quedaba en «subiendo el paquete», se rendía
# a los tres intentos por versión y un solo empujón no alcanzaba: la rama del asistente de Driver
# nunca llegó a pruebas y nadie supo por qué. Ahora cada empujón es una versión nueva (tres
# intentos más de la plataforma), se insiste hasta el final y, si aun así falla, se imprime lo
# que dice el registro de la plataforma (con YAD_LLAVE_SITIO) para no tener que adivinar.
set -u
URL="${1%/}"; VERSION="$2"; RAMA="${3:-}"
INTENTOS="${SEMAFORO_INTENTOS:-180}" # cada 15 s = 45 minutos
EMPUJON="${SEMAFORO_EMPUJON:-32}"  # cada 8 minutos
PAUSA="${SEMAFORO_PAUSA:-15}"
PAUSA_SERVIDOR="${SEMAFORO_PAUSA_SERVIDOR:-5}"
echo "Esperando que $URL sirva la versión $VERSION…"
for i in $(seq 1 $INTENTOS); do
  if curl -fsS "$URL/?v=$RANDOM" | grep -q "name=\"version\" content=\"$VERSION\""; then
    echo "Pruebas ya sirve $VERSION (tras $((i*PAUSA)) s)."
    # La página y el servidor no cambian a la vez (20 nov 2026): la página ya decía la versión nueva y
    # el servidor contestó cinco segundos después con el código anterior, y un guion falló por eso.
    # Se espera a que el servidor diga la misma versión tres veces seguidas (hasta cinco minutos).
    seguidas=0
    for j in $(seq 1 60); do
      # C-SEMAFORO-RELOJ (26 nov 2026): el reloj del sitio de pruebas solo lo mueven los guiones. Una
      # pasada cortada a medias puede dejar un regalo apartado sin cerrar que nadie libera, y con la salud
      # en 503 el semáforo frena a todas las publicaciones siguientes. Se le da un toque al reloj
      # (al empezar y cada minuto) para que cierre lo que quedó cortado antes de exigir la salud.
      if [ -n "${RELOJ_SECRETO:-}" ] && [ $(( (j - 1) % 12 )) = 0 ]; then
        curl -s -m 60 -o /dev/null -X POST "$URL/datos/reloj" -H "x-reloj-secreto: $RELOJ_SECRETO" \
          || echo "::warning::El toque al reloj de pruebas no respondió."
      fi
      if curl -fsS "$URL/datos/salud?v=$RANDOM" | grep -q "\"commit\":\"$VERSION\""; then
        seguidas=$((seguidas+1))
        [ "$seguidas" -ge 3 ] && break
      else
        seguidas=0
      fi
      sleep "$PAUSA_SERVIDOR"
    done
    if [ "$seguidas" -lt 3 ]; then
      # C-SEMAFORO-DICE-LA-PIEZA (26 nov 2026): si lo que frena es la salud, se imprime qué pieza está
      # mal (el 26 nov fueron horas adivinando: era una revisión de regalo olvidada siete días).
      echo "Salud del sitio de pruebas (piezas que no están bien):"
      curl -s -m 30 "$URL/datos/salud?v=$RANDOM" | tr ',{' '\n\n' | grep -E '"(error|atrasado|tope)"|"commit"' || true
      echo "::error::La página sirve $VERSION pero el servidor no la confirmó tres veces seguidas en cinco minutos."
      exit 1
    fi
    echo "El servidor confirma $VERSION."
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
  # Un solo empujón no alcanza (20 nov 2026): la plataforma deja de reintentar a los tres intentos
  # de una versión. Cada empujón es una versión nueva, así que se repite cada $EMPUJON vueltas.
  if [ $((i % EMPUJON)) = 0 ] && [ -n "$RAMA" ]; then
    echo "Pruebas sigue sin $VERSION tras $((i*PAUSA/60)) minutos: empujón a la rama $RAMA."
    # En una carpeta aparte (worktree): no toca lo que el paso siguiente publica en producción.
    TMP="$(mktemp -d)"
    ( git fetch -q origin "$RAMA" && git worktree add -q --detach "$TMP/rama" "origin/$RAMA" \
      && git -C "$TMP/rama" -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
         commit -q --allow-empty -m "empujón: republicar $VERSION" \
      && git -C "$TMP/rama" push -q origin "HEAD:$RAMA" ) || echo "::warning::No se pudo dar el empujón a $RAMA."
    git worktree remove --force "$TMP/rama" 2>/dev/null; true
    # C-SEMAFORO-REPUBLICA (20 nov 2026): el empujón solo vuelve a avisar, y la plataforma se seguía
    # quedando en «subiendo el paquete». Lo que la destrabó dos veces a mano fue pedirle «republicar»
    # por su API: publica en el momento lo que hay en la rama. Se pide en cada empujón.
    if [ -n "${YAD_LLAVE_SITIO:-}" ]; then
      echo "Se le pide a la plataforma republicar el sitio:"
      curl -s -m 120 -X POST "${YAD_API:-https://yapanel.yadominios.com/api/sitio/v1}/republicar" \
        -H "Authorization: Bearer $YAD_LLAVE_SITIO" -H 'content-type: application/json' -d '{}' \
        | head -c 400 || echo "::warning::La plataforma no contestó al pedido de republicar."
      echo
    fi
  fi
  sleep "$PAUSA"
done
echo "::error::Pruebas no sirvió la versión $VERSION en $((INTENTOS*PAUSA/60)) minutos. No se publica en producción."
# La causa se lee en el registro de la plataforma, no se adivina.
if [ -n "${YAD_LLAVE_SITIO:-}" ]; then
  API="${YAD_API:-https://yapanel.yadominios.com/api/sitio/v1}"
  echo "Estado del sitio según la plataforma:"
  curl -s -m 30 -X POST "$API/estado_del_sitio" -H "Authorization: Bearer $YAD_LLAVE_SITIO" \
    -H 'content-type: application/json' -d '{}' | head -c 1200; echo
  echo "Últimas líneas del registro de la plataforma:"
  curl -s -m 30 -X POST "$API/leer_registro" -H "Authorization: Bearer $YAD_LLAVE_SITIO" \
    -H 'content-type: application/json' -d '{"limite":30}' | head -c 6000; echo
else
  echo "Sin YAD_LLAVE_SITIO no se puede leer el registro de la plataforma: míralo en el panel del sitio."
fi
exit 1
