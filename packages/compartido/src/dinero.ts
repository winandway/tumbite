/**
 * Todo el dinero se maneja en CENTAVOS enteros. Nunca en decimales:
 * 0.1 + 0.2 no da 0.3 en una computadora, y en un sistema de pagos eso es plata perdida.
 */
export type Centavos = number;

export function esCentavosValidos(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 0;
}

export function formatearDolares(centavos: Centavos, idioma: 'es' | 'en' = 'en'): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Monto inválido: ${centavos}. El dinero va en centavos enteros.`);
  }
  return new Intl.NumberFormat(idioma === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(centavos / 100);
}

/** Decimales de cada moneda: el monto siempre va en su unidad menor (C-MONEDA-LOCAL). */
export const DECIMALES_MONEDA = new Map<string, number>([
  ['USD', 2],
  ['COP', 0],
  ['VES', 2],
  ['MXN', 2],
]);
const REGION_MONEDA = new Map<string, string>([
  ['USD', 'US'],
  ['COP', 'CO'],
  ['VES', 'VE'],
  ['MXN', 'MX'],
]);

/**
 * El monto en la moneda del país del pedido (unidad menor: centavos de dólar, pesos colombianos
 * enteros, céntimos de bolívar). Una moneda desconocida se muestra como dólares, igual que antes.
 */
export function formatearMonto(
  monto: number,
  moneda: string = 'USD',
  idioma: 'es' | 'en' = 'en',
): string {
  if (!Number.isSafeInteger(monto)) {
    throw new Error(`Monto inválido: ${monto}. El dinero va en la unidad menor, entero.`);
  }
  const decimales = DECIMALES_MONEDA.get(moneda);
  if (decimales === undefined) return formatearDolares(monto, idioma);
  if (moneda === 'USD') return formatearDolares(monto, idioma);
  const region = REGION_MONEDA.get(moneda) ?? 'US';
  return new Intl.NumberFormat(`${idioma}-${region}`, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(monto / 10 ** decimales);
}

/** Porcentaje expresado en puntos básicos (750 = 7,5 %), redondeado al centavo. */
export function porcentajeDe(centavos: Centavos, puntosBasicos: number): Centavos {
  if (!esCentavosValidos(centavos) || !Number.isInteger(puntosBasicos) || puntosBasicos < 0) {
    throw new Error('porcentajeDe: valores inválidos');
  }
  return Math.round((centavos * puntosBasicos) / 10_000);
}

/** Convierte lo que escribe una persona ("12.50", "12,5", "$12") a centavos. Devuelve null si no es un precio. */
export function dolaresACentavos(texto: string): Centavos | null {
  const limpio = texto.trim().replace(/[$\s]/g, '').replace(',', '.');
  const partes = limpio.split('.');
  if (partes.length > 2) return null;
  const [entero = '', decimales = ''] = partes;
  if (!/^\d{1,7}$/.test(entero) || !/^\d{0,2}$/.test(decimales)) return null;
  return Number(entero) * 100 + Number((decimales + '00').slice(0, 2));
}

export function centavosATexto(centavos: Centavos): string {
  return (centavos / 100).toFixed(2);
}
