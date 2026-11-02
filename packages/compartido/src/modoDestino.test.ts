import { describe, expect, it } from 'vitest';
import { acercaAlDestino, diaLocal, llegoAlDestino } from './modoDestino';

/** C-MODO-DESTINO (BRE-6): solo ofertas que lo acercan a su destino; se apaga al llegar. */
const casa = { lat: 25.9, lng: -80.2 };
const aqui = { lat: 25.76, lng: -80.19 };

describe('modo destino (C-MODO-DESTINO)', () => {
  it('una entrega hacia su casa pasa; una que lo aleja o lo deja igual, no', () => {
    expect(acercaAlDestino(aqui, { lat: 25.85, lng: -80.2 }, casa)).toBe(true);
    expect(acercaAlDestino(aqui, { lat: 25.7, lng: -80.19 }, casa)).toBe(false);
    expect(acercaAlDestino(aqui, { lat: 25.762, lng: -80.19 }, casa)).toBe(false);
  });

  it('llega a menos de medio kilómetro', () => {
    expect(llegoAlDestino({ lat: 25.902, lng: -80.2 }, casa)).toBe(true);
    expect(llegoAlDestino(aqui, casa)).toBe(false);
  });

  it('el día se cuenta en la hora de su ciudad, y una zona mala no rompe', () => {
    const tarde = new Date('2026-11-03T03:30:00Z'); // 22:30 del 2 nov en Miami
    expect(diaLocal(tarde, 'America/New_York')).toBe('2026-11-02');
    expect(diaLocal(tarde, 'UTC')).toBe('2026-11-03');
    expect(diaLocal(tarde, 'No/Existe')).toBe('2026-11-03');
  });
});
