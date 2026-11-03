import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { calcularPedido } from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * Fallos de dinero F6, F7 y F8 de la auditoría final (docs/AUDITORIA-FINAL-2026-10-18.md).
 * Cada prueba reproduce el fallo como lo viviría un cliente; primero en ROJO, después candado
 * (C-FALLOS-DINERO). Stripe siempre simulado: nunca dinero real.
 */
type Llamada = { url: string; metodo: string; cuerpo: string };

async function escenario(respuestaStripe?: (url: string, init?: RequestInit) => Response | null) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      metodo: String(init?.method ?? 'GET'),
      cuerpo: String(init?.body ?? ''),
    });
    const propia = respuestaStripe?.(String(url), init);
    if (propia) return propia;
    return /\/(payment_intents|customers|customer_sessions)/.test(String(url))
      ? new Response(JSON.stringify({ id: 'pi_sesion', client_secret: 'pi_sesion_secret_x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 });
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const restauranteId = r.datos.restaurante.id as string;
  await m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${restauranteId}`,
    { estado: 'aprobado' },
    admin.token,
  );
  const platos: string[] = [];
  for (const [nombreEs, precioCentavos] of [
    ['Cubano', 1500],
    ['Jugo', 500],
  ] as const) {
    const p = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs, precioCentavos },
      dueno.token,
    );
    platos.push(p.datos.plato.id as string);
  }
  await m.abrir(dueno.token);
  const lineas = [
    { platoId: platos[0]!, cantidad: 1 },
    { platoId: platos[1]!, cantidad: 1 },
  ];
  const pedir = (extra: Record<string, unknown>) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId,
        lineas,
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      cliente.token,
    );
  return { m, dueno, cliente, restauranteId, platos, lineas, pedir, llamadas };
}

describe('F6: el total del carrito al recoger en el local (C-FALLOS-DINERO)', () => {
  it('si la app manda un total distinto al del servidor, el pedido no se crea y se le dice el correcto', async () => {
    const { pedir } = await escenario();
    const conEnvio = await pedir({ entrega: 'puerta' });
    expect(conEnvio.estado).toBe(201);
    const totalConEnvio = conEnvio.datos.desglose.totalCliente as number;
    // La app vieja calculaba el total CON envío aunque el cliente eligiera recoger.
    const r = await pedir({ entrega: 'recoger', totalEsperado: totalConEnvio });
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('total');
    expect(r.datos.nuevoTotal).toBeLessThan(totalConEnvio);
    // Con el total correcto, sí se crea.
    const ok = await pedir({ entrega: 'recoger', totalEsperado: r.datos.nuevoTotal });
    expect(ok.estado).toBe(201);
    expect(ok.datos.desglose.envio).toBe(0);
  });

  it('la app del cliente calcula con «recogida» y manda su total para que el servidor lo compare', () => {
    const cart = readFileSync(join(__dirname, '..', '..', 'cliente/src/app/cart.tsx'), 'utf8');
    expect(cart).toMatch(/calcularPedido\(\{[\s\S]*?recogida:/);
    expect(cart).toContain('totalEsperado');
  });
});

describe('F8: quitar un plato de un pedido para recoger (C-FALLOS-DINERO)', () => {
  it('la devolución se calcula sin envío, como se cobró', async () => {
    const { m, dueno, pedir, platos } = await escenario();
    const p = await pedir({ entrega: 'recoger' });
    const id = p.datos.pedidoId as string;
    const totalAntes = p.datos.desglose.totalCliente as number;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    const falta = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/falta`,
      { platoId: platos[1]! },
      dueno.token,
    );
    expect(falta.estado).toBe(200);
    const sinJugo = calcularPedido({
      lineas: [{ precioCentavos: 1500, cantidad: 1 }],
      plan: 'inicial',
      propina: 300,
      distanciaKm: null,
      recogida: true,
    });
    expect(falta.datos.devolucion).toBe(totalAntes - sinJugo.totalCliente);
  });
});

