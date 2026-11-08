// C-PRUEBAS-SIN-INDEXAR (8 nov 2026, Richard): el sitio de pruebas (staging.tumbite.com) es una copia
// entera de la web de Divoox y no puede salir en Google: duplica el contenido de divoox.com.
// Solo para el paquete de PRUEBAS: robots.txt cierra todo y cada página lleva
// <meta name="robots" content="noindex, nofollow">. El servidor además manda X-Robots-Tag en pruebas.
// Uso: node scripts/sin-indexar.mjs <carpeta del paquete de pruebas>
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: node scripts/sin-indexar.mjs <carpeta>');
  process.exit(2);
}
export const META_NOINDEX = '<meta name="robots" content="noindex, nofollow" />';

writeFileSync(
  join(carpeta, 'robots.txt'),
  '# Sitio de pruebas de Divoox: no se indexa. La web pública es https://divoox.com\nUser-agent: *\nDisallow: /\n',
);

let paginas = 0;
const recorrer = (d) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    if (statSync(r).isDirectory()) recorrer(r);
    else if (n.endsWith('.html')) {
      const html = readFileSync(r, 'utf8');
      if (html.includes('name="robots"')) continue;
      const nuevo = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${META_NOINDEX}`);
      if (nuevo !== html) {
        writeFileSync(r, nuevo);
        paginas++;
      }
    }
  }
};
recorrer(carpeta);
console.log(`sin-indexar: robots.txt cerrado y noindex en ${paginas} páginas`);
