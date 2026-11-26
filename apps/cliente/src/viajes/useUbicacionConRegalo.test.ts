import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-REGALO-VIAJE-REAL (19 nov 2026): la app del pasajero manda su ubicación SOLO en un viaje con
 * regalo que está en curso, sin abrir la pregunta del permiso y sin frenar nada si falla.
 */
describe('la ubicación del pasajero en un viaje con regalo', () => {
  const s = readFileSync(join(import.meta.dirname, 'useUbicacionConRegalo.ts'), 'utf8');
  const pantalla = readFileSync(join(import.meta.dirname, '..', 'app', 'ride.tsx'), 'utf8');
  it('solo con regalo y con el viaje en curso', () => {
    // C-SALDO-CLIENTE: también con el viaje pagado con Saldo Divoox (mismas protecciones).
    expect(s).toMatch(
      /\(Boolean\(viaje\?\.regalo\) \|\| \(viaje\?\.saldoDivoox \?\? 0\) > 0\) && viaje\?\.estado === 'en_curso'/,
    );
    expect(s).toMatch(/if \(!id \|\| !activo\) return;/);
  });
  it('nunca abre la pregunta del permiso ni muestra un error', () => {
    expect(s).toMatch(/lecturaSiHayPermiso\(\)/);
    // Con su precisión: el servidor descarta las lecturas malas.
    expect(s).toMatch(/precision: p\.precision/);
    expect(s).not.toMatch(/miUbicacion\(/);
    expect(s).toMatch(/\.catch\(/);
  });
  it('la pantalla del viaje la usa', () => {
    expect(pantalla).toMatch(/useUbicacionConRegalo\(api, viaje\)/);
  });
});
