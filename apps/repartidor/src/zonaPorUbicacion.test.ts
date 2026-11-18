import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ZONA-CONDUCTOR-NUEVO (robot, 18 nov 2026): un conductor nuevo en El Vigía quedaba en Miami hasta
 * conectarse. Al abrir Driver, la ubicación del mapa fija su ciudad (el servidor decide si toca).
 */
describe('Driver manda su primera ubicación para fijar la ciudad', () => {
  it('una vez por sesión, y si cambió, vuelve a leer el panel', () => {
    const s = readFileSync(join(import.meta.dirname, 'Inicio.tsx'), 'utf8');
    expect(s).toMatch(/'\/datos\/conductor\/zona-por-ubicacion', aqui\)/);
    expect(s).toMatch(/zonaPedida\.current = true/);
    expect(s).toMatch(/if \(r\.cambio\) \{\s+void recargarPanel\(\);/);
  });
});
