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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas[0].id).toBe(id);
    expect(ofertas.datos.ofertas[0].pagoRepartidor).toBe(900);
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);

    // No se puede recoger antes de que esté listo.
    expect(
      (
        await m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, {
          lat: 25.77,
          lng: -80.19,
        })
      ).estado,
    ).toBe(409);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    await m.llamar('POST', '/datos/repartidor/ubicacion', { lat: 25.775, lng: -80.195 }, rep.token);

    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.estado).toBe('en_camino');
    expect(seg.datos.pedido.repartidor).toMatchObject({ nombre: 'Pedro', lat: 25.775 });
    // Para el mapa en vivo: el restaurante y el tiempo estimado (solo el viaje: ya salió de cocina).
    expect(seg.datos.pedido.restaurante).toEqual({ lat: 25.77, lng: -80.19 });
    expect(seg.datos.pedido.minutosEstimados).toBeGreaterThanOrEqual(5);
    expect(seg.datos.pedido.minutosEstimados).toBeLessThan(20);

    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    expect((await m.entregar(id, rep.token)).estado).toBe(409);
    const resumen = await m.llamar('GET', '/datos/restaurante/resumen', undefined, dueno.token);
    expect(resumen.datos.resumen).toMatchObject({
      entregados: 1,
      ventas: 3000,
      comision: 225,
      neto: 2775,
    });
    // Para la calculadora «cuánto te queda con otras apps»: los últimos 30 días y el plan.
    expect(resumen.datos.mes).toEqual({ ventas: 3000, regalos: 0, pedidos: 1 });
    expect(resumen.datos.plan).toBe('inicial');
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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
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
          { minutos: 5 },
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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas[0]?.id).toBe(id);
    expect(ofertas.datos.ofertas[0]?.pagoRepartidor).toBe(desglose.pagoRepartidor);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);

    // El cliente lo sigue en camino.
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.estado).toBe('en_camino');

    // Entrega: el dinero cuadra al centavo con el desglose que vio el cliente.
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    await m.entregar(id, rep.token);
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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
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
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
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

describe('recogida con foto y entrega en la puerta (C-RECOGIDA-FOTO, C-ENTREGA-EN-PUERTA)', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function hastaListo() {
    const e = await escenario();
    const rep = await e.repartidor('Luis Prueba', 25.771, -80.191);
    const id = await e.pedidoPagado();
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    return { ...e, rep, id };
  }
  const estado = async (m: Awaited<ReturnType<typeof escenario>>['m'], id: string) =>
    (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;

  it('sin la foto del repartidor el restaurante no puede soltar el pedido', async () => {
    const { m, dueno, id } = await hastaListo();
    const r = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/confirmar-recogida`,
      {},
      dueno.token,
    );
    expect(r.estado).toBe(409);
    expect(await estado(m, id)).toBe('listo');
  });

  it('la foto lejos del restaurante o sin ubicación no vale', async () => {
    const { m, rep, id } = await hastaListo();
    const ruta = `/datos/repartidor/pedidos/${id}/foto-recogida`;
    expect((await m.foto(ruta, rep.token, { lat: 25.8, lng: -80.25 })).estado).toBe(409);
    expect((await m.foto(ruta, rep.token)).estado).toBe(422);
  });

  it('con la foto, el pedido sigue en el restaurante hasta que el restaurante confirma', async () => {
    const { m, dueno, rep, cliente, id } = await hastaListo();
    const f = await m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, {
      lat: 25.7701,
      lng: -80.1901,
    });
    expect(f.estado).toBe(200);
    expect(await estado(m, id)).toBe('listo');
    const lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    const p = lista.datos.pedidos.find((x: { id: string }) => x.id === id);
    expect(p.fotoRecogida).toMatchObject({ confirmadaEn: null });
    // El restaurante ve la foto; un cliente cualquiera no.
    expect(
      (
        await m.crudo(`/datos/pedidos/${id}/evidencia/recogida`, {
          headers: { authorization: `Bearer ${dueno.token}` },
        })
      ).status,
    ).toBe(200);
    const extrano = await m.cuenta('cliente', 'Otra Persona');
    expect(
      (
        await m.crudo(`/datos/pedidos/${id}/evidencia/recogida`, {
          headers: { authorization: `Bearer ${extrano.token}` },
        })
      ).status,
    ).toBe(404);
    expect((await m.crudo(`/datos/pedidos/${id}/evidencia/recogida`, {})).status).toBe(401);

    const ok = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/confirmar-recogida`,
      {},
      dueno.token,
    );
    expect(ok.estado).toBe(200);
    expect(await estado(m, id)).toBe('en_camino');
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.fotoRecogida.confirmadaEn).toBeTruthy();
    expect(
      (
        await m.crudo(`/datos/pedidos/${id}/evidencia/recogida`, {
          headers: { authorization: `Bearer ${cliente.token}` },
        })
      ).status,
    ).toBe(200);
  });

  it('la cuenta del revisor de las tiendas prueba desde lejos, pero igual con foto', async () => {
    const { m, dueno, rep, id } = await hastaListo();
    const fila = await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(rep.id)
      .first<{ correo: string }>();
    (m.extra as Record<string, unknown>).CORREOS_REVISOR = `otro@ejemplo.com, ${fila!.correo}`;
    const lejos = { lat: 37.33, lng: -122.03 };
    expect(
      (await m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, lejos)).estado,
    ).toBe(200);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}, dueno.token);
    expect((await m.entregar(id, rep.token, lejos)).estado).toBe(200);
  });

  it('entregar lejos de la casa no se puede ni acredita dinero; en la puerta sí, con su foto', async () => {
    const { m, dueno, rep, cliente, id } = await hastaListo();
    await m.recoger(id, rep.token, dueno.token);
    const lejos = await m.entregar(id, rep.token, { lat: 25.771, lng: -80.191 });
    expect(lejos.estado).toBe(409);
    expect(await estado(m, id)).toBe('en_camino');
    expect((await m.llamar('GET', '/datos/billetera', undefined, rep.token)).datos.saldo).toBe(0);
    // Sin foto tampoco.
    const sinFoto = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      {},
      rep.token,
    );
    expect(sinFoto.estado).not.toBe(200);
    expect((await m.entregar(id, rep.token, { lat: 25.7801, lng: -80.2001 })).estado).toBe(200);
    expect(await estado(m, id)).toBe('entregado');
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.fotoEntrega).toBeTruthy();
    expect(
      (
        await m.crudo(`/datos/pedidos/${id}/evidencia/entrega`, {
          headers: { authorization: `Bearer ${cliente.token}` },
        })
      ).status,
    ).toBe(200);
  });
});

