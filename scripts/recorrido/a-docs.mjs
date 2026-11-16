// Pasa las capturas del recorrido (docs/capturas/recorrido/*.png, las originales) a las versiones
// livianas de Docs (apps/panel/public/docs/recorrido-<nombre>-<idioma>.webp). Las del celular se
// achican a la mitad; las del panel quedan a su ancho. Uso: npm run recorrido:docs
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');
const origen = join(raiz, 'docs', 'capturas', 'recorrido');
const destino = join(raiz, 'apps', 'panel', 'public', 'docs');
let n = 0;
// C-AYUDA-INTERNA: lo del superadmin nunca pasa a Docs públicos, aunque quede una original aquí.
const INTERNA = /^(moderacion-computadora-bandeja-|super-)/;
for (const archivo of readdirSync(origen).filter((f) => f.endsWith('.png') && !INTERNA.test(f))) {
  // Las del panel del restaurante y las páginas web (web-…) quedan a su ancho.
  // Y las tomadas en una computadora (`-computadora-`), como la cámara web de la foto de la puerta.
  const celular =
    !archivo.startsWith('restaurante-') &&
    !archivo.startsWith('web-') &&
    !archivo.includes('-computadora-');
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    ...(celular ? ['-resize', '540', '0'] : []),
    join(origen, archivo),
    '-o',
    join(destino, `recorrido-${archivo.replace(/\.png$/, '.webp')}`),
  ]);
  n++;
}
console.log(`recorrido: ${n} capturas listas para Docs`);
