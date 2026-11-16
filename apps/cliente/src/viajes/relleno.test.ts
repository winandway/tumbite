import { describe, expect, it } from 'vitest';
import { marcarRelleno, tomarRelleno } from './relleno';

/** C-MISMA-RUTA: «Cambiar algo» marca Pedir viaje como lleno desde un viaje anterior, por poco tiempo. */
describe('C-MISMA-RUTA: relleno de Pedir viaje', () => {
  it('vale para ese servicio unos segundos y se puede leer dos veces (React monta dos veces)', () => {
    marcarRelleno('carro', 1_000);
    expect(tomarRelleno('moto', 2_000)).toBe(false);
    expect(tomarRelleno('carro', 2_000)).toBe(true);
    expect(tomarRelleno('carro', 3_000)).toBe(true);
    expect(tomarRelleno('carro', 30_000)).toBe(false);
  });
});
