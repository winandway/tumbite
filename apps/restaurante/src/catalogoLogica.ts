import {
  PLANTILLA_PRODUCTOS,
  UNIDADES_TAMANO,
  codigoBarrasValido,
  montoEscrito,
} from '@tumbite/compartido';

/**
 * C-MERCHANT-CATALOGO (27 nov 2026). Todos los países.
 *
 * La lógica pura de la pantalla Catálogo de Divoox Merchant (sin React Native, para probarla sola):
 * armar el cuerpo del producto, el resumen de la importación, la plantilla y el tipo de archivo.
 * El dinero va siempre en centavos enteros (unidad menor de la moneda del comercio).
 */

export type ProductoCat = {
  id: string;
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
  vendidoPor: string;
  pesoPromedio: number | null;
  unidadPeso: string;
  restriccion: string;
  abv: number | null;
  precio: number | null;
  precioOferta: number | null;
  disponible: boolean;
  existencias: number | null;
  pasillo: string;
};

export type ListaCat = {
  tipo: string;
  pais: string;
  moneda: string;
  productos: ProductoCat[];
  hayMas: boolean;
  pagina: number;
  totales: { productos: number; disponibles: number; sinFoto: number };
  categorias: { nombre: string; n: number }[];
};

export type RespuestaImportacion = {
  nuevos: number;
  actualizados: number;
  errores: { fila: number; error: string }[];
  totalErrores: number;
  guardado: boolean;
};

export type ResumenImportacion = {
  nuevos: number;
  actualizados: number;
  /** Cuántas filas se guardan (o se guardaron). */
  validas: number;
  /** Cuántas filas tienen error y NO se guardan. */
  conError: number;
  errores: { fila: number; error: string }[];
  /** Errores que el servidor no listó (solo manda los primeros). */
  ocultos: number;
  guardado: boolean;
  /** Hay algo para guardar. */
  puedeGuardar: boolean;
};

/** Lo que el servidor contestó a la planilla, listo para mostrar. Las filas malas no se guardan. */
export function resumenImportacion(r: RespuestaImportacion): ResumenImportacion {
  const errores = [...r.errores].sort((a, b) => a.fila - b.fila);
  const conError = Math.max(r.totalErrores, errores.length);
  const validas = r.nuevos + r.actualizados;
  return {
    nuevos: r.nuevos,
    actualizados: r.actualizados,
    validas,
    conError,
    errores,
    ocultos: Math.max(0, conError - errores.length),
    guardado: r.guardado,
    puedeGuardar: !r.guardado && validas > 0,
  };
}

/** Una fila de ejemplo con las mismas 19 columnas de la plantilla del panel. */
const FILA_EJEMPLO = [
  'SKU-0001',
  '',
  'Producto de ejemplo',
  'Marca',
  '500',
  'g',
  '1',
  'Despensa',
  '',
  '',
  '',
  'each',
  '',
  '',
  '',
  '2.50',
  'yes',
  '10',
  '',
];

/** El mismo CSV de plantilla que descarga el panel (títulos y una fila de muestra). */
export function plantillaCsv(): string {
  return `${PLANTILLA_PRODUCTOS.join(',')}\n${FILA_EJEMPLO.join(',')}\n`;
}

export type TipoArchivo = 'xlsx' | 'csv';

/** ¿Es un Excel o un CSV? Se mira el nombre y, si el sistema lo dio, el tipo. */
export function tipoDeArchivo(nombre: string, mime?: string | null): TipoArchivo | null {
  const n = nombre.trim().toLowerCase();
  const m = (mime ?? '').toLowerCase();
  if (n.endsWith('.xlsx') || m.includes('spreadsheetml')) return 'xlsx';
  if (n.endsWith('.csv') || m === 'text/csv' || m === 'text/comma-separated-values') return 'csv';
  return null;
}

/** Quita lo que no es dígito (los lectores a veces dejan espacios o guiones). */
export const digitosCodigo = (x: string) => x.replace(/\D/g, '');

/** Con 8 o más dígitos ya se puede buscar la ficha por el código. */
export const puedeBuscarCodigo = (x: string) => digitosCodigo(x).length >= 8;

/** SKU interno de un producto nuevo: el código de barras si hay, o uno único. */
export function skuNuevo(codigo: string, ahora: number = Date.now(), azar: number = Math.random()) {
  const c = digitosCodigo(codigo);
  if (c) return `bc-${c}`;
  return `app-${ahora.toString(36)}${Math.floor(azar * 1296)
    .toString(36)
    .padStart(2, '0')}`;
}

export type FormProducto = {
  nombre: string;
  precio: string;
  categoria: string;
  codigoBarras: string;
  existencias: string;
  marca: string;
  tamano: string;
  unidadTamano: string;
  imagen: string;
};

export const FORM_VACIO: FormProducto = {
  nombre: '',
  precio: '',
  categoria: '',
  codigoBarras: '',
  existencias: '',
  marca: '',
  tamano: '',
  unidadTamano: 'each',
  imagen: '',
};

/** El nombre en el idioma del país del comercio (EE. UU. en inglés; los demás en español). */
export const idiomaDelPais = (pais: string): 'es' | 'en' => (pais === 'US' ? 'en' : 'es');

