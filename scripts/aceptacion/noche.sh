#!/bin/bash
# Corrida nocturna de la lista de aceptación (C-ROBOT-NOCTURNO, 26 nov 2026, Gerencia con autorización de
# Richard). La lanza cada noche a las 2:00 la tarea de la Mac (launchd, ver instalar-tarea.sh), dentro de la
# copia fija del robot. Hace, en orden y sin parar si uno falla:
#   1. compila Driver y la app de clientes contra el SITIO DE PRUEBAS e instala en el iPhone simulado;
#   2. robot de las apps (Maestro), 3. robot del panel (Playwright), 4. examen de Camila,
#   5. los destinos del tabulador en el buscador; 6. el parte para Gerencia en ~/Gerencia/partes/ACEPTACION-<fecha>.md.
# Tope: a las 5:00 se corta lo que siga corriendo y el parte dice qué no alcanzó.
# Solo el sitio de pruebas, solo cuentas de prueba, cero dinero, nada a las tiendas.
set -uo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.maestro/bin:$PATH"
cd "$(dirname "$0")/../.."
RAIZ=$(pwd)
FECHA=$(TZ=America/Detroit date +%F)
export ACEPTACION_FECHA=$FECHA
CARPETA="$RAIZ/registros/aceptacion/$FECHA"
mkdir -p "$CARPETA"
REG="$CARPETA/noche.log"
exec >>"$REG" 2>&1
echo "== corrida nocturna $FECHA, empieza $(date)"

# Hora límite: 5:00 de la mañana de hoy (hora de la Mac).
LIMITE=$(date -j -f "%Y-%m-%d %H:%M:%S" "$(date +%F) 05:00:00" +%s 2>/dev/null || echo 0)
# Si la Mac estaba dormida a las 2:00, launchd la corre al despertar: entonces tiene tres horas.
[ "$LIMITE" -lt $(( $(date +%s) + 3600 )) ] && LIMITE=$(( $(date +%s) + 3 * 3600 ))
queda() { echo $(( LIMITE - $(date +%s) )); }

con_tope() {
  # Corre un paso con el tiempo que queda hasta las 5:00 (mínimo 60 s).
  local nombre=$1; shift
  local seg; seg=$(queda); [ "$seg" -lt 60 ] && { echo "-- $nombre: no alcanzó el tiempo"; return 124; }
  echo "-- $nombre ($(date +%T))"
  "$@" &
  local pid=$!
  ( sleep "$seg"; kill -TERM "$pid" 2>/dev/null ) & local vigia=$!
  wait "$pid"; local salida=$?
  kill "$vigia" 2>/dev/null
  echo "-- $nombre terminó con $salida"
  return $salida
}

# El iPhone simulado usa el teclado físico: el de la pantalla no aparece y no tapa los botones.
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool true

if [ "${ACEPTACION_SIN_COMPILAR:-}" != "1" ]; then
  xcrun simctl list devices booted | grep -q Booted || xcrun simctl boot "iPhone 18 Pro" || true
  con_tope "compilar apps" bash scripts/tiendas/simulador-ios.sh repartidor cliente \
    || echo "-- la compilación falló: se prueba con la última instalada"
fi
con_tope "robot de las apps" node scripts/aceptacion/apps.mjs
con_tope "robot del panel" node scripts/aceptacion/panel.mjs
con_tope "examen de Camila" node scripts/aceptacion/camila.mjs
# Los 83 destinos del tabulador de El Vigía en el buscador (P2 completa). El guion ya espera entre
# búsquedas por el tope de 40 por minuto: no se le quita esa espera.
con_tope "destinos del tabulador" node scripts/aceptacion/destinos.mjs
node scripts/aceptacion/parte.mjs
echo "== termina $(date)"
