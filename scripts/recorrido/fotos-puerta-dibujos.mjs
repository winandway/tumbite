// Dibujos NEUTROS e inventados para las capturas de la foto de la puerta (C-FOTO-PUERTA, 15 nov 2026).
// Nada de fotos de casas reales: fachadas simples dibujadas con figuras, con un número de ejemplo.
// Salen en e2e/recorrido/fotos/puerta-*-{es,en}.jpg (se guardan en el repositorio y el guion las reutiliza).
// Uso: node scripts/recorrido/fotos-puerta-dibujos.mjs
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SALIDA = join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos');
mkdirSync(SALIDA, { recursive: true });
const ANCHO = 1280;
const ALTO = 960;

const cielo = (arriba, abajo) => `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${arriba}"/><stop offset="1" stop-color="${abajo}"/>
  </linearGradient></defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#c)"/>`;

const numero = (x, y, texto, tam = 64) => `
  <rect x="${x - tam * 0.9}" y="${y - tam * 0.85}" width="${tam * 1.8}" height="${tam * 1.15}" rx="8" fill="#F4F1EA" stroke="#2F2F2F" stroke-width="4"/>
  <text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${tam}" text-anchor="middle" fill="#2F2F2F">${texto}</text>`;

const puerta = (x, y, w, h, color) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}" stroke="#2F2F2F" stroke-width="6"/>
  <rect x="${x + w * 0.14}" y="${y + h * 0.08}" width="${w * 0.72}" height="${h * 0.36}" rx="4" fill="none" stroke="#2F2F2F" stroke-width="4" opacity="0.55"/>
  <rect x="${x + w * 0.14}" y="${y + h * 0.52}" width="${w * 0.72}" height="${h * 0.38}" rx="4" fill="none" stroke="#2F2F2F" stroke-width="4" opacity="0.55"/>
  <circle cx="${x + w * 0.84}" cy="${y + h * 0.5}" r="${w * 0.05}" fill="#C9A646" stroke="#2F2F2F" stroke-width="3"/>`;

const dibujos = (letrero) => ({
  // Casa: frente desde la calle, con techo, ventanas, puerta roja, tapete y número.
  'puerta-casa-frente': `
    ${cielo('#BFDDF2', '#EAF4FA')}
    <rect y="760" width="${ANCHO}" height="200" fill="#9BBF7A"/>
    <rect y="860" width="${ANCHO}" height="100" fill="#B9B4AA"/>
    <polygon points="250,360 640,130 1030,360" fill="#7A4E3A" stroke="#2F2F2F" stroke-width="6"/>
    <rect x="290" y="360" width="700" height="400" fill="#F2E3C6" stroke="#2F2F2F" stroke-width="6"/>
    <rect x="340" y="430" width="160" height="130" fill="#CFE6F3" stroke="#2F2F2F" stroke-width="6"/>
    <line x1="420" y1="430" x2="420" y2="560" stroke="#2F2F2F" stroke-width="4"/>
    <rect x="780" y="430" width="160" height="130" fill="#CFE6F3" stroke="#2F2F2F" stroke-width="6"/>
    <line x1="860" y1="430" x2="860" y2="560" stroke="#2F2F2F" stroke-width="4"/>
    ${puerta(560, 470, 160, 290, '#B5333B')}
    <rect x="545" y="760" width="190" height="22" rx="6" fill="#5C6B4E"/>
    ${numero(640, 438, '120', 44)}
    <rect x="180" y="640" width="60" height="120" fill="#5E8C4A" rx="28"/>
    <rect x="1040" y="620" width="70" height="140" fill="#5E8C4A" rx="32"/>`,
  // Casa: la puerta de cerca, con timbre y número.
  'puerta-casa-cerca': `
    <rect width="${ANCHO}" height="${ALTO}" fill="#F2E3C6"/>
    <rect y="880" width="${ANCHO}" height="80" fill="#B9B4AA"/>
    ${puerta(430, 110, 420, 770, '#B5333B')}
    ${numero(1010, 300, '120', 70)}
    <rect x="960" y="430" width="70" height="110" rx="10" fill="#E6E2D8" stroke="#2F2F2F" stroke-width="5"/>
    <circle cx="995" cy="485" r="20" fill="#F4F1EA" stroke="#2F2F2F" stroke-width="5"/>
    <rect x="410" y="870" width="460" height="30" rx="8" fill="#5C6B4E"/>`,
  // Edificio: la entrada principal con el nombre y el número del edificio.
  'puerta-edificio-entrada': `
    ${cielo('#C9DDEA', '#EEF3F6')}
    <rect y="820" width="${ANCHO}" height="140" fill="#B9B4AA"/>
    <rect x="200" y="80" width="880" height="740" fill="#D9D4CC" stroke="#2F2F2F" stroke-width="6"/>
    ${[0, 1, 2, 3]
      .flatMap((f) =>
        [0, 1, 2, 3, 4].map(
          (c) =>
            `<rect x="${250 + c * 165}" y="${120 + f * 110}" width="115" height="75" fill="#BFD7E6" stroke="#2F2F2F" stroke-width="4"/>`,
        ),
      )
      .join('')}
    <rect x="420" y="560" width="440" height="60" fill="#3E4A55"/>
    <text x="640" y="603" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="40" text-anchor="middle" fill="#F4F1EA">${letrero.torre}</text>
    <rect x="500" y="630" width="280" height="190" fill="#9FC2D6" stroke="#2F2F2F" stroke-width="6"/>
    <line x1="640" y1="630" x2="640" y2="820" stroke="#2F2F2F" stroke-width="5"/>
    ${numero(950, 690, '45', 54)}`,
  // Edificio: el paso intermedio (portería con su ventanilla y el portón).
  'puerta-edificio-porteria': `
    <rect width="${ANCHO}" height="${ALTO}" fill="#E9E5DE"/>
    <rect y="800" width="${ANCHO}" height="160" fill="#C8C2B6"/>
    <rect x="120" y="260" width="460" height="540" fill="#CFC8BC" stroke="#2F2F2F" stroke-width="6"/>
    <rect x="170" y="330" width="360" height="200" fill="#BFD7E6" stroke="#2F2F2F" stroke-width="5"/>
    <rect x="160" y="530" width="380" height="30" fill="#8C7B66"/>
    <rect x="200" y="200" width="300" height="60" rx="6" fill="#3E4A55"/>
    <text x="350" y="243" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="38" text-anchor="middle" fill="#F4F1EA">${letrero.porteria}</text>
    <rect x="660" y="300" width="500" height="500" fill="none" stroke="#2F2F2F" stroke-width="8"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8]
      .map(
        (i) =>
          `<line x1="${690 + i * 55}" y1="300" x2="${690 + i * 55}" y2="800" stroke="#2F2F2F" stroke-width="6"/>`,
      )
      .join('')}
    <line x1="660" y1="550" x2="1160" y2="550" stroke="#2F2F2F" stroke-width="6"/>`,
  // Edificio: la puerta del apartamento en el pasillo, con su número.
  'puerta-apartamento': `
    <rect width="${ANCHO}" height="${ALTO}" fill="#EDE8DF"/>
    <rect y="860" width="${ANCHO}" height="100" fill="#A79E8F"/>
    <rect x="0" y="860" width="${ANCHO}" height="8" fill="#7E7567"/>
    ${puerta(460, 140, 360, 720, '#5B6E86')}
    ${numero(640, 120, '4B', 60)}
    <rect x="890" y="430" width="16" height="16" rx="8" fill="#2F2F2F"/>
    <rect x="980" y="300" width="160" height="220" fill="#F7F4EE" stroke="#2F2F2F" stroke-width="4"/>
    <rect x="1000" y="320" width="120" height="180" fill="#9BBF7A" opacity="0.6"/>
    <rect x="440" y="852" width="400" height="22" rx="6" fill="#6B5A48"/>`,
});

// Cada idioma con sus letreros (C-CAPTURAS-POR-IDIOMA): el dibujo en inglés no lleva palabras en español.
const LETREROS = {
  es: { torre: 'TORRE NORTE', porteria: 'PORTERÍA' },
  en: { torre: 'NORTH TOWER', porteria: 'FRONT DESK' },
};

let n = 0;
for (const [idioma, letrero] of Object.entries(LETREROS))
  for (const [nombre, cuerpo] of Object.entries(dibujos(letrero))) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">${cuerpo}</svg>`;
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 82 })
      .toFile(join(SALIDA, `${nombre}-${idioma}.jpg`));
    n++;
  }
console.log(`fotos de puerta: ${n} dibujos en e2e/recorrido/fotos/`);
