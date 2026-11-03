import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { conciliar } from '../conciliacion';

/**
 * C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026) · todos los países: los productos por peso se autorizan
 * con un margen, la tienda escribe el peso real al preparar y al entregar se cobra el total real,
 * nunca más de lo autorizado. Stripe simulado (modo prueba): nunca se le pega al real.
 */
const SECRETO_AVISO = `whsec_${crypto.randomUUID()}`;
const PI = 'pi_3PesoReal000000000001';
const HOJA = [
  'sku,name,brand,category_1,price,sale_price,available,restriction,sold_by,average_weight',
  'B1,Spring water,Brand Sample,Drinks,1.25,,yes,,,',
  'B2,Bananas,Brand Sample,Produce,0.70,,yes,,weight,2',
  'B3,Chips,Brand Sample,Snacks,1.00,,yes,,,',
].join('\n');

async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO_AVISO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function escena() {
  const pi = { id: PI, status: 'requires_capture', amount: 0, amount_received: 0 };
  const montos: { creado: number[]; capturado: number[]; actualizado: number[] } = {
    creado: [],
    capturado: [],
    actualizado: [],
  };
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    const metodo = String(init?.method ?? 'GET');
    const body = new URLSearchParams(String(init?.body ?? ''));
    if (u.endsWith('/payment_intents') && metodo === 'POST') {
      pi.amount = Number(body.get('amount'));
      montos.creado.push(pi.amount);
      return new Response(JSON.stringify({ id: PI, client_secret: `${PI}_secret_x` }));
    }
    if (u.endsWith(`/payment_intents/${PI}/capture`) && metodo === 'POST') {
      const monto = Number(body.get('amount_to_capture'));
      if (monto > pi.amount)
        return new Response(JSON.stringify({ error: { message: 'amount_too_large' } }), {
          status: 400,
        });
      pi.status = 'succeeded';
      pi.amount_received = monto;
      montos.capturado.push(monto);
      return new Response(JSON.stringify(pi));
    }
    if (u.endsWith(`/payment_intents/${PI}`) && metodo === 'POST') {
      pi.amount = Number(body.get('amount'));
      montos.actualizado.push(pi.amount);
      return new Response(JSON.stringify(pi));
    }
    if (u.endsWith(`/payment_intents/${PI}`)) return new Response(JSON.stringify(pi));
    return new Response(JSON.stringify({ id: 'cus_1', client_secret: 'cuss_x' }));
  });
  const m = mundo(
    {
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
      STRIPE_WEBHOOK_SECRET: SECRETO_AVISO,
      ADMIN_CORREOS: '',
    },
    { host: 'staging.tumbite.com' },
  );
  const admin = await m.cuenta('admin');
  const dueno = await m.cuenta('restaurante');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const tid = r.datos.restaurante.id as string;
  await m.llamar('PUT', '/datos/mi-restaurante/tipo', { tipo: 'mercado' }, dueno.token);
  await m.llamar(
    'POST',
    '/datos/mi-restaurante/productos/importar',
    { csv: HOJA, confirmar: true },
    dueno.token,
  );
  await m.llamar('PATCH', `/datos/admin/restaurantes/${tid}`, { estado: 'aprobado' }, admin.token);
  await m.abrir(dueno.token);
  const cliente = await m.cuenta('cliente');
  const prods = (await m.llamar('GET', `/datos/tiendas/${tid}/productos`)).datos.productos as {
    id: string;
    nombre: string;
  }[];
  const id = (n: string) => prods.find((p) => p.nombre === n)!.id;
  const pedir = (sustitucion?: string) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: tid,
        lineas: [
          { platoId: id('Bananas'), cantidad: 3, ...(sustitucion ? { sustitucion } : {}) },
          { platoId: id('Spring water'), cantidad: 1 },
        ],
        propinaCentavos: 200,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
  const aviso = async (pedidoId: string, monto: number) => {
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: PI, amount_capturable: monto, metadata: { pedido_id: pedidoId } } },
    });
    return m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': await firmar(cuerpo) },
      body: cuerpo,
    });
  };
  const pesar = (
    pedidoId: string,
    pesos: { platoId: string; peso: number }[],
    token = dueno.token,
  ) => m.llamar('POST', `/datos/restaurante/pedidos/${pedidoId}/pesos`, { pesos }, token);
  const fila = (pedidoId: string) =>
    m.DB.prepare(
      'SELECT estado, total, subtotal, pago_restaurante, pago_repartidor, ganancia, impuesto, lineas_json FROM pedidos WHERE id = ?',
    )
      .bind(pedidoId)
      .first<{
        estado: string;
        total: number;
        subtotal: number;
        pago_restaurante: number;
        pago_repartidor: number;
        ganancia: number;
        impuesto: number;
        lineas_json: string;
      }>();
  const cuadra = (f: NonNullable<Awaited<ReturnType<typeof fila>>>) =>
    expect(f.pago_restaurante + f.pago_repartidor + f.ganancia + f.impuesto).toBe(f.total);
  return { m, pi, montos, dueno, cliente, tid, id, pedir, aviso, pesar, fila, cuadra };
}

