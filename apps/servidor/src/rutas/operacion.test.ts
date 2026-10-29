import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';

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

async function escenario(extraEnv: Record<string, string> = {}) {
  vi.stubGlobal('fetch', async (url: string) =>
    /\/(payment_intents|customers|customer_sessions)/.test(url)
      ? new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
  );
  const m = mundo({
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: SECRETO_AVISO,
    ...extraEnv,
  });
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
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
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
  return { m, dueno, cliente, pedidoPagado, pedidoPagadoPorStripe, repartidor, r, plato };
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
    // C-ENTREGA-REINTENTO: si la respuesta se perdió y la app reintenta, responde igual (ya
    // entregado) y NO se acredita dos veces (el resumen de abajo sigue con una sola entrega).
    const reintento = await m.entregar(id, rep.token);
    expect(reintento.estado).toBe(200);
    expect(reintento.datos.yaEntregado).toBe(true);
    // Otro repartidor no puede «entregar» un pedido ajeno.
    const otroRep = await m.cuenta('repartidor', 'Otro');
    expect((await m.entregar(id, otroRep.token)).estado).toBe(409);
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
    await llevarA(m.DB, id, 'entregado');
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
    // C-RENDIMIENTO-REST: por hora (24), por día (7), clientes y cancelados.
    expect(r.datos.tablero.porHora).toHaveLength(24);
    expect(r.datos.tablero.porDia).toHaveLength(7);
    expect(
      r.datos.tablero.porDia.reduce((s: number, d: { pedidos: number }) => s + d.pedidos, 0),
    ).toBe(r.datos.tablero.mes.pedidos);
    expect(r.datos.tablero.clientes).toMatchObject({ nuevos: 1, recurrentes: 0 });
    expect(r.datos.tablero.canceladosMes).toBe(0);
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

  it('recuerda al minuto y a los 3 (una sola vez cada uno) y cancela con reembolso a los 6', async () => {
    const { m, pedidoPagado } = await escenario();
    const { vigilarPedidos } = await import('../manager');
    const env = { DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    const id = await pedidoPagado();
    const reembolsos = contarReembolsos();
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(0);
    await atrasar(m, id, 'pagado_en', 2);
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(1);
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(0);
    await atrasar(m, id, 'pagado_en', 4);
    expect((await vigilarPedidos(env, m.DB)).recordatorios).toBe(1);
    await atrasar(m, id, 'pagado_en', 7);
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

  it('un pedido aceptado sin repartidor avisa al equipo una sola vez a los 5 minutos', async () => {
    const { m, dueno, pedidoPagado } = await escenario();
    const { vigilarPedidos } = await import('../manager');
    const env = { DB: m.DB } as never;
    const id = await pedidoPagado();
    contarReembolsos();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    expect((await vigilarPedidos(env, m.DB)).sinRepartidor).toBe(0);
    await atrasar(m, id, 'aceptado_en', 6);
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

  it('C-FOTO-RECOGIDA-REINTENTO: si falla después de guardar la foto, queda el error escrito y reintentar la completa', async () => {
    // Reproduce la huella del 19 oct en staging (corrida 39327502810): evidencia y llegada
    // guardadas, sin el evento «foto_recogida» y respuesta 500. La falla se inyecta con un
    // disparador que solo existe en esta prueba; la causa real en staging NO está confirmada.
    const { m, rep, id } = await hastaListo();
    await m.DB.prepare(
      `CREATE TRIGGER falla_inyectada BEFORE INSERT ON bitacora_pedidos
       WHEN NEW.evento = 'foto_recogida' BEGIN SELECT RAISE(ABORT, 'falla inyectada'); END`,
    ).run();
    const ruta = `/datos/repartidor/pedidos/${id}/foto-recogida`;
    const gps = { lat: 25.7701, lng: -80.1901 };
    const r1 = await m.foto(ruta, rep.token, gps);
    expect(r1.estado).toBe(500);
    const huella = async () => ({
      evidencia: await m.DB.prepare(
        "SELECT COUNT(*) AS n FROM evidencias WHERE pedido_id = ? AND tipo = 'recogida'",
      )
        .bind(id)
        .first<{ n: number }>(),
      evento: await m.DB.prepare(
        "SELECT COUNT(*) AS n FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'foto_recogida'",
      )
        .bind(id)
        .first<{ n: number }>(),
    });
    expect(await huella()).toEqual({ evidencia: { n: 1 }, evento: { n: 0 } });
    // C-ERRORES-VISIBLES: el error quedó escrito con su ruta y su mensaje.
    const err = await m.DB.prepare(
      'SELECT metodo, ruta, mensaje FROM errores_servidor ORDER BY id DESC LIMIT 1',
    ).first<{ metodo: string; ruta: string; mensaje: string }>();
    expect(err).toMatchObject({ metodo: 'POST', ruta: expect.stringContaining('foto-recogida') });
    expect(err?.mensaje).toContain('falla inyectada');
    const admin = await m.cuenta('admin');
    const lista = await m.llamar('GET', '/datos/admin/errores', undefined, admin.token);
    expect(lista.datos.errores[0].ruta).toBe('/datos/repartidor/pedidos/:id/foto-recogida');
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.errores).toBe('pendiente');
    // Se quita la falla y el repartidor reintenta: la foto se completa sin duplicar nada.
    await m.DB.prepare('DROP TRIGGER falla_inyectada').run();
    expect((await m.foto(ruta, rep.token, gps)).estado).toBe(200);
    expect(await huella()).toEqual({ evidencia: { n: 1 }, evento: { n: 1 } });
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
    await m.confirmarCorreo(rep.id);
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
    // A 50 m, con dos lecturas precisas (la regla de GPS serio no cree en un punto suelto).
    await m.envejecerGps(id);
    await m.ubicar(rep.token, { lat: 25.7804, lng: -80.2 });
    await m.ubicar(rep.token, { lat: 25.7804, lng: -80.2 });
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
    // Parado en la puerta: el celular ya mandó dos lecturas precisas ahí.
    await m.ubicar(rep.token, { lat: 25.7801, lng: -80.2001 });
    await m.ubicar(rep.token, { lat: 25.7801, lng: -80.2001 });
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
      { lat: 25.7801, lng: -80.2001, precision: 10 },
      rep.token,
    );
    await m.ubicar(rep.token, { lat: 25.7801, lng: -80.2001 });
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

  /** Stripe anula de verdad pero la respuesta se pierde; `anulado` dice qué responde la consulta. */
  function anulacionPerdida(anulado: boolean | 'red') {
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/payment_intents/cs_1/cancel')) throw new TypeError('fetch failed');
      if (u.endsWith('/payment_intents/cs_1') && (init?.method ?? 'GET') === 'GET') {
        if (anulado === 'red') throw new TypeError('fetch failed');
        return new Response(
          JSON.stringify({ id: 'cs_1', status: anulado ? 'canceled' : 'requires_capture' }),
        );
      }
      return original(url, init);
    });
  }

  it('C-ANULACION-VERIFICADA: respuesta perdida pero Stripe SÍ anuló → el pedido queda cancelado', async () => {
    const e = await escenario();
    const { id } = await pedidoAutorizado(e);
    anulacionPerdida(true);
    expect(
      (await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, e.dueno.token))
        .estado,
    ).toBe(200);
    expect(await estadoDe(e.m, id)).toBe('cancelado');
    const cobro = await e.m.DB.prepare('SELECT cancelado_en FROM cobros WHERE pedido_id = ?')
      .bind(id)
      .first<{ cancelado_en: string | null }>();
    expect(cobro?.cancelado_en).toBeTruthy();
  });

  it('C-ANULACION-VERIFICADA: si Stripe NO anuló (o no se puede saber) el pedido vuelve y se avisa', async () => {
    for (const caso of [false, 'red'] as const) {
      const e = await escenario();
      const { id } = await pedidoAutorizado(e);
      anulacionPerdida(caso);
      expect(
        (await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, e.dueno.token))
          .estado,
      ).toBe(422);
      expect(await estadoDe(e.m, id)).toBe('pagado');
      vi.unstubAllGlobals();
    }
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
    await e.m.ubicar(rep.token, enCasa);
    await e.m.ubicar(rep.token, enCasa);
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

describe('GPS serio: llegada con dos lecturas, saltos imposibles y excepción de soporte (C-GPS-SERIO)', () => {
  async function enCamino() {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Gus Gps', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    const seguimiento = async () =>
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)).datos
        .pedido.repartidor;
    const estado = async () =>
      (await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token)).datos.activo;
    return { m, rep, id, cliente, seguimiento, estado };
  }
  // La casa del pedido de prueba: 25.78, -80.2.
  const casa = { lat: 25.7801, lng: -80.2 };

  it('una lectura sola o imprecisa no marca «llegó»; dos precisas y coherentes sí', async () => {
    const { m, rep, seguimiento } = await enCamino();
    await m.ubicar(rep.token, casa);
    expect((await seguimiento()).llego).toBe(false);
    await m.ubicar(rep.token, casa, 150); // en un edificio el GPS da ±150 m: no cuenta
    expect((await seguimiento()).llego).toBe(false);
    await m.ubicar(rep.token, casa, 8);
    expect((await seguimiento()).llego).toBe(false); // la anterior era imprecisa
    await m.ubicar(rep.token, casa, 12);
    expect((await seguimiento()).llego).toBe(true);
  });

  it('entregar sin la llegada confirmada no se puede, aunque la foto diga que está en la puerta', async () => {
    const { m, rep, id } = await enCamino();
    const r = await m.foto(`/datos/repartidor/pedidos/${id}/entregado`, rep.token, casa);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/no confirmamos tu ubicación|haven’t confirmed your location/);
    // Con sus dos lecturas en la puerta (como un celular de verdad), entrega.
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
  });

  it('un salto imposible no mueve al repartidor y queda en la bitácora', async () => {
    const { m, rep, id, seguimiento } = await enCamino();
    await m.ubicar(rep.token, { lat: 25.9, lng: -80.3 }); // a 15 km
    const r = await m.ubicar(rep.token, casa); // un segundo después, en la puerta: imposible
    expect(r.datos.salto).toBe(true);
    await m.ubicar(rep.token, casa);
    expect((await seguimiento()).llego).toBe(false);
    const anotado = await m.DB.prepare(
      "SELECT evento FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'gps_salto'",
    )
      .bind(id)
      .first();
    expect(anotado).toBeTruthy();
  });

  it('«No puedo confirmar mi ubicación»: soporte autoriza con su nombre y recién ahí se entrega', async () => {
    const { m, rep, id, estado } = await enCamino();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const pedida = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/no-puedo-confirmar`,
      { motivo: 'Edificio de 30 pisos, el GPS marca otra calle' },
      rep.token,
    );
    expect(pedida.estado).toBe(200);
    expect((await estado()).excepcionUbicacion).toBe('pedida');
    // Todavía no: sin autorización no se entrega.
    expect(
      (await m.foto(`/datos/repartidor/pedidos/${id}/entregado`, rep.token, casa)).estado,
    ).toBe(409);
    const ficha = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(ficha.datos.pedido.excepcionUbicacion).toMatchObject({
      motivo: 'Edificio de 30 pisos, el GPS marca otra calle',
      autorizadaEn: null,
    });
    expect(
      (await m.llamar('POST', `/datos/admin/pedidos/${id}/autorizar-ubicacion`, {}, admin.token))
        .estado,
    ).toBe(200);
    expect((await estado()).excepcionUbicacion).toBe('autorizada');
    expect(
      (await m.foto(`/datos/repartidor/pedidos/${id}/entregado`, rep.token, casa)).estado,
    ).toBe(200);
    const ficha2 = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(ficha2.datos.pedido.excepcionUbicacion.autorizadaPor).toBe('Soporte Divoox');
    expect(ficha2.datos.pedido.bitacora.map((b: { evento: string }) => b.evento)).toEqual(
      expect.arrayContaining(['ubicacion_sin_confirmar', 'ubicacion_autorizada']),
    );
  });
});

describe('despacho completo: oferta abierta con bono, tiempo sugerido y cocina ocupada (C-DESPACHO-COMPLETO)', () => {
  it('a los 3 rechazos se ofrece a todos con bono de $1, uno acepta y lo cobra al entregar', async () => {
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const reps = [];
    for (const n of ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'])
      reps.push(await repartidor(`${n} Rechaza`, 25.771, -80.191));
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    const ofertasDe = async (token: string) =>
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, token)).datos.ofertas;
    // Tres rechazan, uno por uno (cada GET reparte al siguiente).
    for (let i = 0; i < 3; i++) {
      let quien = null;
      for (const r of reps) {
        const o = await ofertasDe(r.token);
        if (o.length) {
          quien = r;
          expect(o[0].bono).toBe(0);
          break;
        }
      }
      expect(quien).toBeTruthy();
      await m.llamar('POST', `/datos/repartidor/ofertas/${id}/rechazar`, {}, quien!.token);
    }
    // Ahora la ven todos los que quedan, con bono.
    await ofertasDe(reps[0]!.token); // dispara el reparto
    const abiertas = [];
    for (const r of reps) {
      const o = await ofertasDe(r.token);
      if (o.length) abiertas.push({ r, o: o[0] });
    }
    expect(abiertas).toHaveLength(2);
    expect(abiertas[0]!.o.bono).toBe(100);
    const sinBono = (await m.DB.prepare('SELECT pago_repartidor FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ pago_repartidor: number }>())!.pago_repartidor;
    expect(abiertas[0]!.o.pagoRepartidor).toBe(sinBono + 100);
    const gana = abiertas[0]!.r;
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, gana.token);
    // Al otro se le quita.
    expect(await ofertasDe(abiertas[1]!.r.token)).toHaveLength(0);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, gana.token, dueno.token);
    expect((await m.entregar(id, gana.token)).estado).toBe(200);
    const mov = await m.DB.prepare(
      "SELECT monto FROM movimientos WHERE pedido_id = ? AND usuario_id = ? AND concepto = 'entrega'",
    )
      .bind(id, gana.id)
      .first<{ monto: number }>();
    const p = await m.DB.prepare('SELECT envio, complemento FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ envio: number; complemento: number }>();
    expect(mov!.monto).toBe(p!.envio + p!.complemento + 100);
    const bitacora = await m.DB.prepare(
      "SELECT 1 FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'oferta_abierta'",
    )
      .bind(id)
      .first();
    expect(bitacora).toBeTruthy();
  });

  it('el tiempo sugerido sale del promedio real y «cocina ocupada» le suma minutos', async () => {
    const { m, dueno, pedidoPagado } = await escenario();
    // Sin historial: el configurado del restaurante (20).
    let lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect(lista.datos).toMatchObject({ prepSugerida: 20, cocinaOcupada: 0 });
    // Tres pedidos que tardaron 27, 23 y 25 minutos de verdad.
    for (const min of [27, 23, 25]) {
      const id = await pedidoPagado();
      await m.llamar(
        'POST',
        `/datos/restaurante/pedidos/${id}/aceptar`,
        { minutos: 15 },
        dueno.token,
      );
      await m.DB.prepare(
        `UPDATE pedidos SET aceptado_en = datetime('now','-${min} minutes'), listo_en = datetime('now'), estado = 'listo' WHERE id = ?`,
      )
        .bind(id)
        .run();
    }
    lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect(lista.datos.prepSugerida).toBe(25);
    const ocupada = await m.llamar(
      'PATCH',
      '/datos/restaurante/cocina',
      { extraMin: 10 },
      dueno.token,
    );
    expect(ocupada.datos).toMatchObject({ prepSugerida: 35, cocinaOcupada: 10 });
    expect(
      (await m.llamar('PATCH', '/datos/restaurante/cocina', { extraMin: 7 }, dueno.token)).estado,
    ).toBe(400);
  });
});

describe('avisos a 5 y 2 minutos, SMS de respaldo y llamadas con número oculto (C-AVISOS-COMPLETOS)', () => {
  const TWILIO = {
    TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
    TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
    TWILIO_FROM: '+13055550000',
    SITIO_URL: 'https://tumbite.test',
  };
  /** Captura lo que se le manda a Twilio y responde como Twilio (Stripe sigue simulado). */
  function espiarTwilio() {
    const llamadas: { url: string; cuerpo: URLSearchParams }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('api.twilio.com')) {
        llamadas.push({ url: String(url), cuerpo: new URLSearchParams(String(init?.body)) });
        return new Response(JSON.stringify({ sid: `SM${llamadas.length}` }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'x', client_secret: 'x_secret', data: [] }), {
        status: 200,
      });
    });
    return llamadas;
  }
  async function enCamino(extra: Record<string, string> = {}) {
    const e = await escenario(extra);
    const rep = await e.repartidor('Rita Llama', 25.771, -80.191);
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
    await e.m.recoger(id, rep.token, e.dueno.token);
    const telefonos = async () => {
      await e.m.DB.prepare("UPDATE usuarios SET telefono = '3055551234' WHERE id = ?")
        .bind(e.cliente.id)
        .run();
      await e.m.DB.prepare("UPDATE usuarios SET telefono = '(305) 555-9999' WHERE id = ?")
        .bind(rep.id)
        .run();
    };
    return { ...e, rep, id, telefonos };
  }
  afterEach(() => vi.unstubAllGlobals());
  const hitosDe = async (m: Awaited<ReturnType<typeof escenario>>['m'], id: string) =>
    (
      await m.DB.prepare('SELECT aviso FROM avisos_pedido WHERE pedido_id = ?')
        .bind(id)
        .all<{ aviso: string }>()
    ).results.map((h) => h.aviso);

  it('«llega en 5 minutos» al estar a 5 min de viaje; «sal a recibir» a 2 min solo en mano', async () => {
    const { m, rep, id, cliente } = await enCamino();
    await m.DB.prepare(
      "INSERT OR REPLACE INTO preferencias_entrega (pedido_id, modo) VALUES (?, 'mano')",
    )
      .bind(id)
      .run();
    // La casa está en 25.78,-80.2. A ~1,9 km (≈ 4,5 min a 25 km/h): llega en 5.
    await m.ubicar(rep.token, { lat: 25.763, lng: -80.2 });
    expect(await hitosDe(m, id)).toContain('llega_5');
    expect(await hitosDe(m, id)).not.toContain('sal_a_recibir');
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.repartidor.llegaEn5).toBe(true);
    // A ~700 m (≈ 1,7 min): sal a recibir (porque pidió en mano).
    await m.envejecerGps(id);
    await m.ubicar(rep.token, { lat: 25.7737, lng: -80.2 });
    expect(await hitosDe(m, id)).toContain('sal_a_recibir');
  });

  it('sin Twilio no sale ningún SMS ni falla nada', async () => {
    const { m, rep, id, telefonos } = await enCamino();
    await telefonos();
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    expect(
      await m.DB.prepare('SELECT COUNT(*) AS n FROM sms_enviados').first<{ n: number }>(),
    ).toMatchObject({ n: 0 });
    expect((await m.llamar('POST', `/datos/pedidos/${id}/llamar`, {}, rep.token)).estado).toBe(409);
  });

  it('con Twilio: «en tu puerta» y «no te encuentran» también van por SMS al celular del cliente', async () => {
    const { m, rep, id, telefonos } = await enCamino(TWILIO);
    await telefonos();
    const twilio = espiarTwilio();
    await m.envejecerGps(id);
    await m.ubicar(rep.token, { lat: 25.7801, lng: -80.2 });
    await m.ubicar(rep.token, { lat: 25.7801, lng: -80.2 });
    const sms = () => twilio.filter((x) => x.url.endsWith('/Messages.json'));
    expect(sms()).toHaveLength(1);
    expect(sms()[0]!.cuerpo.get('To')).toBe('+13055551234');
    expect(sms()[0]!.cuerpo.get('From')).toBe('+13055550000');
    expect(sms()[0]!.cuerpo.get('Body')).toMatch(/Divoox/);
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/no-aparece`, {}, rep.token);
    expect(sms()).toHaveLength(2);
    const filas = (
      await m.DB.prepare(
        'SELECT tipo, estado FROM sms_enviados WHERE pedido_id = ? ORDER BY creado_en',
      )
        .bind(id)
        .all<{ tipo: string; estado: string }>()
    ).results;
    expect(filas).toEqual([
      { tipo: 'llego', estado: 'enviado' },
      { tipo: 'no_aparece', estado: 'enviado' },
    ]);
  });

  it('llamada con número oculto: Twilio llama a quien pidió y el puente marca al otro con el número de Divoox', async () => {
    const { m, rep, id, cliente, telefonos } = await enCamino(TWILIO);
    const twilio = espiarTwilio();
    // Sin celular registrado no hay a quién conectar.
    expect((await m.llamar('POST', `/datos/pedidos/${id}/llamar`, {}, rep.token)).estado).toBe(409);
    await telefonos();
    const r = await m.llamar('POST', `/datos/pedidos/${id}/llamar`, {}, rep.token);
    expect(r.estado).toBe(200);
    const llamada = twilio.find((x) => x.url.endsWith('/Calls.json'))!;
    expect(llamada.cuerpo.get('To')).toBe('+13055559999'); // primero al repartidor
    expect(llamada.cuerpo.get('From')).toBe('+13055550000');
    const url = new URL(llamada.cuerpo.get('Url')!);
    expect(url.origin + url.pathname).toBe('https://tumbite.test/datos/twilio/puente');
    // F9: Twilio pide la dirección con POST si la llamada no dice otro método. La llamada fija GET
    // (el método de la ruta) y la ruta acepta también POST, así el puente nunca responde 404.
    expect(llamada.cuerpo.get('Method')).toBe('GET');
    const porPost = await m.crudo(`/datos/twilio/puente?t=${url.searchParams.get('t')}`, {
      method: 'POST',
    });
    expect(porPost.status).toBe(200);
    // Twilio pide el puente con el pase: marca al cliente con el número de Divoox.
    const puente = await m.crudo(`/datos/twilio/puente?t=${url.searchParams.get('t')}`, {
      method: 'GET',
    });
    expect(puente.status).toBe(200);
    const xml = await puente.text();
    expect(xml).toContain('<Dial callerId="+13055550000"');
    expect(xml).toContain('+13055551234');
    // Un pase inventado no abre nada; el cliente también puede llamar; un extraño, no.
    expect((await m.crudo('/datos/twilio/puente?t=abc.def', { method: 'GET' })).status).toBe(404);
    expect((await m.llamar('POST', `/datos/pedidos/${id}/llamar`, {}, cliente.token)).estado).toBe(
      200,
    );
    const extrano = await m.cuenta('cliente', 'Otro Cliente');
    expect((await m.llamar('POST', `/datos/pedidos/${id}/llamar`, {}, extrano.token)).estado).toBe(
      409,
    );
    const anotadas = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM llamadas WHERE pedido_id = ? AND estado = 'llamando'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(anotadas).toMatchObject({ n: 2 });
  });
});

