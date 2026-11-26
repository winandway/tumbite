#!/bin/bash
# Instala la tarea nocturna de la lista de aceptación en esta Mac (C-ROBOT-NOCTURNO, 26 nov 2026).
# - 2:00: lanzar.sh pone al día la copia fija del robot y corre noche.sh (de 2 a 5 como mucho).
# - 7:00: vuelve a escribir el parte en ~/Gerencia/partes (si la noche se cortó, lo dice).
# Es launchd del usuario: no usa la nube, no gasta créditos de IA y no pide contraseña.
# Uso: bash scripts/aceptacion/instalar-tarea.sh   (se puede repetir: reemplaza lo anterior)
set -euo pipefail
REPO=/Users/windocellc/Divoox
COPIA=$REPO/.robot-nocturno
DIR=$HOME/.config/tumbite/robot-nocturno
# launchd no carga el perfil de la terminal: se guarda dónde está Node (nvm) al instalar.
NODO=$(dirname "$(command -v node)")
mkdir -p "$DIR" "$HOME/Library/LaunchAgents"
chmod 700 "$DIR"

# La copia fija vive dentro del proyecto pero fuera de git (exclusión local, no se commitea).
grep -qx '/.robot-nocturno/' "$REPO/.git/info/exclude" 2>/dev/null || echo '/.robot-nocturno/' >> "$REPO/.git/info/exclude"

cat > "$DIR/lanzar.sh" <<EOF
#!/bin/bash
# Lo llama launchd. Pone al día la copia fija y corre la noche.
export PATH="$NODO:/opt/homebrew/bin:/usr/local/bin:\$PATH"
set -uo pipefail
cd "$REPO" || exit 1
git fetch -q origin main || true
# Mientras los robots no estén en la rama principal, se corre la rama de los robots.
if git cat-file -e origin/main:scripts/aceptacion/noche.sh 2>/dev/null; then REF=origin/main; else REF=refs/heads/fase-robots-union; fi
if [ ! -d "$COPIA" ]; then git worktree add --detach "$COPIA" "\$REF"; fi
cd "$COPIA" || exit 1
git checkout -q --detach "\$REF" && git reset -q --hard "\$REF"
npm ci --no-audit --no-fund --loglevel=error >/dev/null 2>&1 || npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1
exec bash scripts/aceptacion/noche.sh
EOF
cat > "$DIR/parte.sh" <<EOF
#!/bin/bash
export PATH="$NODO:/opt/homebrew/bin:/usr/local/bin:\$PATH"
cd "$COPIA" 2>/dev/null && exec node scripts/aceptacion/parte.mjs
EOF
chmod 700 "$DIR/lanzar.sh" "$DIR/parte.sh"

plist() { # nombre hora guion
  cat > "$HOME/Library/LaunchAgents/com.windoce.divoox.$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.windoce.divoox.$1</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$3</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$2</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$DIR/$1.log</string>
  <key>StandardErrorPath</key><string>$DIR/$1.log</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/com.windoce.divoox.$1" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.windoce.divoox.$1.plist"
}
plist robot-nocturno 2 "$DIR/lanzar.sh"
plist robot-parte 7 "$DIR/parte.sh"
echo "Tarea nocturna instalada: 2:00 robots, 7:00 parte en ~/Gerencia/partes."
