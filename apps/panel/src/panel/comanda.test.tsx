import { describe, expect, it } from 'vitest';
import { htmlComanda } from './comanda';

// C-COMANDA: la comanda lleva el número, los platos, las notas y nada privado.
describe('C-COMANDA', () => {
  it('imprime número, modo, platos y notas, escapando lo que escribió el cliente', () => {
    const h = htmlComanda(
      {
        id: 'abcd1234',
        entrega: 'recoger',
        notas: 'Sin cebolla <por favor>',
        lineas: [{ nombreEs: 'Cubano', nombreEn: 'Cuban', cantidad: 2 }],
      },
      'Pizzería Demo',
      'es',
      new Date('2026-10-29T17:00:00Z'),
    );
    expect(h).toContain('#ABCD');
    expect(h).toContain('RECOGE EN EL LOCAL');
    expect(h).toContain('2×');
    expect(h).toContain('Cubano');
    expect(h).toContain('Sin cebolla &lt;por favor&gt;');
    expect(h).toContain('size:80mm');
  });
});
