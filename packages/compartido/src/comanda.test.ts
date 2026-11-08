import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANCHO_COMANDA_PUNTOS,
  COLUMNAS_COMANDA,
  estructuraComanda,
  htmlComanda,
  nombreCorto,
} from './comanda';

/**
 * LAN-3 · C-COMANDA-APP: la comanda es UNA pieza compartida (panel y app del restaurante), en
 * 80 mm, sin dinero ni dirección del cliente; la app la imprime con la impresión del sistema
 * (AirPrint en iPhone, servicio de impresión en Android) con «Imprimir comanda» y el interruptor
 * «Imprimir la comanda al aceptar».
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(RAIZ, ...r), 'utf8');

describe('C-COMANDA-APP · la comanda compartida', () => {
  const pedido = {
    id: 'abcd1234',
    entrega: 'puerta' as const,
    notas: 'Tocar el timbre <2>',
    alergias: 'maní',
    total: 4599,
    direccion: '300 Calle de Ejemplo',
    lineas: [
      {
        nombreEs: 'Pizza',
        nombreEn: 'Pizza',
        cantidad: 2,
        opciones: [
          { id: 'o1', nombreEs: 'Extra queso', nombreEn: 'Extra cheese', precioCentavos: 150 },
        ],
      },
    ],
  };
  it('trae número, modo, platos con opciones, alergia y notas escapadas; nada de dinero ni dirección', () => {
    const h = htmlComanda(pedido, 'Pizzería Demo', 'en', new Date('2026-11-03T17:00:00Z'));
    expect(h).toContain('#ABCD');
    expect(h).toContain('DELIVERY');
    expect(h).toContain('2×');
    expect(h).toContain('Extra cheese');
    expect(h).toContain('ALLERGY: maní');
    // LAN-3x: las notas del pedido son las indicaciones para el repartidor (portón, timbre): la
    // comanda queda en la cocina y pegada a la bolsa, así que NO las lleva (DoorDash tampoco).
    expect(h).not.toContain('Tocar el timbre');
    expect(h).not.toMatch(/Notes|Notas/);
    expect(h).toContain('size:80mm');
    expect(h).not.toContain('300 Calle');
    expect(h).not.toMatch(/45[.,]99|\$/);
    // Para la impresión del sistema no lleva el guion que abre la impresión del navegador.
    expect(h).not.toContain('<script>');
    expect(htmlComanda(pedido, '', 'es', new Date(), { imprimirAlAbrir: true })).toContain(
      'window.print()',
    );
  });
  it('el pedido de prueba sale con su marca y el número que se ve en la pantalla', () => {
    const h = htmlComanda({ id: 'prueba-a5cc1234', prueba: true, notas: '', lineas: [] }, '', 'en');
    expect(h).toContain('<h1>TEST · #A5CC</h1>');
    expect(h).not.toContain('#PRUE');
    expect(
      htmlComanda({ id: 'prueba-a5cc1234', prueba: true, notas: '', lineas: [] }, '', 'es'),
    ).toContain('PRUEBA · #A5CC');
  });
  it('LAN-3y: lleva el nombre corto del cliente (nombre e inicial), nunca el apellido completo', () => {
    expect(nombreCorto('Ana García López')).toBe('Ana G.');
    expect(nombreCorto('  ana   garcía ')).toBe('Ana G.');
    expect(nombreCorto('Ana')).toBe('Ana');
    expect(nombreCorto('')).toBe('');
    expect(nombreCorto(null)).toBe('');
    for (const idioma of ['es', 'en'] as const) {
      const h = htmlComanda(
        { id: 'abcd1234', notas: '', clienteCorto: 'Ana García López', lineas: [] },
        '',
        idioma,
      );
      expect(h).toContain('Ana G.');
      expect(h).not.toMatch(/García|López/);
    }
  });
  it('LAN-3y: la nota de cada plato sale en la comanda (escapada)', () => {
    const h = htmlComanda(
      {
        id: 'abcd1234',
        notas: '',
        lineas: [{ nombreEs: 'Pizza', nombreEn: 'Pizza', cantidad: 1, nota: 'sin <cebolla>' }],
      },
      '',
      'es',
    );
    // C-COMANDA-COMPLETA: la nota va en su renglón, sangrada debajo del plato.
    expect(h).toContain(
      '<div class="p">Pizza</div><div class="d f">Nota: sin &lt;cebolla&gt;</div>',
    );
  });
  it('80 mm en puntos para la impresión del sistema', () => {
    expect(ANCHO_COMANDA_PUNTOS).toBe(227);
  });
  it('el panel usa la pieza compartida (no una copia)', () => {
    const panel = leer('apps', 'panel', 'src', 'panel', 'comanda.ts');
    expect(panel).toContain("from '@tumbite/compartido'");
    expect(panel).not.toMatch(/function htmlComanda/);
  });
  it('la app del restaurante imprime con expo-print: botón, interruptor guardado y al aceptar', () => {
    const comanda = leer('apps', 'restaurante', 'src', 'comanda.ts');
    expect(comanda).toMatch(/from 'expo-print'/);
    expect(comanda).toMatch(/printAsync\(\{ html, width: ANCHO_COMANDA_PUNTOS \}\)/);
    expect(comanda).toMatch(/htmlComanda\(/);
    const inicio = leer('apps', 'restaurante', 'src', 'Inicio.tsx');
    expect(inicio).toContain('testID="imprimir-comanda"');
    expect(inicio).toContain('testID="comanda-al-aceptar"');
    expect(inicio).toMatch(/imprimirComanda\(/);
    expect(inicio).toMatch(/useComandaAlAceptar\(/);
    expect(leer('apps', 'restaurante', 'package.json')).toMatch(/"expo-print"/);
  });
});

/**
 * C-COMANDA-COMPLETA (8 nov 2026): la comanda de cocina completa, como la impresora de DoorDash
 * Merchant y Uber Eats Manager: nombre del restaurante, número grande, tipo, cliente, horas, cada
 * plato con sus opciones sangradas (las exclusiones «SIN» en mayúscula y negrita), la nota del plato,
 * la preferencia si no hay, las alergias, el total de artículos y el pie «Divoox». Dos anchos: 58 y
 * 80 mm. La misma estructura sirve para el HTML y para el ticket ESC/POS de la impresora conectada.
 */
