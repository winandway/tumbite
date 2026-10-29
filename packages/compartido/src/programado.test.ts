import { describe, expect, it } from 'vitest';
import { PROGRAMADO, franjasProgramables, textoFranja, validarProgramado } from './programado';

// C-PEDIDO-PROGRAMADO: franjas de 30 min, desde 1 h adelante hasta 6 días, solo con el local abierto.
const MIAMI = 'America/New_York';
// Abierto todos los días de 11:00 a 22:00.
const TURNOS = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '11:00', cierra: '22:00' }));
// Jueves 29 oct 2026, 10:10 en Miami (14:10 UTC).
const AHORA = new Date('2026-10-29T14:10:00Z');

describe('C-PEDIDO-PROGRAMADO', () => {
  it('la primera franja es la de las 11:30 (una hora adelante, redondeada, con el local abierto)', () => {
    const f = franjasProgramables(TURNOS, MIAMI, AHORA);
    expect(f[0]!.toISOString()).toBe('2026-10-29T15:30:00.000Z');
    // Nada después de las 21:30 (la franja termina al cierre) ni más allá de 6 días.
    expect(f.every((d) => d.getTime() <= AHORA.getTime() + PROGRAMADO.dias * 86_400_000)).toBe(
      true,
    );
    expect(f.some((d) => d.toISOString() === '2026-10-30T01:30:00.000Z')).toBe(true); // 21:30
    expect(f.some((d) => d.toISOString() === '2026-10-30T02:00:00.000Z')).toBe(false); // 22:00
  });

  it('rechaza lo muy pronto, lo muy lejos, lo cerrado y una hora suelta', () => {
    expect(validarProgramado(new Date('2026-10-29T14:30:00Z'), TURNOS, MIAMI, AHORA)).toBe(
      'pronto',
    );
    expect(validarProgramado(new Date('2026-11-06T16:00:00Z'), TURNOS, MIAMI, AHORA)).toBe('lejos');
    expect(validarProgramado(new Date('2026-10-30T03:00:00Z'), TURNOS, MIAMI, AHORA)).toBe(
      'cerrado',
    );
    expect(validarProgramado(new Date('2026-10-29T16:10:00Z'), TURNOS, MIAMI, AHORA)).toBe(
      'franja',
    );
    expect(validarProgramado(new Date('2026-10-29T17:00:00Z'), TURNOS, MIAMI, AHORA)).toBe('ok');
  });

  it('dice la franja en la hora del comercio', () => {
    expect(textoFranja(new Date('2026-10-29T17:00:00Z'), MIAMI, 'en', AHORA)).toBe(
      'Today, 1:00 PM–1:30 PM',
    );
    expect(textoFranja(new Date('2026-10-30T17:00:00Z'), MIAMI, 'es', AHORA)).toMatch(/^Mañana, /);
  });

  it('un festivo del comercio no se puede programar', () => {
    const f = franjasProgramables(TURNOS, MIAMI, AHORA, ['2026-10-30']);
    expect(f.some((d) => d.toISOString().startsWith('2026-10-30T16'))).toBe(false);
    expect(
      validarProgramado(new Date('2026-10-30T17:00:00Z'), TURNOS, MIAMI, AHORA, ['2026-10-30']),
    ).toBe('cerrado');
  });
});
