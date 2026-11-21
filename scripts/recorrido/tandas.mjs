// C-RECORRIDO-TANDAS (16 nov 2026): el recorrido completo corre en TRES tandas en paralelo (una máquina
// cada una, con su propia base). En un solo carril ya pasaba de los 20 minutos (76 pruebas, unos 15,5
// minutos de pruebas más la compilación). Las tandas se arman por el TIEMPO medido en la nube, no por
// la cantidad de pruebas: la división automática de Playwright dejaba una tanda de 9 minutos.
// La tanda 3 es «todo lo demás»: una prueba nueva entra sola ahí y nunca se queda sin correr.
// 21 nov 2026: «todo lo demás» rozaba los 20 minutos y se cortaba; se parte en dos tandas (3 y 4),
// alternando los archivos en orden alfabético: una prueba nueva entra sola en una de las dos.
// Uso: node scripts/recorrido/tandas.mjs <1|2|3|4>   → imprime los archivos de esa tanda.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = join(import.meta.dirname, '..', '..', 'e2e', 'recorrido');
export const TANDAS_FIJAS = [
  // ~330 s: el pedido de punta a punta en inglés y en español.
  ['recorrido.spec.ts'],
  // ~310 s: servicios conectados, cobro en mano internacional, ciudad de juego y bloque de Flex.
  [
    'serviciosConectados.spec.ts',
    'internacional.spec.ts',
    'ciudadJuego.spec.ts',
    'flexBloque.spec.ts',
  ],
];

export function archivosDeRecorrido() {
  return readdirSync(carpeta)
    .filter((f) => f.endsWith('.spec.ts'))
    .sort();
}

export function tanda(n) {
  if (n === 1 || n === 2) return TANDAS_FIJAS[n - 1];
  if (n === 3 || n === 4) {
    const fijas = new Set(TANDAS_FIJAS.flat());
    return archivosDeRecorrido()
      .filter((f) => !fijas.has(f))
      .filter((_, i) => i % 2 === n - 3);
  }
  throw new Error(`recorrido: tanda no válida: ${n}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2]);
  console.log(
    tanda(n)
      .map((f) => `e2e/recorrido/${f}`)
      .join(' '),
  );
}
