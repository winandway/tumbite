import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION_TERMINOS } from '../../packages/compartido/src/terminos';
import { type APIRequestContext, expect, test } from './fixtures';

/**
 * NXT-3 EN EL SITIO DE PRUEBAS, con Stripe en modo prueba de verdad y un repartidor que recoge y
 * entrega en la puerta (por la API, como lo hace la app):
 * (a) Mercado: guineos por peso, la tienda escribe el peso real y el repartidor entrega a domicilio;
 *     se autoriza el total más el margen y se CAPTURA el total real (C-TIENDAS-PESO-REAL).
 * (b) Comida: promoción de «% de descuento» del restaurante más un cupón, y el restaurante quita un
 *     plato agotado antes de salir; los descuentos se conservan en el recálculo y se captura el
 *     total del recibo (C-PROMO-RESTAURANTE, C-DESCUENTOS-RECALCULO).
 * En los dos, la conciliación de esos pedidos compara la captura con Stripe y el libro del día
 * cuadra. Los puntos internos de pago solo aceptan llaves sk_test_: nunca dinero real. El
 * repartidor es de la corrida (en Miami, sin rutas ni modo destino que lo dejen fuera del reparto,
 * ver C-OCUPADO-VISIBLE) y se desconecta al terminar. Imprime «NXT-3a …» y «NXT-3b …» con el pedido
 * y las cifras para VERIFICAR-PAGOS.md.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('Esta prueba solo corre contra el sitio de pruebas.');

const REST = { lat: 25.7751, lng: -80.1902 };
// La casa, a unos 500 m: el GPS llega sin saltos imposibles.
const CASA = { lat: 25.7795, lng: -80.1902 };
const HOJA = [
  'sku,name_en,name_es,brand,size,size_unit,category_1,price,sale_price,available,stock_quantity,restriction,sold_by,average_weight,weight_unit',
  'P-001,Spring water,Agua de manantial,Brand Sample,500,mL,Drinks,1.25,,yes,48,,,,',
  'P-002,Bananas,Guineos,,1,lb,Produce,0.69,,yes,,,weight,2,lb',
].join('\n');

type Ctx = Awaited<ReturnType<typeof preparar>>;

async function preparar(request: APIRequestContext) {
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
  const clave = `Casa-${id}-Puerta9`;
  let n = 0;
  const cuenta = async (
    q: string,
    rol: 'cliente' | 'restaurante' | 'repartidor',
    nombre = `Prueba ${q}`,
  ) => {
    const correo = `${q}.${id}@recorrido.test`;
    const r = await request.post('/datos/cuentas/registro', {
      data: { nombre, correo, clave, rol, telefono: `3${String(Date.now()).slice(-8)}${n++ % 10}` },
    });
    expect(r.ok(), await r.text()).toBe(true);
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const con = (t: string) => ({ authorization: `Bearer ${t}`, 'x-idioma': 'es' });
  return { request, secreto, sql, id, cuenta, con };
}

/** Un comercio de la corrida en Miami, aprobado y abierto toda la semana. */
async function comercio(x: Ctx, q: string, categoria: string) {
  const dueno = await x.cuenta(q, 'restaurante');
  const ficha = await x.request.put('/datos/mi-restaurante', {
    headers: x.con(dueno.token),
    data: {
      nombre: `${categoria} Casa ${x.id.slice(-5)}`,
      direccion: '320 Calle de Ejemplo, Miami, FL',
      ...REST,
      categoria,
      telefono: '3055550197',
    },
  });
  expect(ficha.ok(), await ficha.text()).toBe(true);
  const rid = ((await ficha.json()) as { restaurante: { id: string } }).restaurante.id;
  await x.sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}'`);
  return { dueno, rid };
}

async function abrir(x: Ctx, token: string) {
  await x.request.put('/datos/mi-restaurante/horarios', {
    headers: x.con(token),
    data: { turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })) },
  });
  const r = await x.request.patch('/datos/mi-restaurante/abierto', {
    headers: x.con(token),
    data: { abierto: true },
  });
  expect(r.status(), await r.text()).toBe(200);
}

/** El repartidor de la corrida, conectado junto al comercio (solo él recibe la oferta en Miami). */
async function repartidor(x: Ctx) {
  const rep = await x.cuenta('repartidor.casa', 'repartidor', 'Repartidor Prueba');
  await x.sql(
    `INSERT OR IGNORE INTO terminos_aceptados (usuario_id, version) VALUES ('${rep.usuario.id}', '${VERSION_TERMINOS}')`,
  );
  // La foto de control de la semana ya tomada (la corrida no tiene cámara).
  await x.sql(
    `INSERT INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES ('nxt3-${x.id}', '${rep.usuario.id}', datetime('now'), 'ok')`,
  );
  // C-RECORRIDO-NO-PISA: ningún otro repartidor conectado en Miami se lleva la oferta.
  await x.sql(
    `UPDATE repartidores SET conectado = 0 WHERE zona_id = 'US-FL-MIAMI' AND usuario_id <> '${rep.usuario.id}'`,
  );
  const r = await x.request.post('/datos/repartidor/conectar', {
    headers: x.con(rep.token),
    data: { conectado: true, ...REST },
  });
  expect(r.status(), await r.text()).toBe(200);
  const estado = (await (
    await x.request.get('/datos/repartidor/estado', { headers: x.con(rep.token) })
  ).json()) as { ocupadoEn?: string | null };
  expect(estado.ocupadoEn ?? null, 'C-OCUPADO-VISIBLE: libre para Comida y Mercado').toBeNull();
  return rep;
}

