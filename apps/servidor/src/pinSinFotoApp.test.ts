import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = join(__dirname, '..', '..', '..');

// C-PIN-SIN-FOTO (11 nov 2026): en un pedido «en mano con PIN», la app del repartidor no ofrece
// entregar con foto (ni en la puerta ni en lugar seguro) y dice por qué.
describe('app del repartidor: con PIN no se entrega con foto (C-PIN-SIN-FOTO)', () => {
  const src = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
  const antesDe = (marca: string, n = 500) => {
    const i = src.indexOf(marca);
    expect(i).toBeGreaterThan(0);
    return src.slice(Math.max(0, i - n), i);
  };

  it('el botón de foto de la entrega va condicionado a que no haya PIN', () => {
    expect(antesDe('texto={subiendo ? t.subiendo : t.fotoEntrega}')).toContain(
      '!activo.pinRequerido',
    );
  });

  it('el lugar seguro con foto tampoco se ofrece con PIN, y se explica', () => {
    expect(antesDe('texto={subiendo ? t.subiendo : t.dejarSeguro}', 1500)).toContain(
      'activo.pinRequerido ?',
    );
    expect(src).toMatch(/conPinSinFoto:\s*\n?\s*'Este pedido se entrega en mano con el PIN/);
    expect(src).toMatch(/conPinSinFoto:\s*\n?\s*'This order is handed over in person with the PIN/);
  });
});
