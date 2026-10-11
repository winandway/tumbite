import type { Idioma } from '@tumbite/compartido';

/**
 * Dónde está Tumbite y a dónde va. Un solo lugar: el pie de página, las páginas por país y
 * por ciudad (SEO) y el mapa del sitio salen de aquí. «activo» se pinta en verde; lo demás, «muy pronto».
 */
export type Estado = 'activo' | 'pronto';
export type Lugar = {
  slug: string;
  nombre: Record<Idioma, string>;
  estado: Estado;
  /** Solo ciudades: país al que pertenece. */
  pais?: string;
  /** Solo países: código de dos letras para las banderas y los formularios. */
  codigo?: string;
};

export const PAISES: Lugar[] = [
  {
    slug: 'estados-unidos',
    nombre: { es: 'Estados Unidos', en: 'United States' },
    estado: 'activo',
    codigo: 'US',
  },
  { slug: 'rumania', nombre: { es: 'Rumanía', en: 'Romania' }, estado: 'pronto', codigo: 'RO' },
  { slug: 'colombia', nombre: { es: 'Colombia', en: 'Colombia' }, estado: 'pronto', codigo: 'CO' },
  { slug: 'mexico', nombre: { es: 'México', en: 'Mexico' }, estado: 'pronto', codigo: 'MX' },
  {
    slug: 'venezuela',
    nombre: { es: 'Venezuela', en: 'Venezuela' },
    estado: 'pronto',
    codigo: 'VE',
  },
  {
    slug: 'guatemala',
    nombre: { es: 'Guatemala', en: 'Guatemala' },
    estado: 'pronto',
    codigo: 'GT',
  },
  { slug: 'bolivia', nombre: { es: 'Bolivia', en: 'Bolivia' }, estado: 'pronto', codigo: 'BO' },
];

export const CIUDADES: Lugar[] = [
  { slug: 'miami', nombre: { es: 'Miami', en: 'Miami' }, estado: 'activo', pais: 'estados-unidos' },
  {
    slug: 'orlando',
    nombre: { es: 'Orlando', en: 'Orlando' },
    estado: 'pronto',
    pais: 'estados-unidos',
  },
  { slug: 'tampa', nombre: { es: 'Tampa', en: 'Tampa' }, estado: 'pronto', pais: 'estados-unidos' },
  { slug: 'ocala', nombre: { es: 'Ocala', en: 'Ocala' }, estado: 'pronto', pais: 'estados-unidos' },
];

/** Tipos de comida que la gente busca (sirven de enlaces internos para el SEO). */
export const COCINAS: { slug: string; nombre: Record<Idioma, string> }[] = [
  { slug: 'pizza', nombre: { es: 'Pizza', en: 'Pizza' } },
  { slug: 'hamburguesas', nombre: { es: 'Hamburguesas', en: 'Burgers' } },
  { slug: 'sushi', nombre: { es: 'Sushi', en: 'Sushi' } },
  { slug: 'cubana', nombre: { es: 'Comida cubana', en: 'Cuban food' } },
  { slug: 'venezolana', nombre: { es: 'Comida venezolana', en: 'Venezuelan food' } },
  { slug: 'colombiana', nombre: { es: 'Comida colombiana', en: 'Colombian food' } },
  { slug: 'mexicana', nombre: { es: 'Comida mexicana', en: 'Mexican food' } },
  { slug: 'pollo', nombre: { es: 'Pollo', en: 'Chicken' } },
  { slug: 'saludable', nombre: { es: 'Saludable', en: 'Healthy' } },
  { slug: 'postres', nombre: { es: 'Postres', en: 'Desserts' } },
  { slug: 'cafe', nombre: { es: 'Café y desayunos', en: 'Coffee and breakfast' } },
  { slug: 'mariscos', nombre: { es: 'Mariscos', en: 'Seafood' } },
];

export const paisDe = (slug: string) => PAISES.find((p) => p.slug === slug) ?? null;
export const ciudadDe = (slug: string) => CIUDADES.find((c) => c.slug === slug) ?? null;
export const cocinaDe = (slug: string) => COCINAS.find((c) => c.slug === slug) ?? null;
