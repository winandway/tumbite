import { type CotizacionViaje, cuentaConSaldo } from '@tumbite/compartido';

/**
 * C-METODO-PAGO-PANTALLA y C-SALDO-CLIENTE (25 nov 2026): la decisión de la pantalla «Método de
 * pago», sin pantalla (la prueba la usa). La misma regla del servidor (`cuentaConSaldo`).
 */

/** ¿Este método se puede usar en este viaje? (sin dato del servidor: sí, como siempre). */
export const metodoDisponible = (cot: CotizacionViaje, m: string) =>
  new Map(Object.entries(cot.disponibles ?? {})).get(m) !== false;

/**
 * Lo que la pantalla decide con lo elegido: si el saldo se usa, cuánto, el resto en mano y qué se
 * manda al servidor. Pura (la prueba la usa) y la misma regla del servidor (`cuentaConSaldo`).
 */
export function decisionDePago(
  cot: CotizacionViaje,
  elegido: { metodo: string; usarSaldo: boolean; reserva: boolean },
) {
  const saldo = cot.saldoDivoox ?? null;
  const conSaldo = Boolean(saldo && saldo.disponible > 0 && elegido.usarSaldo && !elegido.reserva);
  const regalo = cot.regalo ?? null;
  const cuenta = cuentaConSaldo({
    total: cot.total,
    regalo: elegido.metodo === 'tarjeta' && !conSaldo ? null : regalo,
    saldoDisponible: saldo?.disponible ?? 0,
    usarSaldo: conSaldo,
  });
  const metodos = cot.metodosPago ?? ['efectivo', 'tarjeta'];
  const metodoValido =
    metodos.some((m) => m === elegido.metodo) && metodoDisponible(cot, elegido.metodo);
  return {
    conSaldo,
    ...cuenta,
    metodoValido,
    /** Falta elegir cómo pagar el resto (o lo elegido ya no se puede usar). */
    falta: !cuenta.cubreTodo && !metodoValido,
    cuerpo: {
      metodoPago: cuenta.cubreTodo ? 'saldo' : elegido.metodo,
      ...(conSaldo ? { usarSaldo: true } : {}),
    },
  };
}
