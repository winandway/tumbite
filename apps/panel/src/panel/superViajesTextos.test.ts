import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-VIAJES-SIN-TEXTO-VIEJO (25 nov 2026) — todos los países. Moto y Carro ya trabajan en producción:
 * la pantalla de Viajes · Emergencias no puede decir que Moto existe solo en el sitio de pruebas.
 */
describe('Viajes · Emergencias sin el aviso viejo de Moto', () => {
  const fuente = readFileSync(join(__dirname, 'SuperViajes.tsx'), 'utf8');
  it('no dice que Moto vive solo en el sitio de pruebas, en español ni en inglés', () => {
    expect(fuente).not.toMatch(/solo en el sitio de pruebas/i);
    expect(fuente).not.toMatch(/only on the test site/i);
    expect(fuente).not.toMatch(/tarifas son de prueba|prices are test prices/i);
  });
});