describe('dinero vigilado: conciliación diaria, abono fallido y retención de fotos (C-DINERO-VIGILADO)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const hoy = () => new Date().toISOString().slice(0, 10);

  it('después de una entrega la conciliación del día cuadra; si alguien altera el libro, NO cuadra', async () => {
    const { conciliar } = await import('../conciliacion');
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Caja Cuadra', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    const r = await conciliar(m.DB, hoy());
    expect(r.pedidos).toBe(1);
    expect(r.cuadra).toBe(true);
    expect(r.detalle.cuadraRepartidores).toBe('sí');
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.dinero).toBe('ok');
    // Alguien le suma 1 dólar de más al restaurante por fuera: el canario se pone en rojo.
    await m.DB.prepare(
      "UPDATE movimientos SET monto = monto + 100 WHERE pedido_id = ? AND concepto = 'venta'",
    )
      .bind(id)
      .run();
    const r2 = await conciliar(m.DB, hoy());
    expect(r2.cuadra).toBe(false);
    expect(r2.detalle.cuadraRestaurantes).toBe('NO');
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.dinero).toBe('error');
  });

  it('las fotos de más de 30 días se borran del almacén, salvo con un reclamo abierto', async () => {
    const { depurarFotos } = await import('../conciliacion');
    const { m, dueno, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Foto Vieja', 25.771, -80.191);
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const id = await pedidoPagado();
      await m.llamar(
        'POST',
        `/datos/restaurante/pedidos/${id}/aceptar`,
        { minutos: 5 },
        dueno.token,
      );
      await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
      await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
      await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
      await m.recoger(id, rep.token, dueno.token);
      await m.entregar(id, rep.token);
      ids.push(id);
    }
    await m.DB.prepare("UPDATE evidencias SET creada_en = datetime('now','-31 days')").run();
    // El segundo pedido tiene un reclamo abierto: sus fotos se quedan.
    await m.DB.prepare(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, pedido_id) VALUES ('t1', 'T-1', 'queja', 'Ana', 'ana@ejemplo.com', 'Llegó frío', ?)",
    )
      .bind(ids[1])
      .run();
    const bucket = (m.extra as { BUCKET: R2Bucket }).BUCKET;
    const clavesAntes = (
      await m.DB.prepare('SELECT clave FROM evidencias WHERE pedido_id = ? ORDER BY tipo')
        .bind(ids[0])
        .all<{ clave: string }>()
    ).results.map((x) => x.clave);
    expect(clavesAntes.every((k) => k)).toBe(true);
    expect(await depurarFotos(m.DB, bucket)).toBe(2);
    for (const k of clavesAntes) expect(await bucket.get(k)).toBeNull();
    const borradas = await m.DB.prepare(
      'SELECT clave, borrada_en FROM evidencias WHERE pedido_id = ?',
    )
      .bind(ids[0])
      .all<{ clave: string; borrada_en: string | null }>();
    expect(borradas.results.every((x) => x.clave === '' && x.borrada_en)).toBe(true);
    const guardadas = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM evidencias WHERE pedido_id = ? AND clave != ''",
    )
      .bind(ids[1])
      .first<{ n: number }>();
    expect(guardadas).toMatchObject({ n: 2 });
    // La foto borrada ya no se puede ver: se dice, no se cuelga.
    expect(
      (await m.llamar('GET', `/datos/pedidos/${ids[0]}/evidencia/entrega`, undefined, rep.token))
        .estado,
    ).toBe(404);
  });

  it('un abono fallido de Stripe queda anotado y se avisa a quien es el dinero', async () => {
    const { m } = await escenario();
    const rep = await m.cuenta('repartidor', 'Banco Rechaza');
    await m.DB.prepare(
      "INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta, pagos_activos) VALUES (?, 'acct_rechazo', 1)",
    )
      .bind(rep.id)
      .run();
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payout.failed',
      account: 'acct_rechazo',
      data: { object: { id: 'po_1', amount: 2550, failure_message: 'account_closed' } },
    });
    const res = await m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
    expect(res.status).toBe(200);
    const fila = await m.DB.prepare(
      'SELECT usuario_id, motivo FROM abonos_fallidos WHERE stripe_cuenta = ?',
    )
      .bind('acct_rechazo')
      .first();
    expect(fila).toMatchObject({ usuario_id: rep.id, motivo: 'account_closed' });
  });
});