/** Paga con la tarjeta de prueba de Stripe y espera el aviso real que lo deja pagado. */
async function pagar(x: Ctx, pedidoId: string) {
  const pago = await x.request.post('/datos/interno/diagnostico/confirmar-pago', {
    headers: x.secreto,
    data: { pedidoId },
  });
  expect(pago.status(), await pago.text()).toBe(200);
  const p = (await pago.json()) as { estado: string; autorizado: number };
  expect(p.estado).toBe('requires_capture');
  await expect
    .poll(
      async () => (await x.sql(`SELECT estado FROM pedidos WHERE id = '${pedidoId}'`))[0]?.estado,
      { timeout: 90_000, message: 'el aviso real de Stripe deja el pedido pagado' },
    )
    .toBe('pagado');
  return p.autorizado;
}

/** Oferta, aceptar, código del comercio, foto de la bolsa, GPS en la puerta y foto de la entrega. */
async function repartir(x: Ctx, pedidoId: string, rep: { token: string }) {
  const bolsa = readFileSync(join(__dirname, 'fotos', 'bolsa-entrega.jpg'));
  const subir = (ruta: string, donde: { lat: number; lng: number }) =>
    x.request.post(`${ruta}?lat=${donde.lat}&lng=${donde.lng}`, {
      headers: { ...x.con(rep.token), 'content-type': 'image/jpeg' },
      data: bolsa,
    });
  await expect
    .poll(
      async () => {
        const o = (await (
          await x.request.get('/datos/repartidor/ofertas', { headers: x.con(rep.token) })
        ).json()) as { ofertas: { id: string }[] };
        return o.ofertas.some((f) => f.id === pedidoId);
      },
      { timeout: 60_000, intervals: [2_000], message: 'la oferta le llega al repartidor' },
    )
    .toBe(true);
  const acepta = await x.request.post(`/datos/repartidor/ofertas/${pedidoId}/aceptar`, {
    headers: x.con(rep.token),
    data: {},
  });
  expect(acepta.ok(), await acepta.text()).toBe(true);
  const verificar = await x.request.post(`/datos/repartidor/pedidos/${pedidoId}/verificar`, {
    headers: x.con(rep.token),
    data: { codigo: pedidoId },
  });
  expect(verificar.ok(), await verificar.text()).toBe(true);
  const recogida = await subir(`/datos/repartidor/pedidos/${pedidoId}/foto-recogida`, REST);
  expect(recogida.ok(), await recogida.text()).toBe(true);
  await expect
    .poll(
      async () => (await x.sql(`SELECT estado FROM pedidos WHERE id = '${pedidoId}'`))[0]?.estado,
      { timeout: 30_000, message: 'con el código y la foto de la bolsa sale en camino' },
    )
    .toBe('en_camino');
  await expect
    .poll(
      async () => {
        for (let i = 0; i < 2; i++)
          await x.request.post('/datos/repartidor/ubicacion', {
            headers: x.con(rep.token),
            data: { ...CASA, precision: 10 },
          });
        const e = (await (
          await x.request.get('/datos/repartidor/estado', { headers: x.con(rep.token) })
        ).json()) as { activo?: { llegoCliente?: boolean } };
        return Boolean(e.activo?.llegoCliente);
      },
      { timeout: 90_000, intervals: [3_000], message: 'el GPS lo deja en la puerta' },
    )
    .toBe(true);
  const entrega = await subir(`/datos/repartidor/pedidos/${pedidoId}/entregado`, CASA);
  expect(entrega.status(), await entrega.text()).toBe(200);
}

/** Lo capturado coincide con el total del recibo, y la conciliación de ese pedido con Stripe. */
async function cerrar(x: Ctx, pedidoId: string) {
  await expect
    .poll(
      async () =>
        (
          await x.sql(
            `SELECT p.estado || ':' || p.total || ':' || COALESCE(c.capturado, '') AS e FROM pedidos p LEFT JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${pedidoId}'`,
          )
        )[0]?.e,
      { timeout: 60_000, message: 'entregado y capturado el total del recibo' },
    )
    .toMatch(/^entregado:(\d+):\1$/);
  const total = Number(
    (await x.sql(`SELECT total FROM pedidos WHERE id = '${pedidoId}'`))[0]?.total ?? -1,
  );
  const conc = await x.request.post('/datos/interno/diagnostico/conciliacion', {
    headers: x.secreto,
    data: { pedidos: [pedidoId] },
  });
  expect(conc.ok(), await conc.text()).toBe(true);
  const c = (await conc.json()) as {
    ok: boolean;
    casos: { nombre: string; ok: boolean; detalle?: string }[];
  };
  return {
    total,
    c,
    resumen: `conciliación ${c.ok ? 'cuadra' : 'NO cuadra'} (${c.casos.map((y) => `${y.ok ? 'ok' : 'NO'} ${y.nombre}${y.ok ? '' : ` — ${y.detalle ?? ''}`}`).join('; ')})`,
  };
}

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
