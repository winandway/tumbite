import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from './pruebas/ayuda';

/** Auditoría final, punto 26: cancelar y devolver, quitar repartidor, pedidos cerrados y suspender cuentas (C-SUPER-OPERACION). */
async function escenario() {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push(`${init?.method ?? 'GET'} ${url}`);
    return new Response(
      JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret', status: 'canceled' }),
      { status: 200 },
    );
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const rep = await m.cuenta('repartidor', 'Rafa Rep');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
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
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    return id;
  }
  return { m, admin, cliente, rep, dueno, pedidoPagado, llamadas };
}

describe('acciones del superadmin sobre pedidos y cuentas (C-SUPER-OPERACION)', () => {
  it('cancela con devolución y lo deja en la bitácora; sin motivo no cancela', async () => {
    const { m, admin, cliente, pedidoPagado, llamadas } = await escenario();
    const id = await pedidoPagado();
    expect(
      (await m.llamar('POST', `/datos/admin/pedidos/${id}/cancelar`, { motivo: '' }, admin.token))
        .estado,
    ).toBe(400);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/pedidos/${id}/cancelar`,
          { motivo: 'El cliente llamó' },
          cliente.token,
        )
      ).estado,
    ).toBe(403);
    const r = await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/cancelar`,
      { motivo: 'El cliente llamó' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const f = await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(f?.estado).toBe('cancelado');
    expect(
      llamadas.some((l) => l.includes('/payment_intents/pi_1/cancel') || l.includes('/refunds')),
    ).toBe(true);
    const bit = await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, admin.token);
    expect(JSON.stringify(bit.datos)).toContain('cancelado_por_soporte');
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/pedidos/${id}/cancelar`,
          { motivo: 'otra vez' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('le quita el pedido al repartidor y vuelve a la fila', async () => {
    const { m, admin, rep, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/pedidos/${id}/soltar-repartidor`,
          { motivo: 'no contesta' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'aceptado', aceptado_en = datetime('now'), repartidor_id = ? WHERE id = ?",
    )
      .bind(rep.id, id)
      .run();
    const r = await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/soltar-repartidor`,
      { motivo: 'no contesta' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const f = await m.DB.prepare('SELECT repartidor_id, estado FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ repartidor_id: string | null; estado: string }>();
    expect(f?.repartidor_id).toBeNull();
    expect(f?.estado).toBe('aceptado');
    const ab = await m.DB.prepare('SELECT motivo FROM abandonos_repartidor WHERE pedido_id = ?')
      .bind(id)
      .first<{ motivo: string }>();
    expect(ab?.motivo).toContain('soporte');
  });

  it('la lista de cerrados busca por número, cliente o restaurante', async () => {
    const { m, admin, pedidoPagado } = await escenario();
    const id = await pedidoPagado();
    await llevarA(m.DB, id, 'entregado');
    const vivos = await m.llamar('GET', '/datos/admin/pedidos', undefined, admin.token);
    expect(vivos.datos.pedidos).toHaveLength(0);
    const cerrados = await m.llamar(
      'GET',
      '/datos/admin/pedidos?cerrados=1&q=ana',
      undefined,
      admin.token,
    );
    expect(cerrados.datos.pedidos.map((p: { id: string }) => p.id)).toEqual([id]);
    const porNumero = await m.llamar(
      'GET',
      `/datos/admin/pedidos?cerrados=1&q=${id.slice(0, 6).toUpperCase()}`,
      undefined,
      admin.token,
    );
    expect(porNumero.datos.pedidos).toHaveLength(1);
    expect(
      (await m.llamar('GET', '/datos/admin/pedidos?cerrados=1&q=nadie', undefined, admin.token))
        .datos.pedidos,
    ).toHaveLength(0);
  });

  it('suspender una cuenta mata sus sesiones y le cierra la entrada; reactivar la devuelve', async () => {
    const { m, admin, cliente } = await escenario();
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, cliente.token)).estado).toBe(200);
    const s = await m.llamar(
      'PATCH',
      `/datos/admin/usuarios/${cliente.id}`,
      { activo: false, motivo: 'fraude' },
      admin.token,
    );
    expect(s.estado).toBe(200);
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, cliente.token)).estado).toBe(401);
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/clientes/${cliente.id}`,
      undefined,
      admin.token,
    );
    expect(ficha.datos.cliente.activo).toBe(false);
    await m.llamar('PATCH', `/datos/admin/usuarios/${cliente.id}`, { activo: true }, admin.token);
    expect(
      (await m.llamar('GET', `/datos/admin/clientes/${cliente.id}`, undefined, admin.token)).datos
        .cliente.activo,
    ).toBe(true);
    expect(
      (await m.llamar('PATCH', `/datos/admin/usuarios/${admin.id}`, { activo: false }, admin.token))
        .estado,
    ).toBe(404);
  });
});
