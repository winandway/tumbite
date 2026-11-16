import { describe, expect, it } from 'vitest';
import { validarBloque } from './rutasComun';

/** C-FLEX-BLOQUE-DURACION (Richard, 16 nov 2026): un bloque de Flex dura de 1 h 30 min a 5 horas. */
describe('C-FLEX-BLOQUE-DURACION · la duración del bloque', () => {
  it('acepta de 1 h 30 min a 5 horas y sin horario completo no exige nada', () => {
    expect(() => validarBloque('2026-11-16 14:00:00', '2026-11-16 15:30:00')).not.toThrow();
    expect(() => validarBloque('2026-11-16 14:00', '2026-11-16 19:00')).not.toThrow();
    expect(() => validarBloque('2026-11-16T14:00', '2026-11-16T17:30')).not.toThrow();
    expect(() => validarBloque(null, '2026-11-16 15:00:00')).not.toThrow();
    expect(() => validarBloque('2026-11-16 14:00:00', null)).not.toThrow();
  });
  it('rechaza menos de 1 h 30 min, más de 5 horas y un final antes del inicio', () => {
    for (const [a, b] of [
      ['2026-11-16 14:00:00', '2026-11-16 15:29:00'],
      ['2026-11-16 14:00:00', '2026-11-16 19:01:00'],
      ['2026-11-16 14:00:00', '2026-11-16 12:00:00'],
    ] as const)
      expect(() => validarBloque(a, b)).toThrow('Un bloque dura de 1 h 30 min a 5 horas.');
  });
});
