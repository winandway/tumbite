import { describe, expect, it } from 'vitest';
import {
  MARGEN_PESABLE_BP,
  aplicarPesoReal,
  formatearPeso,
  margenPesables,
  textoPesoReal,
} from './pesables';

/** C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026): los pesables se cobran por su peso real, con tope. */
describe('cobro por peso real (C-TIENDAS-PESO-REAL)', () => {
  // Aguacates a 2,50 $/lb, 0,5 lb cada uno, 4 unidades: estimado 1,25 $ cada uno = 5,00 $.
  const aguacate = {
    platoId: 'p1',
    nombreEs: 'Aguacate',
    nombreEn: 'Avocado',
    precioCentavos: 125,
    cantidad: 4,
    pesable: true,
    unidadPeso: 'lb',
    precioPorPeso: 250,
    pesoEstimado: 0.5,
  };
  const leche = {
    platoId: 'p2',
    nombreEs: 'Leche',
    nombreEn: 'Milk',
    precioCentavos: 399,
    cantidad: 1,
  };

  it('el margen es el 15 % de los pesables, escalado por los cargos del pedido', () => {
    expect(MARGEN_PESABLE_BP).toBe(1500);
    // Sin pesables, nada de más.
    expect(margenPesables([leche], 1200, 399)).toBe(0);
    // 5,00 $ de pesables: 75 centavos; con un total que es el doble del subtotal, 150.
    expect(margenPesables([aguacate, leche], 899, 899)).toBe(75);
    expect(margenPesables([aguacate], 1000, 500)).toBe(150);
    // Nunca escala hacia abajo (descuentos grandes) y redondea hacia arriba.
    expect(margenPesables([aguacate], 100, 500)).toBe(75);
    expect(margenPesables([{ ...aguacate, precioCentavos: 1, cantidad: 1 }], 1, 1)).toBe(1);
    expect(margenPesables([aguacate], 0, 0)).toBe(75);
  });

  it('el peso real da el importe de la línea, a favor del cliente en el redondeo', () => {
    // 1,83 lb a 2,50 $/lb = 4,575 $ → 458 centavos entre 4 = 114 cada uno (456; 2 centavos a favor).
    const r = aplicarPesoReal(aguacate, 1.83);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linea).toMatchObject({
      precioCentavos: 114,
      cantidad: 4,
      pesoReal: 1.83,
      precioEstimadoCentavos: 125,
    });
    // Pesar otra vez parte siempre del estimado original, no del último peso.
    const otra = aplicarPesoReal(r.linea, 2.1);
    expect(otra.ok && otra.linea.precioCentavos).toBe(131);
    expect(otra.ok && otra.linea.precioEstimadoCentavos).toBe(125);
  });

  it('nunca pasa del estimado más el 15 %, y rechaza pesos sin sentido o líneas sin peso', () => {
    // Tope: 5,00 $ × 1,15 = 5,75 $ → 2,3 lb exactas valen; 2,31 lb ya no.
    expect(aplicarPesoReal(aguacate, 2.3).ok).toBe(true);
    const mucho = aplicarPesoReal(aguacate, 2.31);
    expect(mucho).toMatchObject({ ok: false, motivo: 'tope' });
    expect(!mucho.ok && mucho.pesoMaximo).toBe(2.3);
    expect(aplicarPesoReal(aguacate, 0)).toMatchObject({ ok: false, motivo: 'peso' });
    expect(aplicarPesoReal(aguacate, Number.NaN)).toMatchObject({ ok: false, motivo: 'peso' });
    expect(aplicarPesoReal(leche, 1)).toMatchObject({ ok: false, motivo: 'no_pesable' });
    // Una línea vieja sin precio por peso: no se puede recalcular.
    expect(aplicarPesoReal({ ...aguacate, precioPorPeso: undefined }, 1)).toMatchObject({
      ok: false,
      motivo: 'no_pesable',
    });
  });

  it('el cliente ve «peso estimado → peso real» en los dos idiomas', () => {
    expect(textoPesoReal(aguacate, 'es')).toBe('');
    const r = aplicarPesoReal(aguacate, 1.83);
    if (!r.ok) throw new Error('debía valer');
    expect(textoPesoReal(r.linea, 'es')).toBe('Peso estimado 2 lb → peso real 1.83 lb');
    expect(textoPesoReal(r.linea, 'en')).toBe('Estimated weight 2 lb → actual weight 1.83 lb');
    expect(formatearPeso(0.456789)).toBe('0.457');
    expect(textoPesoReal({ ...r.linea, unidadPeso: undefined }, 'en')).toBe(
      'Estimated weight 2 → actual weight 1.83',
    );
  });
});
