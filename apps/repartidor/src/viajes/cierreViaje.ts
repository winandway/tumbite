/**
 * C-CIERRE-VIAJE-QUEDA (paquete 13, 19 nov 2026) — todos los países. Qué viaje pinta el inicio:
 * el que el servidor da en curso o, si el conductor está en la pantalla de cierre («Viaje terminado»
 * o «Envío entregado», con el cobro y la calificación), ese mismo hasta que toque «Listo», aunque el
 * sondeo ya diga que no hay viaje. Un viaje nuevo (otra oferta aceptada) manda sobre el que se cierra.
 */
export function viajeEnPantalla<V extends { id: string }>(
  enCurso: V | null,
  enCierre: V | null,
): V | null {
  if (enCurso && (!enCierre || enCurso.id !== enCierre.id)) return enCurso;
  return enCierre ?? enCurso;
}
