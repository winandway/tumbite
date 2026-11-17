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
