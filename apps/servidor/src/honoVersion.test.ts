import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Candado C-HONO-SEGURIDAD: las versiones de hono anteriores a 4.13.18 dejaban
// saltar middleware comodín (sesiones y permisos de /datos/*) y validaciones.
// Si alguien baja la versión (rollback, lockfile viejo), esta prueba se pone en rojo.
const MINIMA = [4, 13, 18] as const;

function versionInstalada(): number[] {
  const requerir = createRequire(import.meta.url);
  // hono no exporta su package.json: se sube desde la entrada principal.
  let dir = dirname(requerir.resolve('hono'));
  while (!existsSync(join(dir, 'package.json')) || !dir.endsWith('hono')) {
    const arriba = dirname(dir);
    if (arriba === dir) throw new Error('No se encontró el package.json de hono');
    dir = arriba;
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string };
  return pkg.version.split('-')[0]!.split('.').map(Number);
}

function alMenos(v: number[], min: readonly number[]): boolean {
  for (let i = 0; i < min.length; i++) {
    const a = v[i] ?? 0;
    const b = min[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

describe('hono con los arreglos de seguridad', () => {
  it('la versión instalada es 4.13.18 o mayor', () => {
    expect(alMenos(versionInstalada(), MINIMA)).toBe(true);
  });

  it('la comparación rechaza las versiones vulnerables', () => {
    expect(alMenos([4, 13, 15], MINIMA)).toBe(false);
    expect(alMenos([4, 13, 17], MINIMA)).toBe(false);
    expect(alMenos([4, 13, 18], MINIMA)).toBe(true);
    expect(alMenos([4, 14, 0], MINIMA)).toBe(true);
  });
});
