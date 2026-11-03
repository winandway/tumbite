// C-RUTAS-SIN-ARROBA (LAN-6): YaDominios Cloud responde 307 a cualquier ruta con «@» y manda a la
// misma con «%40»: un viaje de más en la primera carga (la fuente de íconos de Expo vive en
// assets/node_modules/@expo/…). Después de exportar una app web, cada archivo o carpeta con «@» en
// el nombre se renombra («@» → «_») y se corrigen sus referencias en los archivos de texto.
// Uso: node scripts/sin-arroba.mjs <carpeta de la app exportada>
import { readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: node scripts/sin-arroba.mjs <carpeta>');
  process.exit(2);
}
const TEXTO = /\.(js|mjs|html|json|css|map|txt)$/;
const posix = (r) => r.split(sep).join('/');

const archivos = [];
const recorrer = (d) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    if (statSync(r).isDirectory()) recorrer(r);
    else archivos.push(r);
  }
};
recorrer(carpeta);

// Cada archivo con «@» en su ruta, con su ruta nueva (relativas a la carpeta de la app).
const cambios = archivos
  .map((a) => posix(relative(carpeta, a)))
  .filter((r) => r.includes('@'))
  .map((r) => [r, r.replaceAll('@', '_')]);

// Primero las referencias (con las rutas viejas todavía en disco), las más largas antes.
const ordenados = [...cambios].sort((a, b) => b[0].length - a[0].length);
for (const a of archivos.filter((x) => TEXTO.test(x))) {
  const antes = readFileSync(a, 'utf8');
  let t = antes;
  for (const [viejo, nuevo] of ordenados) t = t.replaceAll(viejo, nuevo);
  if (t !== antes) writeFileSync(a, t);
}

// Después los archivos: las carpetas con «@» se renombran de la más honda a la más alta.
const rutas = new Set();
for (const [viejo] of cambios) {
  const partes = viejo.split('/');
  for (let i = 1; i <= partes.length; i++) {
    const r = partes.slice(0, i).join('/');
    if (partes[i - 1].includes('@')) rutas.add(r);
  }
}
for (const r of [...rutas].sort((a, b) => b.split('/').length - a.split('/').length)) {
  const partes = r.split('/');
  const nombre = partes.pop();
  renameSync(
    join(carpeta, ...partes, nombre),
    join(carpeta, ...partes, nombre.replaceAll('@', '_')),
  );
}
const quedan = [];
const revisar = (d) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    if (n.includes('@')) quedan.push(r);
    if (statSync(r).isDirectory()) revisar(r);
  }
};
revisar(carpeta);
if (quedan.length) {
  console.error(`sin-arroba: quedan rutas con «@»: ${quedan.join(', ')}`);
  process.exit(1);
}
console.log(`sin-arroba: ${cambios.length} archivo(s) sin «@» en ${carpeta}`);
