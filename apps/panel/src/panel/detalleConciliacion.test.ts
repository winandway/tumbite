import { describe, expect, it } from 'vitest';
import { detalleEnPalabras } from './detalleConciliacion';

/** C-CONCILIACION-SEGUNDA-FIRMA (ETP-3): el detalle del día en palabras, es/en. */
const DEL_15 = {
  restaurantesEsperado: 87,
  restaurantesAbonado: 0,
  repartidoresEsperado: 520,
  repartidoresAbonado: 0,
  stripeEsperado: 0,
  stripeCapturado: 0,
  cuadraRestaurantes: 'NO',
  cuadraRepartidores: 'NO',
  cuadraStripe: 'sí',
  directos_VES: 3,
  directosConDiferencia_VES: 1,
  directosPendientes_VES: 0,
};

describe('detalle de la conciliación en palabras', () => {
  it('en español: tarjeta en dólares y cobros directos por moneda', () => {
    const g = detalleEnPalabras(DEL_15, 'es');
    expect(g.map((x) => x.titulo)).toEqual([
      'Pagos con tarjeta, en dólares',
      'Cobros directos en VES',
    ]);
    expect(g[0]!.lineas[0]).toMatch(/^Restaurantes: esperado .*0[.,]87.*abonado .*· no cuadra$/);
    expect(g[0]!.lineas[2]).toMatch(/^Stripe: .*· cuadra$/);
    expect(g[1]!.lineas[0]).toBe('3 entregados, 1 con diferencia, 0 pendientes de conciliar');
  });

  it('en inglés', () => {
    const g = detalleEnPalabras(DEL_15, 'en');
    expect(g[0]!.titulo).toBe('Card payments, in US dollars');
    expect(g[0]!.lineas[1]).toMatch(/^Drivers: expected .*5[.,]20.*paid .*· doesn’t balance$/);
    expect(g[1]!.lineas[0]).toBe('3 delivered, 1 with a difference, 0 pending reconciliation');
  });

  it('un detalle vacío o dañado no rompe la pantalla', () => {
    expect(detalleEnPalabras(null, 'es')).toEqual([]);
    expect(detalleEnPalabras('{x', 'en')).toEqual([]);
    expect(detalleEnPalabras({ directos_COP: 1 }, 'es')[0]!.lineas[0]).toBe(
      '1 entregado, 0 con diferencia, 0 pendientes de conciliar',
    );
  });
});
