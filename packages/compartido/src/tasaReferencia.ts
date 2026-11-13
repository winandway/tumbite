import { formatearMonto } from './dinero';

/**
 * C-BS-REFERENCIA (13 nov 2026, Venezuela): el viaje de Moto se cotiza y se cobra en dólares, y al
 * lado se muestra su equivalente en bolívares con la tasa que el equipo escribe a mano en el panel,
 * como hacen Ridery y Yummy [OBS] (precio en dólares con su equivalente). Es SOLO informativo: el
 * dinero del sistema sigue en dólares, en centavos enteros, y el equivalente no entra en la comisión
 * ni en ningún cobro. No es el diseño de cobrar en bolívares con tasa guardada por pedido
 * (docs/DISENO-TASA-VES.md, sin construir): aquí no se crea nada en bolívares.
 */

/** Moneda local de referencia por país (solo donde los viajes se cobran en dólares). */
export const MONEDA_REFERENCIA: ReadonlyMap<string, string> = new Map([['VE', 'VES']]);

/** Más vieja que esto, la tasa no se muestra: nunca un número viejo. */
export const HORAS_VIGENCIA_TASA = 48;

export type Referencia = {
  moneda: string;
  /** El equivalente en la unidad menor de la moneda local (céntimos de bolívar), entero. */
  monto: number;
  /** Bolívares por dólar, como la escribió el equipo. */
  tasa: number;
  /** El día de la tasa (AAAA-MM-DD, hora de Caracas). */
  fecha: string;
};

/**
 * Centavos de dólar → céntimos de la moneda local, con aritmética entera (la tasa con 8 decimales
 * como entero) y redondeo a la mitad hacia arriba.
 */
export function equivalenteLocal(centavosUsd: number, tasa: number): number {
  if (!Number.isSafeInteger(centavosUsd) || !(tasa > 0) || !Number.isFinite(tasa))
    throw new Error('equivalenteLocal: monto o tasa inválidos');
  const escala = 100_000_000n;
  const t = BigInt(Math.round(tasa * 1e8));
  const p = BigInt(centavosUsd) * t;
  const r = (p * 2n + escala) / (escala * 2n);
  return Number(r);
}

const MESES = new Map([
  ['es', ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']],
  ['en', ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']],
]);

/** «≈ Bs. 2.645,63 (tasa del 13 nov)» / «≈ VES 2,645.63 (rate of Nov 13)». */
export function textoReferencia(r: Referencia | null | undefined, idioma: 'es' | 'en'): string {
  if (!r) return '';
  const [, m, d] = r.fecha.split('-').map(Number);
  const mes = MESES.get(idioma)?.at((m ?? 1) - 1) ?? '';
  const dia = String(d ?? '');
  // El bolívar se escribe «Bs.», como en las apps de Venezuela (Intl lo pone como «Bs.S»).
  const monto =
    r.moneda === 'VES'
      ? `Bs. ${new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(r.monto / 100)}`
      : formatearMonto(r.monto, r.moneda, idioma);
  return idioma === 'en'
    ? `≈ ${monto} (rate of ${mes} ${dia})`
    : `≈ ${monto} (tasa del ${dia} ${mes})`;
}
