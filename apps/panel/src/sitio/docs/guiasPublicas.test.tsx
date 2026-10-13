import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';

/**
 * Candado C-DOCS-PUBLICOS (regla de Richard, 12 oct 2026): todo lo nuevo se explica al público en
 * Docs, en español e inglés, sin nada técnico ni privado, y con capturas que existen de verdad.
 */
// Las imágenes que de verdad están en la carpeta pública (solo los nombres; no se cargan).
const ARCHIVOS = new Set(
  Object.keys(import.meta.glob('../../../public/docs/*.webp')).map((r) =>
    r.replace('../../../public', ''),
  ),
);
const PROHIBIDO = [
  /superadmin/i,
  /control-[0-9a-f]/i,
  /\/datos\//,
  /\bSQL\b/,
  /endpoint/i,
  /webhook/i,
  /ADMIN_/,
];

describe('Docs públicos', () => {
  it('cada sección y cada guía existe en los dos idiomas, con las mismas direcciones', () => {
    const ids = (i: 'es' | 'en') =>
      DOCS[i].map((s) => `${s.id}:${s.guias.map((g) => g.id).join(',')}`);
    expect(ids('en')).toEqual(ids('es'));
  });

  it('las guías nuevas del Manager, el semáforo, cancelar y verificarse están publicadas', () => {
    const todas = DOCS.es.flatMap((s) => s.guias.map((g) => `${s.id}/${g.id}`));
    for (const g of [
      'trust/manager',
      'trust/traffic-light',
      'trust/verification',
      'ordering/cancel-order',
      'restaurants/verify',
      'drivers/verify',
      'restaurants/dashboard',
      'ordering/my-account',
      'business/franchises',
      'drivers/wallet',
      'account/support',
      'trust/order-journey',
      'business/team-training',
      'account/create-account',
    ])
      expect(todas).toContain(g);
  });

  it('nada técnico ni privado, y cada captura tiene su texto y su archivo', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const s of DOCS[idioma])
        for (const g of s.guias) {
          const texto = JSON.stringify(g);
          for (const p of PROHIBIDO) expect(texto, `${idioma} ${s.id}/${g.id}`).not.toMatch(p);
          for (const c of g.capturas ?? []) {
            expect(c.alt.length).toBeGreaterThan(30);
            expect(c.pie.length).toBeGreaterThan(10);
            expect(ARCHIVOS.has(c.src), c.src).toBe(true);
            expect(c.src).toContain(`-${idioma}.`);
          }
        }
  });

  it('cada guía dice qué preguntas responde («¿Cómo hago…?»), en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const s of DOCS[idioma])
        for (const g of s.guias) {
          expect(g.preguntas?.length ?? 0, `${idioma} ${s.id}/${g.id}`).toBeGreaterThan(0);
          for (const q of g.preguntas ?? []) expect(q, `${idioma} ${g.id}`).toMatch(/\?$/);
        }
  });

  it('las capturas del recorrido completo están en sus guías', () => {
    const srcs = (i: 'es' | 'en') =>
      DOCS[i].flatMap((s) => s.guias.flatMap((g) => (g.capturas ?? []).map((c) => c.src)));
    for (const i of ['es', 'en'] as const) {
      const lista = srcs(i);
      for (const n of [
        'cliente-carrito',
        'restaurante-pedido-nuevo',
        'repartidor-oferta',
        'cliente-registro',
      ])
        expect(lista).toContain(`/docs/recorrido-${n}-${i}.webp`);
    }
  });
});
