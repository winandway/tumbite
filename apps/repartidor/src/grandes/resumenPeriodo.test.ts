import { describe, expect, it } from 'vitest';
import { resumenPeriodo } from './resumenPeriodo';

describe('C-GANANCIAS-COHERENTES: el total del periodo en Ganancias', () => {
  it('un regalo de Divoox suma al total pero no cuenta como entrega', () => {
    expect(resumenPeriodo([{ id: 'm1', monto: 100, concepto: 'regalo' }])).toEqual({
      total: 100,
      entregas: 0,
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
    ).toEqual({ total: 1150, entregas: 2, regalos: 100 });
  });
});
