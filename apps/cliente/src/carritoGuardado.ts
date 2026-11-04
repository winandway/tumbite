/**
 * C-CARRITO-INVITADO (4 nov 2026, Richard): reglas de dónde se guarda el carrito, sin React Native
 * (las prueba vitest). Sin cuenta no se guarda: vive mientras la app está abierta. Con cuenta, una
 * llave por cuenta.
 */
export const LLAVE_CARRITO_INVITADO = 'tumbite.carrito.anonimo';

/** Dónde se guarda el carrito de esta cuenta; `null` = sin cuenta, no se guarda. */
export function llaveCarrito(usuarioId: string | null | undefined): string | null {
  return usuarioId ? `tumbite.carrito.${usuarioId}` : null;
}

/** Al entrar: lo que eligió sin cuenta pasa a su cuenta; si no eligió nada, queda el guardado. */
export function carritoAlEntrar<T extends { lineas: unknown[] }>(
  delInvitado: T | null,
  guardado: T | null,
  vacio: T,
): T {
  if (delInvitado?.lineas.length) return delInvitado;
  return guardado ?? vacio;
}
