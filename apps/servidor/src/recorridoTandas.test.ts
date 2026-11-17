import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * C-RECORRIDO-TANDAS (16 nov 2026) — todos los países. El recorrido completo en un solo carril pasó
 * de su límite de 20 minutos tres veces seguidas y frenó la publicación (76 pruebas, ~15,5 min de
 * pruebas más la compilación). Ahora corre en tres tandas en paralelo, armadas por tiempo medido.
 * Candado: ninguna prueba se queda sin correr ni corre dos veces, cada tanda tiene su límite y su
 * aviso al 70 % con el mismo número, y el aviso sale justo al pasar ese umbral.
 */
const raiz = (f: string) => fileURLToPath(new URL(`../../../${f}`, import.meta.url).href);

type Tandas = {
  tanda: (n: number) => string[];
  archivosDeRecorrido: () => string[];
};
type ConTiempo = {
  UMBRAL: number;
  avisoDeTiempo: (nombre: string, segundos: number, limiteMin: number) => string | null;
};

describe('C-RECORRIDO-TANDAS', () => {
  it('las tres tandas cubren todas las pruebas del recorrido, cada una una sola vez', async () => {
    const t = (await import(raiz('scripts/recorrido/tandas.mjs'))) as Tandas;
    const todas = t.archivosDeRecorrido();
    expect(todas.length).toBeGreaterThan(30);
    const repartidas = [1, 2, 3].flatMap((n) => t.tanda(n));
    expect([...repartidas].sort()).toEqual(todas);
    expect(new Set(repartidas).size).toBe(repartidas.length);
    for (const n of [1, 2, 3]) expect(t.tanda(n).length, `tanda ${n}`).toBeGreaterThan(0);
  });

  it('la corrida tiene las tres tandas en paralelo, cada una con su aviso al 70 % de su límite', () => {
    const y = readFileSync(raiz('.github/workflows/verify.yml'), 'utf8');
    expect(y).toMatch(/recorrido:\n\s+runs-on: ubuntu-latest\n\s+strategy:/);
    expect(y).toMatch(/tanda: \[1, 2, 3\]/);
    expect(y).not.toMatch(/needs: verify/);
    const limite = /con-tiempo\.mjs (\d+) /.exec(y)?.[1];
    const corte =
      /npm run recorrido -- \$\(node scripts\/recorrido\/tandas\.mjs[^\n]*\n\s+timeout-minutes: (\d+)/.exec(
        y,
      )?.[1];
    expect(limite).toBeTruthy();
    expect(corte).toBe(limite);
    // El recorrido ya no corre entero en un solo carril.
    expect(y.match(/npm run recorrido/g)).toHaveLength(1);
  });

  it('avisa al pasar el 70 % del límite, y no antes', async () => {
    const c = (await import(raiz('scripts/recorrido/con-tiempo.mjs'))) as ConTiempo;
    expect(c.UMBRAL).toBe(0.7);
    expect(c.avisoDeTiempo('Recorrido, tanda 3', 14 * 60, 20)).toBeNull();
    const aviso = c.avisoDeTiempo('Recorrido, tanda 3', 14 * 60 + 30, 20);
    expect(aviso).toContain('Recorrido, tanda 3');
    expect(aviso).toContain('73 %');
  });
});
