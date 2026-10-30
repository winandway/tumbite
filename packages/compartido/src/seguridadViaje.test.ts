import { describe, expect, it } from 'vitest';
import { bloqueoPorHoras, distanciaARutaKm, esDeNoche, seDesvio } from './seguridadViaje';

/** C-VIAJE-SEGURIDAD-2 (30 oct 2026): las reglas del kit de seguridad, como Uber. */
const ORIGEN = { lat: 25.7743, lng: -80.1937 }; // centro de Miami
const DESTINO = { lat: 25.7907, lng: -80.13 }; // Miami Beach, unos 7 km

describe('seguridad del viaje (C-VIAJE-SEGURIDAD-2)', () => {
  it('de noche es de 9 p. m. a 6 a. m. en la hora de la ciudad', () => {
    // 02:00 UTC = 10 p. m. en Miami (noche) y 9 p. m. en Bogotá (noche); 15:00 UTC, de día.
    expect(esDeNoche(new Date('2026-10-30T02:00:00Z'), 'America/New_York')).toBe(true);
    expect(esDeNoche(new Date('2026-10-30T15:00:00Z'), 'America/New_York')).toBe(false);
    expect(esDeNoche(new Date('2026-10-30T10:30:00Z'), 'America/Caracas')).toBe(false);
    expect(esDeNoche(new Date('2026-10-30T09:30:00Z'), 'America/Caracas')).toBe(true);
  });

  it('el desvío: en la ruta o cerca no avisa; lejos, sí', () => {
    const mitad = { lat: (ORIGEN.lat + DESTINO.lat) / 2, lng: (ORIGEN.lng + DESTINO.lng) / 2 };
    expect(distanciaARutaKm(ORIGEN, DESTINO, mitad)).toBeLessThan(0.01);
    expect(seDesvio(ORIGEN, DESTINO, { lat: mitad.lat + 0.008, lng: mitad.lng })).toBe(false); // ~0,9 km
    expect(seDesvio(ORIGEN, DESTINO, { lat: 25.86, lng: -80.2 })).toBe(true); // ~9 km al norte
  });

  it('12 horas al volante en 24: no recibe viajes hasta descansar 6', () => {
    const ahora = new Date('2026-10-30T20:00:00Z');
    const h = (n: number) => new Date(ahora.getTime() - n * 3_600_000).toISOString();
    const largos = [
      { inicio: h(20), fin: h(14) },
      { inicio: h(8), fin: h(2) },
    ];
    const b = bloqueoPorHoras(largos, ahora);
    expect(b.horas).toBe(12);
    expect(b.bloqueadoHasta).toBe(new Date(ahora.getTime() + 4 * 3_600_000).toISOString());
    // Con 6 horas de descanso cumplidas, vuelve a recibir.
    expect(bloqueoPorHoras([{ inicio: h(21), fin: h(9) }], ahora).bloqueadoHasta).toBeNull();
    // Con 8 horas, sigue sin límite; lo de hace más de 24 horas no cuenta.
    expect(
      bloqueoPorHoras(
        [
          { inicio: h(9), fin: h(1) },
          { inicio: h(40), fin: h(30) },
        ],
        ahora,
      ),
    ).toEqual({
      horas: 8,
      bloqueadoHasta: null,
    });
  });
});
