import { describe, expect, it } from 'vitest';
import { csvResumenAnual, resumenAnual } from './resumenAnual';

describe('resumen del año del repartidor (C-RESUMEN-ANUAL)', () => {
  const entregas = [
    { entregadoEn: '2026-09-30 22:00:00', distanciaKm: 3.2, moneda: 'USD', total: 900 },
    { entregadoEn: '2026-10-01 12:00:00', distanciaKm: 1.609344, moneda: 'USD', total: 700 },
    { entregadoEn: '2026-10-02 12:00:00', distanciaKm: null, moneda: 'COP', total: 1_200_000 },
  ];

  it('agrupa por mes, convierte a millas y nunca mezcla monedas', () => {
    const r = resumenAnual(entregas);
    expect(r.meses.map((m) => m.mes)).toEqual(['2026-09', '2026-10']);
    expect(r.meses[1]).toEqual({
      mes: '2026-10',
      entregas: 2,
      km: 1.6,
      millas: 1,
      ganado: [
        { moneda: 'USD', total: 700 },
        { moneda: 'COP', total: 1_200_000 },
      ],
    });
    expect(r.total).toEqual({ entregas: 3, km: 4.8, millas: 3 });
  });

  it('el CSV lleva una fila por mes y moneda, en los dos idiomas', () => {
    const csv = csvResumenAnual(resumenAnual(entregas).meses, 'en').split('\n');
    expect(csv[0]).toBe('month,deliveries,miles,km,currency,earned');
    expect(csv).toContain('2026-10,2,1,1.6,USD,7.00');
    expect(csv).toHaveLength(4);
    expect(csvResumenAnual([], 'es')).toBe('mes,entregas,millas,km,moneda,ganado');
  });
});
