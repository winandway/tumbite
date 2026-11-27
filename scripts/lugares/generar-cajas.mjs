// C-REGISTRO-TODO-EL-PAIS · vuelve a escribir las cajas de los estados desde el catálogo publicado
// (sin red). Uso: node scripts/lugares/generar-cajas.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cajasDesdeCatalogo, escribirCajas } from './cajas.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const n = escribirCajas(
  cajasDesdeCatalogo(join(RAIZ, 'apps', 'panel', 'public', 'lugares')),
  join(RAIZ, 'packages', 'compartido', 'src', 'cajasEstados.ts'),
);
console.log(`Cajas de ${n} estados escritas en packages/compartido/src/cajasEstados.ts`);
