import { describe, expect, it } from 'vitest';
import { faltaPapel } from './papelesVehiculo';

const hoy = new Date('2026-11-02T12:00:00Z');
const completos = {
  vehiculoTipo: 'carro',
  licenciaNumero: 'D123',
  licenciaVence: '2030-01-01',
  seguroPoliza: 'P-9',
  seguroVence: '2027-01-01',
};

describe('G4b: licencia y seguro al repartir en carro o moto (como DoorDash)', () => {
  it('con todo vigente no falta nada', () => {
    expect(faltaPapel(completos, hoy)).toBeNull();
  });
  it('a pie o en bici no se pide nada', () => {
    expect(faltaPapel({ vehiculoTipo: 'bicicleta' }, hoy)).toBeNull();
    expect(faltaPapel({ vehiculoTipo: '' }, hoy)).toBeNull();
  });
  it('sin licencia o sin su vencimiento, falta la licencia', () => {
    expect(faltaPapel({ ...completos, licenciaNumero: '' }, hoy)).toBe('licencia');
    expect(faltaPapel({ ...completos, licenciaVence: null }, hoy)).toBe('licencia');
  });
  it('una licencia vencida no sirve', () => {
    expect(faltaPapel({ ...completos, licenciaVence: '2026-11-01' }, hoy)).toBe('licencia_vencida');
  });
  it('en moto también se pide el seguro, y vencido no sirve', () => {
    expect(faltaPapel({ ...completos, vehiculoTipo: 'moto', seguroPoliza: '' }, hoy)).toBe(
      'seguro',
    );
    expect(faltaPapel({ ...completos, seguroVence: '2026-10-31' }, hoy)).toBe('seguro_vencido');
  });
});
