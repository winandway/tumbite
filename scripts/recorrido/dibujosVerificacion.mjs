/* eslint-disable security/detect-object-injection, security/detect-non-literal-fs-filename -- guion local: llaves fijas de los dibujos y archivo temporal propio */
// Dibujos de EJEMPLO para la cámara simulada del asistente de verificación de Driver (22 nov 2026):
// una cara ilustrada (no es una persona) y documentos que dicen «EJEMPLO» por todos lados (ninguno
// es real). Cada uno sale como un cuadro JPEG de 640 × 480, el tamaño de la cámara simulada de
// Chromium, y como video MJPEG para `--use-file-for-fake-video-capture`.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const FONDO = '#C9C4BA';
const LETRA = 'font-family="Helvetica, Arial, sans-serif"';
const lineas = (x, y, anchos, alto = 9, sep = 20) =>
  anchos
    .map(
      (w, i) =>
        `<rect x="${x}" y="${y + i * sep}" width="${w}" height="${alto}" rx="4" fill="#B9C2CC"/>`,
    )
    .join('');
const silueta = (
  x,
  y,
  w,
  h,
) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#DDE4EC"/>
<circle cx="${x + w / 2}" cy="${y + h * 0.4}" r="${w * 0.22}" fill="#9AA7B5"/>
<path d="M${x + w * 0.16} ${y + h} q${w * 0.34} -${h * 0.5} ${w * 0.68} 0z" fill="#9AA7B5"/>`;
const marcaAgua = (cx, cy) =>
  `<text x="${cx}" y="${cy}" ${LETRA} font-size="64" font-weight="800" fill="#F20D20" fill-opacity="0.13" text-anchor="middle" transform="rotate(-18 ${cx} ${cy})">EJEMPLO</text>`;

/** Una tarjeta de bolsillo (85,6 × 54 mm) centrada en la mesa. */
function tarjeta(color, titulo, cuerpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
<rect width="640" height="480" fill="${FONDO}"/>
<rect x="86" y="96" width="468" height="295" rx="22" fill="#000" fill-opacity="0.18"/>
<g transform="translate(80 88)">
<rect width="468" height="295" rx="22" fill="#FBFBF8"/>
<rect width="468" height="58" rx="22" fill="${color}"/><rect y="36" width="468" height="22" fill="${color}"/>
<text x="24" y="38" ${LETRA} font-size="22" font-weight="800" fill="#fff">${titulo}</text>
${cuerpo}
${marcaAgua(234, 190)}
</g></svg>`;
}

