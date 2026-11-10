import type { Idioma } from './idiomas';

/**
 * C-CANCELAR-LISTO (10 nov 2026, punto D1) — todos los países. Motivos cerrados con los que un
 * restaurante pide a soporte cancelar un pedido que YA está listo. Cada motivo dice quién asume la
 * comida preparada, con la regla de DoorDash («el comercio cobra solo si el pedido estaba
 * preparado y la cancelación no fue por su causa») y los motivos de la API de Uber Eats.
 * Ficha: docs/investigaciones-rea/2026-11-10-cancelar-pedido-listo.md.
 */
export type PagaComida = 'restaurante' | 'cliente' | 'divoox' | 'por_definir';

export const MOTIVOS_CANCELACION = [
  {
    id: 'agotado',
    paga: 'restaurante',
    texto: { es: 'Se agotó un producto del pedido', en: 'An item in the order ran out' },
  },
  {
    id: 'local_cerrado',
    paga: 'restaurante',
    texto: {
      es: 'El local cerró o tuvo una emergencia',
      en: 'The store closed or had an emergency',
    },
  },
  {
    id: 'error_pedido',
    paga: 'restaurante',
    texto: { es: 'Preparamos mal el pedido', en: 'We prepared the order wrong' },
  },
  {
    id: 'cliente_pidio',
    paga: 'cliente',
    texto: { es: 'El cliente llamó para cancelar', en: 'The customer called to cancel' },
  },
  {
    id: 'repartidor_no_llego',
    paga: 'divoox',
    texto: {
      es: 'El repartidor no llegó (más de 15 minutos de espera)',
      en: 'The driver never arrived (more than 15 minutes waiting)',
    },
  },
  {
    id: 'otro',
    paga: 'por_definir',
    texto: { es: 'Otro motivo', en: 'Another reason' },
  },
] as const;

export type MotivoCancelacion = (typeof MOTIVOS_CANCELACION)[number]['id'];
export const IDS_MOTIVO_CANCELACION = MOTIVOS_CANCELACION.map((m) => m.id) as [
  MotivoCancelacion,
  ...MotivoCancelacion[],
];

export function motivoCancelacion(id: string) {
  return MOTIVOS_CANCELACION.find((m) => m.id === id) ?? null;
}

export function textoMotivoCancelacion(id: string, idioma: Idioma): string {
  const m = motivoCancelacion(id);
  return m ? (idioma === 'en' ? m.texto.en : m.texto.es) : id;
}

/** Quién asume la comida ya preparada, dicho en palabras para el restaurante y para soporte. */
export const TEXTO_PAGA_COMIDA: Record<PagaComida, Record<Idioma, string>> = {
  restaurante: {
    es: 'La cancelación es por una causa del restaurante: el restaurante no cobra esta comida.',
    en: 'The cancellation is on the restaurant’s side: the restaurant isn’t paid for this food.',
  },
  cliente: {
    es: 'La comida ya estaba preparada y la causa no es del restaurante: el restaurante cobra la comida.',
    en: 'The food was already prepared and the cause isn’t the restaurant’s: the restaurant is paid for the food.',
  },
  divoox: {
    es: 'La causa es de Divoox o del reparto: el restaurante cobra la comida y Divoox la asume.',
    en: 'The cause is on Divoox or the delivery: the restaurant is paid for the food and Divoox covers it.',
  },
  por_definir: {
    es: 'Soporte revisa el caso y decide quién asume la comida.',
    en: 'Support reviews the case and decides who covers the food.',
  },
};
