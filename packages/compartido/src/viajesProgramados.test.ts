import { describe, expect, it } from 'vitest';
import {
  VIAJE_PROGRAMADO,
  cancelacionProgramadaGratis,
  horasParaProgramar,
  validarHoraViajeProgramado,
} from './viajesProgramados';

/** C-VIAJE-PROGRAMADO (14 nov 2026, todos los países): las reglas que comparten app y servidor. */
describe('C-VIAJE-PROGRAMADO · reglas', () => {
  const ahora = new Date('2026-11-14T12:00:00Z');
  const en = (min: number) => new Date(ahora.getTime() + min * 60_000);

  it('desde 30 minutos hasta 7 días', () => {
    expect(validarHoraViajeProgramado(en(29), ahora)).toBe('pronto');
    expect(validarHoraViajeProgramado(en(30), ahora)).toBe('ok');
    expect(validarHoraViajeProgramado(en(7 * 24 * 60), ahora)).toBe('ok');
    expect(validarHoraViajeProgramado(en(7 * 24 * 60 + 1), ahora)).toBe('lejos');
  });

  it('cancelar es gratis hasta 60 minutos antes', () => {
    expect(cancelacionProgramadaGratis(en(61), ahora)).toBe(true);
    expect(cancelacionProgramadaGratis(en(60), ahora)).toBe(true);
    expect(cancelacionProgramadaGratis(en(59), ahora)).toBe(false);
  });

  it('las horas para elegir van cada 15 minutos y todas se pueden reservar', () => {
    const horas = horasParaProgramar(new Date('2026-11-14T12:07:00Z'));
    expect(horas[0]?.toISOString()).toBe('2026-11-14T12:45:00.000Z');
    expect(horas.every((h) => h.getUTCMinutes() % 15 === 0)).toBe(true);
    expect(
      horas.every((h) => validarHoraViajeProgramado(h, new Date('2026-11-14T12:07:00Z')) === 'ok'),
    ).toBe(true);
    expect(VIAJE_PROGRAMADO.despachoAntesMin).toBe(15);
  });
});
