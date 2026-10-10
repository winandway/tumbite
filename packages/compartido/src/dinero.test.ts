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

import { centavosATexto, dolaresACentavos } from './dinero';

describe('precios escritos por personas', () => {
  it('entiende los formatos comunes sin errores de redondeo', () => {
    expect(dolaresACentavos('12.50')).toBe(1250);
    expect(dolaresACentavos('12,5')).toBe(1250);
    expect(dolaresACentavos('$ 12')).toBe(1200);
    expect(dolaresACentavos('0.1')).toBe(10);
    expect(dolaresACentavos('19.99')).toBe(1999);
  });
  it('rechaza lo que no es un precio', () => {
    expect(dolaresACentavos('')).toBeNull();
    expect(dolaresACentavos('doce')).toBeNull();
    expect(dolaresACentavos('-5')).toBeNull();
    expect(dolaresACentavos('1.999')).toBeNull();
  });
  it('vuelve a texto para editar', () => {
    expect(centavosATexto(1250)).toBe('12.50');
  });
});
