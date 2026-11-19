/**
 * C-CIERRE-VIAJE-QUEDA (paquete 13, 19 nov 2026; segunda vuelta tras el revisor) — todos los países.
 * El cierre de un viaje o envío («Viaje terminado» / «Envío entregado»: el cobro en mano y la
 * calificación) vive en el INICIO, no dentro de `ViajeActivo`, para que sobreviva a que el sondeo
 * deje de ver el viaje y a que la pantalla se vuelva a montar.
 *
 * La secuencia:
 * 1. el conductor desliza el paso final → `empezarCierre` ANTES de mandar el paso al servidor (el
 *    inicio ya no suelta ese viaje aunque el sondeo traiga `null` antes de la respuesta);
 * 2. llega la respuesta → `cierreConRespuesta` (el cobro final del servidor) y se ve el cierre;
 * 3. si el paso falla → se suelta (`null`) y vuelve el viaje en curso, o el inicio si ya no hay;
 * 4. «Listo» → se suelta.
 * Un viaje NUEVO (otra oferta aceptada) manda sobre el que se cierra, y suelta el cierre.
 * Vive solo en memoria: si la app se reinicia, el conductor no queda atrapado.
 */
export type FinalViaje = 'terminado' | 'no_show';

export type CierreViaje<V, R = unknown> = {
  viaje: V;
  final: FinalViaje;
  /** `false` mientras el paso final va de camino al servidor. */
  respondido: boolean;
  respuesta: R | null;
  estrellas: number;
};

export function empezarCierre<V, R = unknown>(viaje: V, final: FinalViaje): CierreViaje<V, R> {
  return { viaje, final, respondido: false, respuesta: null, estrellas: 0 };
}

export function cierreConRespuesta<V, R>(c: CierreViaje<V, R>, respuesta: R): CierreViaje<V, R> {
  return { ...c, respondido: true, respuesta };
}

/** Qué viaje pinta el inicio: uno nuevo en curso manda; si no, el que se cierra; si no, el en curso. */
export function viajeEnPantalla<V extends { id: string }>(
  enCurso: V | null,
  enCierre: V | null,
): V | null {
  if (enCurso && (!enCierre || enCurso.id !== enCierre.id)) return enCurso;
  return enCierre ?? enCurso;
}

/** El cierre que sigue vigente con el viaje en curso de ahora (otro viaje lo suelta). */
export function cierreVigente<V extends { id: string }, R>(
  cierre: CierreViaje<V, R> | null,
  enCurso: V | null,
): CierreViaje<V, R> | null {
  if (!cierre) return null;
  if (enCurso && enCurso.id !== cierre.viaje.id) return null;
  return cierre;
}

export type PantallaViaje<V> =
  | { modo: 'activo'; viaje: V }
  | { modo: 'enviando'; viaje: V }
  | { modo: 'cierre'; viaje: V }
  | null;

/** Lo que ve el conductor en el inicio. */
export function pantallaViaje<V extends { id: string }, R>(
  enCurso: V | null,
  cierre: CierreViaje<V, R> | null,
): PantallaViaje<V> {
  const vigente = cierreVigente(cierre, enCurso);
  const viaje = viajeEnPantalla(enCurso, vigente?.viaje ?? null);
  if (!viaje) return null;
  if (vigente && vigente.viaje.id === viaje.id)
    return { modo: vigente.respondido ? 'cierre' : 'enviando', viaje };
  return { modo: 'activo', viaje };
}

/** Mientras se ve un cierre ya respondido (no un viaje en curso), las ofertas nuevas van encima. */
export function ofertasEncimaDelCierre<V extends { id: string }, R>(
  enCurso: V | null,
  cierre: CierreViaje<V, R> | null,
): boolean {
  return pantallaViaje(enCurso, cierre)?.modo === 'cierre';
}
