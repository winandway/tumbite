import { describe, expect, it } from 'vitest';
import { PLANTILLA_PRODUCTOS } from '@tumbite/compartido';
import {
  FORM_VACIO,
  type ProductoCat,
  cuerpoProducto,
  estadoExistencias,
  fotoDeProducto,
  plantillaCsv,
  puedeBuscarCodigo,
  resumenImportacion,
  rutaLista,
  skuNuevo,
  tipoDeArchivo,
} from './catalogoLogica';

/** C-MERCHANT-CATALOGO: la lógica pura de la pantalla Catálogo de Divoox Merchant. */
const existente: ProductoCat = {
  id: 'p1',
  sku: 'LECHE-1',
  codigoBarras: '4006381333931',
  nombreEs: 'Leche entera',
  nombreEn: 'Whole milk',
  marca: 'Lala',
  tamano: 1,
  unidadTamano: 'L',
  unidades: 6,
  categoria1: 'Lácteos',
  categoria2: 'Leches',
  imagen: '/media/fotos/c1/abc.webp',
  descripcion: 'Caja de seis',
  vendidoPor: 'each',
  pesoPromedio: null,
  unidadPeso: '',
  restriccion: '',
  abv: null,
  precio: 1250,
  precioOferta: 1100,
  disponible: true,
  existencias: 4,
  pasillo: 'A3',
};

describe('resumenImportacion', () => {
  it('las filas buenas se guardan y las malas no, ordenadas por fila', () => {
    const r = resumenImportacion({
      nuevos: 3,
      actualizados: 2,
      errores: [
        { fila: 9, error: 'Falta el precio' },
        { fila: 4, error: 'SKU repetido' },
      ],
      totalErrores: 2,
      guardado: false,
    });
    expect(r.validas).toBe(5);
    expect(r.conError).toBe(2);
    expect(r.errores.map((e) => e.fila)).toEqual([4, 9]);
    expect(r.puedeGuardar).toBe(true);
    expect(r.ocultos).toBe(0);
  });

  it('si el servidor solo lista los primeros errores, dice cuántos faltan por mostrar', () => {
    const r = resumenImportacion({
      nuevos: 0,
      actualizados: 0,
      errores: [{ fila: 2, error: 'x' }],
      totalErrores: 40,
      guardado: false,
    });
    expect(r.conError).toBe(40);
    expect(r.ocultos).toBe(39);
    expect(r.puedeGuardar).toBe(false);
  });

  it('ya guardado no ofrece guardar otra vez', () => {
    const r = resumenImportacion({
      nuevos: 1,
      actualizados: 0,
      errores: [],
      totalErrores: 0,
      guardado: true,
    });
    expect(r.puedeGuardar).toBe(false);
    expect(r.guardado).toBe(true);
  });
});

