import { describe, expect, it } from 'vitest';
import { compararLibres } from './operacion';

// C-REWARDS-PRIORIDAD (30 oct 2026, R4): a igual distancia, el de mejor nivel recibe primero.
describe('C-REWARDS-PRIORIDAD: prioridad de despacho por nivel', () => {
  const base = { lat: 0, lng: 0, puntos: 0 };
  const oro = { ...base, id: 'oro', km: 1.1, nivel_rep: 'oro' };
  const inicial = { ...base, id: 'inicial', km: 1.0, nivel_rep: 'inicial' };
  const lejos = { ...base, id: 'lejos', km: 4, nivel_rep: 'diamante' };
  const ordenar = (prioridad: boolean) =>
    [lejos, inicial, oro].sort((a, b) => compararLibres(a, b, prioridad)).map((d) => d.id);

  it('apagada: el orden es el de siempre (el más cerca primero)', () => {
    expect(ordenar(false)).toEqual(['inicial', 'oro', 'lejos']);
  });

  it('encendida: dentro del mismo tramo gana el mejor nivel, pero nunca salta la distancia', () => {
    expect(ordenar(true)).toEqual(['oro', 'inicial', 'lejos']);
  });

  it('el turno reservado sigue yendo antes que el nivel', () => {
    const enTurno = { ...inicial, id: 'turno', en_turno: 1 };
    expect([oro, enTurno].sort((a, b) => compararLibres(a, b, true)).map((d) => d.id)).toEqual([
      'turno',
      'oro',
    ]);
  });
});
