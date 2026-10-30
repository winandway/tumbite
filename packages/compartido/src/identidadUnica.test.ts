import { describe, expect, it } from 'vitest';
import { correoCanonico, telefonoCanonico } from './identidadUnica';

describe('identidad única (C-IDENTIDAD-UNICA)', () => {
  it('el mismo correo escrito de otra forma es el mismo', () => {
    expect(correoCanonico(' Juan.Perez+2@Gmail.com ')).toBe('juanperez@gmail.com');
    expect(correoCanonico('juan.perez@googlemail.com')).toBe('juanperez@gmail.com');
    // Fuera de Gmail los puntos sí cuentan; «+algo» no.
    expect(correoCanonico('ana.lopez+divoox@empresa.com')).toBe('ana.lopez@empresa.com');
  });

  it('el mismo teléfono en otro formato es el mismo', () => {
    expect(telefonoCanonico('(305) 555-0100')).toBe('13055550100');
    expect(telefonoCanonico('+1 305 555 0100')).toBe('13055550100');
    expect(telefonoCanonico('+58 412-555-0100')).toBe('584125550100');
    expect(telefonoCanonico('123')).toBeNull();
    expect(telefonoCanonico(undefined)).toBeNull();
  });
});