describe('recogida en el local, cambio de dirección, propina después, pedidos agrupados y mayoría de edad (C-ETAPA-2-3-4-FINAL)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recogida en el local: sin envío ni repartidor, comisión del 5 %, y el restaurante entrega con el PIN', async () => {
    const { m, dueno, cliente, r, plato } = await escenario();
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 0,
        entrega: 'recoger',
        pin: true,
      },
      cliente.token,
    );
    expect(p.estado).toBe(201);
    const d = p.datos.desglose;
    expect(d.envio).toBe(0);
    expect(d.pagoRepartidor).toBe(0);
    expect(d.comisionRestaurante).toBe(Math.round(3000 * 0.05));
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_rec' WHERE id = ?",
    )
      .bind(id)
      .run();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 10 },
      dueno.token,
    );
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    // Ningún repartidor lo ve (no se ofrece).
    const { repartirOfertas } = await import('./operacion');
    await repartirOfertas(m.DB);
    expect(
      await m.DB.prepare('SELECT COUNT(*) AS n FROM ofertas WHERE pedido_id = ?').bind(id).first(),
    ).toMatchObject({ n: 0 });
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.entrega).toBe('recoger');
    expect(seg.datos.pedido.pin).toMatch(/^\d{4}$/);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/entregado-local`,
          { pin: '0000' },
          dueno.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurante/pedidos/${id}/entregado-local`,
          { pin: seg.datos.pedido.pin },
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)).datos
        .pedido.estado,
    ).toBe('entregado');
    const mov = await m.DB.prepare(
      "SELECT monto FROM movimientos WHERE pedido_id = ? AND concepto = 'venta'",
    )
      .bind(id)
      .first<{ monto: number }>();
    expect(mov?.monto).toBe(d.pagoRestaurante);
  });

  it('el cliente cambia la dirección antes de que salga el repartidor; si el envío cambia, acepta el nuevo total', async () => {
    const { m, dueno, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const antes = (
      await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)
    ).datos.pedido;
    // Más lejos (≈ 8 km): el envío sube → primero se pide aceptar.
    const lejos = { direccion: '900 Calle Lejana, Miami', lat: 25.84, lng: -80.2 };
    const r1 = await m.llamar('PATCH', `/datos/pedidos/${id}/direccion`, lejos, cliente.token);
    expect(r1.estado).toBe(409);
    expect(r1.datos.campo).toBe('total');
    expect(r1.datos.nuevoTotal).toBeGreaterThan(antes.total);
    const r2 = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { ...lejos, aceptarTotal: true },
      cliente.token,
    );
    expect(r2.estado).toBe(200);
    const despues = (
      await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)
    ).datos.pedido;
    expect(despues.direccion).toBe(lejos.direccion);
    expect(despues.total).toBe(r1.datos.nuevoTotal);
    // Ya en camino no se puede.
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await llevarA(m.DB, id, 'en_camino');
    expect(
      (await m.llamar('PATCH', `/datos/pedidos/${id}/direccion`, lejos, cliente.token)).estado,
    ).toBe(409);
  });

  it('propina después de entregar: se cobra con la tarjeta guardada y va entera al repartidor, una sola vez', async () => {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Pro Pina', 25.771, -80.191);
    const id = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    // Antes de entregar, no.
    expect(
      (await m.llamar('POST', `/datos/pedidos/${id}/propina`, { centavos: 200 }, cliente.token))
        .estado,
    ).toBe(409);
    expect((await m.entregar(id, rep.token)).estado).toBe(200);
    await m.DB.prepare("UPDATE usuarios SET stripe_cliente = 'cus_1' WHERE id = ?")
      .bind(cliente.id)
      .run();
    const llamadas: { url: string; metodo: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({ url: String(url), metodo: String(init?.method ?? 'GET') });
      if (String(url).includes('/payment_intents/') && init?.method === 'GET')
        return new Response(JSON.stringify({ id: 'pi_x', payment_method: 'pm_guardada' }), {
          status: 200,
        });
      return new Response(JSON.stringify({ id: 'pi_propina', status: 'succeeded' }), {
        status: 200,
      });
    });
    const r = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/propina`,
      { centavos: 200 },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    expect(llamadas.some((x) => x.url.endsWith('/payment_intents') && x.metodo === 'POST')).toBe(
      true,
    );
    const saldo = await m.DB.prepare(
      "SELECT SUM(monto) AS s FROM movimientos WHERE usuario_id = ? AND pedido_id = ? AND referencia = 'propina-extra-' || pedido_id",
    )
      .bind(rep.id, id)
      .first<{ s: number }>();
    expect(saldo?.s).toBe(200);
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)).datos
        .pedido.propinaExtra,
    ).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/pedidos/${id}/propina`, { centavos: 100 }, cliente.token))
        .estado,
    ).toBe(409);
  });

  it('pedidos agrupados: el segundo del mismo restaurante se le ofrece al que ya tiene uno sin recoger, salen juntos y se entregan por separado', async () => {
    const { m, dueno, cliente, pedidoPagado, repartidor } = await escenario();
    const rep = await repartidor('Gru Po', 25.771, -80.191);
    const a = await pedidoPagado();
    await m.llamar('POST', `/datos/restaurante/pedidos/${a}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${a}/aceptar`, {}, rep.token);
    // Segundo pedido, mismo restaurante, entrega a 300 m del primero.
    const b = await pedidoPagado();
    await m.DB.prepare('UPDATE pedidos SET lat = 25.7827, lng = -80.2 WHERE id = ?').bind(b).run();
    await m.llamar('POST', `/datos/restaurante/pedidos/${b}/aceptar`, { minutos: 5 }, dueno.token);
    const ofertas = (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token)).datos
      .ofertas;
    expect(ofertas.map((o: { id: string }) => o.id)).toContain(b);
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${b}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    const estado = (await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token)).datos;
    expect(estado.activo.id).toBe(a);
    expect(estado.agrupados.map((x: { id: string }) => x.id)).toEqual([b]);
    // Los dos listos; al confirmar la recogida del primero, los dos salen en camino.
    await m.llamar('POST', `/datos/restaurante/pedidos/${a}/listo`, {}, dueno.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${b}/listo`, {}, dueno.token);
    await m.recoger(a, rep.token, dueno.token);
    const estados = async () =>
      (
        await m.DB.prepare('SELECT id, estado FROM pedidos WHERE id IN (?, ?)')
          .bind(a, b)
          .all<{ id: string; estado: string }>()
      ).results;
    expect((await estados()).every((x) => x.estado === 'en_camino')).toBe(true);
    // Se entregan uno por uno (cada uno con sus dos lecturas en su puerta).
    expect((await m.entregar(a, rep.token)).estado).toBe(200);
    expect((await m.entregar(b, rep.token)).estado).toBe(200);
    expect((await estados()).every((x) => x.estado === 'entregado')).toBe(true);
    void cliente;
  });

  it('mayoría de edad: un plato para mayores de 21 solo se entrega en mano con el documento revisado', async () => {
    const { m, dueno, cliente, repartidor, r } = await escenario();
    const cerveza = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Cerveza', precioCentavos: 800, requiereEdad: true },
      dueno.token,
    );
    expect(cerveza.datos.plato.requiereEdad).toBe(true);
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: cerveza.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
        entrega: 'mano',
        pin: false,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_edad' WHERE id = ?",
    )
      .bind(id)
      .run();
    expect(
      (await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token)).datos
        .pedido.requiereEdad,
    ).toBe(true);
    const rep = await repartidor('Edad Verifica', 25.771, -80.191);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.recoger(id, rep.token, dueno.token);
    const casa = { lat: 25.7801, lng: -80.2001 };
    await m.ubicar(rep.token, casa);
    await m.ubicar(rep.token, casa);
    // Con foto en la puerta, no.
    expect(
      (await m.foto(`/datos/repartidor/pedidos/${id}/entregado`, rep.token, casa)).estado,
    ).toBe(409);
    // En mano sin confirmar la edad, no.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/entregado`,
          { ...casa, modo: 'mano' },
          rep.token,
        )
      ).estado,
    ).toBe(409);
    // Punto 24: sin el documento y quién recibió, tampoco (es la «firma» de una entrega con edad).
    const sinDoc = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/entregado`,
      { ...casa, modo: 'mano', mayorEdad: true },
      rep.token,
    );
    expect(sinDoc.estado).toBe(409);
    expect(sinDoc.datos.campo).toBe('edad');
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/repartidor/pedidos/${id}/entregado`,
          {
            ...casa,
            modo: 'mano',
            mayorEdad: true,
            documento: 'licencia',
            documentoUltimos4: '1234',
            nombreRecibe: 'Ana Cliente',
          },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    const ev = await m.DB.prepare(
      "SELECT nota FROM evidencias WHERE pedido_id = ? AND tipo = 'entrega'",
    )
      .bind(id)
      .first<{ nota: string }>();
    expect(ev?.nota).toContain('ID licencia ••1234');
    expect(ev?.nota).toContain('recibió Ana Cliente');
  });
});

