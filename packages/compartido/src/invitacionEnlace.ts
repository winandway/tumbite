/**
 * C-INVITAR-LIDER-UN-PASO (21 nov 2026): el token del enlace personal de un líder invitado, en la
 * dirección con que se abre Driver (`…/driver/?invitacion=<token>` en la web, o el mismo parámetro en
 * el enlace de la app). null si no hay o no tiene la forma de un token.
 */
export function tokenDeEnlace(url: string | null): string | null {
  if (!url) return null;
  const m = /[?&]invitacion=([A-Za-z0-9_-]{16,64})(?:&|#|$)/.exec(url);
  return m?.[1] ?? null;
}
