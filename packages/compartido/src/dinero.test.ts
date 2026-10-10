import { describe, expect, it } from 'vitest';
import { esCentavosValidos, formatearDolares, porcentajeDe } from './dinero';

describe('dinero', () => {
  it('formatea centavos como dólares', () => {
    expect(formatearDolares(3849, 'en')).toBe('$38.49');
    expect(formatearDolares(3849, 'es')).toContain('38.49');
  });

  it('rechaza montos con decimales', () => {
    expect(() => formatearDolares(10.5)).toThrow();
  });

  it('calcula porcentajes en puntos básicos y redondea al centavo', () => {
    expect(porcentajeDe(3000, 750)).toBe(225); // 7,5 % de 30 dólares
    expect(porcentajeDe(3000, 1250)).toBe(375);
    expect(porcentajeDe(999, 333)).toBe(33);
  });

  it('no acepta montos negativos ni porcentajes raros', () => {
    expect(() => porcentajeDe(-1, 100)).toThrow();
    expect(() => porcentajeDe(100, 7.5)).toThrow();
    expect(esCentavosValidos(100)).toBe(true);
    expect(esCentavosValidos(-5)).toBe(false);
  });
});
