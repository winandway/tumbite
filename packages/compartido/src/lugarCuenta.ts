/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026; Venezuela y Estados Unidos).
 *
 * El lugar donde VIVE una persona, elegido al registrarse: País → Estado → Ciudad. No es un mapa de
 * cobertura: sale de un catálogo completo del país (archivos fijos, sin base de datos) y la cuenta se
 * crea SIEMPRE. Si su ciudad cae dentro de una zona abierta, la zona se asigna sola; si no, la cuenta
 * queda en la lista de espera de su ciudad.
 *
 * Este archivo es el CONTRATO entre el catálogo, las apps, la web y el servidor. No depende de nada.
 */

export type PaisConCatalogo = 'VE' | 'US';
export const PAISES_CON_CATALOGO: readonly PaisConCatalogo[] = ['VE', 'US'];

export type EstadoDelPais = { codigo: string; nombre: string };

/** Los 23 estados y el Distrito Capital (código ISO 3166-2 sin el «VE-»). */
export const ESTADOS_VE: readonly EstadoDelPais[] = [
  { codigo: 'Z', nombre: 'Amazonas' },
  { codigo: 'B', nombre: 'Anzoátegui' },
  { codigo: 'C', nombre: 'Apure' },
  { codigo: 'D', nombre: 'Aragua' },
  { codigo: 'E', nombre: 'Barinas' },
  { codigo: 'F', nombre: 'Bolívar' },
  { codigo: 'G', nombre: 'Carabobo' },
  { codigo: 'H', nombre: 'Cojedes' },
  { codigo: 'Y', nombre: 'Delta Amacuro' },
  { codigo: 'A', nombre: 'Distrito Capital' },
  { codigo: 'I', nombre: 'Falcón' },
  { codigo: 'J', nombre: 'Guárico' },
  { codigo: 'X', nombre: 'La Guaira' },
  { codigo: 'K', nombre: 'Lara' },
  { codigo: 'L', nombre: 'Mérida' },
  { codigo: 'M', nombre: 'Miranda' },
  { codigo: 'N', nombre: 'Monagas' },
  { codigo: 'O', nombre: 'Nueva Esparta' },
  { codigo: 'P', nombre: 'Portuguesa' },
  { codigo: 'R', nombre: 'Sucre' },
  { codigo: 'S', nombre: 'Táchira' },
  { codigo: 'T', nombre: 'Trujillo' },
  { codigo: 'U', nombre: 'Yaracuy' },
  { codigo: 'V', nombre: 'Zulia' },
];

/** Los 50 estados y el Distrito de Columbia (código postal de dos letras). */
export const ESTADOS_US: readonly EstadoDelPais[] = [
  { codigo: 'AL', nombre: 'Alabama' },
  { codigo: 'AK', nombre: 'Alaska' },
  { codigo: 'AZ', nombre: 'Arizona' },
  { codigo: 'AR', nombre: 'Arkansas' },
  { codigo: 'CA', nombre: 'California' },
  { codigo: 'CO', nombre: 'Colorado' },
  { codigo: 'CT', nombre: 'Connecticut' },
  { codigo: 'DE', nombre: 'Delaware' },
  { codigo: 'DC', nombre: 'District of Columbia' },
  { codigo: 'FL', nombre: 'Florida' },
  { codigo: 'GA', nombre: 'Georgia' },
  { codigo: 'HI', nombre: 'Hawaii' },
  { codigo: 'ID', nombre: 'Idaho' },
  { codigo: 'IL', nombre: 'Illinois' },
  { codigo: 'IN', nombre: 'Indiana' },
  { codigo: 'IA', nombre: 'Iowa' },
  { codigo: 'KS', nombre: 'Kansas' },
  { codigo: 'KY', nombre: 'Kentucky' },
  { codigo: 'LA', nombre: 'Louisiana' },
  { codigo: 'ME', nombre: 'Maine' },
  { codigo: 'MD', nombre: 'Maryland' },
  { codigo: 'MA', nombre: 'Massachusetts' },
  { codigo: 'MI', nombre: 'Michigan' },
  { codigo: 'MN', nombre: 'Minnesota' },
  { codigo: 'MS', nombre: 'Mississippi' },
  { codigo: 'MO', nombre: 'Missouri' },
  { codigo: 'MT', nombre: 'Montana' },
  { codigo: 'NE', nombre: 'Nebraska' },
  { codigo: 'NV', nombre: 'Nevada' },
  { codigo: 'NH', nombre: 'New Hampshire' },
  { codigo: 'NJ', nombre: 'New Jersey' },
  { codigo: 'NM', nombre: 'New Mexico' },
  { codigo: 'NY', nombre: 'New York' },
  { codigo: 'NC', nombre: 'North Carolina' },
  { codigo: 'ND', nombre: 'North Dakota' },
  { codigo: 'OH', nombre: 'Ohio' },
  { codigo: 'OK', nombre: 'Oklahoma' },
  { codigo: 'OR', nombre: 'Oregon' },
  { codigo: 'PA', nombre: 'Pennsylvania' },
  { codigo: 'RI', nombre: 'Rhode Island' },
  { codigo: 'SC', nombre: 'South Carolina' },
  { codigo: 'SD', nombre: 'South Dakota' },
  { codigo: 'TN', nombre: 'Tennessee' },
  { codigo: 'TX', nombre: 'Texas' },
  { codigo: 'UT', nombre: 'Utah' },
  { codigo: 'VT', nombre: 'Vermont' },
  { codigo: 'VA', nombre: 'Virginia' },
  { codigo: 'WA', nombre: 'Washington' },
  { codigo: 'WV', nombre: 'West Virginia' },
  { codigo: 'WI', nombre: 'Wisconsin' },
  { codigo: 'WY', nombre: 'Wyoming' },
];

