import { readFileSync } from 'node:fs';
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
    const cart = readFileSync(new URL('../../cliente/src/app/cart.tsx', import.meta.url), 'utf8');
    expect(cart).toMatch(/calcularPedido\(\{[\s\S]*?recogida:/);
    expect(cart).toContain('totalEsperado');
  });
});

describe('F8: quitar un plato de un pedido para recoger (C-FALLOS-DINERO)', () => {
  it('la devolución se calcula sin envío, como se cobró', async () => {
    const { m, dueno, pedir, platos, lineas } = await escenario();
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
      { platoId: platos[1] },
      dueno.token,
    );
    expect(falta.estado).toBe(200);
    const sinJugo = calcularPedido({
      lineas: [{ platoId: platos[0]!, precioCentavos: 1500, cantidad: 1 }],
      plan: 'basico',
      propina: 300,
      distanciaKm: null,
      recogida: true,
    });
    void lineas;
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
