import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import bwipjs from 'bwip-js/node';
import sharp from 'sharp';
import { verificar } from './verificar';

/**
 * C-KYC-MOTOR (29 oct 2026): la verificación de punta a punta con una licencia completa armada en la
 * prueba (código de barras atrás; foto y datos al frente) y la selfie. Datos inventados; la cara es la
 * de las fotos de muestra de face-api (MIT), sin copiarla al repo.
 */
const requerir = createRequire(import.meta.url);
const muestra = join(
  dirname(requerir.resolve('@vladmandic/face-api/package.json')),
  'demo/sample1.jpg',
);
const PERSONA_A = { left: 1376, top: 120, width: 400, height: 420 };
const PERSONA_B = { left: 250, top: 200, width: 520, height: 560 };
const HOY = new Date('2026-10-29T12:00:00Z');

const codigo = (vence: string) =>
  [
    '@',
    'ANSI 636014090102DL00410288ZC03290034DLDAQD1234562',
    'DCSMUESTRA',
    'DACANA',
    'DADMARIA',
    'DBB01151990',
    `DBA${vence}`,
    'DBC2',
    'DAJFL',
  ].join('\n');

const reverso = async (vence = '01152030') =>
  bwipjs.toBuffer({
    bcid: 'pdf417',
    text: codigo(vence),
    scale: 3,
    padding: 20,
    backgroundcolor: 'FFFFFF',
  });

/** La cara de la muestra viene inclinada; en una licencia y en una selfie de verdad va derecha. */
const derecha = async (p: typeof PERSONA_A) =>
  sharp(
    await sharp(muestra)
      .extract(p)
      .rotate(p === PERSONA_A ? -28 : 0, { background: '#eef2f6' })
      .toBuffer(),
  )
    .jpeg()
    .toBuffer();

async function frente() {
  const cara = await sharp(await derecha(PERSONA_A))
    .resize(280)
    .greyscale()
    .jpeg()
    .toBuffer();
  const lineas = [
    'DRIVER LICENSE',
    'DL D123 4562',
    'MUESTRA',
    'ANA MARIA',
    'DOB 01/15/1990',
    'EXP 01/15/2030',
  ];
  const texto = lineas
    .map(
      (l, i) =>
        `<text x="330" y="${80 + i * 56}" font-family="Arial, sans-serif" font-size="38" fill="#111">${l}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440"><rect width="100%" height="100%" fill="#eef2f6"/>${texto}</svg>`;
  return sharp(Buffer.from(svg))
    .composite([{ input: cara, left: 30, top: 60 }])
    .png()
    .toBuffer();
}

const selfie = (p = PERSONA_A) => derecha(p);

describe('verificación de punta a punta (C-KYC-MOTOR)', () => {
  it('licencia buena y la misma persona: solo falta la prueba de vida', async () => {
    const r = await verificar({
      docTipo: 'licencia',
      frente: await frente(),
      reverso: await reverso(),
      selfie: await selfie(),
      hoy: HOY,
    });
    expect(r.datos).toMatchObject({ numero: 'D1234562', nacimiento: '1990-01-15' });
    expect(r.motivos).toEqual(['sin_prueba_de_vida']);
    expect(r.decision).toBe('repetir');
    expect(r.huella).toHaveLength(128);
    expect(r.similitud).toBeGreaterThan(0.4);
  }, 180_000);

  it('otra persona en la selfie y una licencia vencida: hay que repetir, con los dos motivos', async () => {
    const r = await verificar({
      docTipo: 'licencia',
      frente: await frente(),
      reverso: await reverso('01152020'),
      selfie: await selfie(PERSONA_B),
      hoy: HOY,
    });
    expect(r.motivos).toEqual(expect.arrayContaining(['vencido', 'cara_distinta']));
    expect(r.decision).toBe('repetir');
  }, 180_000);

  it('la cara de una cuenta cerrada por mala conducta va a revisión del equipo', async () => {
    const primera = await verificar({
      docTipo: 'licencia',
      frente: await frente(),
      reverso: await reverso(),
      selfie: await selfie(),
      hoy: HOY,
    });
    const r = await verificar({
      docTipo: 'identificacion',
      frente: await frente(),
      selfie: await selfie(),
      hoy: HOY,
      malaConducta: [{ id: 'cuenta-cerrada', huella: primera.huella ?? [] }],
    });
    expect(r.motivos).toEqual(
      expect.arrayContaining(['documento_sin_codigo', 'cara_parecida_a_cuenta_cerrada']),
    );
    expect(r.parecidas[0]?.id).toBe('cuenta-cerrada');
  }, 180_000);
});
