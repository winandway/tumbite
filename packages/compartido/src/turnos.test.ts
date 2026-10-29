import { describe, expect, it } from 'vitest';
import { validarTurno } from './turnos';

// C-TURNOS-REPARTIDOR: franjas de 30 min, de 1 a 12 horas, hasta 7 días.
describe('C-TURNOS-REPARTIDOR', () => {
  const AHORA = new Date('2026-10-29T18:10:00Z');
  const d = (s: string) => new Date(s);
  it('acepta un turno bien armado y el que está empezando', () => {
    expect(validarTurno(d('2026-10-30T15:00:00Z'), d('2026-10-30T19:00:00Z'), AHORA)).toBe('ok');
    expect(validarTurno(d('2026-10-29T18:00:00Z'), d('2026-10-29T20:00:00Z'), AHORA)).toBe('ok');
  });
  it('rechaza horas sueltas, muy corto, muy largo, pasado o muy lejos', () => {
    expect(validarTurno(d('2026-10-30T15:10:00Z'), d('2026-10-30T19:00:00Z'), AHORA)).toBe(
      'franja',
    );
    expect(validarTurno(d('2026-10-30T15:00:00Z'), d('2026-10-30T15:30:00Z'), AHORA)).toBe('corto');
    expect(validarTurno(d('2026-10-30T05:00:00Z'), d('2026-10-30T18:00:00Z'), AHORA)).toBe('largo');
    expect(validarTurno(d('2026-10-29T16:00:00Z'), d('2026-10-29T18:00:00Z'), AHORA)).toBe(
      'pasado',
    );
    expect(validarTurno(d('2026-11-06T15:00:00Z'), d('2026-11-06T17:00:00Z'), AHORA)).toBe('lejos');
  });
});
