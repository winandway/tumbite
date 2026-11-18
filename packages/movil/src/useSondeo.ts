import { useEffect } from 'react';
import { AppState } from 'react-native';
import { crearSondeo, reanudarSondeos } from '@tumbite/compartido';

/**
 * C-SESION-TERMINADA (18 nov 2026) — todos los países. El sondeo de una pantalla (estado, ofertas,
 * viaje en curso, chat, soporte): pregunta al montar y después cada `cadaMs`; si falla (lanza o
 * devuelve `false`), espera el doble por cada fallo seguido, hasta su tope. Al volver la app al
 * primer plano o la red, pregunta YA (motor `crearSondeo` en @tumbite/compartido). Nunca se
 * superponen dos vueltas y se corta al desmontar (o con `activo` en false).
 *
 * Uso: `useSondeo(cargar, 5_000)`; lo que no puede llegar tarde (ofertas, estado del conductor,
 * viaje, seguimiento) pasa `{ topeMs: ESPERA_MAXIMA_CRITICA_MS }`.
 */
export function useSondeo(
  fn: () => Promise<unknown> | unknown,
  cadaMs: number,
  activo = true,
  /** Sin la vuelta inmediata al montar (la pantalla ya cargó por su lado). */
  primeraYa = true,
  opciones: { topeMs?: number } = {},
) {
  const { topeMs } = opciones;
  useEffect(() => {
    if (!activo) return;
    const s = crearSondeo({ fn, cadaMs, topeMs, primeraYa });
    return () => s.detener();
  }, [fn, cadaMs, activo, primeraYa, topeMs]);
}

// Al volver la app al primer plano, todos los sondeos que fallaban preguntan ya (una sola escucha
// para toda la app).
let escuchando = false;
export function escucharVueltaDeLaApp() {
  if (escuchando) return;
  escuchando = true;
  AppState.addEventListener('change', (e) => {
    if (e === 'active') reanudarSondeos();
  });
}
escucharVueltaDeLaApp();
