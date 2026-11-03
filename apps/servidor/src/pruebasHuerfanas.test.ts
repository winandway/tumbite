import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PRUEBAS-SIN-HUERFANAS (ETP-3x, 3 nov 2026): toda prueba del repositorio la corre algún bloque
 * de `vitest.config.mts`. Pasó que `apps/panel/src/panel/detalleConciliacion.test.ts` nunca corría
 * en `npm run verify` porque el bloque del panel solo incluía `*.test.tsx`. Todos los países.
 */
const RAIZ = join(__dirname, '..', '..', '..');

describe('ninguna prueba queda fuera de la verificación', () => {
  it('cada *.test.ts(x) del repositorio cae en el include de un bloque de vitest', () => {
    const archivos = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], {
      cwd: RAIZ,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    // Los `include` de cada bloque (`projects`), leídos del archivo tal como lo usa `npm run verify`.
    const proyectos = readFileSync(join(RAIZ, 'vitest.config.mts'), 'utf8').split('coverage:')[0]!;
    const patrones = [...proyectos.matchAll(/include: \[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!),
    );
    expect(patrones.length).toBeGreaterThan(0);
    const huerfanas = archivos.filter((a) => !patrones.some((g) => matchesGlob(a, g)));
    expect(huerfanas).toEqual([]);
    expect(archivos).toContain('apps/panel/src/panel/detalleConciliacion.test.ts');
  });
});
