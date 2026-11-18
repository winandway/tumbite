import { describe, expect, it } from 'vitest';
import { pasosDeTexto } from './pasosSubida';

// C-SUBIR-TARIFA: la casilla del superadmin pasa los montos a la unidad menor, en enteros.
describe('pasosDeTexto', () => {
  it('«0.25, 0.50, 1.00» son 25, 50 y 100 centavos', () => {
    expect(pasosDeTexto('0.25, 0.50, 1.00')).toEqual([25, 50, 100]);
    expect(pasosDeTexto('$1, $2, $3')).toEqual([100, 200, 300]);
  });
  it('vacío, ceros, más de tres o texto: no sirve', () => {
    expect(pasosDeTexto('')).toBeNull();
    expect(pasosDeTexto('0')).toBeNull();
    expect(pasosDeTexto('1,2,3,4')).toBeNull();
    expect(pasosDeTexto('abc')).toBeNull();
  });
});
