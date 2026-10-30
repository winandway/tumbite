import { describe, expect, it } from 'vitest';
import { COLUMNAS_PLANTILLA_MENU, leerPlanillaMenu } from './menuPlanilla';

// C-MENU-PLANILLA (30 oct 2026): cargar el menú desde una hoja de cálculo, como la plantilla de
// menú de DoorDash y Uber Eats (categoría, nombre, descripción, precio), en los dos idiomas.
describe('C-MENU-PLANILLA', () => {
  it('lee la plantilla con comas o punto y coma, en español o inglés, y pasa el precio a centavos', () => {
    const csv = [
      COLUMNAS_PLANTILLA_MENU.join(','),
      'Pizzas,Pizzas,Pizza Margarita,Margherita Pizza,"Tomate, mozzarella",Tomato and mozzarella,12.50,si',
      'Bebidas,Drinks,Limonada,,,,"4,00",no',
    ].join('\n');
    const r = leerPlanillaMenu(csv, 'es');
    expect(r.faltanColumnas).toEqual([]);
    expect(r.errores).toEqual([]);
    expect(r.validos).toEqual([
      expect.objectContaining({
        fila: 2,
        plato: expect.objectContaining({
          categoria: 'Pizzas',
          categoriaEn: 'Pizzas',
          nombreEs: 'Pizza Margarita',
          nombreEn: 'Margherita Pizza',
          descripcionEs: 'Tomate, mozzarella',
          precioCentavos: 1250,
          disponible: true,
        }),
      }),
      expect.objectContaining({
        fila: 3,
        plato: expect.objectContaining({
          nombreEs: 'Limonada',
          precioCentavos: 400,
          disponible: false,
        }),
      }),
    ]);
    const en = leerPlanillaMenu('Category;Item name;Price\nTacos;Fish taco;5.99', 'en');
    expect(en.validos[0]!.plato).toMatchObject({
      categoria: 'Tacos',
      nombreEs: 'Fish taco',
      precioCentavos: 599,
    });
  });

  it('cada fila mala dice por qué, con su número, y no frena las buenas', () => {
    const r = leerPlanillaMenu(
      'nombre_es,precio\nPizza,abc\n,5\nPizza,12\nPizza,13\nCafé,1000000',
      'es',
    );
    expect(r.validos.map((v) => v.fila)).toEqual([4]);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 5, 6]);
    expect(r.errores[0]!.error).toMatch(/precio/i);
    expect(r.errores[2]!.error).toMatch(/repetido/i);
  });

  it('sin columna de nombre o de precio, lo dice', () => {
    expect(leerPlanillaMenu('categoria,descripcion\nA,B', 'es').faltanColumnas).toEqual([
      'name',
      'price',
    ]);
  });
});
