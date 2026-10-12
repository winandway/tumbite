import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

// Secreto inventado en cada corrida: en el repo no hay ninguno, ni de prueba.
const SECRETO = `whsec_${crypto.randomUUID()}`;

async function firmar(cuerpo: string, secreto = SECRETO, t = Math.floor(Date.now() / 1000)) {
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Simula a Stripe: guarda lo que se le pidió y responde como él. */
function stripeFalso() {
  const llamadas: { url: string; cuerpo: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({ url, cuerpo: String(init?.body ?? '') });
    if (/\/(payment_intents|customers|customer_sessions)/.test(url))
      return new Response(
        JSON.stringify({ id: 'cs_test_1', client_secret: 'cs_test_1_secret_x' }),
        { status: 200 },
      );
    if (url.includes('/accounts'))
      return new Response(JSON.stringify({ id: 'acct_1' }), { status: 200 });
    if (url.includes('/account_links'))
      return new Response(JSON.stringify({ url: 'https://connect.stripe.com/setup/x' }), {
        status: 200,
      });
    if (url.includes('/transfers'))
      return new Response(JSON.stringify({ id: 'tr_1' }), { status: 200 });
    return new Response('{}', { status: 404 });
  });
  return llamadas;
}

async function escenario(
  extra: Record<string, unknown> = {
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: SECRETO,
  },
) {
  const m = mundo(extra);
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
    { estado: 'aprobado' },
    admin.token,
  );
  await m.llamar('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, dueno.token);
  const p = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  const pedidoBase = {
    restauranteId: r.datos.restaurante.id,
    lineas: [{ platoId: p.datos.plato.id, cantidad: 2 }],
    propinaCentavos: 400,
    direccion: '200 Calle Prueba, Miami',
    lat: 25.78,
    lng: -80.2,
  };
  return {
    m,
    dueno,
    admin,
    cliente,
    restauranteId: r.datos.restaurante.id as string,
    platoId: p.datos.plato.id as string,
    pedidoBase,
  };
}

