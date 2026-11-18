/**
 * C-CUPON-DIVOOX (17 nov 2026): el regalo que paga Divoox, como lo ven las apps. El servidor lo
 * calcula y lo aparta; las apps solo lo muestran («Regalo de Divoox: −1,00 · Pagas en mano 0,32»).
 */
export type RegaloDivoox = {
  codigo: string;
  nombreEs: string;
  nombreEn: string;
  tipo: 'monto' | 'gratis';
  /** Lo que paga Divoox (unidad menor de la moneda). */
  monto: number;
  moneda: string;
  /** Regalo de bienvenida: se aplica solo en la primera operación, sin código. */
  bienvenida: boolean;
};

/** Lo que la persona paga en mano con el regalo aplicado (nunca menos de cero). */
export const pagaEnMano = (total: number, regalo: { monto: number } | null | undefined) =>
  Math.max(0, total - (regalo?.monto ?? 0));

/** C-PRECIO-CON-REGALO: el regalo de un viaje como lo manda el servidor al pasajero. */
export type RegaloDelViaje = {
  codigo: string;
  monto: number;
  nombreEs?: string;
  nombreEn?: string;
  /** El viaje no se hizo y el regalo volvió a la cuenta del pasajero. */
  devuelto?: boolean;
};

/**
 * C-PRECIO-CON-REGALO (18 nov 2026): cómo se muestra el precio de un viaje en TODAS sus pantallas
 * (buscando, en camino, terminado, cancelado, «Mis viajes», recibo), igual que la tarjeta del precio:
 * con regalo, el precio de siempre tachado y lo que se paga de verdad. `null` si no hay precio.
 */
export function precioConRegalo(
  total: number | null | undefined,
  regalo: { monto: number; devuelto?: boolean } | null | undefined,
) {
  if (total == null) return null;
  // Un viaje que no se hizo (cancelado, sin conductor) con el regalo devuelto a la cuenta: nadie
  // viajó, así que el precio va normal, sin tachar ni «Gratis» (y la pantalla dice que volvió).
  if (regalo?.devuelto)
    return { total, tachado: false, regalo: 0, aPagar: total, gratis: false, devuelto: true };
  const cubre = Math.max(0, Math.min(total, regalo?.monto ?? 0));
  const aPagar = pagaEnMano(total, regalo);
  // El regalo que se muestra es lo que cubre de verdad (nunca más que el precio).
  return { total, tachado: cubre > 0, regalo: cubre, aPagar, gratis: cubre > 0 && aPagar === 0 };
}

/** El nombre del regalo en el idioma de la persona (con el código si no tiene nombre). */
export const nombreRegalo = (
  r: Pick<RegaloDivoox, 'codigo' | 'nombreEs' | 'nombreEn'>,
  idioma: 'es' | 'en',
) => (idioma === 'en' ? r.nombreEn : r.nombreEs) || r.codigo;

/** Solo letras y números, en mayúsculas: lo mismo que guarda el servidor. */
export const normalizarCodigoRegalo = (c: string) =>
  c
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
