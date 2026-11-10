import type { Idioma } from './idiomas';

/**
 * Nombre de cada país en los dos idiomas (C-DISPONIBLE-MUNDO, todos los países). Una sola lista
 * para el servidor, la web y las apps: «Ya funciona en…» y «Avísame cuando llegue» la usan.
 * Un código que no esté aquí se muestra tal cual (nunca un hueco).
 */
export const NOMBRES_PAIS: Record<string, Record<Idioma, string>> = {
  US: { es: 'Estados Unidos', en: 'United States' },
  CA: { es: 'Canadá', en: 'Canada' },
  MX: { es: 'México', en: 'Mexico' },
  PR: { es: 'Puerto Rico', en: 'Puerto Rico' },
  DO: { es: 'República Dominicana', en: 'Dominican Republic' },
  CU: { es: 'Cuba', en: 'Cuba' },
  GT: { es: 'Guatemala', en: 'Guatemala' },
  HN: { es: 'Honduras', en: 'Honduras' },
  SV: { es: 'El Salvador', en: 'El Salvador' },
  NI: { es: 'Nicaragua', en: 'Nicaragua' },
  CR: { es: 'Costa Rica', en: 'Costa Rica' },
  PA: { es: 'Panamá', en: 'Panama' },
  CO: { es: 'Colombia', en: 'Colombia' },
  VE: { es: 'Venezuela', en: 'Venezuela' },
  EC: { es: 'Ecuador', en: 'Ecuador' },
  PE: { es: 'Perú', en: 'Peru' },
  BO: { es: 'Bolivia', en: 'Bolivia' },
  CL: { es: 'Chile', en: 'Chile' },
  AR: { es: 'Argentina', en: 'Argentina' },
  UY: { es: 'Uruguay', en: 'Uruguay' },
  PY: { es: 'Paraguay', en: 'Paraguay' },
  BR: { es: 'Brasil', en: 'Brazil' },
  ES: { es: 'España', en: 'Spain' },
  PT: { es: 'Portugal', en: 'Portugal' },
  FR: { es: 'Francia', en: 'France' },
  IT: { es: 'Italia', en: 'Italy' },
  DE: { es: 'Alemania', en: 'Germany' },
  GB: { es: 'Reino Unido', en: 'United Kingdom' },
};

const POR_CODIGO = new Map(Object.entries(NOMBRES_PAIS));

export function nombrePais(codigo: string, idioma: Idioma): string {
  const c = codigo.trim().toUpperCase();
  const nombre = POR_CODIGO.get(c);
  return nombre ? (idioma === 'en' ? nombre.en : nombre.es) : c;
}

/** Lo que responde «/datos/disponibilidad»: dónde ya funciona Divoox y qué abre pronto. */
export type Disponibilidad = {
  paises: { codigo: string; nombre: Record<Idioma, string>; ciudades: string[] }[];
  proximas: { ciudad: string; pais: string; apertura: string | null }[];
};

/** «Miami (Estados Unidos)» por país, en una sola frase para la app y la web. */
export function fraseDisponibilidad(d: Disponibilidad, idioma: Idioma): string {
  return d.paises
    .map((p) => `${p.ciudades.join(', ')} (${idioma === 'en' ? p.nombre.en : p.nombre.es})`)
    .join(' · ');
}
