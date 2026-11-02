#!/usr/bin/env bash
# Publica la página de progreso (carpeta progreso/) en el sitio divoox-progreso de YaDominios Cloud.
# El sitio está conectado a la rama «progreso-sitio», que solo lleva el contenido de progreso/.
# Uso: bash scripts/progreso/publicar.sh   (después de editar progreso/datos.json y hacer commit)
set -euo pipefail
cd "$(dirname "$0")/../.."
# Foto del estado de Divoox con su hora (la página la muestra; un sitio no alcanza a otro en vivo).
curl -s --max-time 15 https://divoox.com/datos/salud | python3 -c '
import json, sys, datetime
d = json.load(sys.stdin)
salida = {"ok": d.get("ok", False), "piezas": d.get("piezas", {}), "medido": datetime.datetime.now(datetime.timezone.utc).isoformat()}
open("progreso/salud.json", "w").write(json.dumps(salida, ensure_ascii=False, indent=2) + "\n")
' || echo "aviso: no se pudo leer el estado de Divoox; se publica sin foto nueva"
git add progreso
git diff --cached --quiet || git commit -q -m "chore(progreso): actualiza la página de progreso [skip ci]"
rama=$(git subtree split --prefix progreso HEAD 2>/dev/null | tr -d "\r" | tail -1 | grep -oE "[0-9a-f]{40}$")
git push -f origin "${rama}:refs/heads/progreso-sitio"
llave=$(cat ~/.config/tumbite/progreso-llave 2>/dev/null || true)
if [ -n "$llave" ]; then
  curl -s -X POST https://yapanel.yadominios.com/api/sitio/v1/republicar -H "authorization: Bearer $llave" >/dev/null || true
fi
echo "Publicado: https://divoox-progreso.sitios.dev"
