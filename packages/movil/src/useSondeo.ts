import { useEffect } from 'react';
import { esperaSondeo } from '@tumbite/compartido';

/**
 * C-SESION-TERMINADA (18 nov 2026) — todos los países. El sondeo de una pantalla (estado, ofertas,
 * viaje en curso, chat, soporte): pregunta al montar y después cada `cadaMs`; si falla (lanza o
 * devuelve `false`), espera el doble por cada fallo seguido, hasta un tope. Nunca se superponen dos
 * vueltas y se corta al desmontar (o con `activo` en false). Reemplaza a `setInterval` en la red.
 *
 * Uso: `useSondeo(cargar, 5_000)`; `cargar` se vuelve a armar cuando cambia (como el efecto de antes).
 */
export function useSondeo(
  fn: () => Promise<unknown> | unknown,
  cadaMs: number,
  activo = true,
  /** Sin la vuelta inmediata al montar (la pantalla ya cargó por su lado). */
  primeraYa = true,
) {
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let fallos = 0;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const vuelta = async () => {
      let ok: boolean;
      try {
        ok = (await fn()) !== false;
      } catch (e) {
        ok = false;
        console.warn('sondeo: falló', e);
      }
      if (!vivo) return;
      fallos = ok ? 0 : fallos + 1;
      reloj = setTimeout(() => void vuelta(), esperaSondeo(cadaMs, fallos));
    };
    reloj = setTimeout(() => void vuelta(), primeraYa ? 0 : cadaMs);
    return () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
    };
  }, [fn, cadaMs, activo, primeraYa]);
}
