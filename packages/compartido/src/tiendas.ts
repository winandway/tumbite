import { leerCsv } from './flex';

/**
 * Tiendas de Divoox (mercado, farmacia, licores, ferretería y más) · Fase 1: el catálogo
 * (C-TIENDAS-CATALOGO). Todos los países (EE. UU., Venezuela y Colombia al abrir). Copia el estándar
 * publicado por DoorDash, Uber Eats, Rappi e Instacart
 * (docs/investigaciones-rea/2026-10-28-tiendas-fuentes-publicas.md): la FICHA del producto va una
 * vez y la OFERTA (precio, si hay, existencias, pasillo) va por tienda; el código de barras es la
 * llave; un producto nunca se borra, se agota.
 */

export const TIPOS_COMERCIO = [
  'restaurante',
  'mercado',
  'conveniencia',
  'farmacia',
  'licores',
  'ferreteria',
  'mascotas',
  'belleza',
  'tienda',
] as const;
export type TipoComercio = (typeof TIPOS_COMERCIO)[number];

/** El servicio del inicio del cliente donde sale cada tipo de comercio. */
export function servicioDeComercio(tipo: string): string {
  if (tipo === 'restaurante') return 'comida';
  if (tipo === 'mercado' || tipo === 'conveniencia') return 'mercado';
  if (tipo === 'farmacia') return 'farmacia';
  if (tipo === 'licores') return 'licores';
  return 'mas';
}

export const NOMBRES_COMERCIO: Record<TipoComercio, { es: string; en: string }> = {
  restaurante: { es: 'Restaurante', en: 'Restaurant' },
  mercado: { es: 'Supermercado o mercado', en: 'Grocery store' },
  conveniencia: { es: 'Tienda de conveniencia', en: 'Convenience store' },
  farmacia: { es: 'Farmacia', en: 'Pharmacy' },
  licores: { es: 'Licorería', en: 'Liquor store' },
  ferreteria: { es: 'Ferretería', en: 'Hardware store' },
  mascotas: { es: 'Tienda de mascotas', en: 'Pet store' },
  belleza: { es: 'Belleza y cuidado personal', en: 'Beauty and personal care' },
  tienda: { es: 'Otra tienda', en: 'Other store' },
};

export const UNIDADES_TAMANO = [
  'each',
  'oz',
  'fl oz',
  'lb',
  'g',
  'kg',
  'mL',
  'L',
  'gal',
  'in',
  'cm',
  'm',
] as const;
export const RESTRICCIONES = ['', 'alcohol', 'tobacco', 'otc_medicine', 'prescription'] as const;
export type Restriccion = (typeof RESTRICCIONES)[number];
/** Los medicamentos con receta quedan APAGADOS hasta una orden legal de Richard. */
export const RESTRICCIONES_BLOQUEADAS: readonly string[] = ['prescription'];

/** Columnas de la planilla (estándar Divoox, de DoorDash e Instacart), con sus nombres en español. */
export const COLUMNAS_PRODUCTOS: Record<string, readonly string[]> = {
  sku: ['sku', 'codigo_interno', 'código interno', 'referencia'],
  barcode: ['barcode', 'codigo_barras', 'código de barras', 'upc', 'ean', 'gtin', 'lookup_code'],
  name: ['name', 'nombre', 'producto'],
  name_es: ['name_es', 'nombre_es'],
  name_en: ['name_en', 'nombre_en'],
  brand: ['brand', 'marca', 'brand_name'],
  size: ['size', 'tamano', 'tamaño', 'contenido'],
  size_unit: ['size_unit', 'unidad_tamano', 'unidad', 'size_uom'],
  pack_count: ['pack_count', 'unidades', 'unit_count'],
  category_1: ['category_1', 'categoria', 'categoría', 'categoria_1', 'pasillo_principal'],
  category_2: ['category_2', 'subcategoria', 'subcategoría', 'categoria_2'],
  image_url: ['image_url', 'imagen', 'foto', 'image'],
  description: ['description', 'descripcion', 'descripción'],
  sold_by: ['sold_by', 'vendido_por', 'se_vende_por'],
  average_weight: ['average_weight', 'peso_promedio'],
  weight_unit: ['weight_unit', 'unidad_peso'],
  restriction: ['restriction', 'restriccion', 'restricción'],
  abv: ['abv', 'grados', 'alcohol_vol'],
  price: ['price', 'precio', 'cost_price_per_unit'],
  sale_price: ['sale_price', 'precio_oferta'],
  available: ['available', 'disponible'],
  stock_quantity: ['stock_quantity', 'existencias', 'stock', 'inventario'],
  aisle: ['aisle', 'pasillo'],
};

