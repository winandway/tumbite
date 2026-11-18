import { describe, expect, it } from 'vitest';
import { categoriaRestaurante } from './categoriaRestaurante';

// C-CATEGORIA-EN-INGLES (robot de Android, 18 nov 2026): en inglés salían «Mexicana» y «Hamburguesas».
describe('la categoría del restaurante en el idioma de la persona', () => {
  it('en inglés traduce las que se usan hoy (con o sin acentos y mayúsculas)', () => {
    expect(categoriaRestaurante('Mexicana', 'en')).toBe('Mexican');
    expect(categoriaRestaurante('Hamburguesas', 'en')).toBe('Burgers');
    expect(categoriaRestaurante('Cubana', 'en')).toBe('Cuban');
    expect(categoriaRestaurante('Venezolana', 'en')).toBe('Venezuelan');
    expect(categoriaRestaurante('Tipica Colombiana', 'en')).toBe('Colombian');
    expect(categoriaRestaurante('Café y desayunos', 'en')).toBe('Coffee & breakfast');
    expect(categoriaRestaurante('supermercado', 'en')).toBe('Grocery');
    expect(categoriaRestaurante('Pizza', 'en')).toBe('Pizza');
  });
  it('en español deja la que escribió el restaurante; una desconocida no se toca', () => {
    expect(categoriaRestaurante('Mexicana', 'es')).toBe('Mexicana');
    expect(categoriaRestaurante('Fusión nikkei de autor', 'en')).toBe('Fusión nikkei de autor');
    expect(categoriaRestaurante('', 'en')).toBe('');
  });
});
