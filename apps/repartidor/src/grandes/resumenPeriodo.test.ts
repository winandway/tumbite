import { describe, expect, it } from 'vitest';
import { resumenPeriodo, textoTrabajos } from './resumenPeriodo';

describe('C-GANANCIAS-COHERENTES: el total del periodo en Ganancias', () => {
  it('un regalo de Divoox suma al total pero no cuenta como entrega', () => {
    expect(resumenPeriodo([{ id: 'm1', monto: 100, concepto: 'regalo' }])).toEqual({
      total: 100,
      entregas: 0,
      carreras: 0,
      regalos: 100,
    });
  });
  it('la entrega y su propina son UNA entrega; el retiro no cuenta', () => {
    expect(
      resumenPeriodo([
        { id: 'm1', monto: 500, concepto: 'entrega', pedidoId: 'p1' },
        { id: 'm2', monto: 150, concepto: 'propina', pedidoId: 'p1' },
        { id: 'm3', monto: 400, concepto: 'entrega', pedidoId: 'p2' },
        { id: 'm4', monto: 100, concepto: 'regalo' },
        { id: 'm5', monto: -900, concepto: 'retiro' },
      ]),
    ).toEqual({ total: 1150, entregas: 2, carreras: 0, regalos: 100 });
  });

  it('C-GANANCIAS-CARRERAS: un viaje cobrado con tarjeta (entrega sin pedido) cuenta como carrera', () => {
    const r = resumenPeriodo([
      { id: 'v1', monto: 900, concepto: 'entrega' },
      { id: 'v2', monto: 700, concepto: 'entrega', pedidoId: null },
      { id: 'm1', monto: 500, concepto: 'entrega', pedidoId: 'p1' },
      { id: 'g1', monto: 100, concepto: 'regalo' },
    ]);
    expect(r).toEqual({ total: 2200, entregas: 1, carreras: 2, regalos: 100 });
    expect(textoTrabajos(r.entregas, r.carreras, 'es')).toBe('1 entrega · 2 carreras');
    expect(textoTrabajos(0, 1, 'es')).toBe('1 carrera');
    expect(textoTrabajos(0, 2, 'en')).toBe('2 trips');
    expect(textoTrabajos(3, 0, 'en')).toBe('3 deliveries');
    expect(textoTrabajos(0, 0, 'es')).toBe('0 entregas');
  });

  // Robot de Android (18 nov 2026): un viaje de moto pagado ENTERO con regalo (1,13 de regalo, 0 del
  // pasajero) salía «0 entregas». El regalo es el pago de un viaje real: ese viaje es 1 carrera, una
  // vez (también si además hubo cobro con tarjeta del mismo viaje).
  it('un viaje pagado con regalo cuenta como 1 carrera, una sola vez', () => {
    expect(
      resumenPeriodo([{ id: 'g1', monto: 113, concepto: 'regalo', operacionId: 'op-1' }]),
    ).toEqual({ total: 113, entregas: 0, carreras: 1, regalos: 113 });
    const mixto = resumenPeriodo([
      { id: 'v1', monto: 300, concepto: 'entrega', operacionId: 'op-2' },
      { id: 'g2', monto: 100, concepto: 'regalo', operacionId: 'op-2' },
      { id: 'g3', monto: 100, concepto: 'regalo' },
    ]);
    expect(mixto.carreras).toBe(1);
    expect(mixto.regalos).toBe(200);
  });
});
