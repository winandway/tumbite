import type { Idioma } from './idiomas';

/**
 * C-PLURAL (18 nov 2026) — todos los países. Un número con su palabra, bien dicho en los dos
 * idiomas: «1 entrega», «0 entregas», «1 delivery», «2 deliveries». Es la pieza única para contar
 * cosas en las apps; nada de `${n} entregas` con la palabra en plural fijo.
 * Uso: `contar(3, 'paquete', idioma)` → «3 paquetes» / «3 packages».
 */
const PALABRAS = {
  entrega: { es: ['entrega', 'entregas'], en: ['delivery', 'deliveries'] },
  carrera: { es: ['carrera', 'carreras'], en: ['trip', 'trips'] },
  viaje: { es: ['viaje', 'viajes'], en: ['ride', 'rides'] },
  pedido: { es: ['pedido', 'pedidos'], en: ['order', 'orders'] },
  parada: { es: ['parada', 'paradas'], en: ['stop', 'stops'] },
  paquete: { es: ['paquete', 'paquetes'], en: ['package', 'packages'] },
  minuto: { es: ['minuto', 'minutos'], en: ['minute', 'minutes'] },
  servicio: { es: ['servicio', 'servicios'], en: ['service', 'services'] },
} as const satisfies Record<string, Record<Idioma, readonly [string, string]>>;

export type PalabraContable = keyof typeof PALABRAS;

export function contar(n: number, palabra: PalabraContable, idioma: Idioma): string {
  // eslint-disable-next-line security/detect-object-injection -- palabra es de una lista cerrada
  const [uno, varios] = PALABRAS[palabra][idioma === 'en' ? 'en' : 'es'];
  return `${n} ${n === 1 ? uno : varios}`;
}
