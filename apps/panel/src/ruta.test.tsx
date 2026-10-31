import { describe, expect, it } from 'vitest';
import { sinBarraFinal } from './ruta';

describe('dirección sin barra final (C-RUTA-SIN-BARRA)', () => {
  it('«/panel/» es la misma página que «/panel»', () => {
    expect(sinBarraFinal('/panel/')).toBe('/panel');
    expect(sinBarraFinal('/panel/orders/')).toBe('/panel/orders');
    expect(sinBarraFinal('/panel//')).toBe('/panel');
  });
  it('la portada sigue siendo «/»', () => {
    expect(sinBarraFinal('/')).toBe('/');
    expect(sinBarraFinal('/docs')).toBe('/docs');
  });
});
