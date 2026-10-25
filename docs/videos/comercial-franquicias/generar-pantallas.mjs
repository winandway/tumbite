/* global process, console, document */
// Imágenes del comercial de franquicias (25 oct 2026): tarjetas sin ninguna marca, en PNG con fondo
// transparente (1080×1080) para poner encima del video grabado en chroma, y el PDF horizontal con el
// guion escena por escena. Uso: node docs/videos/comercial-franquicias/generar-pantallas.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = import.meta.dirname;
const SALIDA = join(AQUI, 'pantallas');
mkdirSync(SALIDA, { recursive: true });

const R = '#F20D20';
const B = '#FFFFFF';
const G = '#9A9EA6';

// Íconos dibujados a mano en SVG (trazo blanco, acento rojo). Nada de logos ni marcas.
const I = {
  usa: `<rect x="40" y="60" width="220" height="150" rx="8" fill="none" stroke="${B}" stroke-width="8"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="40" y="${60 + i * 21.4}" width="220" height="10.7" fill="${R}" opacity="${i % 2 ? 0 : 0.9}"/>`).join('')}
    <rect x="40" y="60" width="95" height="75" fill="#101010" stroke="${B}" stroke-width="4"/>
    ${[0, 1, 2].map((f) => [0, 1, 2, 3].map((c) => `<circle cx="${55 + c * 22}" cy="${76 + f * 22}" r="4" fill="${B}"/>`).join('')).join('')}
    <line x1="40" y1="60" x2="40" y2="260" stroke="${B}" stroke-width="8"/>`,
  avion: `<path d="M30 150 L270 150 M150 150 L110 70 L130 70 L190 150 M150 150 L110 230 L130 230 L190 150 M60 150 L45 115 L60 115 L80 150 M60 150 L45 185 L60 185 L80 150" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="262" cy="150" r="8" fill="${R}"/>`,
  bombilla: `<path d="M150 40 C95 40 65 85 75 125 C82 155 110 170 112 200 L188 200 C190 170 218 155 225 125 C235 85 205 40 150 40 Z" stroke="${B}" stroke-width="10" fill="none"/><path d="M120 225 H180 M128 248 H172" stroke="${B}" stroke-width="10" stroke-linecap="round"/><path d="M130 200 L130 140 L150 120 L170 140 L170 200" stroke="${R}" stroke-width="7" fill="none"/>`,
  telefono: `<path d="M70 120 C70 80 230 80 230 120 L230 140 L190 140 L185 115 L115 115 L110 140 L70 140 Z" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round"/><rect x="95" y="160" width="110" height="80" rx="14" stroke="${B}" stroke-width="10" fill="none"/>${[0, 1, 2].map((f) => [0, 1, 2].map((c) => `<circle cx="${125 + c * 25}" cy="${180 + f * 20}" r="5" fill="${R}"/>`).join('')).join('')}`,
  carro: `<path d="M40 190 L50 150 L95 140 L125 100 L200 100 L235 140 L265 150 L268 190 Z" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round"/><circle cx="95" cy="195" r="24" fill="#101010" stroke="${R}" stroke-width="10"/><circle cx="215" cy="195" r="24" fill="#101010" stroke="${R}" stroke-width="10"/><path d="M135 108 L135 140 M190 108 L190 140" stroke="${B}" stroke-width="6"/>`,
  tv: `<rect x="50" y="70" width="200" height="140" rx="16" stroke="${B}" stroke-width="10" fill="none"/><path d="M115 40 L150 68 L185 40 M110 245 H190" stroke="${B}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M80 170 Q110 110 150 150 T220 110" stroke="${R}" stroke-width="8" fill="none"/>`,
  chip: `<rect x="90" y="90" width="120" height="120" rx="10" stroke="${B}" stroke-width="10" fill="none"/><rect x="122" y="122" width="56" height="56" fill="${R}"/>${[0, 1, 2, 3].map((i) => `<path d="M${105 + i * 30} 90 V60 M${105 + i * 30} 210 V240 M90 ${105 + i * 30} H60 M210 ${105 + i * 30} H240" stroke="${B}" stroke-width="8"/>`).join('')}`,
  pc: `<rect x="55" y="60" width="190" height="125" rx="10" stroke="${B}" stroke-width="10" fill="none"/><path d="M130 185 L120 225 H180 L170 185 M40 250 H260" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round"/><path d="M80 95 H160 M80 120 H200 M80 145 H140" stroke="${R}" stroke-width="8" stroke-linecap="round"/>`,
  gps: `<circle cx="150" cy="150" r="95" stroke="${B}" stroke-width="8" fill="none"/><ellipse cx="150" cy="150" rx="40" ry="95" stroke="${B}" stroke-width="6" fill="none"/><path d="M55 150 H245 M70 100 H230 M70 200 H230" stroke="${B}" stroke-width="5"/><path d="M150 70 C125 70 110 88 110 110 C110 140 150 175 150 175 C150 175 190 140 190 110 C190 88 175 70 150 70 Z" fill="${R}"/><circle cx="150" cy="110" r="14" fill="#101010"/>`,
  smartphone: `<rect x="95" y="35" width="110" height="230" rx="22" stroke="${B}" stroke-width="10" fill="none"/><path d="M135 55 H165" stroke="${B}" stroke-width="8" stroke-linecap="round"/>${[0, 1, 2].map((f) => [0, 1].map((c) => `<rect x="${115 + c * 40}" y="${80 + f * 45}" width="30" height="30" rx="7" fill="${f === 0 && c === 0 ? R : B}" opacity="${f === 0 && c === 0 ? 1 : 0.85}"/>`).join('')).join('')}`,
  internet: `<circle cx="150" cy="150" r="22" fill="${R}"/>${[
    [60, 70],
    [240, 70],
    [55, 225],
    [245, 230],
    [150, 40],
    [150, 262],
  ]
    .map(
      ([x, y]) =>
        `<line x1="150" y1="150" x2="${x}" y2="${y}" stroke="${B}" stroke-width="6"/><circle cx="${x}" cy="${y}" r="15" fill="#101010" stroke="${B}" stroke-width="7"/>`,
    )
    .join('')}`,
  ia: `<path d="M150 50 L165 125 L240 140 L165 155 L150 230 L135 155 L60 140 L135 125 Z" fill="${R}"/><path d="M230 55 L236 80 L260 86 L236 92 L230 117 L224 92 L200 86 L224 80 Z" fill="${B}"/><path d="M75 190 L80 210 L100 215 L80 220 L75 240 L70 220 L50 215 L70 210 Z" fill="${B}"/>`,
  mundo: `<circle cx="150" cy="150" r="105" stroke="${B}" stroke-width="10" fill="none"/><path d="M95 85 C120 95 115 120 140 125 C160 128 160 150 145 165 C130 180 140 210 125 235 M190 70 C175 95 205 110 215 130 C225 150 205 170 220 195" stroke="${R}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  ciudad: `${[
    [50, 120, 40, 140],
    [100, 80, 45, 180],
    [155, 140, 40, 120],
    [205, 100, 45, 160],
  ]
    .map(
      ([x, y, w, h]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${B}" stroke-width="8" fill="none"/>`,
    )
    .join(
      '',
    )}<path d="M30 260 H270" stroke="${B}" stroke-width="8"/><path d="M40 70 L120 40 L250 60 L265 150 L240 250 L60 255 L30 160 Z" stroke="${R}" stroke-width="7" fill="none" stroke-dasharray="16 10"/>`,
  moto: `<circle cx="80" cy="200" r="38" stroke="${B}" stroke-width="10" fill="none"/><circle cx="225" cy="200" r="38" stroke="${B}" stroke-width="10" fill="none"/><path d="M80 200 L130 140 L190 140 L225 200 M130 140 L115 105 L90 105" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round" stroke-linecap="round"/><rect x="160" y="70" width="80" height="65" rx="8" fill="${R}"/>`,
  tablet: `<rect x="50" y="60" width="200" height="160" rx="18" stroke="${B}" stroke-width="10" fill="none"/><rect x="75" y="85" width="150" height="40" rx="6" fill="${R}"/><path d="M75 150 H225 M75 180 H190" stroke="${B}" stroke-width="9" stroke-linecap="round"/><circle cx="150" cy="245" r="7" fill="${B}"/>`,
  megafono: `<path d="M60 130 L60 175 L95 175 L200 230 L200 75 L95 130 Z" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round"/><path d="M95 175 L110 240 L140 240 L130 185" stroke="${B}" stroke-width="9" fill="none" stroke-linejoin="round"/><path d="M225 110 Q250 152 225 195 M245 85 Q285 152 245 220" stroke="${R}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  caja: `<path d="M60 110 L150 70 L240 110 L240 205 L150 245 L60 205 Z M60 110 L150 150 L240 110 M150 150 L150 245" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round"/><path d="M105 90 L195 130" stroke="${R}" stroke-width="10"/>`,
  maletin: `<rect x="45" y="100" width="210" height="140" rx="16" stroke="${B}" stroke-width="10" fill="none"/><path d="M115 100 V75 C115 65 120 60 130 60 H170 C180 60 185 65 185 75 V100 M45 160 H255" stroke="${B}" stroke-width="10" fill="none"/><rect x="132" y="148" width="36" height="26" rx="5" fill="${R}"/>`,
  candado: `<rect x="80" y="135" width="140" height="115" rx="16" stroke="${B}" stroke-width="10" fill="none"/><path d="M110 135 V100 C110 70 130 55 150 55 C170 55 190 70 190 100 V135" stroke="${B}" stroke-width="10" fill="none"/><circle cx="150" cy="185" r="14" fill="${R}"/><path d="M150 195 V220" stroke="${R}" stroke-width="9"/>`,
  mensaje: `<path d="M50 70 H250 C258 70 262 74 262 82 V190 C262 198 258 202 250 202 H130 L85 240 L92 202 H50 C42 202 38 198 38 190 V82 C38 74 42 70 50 70 Z" stroke="${B}" stroke-width="10" fill="none" stroke-linejoin="round"/>${[0, 1, 2].map((i) => `<circle cx="${110 + i * 40}" cy="136" r="11" fill="${R}"/>`).join('')}`,
};

