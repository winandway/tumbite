import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-SIN-DATOS-REALES (14 nov 2026, todos los países): los ejemplos de las casillas son formatos
 * neutros, nunca algo que parezca un dato real ni una ciudad (nada de «100 Main St» ni celulares de
 * Miami con el código 305).
 */
describe('C-SIN-DATOS-REALES', () => {
  it('ninguna pantalla trae un ejemplo con el código 305 ni una calle inventada', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const carpetas = [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'apps/panel/src',
      'packages/movil/src',
      'packages/compartido/src',
    ];
    const malos: string[] = [];
    const recorrer = (d: string) => {
      for (const n of readdirSync(d)) {
        const r = join(d, n);
        if (statSync(r).isDirectory()) recorrer(r);
        else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) {
          const s = readFileSync(r, 'utf8');
          if (/\(305\) ?\d{3}-\d{4}|305\d{7}|\b\d+ Main St\b/.test(s)) malos.push(r);
        }
      }
    };
    for (const c of carpetas) recorrer(join(raiz, c));
    expect(malos).toEqual([]);
  });
});
