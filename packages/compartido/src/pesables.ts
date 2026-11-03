/**
 * C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026). Los productos que se venden por peso (frutas, carne,
 * charcutería) se piden al peso estimado y se cobran por el peso real que escribe la tienda al
 * preparar, como Instacart y DoorDash:
 * - [DOC] Instacart («Authorization holds and adjusted totals»): retiene un poco más que el total
 *   estimado y cobra solo lo entregado; las tiendas con Instacart dicen 10 % a 15 % de más.
 * - [DOC] DoorDash para tiendas («weighted items»): la tienda informa el peso real y, si se sale de
 *   la tolerancia, la API lo rechaza; el cobro final usa el peso informado.
 * Nuestro estándar: se autoriza el total más un margen del 15 % de los pesables; cada línea puede
 * subir hasta el 15 % sobre su estimado (más que eso se rechaza y la tienda ajusta o lo marca como
 * faltante); el redondeo siempre favorece al cliente. Todos los países.
 */

/** Margen sobre el estimado de los pesables, en puntos básicos (1500 = 15 %). */
export const MARGEN_PESABLE_BP = 1500;

export type LineaPesable = {
  platoId: string;
  precioCentavos: number;
  cantidad: number;
  pesable?: boolean;
  unidadPeso?: string | null;
  /** Precio de la tienda por unidad de peso (centavos por lb o kg), congelado al pedir. */
  precioPorPeso?: number;
  /** Peso promedio de UNA unidad, congelado al pedir. */
  pesoEstimado?: number | null;
  /** El peso real de toda la línea, escrito por la tienda. */
  pesoReal?: number;
  /** El precio por unidad que se estimó al pedir (se conserva al pesar). */
  precioEstimadoCentavos?: number;
};

const esPesable = (l: LineaPesable) =>
  l.pesable === true && Number(l.precioPorPeso) > 0 && Number(l.pesoEstimado) > 0;

const importeEstimado = (l: LineaPesable) =>
  (l.precioEstimadoCentavos ?? l.precioCentavos) * l.cantidad;

/**
 * Lo que se autoriza de más en la tarjeta: el 15 % del estimado de los pesables, escalado por la
 * proporción total/subtotal (envío, servicio e impuesto suben con el subtotal). Hacia arriba.
 */
export function margenPesables(lineas: LineaPesable[], total: number, subtotal: number): number {
  const pesables = lineas
    .filter((l) => l.pesable === true)
    .reduce((s, l) => s + importeEstimado(l), 0);
  if (pesables <= 0) return 0;
  const escala = subtotal > 0 ? Math.max(1, total / subtotal) : 1;
  return Math.ceil((pesables * MARGEN_PESABLE_BP * escala) / 10_000);
}

export type PesoAplicado<L extends LineaPesable = LineaPesable> =
  | { ok: true; linea: L & { pesoReal: number; precioEstimadoCentavos: number } }
  | { ok: false; motivo: 'no_pesable' | 'peso' | 'tope'; pesoMaximo?: number };

/** La línea con su peso real, o por qué no se puede (nunca más que el estimado + 15 %). */
export function aplicarPesoReal<L extends LineaPesable>(
  linea: L,
  pesoReal: number,
): PesoAplicado<L> {
  if (!esPesable(linea)) return { ok: false, motivo: 'no_pesable' };
  if (!Number.isFinite(pesoReal) || pesoReal <= 0 || pesoReal > 10_000)
    return { ok: false, motivo: 'peso' };
  const precioPorPeso = Number(linea.precioPorPeso);
  const estimado = importeEstimado(linea);
  const tope = Math.ceil((estimado * (10_000 + MARGEN_PESABLE_BP)) / 10_000);
  const importe = Math.round(precioPorPeso * pesoReal);
  if (importe > tope)
    return {
      ok: false,
      motivo: 'tope',
      pesoMaximo: Math.floor((tope / precioPorPeso) * 1000) / 1000,
    };
  return {
    ok: true,
    linea: {
      ...linea,
      // El importe se reparte entre las unidades; el resto (menos de un centavo por unidad) se
      // queda a favor del cliente.
      precioCentavos: Math.floor(importe / linea.cantidad),
      pesoReal,
      precioEstimadoCentavos: linea.precioEstimadoCentavos ?? linea.precioCentavos,
    },
  };
}

/** Un peso con hasta tres decimales, sin ceros de sobra («2», «1.83», «0.457»). */
export const formatearPeso = (peso: number) => String(Math.round(peso * 1000) / 1000);

/** «Peso estimado 2 lb → peso real 1.83 lb» (vacío si la línea todavía no se pesó). */
export function textoPesoReal(
  l: Pick<LineaPesable, 'cantidad' | 'unidadPeso' | 'pesoEstimado' | 'pesoReal'>,
  idioma: 'es' | 'en',
): string {
  if (l.pesoReal == null || !l.pesoEstimado) return '';
  const u = l.unidadPeso ? ` ${l.unidadPeso}` : '';
  const estimado = `${formatearPeso(Number(l.pesoEstimado) * l.cantidad)}${u}`;
  const real = `${formatearPeso(l.pesoReal)}${u}`;
  return idioma === 'en'
    ? `Estimated weight ${estimado} → actual weight ${real}`
    : `Peso estimado ${estimado} → peso real ${real}`;
}
