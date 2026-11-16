import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-APPS-DISENO: todas las pantallas de las tres apps usan la letra de Divoox (el Text de
// @tumbite/movil) y nada de morado. Si alguien importa Text de react-native, la pantalla sale con la
// letra del sistema y este candado se pone en rojo.
const RAIZ = join(__dirname, '..', '..', '..');
const CARPETAS = [
  'apps/cliente/src',
  'apps/repartidor/src',
  'apps/restaurante/src',
  'packages/movil/src',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [p] : [];
  });
}

const TODOS = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)));

describe('candado de diseño de las apps', () => {
  it('ninguna pantalla importa Text de react-native', () => {
    const malos = TODOS.filter((p) => !p.endsWith('diseno.tsx')).filter((p) => {
      const m = readFileSync(p, 'utf8').match(/import\s*\{([^}]*)\}\s*from\s*'react-native'/);
      return m
        ? m[1]!
            .split(',')
            .map((x) => x.trim())
            .includes('Text')
        : false;
    });
    expect(malos).toEqual([]);
  });

  it('nada de morado en las apps', () => {
    const malos = TODOS.filter((p) =>
      /#(7B2CBF|8E44AD|6A1B9A|9C27B0|7C3AED|8B5CF6|6D28D9)/i.test(readFileSync(p, 'utf8')),
    );
    expect(malos).toEqual([]);
  });

  it('cada app carga las fuentes de Divoox en su raíz', () => {
    for (const raiz of [
      'apps/cliente/src/app/_layout.tsx',
      'apps/repartidor/src/app/_layout.tsx',
      'apps/restaurante/src/app/_layout.tsx',
    ]) {
      expect(readFileSync(join(RAIZ, raiz), 'utf8'), raiz).toContain('useFuentesDivoox');
    }
  });
});
