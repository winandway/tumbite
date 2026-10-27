import { describe, expect, it } from 'vitest';
import { IDIOMAS, esIdioma, pareceCorreo, t } from './idiomas';

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

describe('pareceCorreo (27 oct 2026: la casilla de correo aceptaba un teléfono)', () => {
  it('acepta correos y rechaza teléfonos, nombres y correos a medias', () => {
    expect(pareceCorreo('revisor.cliente@windoce.com')).toBe(true);
    expect(pareceCorreo('  ana@ejemplo.co  ')).toBe(true);
    for (const malo of [
      '14034151645',
      '+1 403 415 1645',
      'ana',
      'ana@',
      'ana@windoce',
      '@windoce.com',
      '',
    ])
      expect(pareceCorreo(malo)).toBe(false);
  });
});
