import { describe, expect, it } from 'vitest';
import {
  codigoBarrasValido,
  leerPlanillaProductos,
  precioACentavos,
  servicioDeComercio,
} from './tiendas';

describe('C-TIENDAS-CATALOGO · reglas del catálogo de tiendas (todos los países)', () => {
  it('valida el dígito verificador de los códigos de barras (UPC, EAN y GTIN)', () => {
    expect(codigoBarrasValido('012000161155')).toBe(true); // UPC-A
    expect(codigoBarrasValido('7591016816011')).toBe(true); // EAN-13 de Venezuela
    expect(codigoBarrasValido('7591016816019')).toBe(false);
    expect(codigoBarrasValido('96385074')).toBe(true); // EAN-8
    expect(codigoBarrasValido('12345')).toBe(false);
  });

  it('cada tipo de comercio sale en su servicio', () => {
    expect(servicioDeComercio('mercado')).toBe('mercado');
    expect(servicioDeComercio('conveniencia')).toBe('mercado');
    expect(servicioDeComercio('farmacia')).toBe('farmacia');
    expect(servicioDeComercio('ferreteria')).toBe('mas');
    expect(servicioDeComercio('restaurante')).toBe('comida');
  });

  it('lee el precio como en la factura', () => {
    expect(precioACentavos('2.50')).toBe(250);
    expect(precioACentavos('$2,50')).toBe(250);
    expect(precioACentavos('abc')).toBeNull();
  });

  it('la planilla en español o inglés: filas válidas y errores por fila', () => {
    const hoja = [
      'sku,codigo de barras,nombre,marca,tamaño,unidad,categoria,precio,disponible,existencias,restriccion',
      'A1,7591016816011,Harina de maíz,Marca Ejemplo,1,kg,Despensa,1.80,si,40,',
      'A2,7591016816019,Arroz,Marca Ejemplo,1,kg,Despensa,1.20,si,,',
      'A3,,Cerveza,Marca Ejemplo,355,mL,Bebidas,0.90,si,,alcohol',
      'A4,,Medicamento,Marca Ejemplo,1,each,Farmacia,5,si,,prescription',
      'A1,,Repetido,Marca Ejemplo,1,each,Despensa,1,si,,',
      'A5,,Sin categoría,Marca Ejemplo,1,each,,1,si,,',
    ].join('\n');
    const r = leerPlanillaProductos(hoja, 'es');
    expect(r.faltanColumnas).toEqual([]);
    expect(r.validas.map((x) => x.ficha.sku)).toEqual(['A1', 'A3']);
    expect(r.validas[0]).toMatchObject({
      ficha: { nombreEs: 'Harina de maíz', unidadTamano: 'kg', categoria1: 'Despensa' },
      oferta: { precio: 180, disponible: true, existencias: 40 },
    });
    expect(r.validas[1]?.ficha.restriccion).toBe('alcohol');
    expect(r.errores.map((e) => e.fila)).toEqual([3, 5, 6, 7]);
    expect(r.errores[1]?.error).toMatch(/receta/);
  });

  it('dice qué columnas obligatorias faltan', () => {
    expect(leerPlanillaProductos('marca,precio\nX,1', 'en').faltanColumnas).toEqual([
      'sku',
      'name',
      'category_1',
    ]);
  });
});

describe('C-TIENDAS-VITRINA · servicios y precios', () => {
  it('cada servicio de tienda junta sus tipos de comercio', async () => {
    const { tiposDeServicio, precioEstimado } = await import('./tiendas');
    expect(tiposDeServicio('mercado')).toEqual(['mercado', 'conveniencia']);
    expect(tiposDeServicio('mas')).toEqual(['ferreteria', 'mascotas', 'belleza', 'tienda']);
    expect(precioEstimado(300, 'weight', 1.5)).toBe(450);
    expect(precioEstimado(300, 'each', null)).toBe(300);
  });
});
