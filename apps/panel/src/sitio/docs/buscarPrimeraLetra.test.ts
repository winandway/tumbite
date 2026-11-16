import { describe, expect, it } from 'vitest';
import { DOCS } from './guias';
import { buscarGuias } from './buscar';

/**
 * Regla global «TODO BUSCADOR ES SERIO» (Richard, 15 nov 2026): con una o dos letras el buscador de Docs
 * ya sugiere guías, en los dos idiomas, y las equivalencias entre idiomas siguen funcionando.
 */
describe('buscador de Docs: sugiere desde la primera letra', () => {
  for (const idioma of ['es', 'en'] as const)
    for (const q of ['b', 'p', 'wa'])
      it(`«${q}» en ${idioma} ya trae sugerencias`, () => {
        expect(buscarGuias(DOCS[idioma], q).length).toBeGreaterThan(0);
      });
  it('una palabra en inglés encuentra la guía en español (wallet ↔ billetera)', () => {
    expect(buscarGuias(DOCS.es, 'wallet').length).toBeGreaterThan(0);
  });
  it('una búsqueda vacía no sugiere nada', () => {
    expect(buscarGuias(DOCS.es, '   ')).toEqual([]);
  });
});
