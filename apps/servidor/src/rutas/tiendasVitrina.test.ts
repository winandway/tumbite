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

  it('en la computadora solo con TIENDAS_LOCAL, y en producción nunca, aunque la tenga', async () => {
    const local = await escenario('localhost', { TIENDAS_LOCAL: '1' });
    expect(
      (await local.m.llamar('GET', `/datos/tiendas?servicio=mercado&${EN_MIAMI}`)).estado,
    ).toBe(200);
    const sin = await escenario('localhost');
    expect((await sin.m.llamar('GET', `/datos/tiendas?servicio=mercado&${EN_MIAMI}`)).estado).toBe(
      404,
    );
    const prod = await escenario('divoox.com', { TIENDAS_LOCAL: '1' });
    expect((await prod.m.llamar('GET', `/datos/tiendas?servicio=mercado&${EN_MIAMI}`)).estado).toBe(
      404,
    );
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

  it('C-PEDIR-OTRA-VEZ: repite el pedido con el precio de hoy y avisa lo que ya no está', async () => {
    stripeFalso();
    const { m, tid } = await escenario('staging.tumbite.com', STRIPE);
    const cliente = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente', 'Otra Persona');
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
          { platoId: id('Spring water'), cantidad: 1 },
        ],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    // Hoy: el jugo bajó a 3,00 y el agua se agotó.
    await m.DB.prepare('UPDATE catalogo_ofertas SET precio_oferta = 300 WHERE producto_id = ?')
      .bind(id('Orange juice'))
      .run();
    await m.DB.prepare('UPDATE catalogo_ofertas SET disponible = 0 WHERE producto_id = ?')
      .bind(id('Spring water'))
      .run();
    const rep = await m.llamar(
      'GET',
      `/datos/pedidos/${r.datos.pedidoId}/repetir`,
      undefined,
      cliente.token,
    );
    expect(rep.estado).toBe(200);
    expect(rep.datos.restaurante).toMatchObject({ id: tid, esTienda: true, moneda: 'USD' });
    expect(rep.datos.lineas).toEqual([
      expect.objectContaining({
        platoId: id('Orange juice'),
        cantidad: 2,
        precioCentavos: 300,
        sustitucion: 'similar',
      }),
    ]);
    expect(rep.datos.faltan).toEqual([expect.objectContaining({ nombreEn: 'Spring water' })]);
    // Solo el dueño del pedido.
    expect(
      (await m.llamar('GET', `/datos/pedidos/${r.datos.pedidoId}/repetir`, undefined, otro.token))
        .estado,
    ).toBe(404);
  });

  it('C-PEDIDO-GRUPO-TIENDA: pedido en grupo en una tienda, con qué hacer si falta por producto', async () => {
    stripeFalso();
    const { m, tid } = await escenario('staging.tumbite.com', STRIPE);
    const ana = await m.cuenta('cliente', 'Ana López');
    const beto = await m.cuenta('cliente', 'Beto Ruiz');
    const prods = (await m.llamar('GET', `/datos/tiendas/${tid}/productos`)).datos.productos as {
      id: string;
      nombre: string;
    }[];
    const id = (n: string) => prods.find((p) => p.nombre === n)!.id;
    const codigo = (await m.llamar('POST', '/datos/grupos', { restauranteId: tid }, ana.token))
      .datos.codigo as string;
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/grupos/${codigo}/items`,
          { platoId: id('Orange juice'), cantidad: 2, sustitucion: 'similar' },
          beto.token,
        )
      ).estado,
    ).toBe(201);
    // Lo agotado no entra.
    const agotado = (await m.DB.prepare(
      'SELECT p.id FROM catalogo_productos p JOIN catalogo_ofertas o ON o.producto_id = p.id WHERE p.comercio_id = ? AND o.disponible = 0 LIMIT 1',
    )
      .bind(tid)
      .first<{ id: string }>())!.id;
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/grupos/${codigo}/items`,
          { platoId: agotado, cantidad: 1 },
          beto.token,
        )
      ).estado,
    ).toBe(409);
    const cierre = await m.llamar('POST', `/datos/grupos/${codigo}/cerrar`, {}, ana.token);
    expect(cierre.estado).toBe(200);
    expect(cierre.datos.restaurante.esTienda).toBe(true);
    expect(cierre.datos.lineas).toEqual([
      expect.objectContaining({
        platoId: id('Orange juice'),
        cantidad: 2,
        precioCentavos: 350,
        sustitucion: 'similar',
      }),
    ]);
  });

  it('C-TIENDAS-FALTANTES: lo que falta se resuelve con lo que eligió el cliente, y pueden faltar varios', async () => {
    stripeFalso();
    const { m, tid, dueno } = await escenario('staging.tumbite.com', STRIPE);
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
          { platoId: id('Spring water'), cantidad: 1, sustitucion: 'reembolsar' },
          { platoId: id('Orange juice'), cantidad: 1, sustitucion: 'similar' },
          { platoId: id('Bananas'), cantidad: 1, sustitucion: 'contactar' },
        ],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    const pid = r.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(pid)
      .run();
    const falta = (n: string) =>
      m.llamar('POST', `/datos/restaurante/pedidos/${pid}/falta`, { platoId: id(n) }, dueno.token);
    const total = async () =>
      (await m.llamar('GET', `/datos/pedidos/${pid}`, undefined, cliente.token)).datos.pedido
        .total as number;
    const antes = await total();

    // «Reembolsar»: se devuelve en el acto, sin esperar al cliente.
    const a = await falta('Spring water');
    expect(a.estado).toBe(200);
    expect(a.datos).toMatchObject({ resuelto: true, cancelado: false });
    expect(await total()).toBe(antes - a.datos.devolucion);
    // «Uno parecido»: si la tienda lo marca es que tampoco había; también en el acto. Segundo faltante.
    const b = await falta('Orange juice');
    expect(b.estado).toBe(200);
    expect(b.datos.resuelto).toBe(true);
    // «Avísame»: espera la decisión del cliente, y mientras tanto la tienda no acepta.
    const c = await falta('Bananas');
    expect(c.estado).toBe(200);
    expect(c.datos.resuelto).toBeUndefined();
    const ac = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${pid}/aceptar`,
      { minutos: 20 },
      dueno.token,
    );
    expect(ac.estado).toBe(409);
  });

  // C-TIENDAS-REEMPLAZOS (29 oct 2026), como Instacart: la tienda propone hasta tres reemplazos de su
  // catálogo; el cliente elige uno con un toque. Nunca se cobra más que el original.
  it('C-TIENDAS-REEMPLAZOS: la tienda propone, el cliente elige y nunca paga de más', async () => {
    stripeFalso();
    const { m, tid, dueno } = await escenario('staging.tumbite.com', STRIPE);
    const cliente = await m.cuenta('cliente');
    const prods = (await m.llamar('GET', `/datos/tiendas/${tid}/productos`)).datos.productos as {
      id: string;
      nombre: string;
    }[];
    const id = (n: string) => prods.find((p) => p.nombre === n)!.id;
    const pedir = async (lineas: unknown[]) => {
      const r = await m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: tid,
          lineas,
          propinaCentavos: 0,
          direccion: '200 Calle Prueba, Miami',
          lat: 25.78,
          lng: -80.2,
        },
        cliente.token,
      );
      const pid = r.datos.pedidoId as string;
      await m.DB.prepare(
        "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
      )
        .bind(pid)
        .run();
      return pid;
    };
    const pedido = async (pid: string) =>
      (await m.llamar('GET', `/datos/pedidos/${pid}`, undefined, cliente.token)).datos.pedido;

    // «Avísame»: el jugo (3,50) falta; la tienda propone agua (1,25). El cliente la elige.
    const p1 = await pedir([
      { platoId: id('Orange juice'), cantidad: 1, sustitucion: 'contactar' },
      { platoId: id('Bananas'), cantidad: 1, sustitucion: 'reembolsar' },
    ]);
    // Lo agotado o lo que no es de la tienda no se puede proponer.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${p1}/falta`,
          { platoId: id('Orange juice'), propuestas: ['producto-que-no-existe'] },
          dueno.token,
        )
      ).estado,
    ).toBe(409);
    const f1 = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${p1}/falta`,
      { platoId: id('Orange juice'), propuestas: [id('Spring water')] },
      dueno.token,
    );
    expect(f1.estado).toBe(200);
    const antes = await pedido(p1);
    expect(antes.ajuste.propuestas).toEqual([
      expect.objectContaining({
        platoId: id('Spring water'),
        nombreEs: 'Spring water',
        precioCentavos: 125,
      }),
    ]);
    const d = await m.llamar(
      'POST',
      `/datos/pedidos/${p1}/ajuste`,
      { decision: 'reemplazar', platoId: id('Spring water') },
      cliente.token,
    );
    expect(d.estado).toBe(200);
    const despues = await pedido(p1);
    expect(despues.lineas.map((l: { nombreEs: string }) => l.nombreEs)).toEqual([
      'Spring water',
      'Bananas',
    ]);
    expect(despues.subtotal).toBe(antes.subtotal - 350 + 125);
    expect(despues.ajuste.estado).toBe('quitado');
    expect(despues.ajuste.reemplazoId).toBe(id('Spring water'));

    // Más caro que el original: se cobra lo mismo que el original, nunca más.
    const p2 = await pedir([
      { platoId: id('Spring water'), cantidad: 2, sustitucion: 'contactar' },
    ]);
    const antes2 = await pedido(p2);
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${p2}/falta`,
      { platoId: id('Spring water'), propuestas: [id('Orange juice')] },
      dueno.token,
    );
    await m.llamar(
      'POST',
      `/datos/pedidos/${p2}/ajuste`,
      { decision: 'reemplazar', platoId: id('Orange juice') },
      cliente.token,
    );
    const despues2 = await pedido(p2);
    expect(despues2.lineas[0]).toMatchObject({
      nombreEs: 'Orange juice',
      precioCentavos: 125,
      cantidad: 2,
    });
    expect(despues2.total).toBe(antes2.total);

    // «Uno parecido» con propuesta: se aplica sola la primera, sin esperar al cliente.
    const p3 = await pedir([{ platoId: id('Spring water'), cantidad: 1, sustitucion: 'similar' }]);
    const f3 = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${p3}/falta`,
      { platoId: id('Spring water'), propuestas: [id('Orange juice')] },
      dueno.token,
    );
    expect(f3.datos.resuelto).toBe(true);
    expect((await pedido(p3)).lineas[0].nombreEs).toBe('Orange juice');
  });

  it('C-EDAD-EN-MANO: con alcohol, «en la puerta» pasa a «en mano»', async () => {
    stripeFalso();
    const { m, tid, dueno } = await escenario('staging.tumbite.com', STRIPE);
    await m.llamar(
      'POST',
      '/datos/mi-restaurante/productos/importar',
      {
        csv: 'sku,name,brand,category_1,price,available,restriction\nB9,Light beer,Brand Sample,Beer,1.80,yes,alcohol',
        confirmar: true,
      },
      dueno.token,
    );
    const cliente = await m.cuenta('cliente');
    const prods = (await m.llamar('GET', `/datos/tiendas/${tid}/productos`)).datos.productos as {
      id: string;
      nombre: string;
    }[];
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: tid,
        lineas: [{ platoId: prods.find((p) => p.nombre === 'Light beer')!.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
        entrega: 'puerta',
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    const f = await m.DB.prepare('SELECT modo FROM preferencias_entrega WHERE pedido_id = ?')
      .bind(r.datos.pedidoId)
      .first<{ modo: string }>();
    expect(f?.modo).toBe('mano');
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

describe('C-TIENDAS-CODIGO · rellenar con el código de barras', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('trae nombre, marca, tamaño y foto de Open Food Facts; si no lo conoce, lo dice', async () => {
    const { m, dueno } = await escenario();
    const pedidas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      pedidas.push(url);
      return url.includes('/012000161155.json')
        ? new Response(
            JSON.stringify({
              status: 1,
              product: {
                product_name: 'Spring water',
                brands: 'Brand Sample, Otra',
                quantity: '500 ml',
                image_front_url: 'https://images.openfoodfacts.org/x.jpg',
              },
            }),
          )
        : new Response(JSON.stringify({ status: 0 }), { status: 404 });
    });
    const r = await m.llamar(
      'GET',
      '/datos/mi-restaurante/productos/codigo/012000161155',
      undefined,
      dueno.token,
    );
    expect(r.datos).toMatchObject({
      encontrado: true,
      fuente: 'Open Food Facts',
      nombreEn: 'Spring water',
      marca: 'Brand Sample',
      tamano: '500',
      unidad: 'mL',
      imagen: 'https://images.openfoodfacts.org/x.jpg',
    });
    expect(pedidas[0]).toContain('world.openfoodfacts.org');
    const nada = await m.llamar(
      'GET',
      '/datos/mi-restaurante/productos/codigo/012000161162',
      undefined,
      dueno.token,
    );
    expect(nada.datos.encontrado).toBe(false);
    const malo = await m.llamar(
      'GET',
      '/datos/mi-restaurante/productos/codigo/012000161156',
      undefined,
      dueno.token,
    );
    expect(malo.estado).toBe(422);
  });
});
