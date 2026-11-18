/**
 * C-REGISTRO-ERRORES (18 nov 2026): el mensaje general del formulario de entrar y crear cuenta.
 * Sale cuando el error no trae campo O cuando su campo no tiene casilla en pantalla (por ejemplo,
 * la fecha de nacimiento en un país que no la pide): ningún error del servidor queda escondido.
 */
export function mensajeSinCasilla(
  error: { mensaje: string; campo?: string } | null,
  casillasVisibles: readonly string[],
): string | null {
  if (!error) return null;
  if (error.campo && casillasVisibles.includes(error.campo)) return null;
  return error.mensaje;
}
