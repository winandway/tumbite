import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contar } from './plural';

/**
 * C-PLURAL (18 nov 2026, ficha de Google Play): Driver decía «1 entregas» y «1 deliveries». Un
 * número con su palabra pasa por una sola pieza, en español y en inglés.
 */
describe('un número con su palabra', () => {
  it('singular con 1, plural con 0 y con más', () => {
    expect(contar(1, 'entrega', 'es')).toBe('1 entrega');
    expect(contar(0, 'entrega', 'es')).toBe('0 entregas');
    expect(contar(3, 'entrega', 'es')).toBe('3 entregas');
    expect(contar(1, 'entrega', 'en')).toBe('1 delivery');
    expect(contar(2, 'entrega', 'en')).toBe('2 deliveries');
    expect(contar(1, 'parada', 'en')).toBe('1 stop');
    expect(contar(1, 'paquete', 'es')).toBe('1 paquete');
    expect(contar(5, 'pedido', 'en')).toBe('5 orders');
    expect(contar(1, 'carrera', 'en')).toBe('1 trip');
    expect(contar(1, 'viaje', 'en')).toBe('1 ride');
    expect(contar(1, 'minuto', 'es')).toBe('1 minuto');
    expect(contar(2, 'servicio', 'en')).toBe('2 services');
  });
});

describe('las pantallas no ponen un número delante de una palabra en plural fijo', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const casos: [string, RegExp][] = [
    ['apps/repartidor/src/Inicio.tsx', /\{porPedido\.size\} \{td\.entregas/],
    ['apps/repartidor/src/grandes/Ganancias.tsx', /\$\{x\.entregas\} \$\{t\.entregas\}/],
    ['apps/repartidor/src/flex/MiRuta.tsx', /\} \$\{t\.restantes\.(paradas|paquetes)\}/],
    ['apps/restaurante/src/Promociones.tsx', /`\$\{n\} (pedidos|orders) ·/],
  ];
  for (const [archivo, mal] of casos)
    it(archivo, () => {
      const s = readFileSync(join(raiz, archivo), 'utf8');
      expect(s).not.toMatch(mal);
      expect(s).toContain('contar(');
    });
});
