import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-REPARTIDOR-WEB: la app del repartidor vive en tumbite.com/repartidor y el botón
 * «Conectarme» nunca se queda mudo (ubicación con tope de tiempo y error visible).
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', ...r), 'utf8');

describe('app del repartidor en la web', () => {
  it('se exporta con la base /repartidor y se publica en esa carpeta', () => {
    expect(JSON.parse(leer('repartidor', 'app.json')).expo.experiments.baseUrl).toBe('/repartidor');
    expect(leer('..', '.github', 'workflows', 'publicar.yml')).toMatch(/out-deploy\/repartidor/);
  });

  it('«Conectarme» tiene tope de tiempo, atrapa errores y no los borra la recarga', () => {
    const inicio = leer('repartidor', 'src', 'Inicio.tsx');
    expect(inicio).toMatch(/ubicacionConLimite/);
    expect(inicio).toMatch(/async function alternar\(\) \{[\s\S]*try \{[\s\S]*catch/);
    expect(inicio).toMatch(/setErrorCarga\(''\)/);
  });
});
