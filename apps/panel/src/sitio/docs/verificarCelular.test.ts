import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import {
  CAPTURAS_VERIFICAR_CELULAR,
  GUIA_VERIFICAR_CELULAR,
  VERIFICAR_CELULAR_PUBLICADA,
} from './verificarCelular';

/**
 * C-TELEFONO-AL-REGISTRARSE (22 nov 2026): la guía pública «Confirma tu celular» está completa en los
 * dos idiomas, sin nada interno, y se publica exactamente cuando sus capturas reales existen.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');

describe('C-TELEFONO-AL-REGISTRARSE: la guía pública', () => {
  it('está completa en español e inglés, con las mismas partes y sin nada interno', () => {
    const { es, en } = GUIA_VERIFICAR_CELULAR;
    expect(en.id).toBe(es.id);
    expect(en.pasos.length).toBe(es.pasos.length);
    expect(en.explicacion?.length).toBe(es.explicacion?.length);
    expect(en.preguntas?.length).toBe(es.preguntas?.length);
    for (const [idioma, g] of [
      ['es', es],
      ['en', en],
    ] as const) {
      expect(g.capturas?.map((c) => c.src)).toEqual(
        CAPTURAS_VERIFICAR_CELULAR.map((n) => `/docs/recorrido-celular-${n}-${idioma}.webp`),
      );
      for (const q of g.preguntas ?? []) expect(q).toMatch(/\?$/);
      const texto = JSON.stringify(g).toLowerCase();
      for (const p of [
        'pronto',
        'coming soon',
        'tumbite',
        '/datos',
        'superadmin',
        'twilio',
        'asistente virtual',
        'presupuesto',
        'budget',
      ])
        expect(texto).not.toContain(p);
    }
  });

  it('entra en Docs («Tu cuenta») solo con sus capturas reales en los dos idiomas', () => {
    const todas = CAPTURAS_VERIFICAR_CELULAR.flatMap((n) =>
      (['es', 'en'] as const).map((i) => join(PUBLICO, 'docs', `recorrido-celular-${n}-${i}.webp`)),
    );
    expect(todas.every((f) => existsSync(f))).toBe(VERIFICAR_CELULAR_PUBLICADA);
    for (const idioma of ['es', 'en'] as const) {
      const cuenta = DOCS[idioma].find((s) => s.id === 'account');
      expect(cuenta?.guias.some((g) => g.id === 'verify-your-phone')).toBe(
        VERIFICAR_CELULAR_PUBLICADA,
      );
    }
  });
});
