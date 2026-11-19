/**
 * C-PERFIL-PERU (19 nov 2026) — Perú. Lo propio del país que no es de un solo servicio: la ciudad de
 * Ica, sus puntos de interés y las validaciones de DNI, celular y placa. El perfil de pasajeros
 * (métodos de pago, papeles y tarifas) vive con los demás países en `perfilPasajeros.ts`.
 *
 * Perú cobra SOLO en soles: no entra en la doble moneda de Venezuela (`MONEDA_REFERENCIA`).
 * Ficha: docs/investigaciones-rea/2026-11-19-ica-peru.md (sección 7).
 */

/** Ica (capital del departamento). Centro en la Plaza de Armas [OBS]; el radio cubre el área urbana. */
export const CIUDAD_ICA = {
  id: 'PE-ICA-ICA',
  nombre: 'Ica',
  pais: 'PE',
  moneda: 'PEN',
  zonaHoraria: 'America/Lima',
  lat: -14.0648,
  lng: -75.7296,
  radioKm: 12,
} as const;

/** El rectángulo del área urbana (de Salas al norte a Pueblo Nuevo al sur) [INF]. */
export const CAJA_ICA = { norte: -13.975, sur: -14.135, oeste: -75.79, este: -75.665 } as const;

export type PuntoDeInteres = { es: string; en: string; lat: number; lng: number };

/**
 * Lugares conocidos de Ica para sugerir como recogida o destino. Coordenadas aproximadas
 * (Wikipedia y OpenStreetMap, 19 nov 2026): son accesos rápidos; el punto exacto lo fija la persona
 * en el mapa.
 */
export const PUNTOS_ICA: readonly PuntoDeInteres[] = [
  { es: 'Plaza de Armas de Ica', en: 'Ica Main Square', lat: -14.0648, lng: -75.7296 },
  { es: 'Laguna de Huacachina', en: 'Huacachina Lagoon', lat: -14.0875, lng: -75.7633 },
  { es: 'Terminales de buses', en: 'Bus terminals', lat: -14.0645, lng: -75.7345 },
  { es: 'Mercado Modelo', en: 'Mercado Modelo', lat: -14.06, lng: -75.727 },
  { es: 'Hospital Regional de Ica', en: 'Ica Regional Hospital', lat: -14.0741, lng: -75.7431 },
  { es: 'Hospital de EsSalud', en: 'EsSalud Hospital', lat: -14.0654, lng: -75.7382 },
  {
    es: 'Hospital Santa María del Socorro',
    en: 'Santa María del Socorro Hospital',
    lat: -14.057,
    lng: -75.7302,
  },
  { es: 'MegaPlaza Ica', en: 'MegaPlaza Ica', lat: -14.0748, lng: -75.7397 },
  {
    es: 'Plaza Vea, Óvalo Ayabaca',
    en: 'Plaza Vea, Ayabaca Roundabout',
    lat: -14.0727,
    lng: -75.7374,
  },
  {
    es: 'Estadio José Picasso Peratta',
    en: 'José Picasso Peratta Stadium',
    lat: -14.0677,
    lng: -75.7388,
  },
  {
    es: 'Universidad San Luis Gonzaga',
    en: 'San Luis Gonzaga University',
    lat: -14.087,
    lng: -75.733,
  },
  {
    es: 'Santuario del Señor de Luren',
    en: 'Lord of Luren Sanctuary',
    lat: -14.0706,
    lng: -75.7256,
  },
  { es: 'Museo Regional de Ica', en: 'Ica Regional Museum', lat: -14.0724, lng: -75.7339 },
  { es: 'Cachiche', en: 'Cachiche', lat: -14.0945, lng: -75.7364 },
  { es: 'Comatrana', en: 'Comatrana', lat: -14.0731, lng: -75.7514 },
  { es: 'Parcona', en: 'Parcona', lat: -14.0483, lng: -75.7071 },
  { es: 'La Tinguiña', en: 'La Tinguiña', lat: -14.039, lng: -75.7121 },
  { es: 'San Juan Bautista', en: 'San Juan Bautista', lat: -14.0113, lng: -75.7351 },
  { es: 'Subtanjalla', en: 'Subtanjalla', lat: -14.0184, lng: -75.7584 },
  { es: 'Los Aquijes', en: 'Los Aquijes', lat: -14.0963, lng: -75.6914 },
  { es: 'Pueblo Nuevo', en: 'Pueblo Nuevo', lat: -14.1271, lng: -75.7059 },
  { es: 'Guadalupe (Salas)', en: 'Guadalupe (Salas)', lat: -13.9851, lng: -75.7705 },
];

/**
 * Destinos entre ciudades desde Ica, con la distancia por carretera [OBS]. Solo referencia para el
 * estudio de viajes entre ciudades: no se ofrecen hasta que Richard lo decida.
 */
export const DESTINOS_DESDE_ICA = [
  { nombre: 'Paracas', km: 71, lat: -13.8341, lng: -76.2489 },
  { nombre: 'Pisco', km: 78, lat: -13.71, lng: -76.203 },
  { nombre: 'Chincha Alta', km: 108, lat: -13.4176, lng: -76.1326 },
  { nombre: 'Nasca', km: 142, lat: -14.8277, lng: -74.9371 },
  { nombre: 'Lima', km: 300, lat: -12.0464, lng: -77.0428 },
] as const;

export const PREFIJO_PERU = '+51';
/** IGV: 18 % [DOC]. */
export const IGV_PERU_PB = 1_800;

const soloCifras = (t: string) => t.replace(/\D/g, '');

/** DNI: ocho cifras exactas [DOC]. */
export function dniPeruValido(texto: string): boolean {
  return /^\d{8}$/.test(texto.trim());
}

/** Celular de Perú: nueve cifras que empiezan por 9, con o sin +51 [DOC]. */
export function telefonoPeruValido(texto: string): boolean {
  const t = texto.trim();
  if (/[^\d+\s()-]/.test(t)) return false;
  let c = soloCifras(t);
  if (t.startsWith('+') || c.length > 9) {
    if (!c.startsWith('51')) return false;
    c = c.slice(2);
  }
  return /^9\d{8}$/.test(c);
}

/** El celular en formato internacional («+51900000000»), o null si no es un celular de Perú. */
export function telefonoPeruInternacional(texto: string): string | null {
  if (!telefonoPeruValido(texto)) return null;
  return `${PREFIJO_PERU}${soloCifras(texto).slice(-9)}`;
}

/**
 * Placa de Perú: el formato está cambiando (seis caracteres hoy, siete en el nuevo [DOC]); se acepta
 * cualquier combinación de seis o siete letras y números, con o sin guion.
 */
export function placaPeruValida(texto: string): boolean {
  const t = texto.trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(t)) return false;
  const c = t.replace(/-/g, '');
  return c.length === 6 || c.length === 7;
}
