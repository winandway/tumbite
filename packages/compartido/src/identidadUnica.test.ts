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

describe('correos de prueba del equipo (C-CORREO-EQUIPO)', () => {
  // 4 nov 2026, Richard grabando el video para Apple: go+cliente3…10@windoce.com chocaban todos con
  // go+cliente1@windoce.com. En el dominio propio, cada «+algo» es una cuenta de prueba distinta.
  it('en windoce.com el «+algo» no se quita; en los demás dominios sí', () => {
    expect(correoCanonico('go+cliente10@windoce.com')).toBe('go+cliente10@windoce.com');
    expect(correoCanonico('Go+Cliente1@Windoce.com')).toBe('go+cliente1@windoce.com');
    expect(correoCanonico('juan.perez+2@gmail.com')).toBe('juanperez@gmail.com');
    expect(correoCanonico('ana+uno@empresa.com')).toBe('ana@empresa.com');
  });
});
