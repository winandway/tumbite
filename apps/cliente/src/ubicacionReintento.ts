/**
 * C-UBICACION-SIN-BUCLE (18 nov 2026, robot de Android) — todos los países. Sin GPS, la app pedía la
 * ubicación unas 23 veces cada 10 segundos: cada pedido abría la pantalla del permiso de Android
 * (aunque ya estuviera dado), la app pasaba a segundo plano y al volver («active») lo pedía otra vez.
 * Las pantallas del permiso se apilaban invisibles encima de la app y se tragaban los toques
 * («Cancelar el viaje» sacaba al lanzador; los botones del mapa no respondían).
 *
 * Reglas (lógica pura, se prueba en node):
 * - el permiso se PIDE solo si no está dado y la app está en primer plano; si ya está dado, nunca
 *   se abre la pantalla del permiso;
 * - si el teléfono no da la ubicación, los intentos automáticos esperan cada vez más (5 s, 10 s,
 *   20 s… hasta 5 minutos); un toque de la persona («Usar mi ubicación») sí intenta enseguida.
 */
export const PRIMERA_ESPERA_MS = 5_000;
export const ESPERA_MAXIMA_MS = 5 * 60_000;

export type EstadoReintento = { fallos: number; proximo: number };
export const SIN_FALLOS: EstadoReintento = { fallos: 0, proximo: 0 };

/** ¿Se puede intentar leer la ubicación ahora? Un toque de la persona siempre puede. */
export function puedeIntentar(e: EstadoReintento, ahora: number, aMano = false): boolean {
  return aMano || ahora >= e.proximo;
}

/** Después de un intento: con éxito se olvida todo; con fallo, la espera se duplica hasta el tope. */
export function despuesDeIntentar(e: EstadoReintento, ok: boolean, ahora: number): EstadoReintento {
  if (ok) return SIN_FALLOS;
  const fallos = e.fallos + 1;
  const espera = Math.min(ESPERA_MAXIMA_MS, PRIMERA_ESPERA_MS * 2 ** (fallos - 1));
  return { fallos, proximo: ahora + espera };
}

/** ¿Se abre la pantalla del permiso? Solo si falta, se puede preguntar y la app está a la vista. */
export function debePedirPermiso(p: {
  concedido: boolean;
  sePuedePreguntar: boolean;
  appActiva: boolean;
}): boolean {
  return !p.concedido && p.sePuedePreguntar && p.appActiva;
}
