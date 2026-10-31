import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-UBICACION-AL-VOLVER (31 oct 2026): sin GPS al abrir, la lista de restaurantes quedaba en la
 * ciudad inicial hasta cerrar la app, y aun así decía «Cerca de tu ubicación».
 */
const src = join(__dirname, '..', '..', '..', 'apps', 'cliente', 'src');
const hook = readFileSync(join(src, 'comida', 'useRestaurantes.ts'), 'utf8');
const pantalla = readFileSync(join(src, 'app', 'restaurants.tsx'), 'utf8');

describe('ubicación del cliente', () => {
  it('al volver a la app se mira el GPS otra vez', () => {
    expect(hook).toContain("AppState.addEventListener('change'");
    expect(hook).toMatch(/e !== 'active'[\s\S]{0,80}ultimoGps = null/);
  });
  it('sin ubicación no dice «cerca de ti»', () => {
    expect(pantalla).toContain('catalogo.punto ? t.cercaDeTi : t.enTuZona');
  });
});
