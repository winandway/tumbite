import { describe, expect, it } from 'vitest';
import { conIdioma, enEspanol, sinIdioma } from './rutaIdioma';

/** Candado C-INGLES-PRINCIPAL: el inglés va sin prefijo y el español bajo /es. */
describe('direcciones por idioma', () => {
  it('pasa de un idioma al otro sin tocar el panel ni las apps', () => {
    expect(conIdioma('/country/brazil', 'es')).toBe('/es/country/brazil');
    expect(conIdioma('/', 'es')).toBe('/es');
    expect(conIdioma('/es/country/brazil', 'en')).toBe('/country/brazil');
    expect(conIdioma('/es', 'en')).toBe('/');
    expect(conIdioma('/panel/orders', 'es')).toBe('/panel/orders');
    expect(conIdioma('/app/', 'es')).toBe('/app/');
    expect(conIdioma('/repartidor/', 'es')).toBe('/repartidor/');
    expect(conIdioma('/es/docs', 'es')).toBe('/es/docs');
    expect(enEspanol('/estados')).toBe(false);
    expect(sinIdioma('/es/how-it-works')).toBe('/how-it-works');
  });
});