// Cada escena: archivo, momento del guion, ícono(s), título grande, línea chica.
const ESCENAS = [
  {
    n: '01',
    t: '0:00',
    ico: ['usa'],
    titulo: 'Estados Unidos',
    sub: 'El mundo invierte en sus ideas',
    dice: '¿Sabía usted que Estados Unidos lidera el mundo porque su gente cree en sus ideas…?',
  },
  {
    n: '02',
    t: '0:07',
    ico: ['avion'],
    titulo: 'El avión',
    sub: 'Hermanos Wright · 1903',
    dice: 'Aquí nació el avión.',
  },
  {
    n: '03',
    t: '0:09',
    ico: ['bombilla'],
    titulo: 'La bombilla de Edison',
    sub: 'Luz en las casas · 1879',
    dice: 'La bombilla de Edison.',
  },
  {
    n: '04',
    t: '0:11',
    ico: ['telefono'],
    titulo: 'El teléfono',
    sub: 'Patentado en EE. UU. · 1876',
    dice: 'El teléfono.',
  },
  {
    n: '05',
    t: '0:13',
    ico: ['carro'],
    titulo: 'El carro para todos',
    sub: 'Producción en serie de Ford · 1913',
    dice: 'El carro para todos, con Ford.',
  },
  {
    n: '06',
    t: '0:15',
    ico: ['tv'],
    titulo: 'La televisión electrónica',
    sub: 'San Francisco · 1927',
    dice: 'La televisión.',
  },
  { n: '07', t: '0:17', ico: ['chip'], titulo: 'El microchip', sub: '1958', dice: 'El microchip.' },
  {
    n: '08',
    t: '0:19',
    ico: ['pc'],
    titulo: 'La computadora personal',
    sub: 'Años 70',
    dice: 'La computadora personal.',
  },
  {
    n: '09',
    t: '0:21',
    ico: ['gps'],
    titulo: 'El GPS',
    sub: 'Te ubica en cualquier lugar',
    dice: 'El GPS.',
  },
  {
    n: '10',
    t: '0:23',
    ico: ['smartphone'],
    titulo: 'El teléfono inteligente',
    sub: 'El mundo en tu bolsillo',
    dice: 'El teléfono inteligente.',
  },
  {
    n: '11',
    t: '0:25',
    ico: ['internet'],
    titulo: 'Internet',
    sub: 'La red que nos conecta · 1969',
    dice: 'E internet.',
  },
  {
    n: '12',
    t: '0:30',
    ico: ['ia'],
    titulo: 'Inteligencia artificial',
    sub: 'San Francisco · noviembre de 2022',
    dice: 'En noviembre de 2022 explotó… la inteligencia artificial.',
  },
  {
    n: '13',
    t: '0:40',
    ico: ['mundo'],
    titulo: 'Despertemos',
    sub: 'Su propia red social · sus celulares · sus carros',
    dice: 'Hoy quiero hacer un llamado a América Latina y a cada país del mundo.',
  },
  {
    n: '14',
    t: '0:55',
    ico: ['ciudad'],
    titulo: 'Ciudad por ciudad',
    sub: 'Así empezaron las grandes apps de reparto',
    dice: 'Usted conoce Uber, DoorDash, Rappi… todas empezaron ciudad por ciudad.',
  },
  {
    n: '16',
    t: '1:12',
    ico: ['moto', 'tablet', 'caja', 'megafono'],
    titulo: 'Lista para lanzar',
    sub: 'Motos · tabletas · material · un año de publicidad',
    dice: 'Una flota de motos, tabletas para los restaurantes, el material de lanzamiento y un año de publicidad.',
  },
  {
    n: '17',
    t: '1:22',
    ico: [],
    paises: true,
    titulo: 'Para cualquier país',
    sub: '',
    dice: 'Venezuela, Colombia, Brasil, Argentina, República Dominicana, México, Estados Unidos.',
  },
  {
    n: '18',
    t: '1:30',
    ico: ['maletin'],
    titulo: 'Para inversionistas',
    sub: 'Con capital disponible para la inversión inicial',
    dice: 'Este proyecto es para inversionistas con el capital disponible.',
  },
  {
    n: '19',
    t: '1:38',
    ico: ['candado'],
    titulo: 'El nombre, en privado',
    sub: 'Lo conocerá en una conversación privada',
    dice: 'El nombre de nuestra marca lo conocerá en una conversación privada.',
  },
  {
    n: '20',
    t: '1:42',
    ico: ['mensaje'],
    titulo: 'Escríbanos',
    sub: 'Toque el botón de este anuncio',
    dice: 'Escríbanos desde el botón de este anuncio.',
  },
];