describe('F7: cambio de dirección y el cobro en Stripe (C-FALLOS-DINERO)', () => {
  it('antes de pagar, el cobro ya creado se actualiza al nuevo total', async () => {
    const { m, cliente, pedir, llamadas } = await escenario();
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    llamadas.length = 0;
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    const total = (await m.DB.prepare('SELECT total FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ total: number }>())!.total;
    expect(total).not.toBe(p.datos.desglose.totalCliente);
    const actualizo = llamadas.find(
      (l) => l.metodo === 'POST' && /\/payment_intents\/pi_sesion$/.test(l.url),
    );
    expect(actualizo, 'Stripe tiene que recibir el nuevo monto').toBeTruthy();
    expect(actualizo!.cuerpo).toContain(`amount=${total}`);
  });

  it('si Stripe rechaza el nuevo monto, se responde 409 y la dirección no cambia (nunca 500)', async () => {
    const { m, cliente, pedir } = await escenario((url, init) =>
      /\/payment_intents\/pi_sesion$/.test(url) && init?.method === 'POST'
        ? new Response(JSON.stringify({ error: { message: 'amount too large' } }), { status: 400 })
        : null,
    );
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_sesion' WHERE id = ?",
    )
      .bind(id)
      .run();
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado).toBe(409);
    const f = (await m.DB.prepare('SELECT direccion, total FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ direccion: string; total: number }>())!;
    expect(f.direccion).toBe('300 Calle Prueba');
    expect(f.total).toBe(p.datos.desglose.totalCliente);
  });
});

describe('LAN-2 · C-DIRECCION-REAUTORIZA: cambio de dirección con la tarjeta ya autorizada', () => {
  /** Stripe como el de verdad: con la autorización retenida no deja cambiar el monto. */
  const stripeRetenido =
    (nuevo: { status: string }) =>
    (url: string, init?: RequestInit): Response | null => {
      const metodo = init?.method ?? 'GET';
      if (/\/payment_intents\/pi_sesion$/.test(url) && metodo === 'POST')
        return Response.json(
          {
            error: {
              message:
                "This PaymentIntent's amount could not be updated because it has a status of requires_capture.",
            },
          },
          { status: 400 },
        );
      if (/\/payment_intents\/pi_sesion$/.test(url) && metodo === 'GET')
        return Response.json({
          id: 'pi_sesion',
          status: 'requires_capture',
          payment_method: 'pm_guardada',
          customer: 'cus_1',
        });
      if (
        /\/payment_intents$/.test(url) &&
        metodo === 'POST' &&
        String(init?.body).includes('off_session=true')
      )
        return Response.json({ id: 'pi_nuevo', ...nuevo });
      if (/\/payment_intents\/pi_sesion\/cancel$/.test(url))
        return Response.json({ id: 'pi_sesion', status: 'canceled' });
      return null;
    };
  const pagar = (m: Awaited<ReturnType<typeof escenario>>['m'], id: string) =>
    m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_sesion', stripe_sesion = 'pi_sesion' WHERE id = ?",
    )
      .bind(id)
      .run();
  const fila = (m: Awaited<ReturnType<typeof escenario>>['m'], id: string) =>
    m.DB.prepare('SELECT direccion, total, stripe_pago, stripe_sesion FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ direccion: string; total: number; stripe_pago: string; stripe_sesion: string }>();

  it('si el envío sube, se autoriza el total nuevo con la tarjeta guardada y se anula la autorización vieja', async () => {
    const { m, cliente, pedir, llamadas } = await escenario(
      stripeRetenido({ status: 'requires_capture' }),
    );
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    llamadas.length = 0;
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const f = (await fila(m, id))!;
    expect(f.total).toBeGreaterThan(p.datos.desglose.totalCliente);
    expect(f).toMatchObject({ stripe_pago: 'pi_nuevo', stripe_sesion: 'pi_nuevo' });
    const nueva = llamadas.find(
      (l) =>
        l.metodo === 'POST' && /\/payment_intents$/.test(l.url) && l.cuerpo.includes('off_session'),
    )!;
    expect(nueva.cuerpo).toContain(`amount=${f.total}`);
    expect(nueva.cuerpo).toContain('payment_method=pm_guardada');
    expect(nueva.cuerpo).toContain('capture_method=manual');
    expect(llamadas.some((l) => /\/payment_intents\/pi_sesion\/cancel$/.test(l.url))).toBe(true);
  });

  it('si la tarjeta no autoriza el total nuevo, la dirección no cambia y la autorización vieja sigue', async () => {
    const { m, cliente, pedir, llamadas } = await escenario(
      stripeRetenido({ status: 'requires_action' }),
    );
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    llamadas.length = 0;
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado).toBe(409);
    expect(await fila(m, id)).toMatchObject({
      direccion: '300 Calle Prueba',
      total: p.datos.desglose.totalCliente,
      stripe_pago: 'pi_sesion',
    });
    expect(llamadas.some((l) => /\/cancel$/.test(l.url) && l.url.includes('pi_sesion'))).toBe(
      false,
    );
  });

  it('LAN-2x: si otro cambio ganó la carrera, no se escribe nada y se anula la autorización nueva', async () => {
    let carrera: (() => Promise<unknown>) | null = null;
    const base = stripeRetenido({ status: 'requires_capture' });
    const { m, cliente, pedir, llamadas } = await escenario((url, init) => {
      if (/\/payment_intents$/.test(url) && String(init?.body).includes('off_session=true'))
        void carrera?.();
      return base(url, init);
    });
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    // Mientras se autoriza, otro cambio ya dejó el pedido con OTRA autorización.
    carrera = () =>
      m.DB.prepare("UPDATE pedidos SET stripe_pago = 'pi_otro' WHERE id = ?").bind(id).run();
    llamadas.length = 0;
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado).toBe(409);
    expect(await fila(m, id)).toMatchObject({
      direccion: '300 Calle Prueba',
      total: p.datos.desglose.totalCliente,
      stripe_pago: 'pi_otro',
    });
    expect(llamadas.some((l) => /\/payment_intents\/pi_nuevo\/cancel$/.test(l.url))).toBe(true);
    expect(llamadas.some((l) => /\/payment_intents\/pi_sesion\/cancel$/.test(l.url))).toBe(false);
  });

  it('LAN-2x: cada intento usa su propia clave (un error guardado no se repite 24 h)', async () => {
    const claves: string[] = [];
    const base = stripeRetenido({ status: 'requires_action' });
    const { m, cliente, pedir } = await escenario((url, init) => {
      if (/\/payment_intents$/.test(url) && String(init?.body).includes('off_session=true'))
        claves.push(new Headers(init?.headers).get('idempotency-key') ?? '');
      return base(url, init);
    });
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    const cambiar = () =>
      m.llamar(
        'PATCH',
        `/datos/pedidos/${id}/direccion`,
        { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
        cliente.token,
      );
    expect((await cambiar()).estado).toBe(409);
    expect((await cambiar()).estado).toBe(409);
    expect(claves).toHaveLength(2);
    expect(claves[0]).not.toBe(claves[1]);
  });

  it('LAN-2x: si no se pudo anular la autorización vieja, queda a la vista y anotada para la conciliación', async () => {
    const base = stripeRetenido({ status: 'requires_capture' });
    const { m, cliente, pedir } = await escenario((url, init) =>
      /\/payment_intents\/pi_sesion\/cancel$/.test(url)
        ? Response.json({ error: { message: 'api_error' } }, { status: 500 })
        : base(url, init),
    );
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '900 Calle Lejos', lat: 25.9, lng: -80.3, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    const err = await m.DB.prepare(
      "SELECT mensaje FROM errores_servidor WHERE mensaje LIKE 'No se pudo anular la autorización vieja%'",
    ).first<{ mensaje: string }>();
    expect(err?.mensaje).toContain('pi_sesion');
    const ev = await m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento LIKE 'cobro_reautorizado%'",
    )
      .bind(id)
      .first<{ detalle: string }>();
    expect(ev?.detalle).toBe('pi_sesion>pi_nuevo');
  });

  it('LAN-2z: dos cambios seguidos que suben el total dejan anotada CADA autorización reemplazada', async () => {
    // Stripe: cada reautorización devuelve un intento nuevo; el último vigente es el que se lee.
    let n = 0;
    const { m, cliente, pedir } = await escenario((url, init) => {
      const metodo = init?.method ?? 'GET';
      const leer = /\/payment_intents\/(pi_[a-z0-9]+)$/.exec(url);
      if (leer && metodo === 'POST')
        return Response.json({ error: { message: 'status of requires_capture' } }, { status: 400 });
      if (leer && metodo === 'GET')
        return Response.json({
          id: leer[1],
          status: 'requires_capture',
          payment_method: 'pm_guardada',
          customer: 'cus_1',
        });
      if (
        /\/payment_intents$/.test(url) &&
        metodo === 'POST' &&
        String(init?.body).includes('off_session=true')
      )
        return Response.json({ id: `pi_reaut${++n}`, status: 'requires_capture' });
      if (/\/cancel$/.test(url)) return Response.json({ status: 'canceled' });
      return null;
    });
    const p = await pedir({ entrega: 'puerta' });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    const cambiar = (lat: number) =>
      m.llamar(
        'PATCH',
        `/datos/pedidos/${id}/direccion`,
        { direccion: `900 Calle ${lat}`, lat, lng: -80.195, aceptarTotal: true },
        cliente.token,
      );
    const r1 = await cambiar(25.815);
    expect(r1.estado).toBe(200);
    const r2 = await cambiar(25.84);
    expect(r2.estado).toBe(200);
    expect(r2.datos.total, 'el total sube las dos veces').toBeGreaterThan(r1.datos.total);
    expect((await fila(m, id))!.stripe_pago).toBe('pi_reaut2');
    const { results } = await m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento LIKE 'cobro_reautorizado%' ORDER BY id",
    )
      .bind(id)
      .all<{ detalle: string }>();
    expect(results.map((r) => r.detalle)).toEqual(['pi_sesion>pi_reaut1', 'pi_reaut1>pi_reaut2']);
  });

  it('si el envío baja, no hace falta tocar Stripe: se capturará el total menor', async () => {
    const { m, cliente, pedir, llamadas } = await escenario(
      stripeRetenido({ status: 'requires_capture' }),
    );
    const p = await pedir({
      entrega: 'puerta',
      direccion: '900 Calle Lejos',
      lat: 25.9,
      lng: -80.3,
    });
    const id = p.datos.pedidoId as string;
    await pagar(m, id);
    llamadas.length = 0;
    const r = await m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { direccion: '300 Calle Prueba', lat: 25.775, lng: -80.195, aceptarTotal: true },
      cliente.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const f = (await fila(m, id))!;
    expect(f.total).toBeLessThan(p.datos.desglose.totalCliente);
    expect(f.stripe_pago).toBe('pi_sesion');
    expect(llamadas.filter((l) => l.metodo === 'POST' && /payment_intents/.test(l.url))).toEqual(
      [],
    );
  });
});

