import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';

async function escenario() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
        status: 200,
      }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = (
    await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza', precioCentavos: 1200 },
      dueno.token,
    )
  ).datos.plato.id as string;
  await m.abrir(dueno.token);
  const linea = [{ platoId: plato, cantidad: 1 }];
  /** Deja N pedidos entregados del cliente (con fecha opcional) para armar el historial. */
  async function historial(n: number, hace = "datetime('now')") {
    for (let i = 0; i < n; i++) {
      const p = await m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rid,
          lineas: [{ platoId: plato, cantidad: 50 }],
          propinaCentavos: 0,
          direccion: '200 Calle Prueba',
        },
        cliente.token,
      );
      await llevarA(
        m.DB,
        p.datos.pedidoId,
        'entregado',
        `creado_en = ${hace}, entregado_en = ${hace}`,
      );
    }
  }
  const config = (extra: object) =>
    m.llamar(
      'PUT',
      '/datos/mi-restaurante/regalos',
      {
        pb: 300,
        cumpleanos: true,
        cumplePlatoId: plato,
        sellos: true,
        sellosMeta: 3,
        sellosPlatoId: plato,
        vuelve: false,
        vueltaDias: 30,
        vueltaPb: 1000,
        ...extra,
      },
      dueno.token,
    );
  return { m, dueno, admin, cliente, rid, plato, linea, historial, config };
}

describe('regalos y marketing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el presupuesto se llena con el 3 % de las ventas', async () => {
    const { m, dueno, historial } = await escenario();
    await historial(2);
    const r = await m.llamar('GET', '/datos/mi-restaurante/regalos', undefined, dueno.token);
    expect(r.datos.presupuesto).toMatchObject({ pb: 300, acumulado: 3600, disponible: 3600 });
  });

  it('regalo de cumpleaños: solo a quien ya compró, y se descuenta del pedido', async () => {
    const { m, cliente, rid, linea, historial, config } = await escenario();
    await config({});
    const hoy = new Date().toISOString().slice(5, 10);
    await m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = ? WHERE id = ?')
      .bind(`1990-${hoy}`, cliente.id)
      .run();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurantes/${rid}/mis-regalos`,
          { lineas: linea },
          cliente.token,
        )
      ).datos.regalos,
    ).toHaveLength(0);
    await historial(1);
    const r = await m.llamar(
      'POST',
      `/datos/restaurantes/${rid}/mis-regalos`,
      { lineas: linea },
      cliente.token,
    );
    expect(r.datos.regalos[0]).toMatchObject({ tipo: 'cumpleanos', valorCentavos: 1200 });
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: linea,
        propinaCentavos: 0,
        direccion: '200 Calle Prueba',
        regalo: 'cumpleanos',
      },
      cliente.token,
    );
    expect(p.estado).toBe(201);
    expect(p.datos.desglose.pagoRestaurante).toBe(0);
  });

  it('tarjeta de sellos: al llegar a la meta', async () => {
    const { m, cliente, rid, linea, historial, config } = await escenario();
    await config({ cumpleanos: false });
    await historial(2);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurantes/${rid}/mis-regalos`,
          { lineas: linea },
          cliente.token,
        )
      ).datos.regalos,
    ).toHaveLength(0);
    await historial(1);
    const r = await m.llamar(
      'POST',
      `/datos/restaurantes/${rid}/mis-regalos`,
      { lineas: linea },
      cliente.token,
    );
    expect(r.datos.regalos.map((x: { tipo: string }) => x.tipo)).toEqual(['sellos']);
  });

  it('cliente que vuelve: descuento si hace tiempo que no pide', async () => {
    const { m, cliente, rid, linea, historial, config } = await escenario();
    await config({
      cumpleanos: false,
      sellos: false,
      vuelve: true,
      vueltaDias: 30,
      vueltaPb: 1000,
    });
    await historial(2, "datetime('now','-40 days')");
    const r = await m.llamar(
      'POST',
      `/datos/restaurantes/${rid}/mis-regalos`,
      { lineas: linea },
      cliente.token,
    );
    expect(r.datos.regalos[0]).toMatchObject({ tipo: 'vuelve', valorCentavos: 120 });
  });

  it('nunca se regala más que el presupuesto', async () => {
    const { m, cliente, rid, linea, historial, config } = await escenario();
    await config({ pb: 0, cumpleanos: false });
    await historial(3);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/restaurantes/${rid}/mis-regalos`,
          { lineas: linea },
          cliente.token,
        )
      ).datos.regalos,
    ).toHaveLength(0);
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: linea,
        propinaCentavos: 0,
        direccion: '200 Calle Prueba',
        regalo: 'sellos',
      },
      cliente.token,
    );
    expect(p.estado).toBe(409);
  });

  it('valida el porcentaje y que el plato de regalo sea del menú', async () => {
    const { config } = await escenario();
    expect((await config({ pb: 5000 })).estado).toBe(400);
    expect((await config({ cumplePlatoId: 'no-existe' })).estado).toBe(400);
  });

  it('el admin ve los repartidores con su nivel y cambia su tipo', async () => {
    const { m, admin } = await escenario();
    const rep = await m.cuenta('repartidor', 'Luis Rep');
    await m.llamar(
      'PATCH',
      `/datos/admin/repartidores/${rep.id}`,
      { tipo: 'empleado' },
      admin.token,
    );
    const r = await m.llamar('GET', '/datos/admin/repartidores', undefined, admin.token);
    expect(r.datos.repartidores[0]).toMatchObject({
      nombre: 'Luis Rep',
      tipo: 'empleado',
      entregas: 0,
    });
  });
});
