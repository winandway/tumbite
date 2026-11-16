import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-DESLIZAR-SIEMPRE (16 nov 2026, pedido 407F): dos compilaciones de pruebas del Driver salieron
 * con el MISMO número (17) desde códigos distintos y una no traía el deslizador; en el teléfono no se
 * distinguían. El perfil «pruebas» de las tres apps sube el número solo en cada compilación.
 */
describe('cada compilación de pruebas lleva un número nuevo', () => {
  for (const app of ['cliente', 'repartidor', 'restaurante'])
    it(`${app}: el perfil «pruebas» tiene autoIncrement`, () => {
      const eas = JSON.parse(
        readFileSync(join(__dirname, '..', '..', app, 'eas.json'), 'utf8'),
      ) as { build: Record<string, { autoIncrement?: boolean }> };
      expect(eas.build.pruebas?.autoIncrement).toBe(true);
      expect(eas.build['pruebas-tienda']?.autoIncrement).toBe(true);
    });
});
