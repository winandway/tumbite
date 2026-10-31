import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MAPA-SIGUE-AL-REPARTIDOR (31 oct 2026): en el simulador de iPhone en Michigan, el mapa del Driver
 * sin pedido seguía en Miami. Con un solo punto el mapa tiene que ir a él.
 */
const fuente = readFileSync(
  join(__dirname, '..', '..', '..', 'apps', 'repartidor', 'src', 'piezas', 'Mapa.tsx'),
  'utf8',
);

describe('mapa del repartidor', () => {
  it('con un solo punto va a ese punto', () => {
    expect(fuente).toMatch(/puntos\.length === 1[\s\S]{0,80}animateToRegion/);
  });
});