describe('C-COMANDA-COMPLETA · la comanda de cocina completa', () => {
  const pedido = {
    id: 'abcd1234',
    entrega: 'puerta' as const,
    clienteCorto: 'Ana García',
    notas: 'Portón azul',
    alergias: 'maní',
    pagadoEn: '2026-11-08 22:44:00',
    aceptadoEn: '2026-11-08 22:45:00',
    tiempoPrepMin: 20,
    lineas: [
      {
        nombreEs: 'Pizza pepperoni',
        nombreEn: 'Pepperoni pizza',
        cantidad: 2,
        opciones: [
          { id: 'o1', nombreEs: 'Extra queso', nombreEn: 'Extra cheese', precioCentavos: 150 },
          { id: 'o2', nombreEs: 'Sin cebolla', nombreEn: 'No onion', precioCentavos: 0 },
          { id: 'o3', nombreEs: 'Con tomate', nombreEn: 'With tomato', precioCentavos: 0 },
        ],
        nota: 'bien <dorada>',
      },
      {
        nombreEs: 'Leche',
        nombreEn: 'Milk',
        cantidad: 1,
        sustitucion: 'reembolsar',
      },
    ],
  };

  it('lleva el nombre del restaurante, cliente, horas y total de artículos', () => {
    const h = htmlComanda(pedido, 'Pizzería <Demo>', 'es', new Date('2026-11-08T23:00:00Z'));
    expect(h).toContain('Pizzería &lt;Demo&gt;');
    expect(h).toContain('A DOMICILIO');
    expect(h).toContain('Ana G.');
    expect(h).toMatch(/Pedido:/);
    expect(h).toMatch(/Listo a las:/);
    expect(h).toContain('3 artículos');
    expect(h).toContain('Divoox');
    // Las indicaciones para el repartidor siguen fuera (LAN-3x).
    expect(h).not.toContain('Portón azul');
  });

  it('cada opción va sangrada debajo del plato; las exclusiones en mayúscula y negrita', () => {
    const es = estructuraComanda(pedido, 'Pizzería Demo', 'es');
    const pizza = es.lineas[0]!;
    expect(pizza.nombre).toBe('Pizza pepperoni');
    expect(pizza.detalles).toEqual([
      { texto: '+ Extra queso', fuerte: false },
      { texto: 'SIN CEBOLLA', fuerte: true },
      { texto: 'CON tomate', fuerte: true },
      { texto: 'Nota: bien <dorada>', fuerte: true },
    ]);
    expect(es.lineas[1]!.detalles[0]!.texto).toBe('Si no hay: reembolsar');
    const en = estructuraComanda(pedido, 'Pizzería Demo', 'en');
    expect(en.lineas[0]!.detalles.map((d) => d.texto)).toEqual([
      '+ Extra cheese',
      'NO ONION',
      'WITH tomato',
      'Note: bien <dorada>',
    ]);
    const h = htmlComanda(pedido, 'Pizzería Demo', 'es');
    expect(h).toContain('<div class="d f">SIN CEBOLLA</div>');
    expect(h).toContain('Nota: bien &lt;dorada&gt;');
    expect(h).not.toMatch(/Pizza pepperoni \(/);
  });

  it('el pedido de prueba dice PEDIDO DE PRUEBA y recoger dice RECOGE EN EL LOCAL', () => {
    expect(
      estructuraComanda({ id: 'prueba-a5cc1234', prueba: true, lineas: [] }, '', 'es').modo,
    ).toBe('PEDIDO DE PRUEBA · A DOMICILIO');
    expect(estructuraComanda({ id: 'x', entrega: 'recoger', lineas: [] }, '', 'es').modo).toBe(
      'RECOGE EN EL LOCAL',
    );
  });

  it('dos anchos: 58 mm y 80 mm, con su letra', () => {
    const h58 = htmlComanda(pedido, 'R', 'es', new Date(), { ancho: 58 });
    expect(h58).toContain('size:58mm');
    expect(h58).not.toContain('size:80mm');
    expect(htmlComanda(pedido, 'R', 'es')).toContain('size:80mm');
    expect(COLUMNAS_COMANDA[58]).toBe(32);
    expect(COLUMNAS_COMANDA[80]).toBe(48);
  });
});
