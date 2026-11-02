import { describe, expect, it } from 'vitest';
import { celdaCsv, planillaGanancias } from './planillas';

describe('planillas (C-PLANILLA-GANANCIAS)', () => {
  it('celdas seguras: sin fórmulas y con comillas', () => {
    expect(celdaCsv('=SUMA(A1)')).toBe("'=SUMA(A1)");
    expect(celdaCsv('Pizza, Pasta')).toBe('"Pizza, Pasta"');
    expect(celdaCsv(-5)).toBe('-5');
  });

  it('las ganancias salen una fila por entrega, con decimales en su moneda', () => {
    const csv = planillaGanancias([
      {
        codigo: 'AB12',
        restaurante: 'Pizzería, Centro',
        entregadoEn: '2026-10-10 15:00:00',
        moneda: 'USD',
        base: 500,
        bono: 100,
        propina: 300,
        propinaPosterior: 50,
        total: 950,
      },
    ]);
    expect(csv.split('\n')).toEqual([
      'fecha,pedido,restaurante,moneda,base,bonos,propinas,total',
      '2026-10-10 15:00:00,AB12,"Pizzería, Centro",USD,5.00,1.00,3.50,9.50',
    ]);
  });
});
