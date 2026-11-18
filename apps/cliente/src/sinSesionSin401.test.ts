import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-SIN-SESION-SIN-401 (robot de Android, 18 nov 2026): un visitante sin sesión disparaba
 * GET /datos/mis-avisos y GET /datos/favoritos, que respondían 401. Sin sesión no se piden.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, r), 'utf8');

describe('sin sesión no se piden avisos ni favoritos', () => {
  it('useAvisos exige decir si hay sesión, y no pide sin ella', () => {
    const s = leer('inicio/useAvisos.ts');
    expect(s).toMatch(/conSesion: boolean/);
    expect(s).not.toMatch(/activo = true/);
    for (const r of ['Inicio.tsx', 'app/notifications.tsx'])
      expect(leer(r)).toMatch(/useAvisos\([^)]*Boolean\(usuario\)\)/);
  });
  it('las pantallas de favoritos solo piden con sesión', () => {
    const fav = leer('app/favorites.tsx');
    const i = fav.indexOf("'/datos/favoritos'");
    expect(fav.slice(Math.max(0, i - 400), i)).toContain('if (!conSesion) return;');
    expect(leer('app/restaurants.tsx')).toMatch(
      /if \(!usuario\) return;[\s\S]{0,200}'\/datos\/favoritos'/,
    );
    expect(leer('inicio/useFavoritos.ts')).toMatch(/if \(!conSesion\) return;/);
  });
});
