import { describe, expect, it } from 'vitest';
import { edadEnAnios, edadMinimaRepartidor, estadoEeuuDeZona } from './edadRepartidor';

describe('G3: edad mínima del repartidor por estado y vehículo (estudios E2 p.3)', () => {
  it('el estado sale del código de la zona', () => {
    expect(estadoEeuuDeZona('US-FL-MIAMI')).toBe('FL');
    expect(estadoEeuuDeZona('US-MI-NOVI')).toBe('MI');
    expect(estadoEeuuDeZona('VE-CCS')).toBeNull();
    expect(estadoEeuuDeZona(null)).toBeNull();
  });
  it('18 por defecto; 19 en Florida y Texas; 21 en California', () => {
    expect(edadMinimaRepartidor({ zonaId: 'US-MI-NOVI', vehiculo: 'bicicleta' })).toBe(18);
    expect(edadMinimaRepartidor({ zonaId: 'US-FL-MIAMI', vehiculo: 'bicicleta' })).toBe(19);
    expect(edadMinimaRepartidor({ zonaId: 'US-TX-HOUSTON', vehiculo: 'a_pie' })).toBe(19);
    expect(edadMinimaRepartidor({ zonaId: 'US-CA-LA', vehiculo: 'bicicleta' })).toBe(21);
  });
  it('en moto o carro, 19 como Uber; manda la mayor de las dos reglas', () => {
    expect(edadMinimaRepartidor({ zonaId: 'US-MI-NOVI', vehiculo: 'carro' })).toBe(19);
    expect(edadMinimaRepartidor({ zonaId: 'US-CA-LA', vehiculo: 'moto' })).toBe(21);
  });
  it('fuera de EE. UU. queda la mayoría de edad de 18', () => {
    expect(edadMinimaRepartidor({ zonaId: 'VE-CCS', vehiculo: 'moto' })).toBe(18);
  });
  it('cuenta los años cumplidos, no el año de nacimiento', () => {
    const hoy = new Date('2026-11-02T12:00:00Z');
    expect(edadEnAnios('2007-11-03', hoy)).toBe(18);
    expect(edadEnAnios('2007-11-02', hoy)).toBe(19);
    expect(edadEnAnios('fecha rara', hoy)).toBeNull();
  });
});
