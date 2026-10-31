import { describe, expect, it } from 'vitest';
import { paisDelCodigoZona, textoDistancia, textoDistanciaCorta } from './distancia';

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

describe('textoDistanciaCorta (C-FLEX-DISTANCIA-PAIS)', () => {
  it('en EE. UU. dice pies de cerca y millas de lejos', () => {
    expect(textoDistanciaCorta(100, 'es', 'US')).toBe('328 ft');
    expect(textoDistanciaCorta(1591, 'es', 'US')).toBe('1.0 mi');
  });
  it('en el resto, metros y kilómetros', () => {
    expect(textoDistanciaCorta(250, 'es', 'VE')).toBe('250 m');
    expect(textoDistanciaCorta(1591, 'en', 'CO')).toBe('1.6 km');
  });
});
