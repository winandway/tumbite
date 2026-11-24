import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { CAPTURAS_CUENTA_UNICA, CUENTA_UNICA_PUBLICADA, GUIAS_CUENTA_UNICA } from './cuentaUnica';

/**
 * C-CUENTA-UNICA (24 nov 2026): las guías públicas «Una cuenta para todo» y «Tener uno o varios
 * restaurantes con tu cuenta» están completas en los dos idiomas, dicen «conductor», no cuentan nada
 * interno (unir cuentas es del equipo) y entran en Docs solo con sus capturas reales.
 */
const PUBLICO = join(__dirname, '..', '..', '..', 'public');

describe('C-CUENTA-UNICA: las guías públicas', () => {
  it('completas en español e inglés, con «conductor» y sin nada interno', () => {
    for (const clave of ['cuenta', 'restaurantes'] as const) {
      const es = GUIAS_CUENTA_UNICA.es[clave];
      const en = GUIAS_CUENTA_UNICA.en[clave];
      expect(en.id).toBe(es.id);
      expect(en.pasos.length).toBe(es.pasos.length);
      expect(en.explicacion?.length).toBe(es.explicacion?.length);
      expect(en.preguntas?.length).toBe(es.preguntas?.length);
      for (const [i, g] of [
        ['es', es],
        ['en', en],
      ] as const) {
        expect(g.capturas?.map((c) => c.src)).toEqual(
          CAPTURAS_CUENTA_UNICA[clave].map((n) => `/docs/recorrido-cuenta-unica-${n}-${i}.webp`),
        );
        const texto = JSON.stringify(g).toLowerCase();
        for (const p of [
          'tumbite',
          '/datos',
          'superadmin',
          'repartidor_id',
          'pronto',
          'coming soon',
        ])
          expect(texto).not.toContain(p);
      }
      expect(JSON.stringify(GUIAS_CUENTA_UNICA.es.cuenta)).toContain('conductor');
    }
  });

  it('entran en Docs solo con sus capturas reales en los dos idiomas', () => {
    const todas = [...CAPTURAS_CUENTA_UNICA.cuenta, ...CAPTURAS_CUENTA_UNICA.restaurantes].flatMap(
      (n) =>
        (['es', 'en'] as const).map((i) =>
          join(PUBLICO, 'docs', `recorrido-cuenta-unica-${n}-${i}.webp`),
        ),
    );
    expect(todas.every((f) => existsSync(f))).toBe(CUENTA_UNICA_PUBLICADA);
    for (const idioma of ['es', 'en'] as const) {
      const ids = DOCS[idioma].flatMap((s) => s.guias.map((g) => `${s.id}/${g.id}`));
      expect(ids.includes('account/one-account-for-everything')).toBe(CUENTA_UNICA_PUBLICADA);
      expect(ids.includes('restaurants/own-restaurants-with-your-account')).toBe(
        CUENTA_UNICA_PUBLICADA,
      );
    }
  });
});