const PAISES = [
  ['🇻🇪', 'Venezuela'],
  ['🇨🇴', 'Colombia'],
  ['🇧🇷', 'Brasil'],
  ['🇦🇷', 'Argentina'],
  ['🇩🇴', 'Rep. Dominicana'],
  ['🇲🇽', 'México'],
  ['🇺🇸', 'Estados Unidos'],
];

const svg = (k, tam) =>
  `<svg viewBox="0 0 300 300" width="${tam}" height="${tam}">${new Map(Object.entries(I)).get(k) ?? ''}</svg>`;

const tarjeta = (e) => `
<div class="t">
  ${
    e.paises
      ? `<div class="paises">${PAISES.map(([f, p]) => `<div><span>${f}</span>${p}</div>`).join('')}</div>`
      : `<div class="ico">${e.ico.map((k) => svg(k, e.ico.length > 1 ? 180 : 420)).join('')}</div>`
  }
  <h1>${e.titulo}</h1>
  ${e.sub ? `<p>${e.sub}</p>` : ''}
</div>`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Montserrat:wght@500;600&display=swap');
html,body{margin:0;background:transparent}
.t{width:1000px;height:1000px;margin:40px;box-sizing:border-box;border-radius:56px;background:rgba(16,16,16,.92);
  border:3px solid rgba(255,255,255,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-family:Montserrat,sans-serif;color:#fff;text-align:center;padding:60px}
.ico{display:flex;flex-wrap:nowrap;gap:24px;justify-content:center;margin-bottom:40px}
h1{font-family:Poppins,sans-serif;font-weight:800;font-size:84px;line-height:1.05;margin:0}
p{font-size:40px;color:${G};margin:24px 0 0;font-weight:600}
.paises{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:40px;font-size:44px;font-weight:600;text-align:left}
.paises span{font-size:52px;margin-right:22px;vertical-align:middle}
`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1080 } });
for (const e of ESCENAS) {
  await pagina.setContent(
    `<!doctype html><meta charset="utf-8"><style>${CSS}</style>${tarjeta(e)}`,
    {
      waitUntil: 'networkidle',
    },
  );
  await pagina.evaluate(() => document.fonts.ready);
  const nombre = `${e.n}-${e.titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}.png`;
  e.archivo = nombre;
  await pagina.screenshot({ path: join(SALIDA, nombre), omitBackground: true });
}

// PDF horizontal: una escena por fila, con lo que se dice y la imagen que va encima.
// Pantallas REALES de la app (las arma pantallas-app.py con el logo tapado por «SU MARCA»).
const APPS = [
  [
    '15-0',
    '1:00',
    'las-tres-apps',
    'Hoy le ofrezco la franquicia exclusiva de su ciudad (las tres apps: cliente, restaurante y repartidor).',
  ],
  [
    '15-1',
    '1:03',
    'app-cliente-inicio',
    'Ser el dueño de la aplicación de reparto de comida de su ciudad.',
  ],
  ['15-2', '1:05', 'app-cliente-menu', 'Que cada pedido que llega a un hogar…'],
  ['15-3', '1:07', 'app-cliente-carrito', '…pase por una aplicación de su ciudad…'],
  ['15-4', '1:09', 'app-cliente-seguimiento', '…en la que usted invirtió y de la que usted gana.'],
  [
    '16-1',
    '1:12',
    'app-restaurante-pedido-nuevo',
    'La aplicación funcionando… tabletas para los restaurantes.',
  ],
  ['16-2', '1:14', 'app-repartidor-oferta', 'Una flota de motos con la marca.'],
  ['16-3', '1:16', 'app-repartidor-en-camino', 'El material de lanzamiento…'],
  ['16-4', '1:18', 'app-repartidor-ganancias', 'Usted participa de los beneficios de su ciudad.'],
].map(([n, t, nombre, dice]) => ({ n, t, dice, archivo: `${n}-${nombre}.png` }));
for (const e of ESCENAS) if (e.n === '16') e.t = '1:20';
const todas = [...ESCENAS, ...APPS].sort((a, b) => a.t.localeCompare(b.t, 'es', { numeric: true }));
const filas = todas
  .map(
    (e) =>
      `<div class="esc"><img src="pantallas/${e.archivo}"><div><b>${e.t} · Imagen ${e.n}</b><q>${e.dice}</q><small>Archivo: ${e.archivo}</small></div></div>`,
  )
  .join('');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Comercial de franquicias · escenas</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Montserrat:wght@500;600&display=swap');
@page{size:A4 landscape;margin:12mm}
body{font-family:Montserrat,sans-serif;color:#101010;margin:0}
h1{font-family:Poppins;font-size:28px;margin:0 0 4px}
.intro{font-size:13px;margin:0 0 14px;color:#333}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}
.esc{display:flex;gap:14px;align-items:center;border:1px solid #d6d6d6;border-radius:10px;padding:8px;break-inside:avoid}
.esc img{width:120px;height:120px;object-fit:contain;background:#3a3a3a;border-radius:8px}
.esc b{font-family:Poppins;font-size:14px;display:block}
.esc q{display:block;font-size:13px;margin:4px 0}
.esc small{color:#666B73;font-size:10.5px}
</style>
<h1>Comercial «La aplicación de su ciudad» · escenas e imágenes</h1>
<p class="intro">Imágenes sin ninguna marca: tarjetas de los inventos y pantallas REALES de la app con el logo cambiado por «SU MARCA», en la carpeta «pantallas» (PNG de 1080 × 1080 con fondo transparente, para poner encima del video grabado en chroma). Cada una indica en qué segundo del guion va y qué frase la acompaña. El guion completo está en el documento GUION-COMERCIAL-FRANQUICIAS.</p>
<div class="grid">${filas}</div></html>`;
writeFileSync(join(AQUI, 'escenas.html'), html);
const pdf = await navegador.newPage();
await pdf.goto(`file://${join(AQUI, 'escenas.html')}`, { waitUntil: 'networkidle' });
await pdf.evaluate(() => document.fonts.ready);
await pdf.pdf({
  path: join(AQUI, 'Comercial-franquicias-escenas.pdf'),
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
});
await navegador.close();
console.log(`listo: ${ESCENAS.length} imágenes y el PDF`);
process.exit(0);
