import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANCHO_COMANDA_PUNTOS, htmlComanda, nombreCorto } from './comanda';

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
    expect(h).toContain('Pizza · Nota: sin &lt;cebolla&gt;');
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
