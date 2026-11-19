import { describe, expect, it } from 'vitest';
import {
  aplicaReferencia,
  equivalenteLocal,
  montoEnMano,
  tasaGuardada,
  textoLocal,
  textoReferencia,
  textoSinTasa,
  textoTasaUsada,
} from './tasaReferencia';

describe('C-BS-REFERENCIA: el equivalente en bolívares, solo informativo', () => {
  it('convierte con enteros y redondea a la mitad hacia arriba', () => {
    // 12,50 USD con 881,87690000 Bs/USD = 11.023,46125 Bs → 1.102.346 céntimos.
    expect(equivalenteLocal(1250, 881.8769)).toBe(1_102_346);
    expect(equivalenteLocal(314, 36.5)).toBe(11_461);
    expect(equivalenteLocal(1, 0.5)).toBe(1); // 0,5 céntimos sube a 1
    expect(equivalenteLocal(100_000_000, 881.8769)).toBe(88_187_690_000);
  });

  it('no acepta tasas ni montos inválidos', () => {
    expect(() => equivalenteLocal(100, 0)).toThrow();
    expect(() => equivalenteLocal(1.5, 10)).toThrow();
  });

  it('se lee como en las apps de Venezuela, con la fecha de la tasa', () => {
    const r = { moneda: 'VES', monto: 264_563, tasa: 842.56, fecha: '2026-11-13' };
    expect(textoReferencia(r, 'es')).toBe('≈ Bs. 2.645,63 (tasa del 13 nov)');
    expect(textoReferencia(r, 'en')).toBe('≈ Bs. 2,645.63 (rate of Nov 13)');
    expect(textoReferencia(null, 'es')).toBe('');
  });
});

describe('C-BS-EN-MANO: lo que se cobra en mano, en dólares y en bolívares con la tasa fijada', () => {
  const tasa = { moneda: 'VES', tasa: 236.4567, fecha: '2026-11-13' };

  it('redondea el céntimo de bolívar a la mitad hacia arriba (regla única)', () => {
    // 0,87 USD × 236,4567 = 205,717329 Bs → 205,72 Bs (20.572 céntimos).
    expect(montoEnMano(87, 'USD', 'VE', tasa)).toEqual({
      monto: 87,
      moneda: 'USD',
      local: { ...tasa, monto: 20_572 },
      sinTasa: false,
    });
    // 2,00 USD × 236,4567 = 472,9134 → 472,91.
    expect(montoEnMano(200, 'USD', 'VE', tasa).local?.monto).toBe(47_291);
    // 0,02 USD × 12,5 = 0,25 Bs exacto; 0,01 × 12,5 = 0,125 → 0,13 (la mitad sube).
    expect(montoEnMano(1, 'USD', 'VE', { ...tasa, tasa: 12.5 }).local?.monto).toBe(13);
  });

  it('en Estados Unidos (y en todo país sin moneda de referencia) no aplica', () => {
    expect(montoEnMano(200, 'USD', 'US', tasa)).toEqual({
      monto: 200,
      moneda: 'USD',
      local: null,
      sinTasa: false,
    });
    expect(aplicaReferencia('US', 'USD')).toBe(false);
    expect(aplicaReferencia('VE', 'USD')).toBe(true);
    expect(aplicaReferencia('VE', 'VES')).toBe(false);
    expect(aplicaReferencia(null, 'USD')).toBe(false);
  });

  it('sin tasa vigente lo dice, no inventa un número', () => {
    expect(montoEnMano(87, 'USD', 'VE', null)).toEqual({
      monto: 87,
      moneda: 'USD',
      local: null,
      sinTasa: true,
    });
    expect(textoSinTasa('es', 'conductor')).toMatch(/no hay tasa/i);
    expect(textoSinTasa('en', 'pasajero')).toMatch(/no exchange rate/i);
  });

  it('el mismo monto y la misma tasa dan el mismo número (conductor y pasajero)', () => {
    expect(montoEnMano(113, 'USD', 'VE', tasa)).toEqual(montoEnMano(113, 'USD', 'VE', { ...tasa }));
  });

  it('se lee el monto local y la tasa usada con su fecha', () => {
    const r = { ...tasa, monto: 20_572 };
    expect(textoLocal(r, 'es')).toBe('Bs. 205,72');
    expect(textoLocal(r, 'en')).toBe('Bs. 205.72');
    expect(textoTasaUsada(r, 'es')).toBe('Tasa del 13 nov: Bs. 236,4567 por dólar');
    expect(textoTasaUsada(r, 'en')).toBe('Rate of Nov 13: Bs. 236.4567 per dollar');
    expect(textoLocal(null, 'es')).toBe('');
    expect(textoTasaUsada(null, 'es')).toBe('');
  });

  it('lee la tasa guardada con la operación (o null si no se guardó)', () => {
    expect(tasaGuardada('VE', 236.4567, '2026-11-13')).toEqual(tasa);
    expect(tasaGuardada('VE', null, null)).toBeNull();
    expect(tasaGuardada('VE', 0, '2026-11-13')).toBeNull();
    expect(tasaGuardada('US', 236.4567, '2026-11-13')).toBeNull();
  });
});
