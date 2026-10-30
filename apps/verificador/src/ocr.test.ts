import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { leerAamva } from './aamva';
import { cruzarConFrente, datosDelFrente } from './documento';
import { corregirMrz, leerMrz } from './mrz';
import { leerFrente, leerMrzDeFoto } from './ocr';

/** C-KYC-OCR (29 oct 2026): la franja del pasaporte se lee desde la foto y se valida con sus controles. */
const MRZ: [string, string] = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
];
const HOY = new Date('2010-01-01T00:00:00Z');
const BUENOS = {
  numero: 'L898902C3',
  apellidos: 'ERIKSSON',
  nombres: 'ANNA MARIA',
  nacimiento: '1974-08-12',
  vencimiento: '2012-04-15',
  sexo: 'F',
};

const esc = (t = '') => t.replace(/</g, '&lt;');

async function fotoDeFranja(letra: string) {
  // La franja como aparece al pie del pasaporte: letra de ancho fijo, negra sobre claro.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="220">
    <rect width="100%" height="100%" fill="#f4f1ea"/>
    <text x="30" y="90" font-family="${letra}" font-size="40" fill="#111">${esc(MRZ[0])}</text>
    <text x="30" y="170" font-family="${letra}" font-size="40" fill="#111">${esc(MRZ[1])}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('corrección por posición de la franja (C-KYC-OCR)', () => {
  it('arregla lo que el OCR confunde de verdad: O por 0 en el país y Z por 7 en el dato opcional', () => {
    // Lectura real del OCR del 29 oct 2026 sobre esta franja.
    const leida: [string, string] = [MRZ[0], 'L898902C36UT07408122F12041597E184226B<<<<<10'];
    expect(leerMrz(leida, HOY)?.controlesOk).toBe(false);
    const r = leerMrz(corregirMrz(leida), HOY);
    expect(r?.controlesOk).toBe(true);
    expect(r?.datos).toMatchObject(BUENOS);
  });

  it('arregla el número del pasaporte solo si su dígito de control lo confirma', () => {
    // Límite del estándar: en algunas posiciones un «1» y una «L» dan el mismo dígito de control, así que
    // el número también se cruza con el frente y el código de barras. Aquí, una B leída donde va un 8.
    const leida: [string, string] = [MRZ[0], 'L89B902C36UTO74O8122F12O4159ZE184226B<<<<<1O'];
    const r = leerMrz(corregirMrz(leida), HOY);
    expect(r?.controlesOk).toBe(true);
    expect(r?.datos.numero).toBe('L898902C3');
  });

  it('nunca inventa: una fecha cambiada de verdad sigue rechazada', () => {
    const alterada: [string, string] = [MRZ[0], 'L898902C36UTO7508122F1204159ZE184226B<<<<<10'];
    expect(leerMrz(corregirMrz(alterada), HOY)?.controlesOk).toBe(false);
  });
});

describe('lectura de la franja del pasaporte desde la foto (C-KYC-OCR)', () => {
  // La regla que no se negocia: si el motor da la franja por buena, los datos son los correctos. Una
  // lectura que no cuadra con los dígitos de control nunca pasa (va a revisión).
  for (const letra of ['monospace', 'Courier New, monospace']) {
    it(`con letra ${letra}: o la lee bien o la rechaza, nunca acepta datos malos`, async () => {
      const r = await leerMrzDeFoto(await fotoDeFranja(letra), HOY);
      if (r?.controlesOk) expect(r.datos).toMatchObject(BUENOS);
      else expect(r === null || r.controlesOk === false).toBe(true);
    }, 120_000);
  }
});

describe('lectura del frente de la licencia desde la foto (C-KYC-OCR)', () => {
  // La misma licencia de muestra (datos inventados) que la prueba del código de barras.
  const lic = leerAamva(
    [
      '@',
      '\u001e',
      'ANSI 636014090102DL00410288ZC03290034DLDAQD1234562',
      'DCSMUESTRA',
      'DACANA',
      'DADMARIA',
      'DBD08292021',
      'DBB01151990',
      'DBA01152030',
      'DAJFL',
      'DCGUSA',
    ].join('\n'),
  )!;

  async function fotoDelFrente(lineas: string[]) {
    const textos = lineas
      .map(
        (l, i) =>
          `<text x="40" y="${70 + i * 60}" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#111">${l}</text>`,
      )
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${100 + lineas.length * 60}"><rect width="100%" height="100%" fill="#eef2f6"/>${textos}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  it('el frente de la misma persona coincide con el código de barras', async () => {
    const texto = await leerFrente(
      await fotoDelFrente([
        'DRIVER LICENSE',
        'DL D123 4562',
        'MUESTRA',
        'ANA MARIA',
        'DOB 01/15/1990',
        'EXP 01/15/2030',
      ]),
    );
    expect(cruzarConFrente(lic, datosDelFrente(lic, texto)).coincide).toBe(true);
  }, 120_000);

  it('el frente de otra persona no coincide', async () => {
    const texto = await leerFrente(
      await fotoDelFrente(['DRIVER LICENSE', 'DL X998 8770', 'GOMEZ', 'PEDRO', 'DOB 03/02/1985']),
    );
    expect(cruzarConFrente(lic, datosDelFrente(lic, texto)).coincide).toBe(false);
  }, 120_000);
});
