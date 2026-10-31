import { describe, expect, it } from 'vitest';
import { cumpleFiltro } from './flexParadas';

describe('C-FLEX-FILTROS: filtros del mapa de la ruta', () => {
  const p = (direccion: string, ventanaHasta: string | null = null) => ({
    direccion,
    ventanaHasta,
  });
  it('reconoce apartamentos en inglés y en español', () => {
    for (const d of [
      '100 Main St Apt 4',
      '200 Ocean Dr #12',
      'Calle 5, apto 301',
      '1 Bay Rd Unit B',
    ])
      expect(cumpleFiltro(p(d), 'apartamentos'), d).toBe(true);
    for (const d of ['100 Main St', '12 Aptos Way'])
      expect(cumpleFiltro(p(d), 'apartamentos'), d).toBe(false);
  });
  it('prioridad es tener hora límite', () => {
    expect(cumpleFiltro(p('x', '2026-10-30 18:00:00'), 'prioridad')).toBe(true);
    expect(cumpleFiltro(p('x'), 'prioridad')).toBe(false);
  });
});
