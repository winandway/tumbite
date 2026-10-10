import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

async function escenario() {
  vi.stubGlobal('fetch', async (url: string) =>
    url.includes('/checkout/sessions')
      ? new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }), {
          status: 200,
        })
      : new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
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
  return { m, dueno, cliente, pedidoPagado, repartidor };
}

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

    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token)).estado,
    ).toBe(409);
    const bRest = await m.llamar('GET', '/datos/billetera', undefined, dueno.token);
    expect(bRest.datos.saldo).toBe(3000 - 225);
    const bRep = await m.llamar('GET', '/datos/billetera', undefined, rep.token);
    expect(bRep.datos.saldo).toBe(900);
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.puntos).toBe(10);
    // Al terminar, la ubicación del repartidor deja de mostrarse al cliente.
    const fin = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(fin.datos.pedido.repartidor.lat).toBeNull();
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
