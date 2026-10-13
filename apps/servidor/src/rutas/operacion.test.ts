import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

const SECRETO_AVISO = `whsec_${crypto.randomUUID()}`;

/** Firma un aviso como lo firma Stripe (t=…,v1=HMAC-SHA256). */
async function avisoFirmado(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO_AVISO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  const v1 = [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${v1}`;
}

async function escenario() {
  vi.stubGlobal('fetch', async (url: string) =>
    /\/(payment_intents|customers|customer_sessions)/.test(url)
      ? new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRETO_AVISO });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
    { estado: 'aprobado' },
    admin.token,
  );
  await m.llamar('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, dueno.token);
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  async function pedidoPagado() {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 400,
        direccion: '200 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(p.datos.pedidoId)
      .run();
    return p.datos.pedidoId as string;
  }
  async function repartidor(nombre: string, lat: number, lng: number) {
    const d = await m.cuenta('repartidor', nombre);
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, lat, lng }, d.token);
    return d;
  }
  /** Un pedido como lo hace la app: se crea y el pago llega por el aviso firmado de Stripe. */
  async function pedidoPagadoPorStripe() {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'cs_1',
          amount_received: p.datos.desglose.totalCliente,
          metadata: { pedido_id: p.datos.pedidoId },
        },
      },
    });
    const res = await m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
    return { id: p.datos.pedidoId as string, desglose: p.datos.desglose, aviso: res.status };
  }
  return { m, dueno, cliente, pedidoPagado, pedidoPagadoPorStripe, repartidor };
}

describe('día del restaurante', () => {
  it('el día empieza a medianoche de Miami, no de Londres', async () => {
    const { limitesDelDia } = await import('./operacion');
    // 10 oct 2026, 02:00 en Miami = 06:00 UTC (horario de verano, UTC-4).
    expect(limitesDelDia('America/New_York', new Date('2026-10-10T06:00:00Z'))).toEqual([
      '2026-10-10 04:00:00',
      '2026-10-11 04:00:00',
    ]);
    // A las 22:00 de Miami ya es el día siguiente en UTC, pero sigue siendo el mismo día del restaurante.
    expect(limitesDelDia('America/New_York', new Date('2026-10-11T02:00:00Z'))).toEqual([
      '2026-10-10 04:00:00',
      '2026-10-11 04:00:00',
    ]);
  });
});

describe('ciclo del pedido', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('de pagado a entregado, con dinero acreditado una sola vez', async () => {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const id = await pedidoPagado();
    const lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect(lista.datos.pedidos[0].estado).toBe('pagado');

    const rep = await repartidor('Pedro Repartidor', 25.771, -80.191);
    // Antes de aceptar el restaurante, no hay oferta.
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas,
    ).toHaveLength(0);
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas[0].id).toBe(id);
    expect(ofertas.datos.ofertas[0].pagoRepartidor).toBe(900);
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);

    // No se puede recoger antes de que esté listo.
    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/recogido`, {}, rep.token)).estado,
    ).toBe(409);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/recogido`, {}, rep.token);
    await m.llamar('POST', '/datos/repartidor/ubicacion', { lat: 25.775, lng: -80.195 }, rep.token);

    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.estado).toBe('en_camino');
    expect(seg.datos.pedido.repartidor).toMatchObject({ nombre: 'Pedro', lat: 25.775 });
    // Para el mapa en vivo: el restaurante y el tiempo estimado (solo el viaje: ya salió de cocina).
    expect(seg.datos.pedido.restaurante).toEqual({ lat: 25.77, lng: -80.19 });
    expect(seg.datos.pedido.minutosEstimados).toBeGreaterThanOrEqual(5);
    expect(seg.datos.pedido.minutosEstimados).toBeLessThan(20);

    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token)).estado,
    ).toBe(409);
    const resumen = await m.llamar('GET', '/datos/restaurante/resumen', undefined, dueno.token);
    expect(resumen.datos.resumen).toMatchObject({
      entregados: 1,
      ventas: 3000,
      comision: 225,
      neto: 2775,
    });
    const bRest = await m.llamar('GET', '/datos/billetera', undefined, dueno.token);
    expect(bRest.datos.saldo).toBe(3000 - 225);
    const bRep = await m.llamar('GET', '/datos/billetera', undefined, rep.token);
    expect(bRep.datos.saldo).toBe(900);
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.puntos).toBe(10);
    // Al terminar, la ubicación del repartidor deja de mostrarse al cliente.
    const fin = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(fin.datos.pedido.repartidor.lat).toBeNull();
    expect(fin.datos.pedido.minutosEstimados).toBeNull();
  });

  it('la oferta va primero al más cercano; rechazar no castiga y pasa al siguiente', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const id = await pedidoPagado();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    const lejos = await repartidor('Lejos', 25.85, -80.25);
    const cerca = await repartidor('Cerca', 25.7702, -80.1902);
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, lejos.token)).datos.ofertas,
    ).toHaveLength(0);
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, cerca.token)).datos.ofertas,
    ).toHaveLength(1);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/rechazar`, {}, cerca.token);
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, lejos.token)).datos.ofertas,
    ).toHaveLength(1);
    // No puede aceptar quien ya no tiene la oferta.
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, cerca.token)).estado,
    ).toBe(409);
  });

  it('a igual distancia gana el de nivel más alto', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const novato = await repartidor('Novato', 25.7701, -80.1901);
    const veterano = await repartidor('Veterano', 25.7702, -80.1902);
    await m.DB.prepare('UPDATE repartidores SET puntos = 2000 WHERE usuario_id = ?')
      .bind(veterano.id)
      .run();
    const id = await pedidoPagado();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, novato.token)).datos.ofertas,
    ).toHaveLength(0);
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, veterano.token)).datos.ofertas,
    ).toHaveLength(1);
  });

  it('rechazar un pedido pagado devuelve el dinero y lo cancela', async () => {
    const { m, dueno, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const r = await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token);
    expect(r.estado).toBe(200);
    const f = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(f?.estado).toBe('cancelado');
  });

  it('otro restaurante no puede tocar el pedido y el cliente no ve pedidos ajenos', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const otro = await m.cuenta('restaurante');
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Otro' },
      otro.token,
    );
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 10 },
          otro.token,
        )
      ).estado,
    ).toBe(409);
    const intruso = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, intruso.token)).estado,
    ).toBe(404);
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)).estado,
    ).toBe(200);
  });

  it('calificar solo cuando está entregado', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const antes = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/calificar`,
      { estrellasRestaurante: 5 },
      cliente.token,
    );
    expect(antes.estado).toBe(409);
    await m.DB.prepare("UPDATE pedidos SET estado = 'entregado' WHERE id = ?").bind(id).run();
    const ok = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/calificar`,
      { estrellasRestaurante: 5, estrellasRepartidor: 2, culpaRestaurante: true },
      cliente.token,
    );
    expect(ok.estado).toBe(200);
  });
});

