import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { GUIA_AVISOS_VIAJE } from './avisosViaje';

/**
 * C-AVISOS-VIAJE (24 nov 2026) — todos los países. La guía «Qué avisos recibes en tu viaje» está
 * completa en los dos idiomas, con su captura real, sin nada interno ni ciudades, y publicada en Docs.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');

describe('C-AVISOS-VIAJE: la guía pública de los avisos del viaje', () => {
  it('está completa en español e inglés, con captura real y sin lugares ni montos', () => {
    const { es, en } = GUIA_AVISOS_VIAJE;
    expect(en.id).toBe(es.id);
    expect(en.pasos.length).toBe(es.pasos.length);
    expect(en.explicacion?.length).toBe(es.explicacion?.length);
    for (const [idioma, g] of [
      ['es', es],
      ['en', en],
    ] as const) {
      expect(g.capturas?.length).toBeGreaterThanOrEqual(1);
      for (const c of g.capturas ?? []) {
        expect(c.src).toContain(`-${idioma}.webp`);
        expect(existsSync(join(PUBLICO, c.src)), c.src).toBe(true);
      }
      for (const q of g.preguntas ?? []) expect(q).toMatch(/\?$/);
      const texto = JSON.stringify(g);
      for (const p of ['pronto', 'coming soon', 'tumbite', '/datos', 'superadmin', 'stripe'])
        expect(texto.toLowerCase()).not.toContain(p);
      expect(texto).not.toMatch(/\b(Miami|Novi|Vigía|Caracas|Ica|Michigan|Florida)\b/);
      expect(texto).not.toMatch(/[$€]\s?\d|Bs\.?\s?\d/);
    }
  });

  it('está publicada en «Para pedir» en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const)
      expect(
        DOCS[idioma]
          .find((s) => s.id === 'ordering')
          ?.guias.some((g) => g.id === 'ride-notifications'),
      ).toBe(true);
  });
});