describe('F10: los avisos de las cuentas conectadas de Stripe llegan con su propio secreto (C-FALLOS-DINERO)', () => {
  const SECRETO = `whsec_${crypto.randomUUID()}`;
  const SECRETO_CONECTADAS = `whsec_${crypto.randomUUID()}`;

  async function firmar(cuerpo: string, secreto: string) {
    const t = Math.floor(Date.now() / 1000);
    const llave = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secreto),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
    const v1 = [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `t=${t},v1=${v1}`;
  }

  async function aviso(m: ReturnType<typeof mundo>, secreto: string) {
    const cuerpo = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      type: 'account.updated',
      account: 'acct_1',
      data: { object: { id: 'acct_1', payouts_enabled: true, charges_enabled: true } },
    });
    return m.crudo('/datos/stripe/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await firmar(cuerpo, secreto),
      },
      body: cuerpo,
    });
  }

  it('la activación de pagos del restaurante se aplica con el secreto de cuentas conectadas, y una firma ajena se rechaza', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo({
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: SECRETO,
      STRIPE_WEBHOOK_SECRET_CONECTADAS: SECRETO_CONECTADAS,
    });
    const dueno = await m.cuenta('restaurante');
    await m.DB.prepare(
      "INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta, pagos_activos) VALUES (?, 'acct_1', 0)",
    )
      .bind(dueno.id)
      .run();
    expect((await aviso(m, `whsec_${crypto.randomUUID()}`)).status).toBe(400);
    const r = await aviso(m, SECRETO_CONECTADAS);
    expect(r.status).toBe(200);
    const fila = await m.DB.prepare(
      "SELECT pagos_activos FROM cuentas_stripe WHERE stripe_cuenta = 'acct_1'",
    ).first<{ pagos_activos: number }>();
    expect(fila?.pagos_activos).toBe(1);
  });

  it('el canario dice «pendiente» mientras falte el secreto de cuentas conectadas', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRETO });
    const salud = (await (await m.crudo('/datos/salud', { method: 'GET' })).json()) as {
      piezas: Record<string, string>;
    };
    expect(salud.piezas.webhookStripeConectadas).toBe('pendiente');
  });
});
