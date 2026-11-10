import {
  CASA,
  abrir,
  cerrar,
  comercio,
  pagar,
  preparar,
  repartidor,
  repartir,
} from './ayudaStaging';
import { expect, test } from './fixtures';
import { esperarVentanaLibre } from './registroPausado';

/**
 * NXT-3 EN EL SITIO DE PRUEBAS, con Stripe en modo prueba de verdad y un repartidor que recoge y
 * entrega en la puerta (por la API, como lo hace la app):
 * (a) Mercado: guineos por peso, la tienda escribe el peso real y el repartidor entrega a domicilio;
 *     se autoriza el total más el margen y se CAPTURA el total real (C-TIENDAS-PESO-REAL).
 * (b) Comida: promoción de «% de descuento» del restaurante más un cupón, y el restaurante quita un
 *     plato agotado antes de salir; los descuentos se conservan en el recálculo y se captura el
 *     total del recibo (C-PROMO-RESTAURANTE, C-DESCUENTOS-RECALCULO).
 * En los dos, la conciliación de esos pedidos compara la captura con Stripe y el libro del día
 * cuadra. LAN-2 (EE. UU.): (c) propina después de entregar cobrada aparte con la tarjeta guardada y
 * abonada al repartidor; (d) cambio de dirección que sube el envío con el cobro ya autorizado: lo
 * capturado es el total nuevo. Los puntos internos de pago solo aceptan llaves sk_test_: nunca dinero real. El
 * repartidor es de la corrida (en Miami, sin rutas ni modo destino que lo dejen fuera del reparto,
 * ver C-OCUPADO-VISIBLE) y se desconecta al terminar. Imprime «NXT-3a …» y «NXT-3b …» con el pedido
 * y las cifras para VERIFICAR-PAGOS.md.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');
// C-REGISTRO-PAUSADO: la prueba que sigue encuentra libre el límite de registros.
test.afterAll(async () => {
  test.setTimeout(90_000);
  await esperarVentanaLibre();
});
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('Esta prueba solo corre contra el sitio de pruebas.');

const HOJA = [
  'sku,name_en,name_es,brand,size,size_unit,category_1,price,sale_price,available,stock_quantity,restriction,sold_by,average_weight,weight_unit',
  'P-001,Spring water,Agua de manantial,Brand Sample,500,mL,Drinks,1.25,,yes,48,,,,',
  'P-002,Bananas,Guineos,,1,lb,Produce,0.69,,yes,,,weight,2,lb',
].join('\n');

test.describe.configure({ mode: 'serial' });

test('NXT-3a: guineos por peso entregados a domicilio; se captura el total real', async ({
  request,
}) => {
  test.setTimeout(360_000);
  const x = await preparar(request);
  const { dueno, rid } = await comercio(x, 'mercado.casa', 'Supermercado');
  let rep: { token: string } | null = null;
  try {
    expect(
      (
        await request.put('/datos/mi-restaurante/tipo', {
          headers: x.con(dueno.token),
          data: { tipo: 'mercado' },
        })
      ).status(),
    ).toBe(200);
    const imp = await request.post('/datos/mi-restaurante/productos/importar', {
      headers: x.con(dueno.token),
      data: { csv: HOJA, confirmar: true },
    });
    expect(((await imp.json()) as { guardado: boolean }).guardado, 'planilla').toBe(true);
    await abrir(x, dueno.token);
    const productos = await x.sql(
      `SELECT id, nombre_en FROM catalogo_productos WHERE comercio_id = '${rid}' AND nombre_en IN ('Bananas','Spring water')`,
    );
    const pid = (en: string) => String(productos.find((p) => p.nombre_en === en)?.id ?? '');
    rep = await repartidor(x);

    const cliente = await x.cuenta('cliente.mercado', 'cliente');
    const pedir = await request.post('/datos/pedidos', {
      headers: x.con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [
          { platoId: pid('Bananas'), cantidad: 1, sustitucion: 'reembolsar' },
          { platoId: pid('Spring water'), cantidad: 2, sustitucion: 'reembolsar' },
        ],
        propinaCentavos: 200,
        entrega: 'puerta',
        direccion: '400 Calle de Ejemplo, Miami, FL',
        ...CASA,
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
    const autorizado = await pagar(x, cobro.pedidoId);
    expect(autorizado).toBe(cobro.autorizado);

    const aceptar = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/aceptar`, {
      headers: x.con(dueno.token),
      data: { minutos: 5 },
    });
    expect(aceptar.ok(), await aceptar.text()).toBe(true);
    // Pesó menos de lo estimado: 1.8 lb.
    const pesar = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/pesos`, {
      headers: x.con(dueno.token),
      data: { pesos: [{ platoId: pid('Bananas'), peso: 1.8 }] },
    });
    expect(pesar.status(), await pesar.text()).toBe(200);
    const pesado = (await pesar.json()) as { total: number; totalAntes: number };
    expect(pesado.total, 'pesó menos: el total baja').toBeLessThan(estimado);
    const listo = await request.post(`/datos/restaurante/pedidos/${cobro.pedidoId}/listo`, {
      headers: x.con(dueno.token),
      data: {},
    });
    expect(listo.ok(), await listo.text()).toBe(true);

    await repartir(x, cobro.pedidoId, rep);
    const fin = await cerrar(x, cobro.pedidoId);
    expect(fin.total).toBe(pesado.total);
    console.warn(
      `NXT-3a pedido ${cobro.pedidoId}: estimado ${estimado}, autorizado en Stripe ${autorizado}, peso real 1.8 lb, total ${fin.total}, capturado ${fin.total}, entregado en la puerta por el repartidor; ${fin.resumen}`,
    );
    expect(fin.c.ok, JSON.stringify(fin.c.casos)).toBe(true);
  } finally {
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: x.con(dueno.token),
      data: { abierto: false },
    });
    if (rep)
      await request.post('/datos/repartidor/conectar', {
        headers: x.con(rep.token),
        data: { conectado: false },
      });
  }
});

test('NXT-3b: promoción % del restaurante + cupón, quitando un plato agotado; se captura el recibo', async ({
  request,
}) => {
  test.setTimeout(360_000);
  const x = await preparar(request);
  const { dueno, rid } = await comercio(x, 'rest.casa', 'Cubana');
  const equipo = await x.cuenta('soporte.cupon', 'cliente', `Soporte Cupón ${x.id.slice(-4)}`);
  let rep: { token: string } | null = null;
  const codigo = `NXT3${x.id.slice(-5).toUpperCase()}`;
  try {
    const plato = async (nombreEs: string, nombreEn: string, precioCentavos: number) => {
      const r = await request.post('/datos/mi-restaurante/platos', {
        headers: x.con(dueno.token),
        data: { nombreEs, nombreEn, precioCentavos },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return ((await r.json()) as { plato: { id: string } }).plato.id;
    };
    const arroz = await plato('Arroz con pollo', 'Chicken and rice', 1500);
    const jugo = await plato('Jugo natural', 'Fresh juice', 500);
    await abrir(x, dueno.token);
    // Promoción del restaurante: 20 % de descuento (las promociones están encendidas en pruebas).
    const promo = await request.post('/datos/mi-restaurante/promociones', {
      headers: x.con(dueno.token),
      data: { tipo: 'porcentaje', valor: 2000, iniciaEn: '2020-01-01', venceEn: '2099-01-01' },
    });
    expect(promo.status(), await promo.text()).toBe(201);
    // Cupón de 3 dólares solo para este restaurante, creado por una cuenta del equipo de la corrida.
    await x.sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${equipo.usuario.id}'`);
    const cupon = await request.post('/datos/admin/cupones', {
      headers: x.con(equipo.token),
      data: { codigo, tipo: 'monto', valor: 300, usosPorCliente: 1, restauranteId: rid },
    });
    expect(cupon.status(), await cupon.text()).toBe(201);
    rep = await repartidor(x);

    const cliente = await x.cuenta('cliente.promo', 'cliente');
    const pedir = await request.post('/datos/pedidos', {
      headers: x.con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [
          { platoId: arroz, cantidad: 2 },
          { platoId: jugo, cantidad: 1 },
        ],
        propinaCentavos: 300,
        cupon: codigo,
        entrega: 'puerta',
        direccion: '400 Calle de Ejemplo, Miami, FL',
        ...CASA,
      },
    });
    expect(pedir.status(), await pedir.text()).toBe(201);
    const p = (await pedir.json()) as {
      pedidoId: string;
      desglose: { totalCliente: number };
    };
    const promoDe = async () =>
      Number(
        (
          await x.sql(
            `SELECT COALESCE(SUM(descuento), 0) AS d FROM pedidos_promocion WHERE pedido_id = '${p.pedidoId}'`,
          )
        )[0]?.d ?? 0,
      );
    const antes = (
      await x.sql(`SELECT total, descuento FROM pedidos WHERE id = '${p.pedidoId}'`)
    )[0]!;
    const promoAntes = await promoDe();
    expect(promoAntes, 'la promoción del 20 % se aplicó').toBeGreaterThan(0);
    expect(Number(antes.descuento), 'el cupón se aplicó').toBeGreaterThanOrEqual(300);
    const autorizado = await pagar(x, p.pedidoId);
    expect(autorizado).toBe(p.desglose.totalCliente);

    const aceptar = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/aceptar`, {
      headers: x.con(dueno.token),
      data: { minutos: 5 },
    });
    expect(aceptar.ok(), await aceptar.text()).toBe(true);
    // El jugo se agotó: el restaurante lo marca y el cliente decide quitarlo.
    const falta = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/falta`, {
      headers: x.con(dueno.token),
      data: { platoId: jugo },
    });
    expect(falta.status(), await falta.text()).toBe(200);
    const ajuste = await request.post(`/datos/pedidos/${p.pedidoId}/ajuste`, {
      headers: x.con(cliente.token),
      data: { decision: 'quitar' },
    });
    expect(ajuste.status(), await ajuste.text()).toBe(200);
    const despues = (
      await x.sql(`SELECT total, descuento FROM pedidos WHERE id = '${p.pedidoId}'`)
    )[0]!;
    expect(Number(despues.total), 'sin el jugo el total baja').toBeLessThan(
      p.desglose.totalCliente,
    );
    expect(Number(despues.descuento), 'el cupón sigue en el recálculo').toBeGreaterThanOrEqual(300);
    const promoDespues = await promoDe();
    expect(promoDespues, 'la promoción sigue en el recálculo').toBeGreaterThan(0);
    const listo = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/listo`, {
      headers: x.con(dueno.token),
      data: {},
    });
    expect(listo.ok(), await listo.text()).toBe(true);

    await repartir(x, p.pedidoId, rep);
    const fin = await cerrar(x, p.pedidoId);
    expect(fin.total).toBe(Number(despues.total));
    console.warn(
      `NXT-3b pedido ${p.pedidoId}: promoción 20 % del restaurante + cupón ${codigo} de 3,00; total al pedir ${p.desglose.totalCliente} (cupón ${String(antes.descuento)}, promoción ${promoAntes}), autorizado ${autorizado}; jugo agotado y quitado: total ${fin.total} (cupón ${String(despues.descuento)}, promoción ${promoDespues}), capturado ${fin.total}, entregado en la puerta; ${fin.resumen}`,
    );
    expect(fin.c.ok, JSON.stringify(fin.c.casos)).toBe(true);
  } finally {
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: x.con(dueno.token),
      data: { abierto: false },
    });
    if (rep)
      await request.post('/datos/repartidor/conectar', {
        headers: x.con(rep.token),
        data: { conectado: false },
      });
    await x
      .sql(`UPDATE usuarios SET rol = 'cliente' WHERE id = '${equipo.usuario.id}'`)
      .catch(() => undefined);
  }
});

test('LAN-2a: propina después de entregar, cobrada aparte con la tarjeta guardada; el repartidor la recibe', async ({
  request,
}) => {
  test.setTimeout(360_000);
  const x = await preparar(request);
  const { dueno, rid } = await comercio(x, 'rest.propina', 'Cubana');
  let rep: { token: string; usuario: { id: string } } | null = null;
  try {
    const r = await request.post('/datos/mi-restaurante/platos', {
      headers: x.con(dueno.token),
      data: { nombreEs: 'Arroz con pollo', nombreEn: 'Chicken and rice', precioCentavos: 1500 },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const arroz = ((await r.json()) as { plato: { id: string } }).plato.id;
    await abrir(x, dueno.token);
    rep = await repartidor(x);
    const cliente = await x.cuenta('cliente.propina', 'cliente');
    const pedir = await request.post('/datos/pedidos', {
      headers: x.con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [{ platoId: arroz, cantidad: 1 }],
        propinaCentavos: 200,
        entrega: 'puerta',
        direccion: '400 Calle de Ejemplo, Miami, FL',
        ...CASA,
      },
    });
    expect(pedir.status(), await pedir.text()).toBe(201);
    const p = (await pedir.json()) as { pedidoId: string; desglose: { totalCliente: number } };
    const autorizado = await pagar(x, p.pedidoId);
    const aceptar = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/aceptar`, {
      headers: x.con(dueno.token),
      data: { minutos: 5 },
    });
    expect(aceptar.ok(), await aceptar.text()).toBe(true);
    const listo = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/listo`, {
      headers: x.con(dueno.token),
      data: {},
    });
    expect(listo.ok(), await listo.text()).toBe(true);
    await repartir(x, p.pedidoId, rep);
    const fin = await cerrar(x, p.pedidoId);
    // El cliente agrega 3,00 de propina después de recibirlo, SIN volver a escribir la tarjeta.
    const propina = await request.post(`/datos/pedidos/${p.pedidoId}/propina`, {
      headers: x.con(cliente.token),
      data: { centavos: 300 },
    });
    expect(propina.status(), await propina.text()).toBe(200);
    const extra = (
      await x.sql(
        `SELECT px.centavos, px.stripe_pago, (SELECT SUM(m.monto) FROM movimientos m WHERE m.usuario_id = '${rep.usuario.id}' AND m.referencia = 'propina-extra-' || px.pedido_id) AS abonado FROM propinas_extra px WHERE px.pedido_id = '${p.pedidoId}'`,
      )
    )[0]!;
    expect(Number(extra.centavos)).toBe(300);
    expect(String(extra.stripe_pago)).toMatch(/^pi_/);
    expect(Number(extra.abonado), 'el repartidor recibe la propina entera').toBe(300);
    // La segunda vez no cobra otra.
    const otra = await request.post(`/datos/pedidos/${p.pedidoId}/propina`, {
      headers: x.con(cliente.token),
      data: { centavos: 300 },
    });
    expect(otra.status()).toBe(409);
    // La conciliación de ese pedido, ahora con la propina: el cobro aparte coincide con Stripe.
    const despues = await cerrar(x, p.pedidoId);
    console.warn(
      `LAN-2a pedido ${p.pedidoId}: total ${fin.total}, autorizado ${autorizado}, capturado ${fin.total}, entregado en la puerta; propina después 300 cobrada con la tarjeta guardada (${String(extra.stripe_pago)}) y abonada al repartidor 300; ${despues.resumen}`,
    );
    expect(despues.c.ok, JSON.stringify(despues.c.casos)).toBe(true);
  } finally {
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: x.con(dueno.token),
      data: { abierto: false },
    });
    if (rep)
      await request.post('/datos/repartidor/conectar', {
        headers: x.con(rep.token),
        data: { conectado: false },
      });
  }
});

test('LAN-2b: cambio de dirección que sube el envío con el cobro autorizado; se captura el total nuevo', async ({
  request,
}) => {
  test.setTimeout(360_000);
  const x = await preparar(request);
  const { dueno, rid } = await comercio(x, 'rest.mudanza', 'Cubana');
  let rep: { token: string } | null = null;
  // Unos 6 km al norte del local: el envío pasa de la tarifa base a la de distancia.
  const LEJOS = { lat: 25.829, lng: -80.1902 };
  try {
    const r = await request.post('/datos/mi-restaurante/platos', {
      headers: x.con(dueno.token),
      data: { nombreEs: 'Arroz con pollo', nombreEn: 'Chicken and rice', precioCentavos: 1500 },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const arroz = ((await r.json()) as { plato: { id: string } }).plato.id;
    await abrir(x, dueno.token);
    rep = await repartidor(x);
    const cliente = await x.cuenta('cliente.mudanza', 'cliente');
    const pedir = await request.post('/datos/pedidos', {
      headers: x.con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [{ platoId: arroz, cantidad: 1 }],
        propinaCentavos: 200,
        entrega: 'puerta',
        direccion: '400 Calle de Ejemplo, Miami, FL',
        ...CASA,
      },
    });
    expect(pedir.status(), await pedir.text()).toBe(201);
    const p = (await pedir.json()) as {
      pedidoId: string;
      desglose: { totalCliente: number; envio: number };
    };
    const autorizado = await pagar(x, p.pedidoId);
    const aceptar = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/aceptar`, {
      headers: x.con(dueno.token),
      data: { minutos: 5 },
    });
    expect(aceptar.ok(), await aceptar.text()).toBe(true);
    // Primero sin aceptar el total: el servidor dice cuánto cambia y no toca nada.
    const aviso = await request.patch(`/datos/pedidos/${p.pedidoId}/direccion`, {
      headers: x.con(cliente.token),
      data: { direccion: '900 Calle de Ejemplo, Miami, FL', ...LEJOS },
    });
    expect(aviso.status(), await aviso.text()).toBe(409);
    const cifras = (await aviso.json()) as { nuevoTotal: number; envio: number };
    expect(cifras.nuevoTotal, 'el envío sube con la dirección nueva').toBeGreaterThan(
      p.desglose.totalCliente,
    );
    const cambio = await request.patch(`/datos/pedidos/${p.pedidoId}/direccion`, {
      headers: x.con(cliente.token),
      data: { direccion: '900 Calle de Ejemplo, Miami, FL', ...LEJOS, aceptarTotal: true },
    });
    expect(cambio.status(), await cambio.text()).toBe(200);
    const listo = await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/listo`, {
      headers: x.con(dueno.token),
      data: {},
    });
    expect(listo.ok(), await listo.text()).toBe(true);
    await repartir(x, p.pedidoId, rep, LEJOS);
    const fin = await cerrar(x, p.pedidoId);
    expect(fin.total, 'se captura el total nuevo').toBe(cifras.nuevoTotal);
    console.warn(
      `LAN-2b pedido ${p.pedidoId}: total al pedir ${p.desglose.totalCliente} (envío ${p.desglose.envio}), autorizado ${autorizado}; dirección cambiada antes de salir: total ${cifras.nuevoTotal} (envío ${cifras.envio}), capturado ${fin.total}, entregado en la puerta nueva; ${fin.resumen}`,
    );
    expect(fin.c.ok, JSON.stringify(fin.c.casos)).toBe(true);
  } finally {
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: x.con(dueno.token),
      data: { abierto: false },
    });
    if (rep)
      await request.post('/datos/repartidor/conectar', {
        headers: x.con(rep.token),
        data: { conectado: false },
      });
  }
});