describe('plantilla y archivos', () => {
  it('la plantilla trae las columnas del panel y una fila con el mismo número de celdas', () => {
    const [titulos, fila] = plantillaCsv().trim().split('\n');
    expect(titulos).toBe(PLANTILLA_PRODUCTOS.join(','));
    expect(fila?.split(',')).toHaveLength(PLANTILLA_PRODUCTOS.length);
  });

  it('distingue Excel y CSV por nombre o por tipo', () => {
    expect(tipoDeArchivo('Inventario.XLSX')).toBe('xlsx');
    expect(
      tipoDeArchivo('x', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('xlsx');
    expect(tipoDeArchivo('lista.csv')).toBe('csv');
    expect(tipoDeArchivo('lista', 'text/csv')).toBe('csv');
    expect(tipoDeArchivo('foto.png')).toBeNull();
  });
});

describe('código de barras y SKU', () => {
  it('busca la ficha desde 8 dígitos, ignorando espacios y guiones', () => {
    expect(puedeBuscarCodigo('7501 0553')).toBe(true);
    expect(puedeBuscarCodigo('750105')).toBe(false);
  });
  it('el SKU nuevo sale del código o es único', () => {
    expect(skuNuevo('4006-3813-33931')).toBe('bc-4006381333931');
    expect(skuNuevo('', 1000, 0.5)).toMatch(/^app-/);
    expect(skuNuevo('', 1000, 0.1)).not.toBe(skuNuevo('', 1000, 0.9));
  });
});

describe('cuerpoProducto', () => {
  const nuevo = { ...FORM_VACIO, nombre: ' Pan ', categoria: 'Panadería', precio: '2.50' };

  it('un producto nuevo en EE. UU. va en inglés y el precio en centavos enteros', () => {
    const r = cuerpoProducto(nuevo, null, { pais: 'US', moneda: 'USD', sku: 'app-1' });
    expect(r).toMatchObject({
      cuerpo: {
        sku: 'app-1',
        nombreEn: 'Pan',
        precio: 250,
        existencias: null,
        categoria1: 'Panadería',
      },
    });
    if ('cuerpo' in r) expect(r.cuerpo).not.toHaveProperty('nombreEs');
  });

  it('en otro país el nombre va en español', () => {
    const r = cuerpoProducto(nuevo, null, { pais: 'VE', moneda: 'USD', sku: 'app-1' });
    expect(r).toMatchObject({ cuerpo: { nombreEs: 'Pan' } });
  });

  it('al editar conserva lo que la pantalla no muestra (oferta, pasillo, descripción, otro idioma)', () => {
    const r = cuerpoProducto(
      {
        ...nuevo,
        nombre: 'Leche',
        categoria: 'Lácteos',
        existencias: '12',
        codigoBarras: '4006381333931',
      },
      existente,
      { pais: 'US', moneda: 'USD' },
    );
    expect(r).toMatchObject({
      cuerpo: {
        sku: 'LECHE-1',
        nombreEn: 'Leche',
        nombreEs: 'Leche entera',
        precioOferta: 1100,
        pasillo: 'A3',
        descripcion: 'Caja de seis',
        unidades: 6,
        existencias: 12,
        precio: 250,
      },
    });
  });

  it('dice qué casilla está mal', () => {
    const o = { pais: 'US', moneda: 'USD' };
    expect(cuerpoProducto({ ...nuevo, nombre: ' ' }, null, o)).toEqual({
      error: { campo: 'nombre', clave: 'nombre' },
    });
    expect(cuerpoProducto({ ...nuevo, categoria: '' }, null, o)).toMatchObject({
      error: { campo: 'categoria' },
    });
    expect(cuerpoProducto({ ...nuevo, precio: 'abc' }, null, o)).toMatchObject({
      error: { campo: 'precio' },
    });
    expect(cuerpoProducto({ ...nuevo, codigoBarras: '12345678' }, null, o)).toMatchObject({
      error: { campo: 'codigoBarras' },
    });
    expect(cuerpoProducto({ ...nuevo, existencias: '-3' }, null, o)).toMatchObject({
      error: { campo: 'existencias' },
    });
    expect(cuerpoProducto({ ...nuevo, tamano: '0' }, null, o)).toMatchObject({
      error: { campo: 'tamano' },
    });
  });
});

describe('existencias y fotos', () => {
  it('con 0 existencias se ve Agotado aunque esté disponible', () => {
    expect(estadoExistencias({ disponible: true, existencias: 0 })).toBe('agotado');
    expect(estadoExistencias({ disponible: false, existencias: 20 })).toBe('agotado');
    expect(estadoExistencias({ disponible: true, existencias: 3 })).toBe('pocas');
    expect(estadoExistencias({ disponible: true, existencias: 30 })).toBe('ok');
    expect(estadoExistencias({ disponible: true, existencias: null })).toBe('sinConteo');
  });

  it('la foto de Open Food Facts se usa tal cual y la propia pasa por el servidor', () => {
    const url = (r: string) => `https://divoox.test${r}`;
    expect(fotoDeProducto('https://images.off.org/a.jpg', url)).toBe(
      'https://images.off.org/a.jpg',
    );
    expect(fotoDeProducto('/media/fotos/c1/a.webp', url)).toBe(
      'https://divoox.test/media/fotos/c1/a.webp',
    );
    expect(fotoDeProducto('', url)).toBeNull();
  });

  it('la ruta de la lista lleva búsqueda y página', () => {
    expect(rutaLista(' leche ', 2)).toBe(
      '/datos/mi-restaurante/productos?q=leche&categoria=&pagina=2',
    );
  });
});
