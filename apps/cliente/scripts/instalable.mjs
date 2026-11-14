// C-APP-INSTALABLE (13 nov 2026, Richard): la versión web de cada app se puede «Agregar a la
// pantalla de inicio» y queda como una aplicación (ícono propio, sin la barra del navegador). Sirve
// para quien tiene iPhone mientras Apple revisa, y para cualquier celular sin tienda. Todos los países.
// Uso: node apps/cliente/scripts/instalable.mjs <carpeta exportada> <carpeta de la app>
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const salida = resolve(process.argv[2] ?? 'dist-web');
const app = resolve(process.argv[3] ?? '.');
const ficha = JSON.parse(readFileSync(join(app, 'app.json'), 'utf8')).expo;
const archivo = join(salida, 'index.html');
let html = readFileSync(archivo, 'utf8');

// La base («/app», «/driver», «/restaurant») sale de lo que Expo ya escribió en la página.
const base = /href="(\/[a-z-]+)\/favicon\.ico"/.exec(html)?.[1];
if (!base) throw new Error('instalable: no se encontró la base de la app en index.html');
// El color de cada app es el fondo de su ícono (rojo cliente, azul Driver, negro Restaurants).
const COLOR = { '/app': '#F20D20', '/driver': '#1F4D69', '/restaurant': '#101010' };
const color = COLOR[base] ?? '#F20D20';

mkdirSync(join(salida, 'instalable'), { recursive: true });
const icono = join(app, 'assets', 'icon.png');
for (const lado of [180, 192, 512])
  await sharp(icono)
    .resize(lado, lado)
    .png()
    .toFile(join(salida, 'instalable', `icono-${lado}.png`));

writeFileSync(
  join(salida, 'manifest.json'),
  JSON.stringify(
    {
      name: ficha.name,
      short_name: ficha.name,
      start_url: `${base}/`,
      scope: `${base}/`,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: color,
      icons: [192, 512].map((lado) => ({
        src: `${base}/instalable/icono-${lado}.png`,
        sizes: `${lado}x${lado}`,
        type: 'image/png',
        purpose: 'any',
      })),
    },
    null,
    2,
  ),
);

html = html
  .replace(
    /<meta name="theme-color" content="[^"]*" \/>/,
    `<meta name="theme-color" content="${color}" />`,
  )
  .replace(
    '</head>',
    `<link rel="manifest" href="${base}/manifest.json"/>` +
      `<link rel="apple-touch-icon" href="${base}/instalable/icono-180.png"/>` +
      '<meta name="apple-mobile-web-app-capable" content="yes"/>' +
      '<meta name="mobile-web-app-capable" content="yes"/>' +
      `<meta name="apple-mobile-web-app-title" content="${ficha.name}"/>` +
      '<meta name="apple-mobile-web-app-status-bar-style" content="default"/></head>',
  );
if (!html.includes('rel="manifest"'))
  throw new Error('instalable: no se pudo enlazar el manifiesto');
writeFileSync(archivo, html);
// C-AVISOS-WEB (13 nov 2026): el trabajador de avisos, en la carpeta de la app (su alcance es esa
// carpeta). Solo avisos: no guarda copias de la app. Se registra desde la app, no desde esta página.
copyFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'avisos-sw.js'),
  join(salida, 'avisos-sw.js'),
);
console.log(`web: ${ficha.name} instalable en ${base}, con su trabajador de avisos`);
