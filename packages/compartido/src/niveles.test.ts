import { describe, expect, it } from 'vitest';
import { nivelDe } from './niveles';

describe('niveles', () => {
  it('sube con los puntos y dice cuánto falta', () => {
    expect(nivelDe(0)).toMatchObject({ clave: 'bronce', indice: 0, siguiente: { faltan: 500 } });
    expect(nivelDe(499).clave).toBe('bronce');
    expect(nivelDe(500).clave).toBe('plata');
    expect(nivelDe(1600)).toMatchObject({ clave: 'oro', siguiente: { faltan: 2400 } });
    expect(nivelDe(9999)).toMatchObject({ clave: 'diamante', siguiente: null });
    expect(nivelDe(-5).clave).toBe('bronce');
  });
});
