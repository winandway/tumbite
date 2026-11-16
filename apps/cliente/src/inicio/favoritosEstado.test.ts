import { describe, expect, it } from 'vitest';
import { mezclarFavoritos } from './favoritosEstado';

describe('C-FAVORITOS-SIN-CARRERA: la lista que llega tarde no pisa el toque', () => {
  it('un favorito marcado mientras cargaba sigue marcado', () => {
    const r = mezclarFavoritos(['a'], new Map([['b', true]]));
    expect([...r].sort()).toEqual(['a', 'b']);
  });
  it('un favorito quitado mientras cargaba sigue quitado', () => {
    const r = mezclarFavoritos(['a', 'b'], new Map([['b', false]]));
    expect([...r]).toEqual(['a']);
  });
  it('sin toques, manda el servidor', () => {
    expect([...mezclarFavoritos(['x'], new Map())]).toEqual(['x']);
  });
});