const SVG = {
  cara: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
<rect width="640" height="480" fill="#E8EEF3"/>
<rect x="0" y="330" width="640" height="150" fill="#DCE3EA"/>
<path d="M170 480 L196 372 q124 -36 248 0 L470 480z" fill="#1F4D69"/>
<rect x="296" y="300" width="48" height="52" fill="#E0A97E"/>
<ellipse cx="320" cy="225" rx="92" ry="112" fill="#EDB78C"/>
<path d="M228 205 q4 -112 92 -116 q88 4 92 116 q-30 -58 -92 -62 q-62 4 -92 62z" fill="#3B2A20"/>
<ellipse cx="286" cy="232" rx="10" ry="12" fill="#2A2A2A"/><ellipse cx="354" cy="232" rx="10" ry="12" fill="#2A2A2A"/>
<path d="M270 206 q16 -10 32 0" stroke="#3B2A20" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M338 206 q16 -10 32 0" stroke="#3B2A20" stroke-width="6" fill="none" stroke-linecap="round"/>
<path d="M320 240 q-8 26 4 30" stroke="#C98A60" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M290 288 q30 22 60 0" stroke="#A4472F" stroke-width="7" fill="none" stroke-linecap="round"/>
<ellipse cx="228" cy="236" rx="12" ry="22" fill="#E0A97E"/><ellipse cx="412" cy="236" rx="12" ry="22" fill="#E0A97E"/>
</svg>`,
  doc_frente: tarjeta(
    '#1F4D69',
    'DOCUMENTO DE IDENTIDAD · EJEMPLO',
    `${silueta(24, 80, 120, 150)}
<text x="166" y="98" ${LETRA} font-size="14" fill="#666B73">NOMBRE</text>
<text x="166" y="122" ${LETRA} font-size="22" font-weight="700" fill="#101010">NOMBRE DE EJEMPLO</text>
<text x="166" y="156" ${LETRA} font-size="14" fill="#666B73">NÚMERO</text>
<text x="166" y="180" ${LETRA} font-size="22" font-weight="700" fill="#101010">00000000</text>
${lineas(166, 204, [220, 170, 240])}`,
  ),
  doc_reverso: tarjeta(
    '#1F4D69',
    'REVERSO · EJEMPLO',
    `${lineas(24, 86, [400, 360, 380, 300])}
<g transform="translate(24 182)">${Array.from({ length: 46 }, (_, i) => `<rect x="${i * 9}" y="0" width="${i % 3 ? 4 : 6}" height="72" fill="#101010"/>`).join('')}</g>`,
  ),
  licencia_frente: tarjeta(
    '#666B73',
    'LICENCIA DE CONDUCIR · EJEMPLO',
    `${silueta(24, 80, 120, 150)}
<text x="166" y="98" ${LETRA} font-size="14" fill="#666B73">TITULAR</text>
<text x="166" y="122" ${LETRA} font-size="22" font-weight="700" fill="#101010">NOMBRE DE EJEMPLO</text>
<text x="166" y="156" ${LETRA} font-size="14" fill="#666B73">CATEGORÍA</text>
<text x="166" y="180" ${LETRA} font-size="22" font-weight="700" fill="#101010">A · EJEMPLO</text>
${lineas(166, 204, [200, 240, 150])}`,
  ),
  licencia_reverso: tarjeta(
    '#666B73',
    'LICENCIA · REVERSO · EJEMPLO',
    `${lineas(24, 86, [380, 400, 330, 360, 290, 340])}`,
  ),
  seguro: tarjeta(
    '#101010',
    'PÓLIZA DE SEGURO · EJEMPLO',
    `<text x="24" y="98" ${LETRA} font-size="14" fill="#666B73">VIGENCIA</text>
<text x="24" y="124" ${LETRA} font-size="22" font-weight="700" fill="#101010">01/01/2026 — 31/12/2026</text>
<text x="24" y="160" ${LETRA} font-size="14" fill="#666B73">VEHÍCULO</text>
<text x="24" y="186" ${LETRA} font-size="22" font-weight="700" fill="#101010">MOTO · PLACA EJ0000</text>
${lineas(24, 208, [400, 320, 360])}`,
  ),
  vehiculo: tarjeta(
    '#C20A1A',
    'DOCUMENTO DEL VEHÍCULO · EJEMPLO',
    `<text x="24" y="98" ${LETRA} font-size="14" fill="#666B73">PLACA</text>
<text x="24" y="124" ${LETRA} font-size="22" font-weight="700" fill="#101010">EJ0000</text>
<text x="24" y="160" ${LETRA} font-size="14" fill="#666B73">MARCA Y MODELO</text>
<text x="24" y="186" ${LETRA} font-size="22" font-weight="700" fill="#101010">MARCA EJEMPLO · MODELO</text>
${lineas(24, 208, [380, 300, 340])}`,
  ),
};

// La moto de frente y su placa: dibujos de ejemplo (ninguna moto ni placa real).
SVG.moto = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
<rect width="640" height="480" fill="#DCE3EA"/><rect y="360" width="640" height="120" fill="#B9C2CC"/>
<rect x="296" y="300" width="48" height="150" rx="20" fill="#2A2A2A"/>
<rect x="232" y="180" width="176" height="150" rx="40" fill="#F20D20"/>
<rect x="196" y="150" width="248" height="18" rx="9" fill="#2A2A2A"/>
<circle cx="320" cy="230" r="30" fill="#FFF7D6" stroke="#2A2A2A" stroke-width="6"/>
<rect x="276" y="282" width="88" height="34" rx="5" fill="#FBFBF8" stroke="#2A2A2A" stroke-width="3"/>
<text x="320" y="306" ${LETRA} font-size="18" font-weight="800" fill="#101010" text-anchor="middle">EJ0000</text>
${marcaAgua(320, 120)}</svg>`;
SVG.placa = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
<rect width="640" height="480" fill="#2A2A2A"/>
<rect x="120" y="150" width="400" height="180" rx="18" fill="#FBFBF8" stroke="#101010" stroke-width="8"/>
<text x="320" y="196" ${LETRA} font-size="22" font-weight="700" fill="#666B73" text-anchor="middle">PLACA DE EJEMPLO</text>
<text x="320" y="292" ${LETRA} font-size="88" font-weight="800" fill="#101010" text-anchor="middle">EJ0000</text></svg>`;

export const DIBUJOS = Object.keys(SVG);

/** El cuadro JPEG del dibujo (640 × 480, para mirarlo). */
export const cuadro = (nombre) =>
  sharp(Buffer.from(SVG[nombre])).resize(640, 480).jpeg({ quality: 90 }).toBuffer();

/**
 * El cuadro de la cámara, vertical como la de un teléfono (720 × 1280): el dibujo al ancho, en el
 * medio, sobre su mismo fondo. Así la vista de la cámara (que llena la pantalla) lo deja dentro del marco.
 */
async function cuadroVertical(nombre) {
  // La cara: el dibujo agrandado, con la cara a la altura del óvalo de la app y el cuerpo hasta abajo.
  if (nombre === 'cara') {
    const cuerpo = SVG.cara.replace(/^<svg[^>]*>/, '').replace('</svg>', '');
    const vertical = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">
<rect width="720" height="1280" fill="#E8EEF3"/>
<g transform="translate(360 384) scale(1.96) translate(-320 -225)">${cuerpo}</g>
<rect y="884" width="720" height="396" fill="#DCE3EA"/>
<rect x="66" y="880" width="588" height="400" fill="#1F4D69"/></svg>`;
    return sharp(Buffer.from(vertical)).jpeg({ quality: 90 }).toBuffer();
  }
  // La tarjeta (de 640 de ancho, con su centro a 235 del borde de arriba del dibujo) se pone donde
  // la app dibuja el marco: la vista llena la pantalla del teléfono (390 × 844, «cover»), así que el
  // centro del marco (a 260 puntos; el del seguro, a 226) cae a 395 (o 343) del cuadro de 1280.
  const centro = nombre === 'seguro' ? 343 : 395;
  const dibujo = await sharp(Buffer.from(SVG[nombre])).resize(640).png().toBuffer();
  return sharp({ create: { width: 720, height: 1280, channels: 3, background: FONDO } })
    .composite([{ input: dibujo, left: 40, top: centro - 235 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** El video MJPEG (30 cuadros iguales) que «filma» la cámara simulada. */
export async function videoDe(nombre, archivo) {
  const c = await cuadroVertical(nombre);
  writeFileSync(archivo, Buffer.concat(Array.from({ length: 30 }, () => c)));
  return archivo;
}
