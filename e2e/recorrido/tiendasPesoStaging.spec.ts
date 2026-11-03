import { expect, test } from './fixtures';

/**
 * C-TIENDAS-PESO-REAL (SIG-3b) EN EL SITIO DE PRUEBAS, con Stripe en modo prueba de verdad: una
 * tienda de la corrida vende guineos por peso; el cliente pide y paga con la tarjeta de prueba de
 * Stripe (la autorización es el total MÁS el margen de los pesables); la tienda acepta y escribe
 * el peso real; entrega en el mostrador con el PIN y al entregar se CAPTURA el total real (captura
 * parcial: el resto se libera). Al final la conciliación compara cada cobro del día con Stripe.
 * Nunca corre con dinero real: los puntos internos de pago solo aceptan llaves sk_test_.
 * Imprime una línea «SIG-3b …» con el pedido y las cifras para VERIFICAR-PAGOS.md.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('Esta prueba solo corre contra el sitio de pruebas.');

const HOJA = [
  'sku,name_en,name_es,brand,size,size_unit,category_1,price,sale_price,available,stock_quantity,restriction,sold_by,average_weight,weight_unit',
  'P-001,Spring water,Agua de manantial,Brand Sample,500,mL,Drinks,1.25,,yes,48,,,,',
  'P-002,Bananas,Guineos,,1,lb,Produce,0.69,,yes,,,weight,2,lb',
].join('\n');

test('peso real de un pesable con Stripe en modo prueba (autoriza con margen, captura el real)', async ({
  request,
}) => {
  test.setTimeout(240_000);
  const secreto = { 'x-reloj-secreto': process.env.RECORRIDO_SECRETO ?? '' };
  const sql = async (comando: string) => {
    const r = await request.post('/datos/interno/diagnostico/sql', {
      headers: secreto,
      data: { sql: comando },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return ((await r.json()) as { results: Record<string, unknown>[] }).results;
  };
  const id = Date.now().toString(36);
  const clave = `Peso-${id}-Real9`;
  let n = 0;
  const cuenta = async (q: string, rol: 'cliente' | 'restaurante') => {
    const correo = `${q}.${id}@recorrido.test`;
    const r = await request.post('/datos/cuentas/registro', {
      data: {
        nombre: `Prueba ${q}`,
        correo,
        clave,
        rol,
        telefono: `3${String(Date.now()).slice(-8)}${n++ % 10}`,
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const con = (t: string) => ({ authorization: `Bearer ${t}`, 'x-idioma': 'es' });

  // 1. La tienda de la corrida en Miami: ficha, tipo «mercado», planilla, aprobada y abierta.
  const dueno = await cuenta('tienda.peso', 'restaurante');
  const ficha = await request.put('/datos/mi-restaurante', {
    headers: con(dueno.token),
    data: {
      nombre: `Mercado Peso ${id.slice(-5)}`,
      direccion: '300 Calle de Ejemplo, Miami, FL',
      lat: 25.7743,
      lng: -80.1868,
      categoria: 'Supermercado',
      telefono: '3055550199',
    },
  });
  expect(ficha.ok(), await ficha.text()).toBe(true);
  const tid = ((await ficha.json()) as { restaurante: { id: string } }).restaurante.id;
  try {
    expect(
      (
        await request.put('/datos/mi-restaurante/tipo', {
          headers: con(dueno.token),
          data: { tipo: 'mercado' },
        })
      ).status(),
    ).toBe(200);
    const imp = await request.post('/datos/mi-restaurante/productos/importar', {
      headers: con(dueno.token),
      data: { csv: HOJA, confirmar: true },
    });
    expect(((await imp.json()) as { guardado: boolean }).guardado, 'planilla').toBe(true);
    await sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${tid}'`);
    await request.put('/datos/mi-restaurante/horarios', {
      headers: con(dueno.token),
      data: {
        turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
      },
    });
    const abrir = await request.patch('/datos/mi-restaurante/abierto', {
      headers: con(dueno.token),
      data: { abierto: true },
    });
    expect(abrir.status(), await abrir.text()).toBe(200);
    const productos = await sql(
      `SELECT id, nombre_en FROM catalogo_productos WHERE comercio_id = '${tid}' AND nombre_en IN ('Bananas','Spring water')`,
    );
    const pid = (en: string) => String(productos.find((p) => p.nombre_en === en)?.id ?? '');
    expect(pid('Bananas'), 'guineos en la planilla').toBeTruthy();

    // 2. El cliente pide guineos (2 lb estimadas) y agua, para recoger en el mostrador.
    const cliente = await cuenta('cliente.peso', 'cliente');
    const pedir = await request.post('/datos/pedidos', {
      headers: con(cliente.token),
      data: {
        restauranteId: tid,
        lineas: [
          { platoId: pid('Bananas'), cantidad: 1, sustitucion: 'reembolsar' },
          { platoId: pid('Spring water'), cantidad: 1, sustitucion: 'reembolsar' },
        ],
        propinaCentavos: 0,
        entrega: 'recoger',
      },
    });
    expect(pedir.status(), await pedir.text()).toBe(201);
    const cobro = (await pedir.json()) as {
      pedidoId: string;
      autorizado: number;
      desglose: { totalCliente: number };
    };
    const estimado = cobro.desglose.totalCliente;
    expect(cobro.autorizado, 'se autoriza el total más el margen').toBeGreaterThan(estimado);

    // 3. Se paga con la tarjeta de prueba de Stripe; el aviso REAL de Stripe lo deja pagado.
    const pago = await request.post('/datos/interno/diagnostico/confirmar-pago', {
      headers: secreto,
      data: { pedidoId: cobro.pedidoId },
    });
    expect(pago.status(), await pago.text()).toBe(200);
    const confirmado = (await pago.json()) as { estado: string; autorizado: number };
    expect(confirmado.estado).toBe('requires_capture');
    expect(confirmado.autorizado, 'Stripe retiene lo autorizado').toBe(cobro.autorizado);
    await expect
      .poll(
        async () =>
          (await sql(`SELECT estado FROM pedidos WHERE id = '${cobro.pedidoId}'`))[0]?.estado,
        { timeout: 90_000, message: 'el aviso real de Stripe deja el pedido pagado' },
      )
      .toBe('pagado');

    // 4. La tienda acepta y escribe el peso real: 2.2 lb (10 % más, dentro del margen).
    const aceptar = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/aceptar`, {
      headers: con(dueno.token),
      data: { minutos: 5 },
    });
    expect(aceptar.ok(), await aceptar.text()).toBe(true);
    const pesar = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/pesos`, {
      headers: con(dueno.token),
      data: { pesos: [{ platoId: pid('Bananas'), peso: 2.2 }] },
    });
    expect(pesar.status(), await pesar.text()).toBe(200);
    const pesado = (await pesar.json()) as {
      total: number;
      totalAntes: number;
      autorizado: number;
    };
    expect(pesado.totalAntes).toBe(estimado);
    expect(pesado.total, 'pesó más: el total sube').toBeGreaterThan(estimado);
    expect(pesado.total, 'nunca más de lo autorizado').toBeLessThanOrEqual(cobro.autorizado);

    // 5. Lista y entregada en el mostrador con el PIN del cliente: se captura el total real.
    const listo = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/listo`, {
      headers: con(dueno.token),
      data: {},
    });
    expect(listo.ok(), await listo.text()).toBe(true);
    const pin = String(
      (await sql(`SELECT pin FROM pines_entrega WHERE pedido_id = '${cobro.pedidoId}'`))[0]?.pin ??
        '',
    );
    const entregar = await request.post(
      `/datos/restaurante/pedidos/${cobro.pedidoId}/entregado-local`,
      { headers: con(dueno.token), data: { pin } },
    );
    expect(entregar.status(), await entregar.text()).toBe(200);
    await expect
      .poll(
        async () =>
          (
            await sql(
              `SELECT p.estado || ':' || p.total || ':' || COALESCE(c.capturado, '') AS e FROM pedidos p LEFT JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${cobro.pedidoId}'`,
            )
          )[0]?.e,
        { timeout: 60_000, message: 'entregado y capturado el total real' },
      )
      .toBe(`entregado:${pesado.total}:${pesado.total}`);

    // 6. La conciliación compara la captura de la base con lo que Stripe recibió de verdad.
    const conc = await request.post('/datos/interno/diagnostico/conciliacion', {
      headers: secreto,
      data: {},
    });
    expect(conc.ok(), await conc.text()).toBe(true);
    const c = (await conc.json()) as {
      ok: boolean;
      casos: { nombre: string; ok: boolean; detalle?: string }[];
    };
    const cobros = c.casos.find((x) => x.nombre.startsWith('cada cobro de hoy'));
    expect(cobros?.detalle ?? '', 'este pedido cuadra con Stripe').not.toContain(cobro.pedidoId);
    console.warn(
      `SIG-3b pedido ${cobro.pedidoId}: estimado ${estimado}, autorizado en Stripe ${confirmado.autorizado}, peso real 2.2 lb, total ${pesado.total}, capturado ${pesado.total}; conciliación ${c.ok ? 'cuadra' : 'NO cuadra'} (${c.casos.map((x) => `${x.ok ? 'ok' : 'NO'} ${x.nombre}`).join('; ')})`,
    );
    expect(c.ok, JSON.stringify(c.casos)).toBe(true);
  } finally {
    // La tienda de la corrida no se queda abierta en el sitio de pruebas.
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: con(dueno.token),
      data: { abierto: false },
    });
  }
});
