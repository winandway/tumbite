import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(
  join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src', 'app', 'cart.tsx'),
  'utf8',
);

// C-TOTAL-CORREGIDO (11 nov 2026): si el servidor responde 409 «El total cambió», la app toma su
// desglose, muestra el total corregido y deja pagar (antes cada reintento daba el mismo 409).
describe('C-TOTAL-CORREGIDO', () => {
  it('el carrito guarda el desglose del servidor y lo usa con los mismos datos', () => {
    expect(fuente).toMatch(/x\.campo === 'total'/);
    expect(fuente).toMatch(/setCorregido\(\{\s*huella/);
    expect(fuente).toMatch(/corregido\.huella === huella/);
  });
});
