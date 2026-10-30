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
    STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
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
  const p = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
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
    // La clave pública va con el cobro: el botón no espera otra consulta que puede venir vieja.
    expect(r.datos.clavePublica).toBe('pk_test_x');
    expect(r.datos.desglose.subtotal).toBe(3000);
    const intento = llamadas.find((l) => l.url.includes('/payment_intents'));
    expect(decodeURIComponent(intento?.cuerpo ?? '')).toContain(
      `amount=${r.datos.desglose.totalCliente}`,
    );
    expect(decodeURIComponent(intento?.cuerpo ?? '')).toContain(
      `metadata[pedido_id]=${r.datos.pedidoId}`,
    );
    // Sin esto, Stripe rechaza el formulario de tarjeta porque la sesión permite guardarla.
    expect(decodeURIComponent(intento?.cuerpo ?? '')).toContain('setup_future_usage=off_session');
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
    expect(r.datos.error).toContain('Payments aren’t turned on yet');
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
    // Fase 0: los retiros nacen apagados; aquí se encienden con la bandera.
    await m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('retiros_activos', '1')").run();
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

describe('tarjetas guardadas (Mi cuenta)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lista las tarjetas del cliente y solo deja quitar las suyas', async () => {
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const cliente = await m.cuenta('cliente');
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push(`${init?.method} ${url}`);
      if (url.includes('/customers/cus_mio/payment_methods'))
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'pm_mia',
                customer: 'cus_mio',
                card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2031 },
              },
            ],
          }),
          { status: 200 },
        );
      if (url.endsWith('/payment_methods/pm_mia'))
        return new Response(JSON.stringify({ id: 'pm_mia', customer: 'cus_mio' }), { status: 200 });
      if (url.endsWith('/payment_methods/pm_ajena'))
        return new Response(JSON.stringify({ id: 'pm_ajena', customer: 'cus_otro' }), {
          status: 200,
        });
      if (url.endsWith('/detach')) return new Response('{}', { status: 200 });
      return new Response('{}', { status: 404 });
    });
    // Sin cliente de Stripe todavía: lista vacía, sin llamar a Stripe.
    expect(
      (await m.llamar('GET', '/datos/mis-tarjetas', undefined, cliente.token)).datos.tarjetas,
    ).toEqual([]);
    await m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_mio' WHERE id = ?")
      .bind(cliente.id)
      .run();
    const lista = await m.llamar('GET', '/datos/mis-tarjetas', undefined, cliente.token);
    expect(lista.datos.tarjetas).toEqual([
      { id: 'pm_mia', marca: 'visa', ultimos4: '4242', vence: '04/31' },
    ]);
    expect(
      (await m.llamar('POST', '/datos/mis-tarjetas/pm_ajena/quitar', {}, cliente.token)).estado,
    ).toBe(404);
    expect(llamadas.some((l) => l.includes('pm_ajena/detach'))).toBe(false);
    expect(
      (await m.llamar('POST', '/datos/mis-tarjetas/pm_mia/quitar', {}, cliente.token)).estado,
    ).toBe(200);
    expect(llamadas.some((l) => l.includes('pm_mia/detach'))).toBe(true);
  });
});

// C-NOTA-PLATO (30 oct 2026): «sin cebolla» por plato, como las instrucciones especiales de Uber Eats.
describe('nota por plato', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cada plato guarda su nota limpia, el mismo plato con dos notas son dos líneas, y el restaurante las ve', async () => {
    stripeFalso();
    const { m, cliente, dueno, pedidoBase, platoId } = await escenario();
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        ...pedidoBase,
        lineas: [
          { platoId, cantidad: 1, nota: '  sin   cebolla\n' },
          { platoId, cantidad: 1, nota: 'bien cocido' },
          { platoId, cantidad: 1 },
        ],
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    const fila = await m.DB.prepare('SELECT lineas_json FROM pedidos WHERE id = ?')
      .bind(r.datos.pedidoId)
      .first<{ lineas_json: string }>();
    const lineas = JSON.parse(fila!.lineas_json) as { nota?: string }[];
    expect(lineas.map((l) => l.nota ?? null)).toEqual(['sin cebolla', 'bien cocido', null]);
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = ?",
    )
      .bind(r.datos.pedidoId)
      .run();
    const rest = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    const p = rest.datos.pedidos.find((x: { id: string }) => x.id === r.datos.pedidoId);
    expect(p.lineas.map((l: { nota?: string }) => l.nota ?? null)).toEqual([
      'sin cebolla',
      'bien cocido',
      null,
    ]);
  });

  it('una nota demasiado larga no se acepta', async () => {
    stripeFalso();
    const { m, cliente, pedidoBase, platoId } = await escenario();
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      { ...pedidoBase, lineas: [{ platoId, cantidad: 1, nota: 'x'.repeat(400) }] },
      cliente.token,
    );
    expect(r.estado).toBe(400);
  });
});

// C-DIRECCION-APTO (30 oct 2026): como DoorDash y Uber Eats, apartamento, piso o edificio va en su
// propia casilla; se guarda aparte y se suma a la dirección que leen el repartidor y el restaurante.
describe('apartamento, piso o edificio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el pedido guarda el apartamento aparte y la dirección lo muestra', async () => {
    stripeFalso();
    const { m, cliente, pedidoBase } = await escenario();
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      { ...pedidoBase, apto: '  Apto 4B  ' },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    const f = await m.DB.prepare('SELECT direccion, apto FROM pedidos WHERE id = ?')
      .bind(r.datos.pedidoId)
      .first();
    expect(f).toEqual({ direccion: '200 Calle Prueba, Miami · Apto 4B', apto: 'Apto 4B' });
  });

  it('la dirección guardada recuerda el apartamento', async () => {
    const { m, cliente } = await escenario();
    const g = await m.llamar(
      'POST',
      '/datos/mis-direcciones',
      { direccion: '200 Calle Prueba, Miami', apto: 'Piso 3', etiqueta: 'Casa' },
      cliente.token,
    );
    expect(g.estado).toBe(201);
    const l = await m.llamar('GET', '/datos/mis-direcciones', undefined, cliente.token);
    expect(l.datos.direcciones[0].apto).toBe('Piso 3');
  });
});
