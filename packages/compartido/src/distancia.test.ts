import { afterEach, describe, expect, it } from 'vitest';
import {
  elegirUnidadDistancia,
  paisDelCodigoZona,
  textoDistancia,
  textoDistanciaCorta,
} from './distancia';

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

describe('C-UNIDAD-ELEGIDA: el repartidor elige millas o kilómetros', () => {
  afterEach(() => elegirUnidadDistancia(null));
  it('lo que elige manda sobre el país, y sin elección vuelve al país', () => {
    elegirUnidadDistancia('km');
    expect(textoDistancia(10, 'en', 'US')).toBe('10.0 km');
    expect(textoDistanciaCorta(250, 'es', 'US')).toBe('250 m');
    elegirUnidadDistancia('mi');
    expect(textoDistancia(10, 'es', 'VE')).toBe('6.2 mi');
    elegirUnidadDistancia(null);
    expect(textoDistancia(10, 'es', 'VE')).toBe('10.0 km');
  });
});

describe('C-UNIDAD-ELEGIDA en la app Driver', () => {
  it('el perfil tiene el interruptor y la app lo carga al abrir', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');
    const inicio = leer('apps', 'repartidor', 'src', 'Inicio.tsx');
    expect(inicio).toContain('<UnidadDistancia');
    expect(inicio).toContain('useUnidadDistancia()');
    const pieza = leer('apps', 'repartidor', 'src', 'piezas', 'UnidadDistancia.tsx');
    expect(pieza).toContain('elegirUnidadDistancia(u)');
  });
});
