import { describe, expect, it } from 'vitest';
import { paisDelCodigoZona, textoDistancia } from './distancia';

describe('distancia por país (C-DISTANCIA-POR-PAIS)', () => {
  it('en EE. UU. va en millas también en español', () => {
    expect(textoDistancia(6.4, 'es', 'US')).toBe('4.0 mi');
    expect(textoDistancia(6.4, 'en', 'US')).toBe('4.0 mi');
  });
  it('fuera de EE. UU. va en kilómetros también en inglés', () => {
    expect(textoDistancia(6.4, 'en', 'VE')).toBe('6.4 km');
    expect(textoDistancia(6.4, 'es', 'CO')).toBe('6.4 km');
  });
  it('sin país, lo de antes (por idioma)', () => {
    expect(textoDistancia(6.4, 'es')).toBe('6.4 km');
    expect(textoDistancia(6.4, 'en', null)).toBe('4.0 mi');
  });
  it('el país sale de la zona', () => {
    expect(paisDelCodigoZona('US-MI-NOVI')).toBe('US');
    expect(paisDelCodigoZona('VE-DC-CARACAS')).toBe('VE');
    expect(paisDelCodigoZona(null)).toBeNull();
  });
});
