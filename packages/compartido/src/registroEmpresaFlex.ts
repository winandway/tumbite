import { numeroFiscalDe, numeroFiscalValido } from './flexPaises';

/**
 * C-FLEX-REGISTRO-UNICO (1 nov 2026, pedido de Richard): el registro de una empresa de Divoox Flex
 * pide lo mismo en la web (/panel/business) y en la app del cliente: datos legales reales y el
 * primer centro de carga con su punto exacto. Una sola lista de países y una sola validación.
 */
export const PAISES_FLEX = [
  {
    id: 'US',
    es: 'Estados Unidos',
    en: 'United States',
    monedas: ['USD'],
    zona: 'America/New_York',
  },
  { id: 'VE', es: 'Venezuela', en: 'Venezuela', monedas: ['USD', 'VES'], zona: 'America/Caracas' },
  { id: 'CO', es: 'Colombia', en: 'Colombia', monedas: ['COP', 'USD'], zona: 'America/Bogota' },
  { id: 'MX', es: 'México', en: 'Mexico', monedas: ['MXN', 'USD'], zona: 'America/Mexico_City' },
] as const;

export const paisFlex = (id: string) => PAISES_FLEX.find((p) => p.id === id) ?? PAISES_FLEX[0];

export type DatosRegistroEmpresa = {
  nombre: string;
  razonSocial: string;
  pais: string;
  moneda: string;
  numeroFiscal: string;
  direccionFiscal: string;
  representante: string;
  telefono: string;
  centroNombre: string;
  centroDireccion: string;
  centroLat: string;
  centroLng: string;
  ciudad: string;
};

export const REGISTRO_EMPRESA_VACIO: DatosRegistroEmpresa = {
  nombre: '',
  razonSocial: '',
  pais: 'US',
  moneda: 'USD',
  numeroFiscal: '',
  direccionFiscal: '',
  representante: '',
  telefono: '',
  centroNombre: '',
  centroDireccion: '',
  centroLat: '',
  centroLng: '',
  ciudad: '',
};

/** Qué falta para poder crear la empresa, o null si está todo. */
export function faltaEnRegistro(
  v: DatosRegistroEmpresa,
  acepto: boolean,
): { motivo: 'falta' | 'fiscal' | 'centro'; nombre?: string; ejemplo?: string } | null {
  const obligatorios = [
    v.nombre,
    v.razonSocial,
    v.numeroFiscal,
    v.direccionFiscal,
    v.representante,
    v.telefono,
    v.centroNombre,
    v.centroDireccion,
    v.ciudad,
  ];
  if (obligatorios.some((x) => !x.trim()) || !acepto) return { motivo: 'falta' };
  if (!numeroFiscalValido(v.pais, v.numeroFiscal))
    return { motivo: 'fiscal', ...numeroFiscalDe(v.pais) };
  if (!v.centroLat || !v.centroLng) return { motivo: 'centro' };
  return null;
}

/** Lo que se manda al servidor para crear la empresa y su primer centro. */
export function cuerposRegistro(v: DatosRegistroEmpresa) {
  return {
    empresa: {
      nombre: v.nombre.trim(),
      razonSocial: v.razonSocial.trim(),
      pais: v.pais,
      moneda: v.moneda,
      numeroFiscal: v.numeroFiscal.trim(),
      direccionFiscal: v.direccionFiscal.trim(),
      representante: v.representante.trim(),
      telefono: v.telefono.trim(),
    },
    centro: {
      nombre: v.centroNombre.trim(),
      direccion: v.centroDireccion.trim(),
      pais: v.pais,
      ciudad: v.ciudad.trim(),
      lat: Number(v.centroLat),
      lng: Number(v.centroLng),
      zonaHoraria: paisFlex(v.pais).zona,
    },
  };
}
