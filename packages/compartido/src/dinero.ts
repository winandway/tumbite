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

/** Porcentaje expresado en puntos básicos (750 = 7,5 %), redondeado al centavo. */
export function porcentajeDe(centavos: Centavos, puntosBasicos: number): Centavos {
  if (!esCentavosValidos(centavos) || !Number.isInteger(puntosBasicos) || puntosBasicos < 0) {
    throw new Error('porcentajeDe: valores inválidos');
  }
  return Math.round((centavos * puntosBasicos) / 10_000);
}
