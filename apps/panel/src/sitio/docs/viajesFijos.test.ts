import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { CAPTURAS_VIAJES_FIJOS, GUIAS_VIAJES_FIJOS, VIAJES_FIJOS_PUBLICADA } from './viajesFijos';

/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026) — todos los países. Las tres guías públicas
 * están completas en los dos idiomas, sin nada interno, y se publican en Docs exactamente cuando sus
 * capturas reales existen (ninguna guía sin capturas; ninguna captura sin su guía publicada).
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');
const CLAVES = ['confianza', 'fijos', 'conductor'] as const;

describe('C-VIAJES-FIJOS: las guías públicas', () => {
  it('están completas en español e inglés, con los mismos pasos, capturas y preguntas', () => {
    const usadas = new Set<string>();
    for (const k of CLAVES) {
      const es = GUIAS_VIAJES_FIJOS.es[k];
      const en = GUIAS_VIAJES_FIJOS.en[k];
      expect(en.id).toBe(es.id);
      expect(en.pasos.length).toBe(es.pasos.length);
      expect(en.explicacion?.length).toBe(es.explicacion?.length);
      expect(en.capturas?.length).toBe(es.capturas?.length);
      expect(en.preguntas?.length).toBe(es.preguntas?.length);
      for (const [idioma, g] of [
        ['es', es],
        ['en', en],
      ] as const) {
        expect(g.capturas?.length).toBeGreaterThan(1);
        for (const q of g.preguntas ?? []) expect(q).toMatch(/\?$/);
        for (const c of g.capturas ?? []) {
          expect(c.src).toContain(`-${idioma}.webp`);
          usadas.add(c.src.replace(/^\/docs\/recorrido-viajes-fijos-|-(es|en)\.webp$/g, ''));
        }
        const texto = JSON.stringify(g).toLowerCase();
        for (const p of [
          'pronto',
          'coming soon',
          'tumbite',
          '/datos',
          'superadmin',
          'stripe',
          'monitoreo',
        ])
          expect(texto).not.toContain(p);
      }
    }
    expect([...usadas].sort()).toEqual([...CAPTURAS_VIAJES_FIJOS].sort());
  });

  it('se publican en Docs si y solo si sus capturas reales existen', () => {
    const existen = (['es', 'en'] as const).every((i) =>
      CLAVES.every((k) =>
        (GUIAS_VIAJES_FIJOS[i][k].capturas ?? []).every((c) => existsSync(join(PUBLICO, c.src))),
      ),
    );
    expect(VIAJES_FIJOS_PUBLICADA, 'cambia VIAJES_FIJOS_PUBLICADA al tomar las capturas').toBe(
      existen,
    );
    const en = (seccion: string, id: string) =>
      DOCS.es.find((s) => s.id === seccion)?.guias.some((g) => g.id === id) ?? false;
    expect(en('ordering', 'trusted-driver')).toBe(VIAJES_FIJOS_PUBLICADA);
    expect(en('ordering', 'regular-rides')).toBe(VIAJES_FIJOS_PUBLICADA);
    expect(en('drivers', 'regular-riders')).toBe(VIAJES_FIJOS_PUBLICADA);
  });
});