export function nombreDeProducto(p: ProductoCat, idioma: 'es' | 'en'): string {
  return (idioma === 'en' ? p.nombreEn || p.nombreEs : p.nombreEs || p.nombreEn) || p.sku;
}

/** La ficha existente, convertida a lo que muestra el formulario. */
export function formDeProducto(p: ProductoCat, pais: string, montoTexto: (c: number) => string) {
  const nombre = idiomaDelPais(pais) === 'en' ? p.nombreEn || p.nombreEs : p.nombreEs || p.nombreEn;
  return {
    nombre,
    precio: p.precio == null ? '' : montoTexto(p.precio),
    categoria: p.categoria1,
    codigoBarras: p.codigoBarras,
    existencias: p.existencias == null ? '' : String(p.existencias),
    marca: p.marca,
    tamano: p.tamano == null ? '' : String(p.tamano),
    unidadTamano: p.unidadTamano || 'each',
    imagen: p.imagen,
  } satisfies FormProducto;
}

export type ErrorCampo = {
  campo: 'nombre' | 'precio' | 'categoria' | 'codigoBarras' | 'existencias' | 'tamano';
  clave: 'nombre' | 'precio' | 'categoria' | 'codigo' | 'existencias' | 'tamano';
};

/**
 * El cuerpo que recibe `PUT /datos/mi-restaurante/productos`. Al EDITAR se manda la ficha completa
 * (el servidor reemplaza todos los campos, así que lo que la pantalla no muestra se conserva).
 */
export function cuerpoProducto(
  f: FormProducto,
  existente: ProductoCat | null,
  opciones: { pais: string; moneda: string; sku?: string },
): { cuerpo: Record<string, unknown> } | { error: ErrorCampo } {
  const nombre = f.nombre.trim();
  if (!nombre) return { error: { campo: 'nombre', clave: 'nombre' } };
  const categoria = f.categoria.trim();
  if (!categoria) return { error: { campo: 'categoria', clave: 'categoria' } };
  const precio = montoEscrito(f.precio, opciones.moneda);
  if (precio === null || precio < 0) return { error: { campo: 'precio', clave: 'precio' } };
  const codigo = digitosCodigo(f.codigoBarras);
  if (codigo && !codigoBarrasValido(codigo))
    return { error: { campo: 'codigoBarras', clave: 'codigo' } };
  const existTexto = f.existencias.trim();
  if (existTexto && !/^\d{1,8}$/.test(existTexto))
    return { error: { campo: 'existencias', clave: 'existencias' } };
  const tamTexto = f.tamano.trim().replace(',', '.');
  const tamano = tamTexto ? Number(tamTexto) : null;
  if (tamano !== null && !(Number.isFinite(tamano) && tamano > 0))
    return { error: { campo: 'tamano', clave: 'tamano' } };
  const unidad = (UNIDADES_TAMANO as readonly string[]).includes(f.unidadTamano)
    ? f.unidadTamano
    : 'each';
  const ingles = idiomaDelPais(opciones.pais) === 'en';
  const base = existente
    ? {
        nombreEs: existente.nombreEs,
        nombreEn: existente.nombreEn,
        unidades: existente.unidades,
        categoria2: existente.categoria2,
        descripcion: existente.descripcion,
        vendidoPor: existente.vendidoPor,
        pesoPromedio: existente.pesoPromedio,
        unidadPeso: existente.unidadPeso,
        restriccion: existente.restriccion,
        abv: existente.abv,
        precioOferta: existente.precioOferta,
        disponible: existente.disponible,
        pasillo: existente.pasillo,
      }
    : {};
  return {
    cuerpo: {
      ...base,
      sku: existente?.sku ?? opciones.sku ?? skuNuevo(codigo),
      codigoBarras: codigo,
      ...(ingles ? { nombreEn: nombre } : { nombreEs: nombre }),
      marca: f.marca.trim(),
      tamano,
      unidadTamano: unidad,
      categoria1: categoria,
      imagen: f.imagen,
      precio,
      existencias: existTexto ? Number(existTexto) : null,
    },
  };
}

export type EstadoExistencias = 'agotado' | 'pocas' | 'ok' | 'sinConteo';

/** Cuando las existencias llegan a 0 se muestra «Agotado», aunque el interruptor esté en disponible. */
export function estadoExistencias(
  p: Pick<ProductoCat, 'disponible' | 'existencias'>,
): EstadoExistencias {
  if (p.existencias !== null && p.existencias <= 0) return 'agotado';
  if (!p.disponible) return 'agotado';
  if (p.existencias === null) return 'sinConteo';
  return p.existencias <= 5 ? 'pocas' : 'ok';
}

/** La foto de un producto: la subida a Divoox (ruta) o la https de Open Food Facts. */
export function fotoDeProducto(
  imagen: string,
  urlFoto: (ruta: string) => string | null,
): string | null {
  if (!imagen) return null;
  if (/^https:\/\/\S+$/.test(imagen)) return imagen;
  return urlFoto(imagen);
}

/** Dirección de la lista: búsqueda y página, igual que el panel. */
export function rutaLista(q: string, pagina: number, categoria = ''): string {
  const p = new URLSearchParams({ q: q.trim(), categoria, pagina: String(pagina) });
  return `/datos/mi-restaurante/productos?${p.toString()}`;
}
