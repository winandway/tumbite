import { describe, expect, it } from 'vitest';
import { sinPlusCode } from './puntoExacto';

// C-SIN-PLUS-CODE (18 nov 2026, robot de Android): «Populares cerca de ti» mostraba «J86Q+CHP,
// Avenida Don Pepe Rojas» debajo de Junior Mall. Un plus code no es una dirección para una persona.
describe('sin plus codes en las direcciones que se muestran', () => {
  it('quita el plus code del principio y deja el resto', () => {
    expect(sinPlusCode('J86Q+CHP, Avenida Don Pepe Rojas (Carretera Panamericana)')).toBe(
      'Avenida Don Pepe Rojas (Carretera Panamericana)',
    );
    expect(sinPlusCode('J9JJ+FWM, La Blanca')).toBe('La Blanca');
  });
  it('quita un plus code en medio', () => {
    expect(sinPlusCode('El Vigía, CQPG+7F2, Mérida')).toBe('El Vigía, Mérida');
  });
  it('no toca una dirección normal', () => {
    expect(sinPlusCode('5145 Av. Don Pepe Rojas, El Vigía')).toBe(
      '5145 Av. Don Pepe Rojas, El Vigía',
    );
    expect(sinPlusCode('')).toBe('');
  });
});
