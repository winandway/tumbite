import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/** Pantalla de dinero del superadmin (auditoría final, punto 7): rutas de resolución (C-SUPER-DINERO). */
async function conLiquidacion(estadoStripe: string) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (/\/payment_intents\/pi_rev$/.test(String(url)) && (init?.method ?? 'GET') === 'GET')
      return new Response(
        JSON.stringify({ id: 'pi_rev', status: estadoStripe, amount_received: 3400 }),
        { status: 200 },
      );
    if (/\/payment_intents\/pi_rev\/capture$/.test(String(url)))
      return new Response(JSON.stringify({ error: { message: 'card_declined' } }), { status: 402 });
    return new Response('{}', { status: 200 });
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const cliente = await m.cuenta('cliente');
  const admin = await m.cuenta('admin');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  await m.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, entregado_en)
     VALUES ('p-rev', ?, ?, 'entregado', '[]', 3000, 0, 400, 0, 0, 3400, 300, 2700, 0, 0, 100, 'inicial', 'x', datetime('now'))`,
  )
    .bind(cliente.id, r.datos.restaurante.id)
    .run();
  await m.DB.prepare(
    "INSERT INTO liquidaciones (pedido_id, estado, pi, monto, intentos, error) VALUES ('p-rev', 'revision', 'pi_rev', 3400, 6, 'card_declined')",
  ).run();
  return { m, admin, dueno };
}

describe('resolver cobros en revisión y abonos fallidos (C-SUPER-DINERO)', () => {
  it('la lista los muestra; «confirmar» solo anota el cobro si Stripe lo tiene como succeeded', async () => {
    const { m, admin, dueno } = await conLiquidacion('requires_capture');
    const lista = await m.llamar('GET', '/datos/admin/liquidaciones', undefined, admin.token);
    expect(lista.datos.revision.map((l: { pedidoId: string }) => l.pedidoId)).toEqual(['p-rev']);
    expect(
      (await m.llamar('POST', '/datos/admin/liquidaciones/p-rev/confirmar', {}, dueno.token))
        .estado,
    ).toBe(403);
    const no = await m.llamar(
      'POST',
      '/datos/admin/liquidaciones/p-rev/confirmar',
      {},
      admin.token,
    );
    expect(no.estado).toBe(409);
    expect(
      (
        await m.DB.prepare("SELECT estado FROM liquidaciones WHERE pedido_id = 'p-rev'").first<{
          estado: string;
        }>()
      )?.estado,
    ).toBe('revision');
  });

  it('«confirmar» con Stripe en succeeded cierra la liquidación como capturada', async () => {
    const { m, admin } = await conLiquidacion('succeeded');
    const si = await m.llamar(
      'POST',
      '/datos/admin/liquidaciones/p-rev/confirmar',
      {},
      admin.token,
    );
    expect(si.estado).toBe(200);
    expect(si.datos.estado).toBe('capturada');
    expect(
      (
        await m.DB.prepare("SELECT estado FROM liquidaciones WHERE pedido_id = 'p-rev'").first<{
          estado: string;
        }>()
      )?.estado,
    ).toBe('capturada');
  });

  it('«reintentar» vuelve a intentar la captura ya mismo y deja el resultado', async () => {
    const { m, admin } = await conLiquidacion('requires_capture');
    const r = await m.llamar(
      'POST',
      '/datos/admin/liquidaciones/p-rev/reintentar',
      {},
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect(['reintentar', 'revision', 'capturando']).toContain(r.datos.estado);
    const f = await m.DB.prepare(
      "SELECT intentos FROM liquidaciones WHERE pedido_id = 'p-rev'",
    ).first<{ intentos: number }>();
    expect(f?.intentos).toBe(7);
    expect(
      (await m.llamar('POST', '/datos/admin/liquidaciones/no-existe/reintentar', {}, admin.token))
        .estado,
    ).toBe(404);
  });

  it('los abonos fallidos se listan con quién y se marcan resueltos', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    await m.DB.prepare(
      "INSERT INTO abonos_fallidos (id, usuario_id, stripe_cuenta, motivo) VALUES ('a1', ?, 'acct_1', 'account_closed')",
    )
      .bind(dueno.id)
      .run();
    const lista = await m.llamar('GET', '/datos/admin/abonos-fallidos', undefined, admin.token);
    expect(lista.datos.abonos[0]).toMatchObject({
      id: 'a1',
      motivo: 'account_closed',
      resueltoEn: null,
    });
    expect(lista.datos.abonos[0].correo).toContain('@');
    expect(
      (await m.llamar('PATCH', '/datos/admin/abonos-fallidos/a1', { resuelto: true }, admin.token))
        .estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/admin/abonos-fallidos', undefined, admin.token)).datos
        .abonos[0].resueltoEn,
    ).not.toBeNull();
    expect(
      (await m.llamar('PATCH', '/datos/admin/abonos-fallidos/zz', { resuelto: true }, admin.token))
        .estado,
    ).toBe(404);
  });
});
