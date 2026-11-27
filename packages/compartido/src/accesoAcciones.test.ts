import { describe, expect, it } from 'vitest';
import { accionDeError, textoAccionAcceso } from './accesoAcciones';

/**
 * C-MENSAJES-ACCESO (24 nov 2026, Richard) — todos los países: el botón que va debajo de cada error de
 * entrar, crear cuenta y recuperar, igual en la web y en las tres apps.
 */
describe('qué botón acompaña a cada error', () => {
  it('correo sin cuenta → «Crear cuenta» (al entrar y al recuperar)', () => {
    expect(accionDeError('correo_sin_cuenta', 'entrar')).toBe('crear');
    expect(accionDeError('correo_sin_cuenta', 'recuperar')).toBe('crear');
    expect(textoAccionAcceso('crear', 'es')).toBe('Crear cuenta');
    expect(textoAccionAcceso('crear', 'en')).toBe('Create account');
  });
  it('contraseña mala o cuenta pausada → «¿Olvidaste tu contraseña?»', () => {
    expect(accionDeError('clave_incorrecta', 'entrar')).toBe('olvide');
    expect(accionDeError('cuenta_bloqueada', 'entrar')).toBe('olvide');
    expect(textoAccionAcceso('olvide', 'es')).toBe('¿Olvidaste tu contraseña?');
    expect(textoAccionAcceso('olvide', 'en')).toBe('Forgot your password?');
  });
  it('al crear cuenta con un correo que ya la tiene → «Entrar»', () => {
    expect(accionDeError('correo_con_cuenta', 'registro')).toBe('entrar');
    expect(accionDeError('telefono_con_cuenta', 'registro')).toBe('entrar');
    expect(textoAccionAcceso('entrar', 'en')).toBe('Sign in');
  });
  it('lo demás (o un servidor viejo sin código) no pone botón', () => {
    expect(accionDeError(undefined, 'entrar')).toBeNull();
    expect(accionDeError('escudo', 'entrar')).toBeNull();
    expect(accionDeError('correo_sin_cuenta', 'registro')).toBeNull();
  });
});
