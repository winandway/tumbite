#!/bin/bash
# Fábrica de Divoox: gancho «Stop». Mientras FILA.md tenga puntos sin marcar,
# no deja que la sesión se quede parada: le devuelve el siguiente punto.
# Para frenarla a propósito: crear el archivo .fabrica-pausa en la raíz.
DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$DIR" 2>/dev/null || exit 0
[ -f FILA.md ] || exit 0
[ -f .fabrica-pausa ] && exit 0
ENTRADA="$(cat)"
SESION="$(printf '%s' "$ENTRADA" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("session_id","sin-sesion"))
except Exception: print("sin-sesion")')"
CUENTA_ARCH="$(git rev-parse --git-dir 2>/dev/null || echo /tmp)/fabrica-$SESION.cuenta"
N=$(cat "$CUENTA_ARCH" 2>/dev/null || echo 0)
TOPE=${FABRICA_TOPE:-60}
if [ "$N" -ge "$TOPE" ]; then exit 0; fi
SIGUIENTE="$(grep -m1 -E '^- \[ \] ' FILA.md | sed -E 's/^- \[ \] //')"
[ -z "$SIGUIENTE" ] && exit 0
echo $((N + 1)) > "$CUENTA_ARCH"
python3 - "$SIGUIENTE" "$((N + 1))" "$TOPE" <<'PY'
import json, sys
punto, n, tope = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
  "decision": "block",
  "reason": (
    f"FÁBRICA ({n}/{tope}): todavía quedan puntos en FILA.md. No te detengas. "
    f"Sigue con el primero sin marcar: «{punto[:400]}». "
    "Al terminarlo márcalo [x] en FILA.md, haz commit y pasa al siguiente. "
    "Si de verdad depende de Richard (clave, dinero, decisión legal), márcalo [!] con la razón "
    "en una línea, súmalo a «Esperando por ti» y sigue con el siguiente. "
    "Todo en español."
  )
}, ensure_ascii=False))
PY
exit 0
