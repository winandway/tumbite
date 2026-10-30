import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  buscarParecidas,
  compararSelfieConDocumento,
  leerCara,
  decidirVida,
  giroDeCabeza,
  pruebaDeVida,
  type Cara,
  type Punto,
} from './caras';

/**
 * C-KYC-CARAS (29 oct 2026): la cara de la selfie contra la del documento, y la prueba de persona viva.
 * Las fotos son las de muestra que trae @vladmandic/face-api (MIT); se usan aquí, no se copian al repo.
 */
const requerir = createRequire(import.meta.url);
const muestra = join(
  dirname(requerir.resolve('@vladmandic/face-api/package.json')),
  'demo/sample1.jpg',
);
const PERSONA_A = { left: 1376, top: 120, width: 400, height: 420 };
const PERSONA_B = { left: 250, top: 200, width: 520, height: 560 };

const recorte = (c: typeof PERSONA_A) => sharp(muestra).extract(c).jpeg().toBuffer();
/** La misma cara como sale impresa en un documento: chica, en gris, más clara y con compresión. */
const comoDocumento = async (c: typeof PERSONA_A) =>
  sharp(await recorte(c))
    .resize(180)
    .greyscale()
    .modulate({ brightness: 1.15 })
    .jpeg({ quality: 45 })
    .toBuffer();

describe('cara de la selfie contra el documento (C-KYC-CARAS)', () => {
  it('la misma persona coincide aunque la foto del documento sea chica y en gris', async () => {
    const r = await compararSelfieConDocumento(
      await recorte(PERSONA_A),
      await comoDocumento(PERSONA_A),
    );
    expect(r).toMatchObject({ ok: true, coincide: true });
  }, 120_000);

  it('otra persona no coincide', async () => {
    const r = await compararSelfieConDocumento(
      await recorte(PERSONA_A),
      await comoDocumento(PERSONA_B),
    );
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true, coincide: false });
  }, 120_000);

  it('sin cara en la selfie, lo dice', async () => {
    const vacia = await sharp({
      create: { width: 400, height: 400, channels: 3, background: '#d9d4cc' },
    })
      .jpeg()
      .toBuffer();
    expect(await compararSelfieConDocumento(vacia, await comoDocumento(PERSONA_A))).toEqual({
      ok: false,
      motivo: 'sin_cara_en_selfie',
    });
  }, 120_000);
});

describe('prueba de persona viva: girar la cabeza (C-KYC-CARAS)', () => {
  it('una foto de una foto no pasa: las tres tomas dan el mismo giro', async () => {
    const f = await recorte(PERSONA_A);
    expect(await pruebaDeVida([f, f, f])).toMatchObject({ viva: false, motivo: 'sin_giro' });
  }, 120_000);

  it('si en una toma aparece otra persona, no pasa', async () => {
    const a = await recorte(PERSONA_A);
    const b = await recorte(PERSONA_B);
    expect(await pruebaDeVida([a, b, a])).toMatchObject({ viva: false, motivo: 'otra_persona' });
  }, 120_000);

  it('mide el giro: la misma cara en espejo gira hacia el otro lado', async () => {
    const a = await recorte(PERSONA_A);
    const espejo = await sharp(a).flop().toBuffer();
    const r = await pruebaDeVida([a, espejo, a]);
    expect(r.giros?.[0]).toBeLessThan(0.4);
    expect(r.giros?.[1]).toBeGreaterThan(0.6);
  }, 120_000);

  // La regla, con puntos de cara armados a mano (la nariz entre los extremos de la mandíbula).
  const cara = (nariz: number, huella = Array(128).fill(0.1) as number[]): Cara => {
    const puntos: Punto[] = Array.from({ length: 68 }, () => ({ x: 50, y: 50 }));
    puntos[0] = { x: 0, y: 50 };
    puntos[16] = { x: 100, y: 50 };
    puntos[30] = { x: nariz, y: 55 };
    return { huella, puntos, caja: { x: 0, y: 0, ancho: 100, alto: 100 }, confianza: 0.99 };
  };

  it('pasa solo con giro de verdad hacia los dos lados', () => {
    expect(giroDeCabeza(cara(50).puntos)).toBe(0.5);
    expect(decidirVida([cara(50), cara(30), cara(70)])).toEqual({
      viva: true,
      giros: [0.5, 0.3, 0.7],
    });
    expect(decidirVida([cara(50), cara(30), cara(45)])).toMatchObject({
      viva: false,
      motivo: 'sin_giro',
    });
    expect(decidirVida([cara(50), cara(30), cara(20)])).toMatchObject({
      viva: false,
      motivo: 'sin_giro',
    });
    expect(decidirVida([cara(50), null, cara(70)])).toEqual({
      viva: false,
      motivo: 'falta_una_cara',
    });
  });
});

describe('caras repetidas: lista de mala conducta (C-KYC-CARAS)', () => {
  it('encuentra a la persona cerrada aunque vuelva con otra foto, y no confunde a otra', async () => {
    const cerradaA = (await leerCara(await recorte(PERSONA_A)))!.huella;
    const cerradaB = (await leerCara(await recorte(PERSONA_B)))!.huella;
    const lista = [
      { id: 'cuenta-b', huella: cerradaB },
      { id: 'cuenta-a', huella: cerradaA },
    ];
    const vuelve = (await leerCara(await comoDocumento(PERSONA_A)))!.huella;
    const parecidas = buscarParecidas(vuelve, lista);
    expect(parecidas.map((p) => p.id)).toEqual(['cuenta-a']);
    expect(buscarParecidas(vuelve, [{ id: 'cuenta-b', huella: cerradaB }])).toEqual([]);
  }, 120_000);
});
