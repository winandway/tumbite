import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { CAPTURAS_ESPERA, GUIA_ESPERA } from './esperaViaje';

/**
 * C-ESPERA-VEHICULO (16 nov 2026) — todos los países. La guía «Mientras buscamos a tu conductor» está
 * completa en los dos idiomas, sin nada interno, con sus cuatro capturas reales, y publicada en Docs.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');

describe('C-ESPERA-VEHICULO: la guía pública de la espera', () => {
  it('está completa en español e inglés, con una captura real por vehículo', () => {
    const { es, en } = GUIA_ESPERA;
    expect(en.id).toBe(es.id);
    expect(en.pasos.length).toBe(es.pasos.length);
    for (const [idioma, g] of [
      ['es', es],
      ['en', en],
    ] as const) {
      expect(g.capturas?.length).toBe(CAPTURAS_ESPERA.length);
      for (const c of g.capturas ?? []) {
        expect(c.src).toContain(`-${idioma}.webp`);
        expect(existsSync(join(PUBLICO, c.src)), c.src).toBe(true);
      }
      for (const q of g.preguntas ?? []) expect(q).toMatch(/\?$/);
      const texto = JSON.stringify(g).toLowerCase();
      for (const p of ['pronto', 'coming soon', 'tumbite', '/datos', 'superadmin', 'stripe'])
        expect(texto).not.toContain(p);
    }
  });

  it('está publicada en «Para pedir» en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const)
      expect(
        DOCS[idioma]
          .find((s) => s.id === 'ordering')
          ?.guias.some((g) => g.id === 'ride-waiting-screen'),
      ).toBe(true);
  });
});