describe('pedidos y pagos', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el precio lo pone el servidor y Stripe cobra exactamente el total', async () => {
    const llamadas = stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      { ...pedidoBase, precioCentavos: 1 },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    // Pago dentro de la app: sin salto a otra página; la app recibe el secreto del intento de pago.
    expect(r.datos.urlPago).toBeUndefined();
    expect(r.datos.clientSecret).toContain('_secret_');
    expect(r.datos.sesionCliente).toContain('_secret_');
    expect(r.datos.desglose.subtotal).toBe(3000);
    const intento = llamadas.find((l) => l.url.includes('/payment_intents'));
    expect(decodeURIComponent(intento?.cuerpo ?? '')).toContain(
      `amount=${r.datos.desglose.totalCliente}`,
    );
    expect(decodeURIComponent(intento?.cuerpo ?? '')).toContain(
      `metadata[pedido_id]=${r.datos.pedidoId}`,
    );
    // La tarjeta se puede guardar para la próxima: la sesión del cliente lo permite.
    const sesion = llamadas.find((l) => l.url.includes('/customer_sessions'));
    expect(decodeURIComponent(sesion?.cuerpo ?? '')).toContain('[payment_method_save]=enabled');
    const fila = await m.DB.prepare('SELECT estado, total FROM pedidos WHERE id = ?')
      .bind(r.datos.pedidoId)
      .first<{ estado: string; total: number }>();
    expect(fila).toEqual({ estado: 'pago_pendiente', total: r.datos.desglose.totalCliente });
  });

  it('sin llaves de Stripe se dice claro que los pagos no están activos', async () => {
    const { m, cliente, pedidoBase } = await escenario({});
    const r = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    expect(r.estado).toBe(422);
    expect(r.datos.error).toContain('pagos todavía no están activados');
  });

  it('no se puede pedir en un restaurante cerrado ni un plato agotado', async () => {
    stripeFalso();
    const { m, dueno, cliente, pedidoBase, platoId } = await escenario();
    await m.llamar(
      'PATCH',
      `/datos/mi-restaurante/platos/${platoId}/disponible`,
      { disponible: false },
      dueno.token,
    );
    const agotado = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    expect(agotado.estado).toBe(409);
    await m.llamar('PATCH', '/datos/mi-restaurante/abierto', { abierto: false }, dueno.token);
    const cerrado = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    expect(cerrado.estado).toBe(409);
  });

  it('el aviso de Stripe sin firma válida no toca nada', async () => {
    stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    const r = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    const cuerpo = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          amount_total: r.datos.desglose.totalCliente,
          metadata: { pedido_id: r.datos.pedidoId },
        },
      },
    });
    const { app } = await import('../app');
    const malo = await app.request(
      '/datos/stripe/aviso',
      {
        method: 'POST',
        body: cuerpo,
        headers: { 'stripe-signature': await firmar(cuerpo, 'whsec_otro') },
      },
      { DB: m.DB, STRIPE_WEBHOOK_SECRET: SECRETO },
    );
    expect(malo.status).toBe(400);
    const viejo = await app.request(
      '/datos/stripe/aviso',
      {
        method: 'POST',
        body: cuerpo,
        headers: {
          'stripe-signature': await firmar(cuerpo, SECRETO, Math.floor(Date.now() / 1000) - 3600),
        },
      },
      { DB: m.DB, STRIPE_WEBHOOK_SECRET: SECRETO },
    );
    expect(viejo.status).toBe(400);
    const fila = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(r.datos.pedidoId)
      .first<{ estado: string }>();
    expect(fila?.estado).toBe('pago_pendiente');
  });

  it('con firma válida el pedido queda pagado, una sola vez, y solo si el monto cuadra', async () => {
    stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    const { app } = await import('../app');
    const r = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    const enviar = async (evento: object) => {
      const cuerpo = JSON.stringify(evento);
      return app.request(
        '/datos/stripe/aviso',
        { method: 'POST', body: cuerpo, headers: { 'stripe-signature': await firmar(cuerpo) } },
        { DB: m.DB, STRIPE_WEBHOOK_SECRET: SECRETO },
      );
    };
    const trampa = await enviar({
      id: 'evt_x',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          amount_total: 1,
          metadata: { pedido_id: r.datos.pedidoId },
        },
      },
    });
    expect(trampa.status).toBe(200);
    let fila = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(r.datos.pedidoId)
      .first<{ estado: string }>();
    expect(fila?.estado).toBe('pago_pendiente');

    const bueno = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          payment_intent: 'pi_1',
          amount_total: r.datos.desglose.totalCliente,
          metadata: { pedido_id: r.datos.pedidoId },
        },
      },
    };
    expect((await enviar(bueno)).status).toBe(200);
    const repetido = await enviar(bueno);
    expect(((await repetido.json()) as { repetido?: boolean }).repetido).toBe(true);
    fila = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(r.datos.pedidoId)
      .first<{ estado: string }>();
    expect(fila?.estado).toBe('pagado');
    const mios = await m.llamar('GET', '/datos/mis-pedidos', undefined, cliente.token);
    expect(mios.datos.pedidos).toHaveLength(1);
  });

  it('nadie ve el pedido de otro cliente', async () => {
    stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    const r = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    const otro = await m.cuenta('cliente');
    const intento = await m.llamar(
      'GET',
      `/datos/pedidos/${r.datos.pedidoId}`,
      undefined,
      otro.token,
    );
    expect(intento.estado).toBe(404);
    const propio = await m.llamar(
      'GET',
      `/datos/pedidos/${r.datos.pedidoId}`,
      undefined,
      cliente.token,
    );
    expect(propio.datos.pedido.total).toBe(r.datos.desglose.totalCliente);
  });

  it('el admin edita el dinero y el siguiente pedido lo usa', async () => {
    stripeFalso();
    const { m, admin, cliente, pedidoBase } = await escenario();
    const cfg = await m.llamar('GET', '/datos/config-dinero');
    const nuevo = { ...cfg.datos.config, envioBase: 0, envioMaximo: 0, envioPorKm: 0 };
    const malo = await m.llamar(
      'PUT',
      '/datos/admin/config-dinero',
      { ...nuevo, servicioMinimo: 999, servicioMaximo: 1 },
      admin.token,
    );
    expect(malo.estado).toBe(400);
    expect((await m.llamar('PUT', '/datos/admin/config-dinero', nuevo, cliente.token)).estado).toBe(
      403,
    );
    expect((await m.llamar('PUT', '/datos/admin/config-dinero', nuevo, admin.token)).estado).toBe(
      200,
    );
    const r = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    expect(r.datos.desglose.envio).toBe(0);
  });

  it('billetera: conectar abre Stripe y no se retira más de lo que hay', async () => {
    stripeFalso();
    const { m, dueno } = await escenario();
    const con = await m.llamar('POST', '/datos/billetera/conectar', {}, dueno.token);
    expect(con.datos.url).toContain('connect.stripe.com');
    const sinActivar = await m.llamar(
      'POST',
      '/datos/billetera/retirar',
      { montoCentavos: 500 },
      dueno.token,
    );
    expect(sinActivar.estado).toBe(409);
    await m.DB.prepare('UPDATE cuentas_stripe SET pagos_activos = 1').run();
    await m.DB.prepare(
      "INSERT INTO movimientos (id, usuario_id, monto, concepto) VALUES ('m1', ?, 1000, 'ajuste')",
    )
      .bind(dueno.id)
      .run();
    const demasiado = await m.llamar(
      'POST',
      '/datos/billetera/retirar',
      { montoCentavos: 5000 },
      dueno.token,
    );
    expect(demasiado.estado).toBe(409);
    const ok = await m.llamar(
      'POST',
      '/datos/billetera/retirar',
      { montoCentavos: 600 },
      dueno.token,
    );
    expect(ok.datos.saldo).toBe(400);
    const b = await m.llamar('GET', '/datos/billetera', undefined, dueno.token);
    expect(b.datos.saldo).toBe(400);
    expect(b.datos.pagosActivos).toBe(true);
  });
});

