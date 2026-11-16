/**
 * C-FAVORITOS-SIN-CARRERA (16 nov 2026): la lista de favoritos que llega del servidor al abrir la
 * pantalla NO pisa lo que la persona tocó mientras cargaba. Pasó en la verificación del 16 nov: la
 * lista tardó 146 ms, el toque en el corazón salió antes de que llegara y, al llegar, el corazón
 * volvió a vacío aunque el servidor ya lo había guardado. Con internet lento le pasa a cualquiera.
 *
 * `cambios` guarda lo último que la persona decidió por restaurante (true = favorito) desde que se
 * abrió la pantalla; se aplica encima de lo que diga el servidor.
 */
export function mezclarFavoritos(
  delServidor: Iterable<string>,
  cambios: ReadonlyMap<string, boolean>,
): Set<string> {
  const ids = new Set(delServidor);
  for (const [id, poner] of cambios) {
    if (poner) ids.add(id);
    else ids.delete(id);
  }
  return ids;
}
