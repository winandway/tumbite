import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-LINEAS-TAXI (19 nov 2026): «Registra tu línea» pide los seis datos, no pierde lo escrito, lleva
 * Turnstile y existe en inglés (principal) y en español, con dirección en inglés (/register-line).
 */
describe('Registra tu línea', () => {
  const s = readFileSync(join(import.meta.dirname, 'RegistraLinea.tsx'), 'utf8');
  it('pide nombre, ciudad, tipo, cuántos conductores, líder y segundo contacto', () => {
    for (const c of [
      'nombre',
      'zonaId',
      'tipo',
      'conductores',
      'liderNombre',
      'liderTelefono',
      'contacto2Nombre',
      'contacto2Telefono',
    ])
      expect(s, c).toContain(`'${c}'`);
  });
  it('guarda lo escrito, lleva Turnstile y se vacía solo con la confirmación', () => {
    expect(s).toMatch(/useBorrador\(\{/);
    expect(s).toMatch(/<Turnstile/);
    expect(s).toMatch(/await b\.limpiar\(\);\s*setEstado/);
  });
  it('está en los dos idiomas y la dirección es en inglés', () => {
    expect(s).toMatch(/titulo: 'Registra tu línea'/);
    expect(s).toMatch(/titulo: 'Register your line'/);
    const app = readFileSync(join(import.meta.dirname, '..', 'App.tsx'), 'utf8');
    expect(app).toMatch(/ruta === '\/register-line'/);
    expect(app).not.toMatch(/registra-tu-linea|\/linea/);
  });
});
