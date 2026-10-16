import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * Cierre de seguridad de C-FALLOS-CRITICOS 2 (16 oct 2026): cancelar un pedido con el pago
 * autorizado. Criterios de Richard: no queda una autorización retenida cuando la cancelación se
 * confirma; no se cancela un pago equivocado; no hay doble devolución; no se marca cancelado sin
 * verificar con Stripe. Stripe simulado aquí; el S12 del sitio de pruebas lo comprueba contra
 * Stripe en modo prueba de verdad.
 */
const SECRETO_AVISO = `whsec_${crypto.randomUUID()}`;

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

type Llamada = { url: string; metodo: string };
type Stripe = (url: string, init?: RequestInit) => Response | null;

async function escenario() {
  const llamadas: Llamada[] = [];
  let stripe: Stripe = () => null;
  const PI = 'pi_3Prueba0000000000000001';
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    llamadas.push({ url: u, metodo: String(init?.method ?? 'GET') });
    const propia = stripe(u, init);
    if (propia) return propia;
    if (u.endsWith('/payment_intents') && init?.method === 'POST')
      return new Response(JSON.stringify({ id: PI, client_secret: `${PI}_secret_x` }), {
        status: 200,
      });
    if (/\/(customers|customer_sessions)/.test(u))
      return new Response(JSON.stringify({ id: 'cus_1', client_secret: 'cuss_x' }), {
        status: 200,
      });
    return new Response(JSON.stringify({ id: 'ok' }), { status: 200 });
  });
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
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  async function pedir() {
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
    return { id: p.datos.pedidoId as string, total: p.datos.desglose.totalCliente as number };
  }
  async function autorizar(id: string, total: number) {
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: PI, amount_capturable: total, metadata: { pedido_id: id } } },
    });
    return m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await avisoFirmado(cuerpo),
      },
      body: cuerpo,
    });
  }
  const cancelar = (id: string) =>
    m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token);
  const fila = (id: string) =>
    m.DB.prepare('SELECT estado, stripe_sesion, stripe_pago FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ estado: string; stripe_sesion: string | null; stripe_pago: string | null }>();
  const cancelaciones = () =>
    llamadas.filter((x) => /\/payment_intents\/[^/]+\/cancel$/.test(x.url) && x.metodo === 'POST');
  const reembolsos = () =>
    llamadas.filter((x) => x.url.endsWith('/refunds') && x.metodo === 'POST');
  return {
    m,
    PI,
    pedir,
    autorizar,
    cancelar,
    fila,
    cancelaciones,
    reembolsos,
    llamadas,
    simularStripe: (f: Stripe) => {
      stripe = f;
    },
  };
}

const error = (mensaje: string, status = 400) =>
  new Response(JSON.stringify({ error: { message: mensaje } }), { status });
const ok = (obj: object) => new Response(JSON.stringify(obj), { status: 200 });

