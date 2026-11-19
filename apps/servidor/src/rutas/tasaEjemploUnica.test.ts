import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-TASA-CORDURA (19 nov 2026): ningún guion ni recorrido escribe una tasa del bolívar inventada.
 * Lo que pasó: un guion de capturas dejó 240 por dólar como «tasa del día» en el sitio de pruebas (y
 * otro 250), con la oficial en 917,78, y eso vieron las apps de prueba. La única tasa de ejemplo es
 * la de `tasaEjemplo` (una oficial creíble) y entra como fila «bcv».
 */
const RAIZ = join(import.meta.dirname, '..', '..', '..', '..');

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((n) => {
    const ruta = join(carpeta, n);
    if (statSync(ruta).isDirectory()) return n === 'node_modules' ? [] : archivos(ruta);
    return /\.(mjs|ts|tsx|js)$/.test(n) ? [ruta] : [];
  });
}

describe('C-TASA-CORDURA: una sola tasa de ejemplo en guiones y recorridos', () => {
  const guiones = [...archivos(join(RAIZ, 'scripts')), ...archivos(join(RAIZ, 'e2e'))].filter(
    (f) => !/tasaEjemplo\.(mjs|ts)$/.test(f),
  );

  it('ninguno escribe la tasa del equipo, cambia el modo ni inserta una tasa con un número suelto', () => {
    const malos: string[] = [];
    for (const f of guiones) {
      const s = readFileSync(f, 'utf8');
      if (
        /['"`]PUT['"`],\s*['"`]\/datos\/admin\/tasas-referencia/.test(s) ||
        /\.put\(\s*[`'"]\/datos\/admin\/tasas-referencia/.test(s) ||
        /INSERT[^;`'"]*INTO tasas_modo/i.test(s) ||
        /INTO tasas_cambio[^`'"]*VALUES[^`'"]*\d\s*\)/i.test(s)
      )
        malos.push(f.replace(RAIZ, ''));
    }
    expect(malos).toEqual([]);
  });

  it('la tasa de ejemplo es la misma en los dos archivos y es creíble', () => {
    const numero = (f: string) =>
      Number(/TASA_EJEMPLO = ([\d.]+);/.exec(readFileSync(join(RAIZ, f), 'utf8'))?.[1]);
    const a = numero('scripts/recorrido/tasaEjemplo.mjs');
    expect(a).toBe(numero('e2e/recorrido/tasaEjemplo.ts'));
    // Entre 500 y 5 000 bolívares por dólar: si la moneda cambia de escala, se actualiza aquí a
    // propósito, no en cada guion.
    expect(a).toBeGreaterThan(500);
    expect(a).toBeLessThan(5_000);
  });
});
