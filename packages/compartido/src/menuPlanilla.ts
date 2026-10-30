import { leerCsv } from './flex';
import { montoEscrito } from './dinero';

/**
 * C-MENU-PLANILLA (30 oct 2026): el menú de comida desde una hoja de cálculo, como la plantilla de
 * menú de DoorDash y Uber Eats: categoría, nombre, descripción y precio, en español e inglés. Lo usa
 * el restaurante y, en el alta asistida, nuestro equipo por él. Un plato con el mismo nombre se
 * actualiza; uno nuevo se crea. Cada fila mala dice por qué y no frena las buenas.
 */
export const COLUMNAS_PLANTILLA_MENU = [
  'category_es',
  'category_en',
  'name_es',
  'name_en',
  'description_es',
  'description_en',
  'price',
  'available',
] as const;

export const MAX_FILAS_MENU = 1000;
const PRECIO_MAX = 100_000_00;

const ALIAS = new Map<string, string>([
  ['category_es', 'category_es'],
  ['categoria', 'category_es'],
  ['categoria_es', 'category_es'],
  ['category', 'category_es'],
  ['category_en', 'category_en'],
  ['categoria_en', 'category_en'],
  ['name_es', 'name_es'],
  ['nombre', 'name_es'],
  ['nombre_es', 'name_es'],
  ['plato', 'name_es'],
  ['item_name', 'name_es'],
  ['name', 'name_es'],
  ['item', 'name_es'],
  ['name_en', 'name_en'],
  ['nombre_en', 'name_en'],
  ['description_es', 'description_es'],
  ['descripcion', 'description_es'],
  ['descripcion_es', 'description_es'],
  ['description', 'description_es'],
  ['description_en', 'description_en'],
  ['descripcion_en', 'description_en'],
  ['price', 'price'],
  ['precio', 'price'],
  ['available', 'available'],
  ['disponible', 'available'],
  ['activo', 'available'],
]);

const normal = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');

export type PlatoDePlanilla = {
  categoria: string;
  categoriaEn: string;
  nombreEs: string;
  nombreEn: string;
  descripcionEs: string;
  descripcionEn: string;
  precioCentavos: number;
  disponible: boolean;
};

export function leerPlanillaMenu(texto: string, idioma: 'es' | 'en', moneda = 'USD') {
  const filas = leerCsv(texto);
  const indice = new Map<string, number>();
  (filas[0] ?? []).forEach((c, i) => {
    const clave = ALIAS.get(normal(c));
    if (clave && !indice.has(clave)) indice.set(clave, i);
  });
  const faltanColumnas = (['name', 'price'] as const).filter((c) =>
    c === 'name' ? !indice.has('name_es') && !indice.has('name_en') : !indice.has(c),
  );
  const validos: { fila: number; plato: PlatoDePlanilla }[] = [];
  const errores: { fila: number; error: string }[] = [];
  if (faltanColumnas.length) return { validos, errores, faltanColumnas };
  const en = idioma === 'en';
  const vistos = new Map<string, number>();
  filas.slice(1).forEach((celdas, i) => {
    const fila = i + 2;
    if (celdas.every((x) => !x.trim())) return;
    const de = (c: string, max: number) => {
      const j = indice.get(c);
      return j === undefined ? '' : (celdas.at(j) ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    };
    const nombreEs = de('name_es', 80) || de('name_en', 80);
    const nombreEn = de('name_en', 80);
    if (nombreEs.length < 2)
      return errores.push({
        fila,
        error: en ? 'The item name is missing.' : 'Falta el nombre del plato.',
      });
    const precio = montoEscrito(de('price', 20), moneda);
    if (precio === null || precio > PRECIO_MAX)
      return errores.push({
        fila,
        error: en ? 'The price isn’t valid (e.g. 12.50).' : 'El precio no es válido (ej.: 12.50).',
      });
    const clave = nombreEs.toLowerCase();
    const antes = vistos.get(clave);
    if (antes)
      return errores.push({
        fila,
        error: en
          ? `Repeated item (already in row ${antes}).`
          : `Plato repetido (ya está en la fila ${antes}).`,
      });
    vistos.set(clave, fila);
    const disponible = !/^(no|n|0|false|falso|agotado|sold out)$/i.test(de('available', 20));
    validos.push({
      fila,
      plato: {
        categoria: de('category_es', 40) || de('category_en', 40),
        categoriaEn: de('category_en', 40),
        nombreEs,
        nombreEn,
        descripcionEs: de('description_es', 300) || de('description_en', 300),
        descripcionEn: de('description_en', 300),
        precioCentavos: precio,
        disponible,
      },
    });
  });
  return { validos, errores, faltanColumnas };
}
