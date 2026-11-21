// C-REVISION-EN-NOVI (21 nov 2026): las cuentas de revisión de las tiendas viven en Novi, Michigan,
// donde el equipo prueba. La siembra del restaurante de revisión ponía una dirección y un teléfono de
// Miami (y la cuenta de clientes tenía su «Home» allí, cambiada a mano en producción el mismo día).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(join(__dirname, 'rutas', 'superadmin.ts'), 'utf8');

describe('C-REVISION-EN-NOVI', () => {
  it('la siembra del restaurante de revisión no usa Miami ni un teléfono de Miami', () => {
    expect(fuente).not.toMatch(/Miami/);
    expect(fuente).not.toMatch(/\+1 305/);
    expect(fuente).toContain('27500 Novi Rd, Novi, MI 48377');
  });
});
