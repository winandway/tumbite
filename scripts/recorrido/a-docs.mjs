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
for (const archivo of readdirSync(origen).filter((f) => f.endsWith('.png'))) {
  // Las del panel del restaurante y las páginas web (web-…) quedan a su ancho.
  const celular = !archivo.startsWith('restaurante-') && !archivo.startsWith('web-');
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