describe('despacho con reloj (C-DESPACHO-RELOJ)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('un pedido con 30 minutos de cocina no se ofrece todavía; al marcar «Listo» se ofrece ya', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Rep Reloj', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 30 },
      dueno.token,
    );
    let ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas).toHaveLength(0);
    // El reloj avanza: aceptó hace 26 minutos → faltan 4 → ya es hora (2 de viaje + 3 de margen).
    await m.DB.prepare(
      "UPDATE pedidos SET aceptado_en = datetime('now','-26 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas[0]?.id).toBe(id);
    expect(ofertas.datos.ofertas[0]?.minutosParaListo).toBe(4);
  });

  it('si el restaurante toca «Listo» antes de tiempo, la oferta sale al instante', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Rep Listo', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 45 },
      dueno.token,
    );
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas,
    ).toHaveLength(0);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(ofertas.datos.ofertas[0]?.id).toBe(id);
    expect(ofertas.datos.ofertas[0]?.minutosParaListo).toBe(0);
  });
});

describe('el restaurante ve venir al repartidor y el cliente sabe cuando llega (C-LLEGADAS)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('llegó al restaurante lo marca la ubicación; la espera cuenta desde la hora de listo', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Luis Llega', 25.78, -80.2); // lejos: 1,5 km
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    let lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    let p = lista.datos.pedidos.find((x: { id: string }) => x.id === id);
    expect(p.repartidor).toMatchObject({ nombre: 'Luis', llego: false });
    expect(p.repartidor.minutosParaLlegar).toBeGreaterThanOrEqual(2);
    // Se acerca hasta la puerta del restaurante.
    await m.llamar(
      'POST',
      '/datos/repartidor/ubicacion',
      { lat: 25.7701, lng: -80.1901 },
      rep.token,
    );
    lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    p = lista.datos.pedidos.find((x: { id: string }) => x.id === id);
    expect(p.repartidor.llego).toBe(true);
    // Llegó antes de la hora de listo: la espera empieza a la hora de listo, no ahora.
    expect(Date.parse(p.repartidor.esperandoDesde)).toBeGreaterThan(Date.now() + 3 * 60_000);
    // Llegó hace 6 minutos; la hora de listo prometida fue hace 4: el restaurante se atrasó 4 minutos.
    await m.DB.prepare("UPDATE pedidos SET aceptado_en = datetime('now','-9 minutes') WHERE id = ?")
      .bind(id)
      .run();
    await m.DB.prepare(
      "UPDATE hitos_pedido SET creado_en = datetime('now','-6 minutes') WHERE pedido_id = ? AND hito = 'llego_restaurante'",
    )
      .bind(id)
      .run();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    p = lista.datos.pedidos.find((x: { id: string }) => x.id === id);
    expect(p.repartidor.esperaEvitableSeg).toBeGreaterThanOrEqual(230);
    expect(p.repartidor.salio).toBe(true);
  });

  it('casi llega y llegó a la puerta: el cliente recibe los dos avisos una sola vez', async () => {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Ana Puerta', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    // A 400 m de la casa (25.78, -80.2): casi llega. A 50 m: llegó.
    await m.llamar('POST', '/datos/repartidor/ubicacion', { lat: 25.7836, lng: -80.2 }, rep.token);
    await m.llamar('POST', '/datos/repartidor/ubicacion', { lat: 25.7836, lng: -80.2 }, rep.token);
    let seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.repartidor).toMatchObject({ casiLlega: true, llego: false });
    await m.llamar('POST', '/datos/repartidor/ubicacion', { lat: 25.7804, lng: -80.2 }, rep.token);
    seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.repartidor).toMatchObject({ casiLlega: true, llego: true });
    const hitos = await m.DB.prepare(
      'SELECT hito FROM hitos_pedido WHERE pedido_id = ? ORDER BY hito',
    )
      .bind(id)
      .all<{ hito: string }>();
    expect(hitos.results.map((h) => h.hito).filter((h) => h !== 'espera_evitable')).toEqual([
      'casi_llega',
      'llego_cliente',
      'llego_restaurante',
    ]);
  });
});

