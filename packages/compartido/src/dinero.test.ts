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

describe('montos en la moneda del país (C-MONEDA-LOCAL)', () => {
  it('dólares con dos decimales, pesos colombianos sin decimales y bolívares con dos', async () => {
    const { formatearMonto, DECIMALES_MONEDA } = await import('./dinero');
    expect(DECIMALES_MONEDA.get('COP')).toBe(0);
    // La unidad menor: centavos de dólar, pesos enteros, céntimos de bolívar.
    expect(formatearMonto(2081, 'USD', 'en')).toBe('$20.81');
    expect(formatearMonto(35000, 'COP', 'es').replace(/\s/g, ' ')).toMatch(/35\.000/);
    expect(formatearMonto(35000, 'COP', 'es')).toMatch(/COP|\$/);
    expect(formatearMonto(12550, 'VES', 'es')).toMatch(/125,50/);
    // Sin moneda conocida, se comporta como dólares (nada se rompe en EE. UU.).
    expect(formatearMonto(100, 'XXX' as never, 'en')).toBe('$1.00');
    expect(() => formatearMonto(1.5, 'COP', 'es')).toThrow();
  });
});

describe('lo que se escribe, a la unidad menor de cada moneda (C-MONEDA-LOCAL)', () => {
  it('dólares con dos decimales, pesos sin decimales, ida y vuelta', async () => {
    const { textoAMonto, montoATexto } = await import('./dinero');
    expect(textoAMonto('15.50', 'USD')).toBe(1550);
    expect(textoAMonto('15,5')).toBe(1550);
    expect(textoAMonto('12000', 'COP')).toBe(12000);
    expect(textoAMonto('12,50', 'VES')).toBe(1250);
    expect(Number.isNaN(textoAMonto('abc', 'USD'))).toBe(true);
    expect(montoATexto(1550, 'USD')).toBe('15.50');
    expect(montoATexto(12000, 'COP')).toBe('12000');
    expect(textoAMonto(montoATexto(98765, 'COP'), 'COP')).toBe(98765);
    // Moneda desconocida: dos decimales, como el dólar.
    expect(textoAMonto('3.25', 'XYZ')).toBe(325);
    expect(montoATexto(325, 'XYZ')).toBe('3.25');
    expect(montoATexto(325)).toBe('3.25');
  });
});
