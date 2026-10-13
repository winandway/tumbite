import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { correoEjemplo } from '@tumbite/compartido';

/**
 * Candado C-INGLES-PRINCIPAL: en inglés, ninguna casilla muestra «correo@ejemplo.com». El correo
 * de muestra sale siempre de correoEjemplo(idioma); nadie lo escribe a mano.
 */
const raiz = join(__dirname, '..', '..', '..');
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n === 'dist') return [];
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe('correo de muestra en el idioma de la persona', () => {
  it('en inglés es email@example.com', () => {
    expect(correoEjemplo('en')).toBe('email@example.com');
    expect(correoEjemplo('es')).toBe('correo@ejemplo.com');
  });
  it('ningún formulario lo escribe a mano en español', () => {
    const malos = [
      'apps/panel/src',
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]
      .flatMap((d) => archivos(join(raiz, d)))
      .filter((f) => readFileSync(f, 'utf8').includes('correo@ejemplo.com'));
    expect(malos).toEqual([]);
  });
});
