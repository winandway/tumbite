import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CASILLA-SE-LEE (27 nov 2026, Tucaní). En «Tu moto» de Divoox Driver, Richard y el responsable de la
 * zona veían cinco casillas vacías sin nombre: el nombre era solo el texto de fondo y, sin color fijo,
 * Android lo pinta con el del tema del teléfono (casi blanco en los equipos con modo oscuro forzado).
 * Toda casilla de texto de las tres apps lleva `placeholderTextColor`.
 */
const RAIZ = join(import.meta.dirname, '..', '..', '..');
const CARPETAS = [
  'apps/repartidor/src',
  'apps/cliente/src',
  'apps/restaurante/src',
  'packages/movil/src',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) return n === 'node_modules' ? [] : archivos(r);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [r] : [];
  });
}

describe('C-CASILLA-SE-LEE: el texto de fondo de cada casilla tiene color fijo', () => {
  it('ninguna casilla de texto de las apps queda sin placeholderTextColor', () => {
    const sinColor: string[] = [];
    for (const f of CARPETAS.flatMap((c) => archivos(join(RAIZ, c)))) {
      const s = readFileSync(f, 'utf8');
      // Cada etiqueta de apertura <TextInput … /> o <TextInput …>.
      for (const m of s.matchAll(/<TextInput\b([\s\S]*?)\n\s*\/?>/g)) {
        const props = m[1] ?? '';
        if (!/placeholderTextColor=/.test(props) && !/\{\.\.\./.test(props))
          sinColor.push(`${f.slice(RAIZ.length + 1)}:${s.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(sinColor).toEqual([]);
  });
});