export function estadosDelPais(pais: string | null | undefined): readonly EstadoDelPais[] {
  const p = String(pais ?? '').toUpperCase();
  return p === 'VE' ? ESTADOS_VE : p === 'US' ? ESTADOS_US : [];
}

export function estadoDelPais(
  pais: string | null | undefined,
  codigo: string | null | undefined,
): EstadoDelPais | null {
  const c = String(codigo ?? '').toUpperCase();
  return estadosDelPais(pais).find((e) => e.codigo === c) ?? null;
}

/**
 * Lo que viaja de la app al servidor y lo que se guarda en la cuenta.
 * - `lugarId`: el identificador del catálogo («gn:3633009»). Con él se cuentan los que esperan.
 * - `municipio`: municipio (Venezuela) o condado (Estados Unidos); puede faltar.
 * - `lat`/`lng`: el centro de la ciudad según el catálogo. Con eso el servidor mira si cae en una zona.
 */
export type LugarCuenta = {
  pais: PaisConCatalogo;
  estado: string;
  municipio?: string | null;
  ciudad: string;
  lugarId: string;
  lat: number;
  lng: number;
};

/** Minúsculas, sin acentos ni signos: «Mérida» = «merida», «San José» = «san jose». */
export function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lee y limpia un lugar que llegó de fuera. Devuelve null si no es un lugar válido del contrato
 * (país sin catálogo, estado que no existe en ese país, ciudad vacía o coordenadas imposibles).
 */
export function leerLugarCuenta(x: unknown): LugarCuenta | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const pais = String(o.pais ?? '').toUpperCase();
  if (pais !== 'VE' && pais !== 'US') return null;
  const estado = estadoDelPais(pais, typeof o.estado === 'string' ? o.estado : '');
  if (!estado) return null;
  const ciudad = typeof o.ciudad === 'string' ? o.ciudad.trim().slice(0, 80) : '';
  if (ciudad.length < 2) return null;
  const lugarId = typeof o.lugarId === 'string' ? o.lugarId.trim() : '';
  if (!/^[a-z]{2,4}:[A-Za-z0-9_-]{1,24}$/.test(lugarId)) return null;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null;
  const municipio =
    typeof o.municipio === 'string' && o.municipio.trim() ? o.municipio.trim().slice(0, 80) : null;
  return { pais, estado: estado.codigo, municipio, ciudad, lugarId, lat, lng };
}

/** «Maracaibo, Zulia» / «Novi, Michigan (MI)»: como se le muestra a la persona y al equipo. */
export function lugarEscrito(l: Pick<LugarCuenta, 'pais' | 'estado' | 'ciudad'>): string {
  const e = estadoDelPais(l.pais, l.estado);
  if (!e) return l.ciudad;
  return l.pais === 'US' ? `${l.ciudad}, ${e.nombre} (${e.codigo})` : `${l.ciudad}, ${e.nombre}`;
}
