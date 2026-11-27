// Dibujos NEUTROS e inventados para las tres fotos de «Estoy aquí» (C-TRES-FOTOS, 27 nov 2026):
// la entrada, el letrero y la vista desde la calle de un lugar de ejemplo. Sin personas, sin carros
// (ni placas), sin textos ni marcas: sirven igual en español y en inglés (C-DOCS-SIN-DATOS-REALES).
// Salen en e2e/recorrido/fotos/lugar-{entrada,letrero,calle}.jpg (se guardan en el repositorio y el
// guion de capturas de «Estoy aquí» las reutiliza).
// Uso: node scripts/recorrido/fotos-lugar-dibujos.mjs
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SALIDA = join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos');
mkdirSync(SALIDA, { recursive: true });
const ANCHO = 1280;
const ALTO = 960;
const TRAZO = '#2F2F2F';

const cielo = `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#BFD7EA"/><stop offset="1" stop-color="#EAF1F7"/>
  </linearGradient></defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#c)"/>`;

const arbol = (x, y, r) => `
  <rect x="${x - r * 0.12}" y="${y}" width="${r * 0.24}" height="${r * 1.3}" fill="#7A5A3A" stroke="${TRAZO}" stroke-width="4"/>
  <circle cx="${x}" cy="${y - r * 0.2}" r="${r}" fill="#7FA36B" stroke="${TRAZO}" stroke-width="5"/>`;

const dibujos = {
  // 1. La entrada: una fachada baja con toldo, puerta doble de vidrio y dos ventanas.
  entrada: `
    ${cielo}
    <rect x="0" y="800" width="${ANCHO}" height="160" fill="#B9B4AA"/>
    <rect x="160" y="250" width="960" height="550" fill="#E3D9C6" stroke="${TRAZO}" stroke-width="7"/>
    <path d="M140 330 L1140 330 L1100 410 L180 410 Z" fill="#C8463F" stroke="${TRAZO}" stroke-width="6"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map(
        (i) =>
          `<line x1="${200 + i * 100}" y1="330" x2="${195 + i * 96}" y2="410" stroke="#F4EDE0" stroke-width="10"/>`,
      )
      .join('')}
    <rect x="510" y="470" width="260" height="330" fill="#9EC1D6" stroke="${TRAZO}" stroke-width="7"/>
    <line x1="640" y1="470" x2="640" y2="800" stroke="${TRAZO}" stroke-width="6"/>
    <rect x="612" y="610" width="10" height="60" fill="${TRAZO}"/>
    <rect x="658" y="610" width="10" height="60" fill="${TRAZO}"/>
    <rect x="230" y="480" width="200" height="180" fill="#BFD7EA" stroke="${TRAZO}" stroke-width="6"/>
    <rect x="850" y="480" width="200" height="180" fill="#BFD7EA" stroke="${TRAZO}" stroke-width="6"/>
    <rect x="490" y="800" width="300" height="24" fill="#8E897F"/>
    ${arbol(80, 600, 70)}`,
  // 2. El letrero: un poste con un aviso de parada (solo figuras, sin palabras) frente a un muro.
  letrero: `
    ${cielo}
    <rect x="0" y="560" width="${ANCHO}" height="400" fill="#D8D2C6"/>
    <rect x="0" y="820" width="${ANCHO}" height="140" fill="#B9B4AA"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7]
      .map(
        (i) =>
          `<rect x="${i * 170}" y="560" width="160" height="70" fill="#CFC8BA" stroke="${TRAZO}" stroke-width="3"/>`,
      )
      .join('')}
    <rect x="620" y="300" width="40" height="540" fill="#6E7378" stroke="${TRAZO}" stroke-width="5"/>
    <rect x="430" y="120" width="420" height="260" rx="22" fill="#1F4D69" stroke="${TRAZO}" stroke-width="8"/>
    <rect x="465" y="155" width="350" height="190" rx="14" fill="none" stroke="#FFFFFF" stroke-width="6"/>
    <rect x="545" y="190" width="190" height="100" rx="18" fill="#FFFFFF"/>
    <rect x="565" y="205" width="65" height="40" rx="6" fill="#1F4D69"/>
    <rect x="650" y="205" width="65" height="40" rx="6" fill="#1F4D69"/>
    <circle cx="585" cy="300" r="18" fill="#FFFFFF" stroke="#1F4D69" stroke-width="8"/>
    <circle cx="695" cy="300" r="18" fill="#FFFFFF" stroke="#1F4D69" stroke-width="8"/>
    ${arbol(1120, 520, 90)}
    ${arbol(160, 540, 80)}`,
  // 3. La vista desde la calle: la acera, la esquina y el lugar al fondo, sin carros ni personas.
  calle: `
    ${cielo}
    <rect x="0" y="520" width="${ANCHO}" height="440" fill="#C9C3B6"/>
    <polygon points="0,960 1280,960 760,520 520,520" fill="#8C8F93"/>
    <polygon points="560,960 720,960 650,520 630,520" fill="#8C8F93"/>
    ${[0, 1, 2, 3, 4]
      .map((i) => {
        const y = 560 + i * 85;
        const w = 6 + i * 5;
        return `<rect x="${640 - w / 2}" y="${y}" width="${w}" height="${30 + i * 10}" fill="#F4F1EA"/>`;
      })
      .join('')}
    <polygon points="0,700 520,520 520,540 0,760" fill="#C9C3B6"/>
    <polygon points="1280,700 760,520 760,540 1280,760" fill="#C9C3B6"/>
    <polygon points="0,180 500,440 500,528 0,705" fill="#E3D9C6" stroke="${TRAZO}" stroke-width="6"/>
    <polygon points="60,330 170,370 170,470 60,450" fill="#BFD7EA" stroke="${TRAZO}" stroke-width="4"/>
    <polygon points="260,400 360,430 360,500 260,490" fill="#BFD7EA" stroke="${TRAZO}" stroke-width="4"/>
    <polygon points="1280,160 780,440 780,528 1280,705" fill="#D9CBB3" stroke="${TRAZO}" stroke-width="6"/>
    <polygon points="1220,320 1110,365 1110,470 1220,450" fill="#BFD7EA" stroke="${TRAZO}" stroke-width="4"/>
    <polygon points="1020,400 920,432 920,500 1020,490" fill="#BFD7EA" stroke="${TRAZO}" stroke-width="4"/>
    <rect x="560" y="400" width="160" height="120" fill="#E3D9C6" stroke="${TRAZO}" stroke-width="5"/>
    <path d="M552 420 L728 420 L716 445 L564 445 Z" fill="#C8463F" stroke="${TRAZO}" stroke-width="4"/>
    <rect x="615" y="460" width="50" height="60" fill="#9EC1D6" stroke="${TRAZO}" stroke-width="4"/>
    ${arbol(530, 470, 30)}
    ${arbol(750, 470, 30)}`,
};

for (const [nombre, cuerpo] of Object.entries(dibujos)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">${cuerpo}</svg>`;
  const destino = join(SALIDA, `lugar-${nombre}.jpg`);
  await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(destino);
  console.log(`✓ ${destino}`);
}
