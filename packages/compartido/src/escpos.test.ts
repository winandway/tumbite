import { describe, expect, it } from 'vitest';
import { estructuraComanda } from './comanda';
import { escposComanda, lineasTextoComanda, textoCp850 } from './escpos';

/**
 * C-IMPRESORA-NAVEGADOR (8 nov 2026): el ticket que va directo a la impresora térmica (WebUSB o
 * Web Serial) en ESC/POS, con los mismos datos que la comanda HTML.
 */
const pedido = {
  id: 'abcd1234',
  clienteCorto: 'Ana García',
  alergias: 'maní',
  lineas: [
    {
      nombreEs: 'Pizza',
      nombreEn: 'Pizza',
      cantidad: 2,
      opciones: [{ id: 'o', nombreEs: 'Sin cebolla', nombreEn: 'No onion', precioCentavos: 0 }],
    },
  ],
};
const aTexto = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join('');

describe('C-IMPRESORA-NAVEGADOR · ticket ESC/POS', () => {
  it('empieza con ESC @ y la página de códigos 850, y termina con avance y corte', () => {
    const b = escposComanda(estructuraComanda(pedido, 'Pizzería Demo', 'es'), 80);
    expect(Array.from(b.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x02]);
    expect(Array.from(b.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
  it('lleva los mismos datos que la comanda HTML', () => {
    const t = aTexto(escposComanda(estructuraComanda(pedido, 'Pizzeria Demo', 'es'), 80));
    for (const s of [
      'Pizzeria Demo',
      '#ABCD',
      'A DOMICILIO',
      'Ana G.',
      '2x Pizza',
      'SIN CEBOLLA',
      'Divoox',
    ])
      expect(t).toContain(s);
    expect(t).toContain('ALERGIA: man\xa1');
  });
  it('corta las líneas al ancho: 32 columnas en 58 mm y 48 en 80 mm', () => {
    const largo = {
      id: 'abcd1234',
      lineas: [{ nombreEs: 'Palabra '.repeat(12).trim(), nombreEn: 'x', cantidad: 1 }],
    };
    for (const [ancho, cols] of [
      [58, 32],
      [80, 48],
    ] as const) {
      const lineas = lineasTextoComanda(estructuraComanda(largo, 'R', 'es'), ancho);
      expect(lineas.some((r) => r.texto === '-'.repeat(cols))).toBe(true);
      for (const r of lineas) expect(r.texto.length * (r.doble ? 2 : 1)).toBeLessThanOrEqual(cols);
    }
  });
  it('acentos en la página 850; lo que no existe se cambia por su letra sin tilde', () => {
    expect(Array.from(textoCp850('ñáéíóú¿¡'))).toEqual([
      0xa4, 0xa0, 0x82, 0xa1, 0xa2, 0xa3, 0xa8, 0xad,
    ]);
    expect(aTexto(textoCp850('ő→'))).toBe('o?');
  });
});
