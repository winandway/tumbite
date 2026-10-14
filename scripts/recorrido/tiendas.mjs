// Las capturas para la App Store y Google Play, en inglés y en español, al tamaño exacto de cada
// tienda. Corre el recorrido completo dos veces (Apple y Google), cada una con la base nueva.
// Quedan en capturas-tiendas/<app>/<tienda>/<idioma>/<Celular|Tableta>/NN-que-pantalla-es.png
// Uso: npm run recorrido:tiendas
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');
const correr = (cmd, env = {}) =>
  execSync(cmd, { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(join(raiz, 'capturas-tiendas'), { recursive: true, force: true });
let compilado = false;
for (const tienda of ['apple', 'google']) {
  correr('node scripts/recorrido/preparar.mjs', {
    TIENDA: tienda,
    ...(compilado ? { SIN_COMPILAR: '1' } : {}),
  });
  compilado = true;
  correr('npx playwright test -c playwright.recorrido.config.ts', { TIENDA: tienda });
}
console.log('tiendas: capturas listas en capturas-tiendas/');
