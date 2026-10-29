import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-TIENDAS-VITRINA · todos los países: el cliente ve las tiendas cercanas del servicio, sus pasillos
 * y solo lo disponible; la receta médica nunca sale; el servicio solo se enciende en pruebas.
 */
const EN_MIAMI = 'lat=25.78&lng=-80.2';
const HOJA = [
  'sku,name,brand,category_1,price,sale_price,available,restriction,sold_by,average_weight',
  'B1,Spring water,Brand Sample,Drinks,1.25,,yes,,,',
  'B2,Bananas,Brand Sample,Produce,0.70,,yes,,weight,2',
  'B3,Sold out soda,Brand Sample,Drinks,2,,no,,,',
  'B4,Rx medicine,Brand Sample,Pharmacy,9,,yes,prescription,,',
  'B5,Orange juice,Brand Sample,Drinks,4,3.50,yes,,,',
].join('\n');

async function escenario(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin');
  const dueno = await m.cuenta('restaurante');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const tid = r.datos.restaurante.id as string;
  await m.llamar('PUT', '/datos/mi-restaurante/tipo', { tipo: 'mercado' }, dueno.token);
  const imp = await m.llamar(
    'POST',
    '/datos/mi-restaurante/productos/importar',
    { csv: HOJA, confirmar: true },
    dueno.token,
  );
  expect(imp.datos.guardado).toBe(true);
  await m.llamar('PATCH', `/datos/admin/restaurantes/${tid}`, { estado: 'aprobado' }, admin.token);
  await m.abrir(dueno.token);
  return { m, tid, dueno };
}

describe('C-TIENDAS-VITRINA · lo que ve el cliente', () => {
  it('las tiendas cercanas del servicio, con sus pasillos y solo lo disponible', async () => {
    const { m, tid } = await escenario();
    const lista = await m.llamar('GET', `/datos/tiendas?servicio=mercado&${EN_MIAMI}`);
    expect(lista.estado).toBe(200);
    expect(lista.datos.tiendas).toHaveLength(1);
    expect(lista.datos.tiendas[0]).toMatchObject({ id: tid, abierto: true, productos: 3 });
    // Otro servicio no la muestra.
    expect(
      (await m.llamar('GET', `/datos/tiendas?servicio=farmacia&${EN_MIAMI}`)).datos.tiendas,
    ).toHaveLength(0);

    const ficha = await m.llamar('GET', `/datos/tiendas/${tid}`);
    expect(ficha.datos.pasillos).toEqual([
      { nombre: 'Drinks', n: 2 },
      { nombre: 'Produce', n: 1 },
    ]);

    const prods = await m.llamar('GET', `/datos/tiendas/${tid}/productos`);
    const nombres = prods.datos.productos.map((p: { nombre: string }) => p.nombre);
    expect(nombres).not.toContain('Sold out soda');
    expect(nombres).not.toContain('Rx medicine');
    const jugo = prods.datos.productos.find((p: { nombre: string }) => p.nombre === 'Orange juice');
    expect(jugo).toMatchObject({ precio: 350, precioAntes: 400 });
    const guineo = prods.datos.productos.find((p: { nombre: string }) => p.nombre === 'Bananas');
    expect(guineo).toMatchObject({ vendidoPor: 'weight', precio: 70, precioEstimado: 140 });

    const pasillo = await m.llamar('GET', `/datos/tiendas/${tid}/productos?categoria=Produce`);
    expect(pasillo.datos.productos).toHaveLength(1);
  });

  it('la búsqueda entre tiendas encuentra el producto y dice dónde está', async () => {
    const { m, tid } = await escenario();
    const r = await m.llamar('GET', `/datos/tiendas-buscar?servicio=mercado&q=juice&${EN_MIAMI}`);
    expect(r.estado).toBe(200);
    expect(r.datos.resultados).toHaveLength(1);
    expect(r.datos.resultados[0]).toMatchObject({ tiendaId: tid, precio: 350 });
    expect(
      (await m.llamar('GET', `/datos/tiendas-buscar?servicio=mercado&q=medicine&${EN_MIAMI}`)).datos
        .resultados,
    ).toHaveLength(0);
  });

  it('en producción las tiendas están apagadas: «muy pronto»', async () => {
    const { m, tid } = await escenario('divoox.com');
    expect((await m.llamar('GET', `/datos/tiendas?servicio=mercado&${EN_MIAMI}`)).estado).toBe(404);
    expect((await m.llamar('GET', `/datos/tiendas/${tid}`)).estado).toBe(404);
  });
});
