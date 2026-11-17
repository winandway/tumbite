/**
 * C-PUNTO-EXACTO (16 nov 2026) — todos los países. El punto exacto de entrega, de recogida («punto de
 * encuentro») y de los envíos, como Uber, DiDi, Rappi y PedidosYa: una calle o una avenida larga
 * no basta. Se abre un mapa con el pin FIJO en el centro, la persona mueve el mapa hasta su puerta,
 * arriba se ve la dirección que sale del punto y abajo «Confirmar este punto». Con «Punto de
 * referencia» y «Casa o apartamento», los dos opcionales. Ficha:
 * docs/investigaciones-rea/2026-11-16-punto-exacto-entrega-recogida.md
 *
 * Esta pieza es la lógica sin pantalla (textos y cómo se arma la dirección del punto), la misma para
 * las apps y la web.
 */
import type { Idioma } from './idiomas';

export type TipoPunto = 'entrega' | 'encuentro' | 'destino' | 'envio';

export type PuntoConfirmado = {
  punto: { lat: number; lng: number };
  direccion: string;
  referencia: string;
  apto: string;
};

/** Lo que devuelve el geocodificador del teléfono (expo-location) para un punto. */
export type SitioGeocodificado = {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
};

/** Un «plus code» de Google (CQPG+7F2): no es una dirección para una persona. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/i;

export const esPlusCode = (x: string | null | undefined) => PLUS_CODE.test((x ?? '').trim());

/**
 * La dirección legible de un punto: calle y número, sector, ciudad y estado. Nunca un plus code
 * (en El Vigía el teléfono devolvía «CQPG+7F2» como nombre del sitio). Sin calle conocida queda la
 * ciudad, y la persona completa con el punto de referencia.
 */
export function direccionDelSitio(s: SitioGeocodificado | null | undefined): string {
  if (!s) return '';
  const limpio = (x: string | null | undefined) => {
    const t = (x ?? '').trim();
    return t && !esPlusCode(t) ? t : '';
  };
  const calle = limpio(s.street);
  const numero = limpio(s.streetNumber);
  const nombre = limpio(s.name);
  const primera = calle ? [calle, numero].filter(Boolean).join(' ') : nombre;
  const partes = [
    primera,
    limpio(s.district),
    limpio(s.city) || limpio(s.subregion),
    limpio(s.region),
  ]
    .filter(Boolean)
    // Sin repetir («El Vigía, El Vigía»).
    .filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  return partes.join(', ');
}

/** ¿El punto se movió lo bastante como para volver a leer la calle? (unos 8 metros). */
export function seMovio(a: { lat: number; lng: number } | null, b: { lat: number; lng: number }) {
  if (!a) return true;
  return Math.abs(a.lat - b.lat) > 0.00007 || Math.abs(a.lng - b.lng) > 0.00007;
}

/** Lo que se le manda al servidor: la referencia y el apartamento, limpios y con su largo máximo. */
export function limpiarDetalles(d: { referencia?: string; apto?: string }) {
  const una = (x: string | undefined, max: number) =>
    (x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return { referencia: una(d.referencia, 160), apto: una(d.apto, 60) };
}

const T = {
  es: {
    titulo: {
      entrega: 'Confirma el punto de entrega',
      encuentro: 'Confirma el punto de encuentro',
      destino: 'Confirma el destino',
      envio: 'Confirma el punto exacto',
    },
    ayuda: 'Mueve el mapa hasta tu puerta. El pin marca el punto exacto.',
    ayudaEncuentro: 'Mueve el mapa hasta donde te van a buscar.',
    estaDireccion: 'Dirección de este punto',
    buscandoCalle: 'Buscando la calle…',
    sinCalle: 'Punto marcado en el mapa',
    estoyAqui: 'Estoy aquí',
    buscandote: 'Buscándote…',
    sinPermiso:
      'No tenemos permiso para saber dónde estás. Mueve el mapa con el dedo hasta tu puerta, o actívalo en los ajustes del teléfono.',
    sinSenal: 'No pudimos saber dónde estás. Mueve el mapa con el dedo hasta tu puerta.',
    referencia: 'Punto de referencia (opcional)',
    referenciaEjemplo: 'Frente a la panadería, portón negro',
    apto: 'Casa o apartamento (opcional)',
    aptoEjemplo: 'Casa 12, apto 3B',
    confirmar: 'Confirmar este punto',
    volver: 'Volver',
    mapa: 'Mapa para marcar el punto exacto',
    marcar: 'Marcar mi puerta en el mapa',
    ajustar: 'Ajustar el punto',
    sinMarcar: 'Marca tu puerta en el mapa para que te encuentren rápido.',
    puntoMarcado: 'Punto exacto marcado',
  },
  en: {
    titulo: {
      entrega: 'Confirm the drop-off spot',
      encuentro: 'Confirm the pickup spot',
      destino: 'Confirm the destination',
      envio: 'Confirm the exact spot',
    },
    ayuda: 'Move the map to your door. The pin marks the exact spot.',
    ayudaEncuentro: 'Move the map to where you’ll be picked up.',
    estaDireccion: 'Address of this spot',
    buscandoCalle: 'Finding the street…',
    sinCalle: 'Spot marked on the map',
    estoyAqui: 'I’m here',
    buscandote: 'Finding you…',
    sinPermiso:
      'We don’t have permission to know where you are. Drag the map to your door, or turn it on in your phone’s settings.',
    sinSenal: 'We couldn’t tell where you are. Drag the map to your door.',
    referencia: 'Landmark (optional)',
    referenciaEjemplo: 'Across from the bakery, black gate',
    apto: 'House or apartment (optional)',
    aptoEjemplo: 'House 12, apt 3B',
    confirmar: 'Confirm this spot',
    volver: 'Back',
    mapa: 'Map to mark the exact spot',
    marcar: 'Mark my door on the map',
    ajustar: 'Adjust the spot',
    sinMarcar: 'Mark your door on the map so we find you fast.',
    puntoMarcado: 'Exact spot marked',
  },
} as const;

export const textosPuntoExacto = (idioma: Idioma) => (idioma === 'en' ? T.en : T.es);

/** Cómo lo ve el repartidor o el conductor: la referencia y la casa juntas, en una línea. */
export function lineaReferencia(d: { referencia?: string | null; apto?: string | null }) {
  return [d.apto, d.referencia]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * La dirección que ven el repartidor, el conductor, el restaurante y el equipo: la del punto y, si la
 * hay, la referencia («Av. Don Pepe Rojas · Ref.: frente a la panadería»). Va pegada al texto, igual
 * que el apartamento (C-DIRECCION-APTO), para que llegue a TODAS las pantallas y tickets sin
 * cambiar ninguna. Nunca se repite si ya estaba.
 */
export function direccionConReferencia(direccion: string, referencia?: string | null) {
  const ref = (referencia ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const base = direccion.trim();
  if (!ref || base.toLowerCase().includes(`ref.: ${ref}`.toLowerCase())) return base;
  return `${base} · Ref.: ${ref}`;
}
