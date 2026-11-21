import type { Idioma } from '../idiomas';

/**
 * C-DATOS-PAIS (21 nov 2026, pedido de Richard: «una sola pieza para todo el sistema, como las
 * grandes»). Todo lo que depende del país sale de aquí y de ningún otro lado: código ISO, nombres,
 * moneda, prefijo telefónico, hora, idioma y forma de la dirección. El prefijo del ID público, el
 * código del teléfono, la moneda de una ciudad nueva y su hora ya no se adivinan.
 *
 * Fuentes: ISO 3166-1 (país), ISO 4217 (moneda), base de zonas horarias IANA y el plan de numeración
 * de la UIT (prefijo). Sumar un país es agregar su fila; el territorio va aparte, en
 * `territorio.ts`, con su archivo oficial.
 */
export type DatosPais = {
  iso: string;
  /** Moneda oficial del país (ISO 4217). */
  moneda: string;
  /**
   * Moneda en que Divoox cotiza y cobra en sus ciudades. Venezuela cobra en dólares y muestra
   * bolívares de referencia; los demás, en su moneda oficial.
   */
  monedaCobro: string;
  /** Prefijo telefónico internacional, sin «+». */
  prefijo: string;
  /** Zona horaria de su capital (IANA). Una ciudad puede tener la suya propia. */
  zonaHoraria: string;
  idioma: Idioma;
  /** Partes de la dirección en el orden en que se escriben allí. */
  direccion: readonly ParteDireccion[];
  /** Celular de ejemplo, imposible a propósito (sirve de pista en la casilla). */
  ejemploCelular: string;
};

export type ParteDireccion =
  | 'calle'
  | 'referencia'
  | 'sector'
  | 'parroquia'
  | 'municipio'
  | 'ciudad'
  | 'estado'
  | 'departamento'
  | 'distrito'
  | 'provincia'
  | 'codigoPostal';

const DIRECCION_LATAM: readonly ParteDireccion[] = ['calle', 'referencia', 'sector', 'ciudad'];

export const PAISES: Readonly<Record<string, DatosPais>> = {
  VE: {
    iso: 'VE',
    moneda: 'VES',
    monedaCobro: 'USD',
    prefijo: '58',
    zonaHoraria: 'America/Caracas',
    idioma: 'es',
    direccion: ['calle', 'referencia', 'sector', 'parroquia', 'municipio', 'estado'],
    ejemploCelular: '0414-0000000',
  },
  CO: {
    iso: 'CO',
    moneda: 'COP',
    monedaCobro: 'COP',
    prefijo: '57',
    zonaHoraria: 'America/Bogota',
    idioma: 'es',
    direccion: ['calle', 'referencia', 'sector', 'municipio', 'departamento'],
    ejemploCelular: '300 0000000',
  },
  PE: {
    iso: 'PE',
    moneda: 'PEN',
    monedaCobro: 'PEN',
    prefijo: '51',
    zonaHoraria: 'America/Lima',
    idioma: 'es',
    direccion: ['calle', 'referencia', 'distrito', 'provincia', 'departamento'],
    ejemploCelular: '900 000 000',
  },
  US: {
    iso: 'US',
    moneda: 'USD',
    monedaCobro: 'USD',
    prefijo: '1',
    zonaHoraria: 'America/New_York',
    idioma: 'en',
    direccion: ['calle', 'ciudad', 'estado', 'codigoPostal'],
    ejemploCelular: '(555) 010-0000',
  },
  MX: {
    iso: 'MX',
    moneda: 'MXN',
    monedaCobro: 'MXN',
    prefijo: '52',
    zonaHoraria: 'America/Mexico_City',
    idioma: 'es',
    direccion: ['calle', 'sector', 'codigoPostal', 'ciudad', 'estado'],
    ejemploCelular: '55 0000 0000',
  },
  CL: {
    iso: 'CL',
    moneda: 'CLP',
    monedaCobro: 'CLP',
    prefijo: '56',
    zonaHoraria: 'America/Santiago',
    idioma: 'es',
    direccion: DIRECCION_LATAM,
    ejemploCelular: '9 0000 0000',
  },
};

const POR_ISO = new Map(Object.values(PAISES).map((p) => [p.iso, p]));

/** Los datos de un país, o null si Divoox todavía no lo conoce (nunca otro país en su lugar). */
export function datosPais(iso: string | null | undefined): DatosPais | null {
  const k = String(iso ?? '')
    .trim()
    .toUpperCase();
  return POR_ISO.get(k) ?? null;
}

/** El país de un prefijo telefónico («58» → VE). El «1» compartido se toma como EE. UU. */
export function paisDePrefijo(prefijo: string): string | null {
  const p = prefijo.replace(/\D/g, '');
  return Object.values(PAISES).find((d) => d.prefijo === p)?.iso ?? null;
}

/**
 * C-TERRITORIO-OFICIAL: los países con su división oficial cargada (contornos en
 * `/territorio/<ISO>/`). Liviano, para el panel; `territorio.ts` tiene los datos.
 */
export const PAISES_CON_TERRITORIO_OFICIAL: readonly string[] = ['VE'];
