import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { usarTransporteAvisos } from './notificaciones';
import { usarTransporteCorreo } from './correo';

type Mensaje = { to: string; title: string; body: string; data: Record<string, string> };

function expoFalso(respuesta?: (m: Mensaje[]) => object) {
  const mandados: Mensaje[] = [];
  usarTransporteAvisos(async (_url, init) => {
    const lote = JSON.parse(String(init.body)) as Mensaje[];
    mandados.push(...lote);
    const cuerpo = respuesta ? respuesta(lote) : { data: lote.map(() => ({ status: 'ok' })) };
    return new Response(JSON.stringify(cuerpo), { status: 200 });
  });
  return mandados;
}
const TOKEN = 'ExponentPushToken[prueba-cliente-1]';

describe('avisos al celular', () => {
  afterEach(() => {
    usarTransporteAvisos(null);
    usarTransporteCorreo(null);
    vi.unstubAllGlobals();
  });

  it('el teléfono se registra, y un token mal formado no entra', async () => {
    const m = mundo();
    const u = await m.cuenta('cliente');
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/dispositivo',
          { token: 'basura', plataforma: 'ios' },
          u.token,
        )
      ).estado,
    ).toBe(400);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/dispositivo',
          { token: TOKEN, plataforma: 'ios' },
          u.token,
        )
      ).estado,
    ).toBe(200);
    // Registrarlo dos veces no duplica.
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: TOKEN, plataforma: 'ios' },
      u.token,
    );
    const n = await m.DB.prepare('SELECT count(*) AS n FROM dispositivos').first<{ n: number }>();
    expect(n?.n).toBe(1);
    // Otra cuenta no puede quedarse con el token mientras siga activo; al salir, sí.
    const otra = await m.cuenta('cliente');
    expect(
      (await m.llamar('POST', '/datos/cuentas/dispositivo', { token: TOKEN }, otra.token)).estado,
    ).toBe(409);
    await m.llamar('DELETE', '/datos/cuentas/dispositivo', { token: TOKEN }, u.token);
    expect(
      (await m.llamar('POST', '/datos/cuentas/dispositivo', { token: TOKEN }, otra.token)).estado,
    ).toBe(200);
  });

  it('aceptado, en camino y entregado avisan al cliente; la oferta al repartidor; el pago al restaurante', async () => {
    const mandados = expoFalso();
    usarTransporteCorreo(
      async () => new Response(JSON.stringify({ success: true, rebotados: [] })),
    );
    vi.stubGlobal('fetch', async (url: string) =>
      url.includes('/checkout/sessions')
        ? new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }))
        : new Response('{}', { status: 404 }),
    );
    const ENV = { STRIPE_SECRET_KEY: 'sk_test_x', YAD_TOKEN: 'x'.repeat(40) };
    const m = mundo(ENV);
    const dueno = await m.cuenta('restaurante', 'Luis');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente', 'Rosa');
    const rep = await m.cuenta('repartidor', 'Pedro Veloz');
    for (const [u, tk] of [
      [cliente, 'cliente'],
      [dueno, 'dueno'],
      [rep, 'rep'],
    ] as const)
      await m.llamar(
        'POST',
        '/datos/cuentas/dispositivo',
        { token: `ExponentPushToken[${tk}]` },
        u.token,
      );
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
    const pedido = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: p.datos.plato.id, cantidad: 2 }],
        propinaCentavos: 400,
        direccion: '200 Calle Prueba, Miami',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    const id = pedido.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = ?",
    )
      .bind(id)
      .run();

    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 15 },
      dueno.token,
    );
    expect(mandados.at(-1)).toMatchObject({
      to: 'ExponentPushToken[cliente]',
      title: 'Tu pedido está en cocina',
    });

    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    const oferta = mandados.find((x) => x.to === 'ExponentPushToken[rep]');
    expect(oferta?.title).toContain('Entrega nueva');

    await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/recogido`, {}, rep.token);
    expect(mandados.at(-1)).toMatchObject({
      to: 'ExponentPushToken[cliente]',
      body: 'Pedro ya recogió tu comida.',
    });
    await m.llamar('POST', `/datos/repartidor/pedidos/${id}/entregado`, {}, rep.token);
    expect(mandados.at(-1)?.title).toContain('Entregado');
    expect(mandados.at(-1)?.data.pedidoId).toBe(id);
  });

  it('un teléfono que ya no existe se apaga solo y el canario marca otros fallos', async () => {
    expoFalso((lote) => ({
      data: lote.map((x) =>
        x.to.includes('viejo')
          ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok' },
      ),
    }));
    const m = mundo();
    const u = await m.cuenta('cliente');
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[viejo]' },
      u.token,
    );
    const { notificar } = await import('./notificaciones');
    await notificar({} as never, m.DB, u.id, { titulo: 'a', cuerpo: 'b' });
    const f = await m.DB.prepare('SELECT activo FROM dispositivos WHERE token = ?')
      .bind('ExponentPushToken[viejo]')
      .first<{ activo: number }>();
    expect(f?.activo).toBe(0);
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.avisosCelular).toBe('ok');
  });
});
