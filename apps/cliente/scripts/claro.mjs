// Después de exportar la versión web: fondo blanco y modo claro siempre, aunque el teléfono
// esté en modo oscuro, y el idioma del documento en español. La plantilla de Expo no lo trae.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sirve para las dos apps web (cliente y repartidor): se le puede pasar la carpeta exportada.
const archivo = process.argv[2]
  ? resolve(process.argv[2], 'index.html')
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-web', 'index.html');
let html = readFileSync(archivo, 'utf8');
html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace(
    /<title>([^<]*)<\/title>/,
    '<meta name="color-scheme" content="only light" />\n    <meta name="theme-color" content="#FF3008" />\n    <title>$1</title>\n    <style>html, body { background: #ffffff !important; color: #191919; color-scheme: only light; }</style>',
  );
if (!html.includes('name="color-scheme"'))
  throw new Error('claro: no se pudo inyectar el modo claro');
writeFileSync(archivo, html);
console.log('web: modo claro forzado');