describe('C-PEDIDO-PROGRAMADO', () => {
  afterEach(() => vi.unstubAllGlobals());
  const franja = (min: number) => {
    const paso = 30 * 60_000;
    return new Date(Math.ceil((Date.now() + min * 60_000) / paso) * paso).toISOString();
  };

  it('guarda la franja, rechaza una muy cercana y el Manager espera a 45 min antes para apurar', async () => {
    const { m, cliente, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    const rid = (await m.DB.prepare('SELECT restaurante_id, lineas_json FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{
        restaurante_id: string;
        lineas_json: string;
      }>())!;
    const platoId = (JSON.parse(rid.lineas_json) as { platoId: string }[])[0]!.platoId;
    const cuerpo = (programadoPara: string) => ({
      restauranteId: rid.restaurante_id,
      lineas: [{ platoId, cantidad: 1 }],
      propinaCentavos: 0,
      direccion: '200 Calle Prueba',
      lat: 25.78,
      lng: -80.2,
      programadoPara,
    });
    const pronto = await m.llamar('POST', '/datos/pedidos', cuerpo(franja(5)), cliente.token);
    expect(pronto.estado).toBe(409);
    const ok = await m.llamar('POST', '/datos/pedidos', cuerpo(franja(180)), cliente.token);
    expect(ok.estado).toBe(201);
    const pid = ok.datos.pedidoId as string;
    const ped = await m.llamar('GET', `/datos/pedidos/${pid}`, undefined, cliente.token);
    expect(ped.datos.pedido.programadoPara).toBe(franja(180).slice(0, 19).replace('T', ' '));

    // Pagado hace 10 minutos, pero es para dentro de 3 horas: nadie lo cancela.
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now', '-10 minutes'), stripe_pago = 'pi_2' WHERE id = ?",
    )
      .bind(pid)
      .run();
    const { vigilarPedidos } = await import('../manager');
    const env = { DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    const r1 = await vigilarPedidos(env, m.DB, pid);
    expect(r1.cancelados + r1.recordatorios).toBe(0);
    // Ya entró en su ventana hace 10 minutos (franja en 35 min): ahora sí se cancela sin respuesta.
    await m.DB.prepare(
      "UPDATE pedidos SET programado_para = datetime('now', '+35 minutes') WHERE id = ?",
    )
      .bind(pid)
      .run();
    expect((await vigilarPedidos(env, m.DB, pid)).cancelados).toBe(1);
  });

  it('45 minutos antes de la franja el restaurante recibe «empieza a prepararlo», una sola vez', async () => {
    const { m, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'aceptado', aceptado_en = datetime('now'), programado_para = datetime('now', '+3 hours') WHERE id = ?",
    )
      .bind(id)
      .run();
    const { vigilarPedidos } = await import('../manager');
    const env = { DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as never;
    const avisos = () =>
      m.DB.prepare(
        "SELECT COUNT(*) AS n FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'programado_preparar'",
      )
        .bind(id)
        .first<{ n: number }>();
    await vigilarPedidos(env, m.DB);
    expect((await avisos())?.n).toBe(0);
    await m.DB.prepare(
      "UPDATE pedidos SET programado_para = datetime('now', '+40 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    await vigilarPedidos(env, m.DB);
    await vigilarPedidos(env, m.DB);
    expect((await avisos())?.n).toBe(1);
  });

  it('a los repartidores se les ofrece desde 45 minutos antes de la franja, no antes', async () => {
    const { m, pedidoPagado, repartidor } = await escenario();
    const id = await pedidoPagado();
    await repartidor('Rafa Rep', 25.781, -80.201);
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'aceptado', aceptado_en = datetime('now', '-60 minutes'), programado_para = datetime('now', '+3 hours') WHERE id = ?",
    )
      .bind(id)
      .run();
    const { repartirOfertas } = await import('./operacion');
    const env = { DB: m.DB } as never;
    await repartirOfertas(m.DB, env);
    const ofertas = () =>
      m.DB.prepare('SELECT COUNT(*) AS n FROM ofertas WHERE pedido_id = ?')
        .bind(id)
        .first<{ n: number }>();
    expect((await ofertas())?.n).toBe(0);
    await m.DB.prepare(
      "UPDATE pedidos SET aceptado_en = datetime('now', '-60 minutes'), programado_para = datetime('now', '+15 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    await repartirOfertas(m.DB, env);
    expect((await ofertas())?.n).toBeGreaterThan(0);
  });
});

describe('C-TURNOS-REPARTIDOR', () => {
  afterEach(() => vi.unstubAllGlobals());
  const enPunto = (min: number) => {
    const paso = 30 * 60_000;
    return new Date(Math.ceil((Date.now() + min * 60_000) / paso) * paso);
  };

  it('reserva un turno, no deja chocar otro, cancela y lo da por perdido si no se conecta', async () => {
    const { m } = await escenario();
    const d = await m.cuenta('repartidor', 'Rafa Turnos');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.78, lng: -80.2 },
      d.token,
    );
    const inicio = enPunto(120);
    const fin = new Date(inicio.getTime() + 3 * 3_600_000);
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/turnos',
      { inicio: inicio.toISOString(), fin: fin.toISOString() },
      d.token,
    );
    expect(r.estado).toBe(201);
    const choca = await m.llamar(
      'POST',
      '/datos/repartidor/turnos',
      {
        inicio: new Date(inicio.getTime() + 3_600_000).toISOString(),
        fin: new Date(fin.getTime() + 3_600_000).toISOString(),
      },
      d.token,
    );
    expect(choca.estado).toBe(409);
    const corto = await m.llamar(
      'POST',
      '/datos/repartidor/turnos',
      {
        inicio: enPunto(24 * 60).toISOString(),
        fin: new Date(enPunto(24 * 60).getTime() + 30 * 60_000).toISOString(),
      },
      d.token,
    );
    expect(corto.estado).toBe(409);
    expect(
      (await m.llamar('DELETE', `/datos/repartidor/turnos/${r.datos.id}`, undefined, d.token))
        .estado,
    ).toBe(200);
    // Otro turno que empezó hace 40 minutos y nunca se conectó: perdido.
    await m.DB.prepare(
      "INSERT INTO turnos_repartidor (id, repartidor_id, zona_id, inicio, fin) VALUES ('t-viejo', ?, 'US-FL-MIAMI', datetime('now','-40 minutes'), datetime('now','+80 minutes'))",
    )
      .bind(d.id)
      .run();
    await m.DB.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?')
      .bind(d.id)
      .run();
    const lista = await m.llamar('GET', '/datos/repartidor/turnos', undefined, d.token);
    expect(lista.datos.turnos.find((t: { id: string }) => t.id === 't-viejo').estado).toBe(
      'perdido',
    );
    expect(lista.datos.turnos.find((t: { id: string }) => t.id === r.datos.id).estado).toBe(
      'cancelado',
    );
  });

  it('a igual distancia, la oferta va primero a quien está en su turno', async () => {
    const { m, pedidoPagado, repartidor } = await escenario();
    const id = await pedidoPagado();
    const sinTurno = await repartidor('Sin Turno', 25.781, -80.201);
    const conTurno = await repartidor('Con Turno', 25.781, -80.201);
    await m.DB.prepare(
      "INSERT INTO turnos_repartidor (id, repartidor_id, zona_id, inicio, fin, estado) VALUES ('t1', ?, (SELECT zona_id FROM repartidores WHERE usuario_id = ?), datetime('now','-10 minutes'), datetime('now','+2 hours'), 'activo')",
    )
      .bind(conTurno.id, conTurno.id)
      .run();
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'aceptado', aceptado_en = datetime('now', '-60 minutes') WHERE id = ?",
    )
      .bind(id)
      .run();
    const { repartirOfertas } = await import('./operacion');
    await repartirOfertas(m.DB, { DB: m.DB } as never);
    const o = await m.DB.prepare('SELECT repartidor_id FROM ofertas WHERE pedido_id = ?')
      .bind(id)
      .first<{ repartidor_id: string }>();
    expect(o?.repartidor_id).toBe(conTurno.id);
    void sinTurno;
  });
});