/** El encabezado de la plantilla que se descarga desde el panel. */
export const PLANTILLA_PRODUCTOS = [
  'sku',
  'barcode',
  'name',
  'brand',
  'size',
  'size_unit',
  'pack_count',
  'category_1',
  'category_2',
  'image_url',
  'description',
  'sold_by',
  'average_weight',
  'weight_unit',
  'restriction',
  'price',
  'available',
  'stock_quantity',
  'aisle',
] as const;

/** ¿El código de barras es un GTIN válido (8, 12, 13 o 14 dígitos con su dígito verificador)? */
export function codigoBarrasValido(t: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(t)) return false;
  const d = t.split('').map(Number);
  const control = d.pop() as number;
  let suma = 0;
  for (let i = d.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3)
    suma += (d.at(i) ?? 0) * peso;
  return (10 - (suma % 10)) % 10 === control;
}

/** «Código de barras», «codigo_barras» y «CODIGO DE BARRAS» son el mismo encabezado. */
const normalEncabezado = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');

export function mapearColumnasProductos(encabezados: string[]): Record<string, number> {
  const mapa = new Map<string, number>();
  encabezados.forEach((h, i) => {
    const n = normalEncabezado(h);
    for (const [campo, alias] of Object.entries(COLUMNAS_PRODUCTOS))
      if (alias.map(normalEncabezado).includes(n) && !mapa.has(campo)) mapa.set(campo, i);
  });
  return Object.fromEntries(mapa);
}

export type FichaProducto = {
  sku: string;
  codigoBarras: string;
  nombreEs: string;
  nombreEn: string;
  marca: string;
  tamano: number | null;
  unidadTamano: string;
  unidades: number;
  categoria1: string;
  categoria2: string;
  imagen: string;
  descripcion: string;
  vendidoPor: 'each' | 'weight';
  pesoPromedio: number | null;
  unidadPeso: string;
  restriccion: Restriccion;
  abv: number | null;
};
export type OfertaProducto = {
  precio: number;
  precioOferta: number | null;
  disponible: boolean;
  existencias: number | null;
  pasillo: string;
};

const SI = ['1', 'si', 'sí', 'true', 't', 'y', 'yes'];
const NO = ['0', 'no', 'false', 'f', 'n'];

