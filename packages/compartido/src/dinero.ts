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

/**
 * C-MONEDA-LOCAL: lo que escribe una persona («15.50», «12000») a la unidad menor de SU moneda, y al
 * revés. Con pesos (0 decimales) «12000» son 12000 pesos, no 1 200 000. Devuelve NaN si no es un número.
 */
export function textoAMonto(texto: string, moneda: string = 'USD'): number {
  const d = DECIMALES_MONEDA.get(moneda) ?? 2;
  const n = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10 ** d) : Number.NaN;
}

export function montoATexto(monto: number, moneda: string = 'USD'): string {
  const d = DECIMALES_MONEDA.get(moneda) ?? 2;
  return (monto / 10 ** d).toFixed(d);
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

/**
 * C-MONEDA-RECORRIDO: el importe que escribe una persona (un precio, una propina) a la unidad menor
 * de SU moneda, con validación. En dólares es exactamente `dolaresACentavos` (EE. UU. no cambia).
 * Con pesos (0 decimales) los puntos y comas son separadores de miles: «12.000» y «12000» son
 * 12000 pesos. Devuelve null si no es un importe.
 */
export function montoEscrito(texto: string, moneda: string = 'USD'): number | null {
  if (moneda === 'USD' || !DECIMALES_MONEDA.has(moneda)) return dolaresACentavos(texto);
  const limpio = texto
    .trim()
    .replace(/[^\d.,]/g, '')
    .replace(/^[.,]+/, '');
  if (DECIMALES_MONEDA.get(moneda) === 0) {
    // Sin separadores (hasta 12 cifras) o en grupos de miles: «1.250.000», «12,000».
    const grupos = limpio.split(/[.,]/);
    const [primero = '', ...resto] = grupos;
    const valido = resto.length
      ? /^\d{1,3}$/.test(primero) && resto.every((g) => /^\d{3}$/.test(g))
      : /^\d{1,12}$/.test(primero);
    if (!valido) return null;
    return Number(grupos.join(''));
  }
  const partes = limpio.replace(',', '.').split('.');
  if (partes.length > 2) return null;
  const [entero = '', decimales = ''] = partes;
  if (!/^\d{1,9}$/.test(entero) || !/^\d{0,2}$/.test(decimales)) return null;
  return Number(entero) * 100 + Number((decimales + '00').slice(0, 2));
}

/** Un monto con su moneda (los pedidos viejos no la tienen: dólares). */
export type MontoConMoneda = { monto: number; moneda?: string | null };

/**
 * C-MONEDA-RECORRIDO: suma por moneda, nunca mezclando. Dólares primero y después las demás en orden
 * alfabético. Sin montos devuelve [] (la pantalla decide qué mostrar).
 */
export function totalesPorMoneda(lista: MontoConMoneda[]): { moneda: string; monto: number }[] {
  const suma = new Map<string, number>();
  for (const x of lista) {
    const m = x.moneda || 'USD';
    suma.set(m, (suma.get(m) ?? 0) + x.monto);
  }
  const peso = (m: string) => (m === 'USD' ? '0' : `1${m}`);
  return [...suma.entries()]
    .map(([moneda, monto]) => ({ moneda, monto }))
    .sort((a, b) => peso(a.moneda).localeCompare(peso(b.moneda)));
}

/**
 * Los totales por moneda en una sola línea («$12.00 · COP 35.000»). Sin montos, cero en la moneda
 * dada (dólares si no se dice): en EE. UU. se ve igual que antes («$0.00»).
 */
export function formatearTotales(
  lista: MontoConMoneda[],
  idioma: 'es' | 'en' = 'en',
  monedaVacia = 'USD',
): string {
  const t = totalesPorMoneda(lista);
  if (!t.length) return formatearMonto(0, monedaVacia, idioma);
  return t.map((x) => formatearMonto(x.monto, x.moneda, idioma)).join(' · ');
}
