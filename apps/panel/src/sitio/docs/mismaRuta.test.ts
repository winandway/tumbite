import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { CAPTURAS_MISMA_RUTA, GUIA_MISMA_RUTA, MISMA_RUTA_PUBLICADA } from './mismaRuta';

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. La guía «Pide la misma ruta otra vez» está completa
 * en los dos idiomas, sin nada interno, y se publica en Docs exactamente cuando sus capturas reales
 * existen (ninguna guía sin capturas; ninguna captura tomada sin su guía publicada).
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');

describe('C-MISMA-RUTA: la guía pública', () => {
  it('está completa en español e inglés, con los mismos pasos, capturas y preguntas', () => {
    const { es, en } = GUIA_MISMA_RUTA;
    expect(en.id).toBe(es.id);
    expect(en.pasos.length).toBe(es.pasos.length);
    expect(en.explicacion?.length).toBe(es.explicacion?.length);
    expect(en.capturas?.length).toBe(CAPTURAS_MISMA_RUTA.length);
    expect(es.capturas?.length).toBe(CAPTURAS_MISMA_RUTA.length);
    for (const [idioma, g] of [
      ['es', es],
      ['en', en],
    ] as const) {
      for (const q of g.preguntas ?? []) expect(q).toMatch(/\?$/);
      for (const c of g.capturas ?? []) expect(c.src).toContain(`-${idioma}.webp`);
      const texto = JSON.stringify(g).toLowerCase();
      for (const p of ['pronto', 'coming soon', 'tumbite', '/datos', 'superadmin', 'stripe'])
        expect(texto).not.toContain(p);
    }
  });

  it('se publica en Docs si y solo si sus capturas reales existen', () => {
    const existen = (['es', 'en'] as const).every((i) =>
      (GUIA_MISMA_RUTA[i].capturas ?? []).every((c) => existsSync(join(PUBLICO, c.src))),
    );
    expect(MISMA_RUTA_PUBLICADA, 'cambia MISMA_RUTA_PUBLICADA al tomar las capturas').toBe(existen);
    const publicada = DOCS.es
      .find((s) => s.id === 'ordering')
      ?.guias.some((g) => g.id === GUIA_MISMA_RUTA.es.id);
    expect(publicada).toBe(MISMA_RUTA_PUBLICADA);
  });
});
