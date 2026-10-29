import { describe, expect, it } from 'vitest';
import { recomendarRestaurantes } from './recomendados';

// C-TE-PUEDE-GUSTAR: mismo tipo de comida, abiertos, sin repetir los ya pedidos, el más cerca primero.
describe('C-TE-PUEDE-GUSTAR', () => {
  const lista = [
    { id: 'a', categoria: 'Pizza', abiertoAhora: true, distanciaKm: 1 },
    { id: 'b', categoria: 'pizza', abiertoAhora: true, distanciaKm: 3 },
    { id: 'c', categoria: 'Pizza', abiertoAhora: true, distanciaKm: 2 },
    { id: 'd', categoria: 'Pizza', abiertoAhora: false, distanciaKm: 0.5 },
    { id: 'e', categoria: 'Sushi', abiertoAhora: true, distanciaKm: 0.2 },
  ];
  it('recomienda pizzerías abiertas que no probó, de la más cercana a la más lejana', () => {
    expect(recomendarRestaurantes(lista, new Set(['a'])).map((r) => r.id)).toEqual(['c', 'b']);
  });
  it('sin historial no recomienda nada', () => {
    expect(recomendarRestaurantes(lista, new Set())).toEqual([]);
  });
});