describe('pago dentro de la app (sin salto)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el aviso payment_intent.succeeded marca pagado, una vez, solo si el monto y el intento cuadran', async () => {
    stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    const { app } = await import('../app');
    const r = await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    const enviar = async (evento: object) => {
      const cuerpo = JSON.stringify(evento);
      return app.request(
        '/datos/stripe/aviso',
        { method: 'POST', body: cuerpo, headers: { 'stripe-signature': await firmar(cuerpo) } },
        { DB: m.DB, STRIPE_WEBHOOK_SECRET: SECRETO },
      );
    };
    const estado = async () =>
      await m.DB.prepare('SELECT estado, stripe_pago FROM pedidos WHERE id = ?')
        .bind(r.datos.pedidoId)
        .first<{ estado: string; stripe_pago: string | null }>();
    // Monto que no cuadra: no se toca.
    await enviar({
      id: 'evt_pi_x',
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'cs_test_1', amount_received: 1, metadata: { pedido_id: r.datos.pedidoId } },
      },
    });
    expect((await estado())?.estado).toBe('pago_pendiente');
    // Otro intento de pago con el mismo pedido: no se toca.
    await enviar({
      id: 'evt_pi_y',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_otro',
          amount_received: r.datos.desglose.totalCliente,
          metadata: { pedido_id: r.datos.pedidoId },
        },
      },
    });
    expect((await estado())?.estado).toBe('pago_pendiente');
    const bueno = {
      id: 'evt_pi_ok',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'cs_test_1',
          amount_received: r.datos.desglose.totalCliente,
          metadata: { pedido_id: r.datos.pedidoId },
        },
      },
    };
    expect((await enviar(bueno)).status).toBe(200);
    expect(await estado()).toEqual({ estado: 'pagado', stripe_pago: 'cs_test_1' });
    const repetido = await enviar(bueno);
    expect(((await repetido.json()) as { repetido?: boolean }).repetido).toBe(true);
  });

  it('el cliente de Stripe se crea una sola vez por persona', async () => {
    const llamadas = stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    await m.llamar('POST', '/datos/pedidos', pedidoBase, cliente.token);
    expect(llamadas.filter((l) => l.url.endsWith('/customers'))).toHaveLength(1);
    expect(llamadas.filter((l) => l.url.includes('/payment_intents'))).toHaveLength(2);
  });
});
