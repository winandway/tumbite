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
    // C-UBICACION-SIN-BUCLE (18 nov 2026): al volver se LEE el GPS otra vez (sin abrir la pantalla
    // del permiso, que en Android hacía un bucle) y se guarda como el último.
    expect(hook).toMatch(/e !== 'active'[\s\S]{0,300}ubicacionSiHayPermiso\(\)/);
    expect(hook).toMatch(/ubicacionSiHayPermiso\(\)[\s\S]{0,120}ultimoGps = \{ p: gps/);
  });
  it('sin ubicación no dice «cerca de ti»', () => {
    expect(pantalla).toContain('catalogo.punto ? t.cercaDeTi : t.enTuZona');
  });
});
