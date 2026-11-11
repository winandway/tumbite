import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = join(__dirname, '..', '..', '..');

// C-LISTO-SIN-AJUSTE (11 nov 2026): la app del restaurante no ofrece «Listo» mientras el cliente
// decide sobre un plato agotado (el servidor además lo rechaza con 409).
describe('app del restaurante: «Listo» espera el plato que falta (C-LISTO-SIN-AJUSTE)', () => {
  it('el botón de «Listo» va condicionado a que no haya un ajuste pendiente', () => {
    const src = readFileSync(join(raiz, 'apps/restaurante/src/Inicio.tsx'), 'utf8');
    const i = src.indexOf('/datos/restaurante/pedidos/${p.id}/listo');
    expect(i).toBeGreaterThan(0);
    const antes = src.slice(Math.max(0, i - 600), i);
    expect(antes).toContain("p.ajuste?.estado !== 'pendiente'");
  });
});
