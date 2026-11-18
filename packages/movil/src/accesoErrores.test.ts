import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mensajeSinCasilla } from './accesoErrores';

/**
 * C-REGISTRO-ERRORES (18 nov 2026, robot de Android): con el código de invitación ZZZZ9999 el
 * servidor respondía el error del campo «invitacion», pero esa casilla no mostraba errores y el
 * mensaje general solo salía sin campo: la persona tocaba «Crear cuenta» y no pasaba nada.
 * Ahora cada casilla muestra su error y un error de un campo sin casilla sale como mensaje general.
 */
describe('ningún error del registro se queda sin mostrar', () => {
  const visibles = ['nombre', 'correo', 'telefono', 'invitacion', 'clave'];
  it('sin campo: mensaje general', () => {
    expect(mensajeSinCasilla({ mensaje: 'Algo falló' }, visibles)).toBe('Algo falló');
  });
  it('con campo de una casilla visible: lo muestra la casilla, no el general', () => {
    expect(
      mensajeSinCasilla({ mensaje: 'Código no válido', campo: 'invitacion' }, visibles),
    ).toBeNull();
  });
  it('con un campo que no tiene casilla en pantalla: mensaje general', () => {
    expect(
      mensajeSinCasilla({ mensaje: 'Falta tu cumpleaños', campo: 'fechaNacimiento' }, visibles),
    ).toBe('Falta tu cumpleaños');
    expect(mensajeSinCasilla({ mensaje: 'Rol', campo: 'rol' }, visibles)).toBe('Rol');
  });
  it('sin error: nada', () => {
    expect(mensajeSinCasilla(null, visibles)).toBeNull();
  });

  it('todas las casillas del registro llevan su error, también la de invitación', () => {
    const s = readFileSync(join(__dirname, 'Acceso.tsx'), 'utf8');
    const bloques = s
      .split('<Campo')
      .slice(1)
      .map((b) => b.slice(0, b.indexOf('/>')));
    expect(bloques.length).toBeGreaterThanOrEqual(5);
    for (const b of bloques) expect(b).toMatch(/error=\{errorDe\('/);
    expect(s).toContain("error={errorDe('invitacion')}");
    expect(s).toContain('mensajeSinCasilla(');
    expect(s).not.toContain('error && !error.campo ?');
  });
});
