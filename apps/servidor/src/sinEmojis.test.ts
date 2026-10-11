import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-SIN-EMOJIS: el producto usa íconos de línea, nunca emojis (Richard, 10 oct 2026:
 * «pareciera una página de payasos»). Solo se permiten las banderas del selector y dos signos tipográficos.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const CARPETAS = [
  'apps/panel/src',
  'packages/movil/src',
  'apps/cliente/src',
  'apps/repartidor/src',
  'apps/restaurante/src',
];
// Banderas del selector de idioma y signos tipográficos (★ de calificar, ✓ de elegido).
const PERMITIDOS = new Set(['★', '✓']);
const RANGOS: [number, number][] = [
  [0x1f300, 0x1faff],
  [0x2600, 0x27bf],
  [0x2b50, 0x2b50],
  [0x23f0, 0x23ff],
  [0x25b6, 0x25b6],
  [0xf8ff, 0xf8ff],
];

function tieneEmoji(linea: string): boolean {
  for (const c of linea) {
    if (PERMITIDOS.has(c)) continue;
    const n = c.codePointAt(0) ?? 0;
    if (RANGOS.some(([a, b]) => n >= a && n <= b)) return true;
  }
  return false;
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(n) && !n.includes('.test.') ? [ruta] : [];
  });
}

describe('sin emojis en el producto', () => {
  it('ninguna pantalla usa emojis como ícono', () => {
    const culpables: string[] = [];
    for (const c of CARPETAS) {
      for (const f of archivos(join(RAIZ, c))) {
        readFileSync(f, 'utf8')
          .split('\n')
          .forEach((linea, i) => {
            if (tieneEmoji(linea)) culpables.push(`${f}:${i + 1}`);
          });
      }
    }
    expect(culpables).toEqual([]);
  });
});
