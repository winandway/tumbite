import { describe, expect, it } from 'vitest';
import { conIdioma, enIngles, sinIdioma } from './rutaIdioma';

/** Candado C-INGLES-SEO: la versión en inglés de cada página pública vive bajo /en. */
describe('direcciones por idioma', () => {
  it('pasa de un idioma al otro sin tocar el panel ni las apps', () => {
    expect(conIdioma('/pais/brasil', 'en')).toBe('/en/pais/brasil');
    expect(conIdioma('/', 'en')).toBe('/en');
    expect(conIdioma('/en/pais/brasil', 'es')).toBe('/pais/brasil');
    expect(conIdioma('/en', 'es')).toBe('/');
    expect(conIdioma('/panel/pedidos', 'en')).toBe('/panel/pedidos');
    expect(conIdioma('/app/', 'en')).toBe('/app/');
    expect(conIdioma('/repartidor/', 'en')).toBe('/repartidor/');
    expect(conIdioma('/en/docs', 'en')).toBe('/en/docs');
    expect(enIngles('/enlaces')).toBe(false);
    expect(sinIdioma('/en/como-funciona')).toBe('/como-funciona');
  });
});
