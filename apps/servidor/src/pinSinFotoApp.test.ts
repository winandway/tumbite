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
    // C-CLIENTE-AUSENTE: con PIN, en lugar del lugar seguro va «cliente no apareció».
    expect(antesDe('texto={subiendo ? t.subiendo : t.dejarSeguro}', 2500)).toContain(
      'activo.pinRequerido || activo.requiereEdad ?',
    );
    expect(src).toMatch(/conPinSinFoto:\s*\n?\s*'Este pedido se entrega en mano con el PIN/);
    expect(src).toMatch(/conPinSinFoto:\s*\n?\s*'This order is handed over in person with the PIN/);
  });
});

// C-CLIENTE-AUSENTE (13 nov 2026): con PIN y sin cliente, el repartidor no queda atrapado.
describe('app del repartidor: cliente ausente con PIN (C-CLIENTE-AUSENTE)', () => {
  const src = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
  it('pasada la espera, con PIN se ofrece cerrar como «cliente no apareció» con foto', () => {
    const i = src.indexOf('testID="cliente-ausente"');
    expect(i).toBeGreaterThan(0);
    expect(src.slice(i - 400, i)).toContain('activo.pinRequerido || activo.requiereEdad ?');
    expect(src.slice(i, i + 900)).toContain('/entregado?modo=ausente');
  });
  it('el reloj de espera es el que manda el servidor (configuración), no un número fijo', () => {
    expect(src).toContain('(activo.esperaAusenteMin ?? 5) * 60_000');
    expect(src).not.toContain('avisoMs + 5 * 60_000');
  });
  it('los textos están en español e inglés', () => {
    expect(src).toContain("clienteAusente: 'Cliente no apareció: cerrar con foto'");
    expect(src).toContain("clienteAusente: 'Customer didn’t show: close with photo'");
  });
});
