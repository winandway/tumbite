import { describe, expect, it } from 'vitest';
import { IDIOMAS, esIdioma, t } from './idiomas';

describe('idiomas', () => {
  it('el español lleva la bandera de España y el inglés la de EE.UU.', () => {
    expect(IDIOMAS.find((i) => i.codigo === 'es')?.bandera).toBe('🇪🇸');
    expect(IDIOMAS.find((i) => i.codigo === 'en')?.bandera).toBe('🇺🇸');
    // Candado: ninguna bandera de un país de América para el idioma español.
    expect(IDIOMAS.map((i) => i.bandera)).not.toContain('🇲🇽');
  });

  it('traduce en los dos idiomas', () => {
    expect(t('es', 'empezar')).toBe('Empezar');
    expect(t('en', 'empezar')).toBe('Get started');
  });

  it('reconoce solo idiomas soportados', () => {
    expect(esIdioma('es')).toBe(true);
    expect(esIdioma('fr')).toBe(false);
    expect(esIdioma(undefined)).toBe(false);
  });
});
