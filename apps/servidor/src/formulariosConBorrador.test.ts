import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-BORRADOR-TODOS: regla de Richard, ningún formulario pierde lo escrito.
 * Toda pantalla del panel que tenga un <form> usa useBorrador.
 */
const PANEL = join(__dirname, '..', '..', 'panel', 'src');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return n.endsWith('.tsx') && !n.includes('.test.') ? [ruta] : [];
  });
}

describe('todos los formularios guardan lo escrito', () => {
  it('cada <form> del panel usa useBorrador', () => {
    const sinBorrador = archivos(PANEL).filter((f) => {
      const codigo = readFileSync(f, 'utf8');
      return codigo.includes('<form') && !codigo.includes('useBorrador');
    });
    expect(sinBorrador).toEqual([]);
  });
});
