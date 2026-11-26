import {
  type CotizacionViaje,
  type Idioma,
  cuentaConSaldo,
  formatearFechaHora,
  formatearMonto,
  zonaDelNavegador,
} from '@tumbite/compartido';

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
    falta: cuenta.resto > 0 && !metodoValido,
    cuerpo: {
      metodoPago: cuenta.cubreTodo ? 'saldo' : elegido.metodo,
      ...(conSaldo ? { usarSaldo: true } : {}),
    },
  };
}

/**
 * C-SALDO-LOTES (26 nov 2026): la línea discreta de la tarjeta del Saldo Divoox cuando un regalo vence
 * pronto: «Incluye 3,00 $ de regalo que vence el 28 nov». Null si no hay nada por vencer pronto.
 */
export function lineaRegaloPorVencer(
  saldo: CotizacionViaje['saldoDivoox'],
  idioma: Idioma,
  zona: string = zonaDelNavegador(),
): string | null {
  const v = saldo?.vencePronto;
  if (!saldo || !v || v.monto <= 0) return null;
  const i = idioma === 'en' ? 'en' : 'es';
  const m = formatearMonto(v.monto, saldo.moneda, i);
  const f = formatearFechaHora(v.venceEn, {
    idioma: i,
    formato: i === 'en' ? '12' : '24',
    zona,
    estilo: 'fecha',
  });
  return i === 'en'
    ? `Includes ${m} gift that expires on ${f}`
    : `Incluye ${m} de regalo que vence el ${f}`;
}

/** De qué está hecho el saldo, solo si hay regalo Y prepago: «Regalo 3,00 $ · Prepagado 2,00 $». */
export function lineaOrigenSaldo(
  saldo: CotizacionViaje['saldoDivoox'],
  idioma: Idioma,
): string | null {
  if (!saldo || !saldo.regalo || !saldo.prepago) return null;
  const i = idioma === 'en' ? 'en' : 'es';
  const m = (c: number) => formatearMonto(c, saldo.moneda, i);
  return i === 'en'
    ? `Gift ${m(saldo.regalo)} · Prepaid ${m(saldo.prepago)}`
    : `Regalo ${m(saldo.regalo)} · Prepagado ${m(saldo.prepago)}`;
}
