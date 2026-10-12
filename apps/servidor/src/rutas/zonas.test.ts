import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

const OCALA = {
  id: 'US-FL-OCALA',
  nombre: 'Ocala',
  pais: 'US',
  lat: 29.1872,
  lng: -82.1401,
  radioKm: 30,
  activa: true,
};

describe('zonas: pueblo en pueblo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cada zona ve solo sus restaurantes, y fuera de zona se dice claro', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    expect((await m.llamar('PUT', '/datos/admin/zonas', OCALA, admin.token)).estado).toBe(200);
    const miami = await m.cuenta('restaurante');
    const ocala = await m.cuenta('restaurante');
    const rm = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, miami.token);
    const ro = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Sabor Ocala', lat: 29.19, lng: -82.14 },
      ocala.token,
    );
    for (const r of [rm, ro])
      await m.llamar(
        'PATCH',
        `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
        { estado: 'aprobado' },
        admin.token,
      );
    const enMiami = await m.llamar('GET', '/datos/restaurantes?lat=25.77&lng=-80.19');
    expect(enMiami.datos.restaurantes.map((r: { nombre: string }) => r.nombre)).toEqual([
      'Sabor Prueba',
    ]);
    const enOcala = await m.llamar('GET', '/datos/restaurantes?lat=29.18&lng=-82.13');
    expect(enOcala.datos.restaurantes.map((r: { nombre: string }) => r.nombre)).toEqual([
      'Sabor Ocala',
    ]);
    const lejos = await m.llamar('GET', '/datos/restaurantes?lat=40.71&lng=-74.0');
    expect(lejos.datos.fueraDeZona).toBe(true);
    const fila = await m.DB.prepare('SELECT zona_id, geohash FROM restaurantes WHERE id = ?')
      .bind(ro.datos.restaurante.id)
      .first<{ zona_id: string; geohash: string }>();
    expect(fila?.zona_id).toBe('US-FL-OCALA');
    expect(fila?.geohash).toHaveLength(5);
  });

  it('una zona apagada no aparece y solo el admin crea zonas', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    expect((await m.llamar('PUT', '/datos/admin/zonas', OCALA, cliente.token)).estado).toBe(403);
    expect(
      (await m.llamar('PUT', '/datos/admin/zonas', { ...OCALA, id: 'ocala' }, admin.token)).estado,
    ).toBe(400);
    await m.llamar('PUT', '/datos/admin/zonas', OCALA, admin.token);
    await m.llamar('PATCH', '/datos/admin/zonas/US-FL-OCALA', { activa: false }, admin.token);
    const pub = await m.llamar('GET', '/datos/zonas');
    expect(pub.datos.zonas.map((z: { id: string }) => z.id)).toEqual(['US-FL-MIAMI']);
    const adm = await m.llamar('GET', '/datos/admin/zonas', undefined, admin.token);
    expect(adm.datos.zonas).toHaveLength(2);
  });

  it('el reparto nunca cruza de zona y el historial anota cada paso', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ id: 'cs_1', client_secret: 'cs_1_secret_x' }), {
          status: 200,
        }),
    );
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const admin = await m.cuenta('admin');
    await m.llamar('PUT', '/datos/admin/zonas', OCALA, admin.token);
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
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
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '200 Calle Prueba',
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = ?",
    )
      .bind(id)
      .run();
    await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 10 },
      dueno.token,
    );
    // Zona vecina pegada a Miami: su repartidor está a pocos km del restaurante, pero es de otra zona.
    await m.llamar(
      'PUT',
      '/datos/admin/zonas',
      {
        id: 'US-FL-BEACH',
        nombre: 'Miami Beach',
        pais: 'US',
        lat: 25.79,
        lng: -80.13,
        radioKm: 3,
        activa: true,
      },
      admin.token,
    );
    const deOtraZona = await m.cuenta('repartidor');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.795, lng: -80.13 },
      deOtraZona.token,
    );
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, deOtraZona.token)).datos
        .ofertas,
    ).toHaveLength(0);
    // Uno de Miami, lejos de la celda del restaurante pero dentro de la zona, sí (búsqueda en toda la zona).
    const deMiami = await m.cuenta('repartidor');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.86, lng: -80.19 },
      deMiami.token,
    );
    expect(
      (await m.llamar('GET', '/datos/repartidor/ofertas', undefined, deMiami.token)).datos.ofertas,
    ).toHaveLength(1);
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.historial.map((h: { estado: string }) => h.estado)).toEqual([
      'pago_pendiente',
      'aceptado',
    ]);
    const z = await m.DB.prepare('SELECT zona_id FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ zona_id: string }>();
    expect(z?.zona_id).toBe('US-FL-MIAMI');
  });
});
