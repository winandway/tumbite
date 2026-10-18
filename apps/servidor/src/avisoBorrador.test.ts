import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-BORRADOR-EMPEZAR (13 oct 2026): todo aviso de «Recuperamos lo que estabas
 * escribiendo» lleva «Empezar de nuevo» (regla de los formularios). En las apps se usa siempre
 * AvisoBorrador de @tumbite/movil; en el panel, AvisoBorrador o el botón que llama a
 * empezarDeNuevo.
 */
const raiz = join(__dirname, '..', '..', '..');
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n === 'dist') return [];
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe('aviso de borrador recuperado', () => {
  it('donde se avisa que se recuperó lo escrito, también se ofrece empezar de nuevo', () => {
    const malos = [
      'apps/panel/src',
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]
      .flatMap((d) => archivos(join(raiz, d)))
      .filter((f) => {
        const s = readFileSync(f, 'utf8');
        if (!/b\.recuperado/.test(s) || f.endsWith('AvisoBorrador.tsx')) return false;
        return !/<AvisoBorrador/.test(s) && !/empezarDeNuevo|b\.limpiar/.test(s);
      });
    expect(malos).toEqual([]);
  });

  it('«Empezar de nuevo» es un botón de verdad (Pressable), no un texto anidado con onPress', () => {
    // En el iPhone un Text anidado con onPress no respondía al toque (18 oct 2026).
    const s = readFileSync(join(raiz, 'packages/movil/src/AvisoBorrador.tsx'), 'utf8');
    expect(s).toMatch(/<Pressable[\s\S]*onPress=\{\(\) => void empezar\(\)\}/);
    expect(s).not.toMatch(/<Text[^>]*onPress=/);
  });
});
