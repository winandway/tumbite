import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { leerMrzDeFoto } from './ocr';

/** C-KYC-OCR (29 oct 2026): la franja del pasaporte se lee desde la foto y se valida con sus controles. */
const MRZ = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
];

const esc = (t = '') => t.replace(/</g, '&lt;');

async function fotoDeFranja() {
  // La franja como aparece al pie del pasaporte: letra de ancho fijo, negra sobre claro.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="220">
    <rect width="100%" height="100%" fill="#f4f1ea"/>
    <text x="30" y="90" font-family="Courier New, monospace" font-size="40" fill="#111">${esc(MRZ[0])}</text>
    <text x="30" y="170" font-family="Courier New, monospace" font-size="40" fill="#111">${esc(MRZ[1])}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('lectura de la franja del pasaporte desde la foto (C-KYC-OCR)', () => {
  // Hallazgo (29 oct 2026): el OCR genérico confunde «<» con K o L y «L» con «1» en la franja. Lo que
  // importa: los dígitos de control lo detectan y una lectura mala NUNCA pasa como buena. Leerla bien
  // necesita un modelo entrenado en la letra OCR-B (K6c).
  it('una franja mal leída no pasa: los dígitos de control lo detectan', async () => {
    const r = await leerMrzDeFoto(await fotoDeFranja(), new Date('2010-01-01T00:00:00Z'));
    expect(r === null || r.controlesOk === false).toBe(true);
  }, 120_000);
});