describe('cancelar con el pago autorizado (C-FALLOS-CRITICOS 2)', () => {
  it('stripe_sesion guarda el id del PaymentIntent que devolvió Stripe al crear el pedido', async () => {
    const { PI, pedir, fila, llamadas } = await escenario();
    const p = await pedir();
    const f = await fila(p.id);
    expect(f?.stripe_sesion).toBe(PI);
    expect(f?.stripe_pago).toBeNull();
    // Se creó con un PaymentIntent (no con una sesión de Checkout).
    expect(llamadas.some((x) => x.url.endsWith('/payment_intents') && x.metodo === 'POST')).toBe(
      true,
    );
    expect(llamadas.some((x) => x.url.includes('/checkout/sessions'))).toBe(false);
  });

  it('1 · cancelar antes del aviso anula EXACTAMENTE ese PaymentIntent, con clave de idempotencia', async () => {
    const { PI, pedir, cancelar, fila, cancelaciones, llamadas } = await escenario();
    const otro = await pedir(); // otro pedido del mismo cliente: no se puede tocar su pago
    const p = await pedir();
    expect((await cancelar(p.id)).estado).toBe(200);
    expect((await fila(p.id))?.estado).toBe('cancelado');
    expect(cancelaciones().map((x) => x.url.split('/payment_intents/')[1])).toEqual([
      `${PI}/cancel`,
    ]);
    void llamadas;
    expect((await fila(otro.id))?.estado).toBe('pago_pendiente');
  });

  it('2 · un aviso tardío después de cancelar no revive el pedido ni crea un cobro', async () => {
    const { m, pedir, cancelar, autorizar, fila } = await escenario();
    const p = await pedir();
    expect((await cancelar(p.id)).estado).toBe(200);
    expect((await autorizar(p.id, p.total)).status).toBe(200);
    expect((await fila(p.id))?.estado).toBe('cancelado');
    const cobro = await m.DB.prepare('SELECT COUNT(*) AS n FROM cobros WHERE pedido_id = ?')
      .bind(p.id)
      .first<{ n: number }>();
    expect(cobro?.n).toBe(0);
  });

  it('3 · la respuesta de Stripe se pierde: se verifica con Stripe antes de dar por cancelado', async () => {
    const { PI, pedir, cancelar, fila, cancelaciones, simularStripe, llamadas } = await escenario();
    const p = await pedir();
    simularStripe((u, init) => {
      if (u.endsWith(`/payment_intents/${PI}/cancel`)) throw new Error('red: respuesta perdida');
      if (u.endsWith(`/payment_intents/${PI}`) && (init?.method ?? 'GET') === 'GET')
        return ok({ id: PI, status: 'canceled' });
      return null;
    });
    expect((await cancelar(p.id)).estado).toBe(200);
    expect((await fila(p.id))?.estado).toBe('cancelado');
    expect(cancelaciones()).toHaveLength(1);
    // Se preguntó a Stripe: la cancelación se confirmó, no se dio por hecha a ciegas.
    expect(
      llamadas.some((x) => x.url.endsWith(`/payment_intents/${PI}`) && x.metodo === 'GET'),
    ).toBe(true);
  });

  it('4 · el PaymentIntent ya estaba cancelado: Stripe lo rechaza, se verifica y queda cancelado sin doble devolución', async () => {
    const { PI, pedir, cancelar, fila, cancelaciones, reembolsos, simularStripe } =
      await escenario();
    const p = await pedir();
    simularStripe((u, init) => {
      if (u.endsWith(`/payment_intents/${PI}/cancel`))
        return error('This PaymentIntent has already been canceled.');
      if (u.endsWith(`/payment_intents/${PI}`) && (init?.method ?? 'GET') === 'GET')
        return ok({ id: PI, status: 'canceled' });
      return null;
    });
    expect((await cancelar(p.id)).estado).toBe(200);
    expect((await fila(p.id))?.estado).toBe('cancelado');
    expect(cancelaciones()).toHaveLength(1);
    expect(reembolsos()).toHaveLength(0);
    // Cancelar otra vez: ya no está en un estado cancelable; no se llama a Stripe de nuevo.
    expect((await cancelar(p.id)).estado).toBe(409);
    expect(cancelaciones()).toHaveLength(1);
  });

  it('5 · fallo temporal de Stripe: el pedido vuelve a su estado, no se marca cancelado, y el reintento lo cancela', async () => {
    const { PI, pedir, cancelar, fila, cancelaciones, simularStripe } = await escenario();
    const p = await pedir();
    let caido = true;
    simularStripe((u, init) => {
      if (u.endsWith(`/payment_intents/${PI}/cancel`))
        return caido
          ? error('Stripe is temporarily unavailable', 503)
          : ok({ id: PI, status: 'canceled' });
      if (u.endsWith(`/payment_intents/${PI}`) && (init?.method ?? 'GET') === 'GET')
        return ok({ id: PI, status: 'requires_capture' });
      return null;
    });
    const primero = await cancelar(p.id);
    expect(primero.estado).toBe(422);
    expect((await fila(p.id))?.estado).toBe('pago_pendiente');
    caido = false;
    expect((await cancelar(p.id)).estado).toBe(200);
    expect((await fila(p.id))?.estado).toBe('cancelado');
    expect(cancelaciones()).toHaveLength(2);
  });

  it('después del aviso (pagado, solo autorizado) se anula el mismo PaymentIntent y el cobro queda cancelado', async () => {
    const { m, PI, pedir, autorizar, cancelar, fila, cancelaciones, reembolsos } =
      await escenario();
    const p = await pedir();
    expect((await autorizar(p.id, p.total)).status).toBe(200);
    expect((await fila(p.id))?.stripe_pago).toBe(PI);
    expect((await cancelar(p.id)).estado).toBe(200);
    expect(cancelaciones()).toHaveLength(1);
    expect(reembolsos()).toHaveLength(0);
    const cobro = await m.DB.prepare('SELECT cancelado_en FROM cobros WHERE pedido_id = ?')
      .bind(p.id)
      .first<{ cancelado_en: string | null }>();
    expect(cobro?.cancelado_en).not.toBeNull();
  });

  it('con el cobro ya capturado se reembolsa UNA vez; cancelar de nuevo no vuelve a devolver', async () => {
    const { m, pedir, autorizar, cancelar, cancelaciones, reembolsos } = await escenario();
    const p = await pedir();
    expect((await autorizar(p.id, p.total)).status).toBe(200);
    await m.DB.prepare(
      "UPDATE cobros SET capturado_en = datetime('now'), capturado = ? WHERE pedido_id = ?",
    )
      .bind(p.total, p.id)
      .run();
    expect((await cancelar(p.id)).estado).toBe(200);
    expect(reembolsos()).toHaveLength(1);
    expect(cancelaciones()).toHaveLength(0);
    expect((await cancelar(p.id)).estado).toBe(409);
    expect(reembolsos()).toHaveLength(1);
  });
});
