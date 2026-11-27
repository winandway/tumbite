import type { Idioma } from './idiomas';

/**
 * C-MENSAJES-ACCESO (24 nov 2026, Richard) — todos los países. Qué botón va debajo del error al entrar,
 * crear cuenta o recuperar la contraseña, según el código que manda el servidor:
 * - correo sin cuenta → «Crear cuenta» (con el correo ya puesto);
 * - contraseña mala o cuenta pausada → «¿Olvidaste tu contraseña?»;
 * - al crear cuenta con un correo que ya la tiene → «Entrar».
 * Lo comparten la web y las tres apps. El texto del error lo pone el servidor (así las apps viejas
 * también dicen lo correcto); el botón es lo único que necesita app nueva.
 */
export type AccionAcceso = 'crear' | 'olvide' | 'entrar';

export function accionDeError(
  codigo: unknown,
  pantalla: 'entrar' | 'registro' | 'recuperar',
): AccionAcceso | null {
  if (codigo === 'correo_sin_cuenta' && pantalla !== 'registro') return 'crear';
  if ((codigo === 'clave_incorrecta' || codigo === 'cuenta_bloqueada') && pantalla === 'entrar')
    return 'olvide';
  // C-CUENTA-UNICA-CELULAR: el celular de una cuenta que ya existe también lleva a «Entrar».
  if (
    (codigo === 'correo_con_cuenta' || codigo === 'telefono_con_cuenta') &&
    pantalla === 'registro'
  )
    return 'entrar';
  return null;
}

const TEXTOS = new Map<string, string>([
  ['es:crear', 'Crear cuenta'],
  ['es:olvide', '¿Olvidaste tu contraseña?'],
  ['es:entrar', 'Entrar'],
  ['en:crear', 'Create account'],
  ['en:olvide', 'Forgot your password?'],
  ['en:entrar', 'Sign in'],
]);

/** El texto del botón de cada acción, en el idioma de la pantalla. */
export const textoAccionAcceso = (accion: AccionAcceso, idioma: Idioma): string =>
  TEXTOS.get(`${idioma === 'en' ? 'en' : 'es'}:${accion}`) ?? accion;
