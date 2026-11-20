import { describe, expect, it } from 'vitest';
import {
  cobrosDelPeriodo,
  resumenConEnMano,
  resumenPeriodo,
  textoTrabajos,
} from './resumenPeriodo';

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

describe('C-GANANCIAS-EN-MANO: el total del periodo incluye lo cobrado en mano', () => {
  const viaje = (id: string, monto: number, moneda = 'USD', montoLocal: number | null = null) =>
    ({
      id: `v:${id}`,
      tipo: 'carrera',
      fecha: '2026-11-19 15:00:00',
      monto,
      moneda,
      montoLocal,
    }) as const;

  it('Venezuela, todo en mano: el total ya no es cero, en dólares y con sus bolívares', () => {
    const r = resumenConEnMano(
      [],
      [viaje('a', 150, 'USD', 35_468), viaje('b', 200, 'USD', 47_291)],
    );
    expect(r.partes).toEqual([{ moneda: 'USD', monto: 350 }]);
    expect(r.enMano).toEqual([{ moneda: 'USD', monto: 350 }]);
    expect(r.bolivares).toBe(82_759);
    expect(r).toMatchObject({ entregas: 0, carreras: 2 });
  });

  it('Perú: los soles van aparte de los dólares de la billetera, nunca sumados', () => {
    const r = resumenConEnMano(
      [{ id: 'g1', monto: 100, concepto: 'regalo', operacionId: 'a' }],
      [viaje('a', 800, 'PEN'), viaje('b', 1200, 'PEN')],
    );
    expect(r.partes).toEqual([
      { moneda: 'USD', monto: 100 },
      { moneda: 'PEN', monto: 2000 },
    ]);
    expect(r.bolivares).toBe(0);
    // El viaje «a» ya contaba por su regalo: son dos carreras, no tres.
    expect(r.carreras).toBe(2);
  });

  it('solo soles en mano: no aparece un «$0.00» delante', () => {
    expect(resumenConEnMano([], [viaje('a', 800, 'PEN')]).partes).toEqual([
      { moneda: 'PEN', monto: 800 },
    ]);
  });

  it('sin nada: un solo cero en dólares, como siempre', () => {
    expect(resumenConEnMano([], [])).toMatchObject({
      partes: [{ moneda: 'USD', monto: 0 }],
      enMano: [],
      bolivares: 0,
      entregas: 0,
      carreras: 0,
    });
  });

  it('un pedido cobrado en mano cuenta como entrega y suma en su moneda', () => {
    const r = resumenConEnMano(
      [{ id: 'm1', monto: 500, concepto: 'entrega', pedidoId: 'p1' }],
      [{ id: 'p:p2', tipo: 'entrega', fecha: '2026-11-19 15:00:00', monto: 300, moneda: 'USD' }],
    );
    expect(r.partes).toEqual([{ moneda: 'USD', monto: 800 }]);
    expect(r.entregas).toBe(2);
  });

  it('cobrosDelPeriodo: hoy, semana y mes con la fecha local', () => {
    const ahora = new Date(2026, 10, 19, 18, 0, 0);
    const en = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const cobros = [
      { ...viaje('hoy', 100), fecha: en(new Date(2026, 10, 19, 9, 0, 0)) },
      { ...viaje('lunes', 100), fecha: en(new Date(2026, 10, 16, 9, 0, 0)) },
      { ...viaje('dia2', 100), fecha: en(new Date(2026, 10, 2, 9, 0, 0)) },
      { ...viaje('octubre', 100), fecha: en(new Date(2026, 9, 30, 9, 0, 0)) },
    ];
    expect(cobrosDelPeriodo(cobros, 'hoy', ahora).map((c) => c.id)).toEqual(['v:hoy']);
    expect(cobrosDelPeriodo(cobros, 'semana', ahora).map((c) => c.id)).toEqual([
      'v:hoy',
      'v:lunes',
    ]);
    expect(cobrosDelPeriodo(cobros, 'mes', ahora)).toHaveLength(3);
  });
});
