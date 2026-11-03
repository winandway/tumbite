import { ErrorStripe, type Stripe } from './stripe';
import { ErrorDatos } from './validar';

/**
 * C-DEVOLUCION-SIN-ID (LAN-1): pide un reembolso a Stripe y devuelve su id SOLO si Stripe lo
 * confirmó. Sin id, con error o sin respuesta, nada se escribe en la base: quien llama no guarda
 * fila ni mueve saldo. El reintento usa la MISMA clave y los MISMOS datos (Stripe exige ambos), así
 * que si Stripe ya lo había hecho devuelve ese mismo reembolso y nunca devuelve dos veces.
 */
export async function reembolsoConfirmado(
  stripe: Stripe,
  datos: { payment_intent: string; amount: number; metadata: Record<string, string> },
  clave: string,
): Promise<string> {
  let r: { id?: unknown };
  try {
    r = await stripe.post<{ id?: unknown }>('/refunds', datos, clave);
  } catch (e) {
    console.error('reembolso: Stripe no lo confirmó', clave, e);
    // Un 4xx que no sea de idempotencia es un «no» de Stripe (monto, cobro): se dice distinto.
    if (e instanceof ErrorStripe && e.estado >= 400 && e.estado < 500 && e.estado !== 409)
      throw new ErrorDatos(
        'Stripe no aceptó la devolución. Revisa el monto y el cobro en Stripe.',
        undefined,
        409,
      );
    throw new ErrorDatos(MENSAJE_SIN_CONFIRMAR, undefined, 503);
  }
  if (typeof r.id !== 'string' || !r.id) {
    console.error('reembolso: Stripe respondió sin id', clave);
    throw new ErrorDatos(MENSAJE_SIN_CONFIRMAR, undefined, 503);
  }
  return r.id;
}

export const MENSAJE_SIN_CONFIRMAR =
  'Stripe no confirmó la devolución. Intenta otra vez: el reintento nunca devuelve dos veces.';
