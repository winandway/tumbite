/**
 * El reloj de la PRUEBA (no el del sistema que se prueba): cuánto lleva cada paso y las esperas
 * con tope. En las pruebas del propio núcleo se usa el reloj falso, que avanza sin dormir.
 * Adelantar el reloj del sistema (vencer una oferta, dar por perdido a un repartidor) es cosa de
 * cada paquete: depende de cómo guarde las horas su servidor.
 */
export type Reloj = {
  ahora(): number;
  dormir(ms: number): Promise<void>;
};

export const relojReal: Reloj = {
  ahora: () => Date.now(),
  dormir: (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms))),
};

export type RelojFalso = Reloj & { avanzar(ms: number): void };

export function relojFalso(inicio = 0): RelojFalso {
  let t = inicio;
  return {
    ahora: () => t,
    dormir: async (ms) => {
      t += Math.max(0, ms);
    },
    avanzar: (ms) => {
      t += ms;
    },
  };
}

/** Una espera que se acabó sin ver lo que esperaba: dice qué esperaba y qué vio la última vez. */
export class ErrorEspera extends Error {
  readonly que: string;
  readonly ultimo: unknown;
  constructor(que: string, ultimo: unknown, topeMs: number) {
    super(
      `Esperé ${Math.round(topeMs / 1000)} s a que ${que} y no pasó. Lo último que vi: ${resumir(ultimo)}`,
    );
    this.name = 'ErrorEspera';
    this.que = que;
    this.ultimo = ultimo;
  }
}

export type OpcionesEspera = { topeMs?: number; cadaMs?: number };

/**
 * Pregunta cada `cadaMs` hasta que `intento` devuelva algo distinto de undefined, null o false, o
 * hasta el tope. Lo que devuelve el intento en las vueltas fallidas se guarda para el mensaje.
 * `intento` puede devolver { listo: false, visto } para dejar constancia de lo que vio.
 */
export async function esperarHasta<T>(
  reloj: Reloj,
  que: string,
  intento: () => Promise<T | undefined | null | false | { listo: false; visto: unknown }>,
  { topeMs = 60_000, cadaMs = 1_000 }: OpcionesEspera = {},
): Promise<T> {
  const inicio = reloj.ahora();
  let ultimo: unknown;
  for (;;) {
    const r = await intento();
    if (r && typeof r === 'object' && 'listo' in r && r.listo === false) ultimo = r.visto;
    else if (r !== undefined && r !== null && r !== false) return r as T;
    else ultimo = r;
    if (reloj.ahora() - inicio >= topeMs) throw new ErrorEspera(que, ultimo, topeMs);
    await reloj.dormir(cadaMs);
  }
}

export function resumir(x: unknown, max = 400): string {
  let s: string;
  try {
    s = typeof x === 'string' ? x : JSON.stringify(x);
  } catch {
    s = String(x);
  }
  if (s === undefined) s = 'nada';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
