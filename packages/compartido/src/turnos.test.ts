import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inicioDelDia, validarTurno } from './turnos';

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

describe('inicioDelDia (C-TURNOS-HORARIO)', () => {
  // En la hora de Miami, también en la nube (que corre en UTC, donde no hay cambio de hora).
  const entorno = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const antes = entorno?.TZ;
  beforeAll(() => {
    if (entorno) entorno.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (entorno) entorno.TZ = antes;
  });
  it('cada día empieza a medianoche y no se repite, también con el cambio de hora', () => {
    // 29 oct 2026 a mediodía: la semana cruza el 1 de noviembre (fin del horario de verano en EE. UU.).
    const ahora = new Date(2026, 9, 29, 12, 0).getTime();
    const dias = Array.from({ length: 7 }, (_, n) => new Date(inicioDelDia(ahora, n)));
    expect(dias.map((d) => d.getDate())).toEqual([29, 30, 31, 1, 2, 3, 4]);
    for (const d of dias) expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});
