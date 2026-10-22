import { describe, expect, it } from 'vitest';
import { COMPETENCIA, compararConOtras, planesEquivalentes } from './competencia';

describe('comparación con otras apps (lo que le queda al restaurante)', () => {
  it('con 1.000 dólares de ventas en el plan Inicial: 925 con Divoox, 850 con DoorDash, 800 con Uber Eats', () => {
    expect(compararConOtras(100000, 0, 'inicial')).toEqual({
      ventas: 100000,
      tumbite: 92500,
      doordash: 85000,
      ubereats: 80000,
    });
  });
  it('plan con plan: Crece contra Plus, Élite contra Premier y Premium', () => {
    expect(compararConOtras(3000, 0, 'crece')).toMatchObject({
      tumbite: 2625,
      doordash: 2250,
      ubereats: 2250,
    });
    expect(compararConOtras(3000, 0, 'elite')).toMatchObject({
      tumbite: 2550,
      doordash: 2100,
      ubereats: 2100,
    });
  });
  it('los regalos que da el restaurante salen antes de la comisión, igual para todos', () => {
    expect(compararConOtras(10000, 1000, 'inicial')).toMatchObject({
      tumbite: 8325,
      doordash: 7650,
    });
  });
  it('los porcentajes son los publicados el 13 oct 2026', () => {
    expect(COMPETENCIA.doordash.pb).toEqual({ inicial: 1500, crece: 2500, elite: 3000 });
    expect(COMPETENCIA.ubereats.pb).toEqual({ inicial: 2000, crece: 2500, elite: 3000 });
  });
  it('cada plan se compara con su equivalente', () => {
    expect(planesEquivalentes('inicial')).toEqual({ doordash: 'Basic', ubereats: 'Lite' });
    expect(planesEquivalentes('elite')).toEqual({ doordash: 'Premier', ubereats: 'Premium' });
  });
});
