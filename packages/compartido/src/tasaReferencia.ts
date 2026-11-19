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

/**
 * C-BS-EN-MANO (18 nov 2026, Venezuela; en Estados Unidos no aplica): en Venezuela casi nadie tiene
 * monedas de dólar. Todo monto que se cobra o se paga EN MANO (efectivo o pago móvil) se ve en dólares
 * Y en bolívares, con la tasa FIJADA con la operación (tasa y fecha guardadas al cotizar o al crear el
 * pedido): conductor y pasajero ven el mismo número aunque la tasa cambie después.
 *
 * Redondeo (regla única, la de `equivalenteLocal`): al céntimo de bolívar, la mitad hacia arriba.
 * Sin tasa vigente no se inventa un número: `sinTasa` y la pantalla lo dice.
 */
export type TasaFijada = Omit<Referencia, 'monto'>;

export type MontoEnMano = {
  /** En la moneda del sistema (centavos de dólar), entero. */
  monto: number;
  moneda: string;
  /** El equivalente en la moneda local con la tasa fijada, o null. */
  local: Referencia | null;
  /** El país usa moneda de referencia pero no hay tasa vigente: la pantalla lo dice. */
  sinTasa: boolean;
};

/** El perfil del país: ¿este monto se muestra también en su moneda local? */
export function aplicaReferencia(
  pais: string | null | undefined,
  moneda: string | null | undefined,
): boolean {
  return MONEDA_REFERENCIA.has(pais ?? '') && moneda === 'USD';
}

/** La tasa guardada con una operación (columnas `ref_tasa` y `ref_fecha`), o null. */
export function tasaGuardada(
  pais: string | null | undefined,
  tasa: number | null | undefined,
  fecha: string | null | undefined,
): TasaFijada | null {
  const moneda = MONEDA_REFERENCIA.get(pais ?? '');
  if (!moneda || tasa == null || !(Number(tasa) > 0) || !fecha) return null;
  return { moneda, tasa: Number(tasa), fecha: String(fecha).slice(0, 10) };
}

export function montoEnMano(
  centavos: number,
  moneda: string,
  pais: string | null | undefined,
  tasa: TasaFijada | null | undefined,
): MontoEnMano {
  if (!aplicaReferencia(pais, moneda) || !Number.isSafeInteger(centavos) || centavos < 0)
    return { monto: centavos, moneda, local: null, sinTasa: false };
  if (!tasa) return { monto: centavos, moneda, local: null, sinTasa: true };
  return {
    monto: centavos,
    moneda,
    local: { ...tasa, monto: equivalenteLocal(centavos, tasa.tasa) },
    sinTasa: false,
  };
}

const formatoLocal = (n: number, idioma: 'es' | 'en', decimales: number) =>
  new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-VE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);

/** «Bs. 205,72» / «Bs. 205.72» (el monto local solo, sin «≈»: es lo que se paga). */
export function textoLocal(r: Referencia | null | undefined, idioma: 'es' | 'en'): string {
  if (!r) return '';
  return r.moneda === 'VES'
    ? `Bs. ${formatoLocal(r.monto / 100, idioma, 2)}`
    : formatearMonto(r.monto, r.moneda, idioma);
}

/** «Tasa del 13 nov: Bs. 236,4567 por dólar» / «Rate of Nov 13: Bs. 236.4567 per dollar». */
export function textoTasaUsada(r: TasaFijada | null | undefined, idioma: 'es' | 'en'): string {
  if (!r) return '';
  const [, m, d] = r.fecha.split('-').map(Number);
  const mes = MESES.get(idioma)?.at((m ?? 1) - 1) ?? '';
  const tasa = `${r.moneda === 'VES' ? 'Bs.' : r.moneda} ${formatoLocal(r.tasa, idioma, 4)}`;
  return idioma === 'en'
    ? `Rate of ${mes} ${d ?? ''}: ${tasa} per dollar`
    : `Tasa del ${d ?? ''} ${mes}: ${tasa} por dólar`;
}

/** Sin tasa vigente: qué hacer, en palabras (nunca un número inventado). */
export function textoSinTasa(idioma: 'es' | 'en', quien: 'conductor' | 'pasajero'): string {
  if (idioma === 'en')
    return quien === 'conductor'
      ? "No exchange rate today: collect the amount in dollars or check today's official rate."
      : "No exchange rate today: pay the amount in dollars or check today's official rate.";
  return quien === 'conductor'
    ? 'Hoy no hay tasa disponible: cobra el monto en dólares o consulta la tasa oficial del día.'
    : 'Hoy no hay tasa disponible: paga el monto en dólares o consulta la tasa oficial del día.';
}
