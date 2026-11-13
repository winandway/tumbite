import { describe, expect, it } from 'vitest';
import { equivalenteLocal, textoReferencia } from './tasaReferencia';

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
