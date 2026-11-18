/**
 * C-SESION-TERMINADA (18 nov 2026) — todos los países. Cuánto espera un sondeo (estado, ofertas,
 * viaje en curso, chat, soporte) antes de volver a preguntar: su intervalo si la última vez salió
 * bien; si falló, el doble por cada fallo seguido, hasta un tope. Así, con el servidor caído o la
 * sesión vencida, el teléfono no pregunta sin pausa (batería, datos y la app colgada).
 */
export const ESPERA_MAXIMA_SONDEO_MS = 2 * 60_000;

export function esperaSondeo(cadaMs: number, fallosSeguidos: number): number {
  if (fallosSeguidos <= 0) return cadaMs;
  const tope = Math.max(cadaMs, ESPERA_MAXIMA_SONDEO_MS);
  return Math.min(tope, cadaMs * 2 ** Math.min(fallosSeguidos, 20));
}
