import { describe, expect, it } from 'vitest';
import bwipjs from 'bwip-js/node';
import sharp from 'sharp';
import { leerCodigoDeFoto } from './codigoBarras';
import { leerAamva } from './aamva';

/** C-KYC-CODIGO-FOTO (29 oct 2026): el código de barras de la licencia se lee desde la foto. */
const TEXTO = [
  '@',
  'ANSI 636014090102DL00410288ZC03290034DLDAQD1234562',
  'DCSMUESTRA',
  'DACANA',
  'DBB01151990',
  'DBA01152030',
  'DBC2',
  'DAJFL',
].join('\n');

async function fotoDelCodigo(giro = 0) {
  // Un PDF417 de verdad dibujado en una «foto» con margen blanco, como una licencia fotografiada.
  const png = await bwipjs.toBuffer({
    bcid: 'pdf417',
    text: TEXTO,
    scale: 3,
    padding: 20,
    backgroundcolor: 'FFFFFF',
  });
  return sharp(png).rotate(giro, { background: '#ffffff' }).png().toBuffer();
}

describe('lectura del código de barras desde la foto (C-KYC-CODIGO-FOTO)', () => {
  it('lee el código derecho y de lado, y sus datos salen de la licencia', async () => {
    for (const giro of [0, 90]) {
      const texto = await leerCodigoDeFoto(await fotoDelCodigo(giro));
      expect(texto).toBe(TEXTO);
      expect(leerAamva(texto ?? '')).toMatchObject({ numero: 'D1234562', apellidos: 'MUESTRA' });
    }
  }, 30_000);

  it('una foto sin código no inventa nada', async () => {
    const blanco = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    expect(await leerCodigoDeFoto(blanco)).toBeNull();
  }, 30_000);
});
