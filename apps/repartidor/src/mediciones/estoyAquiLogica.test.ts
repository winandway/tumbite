import { describe, expect, it } from 'vitest';
import { estadoGps } from './estoyAquiLogica';

const KM9 = { lat: 8.6, lng: -71.7 };
const ahora = 1_000_000;
const leer = (precisionM: number | null, dLat = 0.0005, hora = ahora) => ({
  lat: KM9.lat + dLat,
  lng: KM9.lng,
  precisionM,
  hora,
});

describe('C-ESTOY-AQUI: el botón sale solo con la precisión mínima', () => {
  it('con 15 m o menos, listo; con 16 m o sin dato, esperar', () => {
    expect(estadoGps(leer(15), KM9, true, ahora).tipo).toBe('listo');
    expect(estadoGps(leer(4), KM9, true, ahora)).toMatchObject({ tipo: 'listo', precisionM: 4 });
    expect(estadoGps(leer(16), KM9, true, ahora)).toEqual({ tipo: 'esperar', precisionM: 16 });
    expect(estadoGps(leer(null), KM9, true, ahora).tipo).toBe('esperar');
    expect(estadoGps(leer(0), KM9, true, ahora).tipo).toBe('esperar');
  });
  it('sin permiso, sin lectura o con una lectura vieja no hay botón', () => {
    expect(estadoGps(leer(5), KM9, false, ahora).tipo).toBe('sin-permiso');
    expect(estadoGps(null, KM9, true, ahora).tipo).toBe('buscando');
    expect(estadoGps(leer(5, 0.0005, ahora - 31_000), KM9, true, ahora).tipo).toBe('buscando');
  });
  it('a más de 5 km del lugar, le dice que está lejos', () => {
    expect(estadoGps(leer(5, 0.06), KM9, true, ahora).tipo).toBe('lejos');
  });
});