describe('código QR, entrega en mano o en lugar seguro, chat y repartidor que se baja', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function hastaListo(prep = 5) {
    const e = await escenario();
    const rep = await e.repartidor('Luis Prueba', 25.771, -80.191);
    const id = await e.pedidoPagado();
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: prep },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    return { ...e, rep, id };
  }
  const estado = async (m: Awaited<ReturnType<typeof escenario>>['m'], id: string) =>
    (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;

  it('con el código de la pantalla verificado, la foto hace salir el pedido sin que el restaurante toque nada (C-QR)', async () => {
    const { m, rep, id } = await hastaListo();
    const malo = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/verificar`,
      { codigo: 'ZZZZ' },
      rep.token,
    );
    expect(malo.estado).toBe(409);
    const bueno = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/verificar`,
      { codigo: `tumbite:pedido:${id}` },
      rep.token,
    );
    expect(bueno.estado).toBe(200);
    const f = await m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, {
      lat: 25.7701,
      lng: -80.1901,
    });
    expect(f.datos.salio).toBe(true);
    expect(await estado(m, id)).toBe('en_camino');
  });

  it('los 4 caracteres del número también valen; si la foto ya estaba, el código hace salir el pedido', async () => {
    const { m, rep, id } = await hastaListo();
    await m.foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, rep.token, {
      lat: 25.7701,
      lng: -80.1901,
    });
    expect(await estado(m, id)).toBe('listo');
    const r = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/verificar`,
      { codigo: id.slice(0, 4).toLowerCase() },
      rep.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.salio).toBe(true);
    expect(await estado(m, id)).toBe('en_camino');
  });

  it('en mano: sin foto, pero solo en la puerta; queda anotado cómo se entregó', async () => {
    const { m, dueno, cliente, rep, id } = await hastaListo();
    await m.DB.prepare(
      "INSERT OR REPLACE INTO preferencias_entrega (pedido_id, modo) VALUES (?, 'mano')",
    )
      .bind(id)
      .run();
    await m.recoger(id, rep.token, dueno.token);
    const lejos = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { lat: 25.771, lng: -80.191, modo: 'mano' },
      rep.token,
    );
    expect(lejos.estado).toBe(409);
    const ok = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { lat: 25.7801, lng: -80.2001, modo: 'mano' },
      rep.token,
    );
    expect(ok.estado).toBe(200);
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido).toMatchObject({
      estado: 'entregado',
      entrega: 'mano',
      entregadoComo: 'mano',
      fotoEntrega: null,
    });
  });

  it('cliente no aparece: aviso desde la puerta, 5 minutos de espera y lugar seguro con foto y nota', async () => {
    const { m, dueno, cliente, rep, id } = await hastaListo();
    await m.recoger(id, rep.token, dueno.token);
    // Lejos de la puerta no se puede avisar.
    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/no-aparece`, {}, rep.token)).estado,
    ).toBe(409);
    await m.llamar(
      'POST',
      '/datos/repartidor/ubicacion',
      { lat: 25.7801, lng: -80.2001 },
      rep.token,
    );
    const aviso = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/no-aparece`,
      {},
      rep.token,
    );
    expect(aviso.estado).toBe(200);
    expect(Date.parse(aviso.datos.esperaHasta)).toBeGreaterThan(Date.now() + 4 * 60_000);
    // Antes de los 5 minutos, no.
    const pronto = await m.foto(
      `/datos/repartidor/pedidos/${id}/entregado?modo=seguro&nota=En%20la%20recepci%C3%B3n`,
      rep.token,
      { lat: 25.7801, lng: -80.2001 },
    );
    expect(pronto.estado).toBe(409);
    await m.DB.prepare(
      "UPDATE hitos_pedido SET creado_en = datetime('now','-6 minutes') WHERE pedido_id = ? AND hito = 'no_aparece'",
    )
      .bind(id)
      .run();
    const sinNota = await m.foto(
      `/datos/repartidor/pedidos/${id}/entregado?modo=seguro`,
      rep.token,
      { lat: 25.7801, lng: -80.2001 },
    );
    expect(sinNota.estado).toBe(422);
    const ok = await m.foto(
      `/datos/repartidor/pedidos/${id}/entregado?modo=seguro&nota=En%20la%20recepci%C3%B3n`,
      rep.token,
      { lat: 25.7801, lng: -80.2001 },
    );
    expect(ok.estado).toBe(200);
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido).toMatchObject({
      entregadoComo: 'seguro',
      notaEntrega: 'En la recepción',
    });
    expect(seg.datos.pedido.fotoEntrega).toBeTruthy();
  });

  it('el chat: cliente y repartidor se escriben; un extraño no; al terminar se cierra (C-CHAT)', async () => {
    const { m, dueno, cliente, rep, id } = await hastaListo();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/pedidos/${id}/mensajes`,
          { texto: 'Hola, estoy en el portón' },
          cliente.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/pedidos/${id}/mensajes`,
          { texto: 'Voy en 2 minutos' },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    const extrano = await m.cuenta('cliente', 'Otra Persona');
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, extrano.token)).estado,
    ).toBe(404);
    const chat = await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, cliente.token);
    expect(chat.datos.abierto).toBe(true);
    expect(
      chat.datos.mensajes.map((x: { texto: string; mio: boolean }) => [x.texto, x.mio]),
    ).toEqual([
      ['Hola, estoy en el portón', true],
      ['Voy en 2 minutos', false],
    ]);
    await m.recoger(id, rep.token, dueno.token);
    await m.entregar(id, rep.token);
    expect(
      (await m.llamar('POST', `/datos/pedidos/${id}/mensajes`, { texto: 'tarde' }, cliente.token))
        .estado,
    ).toBe(409);
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/mensajes`, undefined, rep.token)).datos.abierto,
    ).toBe(false);
  });

  it('el repartidor se baja antes de recoger: el pedido vuelve a la fila y otro lo toma (C-SOLTAR)', async () => {
    const { m, dueno, rep, repartidor, id } = await hastaListo();
    const otro = await repartidor('Otro Repartidor', 25.772, -80.192);
    const r = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/soltar`,
      { motivo: 'Se me pinchó la llanta' },
      rep.token,
    );
    expect(r.estado).toBe(200);
    const ofertas = await m.llamar('GET', '/datos/repartidor/ofertas', undefined, otro.token);
    expect(ofertas.datos.ofertas[0]?.id).toBe(id);
    // El que se bajó no lo vuelve a ver.
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos.ofertas,
    ).toHaveLength(0);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, otro.token);
    await m.recoger(id, otro.token, dueno.token);
    // Ya recogido, no se puede soltar.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/soltar`,
          { motivo: 'x' },
          otro.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('el Manager reasigna el pedido de un repartidor sin señal por 10 minutos (C-PERDIDO)', async () => {
    const { m, rep, id } = await hastaListo();
    await m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now','-11 minutes') WHERE usuario_id = ?",
    )
      .bind(rep.id)
      .run();
    const { vigilarPedidos } = await import('../manager');
    await vigilarPedidos({} as never, m.DB);
    const fila = await m.DB.prepare('SELECT repartidor_id FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ repartidor_id: string | null }>();
    expect(fila?.repartidor_id).toBeNull();
    const ev = await m.DB.prepare(
      "SELECT 1 FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'repartidor_perdido'",
    )
      .bind(id)
      .first();
    expect(ev).toBeTruthy();
  });
});

