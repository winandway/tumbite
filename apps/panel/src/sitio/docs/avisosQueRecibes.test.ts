import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { GUIAS_AVISOS_QUE_RECIBES } from './avisosQueRecibes';

/**
 * C-AVISOS-COMIDA, C-SALDO-BAJO y C-PANICO-INSISTE (24 nov 2026) — todos los países. Las guías «Qué
 * avisos recibes» del cliente, del conductor y del restaurante están completas en los dos idiomas, con
 * capturas reales, sin nada interno ni ciudades ni montos, y publicadas en su sección de Docs.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');
const DONDE = { cliente: 'ordering', conductor: 'drivers', restaurante: 'restaurants' } as const;

describe('Docs: «Qué avisos recibes» por actor', () => {
  for (const actor of ['cliente', 'conductor', 'restaurante'] as const)
    it(`${actor}: completa en español e inglés, con capturas reales y publicada`, () => {
      const es = GUIAS_AVISOS_QUE_RECIBES.es[actor];
      const en = GUIAS_AVISOS_QUE_RECIBES.en[actor];
      expect(en.id).toBe(es.id);
      expect(en.pasos.length).toBe(es.pasos.length);
      expect(en.explicacion?.length).toBe(es.explicacion?.length);
      expect(en.capturas?.length).toBe(es.capturas?.length);
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
        expect(JSON.stringify({ ...g, capturas: [] })).not.toMatch(/repartidor/i);
        expect(
          DOCS[idioma].find((s) => s.id === DONDE[actor])?.guias.some((x) => x.id === g.id),
        ).toBe(true);
      }
    });
});