describe('recorrido completo como en la calle (C-ENSAYO-CALLE)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pago por aviso de Stripe → restaurante → repartidor → entrega → billeteras → calificación', async () => {
    const { m, dueno, cliente, pedidoPagadoPorStripe, repartidor } = await escenario();
    const rep = await repartidor('Repartidor Calle', 25.7705, -80.1905);
    const { id, desglose, aviso } = await pedidoPagadoPorStripe();
    expect(aviso).toBe(200);

    // El restaurante lo ve pagado, lo acepta y al repartidor cercano le llega la oferta.
    const lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect(lista.datos.pedidos.find((p: { id: string }) => p.id === id)?.estado).toBe('pagado');
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 10 },
      dueno.token,
    );
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas[0]?.id).toBe(id);
    expect(ofertas.datos.ofertas[0]?.pagoRepartidor).toBe(desglose.pagoRepartidor);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/recogido`, {}, rep.token);

    // El cliente lo sigue en camino.
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.estado).toBe('en_camino');

    // Entrega: el dinero cuadra al centavo con el desglose que vio el cliente.
    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token)).estado,
    ).toBe(200);
    expect((await m.llamar('GET', '/datos/billetera', undefined, dueno.token)).datos.saldo).toBe(
      desglose.pagoRestaurante,
    );
    expect((await m.llamar('GET', '/datos/billetera', undefined, rep.token)).datos.saldo).toBe(
      desglose.pagoRepartidor,
    );

    // Y el cliente califica.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/pedidos/${id}/calificar`,
          { estrellasRestaurante: 5, estrellasRepartidor: 5 },
          cliente.token,
        )
      ).estado,
    ).toBe(200);
  });
});