describe('algo agotado y ajustar el tiempo (C-AGOTADO)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Un pedido pagado con DOS platos (así quitar uno no cancela todo). */
  async function conDosPlatos() {
    const e = await escenario();
    const rest = (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, e.dueno.token)).datos
      .restaurante;
    const extra = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Jugo', nombreEn: 'Juice', precioCentavos: 500 },
      e.dueno.token,
    );
    const primeroPlato = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Arroz', nombreEn: 'Rice', precioCentavos: 1500 },
      e.dueno.token,
    );
    const primero = primeroPlato.datos.plato.id as string;
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rest.id,
        lineas: [
          { platoId: primero, cantidad: 2 },
          { platoId: extra.datos.plato.id, cantidad: 1 },
        ],
        propinaCentavos: 400,
        direccion: '200 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      e.cliente.token,
    );
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(p.datos.pedidoId)
      .run();
    return { ...e, id: p.datos.pedidoId as string, platoId: extra.datos.plato.id as string };
  }

  it('el restaurante marca el plato; el cliente lo quita y se le devuelve esa parte', async () => {
    const { m, dueno, cliente, id, platoId } = await conDosPlatos();
    const antes = (
      await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)
    ).datos.pedido;
    const falta = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/falta`,
      { platoId },
      dueno.token,
    );
    expect(falta.estado).toBe(200);
    expect(falta.datos.devolucion).toBeGreaterThan(0);
    // Mientras el cliente decide, el restaurante no puede aceptar y el Manager no lo cancela.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 5 },
          dueno.token,
        )
      ).estado,
    ).toBe(409);
    await m.DB.prepare("UPDATE pedidos SET pagado_en = datetime('now','-11 minutes') WHERE id = ?")
      .bind(id)
      .run();
    const { vigilarPedidos } = await import('../manager');
    await vigilarPedidos({} as never, m.DB);
    let seg = (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token))
      .datos.pedido;
    expect(seg.estado).toBe('pagado');
    expect(seg.ajuste).toMatchObject({
      platoId,
      estado: 'pendiente',
      devolucion: falta.datos.devolucion,
    });
    // El cliente lo quita: total nuevo, devolución igual a la diferencia, y el pedido sigue.
    const r = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/ajuste`,
      { decision: 'quitar' },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    seg = (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token))
      .datos.pedido;
    expect(seg.ajuste.estado).toBe('quitado');
    expect(seg.total).toBe(antes.total - falta.datos.devolucion);
    expect(seg.lineas.find((l: { platoId: string }) => l.platoId === platoId)).toBeUndefined();
    const acepta = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      dueno.token,
    );
    expect(acepta.datos).toEqual({ ok: true });
  });

  it('si el cliente no responde en 5 minutos, se quita solo; si cancela, se devuelve todo', async () => {
    const { m, dueno, cliente, id, platoId } = await conDosPlatos();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/falta`, { platoId }, dueno.token);
    await m.DB.prepare(
      "UPDATE ajustes_pedido SET creado_en = datetime('now','-6 minutes') WHERE pedido_id = ?",
    )
      .bind(id)
      .run();
    const { vigilarPedidos } = await import('../manager');
    await vigilarPedidos({} as never, m.DB);
    const seg = (
      await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)
    ).datos.pedido;
    expect(seg.ajuste.estado).toBe('quitado');
    expect(seg.estado).toBe('pagado');

    const e2 = await conDosPlatos();
    const id2 = e2.id;
    await e2.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id2}/falta`,
      { platoId: e2.platoId },
      e2.dueno.token,
    );
    const r = await e2.m.llamar(
      'POST',
      `/datos/pedidos/${id2}/ajuste`,
      { decision: 'cancelar' },
      e2.cliente.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.cancelado).toBe(true);
    const seg2 = (
      await e2.m.llamar('GET', `/datos/pedidos/${id2}/seguimiento`, undefined, e2.cliente.token)
    ).datos.pedido;
    expect(seg2.estado).toBe('cancelado');
  });

  it('el tiempo de preparación se puede subir después de aceptar solo mientras no haya repartidor', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/restaurante/pedidos/${id}/tiempo`,
          { minutos: 15 },
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    const rep = await repartidor('Rep Tiempo', 25.771, -80.191);
    await m.DB.prepare(
      "UPDATE pedidos SET aceptado_en = datetime('now','-12 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/restaurante/pedidos/${id}/tiempo`,
          { minutos: 25 },
          dueno.token,
        )
      ).estado,
    ).toBe(409);
  });
});

