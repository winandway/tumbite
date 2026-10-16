import { describe, expect, it } from 'vitest';
import { conSenal } from './senal';

describe('señal del restaurante (C-PAUSA-SIN-SENAL)', () => {
  const ahora = new Date('2026-10-16T22:00:00Z');
  it('sin marca todavía cuenta como con señal (compatibilidad al publicar)', () => {
    expect(conSenal(null, ahora)).toBe(true);
    expect(conSenal(undefined, ahora)).toBe(true);
  });
  it('4 minutos: con señal; 6 minutos: sin señal', () => {
    expect(conSenal('2026-10-16 21:56:00', ahora)).toBe(true);
    expect(conSenal('2026-10-16 21:54:00', ahora)).toBe(false);
  });
  it('el límite de 5 minutos exactos todavía es con señal', () => {
    expect(conSenal('2026-10-16 21:55:00', ahora)).toBe(true);
  });
  it('con el interruptor en 0 la pausa está apagada', () => {
    expect(conSenal('2026-10-16 10:00:00', ahora, 0)).toBe(true);
  });
  it('acepta también el formato ISO', () => {
    expect(conSenal('2026-10-16T21:50:00Z', ahora)).toBe(false);
  });
});
