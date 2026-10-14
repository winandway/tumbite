import { describe, expect, it } from 'vitest';
import { debeOfrecer, minutosDeViaje, minutosParaListo, prepSugerida } from './despacho';

describe('despacho con reloj (C-DESPACHO-RELOJ)', () => {
  it('el viaje se estima a velocidad de ciudad, nunca menos de 2 minutos', () => {
    expect(minutosDeViaje(0.1)).toBe(2);
    expect(minutosDeViaje(5)).toBe(12);
  });

  it('cuánto falta para listo sale de la hora en que aceptó y los minutos que dijo', () => {
    const ahora = Date.parse('2026-10-14T15:00:00Z');
    expect(minutosParaListo('aceptado', '2026-10-14 14:50:00', 30, ahora)).toBe(20);
    expect(minutosParaListo('aceptado', '2026-10-14 14:20:00', 30, ahora)).toBe(0);
    expect(minutosParaListo('listo', '2026-10-14 14:59:00', 30, ahora)).toBe(0);
  });

  it('un pedido con 30 minutos de cocina no se ofrece a quien está a la vuelta; uno listo, sí', () => {
    expect(debeOfrecer(30, 0.5)).toBe(false);
    expect(debeOfrecer(5, 0.5)).toBe(true);
    expect(debeOfrecer(0, 10)).toBe(true);
    // A 10 km (24 min de viaje) sí se le ofrece con 25 minutos por delante: llega justo.
    expect(debeOfrecer(25, 10)).toBe(true);
  });
});

describe('tiempo sugerido y cocina ocupada (C-DESPACHO-COMPLETO)', () => {
  it('con historial usa el promedio real redondeado a 5; sin historial, el configurado', () => {
    expect(prepSugerida([22, 18, 27, 23], 20)).toBe(25);
    expect(prepSugerida([12, 13], 30)).toBe(30);
    expect(prepSugerida([], 20)).toBe(20);
  });
  it('nunca baja de 10 ni pasa de 60, y la cocina ocupada suma encima', () => {
    expect(prepSugerida([3, 4, 2], 20)).toBe(10);
    expect(prepSugerida([90, 95, 100], 20)).toBe(60);
    expect(prepSugerida([22, 18, 27], 20, 10)).toBe(30);
  });
});
