import { describe, expect, it } from 'vitest';
import { RADIO_LLEGADA_M, llego, metrosEntre } from './llegada';

describe('llegada al restaurante y a la puerta', () => {
  const casa = { lat: 25.7725, lng: -80.187 };
  it('en la puerta sí; a unas cuadras no', () => {
    expect(llego({ lat: 25.7726, lng: -80.1871 }, casa)).toBe(true);
    expect(llego({ lat: 25.7743, lng: -80.1937 }, casa)).toBe(false);
    expect(metrosEntre({ lat: 25.7743, lng: -80.1937 }, casa)).toBeGreaterThan(RADIO_LLEGADA_M);
  });
  it('sin la ubicación del repartidor no cuenta como llegado', () => {
    expect(llego(null, casa)).toBe(false);
  });
  it('si la dirección no tiene coordenadas no se puede exigir', () => {
    expect(llego(null, null)).toBe(true);
  });
});
