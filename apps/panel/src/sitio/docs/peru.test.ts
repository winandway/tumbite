import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { CAPTURAS_PERU, GUIAS_PERU, PERU_PUBLICADA } from './peru';

/**
 * C-PERFIL-PERU y C-PAGO-A-CELULAR (19 nov 2026) — Perú. Las guías públicas de Perú están completas en
 * los dos idiomas, sin nada interno, y se publican exactamente cuando sus capturas reales existen.
 * C-CAPTURAS-POR-IDIOMA: las capturas con soles, Yape y Plin van SOLO en español; el inglés enseña
 * pantallas de Estados Unidos. C-DOCS-SIN-DATOS-REALES: ninguna captura se describe con una ciudad.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');
const PUBLICO = join(__dirname, '..', '..', '..', 'public');
const CLAVES = ['pagar', 'cobrar', 'recargar', 'papeles'] as const;

describe('C-PERFIL-PERU: las guías públicas de Perú', () => {
  it('están completas en español e inglés, con los mismos pasos y preguntas y sin nada interno', () => {
    const usadas = new Set<string>();
    for (const k of CLAVES) {
      const es = GUIAS_PERU.es[k];
      const en = GUIAS_PERU.en[k];
      expect(en.id).toBe(es.id);
      expect(en.pasos.length).toBe(es.pasos.length);
      expect(en.explicacion?.length).toBe(es.explicacion?.length);
      expect(en.preguntas?.length).toBe(es.preguntas?.length);
      for (const [idioma, g] of [
        ['es', es],
        ['en', en],
      ] as const) {
        expect(g.capturas?.length).toBeGreaterThan(1);
        for (const q of g.preguntas ?? []) expect(q).toMatch(/\?$/);
        for (const c of g.capturas ?? []) expect(c.src).toContain(`-${idioma}.webp`);
        const texto = JSON.stringify(g).toLowerCase();
        for (const p of [
          'pronto',
          'coming soon',
          'tumbite',
          '/datos',
          'superadmin',
          'stripe',
          'checkout',
          ' ica',
          'huacachina',
        ])
          expect(texto, `${idioma} ${g.id}: ${p}`).not.toContain(p);
      }
      for (const c of es.capturas ?? [])
        usadas.add(c.src.replace(/^\/docs\/recorrido-peru-|-es\.webp$/g, ''));
      // El inglés no enseña en la foto lo que solo existe en Perú: sus capturas son de Estados Unidos.
      for (const c of en.capturas ?? []) {
        expect(c.src).not.toContain('peru');
        expect(`${c.alt} ${c.pie}`.toLowerCase()).not.toMatch(/yape|plin|soles/);
      }
    }
    expect([...usadas].sort()).toEqual([...CAPTURAS_PERU].sort());
  });

  it('se publican en Docs si y solo si sus capturas reales existen', () => {
    const existen = (['es', 'en'] as const).every((i) =>
      CLAVES.every((k) =>
        (GUIAS_PERU[i][k].capturas ?? []).every((c) => existsSync(join(PUBLICO, c.src))),
      ),
    );
    expect(PERU_PUBLICADA, 'cambia PERU_PUBLICADA al tomar las capturas').toBe(existen);
    for (const idioma of ['es', 'en'] as const) {
      const en = (seccion: string, id: string) =>
        DOCS[idioma].find((s) => s.id === seccion)?.guias.some((g) => g.id === id) ?? false;
      expect(en('ordering', 'pay-with-yape-or-plin')).toBe(PERU_PUBLICADA);
      expect(en('drivers', 'get-paid-with-yape-or-plin')).toBe(PERU_PUBLICADA);
      expect(en('drivers', 'top-up-balance-with-card')).toBe(PERU_PUBLICADA);
      expect(en('drivers', 'driver-documents-peru')).toBe(PERU_PUBLICADA);
    }
  });

  it('el guion de las capturas las toma solo en español, con el mapa sin rótulos y sin nombrar la ciudad', () => {
    const guion = readFileSync(join(RAIZ, 'scripts', 'recorrido', 'capturas-peru.mjs'), 'utf8');
    expect(guion).toContain('mapaSinRotulos(await chromium.launch())');
    expect(guion).toContain("ciudadNeutra(sql, ZONA, 'es')");
    expect(guion).toContain("localStorage.setItem('tumbite.idioma', 'es')");
    expect(guion).not.toMatch(/tumbite\.idioma', 'en'/);
    const direcciones = [...guion.matchAll(/direccion: '([^']+)'/g)].map((m) => m[1] ?? '');
    expect(direcciones).toEqual(['Plaza Central', 'Avenida Principal 12']);
  });
});
