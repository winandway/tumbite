/**
 * C-PAGO-MOVIL-CORREGIR (13 nov 2026, Venezuela): la regla única de «sí me llegó / no me llegó» del
 * pago móvil, la misma para los viajes (`viajes_pago_movil`) y para la comida
 * (`pedidos_pago_movil`). Quien cobra confirma a mano (nunca «verificado por el banco»); un «no me
 * llegó» puesto por error se corrige a «sí me llegó» UNA vez y dentro de un plazo corto. Después de
 * eso, o en el otro sentido, lo cambia solo soporte.
 */
export const MINUTOS_CORREGIR_PAGO_MOVIL = 30;

export type EstadoPagoMovil = 'recibido' | 'no_recibido';

/** Lo que ya había guardado (con `a_tiempo` calculado por la base con el plazo de arriba). */
export type PagoMovilGuardado = {
  estado: string;
  corregido_en: string | null;
  a_tiempo: number;
};

/**
 * Qué hacer con una segunda confirmación: `igual` (doble toque, no es error), `corregir` (de «no me
 * llegó» a «sí me llegó», una vez y a tiempo) o `rechazar` (lo cambia soporte).
 */
export function decidirPagoMovil(
  ya: PagoMovilGuardado | null,
  recibido: boolean,
): 'igual' | 'corregir' | 'rechazar' {
  const pedido: EstadoPagoMovil = recibido ? 'recibido' : 'no_recibido';
  if (!ya || ya.estado === pedido) return 'igual';
  if (ya.estado === 'no_recibido' && recibido && !ya.corregido_en && ya.a_tiempo === 1)
    return 'corregir';
  return 'rechazar';
}

/** La columna `a_tiempo` para el SELECT de lo guardado. */
export const SQL_A_TIEMPO = `creado_en > datetime('now', '-${MINUTOS_CORREGIR_PAGO_MOVIL} minutes') AS a_tiempo`;