describe('cobrar al entregar y PIN en mano (C-CAPTURA, C-PIN)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Registra cada llamada a Stripe (la red de mentira del escenario sigue respondiendo). */
  function espiarStripe() {
    const llamadas: { url: string; cuerpo: string }[] = [];
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      llamadas.push({ url: String(url), cuerpo: String(init?.body ?? '') });
      return original(url, init);
    });
    return llamadas;
  }

  /** Un pedido como lo hace la app: se crea y la tarjeta queda AUTORIZADA (aviso firmado). */
  async function pedidoAutorizado(
    e: Awaited<ReturnType<typeof escenario>>,
    entrega = 'puerta',
    pin = true,
  ) {
    const rest = (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, e.dueno.token)).datos
      .restaurante;
    const plato = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Sopa', nombreEn: 'Soup', precioCentavos: 900 },
      e.dueno.token,
    );
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rest.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
        entrega,
        pin,
      },
      e.cliente.token,
    );
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: 'cs_1',
          amount_capturable: p.datos.desglose.totalCliente,
          metadata: { pedido_id: p.datos.pedidoId },
        },
      },
    });
    const res = await e.m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
    expect(res.status).toBe(200);
    return {
      id: p.datos.pedidoId as string,
      total: p.datos.desglose.totalCliente as number,
      platoId: plato.datos.plato.id as string,
    };
  }
  const estadoDe = async (m: Awaited<ReturnType<typeof escenario>>['m'], id: string) =>
    (
      await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
        .bind(id)
        .first<{ estado: string }>()
    )?.estado;

  it('la autorización marca pagado; cancelar antes de entregar anula la autorización, no reembolsa', async () => {
    const e = await escenario();
    const { id } = await pedidoAutorizado(e);
    expect(await estadoDe(e.m, id)).toBe('pagado');
    const llamadas = espiarStripe();
    expect(
      (await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, e.dueno.token))
        .estado,
    ).toBe(200);
    expect(llamadas.some((l) => l.url.includes('/payment_intents/cs_1/cancel'))).toBe(true);
    expect(llamadas.some((l) => l.url.includes('/refunds'))).toBe(false);
    expect(await estadoDe(e.m, id)).toBe('cancelado');
  });

  it('entregar captura el total; si se quitó un plato, captura menos y no reembolsa', async () => {
    const e = await escenario();
    const { id, total, platoId } = await pedidoAutorizado(e);
    // El restaurante marca el plato (2 unidades): queda vacío → se cancela todo. Mejor: pedido con dos platos.
    const otro = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pan', nombreEn: 'Bread', precioCentavos: 400 },
      e.dueno.token,
    );
    void otro;
    const llamadas = espiarStripe();
    const rep = await e.repartidor('Rep Captura', 25.771, -80.191);
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    expect(llamadas.some((l) => l.url.includes('/capture'))).toBe(false);
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    const captura = llamadas.find((l) => l.url.includes('/payment_intents/cs_1/capture'));
    expect(captura?.cuerpo).toContain(`amount_to_capture=${total}`);
    expect(await estadoDe(e.m, id)).toBe('entregado');
    expect(llamadas.some((l) => l.url.includes('/refunds'))).toBe(false);
    void platoId;
  });

  it('plato quitado con cobro solo autorizado: no hay reembolso, y al entregar se captura el total nuevo', async () => {
    const e = await escenario();
    const rest = (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, e.dueno.token)).datos
      .restaurante;
    const a = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Arroz', nombreEn: 'Rice', precioCentavos: 1500 },
      e.dueno.token,
    );
    const b = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Jugo', nombreEn: 'Juice', precioCentavos: 500 },
      e.dueno.token,
    );
    const p = await e.m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rest.id,
        lineas: [
          { platoId: a.datos.plato.id, cantidad: 1 },
          { platoId: b.datos.plato.id, cantidad: 1 },
        ],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      e.cliente.token,
    );
    const id = p.datos.pedidoId as string;
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: 'cs_1',
          amount_capturable: p.datos.desglose.totalCliente,
          metadata: { pedido_id: id },
        },
      },
    });
    await e.m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
    const llamadas = espiarStripe();
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/falta`,
      { platoId: b.datos.plato.id },
      e.dueno.token,
    );
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/pedidos/${id}/ajuste`,
          { decision: 'quitar' },
          e.cliente.token,
        )
      ).estado,
    ).toBe(200);
    expect(llamadas.some((l) => l.url.includes('/refunds'))).toBe(false);
    const totalNuevo = Number(
      (
        await e.m.DB.prepare('SELECT total FROM pedidos WHERE id = ?')
          .bind(id)
          .first<{ total: number }>()
      )?.total,
    );
    expect(totalNuevo).toBeLessThan(p.datos.desglose.totalCliente);
    const rep = await e.repartidor('Rep Menos', 25.771, -80.191);
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    const captura = llamadas.find((l) => l.url.includes('/capture'));
    expect(captura?.cuerpo).toContain(`amount_to_capture=${totalNuevo}`);
  });

  it('PIN en mano: el cliente lo ve, el repartidor no; sin PIN correcto no se entrega; sin PIN pedido, en mano directo', async () => {
    const e = await escenario();
    const { id } = await pedidoAutorizado(e, 'mano', true);
    const seg = (
      await e.m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, e.cliente.token)
    ).datos.pedido;
    expect(seg.pin).toMatch(/^\d{4}$/);
    expect(seg.pinRequerido).toBe(true);
    const rep = await e.repartidor('Rep Pin', 25.771, -80.191);
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    const activo = (await e.m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token)).datos
      .activo;
    expect(activo.pinRequerido).toBe(true);
    expect(activo.pin).toBeUndefined();
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    const enCasa = { lat: 25.7801, lng: -80.2001, modo: 'mano' };
    expect(
      (await e.m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, enCasa, rep.token))
        .estado,
    ).toBe(409);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/entregado`,
          { ...enCasa, pin: '0000' },
          rep.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/entregado`,
          { ...enCasa, pin: seg.pin },
          rep.token,
        )
      ).estado,
    ).toBe(200);

    const e2 = await escenario();
    const sinPin = await pedidoAutorizado(e2, 'mano', false);
    const seg2 = (
      await e2.m.llamar(
        'GET',
        `/datos/pedidos/${sinPin.id}/seguimiento`,
        undefined,
        e2.cliente.token,
      )
    ).datos.pedido;
    expect(seg2.pin).toBeNull();
    expect(seg2.pinRequerido).toBe(false);
  });
});

