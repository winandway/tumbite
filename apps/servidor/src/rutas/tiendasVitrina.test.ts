import { afterEach, describe, expect, it, vi } from 'vitest';
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

async function escenario(host = 'staging.tumbite.com', extra: Record<string, unknown> = {}) {
  const m = mundo(extra, { host });
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

/** Stripe de mentira (modo prueba): nunca se le pega al real. */
function stripeFalso() {
  vi.stubGlobal('fetch', async (url: string) =>
    /\/(payment_intents|customers|customer_sessions)/.test(url)
      ? new Response(JSON.stringify({ id: 'pi_test_1', client_secret: 'pi_test_1_secret_x' }), {
          status: 200,
        })
      : new Response('{}', { status: 404 }),
  );
}
const STRIPE = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' };

describe('C-TIENDAS-COMPRA · el cliente compra en una tienda', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el precio sale del catálogo, lo pesable al peso estimado y cada línea con qué hacer si falta', async () => {
    stripeFalso();
    const { m, tid } = await escenario('staging.tumbite.com', STRIPE);
    const cliente = await m.cuenta('cliente');
    const prods = (await m.llamar('GET', `/datos/tiendas/${tid}/productos`)).datos.productos as {
      id: string;
      nombre: string;
    }[];
    const id = (n: string) => prods.find((p) => p.nombre === n)!.id;
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: tid,
        lineas: [
          { platoId: id('Orange juice'), cantidad: 2, sustitucion: 'similar' },
          { platoId: id('Bananas'), cantidad: 1 },
        ],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    // 2 × 3,50 (rebajado) + 0,70 × 2 lb estimadas = 8,40.
    expect(r.datos.desglose.subtotal).toBe(840);
    const ped = await m.llamar(
      'GET',
      `/datos/pedidos/${r.datos.pedidoId}`,
      undefined,
      cliente.token,
    );
    expect(ped.datos.pedido.lineas).toEqual([
      expect.objectContaining({
        nombreEn: 'Orange juice',
        precioCentavos: 350,
        sustitucion: 'similar',
      }),
      expect.objectContaining({
        nombreEn: 'Bananas',
        precioCentavos: 140,
        sustitucion: 'reembolsar',
        pesable: true,
      }),
    ]);
  });

  it('lo agotado no se puede comprar aunque la app lo mande', async () => {
    stripeFalso();
    const { m, tid, dueno } = await escenario('staging.tumbite.com', STRIPE);
    const cliente = await m.cuenta('cliente');
    const todos = (await m.llamar('GET', '/datos/mi-restaurante/productos', undefined, dueno.token))
      .datos.productos as { id: string; sku: string }[];
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: tid,
        lineas: [{ platoId: todos.find((p) => p.sku === 'B3')!.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    expect(r.estado).toBe(409);
  });
});
