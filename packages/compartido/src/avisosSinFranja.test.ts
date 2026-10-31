import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Repaso en el emulador de Android (31 oct 2026): el aviso «Recuperamos lo que estabas escribiendo»
 * llevaba una franja gruesa roja al costado (prohibida por la regla de diseño de Richard) y el error
 * del correo seguía en rojo después de corregirlo.
 */
const movil = join(__dirname, '..', '..', 'movil', 'src');
const ui = readFileSync(join(movil, 'ui.tsx'), 'utf8');
const acceso = readFileSync(join(movil, 'Acceso.tsx'), 'utf8');

describe('avisos y errores de las apps', () => {
  it('los avisos no llevan franja gruesa al costado', () => {
    expect(ui).not.toMatch(/borderLeftWidth:\s*[2-9]/);
  });
  it('el error de una casilla se borra al corregirla', () => {
    expect(acceso).toContain('setError((e) => (e?.campo === campo ? null : e))');
    expect(acceso).not.toMatch(/onChangeText=\{\(x\) => b\.cambiar\(/);
  });
});
