import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';

/**
 * La campana del inicio (18 oct 2026): avisos reales del cliente, sin tabla nueva. Pedidos en
 * curso, regalos a punto y próximas aperturas en su ciudad.
 */
async function escenario() {
  const m = mundo({
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
  });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const p = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  return { m, dueno, admin, cliente, rid, platoId: p.datos.plato.id as string };
}

async function pedidoPagado(e: Awaited<ReturnType<typeof escenario>>) {
  const { m, cliente, rid, platoId } = e;
  // El cobro de Stripe se simula: aquí solo importa el estado del pedido.
  const stripe = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) =>
    String(url).includes('stripe.com')
      ? new Response(
          JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret_x', customer: 'cus_1' }),
          { status: 200 },
        )
      : stripe(url)) as typeof fetch;
  try {
    const r = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    expect(r.estado).toBe(201);
    await llevarA(m.DB, r.datos.pedidoId, 'pagado');
    return r.datos.pedidoId as string;
  } finally {
    globalThis.fetch = stripe;
  }
}

describe('GET /datos/mis-avisos', () => {
  it('pide sesión de cliente', async () => {
    const { m } = await escenario();
    expect((await m.llamar('GET', '/datos/mis-avisos')).estado).toBe(401);
  });

  it('un pedido en curso es un aviso; al entregarse, desaparece', async () => {
    const e = await escenario();
    const { m, cliente } = e;
    const vacio = await m.llamar('GET', '/datos/mis-avisos', undefined, cliente.token);
    expect(vacio.datos.avisos).toEqual([]);
    expect(vacio.datos.pendientes).toBe(0);
    const id = await pedidoPagado(e);
    const r = await m.llamar('GET', '/datos/mis-avisos', undefined, cliente.token);
    expect(r.datos.pendientes).toBe(1);
    expect(r.datos.avisos[0]).toMatchObject({
      tipo: 'pedido',
      pedidoId: id,
      estado: 'pagado',
      restauranteNombre: 'Sabor Prueba',
    });
    await llevarA(m.DB, id, 'entregado', "entregado_en = datetime('now')");
    const fin = await m.llamar('GET', '/datos/mis-avisos', undefined, cliente.token);
    expect(fin.datos.avisos.filter((a: { tipo: string }) => a.tipo === 'pedido')).toHaveLength(0);
  });

  it('la tarjeta de sellos del restaurante donde ya compró aparece como regalo en camino', async () => {
    const e = await escenario();
    const { m, cliente, rid } = e;
    const id = await pedidoPagado(e);
    await llevarA(m.DB, id, 'entregado', "entregado_en = datetime('now')");
    const r = await m.llamar('GET', '/datos/mis-avisos', undefined, cliente.token);
    const sellos = r.datos.avisos.find((a: { tipo: string }) => a.tipo === 'regalo');
    expect(sellos).toMatchObject({
      tipo: 'regalo',
      regalo: 'sellos',
      restauranteId: rid,
      restauranteNombre: 'Sabor Prueba',
      progreso: 1,
      meta: 10,
    });
    // Los regalos no cuentan como «pendientes» (el punto rojo es para lo que pasa ahora).
    expect(r.datos.pendientes).toBe(0);
  });

  it('una zona de su ciudad marcada «próximamente» es un aviso de apertura', async () => {
    const { m, cliente } = await escenario();
    await m.DB.prepare(
      `INSERT INTO areas (id, zona_id, nombre, estado, poligono, min_lat, max_lat, min_lng, max_lng, apertura_prevista)
       VALUES ('a1', 'US-FL-MIAMI', 'Hialeah', 'proximamente', '[[-80.35,25.8],[-80.25,25.8],[-80.25,25.9],[-80.35,25.9]]', 25.8, 25.9, -80.35, -80.25, '2026-12-01')`,
    ).run();
    const r = await m.llamar(
      'GET',
      '/datos/mis-avisos?lat=25.78&lng=-80.2',
      undefined,
      cliente.token,
    );
    expect(r.datos.avisos.find((a: { tipo: string }) => a.tipo === 'apertura')).toMatchObject({
      area: 'Hialeah',
      apertura: '2026-12-01',
    });
  });
});