describe('reloj externo', () => {
  it('sin secreto correcto no existe; con él reparte ofertas pendientes', async () => {
    const SEC = 'secreto-del-reloj-de-prueba-123456';
    const m = mundo({ RELOJ_SECRETO: SEC });
    const sin = await m.llamar('POST', '/datos/reloj', {});
    expect(sin.estado).toBe(404);
    const { app } = await import('../app');
    const con = await app.request(
      '/datos/reloj',
      { method: 'POST', headers: { 'x-reloj-secreto': SEC, 'cf-connecting-ip': '10.0.0.9' } },
      { DB: m.DB, RELOJ_SECRETO: SEC },
    );
    expect(con.status).toBe(200);
    expect(((await con.json()) as { ok: boolean }).ok).toBe(true);
    const nada = await app.request(
      '/datos/reloj',
      { method: 'POST', headers: { 'x-reloj-secreto': SEC } },
      { DB: m.DB },
    );
    expect(nada.status).toBe(404);
  });
});

describe('tablero del restaurante (C-TABLERO-REST)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cuenta pedidos, ventas, platos más vendidos y calificación de sus entregas', async () => {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Rep Tablero', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/recogido`, {}, rep.token);
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token);
    await m.llamar(
      'POST',
      `/datos/pedidos/${id}/calificar`,
      { estrellasRestaurante: 4, estrellasRepartidor: 5 },
      cliente.token,
    );
    const r = await m.llamar('GET', '/datos/restaurante/tablero', undefined, dueno.token);
    expect(r.estado).toBe(200);
    expect(r.datos.tablero.semana).toMatchObject({
      pedidos: 1,
      ventas: 3000,
      ticketPromedio: 3000,
    });
    expect(r.datos.tablero.topPlatos[0]).toMatchObject({ nombreEs: 'Cubano', cantidad: 2 });
    expect(r.datos.tablero.calificacion).toBe(4);
    // Un cliente no ve el tablero de nadie.
    expect(
      (await m.llamar('GET', '/datos/restaurante/tablero', undefined, cliente.token)).estado,
    ).toBe(403);
  });
});

