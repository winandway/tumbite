import type { Idioma } from './idiomas';

/**
 * Lista de activación del restaurante (como exigen los grandes antes de encender una tienda):
 * sin teléfono, dirección con pin, horario y al menos un plato vendible, no se abre. Las fotos y la
 * cuenta de cobro se recomiendan y se muestran, pero no bloquean (el dinero espera en la billetera).
 */
export type ClaveActivacion = 'telefono' | 'direccion' | 'horario' | 'platos' | 'fotos' | 'cobro';
export type ItemActivacion = { clave: ClaveActivacion; listo: boolean; obligatorio: boolean };
export type Activacion = { items: ItemActivacion[]; lista: boolean };

/** Platos con foto que se recomiendan antes de abrir. */
export const MINIMO_PLATOS_CON_FOTO = 5;

export function listaActivacion(d: {
  telefono: string;
  lat: number | null;
  lng: number | null;
  turnos: number;
  platosVendibles: number;
  platosConFoto: number;
  cobroConectado: boolean;
}): Activacion {
  const items: ItemActivacion[] = [
    { clave: 'telefono', listo: d.telefono.trim().length >= 7, obligatorio: true },
    { clave: 'direccion', listo: d.lat != null && d.lng != null, obligatorio: true },
    { clave: 'horario', listo: d.turnos > 0, obligatorio: true },
    { clave: 'platos', listo: d.platosVendibles > 0, obligatorio: true },
    { clave: 'fotos', listo: d.platosConFoto >= MINIMO_PLATOS_CON_FOTO, obligatorio: false },
    { clave: 'cobro', listo: d.cobroConectado, obligatorio: false },
  ];
  return { items, lista: items.every((i) => i.listo || !i.obligatorio) };
}

const TEXTOS_ES = new Map<ClaveActivacion, string>([
  ['telefono', 'Teléfono del restaurante'],
  ['direccion', 'Dirección con el pin en el mapa'],
  ['horario', 'Horario cargado (al menos un turno)'],
  ['platos', 'Al menos un plato disponible con precio'],
  ['fotos', `Al menos ${MINIMO_PLATOS_CON_FOTO} platos con foto (recomendado)`],
  ['cobro', 'Cuenta de cobro conectada para retirar tu dinero (recomendado)'],
]);
const TEXTOS_EN = new Map<ClaveActivacion, string>([
  ['telefono', 'Restaurant phone number'],
  ['direccion', 'Address with the pin on the map'],
  ['horario', 'Hours set (at least one shift)'],
  ['platos', 'At least one available dish with a price'],
  ['fotos', `At least ${MINIMO_PLATOS_CON_FOTO} dishes with a photo (recommended)`],
  ['cobro', 'Payout account connected to withdraw your money (recommended)'],
]);

export const textoActivacion = (clave: ClaveActivacion, idioma: Idioma) =>
  (idioma === 'en' ? TEXTOS_EN : TEXTOS_ES).get(clave) ?? clave;
