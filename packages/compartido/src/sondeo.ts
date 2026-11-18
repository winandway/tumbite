/**
 * C-SESION-TERMINADA (18 nov 2026) — todos los países. Cuánto espera un sondeo (estado, ofertas,
 * viaje en curso, chat, soporte) antes de volver a preguntar: su intervalo si la última vez salió
 * bien; si falló, el doble por cada fallo seguido, hasta un tope. Así, con el servidor caído o la
 * sesión vencida, el teléfono no pregunta sin pausa (batería, datos y la app colgada).
 */
export const ESPERA_MAXIMA_SONDEO_MS = 2 * 60_000;
/** Lo que no puede llegar tarde (ofertas, estado del conductor, viaje, seguimiento): tope corto. */
export const ESPERA_MAXIMA_CRITICA_MS = 20_000;

export function esperaSondeo(
  cadaMs: number,
  fallosSeguidos: number,
  topeMs = ESPERA_MAXIMA_SONDEO_MS,
): number {
  if (fallosSeguidos <= 0) return cadaMs;
  const tope = Math.max(cadaMs, topeMs);
  return Math.min(tope, cadaMs * 2 ** Math.min(fallosSeguidos, 20));
}

export type OpcionesSondeo = {
  /** La vuelta: falla si lanza o devuelve `false`. */
  fn: () => Promise<unknown> | unknown;
  cadaMs: number;
  /** Tope de la espera con fallos (por defecto 2 min; lo crítico, 20 s). */
  topeMs?: number;
  /** Pregunta al arrancar (por defecto) o espera la primera vuelta. */
  primeraYa?: boolean;
};

export type Sondeo = {
  /** Vuelve a preguntar ya, con los fallos en cero (al volver la app o la red, al reintentar). */
  ya: () => void;
  detener: () => void;
  /** Fallos seguidos (para pruebas y diagnóstico). */
  fallos: () => number;
};

const activos = new Set<Sondeo>();

/**
 * Todos los sondeos vivos vuelven a preguntar YA con los fallos en cero: al volver la app al
 * primer plano, al volver la red (un sondeo que falló y vuelve a salir bien avisa a los demás) o al
 * tocar «Reintentar». Así, tras un rato sin señal, la oferta o el conductor se ven enseguida y no
 * después de la espera larga.
 */
export function reanudarSondeos() {
  for (const s of activos) if (s.fallos() > 0) s.ya();
}

/** El motor del sondeo, sin React (se prueba con relojes de mentira). Nunca se superponen vueltas. */
export function crearSondeo(op: OpcionesSondeo): Sondeo {
  let vivo = true;
  let fallos = 0;
  let corriendo = false;
  let repetir = false;
  let reloj: ReturnType<typeof setTimeout> | null = null;
  const programar = (ms: number) => {
    if (reloj) clearTimeout(reloj);
    reloj = setTimeout(() => void vuelta(), ms);
  };
  const vuelta = async () => {
    if (!vivo) return;
    if (corriendo) {
      repetir = true;
      return;
    }
    corriendo = true;
    reloj = null;
    let ok: boolean;
    try {
      ok = (await op.fn()) !== false;
    } catch {
      ok = false;
    }
    corriendo = false;
    if (!vivo) return;
    const habiaFallos = fallos > 0;
    fallos = ok ? 0 : fallos + 1;
    if (repetir) {
      repetir = false;
      programar(0);
    } else programar(esperaSondeo(op.cadaMs, fallos, op.topeMs));
    // La red volvió: los demás sondeos que esperaban también preguntan ya.
    if (ok && habiaFallos) reanudarSondeos();
  };
  const s: Sondeo = {
    ya: () => {
      if (!vivo) return;
      fallos = 0;
      programar(0);
    },
    detener: () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
      activos.delete(s);
    },
    fallos: () => fallos,
  };
  activos.add(s);
  programar(op.primeraYa === false ? op.cadaMs : 0);
  return s;
}

/**
 * C-SESION-TERMINADA: varias peticiones pueden recibir el 401 a la vez (estado, ofertas, panel…);
 * la sesión se cierra UNA sola vez por llave. Devuelve la función que la API llama en cada 401.
 */
export function cierreUnico(cerrar: (tokenUsado: string) => void): (tokenUsado: string) => void {
  const cerradas = new Set<string>();
  return (tokenUsado) => {
    if (cerradas.has(tokenUsado)) return;
    cerradas.add(tokenUsado);
    cerrar(tokenUsado);
  };
}