describe('horarios reales y opciones de los platos (C-HORARIOS, C-OPCIONES)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fuera del horario no se puede pedir aunque el botón esté abierto; dentro sí', async () => {
    const e = await escenario();
    const rest = (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, e.dueno.token)).datos
      .restaurante;
    const plato = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Arepa', nombreEn: 'Arepa', precioCentavos: 800 },
      e.dueno.token,
    );
    // Un horario de un solo minuto en un día que no es hoy: cerrado ahora.
    const hoy = new Date().getUTCDay();
    const otroDia = (hoy + 3) % 7;
    const r1 = await e.m.llamar(
      'PUT',
      '/datos/mi-restaurante/horarios',
      { turnos: [{ dia: otroDia, abre: '10:00', cierra: '10:01' }] },
      e.dueno.token,
    );
    expect(r1.estado).toBe(200);
    expect(r1.datos.restaurante.abiertoAhora).toBe(false);
    const pedido = {
      restauranteId: rest.id,
      lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
      propinaCentavos: 0,
      direccion: '300 Calle Prueba',
      lat: 25.78,
      lng: -80.2,
    };
    expect((await e.m.llamar('POST', '/datos/pedidos', pedido, e.cliente.token)).estado).toBe(409);
    // Abierto las 24 horas todos los días: se puede pedir.
    const todos = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' }));
    const r2 = await e.m.llamar(
      'PUT',
      '/datos/mi-restaurante/horarios',
      { turnos: todos },
      e.dueno.token,
    );
    expect(r2.datos.restaurante.abiertoAhora).toBe(true);
    expect(r2.datos.restaurante.horarios).toHaveLength(7);
    expect((await e.m.llamar('POST', '/datos/pedidos', pedido, e.cliente.token)).estado).toBe(201);
    // Un cliente ve «abiertoAhora» en la lista.
    const lista = await e.m.llamar(
      'GET',
      `/datos/restaurantes?lat=25.77&lng=-80.19`,
      undefined,
      e.cliente.token,
    );
    expect(
      lista.datos.restaurantes.find((x: { id: string }) => x.id === rest.id)?.abiertoAhora,
    ).toBe(true);
    // Un turno mal escrito no entra.
    expect(
      (
        await e.m.llamar(
          'PUT',
          '/datos/mi-restaurante/horarios',
          { turnos: [{ dia: 1, abre: '9:00', cierra: '22:00' }] },
          e.dueno.token,
        )
      ).estado,
    ).toBe(400);
  });

  it('las opciones suman al precio, respetan mínimo y máximo, y quedan guardadas en la línea', async () => {
    const e = await escenario();
    const rest = (await e.m.llamar('GET', '/datos/mi-restaurante', undefined, e.dueno.token)).datos
      .restaurante;
    const plato = await e.m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza', nombreEn: 'Pizza', precioCentavos: 1400 },
      e.dueno.token,
    );
    const pid = plato.datos.plato.id as string;
    const r = await e.m.llamar(
      'PUT',
      `/datos/mi-restaurante/platos/${pid}/opciones`,
      {
        grupos: [
          {
            nombreEs: 'Tamaño',
            nombreEn: 'Size',
            minimo: 1,
            maximo: 1,
            opciones: [
              { nombreEs: 'Mediana', nombreEn: 'Medium', precioCentavos: 0 },
              { nombreEs: 'Grande', nombreEn: 'Large', precioCentavos: 400 },
            ],
          },
          {
            nombreEs: 'Extras',
            nombreEn: 'Extras',
            minimo: 0,
            maximo: 2,
            opciones: [
              { nombreEs: 'Extra queso', nombreEn: 'Extra cheese', precioCentavos: 150 },
              {
                nombreEs: 'Champiñones',
                nombreEn: 'Mushrooms',
                precioCentavos: 100,
                disponible: false,
              },
            ],
          },
        ],
      },
      e.dueno.token,
    );
    expect(r.estado).toBe(200);
    const grupos = r.datos.plato.grupos;
    expect(grupos).toHaveLength(2);
    const grande = grupos[0].opciones[1].id;
    const queso = grupos[1].opciones[0].id;
    const champi = grupos[1].opciones[1].id;
    const publico = await e.m.llamar(
      'GET',
      `/datos/restaurantes/${rest.id}`,
      undefined,
      e.cliente.token,
    );
    expect(publico.datos.platos.find((x: { id: string }) => x.id === pid).grupos[0].nombreEn).toBe(
      'Size',
    );
    const pedir = (opciones: string[]) =>
      e.m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rest.id,
          lineas: [{ platoId: pid, cantidad: 2, opciones }],
          propinaCentavos: 0,
          direccion: '300 Calle Prueba',
          lat: 25.78,
          lng: -80.2,
        },
        e.cliente.token,
      );
    // Sin tamaño (mínimo 1): no.
    expect((await pedir([])).estado).toBe(409);
    // Una opción agotada: no.
    expect((await pedir([grande, champi])).estado).toBe(409);
    // Grande + extra queso: 14.00 + 4.00 + 1.50 = 19.50 por unidad, 2 unidades.
    const ok = await pedir([grande, queso]);
    expect(ok.estado).toBe(201);
    expect(ok.datos.desglose.subtotal).toBe(3900);
    const seg = await e.m.llamar(
      'GET',
      `/datos/pedidos/${ok.datos.pedidoId}`,
      undefined,
      e.cliente.token,
    );
    expect(seg.datos.pedido.lineas[0].precioCentavos).toBe(1950);
    expect(
      seg.datos.pedido.lineas[0].opciones.map((o: { nombreEn: string }) => o.nombreEn),
    ).toEqual(['Large', 'Extra cheese']);
  });
});