/** «2.50», «2,50» o «$2.50» → 250 centavos (la unidad menor de la moneda de la tienda). */
export function precioACentavos(t: string): number | null {
  const limpio = t.replace(/[^\d.,-]/g, '').replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * Una fila de la planilla → ficha (y oferta si trae precio), o el error en palabras. `idioma` es el
 * del país de la tienda: el nombre principal va en ese idioma (EE. UU. inglés).
 */
export function filaDeProducto(
  celdas: string[],
  mapa: Record<string, number>,
  idioma: 'es' | 'en',
  /** El idioma de quien sube la planilla (los avisos de error); por defecto el de la tienda. */
  idiomaMensajes: 'es' | 'en' = idioma,
): { ficha: FichaProducto; oferta: OfertaProducto | null; error: null } | { error: string } {
  const tx = (es: string, en: string) => (idiomaMensajes === 'en' ? en : es);
  const v = (campo: string) => {
    // eslint-disable-next-line security/detect-object-injection -- campo de la lista cerrada
    const i = mapa[campo];
    return i === undefined ? '' : (celdas.at(i) ?? '').trim();
  };
  const sku = v('sku');
  if (!sku)
    return {
      error: tx(
        'Falta el SKU (código interno del producto).',
        'The SKU (internal product code) is missing.',
      ),
    };
  if (sku.length > 64)
    return { error: tx('El SKU es demasiado largo (máximo 64).', 'The SKU is too long (64 max).') };
  const codigoBarras = v('barcode').replace(/\s/g, '');
  if (codigoBarras && !codigoBarrasValido(codigoBarras))
    return {
      error: tx(
        `El código de barras ${codigoBarras} no es válido (revisa el último dígito).`,
        `Barcode ${codigoBarras} isn’t valid (check the last digit).`,
      ),
    };
  const nombre = v('name');
  const nombreEs = v('name_es') || (idioma === 'es' ? nombre : '');
  const nombreEn = v('name_en') || (idioma === 'en' ? nombre : '');
  if (!nombreEs && !nombreEn)
    return { error: tx('Falta el nombre del producto.', 'The product name is missing.') };
  if ((nombreEs || nombreEn).length > 100)
    return { error: tx('El nombre pasa de 100 caracteres.', 'The name is over 100 characters.') };
  const marca = v('brand');
  const tamanoT = v('size');
  const tamano = tamanoT ? Number(tamanoT.replace(',', '.')) : null;
  if (tamano !== null && !(tamano > 0))
    return { error: tx('El tamaño debe ser un número.', 'The size must be a number.') };
  const unidadTamano = v('size_unit') || 'each';
  if (!(UNIDADES_TAMANO as readonly string[]).includes(unidadTamano))
    return {
      error: tx(
        `La unidad «${unidadTamano}» no es válida (usa each, oz, lb, g, kg, mL, L…).`,
        `Unit “${unidadTamano}” isn’t valid (use each, oz, lb, g, kg, mL, L…).`,
      ),
    };
  const unidadesT = v('pack_count');
  const unidades = unidadesT ? Number(unidadesT) : 1;
  if (!Number.isInteger(unidades) || unidades < 1)
    return {
      error: tx(
        'Las unidades por paquete deben ser un número entero.',
        'Units per pack must be a whole number.',
      ),
    };
  const categoria1 = v('category_1');
  if (!categoria1)
    return {
      error: tx(
        'Falta la categoría (por ejemplo «Bebidas»).',
        'The category is missing (for example “Drinks”).',
      ),
    };
  const vendidoPorT = (v('sold_by') || 'each').toLowerCase();
  const vendidoPor = ['weight', 'peso'].includes(vendidoPorT) ? 'weight' : 'each';
  const pesoT = v('average_weight');
  const pesoPromedio = pesoT ? Number(pesoT.replace(',', '.')) : null;
  if (vendidoPor === 'weight' && !(pesoPromedio && pesoPromedio > 0))
    return {
      error: tx(
        'Si se vende por peso, escribe el peso promedio.',
        'If it’s sold by weight, enter the average weight.',
      ),
    };
  const restriccionT = v('restriction').toLowerCase();
  if (!(RESTRICCIONES as readonly string[]).includes(restriccionT))
    return {
      error: tx(
        `La restricción «${restriccionT}» no es válida (alcohol, tobacco u otc_medicine).`,
        `Restriction “${restriccionT}” isn’t valid (alcohol, tobacco or otc_medicine).`,
      ),
    };
  if (RESTRICCIONES_BLOQUEADAS.includes(restriccionT))
    return {
      error: tx(
        'Los medicamentos con receta todavía no se pueden vender en Divoox.',
        'Prescription medicines can’t be sold on Divoox yet.',
      ),
    };
  const abvT = v('abv');
  const imagen = v('image_url');
  if (imagen && !/^https:\/\/\S+$/.test(imagen))
    return {
      error: tx(
        'La foto debe ser una dirección que empiece por https://.',
        'The photo must be an address starting with https://.',
      ),
    };
  const precioT = v('price');
  let oferta: OfertaProducto | null = null;
  if (precioT) {
    const precio = precioACentavos(precioT);
    if (precio === null)
      return {
        error: tx(
          `El precio «${precioT}» no es un número.`,
          `The price “${precioT}” isn’t a number.`,
        ),
      };
    const ofertaT = v('sale_price');
    const precioOferta = ofertaT ? precioACentavos(ofertaT) : null;
    if (ofertaT && precioOferta === null)
      return {
        error: tx('El precio de oferta no es un número.', 'The sale price isn’t a number.'),
      };
    const dispT = v('available').toLowerCase();
    if (dispT && !SI.includes(dispT) && !NO.includes(dispT))
      return {
        error: tx(
          `«${dispT}» en disponible: usa sí o no.`,
          `“${dispT}” in available: use yes or no.`,
        ),
      };
    const existT = v('stock_quantity');
    const existencias = existT ? Number(existT) : null;
    if (existencias !== null && (!Number.isInteger(existencias) || existencias < 0))
      return {
        error: tx('Las existencias deben ser un número entero.', 'Stock must be a whole number.'),
      };
    oferta = {
      precio,
      precioOferta,
      disponible: dispT ? SI.includes(dispT) : true,
      existencias,
      pasillo: v('aisle').slice(0, 60),
    };
  }
  return {
    ficha: {
      sku,
      codigoBarras,
      nombreEs: nombreEs.slice(0, 100),
      nombreEn: nombreEn.slice(0, 100),
      marca: marca.slice(0, 100),
      tamano,
      unidadTamano,
      unidades,
      categoria1: categoria1.slice(0, 60),
      categoria2: v('category_2').slice(0, 60),
      imagen,
      descripcion: v('description').slice(0, 1000),
      vendidoPor,
      pesoPromedio,
      unidadPeso: v('weight_unit') || (vendidoPor === 'weight' ? 'kg' : ''),
      restriccion: restriccionT as Restriccion,
      abv: abvT ? Number(abvT.replace(',', '.')) || null : null,
    },
    oferta,
    error: null,
  };
}

/** La planilla completa: filas válidas y errores por fila (la fila 1 es la de los encabezados). */
export function leerPlanillaProductos(
  texto: string,
  idioma: 'es' | 'en',
  idiomaMensajes: 'es' | 'en' = idioma,
) {
  const filas = leerCsv(texto);
  const mapa = mapearColumnasProductos(filas[0] ?? []);
  const validas: { fila: number; ficha: FichaProducto; oferta: OfertaProducto | null }[] = [];
  const errores: { fila: number; error: string }[] = [];
  const vistos = new Map<string, number>();
  filas.slice(1).forEach((celdas, i) => {
    const numero = i + 2;
    if (celdas.every((x) => !x.trim())) return;
    const r = filaDeProducto(celdas, mapa, idioma, idiomaMensajes);
    if (r.error !== null) return errores.push({ fila: numero, error: r.error });
    const antes = vistos.get(r.ficha.sku);
    if (antes)
      return errores.push({
        fila: numero,
        error:
          idiomaMensajes === 'en'
            ? `Repeated SKU (already in row ${antes}).`
            : `SKU repetido (ya está en la fila ${antes}).`,
      });
    vistos.set(r.ficha.sku, numero);
    validas.push({ fila: numero, ficha: r.ficha, oferta: r.oferta });
  });
  const columnas = new Map(Object.entries(mapa));
  const faltan = ['sku', 'name', 'category_1'].filter(
    (c) =>
      !columnas.has(c) &&
      !(c === 'name' && (mapa.name_es !== undefined || mapa.name_en !== undefined)),
  );
  return { validas, errores, faltanColumnas: faltan };
}

/** Los servicios de tienda (todos menos comida) y qué tipos de comercio entran en cada uno. */
export const SERVICIOS_TIENDA = ['mercado', 'farmacia', 'licores', 'mas'] as const;
export const tiposDeServicio = (servicio: string): TipoComercio[] =>
  TIPOS_COMERCIO.filter((t) => t !== 'restaurante' && servicioDeComercio(t) === servicio);

/** Precio de un artículo por peso, estimado con el peso promedio (se ajusta al pesar). */
export const precioEstimado = (precio: number, vendidoPor: string, pesoPromedio: number | null) =>
  vendidoPor === 'weight' && pesoPromedio ? Math.round(precio * pesoPromedio) : precio;

/** Qué hacer si falta un artículo (lo elige el cliente por artículo, como DoorDash y Uber Eats). */
export const SUSTITUCIONES = ['reembolsar', 'similar', 'contactar'] as const;
export type Sustitucion = (typeof SUSTITUCIONES)[number];
