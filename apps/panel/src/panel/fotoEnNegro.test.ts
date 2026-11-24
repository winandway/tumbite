import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { esFotoEnNegro } from './fotoEnNegro';

/** C-CARA-EN-NEGRO (ensayo general, 24 nov 2026): una cara en negro no se aprueba. */
const lleno = (r: number, g: number, b: number, n = 1024) =>
  Array.from({ length: n * 4 }, (_, i) => [r, g, b, 255][i % 4]!);

describe('C-CARA-EN-NEGRO', () => {
  it('una foto negra (o casi) es «en negro»', () => {
    expect(esFotoEnNegro(lleno(0, 0, 0))).toBe(true);
    expect(esFotoEnNegro(lleno(8, 6, 7))).toBe(true);
  });

  it('una foto oscura con una cara (con contraste) o una foto normal no lo es', () => {
    const noche = lleno(10, 10, 10).map((v, i) => (i % 4 !== 3 && i % 64 < 24 ? 120 : v));
    expect(esFotoEnNegro(noche)).toBe(false);
    expect(esFotoEnNegro(lleno(150, 120, 100))).toBe(false);
    expect(esFotoEnNegro([])).toBe(false);
  });

  it('las dos formas de aprobar la identidad lo comprueban antes de aprobar', () => {
    const s = readFileSync(join(__dirname, 'SuperKycFicha.tsx'), 'utf8');
    const bloque = s.slice(s.indexOf('export async function aprobarIdentidad'));
    expect(bloque).toContain('caraEnNegro(id)');
    expect(bloque.indexOf('caraEnNegro(id)')).toBeLessThan(bloque.indexOf("pedir('PATCH'"));
    const decidir = s.slice(s.indexOf('async function decidir('));
    expect(decidir.slice(0, 900)).toContain('caraEnNegro(id)');
    expect(decidir.indexOf('caraEnNegro(id)')).toBeLessThan(decidir.indexOf("pedir('PATCH'"));
  });
});
