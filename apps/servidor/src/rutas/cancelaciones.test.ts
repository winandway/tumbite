import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, llevarA, mundo } from '../pruebas/ayuda';

/**
 * C-CANCELAR-LISTO (10 nov 2026, punto D1) — todos los países. Un pedido ya «listo» no lo cancela
 * el restaurante por su cuenta: pide la cancelación a soporte con un motivo de la lista, y el
 * motivo dice quién asume la comida (regla de DoorDash; motivos de Uber Eats).
 */
afterEach(() => vi.unstubAllGlobals());

async function escena() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_s', status: 'canceled' }), {
        status: 200,
      }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
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
  async function pedidoEn(estado: string) {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare("UPDATE pedidos SET stripe_pago = 'pi_1' WHERE id = ?").bind(id).run();
    await llevarA(m.DB, id, estado);
    return id;
  }
  const pedir = (id: string, cuerpo: unknown, token = dueno.token) =>
    m.llamar('POST', `/datos/restaurante/pedidos/${id}/pedir-cancelacion`, cuerpo, token);
  const estadoDe = async (id: string) =>
    (await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first<{
      estado: string;
    }>())!.estado;
  return { m, dueno, admin, pedidoEn, pedir, estadoDe };
}

describe('pedir a soporte la cancelación de un pedido listo (C-CANCELAR-LISTO)', () => {
  it('el restaurante sigue sin poder cancelarlo solo, pero ahora puede pedirlo con motivo', async () => {
    const e = await escena();
    const id = await e.pedidoEn('listo');
    const directo = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/rechazar`,
      {},
      e.dueno.token,
    );
    expect(directo.estado).toBe(409);
    const r = await e.pedir(id, { motivo: 'agotado', detalle: 'Se acabó el pan.' });
    expect(r.estado).toBe(201);
    expect(r.datos.solicitud).toMatchObject({
      pedidoId: id,
      motivo: 'agotado',
      pagaComida: 'restaurante',
      estado: 'pendiente',
    });
    // El pedido NO se cancela todavía: lo decide soporte.
    expect(await e.estadoDe(id)).toBe('listo');
    // Queda un caso de soporte con el pedido, en prioridad alta.
    const caso = await e.m.DB.prepare(
      'SELECT tipo, prioridad, pedido_id FROM tickets WHERE pedido_id = ?',
    )
      .bind(id)
      .first();
    expect(caso).toMatchObject({ tipo: 'soporte', prioridad: 'alta', pedido_id: id });
  });

  it('exige un motivo de la lista, solo para pedidos listos, y no se duplica', async () => {
    const e = await escena();
    const listo = await e.pedidoEn('listo');
    expect((await e.pedir(listo, { motivo: 'porque sí' })).estado).toBe(400);
    expect((await e.pedir(listo, { motivo: 'otro' })).estado).toBe(400); // «otro» pide el detalle
    expect((await e.pedir(listo, { motivo: 'otro', detalle: 'Se fue la luz.' })).estado).toBe(201);
    expect((await e.pedir(listo, { motivo: 'agotado' })).estado).toBe(409);
    const aceptado = await e.pedidoEn('aceptado');
    expect((await e.pedir(aceptado, { motivo: 'agotado' })).estado).toBe(409);
    const enCamino = await e.pedidoEn('en_camino');
    expect((await e.pedir(enCamino, { motivo: 'agotado' })).estado).toBe(409);
  });

  it('el motivo dice quién asume la comida: si la causa no es del restaurante, el restaurante cobra', async () => {
    const e = await escena();
    const a = await e.pedidoEn('listo');
    const b = await e.pedidoEn('listo');
    expect((await e.pedir(a, { motivo: 'cliente_pidio' })).datos.solicitud.pagaComida).toBe(
      'cliente',
    );
    expect((await e.pedir(b, { motivo: 'repartidor_no_llego' })).datos.solicitud.pagaComida).toBe(
      'divoox',
    );
    const mias = await e.m.llamar(
      'GET',
      '/datos/restaurante/cancelaciones',
      undefined,
      e.dueno.token,
    );
    expect(mias.datos.solicitudes.map((s: { pedidoId: string }) => s.pedidoId).sort()).toEqual(
      [a, b].sort(),
    );
  });

  it('soporte la aprueba: el pedido se cancela, el cliente recibe su dinero y queda quién asume la comida', async () => {
    const e = await escena();
    const id = await e.pedidoEn('listo');
    const s = await e.pedir(id, { motivo: 'repartidor_no_llego' });
    const cola = await e.m.llamar('GET', '/datos/admin/cancelaciones', undefined, e.admin.token);
    expect(cola.datos.solicitudes[0]).toMatchObject({ pedidoId: id, estado: 'pendiente' });
    const ok = await e.m.llamar(
      'POST',
      `/datos/admin/cancelaciones/${s.datos.solicitud.id}/aprobar`,
      { nota: 'Confirmado con el local.' },
      e.admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(await e.estadoDe(id)).toBe('cancelado');
    const fila = await e.m.DB.prepare(
      'SELECT estado, paga_comida, nota_soporte FROM solicitudes_cancelacion WHERE id = ?',
    )
      .bind(s.datos.solicitud.id)
      .first();
    expect(fila).toEqual({
      estado: 'aprobada',
      paga_comida: 'divoox',
      nota_soporte: 'Confirmado con el local.',
    });
    const evento = await e.m.DB.prepare(
      "SELECT detalle FROM bitacora_pedidos WHERE pedido_id = ? AND evento = 'cancelado_por_soporte'",
    )
      .bind(id)
      .first<{ detalle: string }>();
    expect(evento?.detalle).toContain('repartidor_no_llego');
    // C-DECISIONES-MERCADO: la regla del mercado queda calculada (Divoox le paga la comida al
    // restaurante y el cliente recupera todo). Hoy el dinero que se mueve sigue siendo el reembolso
    // completo al cliente; el pago de la comida queda anotado para conciliarlo.
    const p = (await e.m.DB.prepare('SELECT total, subtotal FROM pedidos WHERE id = ?')
      .bind(id)
      .first<{ total: number; subtotal: number }>())!;
    expect(ok.datos.reparto).toEqual({
      reembolsoCliente: p.total,
      comidaAlRestaurante: p.subtotal,
      asumeComida: 'divoox',
    });
    expect(evento?.detalle).toContain(`comida al restaurante ${p.subtotal}`);
  });

  it('soporte la rechaza: el pedido sigue su curso y el restaurante puede volver a pedirla', async () => {
    const e = await escena();
    const id = await e.pedidoEn('listo');
    const s = await e.pedir(id, { motivo: 'agotado' });
    const no = await e.m.llamar(
      'POST',
      `/datos/admin/cancelaciones/${s.datos.solicitud.id}/rechazar`,
      { nota: 'El repartidor ya está en la puerta.' },
      e.admin.token,
    );
    expect(no.estado).toBe(200);
    expect(await e.estadoDe(id)).toBe('listo');
    expect((await e.pedir(id, { motivo: 'local_cerrado' })).estado).toBe(201);
  });

  it('otro restaurante no puede pedir la cancelación de un pedido ajeno', async () => {
    const e = await escena();
    const id = await e.pedidoEn('listo');
    const otro = await e.m.cuenta('restaurante');
    await e.m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Otro Local' },
      otro.token,
    );
    expect((await e.pedir(id, { motivo: 'agotado' }, otro.token)).estado).toBe(404);
  });
});
