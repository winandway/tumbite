#!/usr/bin/env bash
# Publica la página de progreso (carpeta progreso/) en el sitio divoox-progreso de YaDominios Cloud.
# El sitio está conectado a la rama «progreso-sitio», que solo lleva el contenido de progreso/.
# Uso: bash scripts/progreso/publicar.sh   (después de editar progreso/datos.json y hacer commit)
set -euo pipefail
cd "$(dirname "$0")/../.."
rama=$(git subtree split --prefix progreso HEAD)
git push -f origin "$rama:refs/heads/progreso-sitio"
llave=$(cat ~/.config/tumbite/progreso-llave 2>/dev/null || true)
if [ -n "$llave" ]; then
  curl -s -X POST https://yapanel.yadominios.com/api/sitio/v1/republicar -H "authorization: Bearer $llave" >/dev/null || true
fi
echo "Publicado: https://divoox-progreso.sitios.dev"