describe('Manager con reglas y cancelación del cliente (C-MANAGER-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Cuenta las devoluciones pedidas a Stripe sin dejar de responder como Stripe. */
  function contarReembolsos(falla = false) {
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      llamadas.push(url);
      if (url.includes('/refunds') && falla)
        return new Response(JSON.stringify({ error: { message: 'caído' } }), { status: 500 });
      return new Response(JSON.stringify({ id: 're_1', data: [] }), { status: 200 });
    });
    return () => llamadas.filter((u) => u.includes('/refunds')).length;
  }

  const atrasar = (m: { DB: D1Database }, id: string, campo: string, minutos: number) =>
    m.DB.prepare(`UPDATE pedidos SET ${campo} = datetime('now', ?) WHERE id = ?`)
      .bind(`-${minutos} minutes`, id)
      .run();

  it('el cliente cancela antes de que acepten y el dinero vuelve', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const reembolsos = contarReembolsos();
    const r = await m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token);
    expect(r.estado).toBe(200);
    expect(reembolsos()).toBe(1);
    const f = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first();
    expect(f?.estado).toBe('cancelado');
  });

  it('no se puede cancelar si el restaurante ya aceptó, ni el pedido de otro', async () => {
    const { m, cliente, dueno, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const otro = await m.cuenta('cliente', 'Otro');
    const ajeno = await m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, otro.token);
    expect(ajeno.estado).toBe(409);
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    const tarde = await m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token);
    expect(tarde.estado).toBe(409);
  });

  it('si Stripe no devuelve el dinero, el pedido NO queda cancelado', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    contarReembolsos(true);
    const r = await m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token);
    expect(r.estado).toBe(422);
    const f = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first();
    expect(f?.estado).toBe('pagado');
  });

  it('recuerda a los 3 y 6 minutos (una sola vez cada uno) y cancela con reembolso a los 10', async () => {
    const { m, pedidoPagado } = await escenario();
    const { vigilarPedidos } = await import('../manager');
    const env = { DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    const id = await pedidoPagado();
    const reembolsos = contarReembolsos();
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(0);
    await atrasar(m, id, 'pagado_en', 4);
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(1);
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(0);
    await atrasar(m, id, 'pagado_en', 7);
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(1);
    await atrasar(m, id, 'pagado_en', 11);
    expect((await vigilarPedidos(env, m.DB)).cancelados).toBe(1);
    expect(reembolsos()).toBe(1);
    const f = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first();
    expect(f?.estado).toBe('cancelado');
    const { results } = await m.DB.prepare(
      'SELECT evento FROM bitacora_pedidos WHERE pedido_id = ? ORDER BY id',
    )
      .bind(id)
      .all();
    expect(results.map((x) => x.evento)).toEqual([
      'recordatorio_1',
      'recordatorio_2',
      'cancelado_sin_respuesta',
    ]);
  });

  it('el seguimiento del cliente también dispara la cancelación a tiempo', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    contarReembolsos();
    await atrasar(m, id, 'pagado_en', 12);
    const s = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(s.datos.pedido.estado).toBe('cancelado');
    // Y se le dice al cliente por qué: el restaurante no respondió.
    expect(s.datos.pedido.motivoCancelacion).toBe('sin_respuesta');
  });

  it('un pedido aceptado sin repartidor avisa una sola vez a los 15 minutos', async () => {
    const { m, dueno, pedidoPagado } = await escenario();
    const { vigilarPedidos } = await import('../manager');
    const env = { DB: m.DB } as never;
    const id = await pedidoPagado();
    contarReembolsos();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    expect((await vigilarPedidos(env, m.DB)).sinRepartidor).toBe(0);
    await atrasar(m, id, 'aceptado_en', 16);
    expect((await vigilarPedidos(env, m.DB)).sinRepartidor).toBe(1);
    expect((await vigilarPedidos(env, m.DB)).sinRepartidor).toBe(0);
  });

  it('la bitácora del pedido solo la ve el administrador y trae todo en orden', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    contarReembolsos();
    await m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token);
    const nadie = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, cliente.token);
    expect(nadie.estado).toBe(403);
    const admin = await m.cuenta('admin');
    const r = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(r.estado).toBe(200);
    const eventos = r.datos.pedido.bitacora.map((b: { evento: string }) => b.evento);
    expect(eventos[0]).toBe('creado');
    expect(eventos).toContain('cancelado');
    expect(eventos).toContain('cancelado_por_cliente');
  });

  it('pedidos en curso: solo admin, los rojos primero, y la ficha trae el estado del KYC', async () => {
    const { m, pedidoPagado } = await escenario();
    contarReembolsos();
    const nuevo = await pedidoPagado();
    const viejo = await pedidoPagado();
    await atrasar(m, viejo, 'pagado_en', 7);
    const cliente = await m.cuenta('cliente');
    expect((await m.llamar('GET', '/datos/admin/pedidos', undefined, cliente.token)).estado).toBe(
      403,
    );
    const admin = await m.cuenta('admin');
    const r = await m.llamar('GET', '/datos/admin/pedidos', undefined, admin.token);
    expect(r.datos.pedidos.map((p: { id: string }) => p.id)).toEqual([viejo, nuevo]);
    expect(r.datos.pedidos[0].luz).toBe('rojo');
    expect(r.datos.pedidos[1].luz).toBe('verde');
    const rest = await m.DB.prepare('SELECT restaurante_id FROM pedidos WHERE id = ?')
      .bind(nuevo)
      .first();
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/restaurantes/${rest?.restaurante_id}`,
      undefined,
      admin.token,
    );
    expect(ficha.datos.restaurante.kyc.estado).toBe('sin_enviar');
  });

  it('un pedido abandonado en el pago se anula en Stripe y se cierra a las 2 horas', async () => {
    const { m, cliente } = await escenario();
    const { vigilarPedidos } = await import('../manager');
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      llamadas.push(url);
      return new Response(
        JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_secret_y', status: 'canceled' }),
        { status: 200 },
      );
    });
    const r = await m.DB.prepare('SELECT id FROM restaurantes LIMIT 1').first<{ id: string }>();
    const plato = await m.DB.prepare('SELECT id FROM platos LIMIT 1').first<{ id: string }>();
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r?.id,
        lineas: [{ platoId: plato?.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '1 Calle',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    const env = { DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    expect((await vigilarPedidos(env, m.DB)).abandonados).toBe(0);
    await m.DB.prepare("UPDATE pedidos SET creado_en = datetime('now','-3 hours') WHERE id = ?")
      .bind(id)
      .run();
    expect((await vigilarPedidos(env, m.DB)).abandonados).toBe(1);
    expect(llamadas.some((u) => /\/payment_intents\/.+\/cancel$/.test(u))).toBe(true);
    const f = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first();
    expect(f?.estado).toBe('cancelado');
  });
});