afterEach(() => vi.unstubAllGlobals());

describe('C-TIENDAS-PESO-REAL · cobro por el peso real', () => {
  it('autoriza con margen, cobra el peso real al entregar y la conciliación cuadra', async () => {
    const e = await escena();
    const p = await e.pedir();
    expect(p.estado).toBe(201);
    const pid = p.datos.pedidoId as string;
    const total = p.datos.desglose.totalCliente as number;
    const subtotal = p.datos.desglose.subtotal as number;
    // 3 × 1,40 (0,70 $/kg × 2 kg estimadas) + 1,25 = 5,45.
    expect(subtotal).toBe(545);
    const margen = Math.ceil((420 * 0.15 * total) / subtotal);
    expect(p.datos.autorizado).toBe(total + margen);
    expect(e.montos.creado).toEqual([total + margen]);

    // El aviso firmado por el total sin margen no cuadra: el pedido no pasa a pagado.
    await e.aviso(pid, total);
    expect((await e.fila(pid))?.estado).toBe('pago_pendiente');
    await e.aviso(pid, total + margen);
    expect((await e.fila(pid))?.estado).toBe('pagado');

    // Más que el estimado + 15 % se rechaza con el máximo (4,20 × 1,15 = 4,83 → 6,9 kg).
    const mucho = await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 7 }]);
    expect(mucho.estado).toBe(409);
    expect(mucho.datos.error).toMatch(/up to 6\.9 kg/);
    // 6,5 kg reales: 4,55 $ en vez de 4,20.
    const ok = await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6.5 }]);
    expect(ok.estado).toBe(200);
    expect(ok.datos.total).toBeGreaterThan(total);
    expect(ok.datos.total).toBeLessThanOrEqual(total + margen);
    const despues = (await e.fila(pid))!;
    expect(despues.subtotal).toBe(3 * Math.floor(455 / 3) + 125);
    expect(despues.total).toBe(ok.datos.total);
    e.cuadra(despues);
    // El cliente ve el peso estimado y el real en su pedido.
    const ped = await e.m.llamar('GET', `/datos/pedidos/${pid}`, undefined, e.cliente.token);
    expect(ped.datos.pedido.lineas[0]).toMatchObject({
      pesable: true,
      unidadPeso: 'kg',
      pesoEstimado: 2,
      pesoReal: 6.5,
      precioEstimadoCentavos: 140,
    });

    // Se prepara, se entrega y se captura el total REAL (no lo autorizado).
    const rep = await e.m.cuenta('repartidor');
    await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${pid}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    // Aceptado todavía se puede volver a pesar (parte del estimado, no del último peso).
    const otra = await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6 }]);
    expect(otra.estado).toBe(200);
    const final = otra.datos.total as number;
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${pid}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${pid}/listo`, {}, e.dueno.token);
    // Listo: el peso ya no cambia.
    expect((await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6.2 }])).estado).toBe(409);
    await e.m.recoger(pid, rep.token, e.dueno.token);
    expect((await e.m.entregar(pid, rep.token)).estado).toBe(200);
    expect(e.montos.capturado).toEqual([final]);
    const cobro = await e.m.DB.prepare('SELECT capturado FROM cobros WHERE pedido_id = ?')
      .bind(pid)
      .first<{ capturado: number }>();
    expect(cobro?.capturado).toBe(final);
    e.cuadra((await e.fila(pid))!);
    const c = await conciliar(e.m.DB, new Date().toISOString().slice(0, 10));
    expect(c.vendido).toBe(c.capturado);
    expect(c.detalle.cuadraRestaurantes).toBe('sí');
    expect(c.detalle.cuadraRepartidores).toBe('sí');
  });

  it('pesa menos: el cliente paga menos; y el margen sigue retenido al cambiar la dirección', async () => {
    const e = await escena();
    const p = await e.pedir();
    const pid = p.datos.pedidoId as string;
    const total = p.datos.desglose.totalCliente as number;
    const margen = (p.datos.autorizado as number) - total;
    await e.aviso(pid, total + margen);
    const menos = await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 5.1 }]);
    expect(menos.estado).toBe(200);
    expect(menos.datos.total).toBeLessThan(total);
    e.cuadra((await e.fila(pid))!);
    // Mudarse cambia el envío: Stripe recibe el total nuevo MÁS el margen.
    const mud = await e.m.llamar(
      'PATCH',
      `/datos/pedidos/${pid}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.86, lng: -80.19, aceptarTotal: true },
      e.cliente.token,
    );
    expect(mud.estado).toBe(200);
    expect(e.montos.actualizado).toEqual([mud.datos.total + margen]);
    const a = await e.m.DB.prepare(
      'SELECT autorizado, margen, pesado_en FROM autorizaciones_pedido WHERE pedido_id = ?',
    )
      .bind(pid)
      .first<{ autorizado: number; margen: number; pesado_en: string | null }>();
    expect(a).toMatchObject({ autorizado: mud.datos.total + margen, margen });
    expect(a?.pesado_en).toBeTruthy();
  });

  it('sin margen guardado nunca cobra más del total, y rechaza lo que no corresponde', async () => {
    const e = await escena();
    const p = await e.pedir();
    const pid = p.datos.pedidoId as string;
    const total = p.datos.desglose.totalCliente as number;
    await e.aviso(pid, p.datos.autorizado as number);
    // Un pedido viejo, de antes del margen: el peso de más lo absorbe Divoox, el cliente no.
    await e.m.DB.prepare('DELETE FROM autorizaciones_pedido WHERE pedido_id = ?').bind(pid).run();
    const r = await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6.8 }]);
    expect(r.estado).toBe(200);
    expect(r.datos.total).toBe(total);
    e.cuadra((await e.fila(pid))!);
    // El agua no se vende por peso; un producto que no está; un peso sin sentido; otra cuenta.
    expect((await e.pesar(pid, [{ platoId: e.id('Spring water'), peso: 1 }])).estado).toBe(422);
    expect((await e.pesar(pid, [{ platoId: 'otro', peso: 1 }])).estado).toBe(404);
    expect((await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: -1 }])).estado).toBe(400);
    const otraTienda = await e.m.cuenta('restaurante');
    await e.m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, otraTienda.token);
    expect(
      (await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6 }], otraTienda.token)).estado,
    ).toBe(404);
    // Con un producto faltante esperando al cliente, no se pesa.
    await e.m.DB.prepare(
      "INSERT INTO ajustes_pedido (pedido_id, plato_id, nombre_es, nombre_en, devolucion, propuestas_json) VALUES (?, ?, 'Agua', 'Water', 125, '[]')",
    )
      .bind(pid, e.id('Spring water'))
      .run();
    expect((await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6 }])).estado).toBe(409);
  });

  it('un restaurante no tiene peso real', async () => {
    const e = await escena();
    const admin = await e.m.cuenta('admin');
    const otro = await e.m.cuenta('restaurante');
    const r = await e.m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, otro.token);
    const rid = r.datos.restaurante.id as string;
    await e.m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const plato = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Cubano', precioCentavos: 1500 },
      otro.token,
    );
    await e.m.abrir(otro.token);
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      e.cliente.token,
    );
    expect(p.estado).toBe(201);
    // Sin pesables no se autoriza nada de más.
    expect(p.datos.autorizado).toBe(p.datos.desglose.totalCliente);
    const x = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${p.datos.pedidoId}/pesos`,
      { pesos: [{ platoId: plato.datos.plato.id, peso: 1 }] },
      otro.token,
      { 'x-idioma': 'es' },
    );
    expect(x.estado).toBe(409);
    expect(x.datos.error).toMatch(/solo para pedidos de tiendas/);
    expect((await e.pesar('no-existe', [{ platoId: 'a', peso: 1 }])).estado).toBe(404);
  });
});

/** SIG-3x: los tres arreglos de la revisión de SIG-3, cada uno comprobado en rojo. */
describe('C-TIENDAS-PESO-REAL · arreglos de la revisión (SIG-3x)', () => {
  it('(1) el reemplazo de un pesable por un producto normal no hereda el peso ni el precio por kilo', async () => {
    const e = await escena();
    const p = await e.pedir('similar');
    const pid = p.datos.pedidoId as string;
    await e.aviso(pid, p.datos.autorizado as number);
    const falta = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${pid}/falta`,
      { platoId: e.id('Bananas'), propuestas: [e.id('Chips')] },
      e.dueno.token,
    );
    expect(falta.estado).toBe(200);
    // Con «similar», la propuesta de la tienda se aplica sola (el cliente no tiene que decidir).
    expect(falta.datos.reemplazo ?? falta.datos).toBeTruthy();
    const chips = () =>
      e
        .fila(pid)
        .then((f) =>
          (JSON.parse(f!.lineas_json) as Record<string, unknown>[]).find(
            (l) => l.platoId === e.id('Chips'),
          )!,
        );
    const antes = await chips();
    expect(antes.pesable).toBeUndefined();
    expect(antes.precioPorPeso).toBeUndefined();
    expect(antes.pesoEstimado).toBeUndefined();
    // Las papas no se pesan: la tienda no puede cobrarlas por kilo.
    const r = await e.pesar(pid, [{ platoId: e.id('Chips'), peso: 4.9 }]);
    expect(r.estado).toBe(422);
    const despues = await chips();
    expect(Number(despues.precioCentavos) * Number(despues.cantidad)).toBeLessThanOrEqual(300);
    e.cuadra((await e.fila(pid))!);
  });

  it('(2) cambiar la dirección sin que Stripe cambie no mueve lo autorizado', async () => {
    const e = await escena();
    const p = await e.pedir();
    const pid = p.datos.pedidoId as string;
    await e.aviso(pid, p.datos.autorizado as number);
    expect((await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 6.8 }])).estado).toBe(200);
    const mud = await e.m.llamar(
      'PATCH',
      `/datos/pedidos/${pid}/direccion`,
      { direccion: '201 Calle Prueba, Miami', lat: 25.78, lng: -80.2, aceptarTotal: true },
      e.cliente.token,
    );
    expect(mud.estado).toBe(200);
    expect(e.montos.actualizado).toEqual([]);
    const a = await e.m.DB.prepare(
      'SELECT autorizado FROM autorizaciones_pedido WHERE pedido_id = ?',
    )
      .bind(pid)
      .first<{ autorizado: number }>();
    // Lo autorizado en la base es lo que Stripe tiene retenido: ese es el techo real.
    expect(a?.autorizado).toBe(e.pi.amount);
    const f = (await e.fila(pid))!;
    expect(f.total).toBeLessThanOrEqual(e.pi.amount);
  });

  it('(3) el mismo producto en dos líneas se pesa línea por línea', async () => {
    const e = await escena();
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: e.tid,
        lineas: [
          { platoId: e.id('Bananas'), cantidad: 1, nota: 'Maduras' },
          { platoId: e.id('Bananas'), cantidad: 1, nota: 'Verdes' },
          { platoId: e.id('Spring water'), cantidad: 1 },
        ],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      e.cliente.token,
    );
    expect(p.estado).toBe(201);
    const pid = p.datos.pedidoId as string;
    await e.aviso(pid, p.datos.autorizado as number);
    // Sin decir cuál línea, no se adivina.
    const ambigua = await e.pesar(pid, [{ platoId: e.id('Bananas'), peso: 2 }]);
    expect(ambigua.estado).toBe(409);
    const segunda = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${pid}/pesos`,
      { pesos: [{ platoId: e.id('Bananas'), linea: 1, peso: 2.1 }] },
      e.dueno.token,
    );
    expect(segunda.estado).toBe(200);
    const lineas = JSON.parse((await e.fila(pid))!.lineas_json) as { pesoReal?: number }[];
    expect(lineas[0]!.pesoReal).toBeUndefined();
    expect(lineas[1]!.pesoReal).toBe(2.1);
    // Una línea que no es de ese producto: no.
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${pid}/pesos`,
          { pesos: [{ platoId: e.id('Bananas'), linea: 2, peso: 1 }] },
          e.dueno.token,
        )
      ).estado,
    ).toBe(404);
    e.cuadra((await e.fila(pid))!);
  });
});
