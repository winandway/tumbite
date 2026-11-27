import { type Idioma, enIdioma } from './idiomas';
import { NOMBRES_COMERCIO, TIPOS_COMERCIO, type TipoComercio } from './tiendas';

/**
 * Divoox Merchant (C-MERCHANT-PALABRAS, 27 nov 2026). Todos los países.
 *
 * Una sola app para todos los comercios. Las palabras salen del tipo de negocio, nunca escritas
 * sueltas en cada pantalla: un restaurante ve «Menú» y «platos»; un mercado, una farmacia o una
 * ferretería ven «Catálogo» y «productos». Es el estándar de DoorDash Merchant y Uber Eats Manager
 * (el menú de un restaurante, el catálogo de una tienda).
 */

/** Los tipos que se ofrecen al crear la cuenta, en este orden (Restaurante primero). */
export const TIPOS_ALTA = [
  'restaurante',
  'mercado',
  'farmacia',
  'licores',
  'ferreteria',
  'tienda',
  'otro',
] as const satisfies readonly TipoComercio[];

/** Nombre corto del tipo para la lista del alta (Mercado, no «Supermercado o mercado»). */
const NOMBRE_ALTA: Record<(typeof TIPOS_ALTA)[number], { es: string; en: string }> = {
  restaurante: { es: 'Restaurante', en: 'Restaurant' },
  mercado: { es: 'Mercado', en: 'Grocery' },
  farmacia: { es: 'Farmacia', en: 'Pharmacy' },
  licores: { es: 'Licorería', en: 'Liquor store' },
  ferreteria: { es: 'Ferretería', en: 'Hardware store' },
  tienda: { es: 'Tienda', en: 'Store' },
  otro: { es: 'Otro', en: 'Other' },
};

export function esTipoComercio(x: unknown): x is TipoComercio {
  return typeof x === 'string' && (TIPOS_COMERCIO as readonly string[]).includes(x);
}

/** Nombre visible de un tipo (los del alta con su nombre corto; los demás, el largo). */
export function nombreTipoComercio(tipo: string, idioma: Idioma): string {
  const corto = new Map(Object.entries(NOMBRE_ALTA)).get(tipo);
  if (corto) return enIdioma(corto, idioma);
  const largo = new Map(Object.entries(NOMBRES_COMERCIO)).get(tipo);
  return enIdioma(largo ?? NOMBRE_ALTA.otro, idioma);
}

/** ¿Este comercio trabaja con menú de platos? Solo el restaurante. Sin tipo = restaurante (los de siempre). */
export function conMenu(tipo: string | null | undefined): boolean {
  return !tipo || tipo === 'restaurante';
}

export type PalabrasComercio = {
  /** «Menú» / «Catálogo» (pestaña y títulos). */
  menu: string;
  miMenu: string;
  /** «plato» / «producto» y su plural, en minúscula. */
  articulo: string;
  articulos: string;
  /** «Plato» / «Producto», para títulos y botones. */
  Articulo: string;
  agregarArticulo: string;
  /** «restaurante» / «comercio». */
  negocio: string;
  miNegocio: string;
  nombreNegocio: string;
  telefonoNegocio: string;
  fotoNegocio: string;
  /** «Tipo de comida» / «Categoría». */
  categoria: string;
  /** Preparar un pedido: «en preparación» / «preparando el pedido». */
  prep: string;
};

const RESTAURANTE: Record<Idioma, PalabrasComercio> = {
  es: {
    menu: 'Menú',
    miMenu: 'Mi menú',
    articulo: 'plato',
    articulos: 'platos',
    Articulo: 'Plato',
    agregarArticulo: 'Agregar plato',
    negocio: 'restaurante',
    miNegocio: 'Mi restaurante',
    nombreNegocio: 'Nombre del restaurante',
    telefonoNegocio: 'Teléfono del restaurante',
    fotoNegocio: 'Foto de portada del restaurante',
    categoria: 'Tipo de comida',
    prep: 'Minutos de preparación promedio',
  },
  en: {
    menu: 'Menu',
    miMenu: 'My menu',
    articulo: 'dish',
    articulos: 'dishes',
    Articulo: 'Dish',
    agregarArticulo: 'Add dish',
    negocio: 'restaurant',
    miNegocio: 'My restaurant',
    nombreNegocio: 'Restaurant name',
    telefonoNegocio: 'Restaurant phone',
    fotoNegocio: 'Restaurant cover photo',
    categoria: 'Cuisine',
    prep: 'Average prep time (minutes)',
  },
};

const COMERCIO: Record<Idioma, PalabrasComercio> = {
  es: {
    menu: 'Catálogo',
    miMenu: 'Mi catálogo',
    articulo: 'producto',
    articulos: 'productos',
    Articulo: 'Producto',
    agregarArticulo: 'Agregar producto',
    negocio: 'comercio',
    miNegocio: 'Mi comercio',
    nombreNegocio: 'Nombre del comercio',
    telefonoNegocio: 'Teléfono del comercio',
    fotoNegocio: 'Foto de portada del comercio',
    categoria: 'Categoría',
    prep: 'Minutos para preparar un pedido',
  },
  en: {
    menu: 'Catalog',
    miMenu: 'My catalog',
    articulo: 'product',
    articulos: 'products',
    Articulo: 'Product',
    agregarArticulo: 'Add product',
    negocio: 'store',
    miNegocio: 'My store',
    nombreNegocio: 'Store name',
    telefonoNegocio: 'Store phone',
    fotoNegocio: 'Store cover photo',
    categoria: 'Category',
    prep: 'Minutes to get an order ready',
  },
};

/** Las palabras de la app y del panel según el tipo de negocio. */
export function palabrasComercio(
  tipo: string | null | undefined,
  idioma: Idioma,
): PalabrasComercio {
  return enIdioma(conMenu(tipo) ? RESTAURANTE : COMERCIO, idioma);
}
