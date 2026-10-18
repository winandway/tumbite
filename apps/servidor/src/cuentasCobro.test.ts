import { describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import { enmascarar } from './internacional/cuentasCobro';

/** B.5: cuentas del repartidor para transferencias del cliente (C-CUENTAS-COBRO). */
describe('cuentas de cobro del repartidor (C-CUENTAS-COBRO)', () => {
  it('el alta exige la contraseña, avisa por correo, deja historial y entra en vigor a las 24 h (o antes si el equipo la confirma)', async () => {
    const enviados: string[] = [];
    usarTransporteCorreo(async (_e, init) => {
      enviados.push((JSON.parse(String(init.body)) as { subject: string }).subject);
      return new Response('{"ok":true}', { status: 200 });
    });
    const m = mundo({ YAD_TOKEN: 'x'.repeat(40) });
    const rep = await m.cuenta('repartidor', 'Rafa Rep');
    const admin = await m.cuenta('admin');
    const mala = await m.llamar(
      'POST',
      '/datos/repartidor/cuentas-cobro',
      { clave: 'otra', tipo: 'nequi', titular: 'Rafael Pérez', identificador: '3001234567' },
      rep.token,
    );
    expect(mala.estado).toBe(403);
    enviados.length = 0;
    const ok = await m.llamar(
      'POST',
      '/datos/repartidor/cuentas-cobro',
      {
        clave: 'clave-segura-1',
        tipo: 'nequi',
        titular: 'Rafael Pérez',
        identificador: '3001234567',
      },
      rep.token,
    );
    expect(ok.estado).toBe(201);
    expect(ok.datos.cuenta.vigente).toBe(false);
    expect(enviados.some((s) => /cuenta de cobro|payout account/i.test(s))).toBe(true);
    const lista = await m.llamar('GET', '/datos/repartidor/cuentas-cobro', undefined, rep.token);
    expect(lista.datos.cuentas).toHaveLength(1);
    expect(lista.datos.historial[0].cambio).toContain('alta nequi');
    expect(lista.datos.historial[0].cambio).toContain(enmascarar('3001234567'));
    await m.llamar('PATCH', `/datos/admin/cuentas-cobro/${ok.datos.cuenta.id}`, {}, admin.token);
    const despues = await m.llamar('GET', '/datos/repartidor/cuentas-cobro', undefined, rep.token);
    expect(despues.datos.cuentas[0]).toMatchObject({ vigente: true, verificacion: 'confirmada' });
    // Una cuenta nueva desactiva la anterior y queda en el historial.
    const otra = await m.llamar(
      'POST',
      '/datos/repartidor/cuentas-cobro',
      {
        clave: 'clave-segura-1',
        tipo: 'banco',
        banco: 'Bancolombia',
        titular: 'Rafael Pérez',
        identificador: '00012345678',
      },
      rep.token,
    );
    expect(otra.estado).toBe(201);
    const final = await m.llamar('GET', '/datos/repartidor/cuentas-cobro', undefined, rep.token);
    expect(final.datos.cuentas.filter((c: { activa: boolean }) => c.activa)).toHaveLength(1);
    expect(
      final.datos.historial.some((h: { cambio: string }) =>
        /desactivada por una cuenta nueva/.test(h.cambio),
      ),
    ).toBe(true);
    usarTransporteCorreo(null);
  });

  it('el cliente de un pedido por transferencia ve el nombre del beneficiario y la cuenta vigente; nadie más', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente', 'Ana Cliente');
    const otro = await m.cuenta('cliente', 'Otro Cliente');
    const rep = await m.cuenta('repartidor', 'Rafa Rep');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${r.datos.restaurante.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const plato = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Cubano', precioCentavos: 1500 },
      dueno.token,
    );
    await m.abrir(dueno.token);
    await m.llamar(
      'PUT',
      '/datos/admin/paises/US',
      { transferenciaRepartidorActiva: true },
      admin.token,
    );
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: r.datos.restaurante.id,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle',
        lat: 25.775,
        lng: -80.195,
        metodoPago: 'transferencia_repartidor',
      },
      cliente.token,
    );
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    const cu = await m.llamar(
      'POST',
      '/datos/repartidor/cuentas-cobro',
      {
        clave: 'clave-segura-1',
        tipo: 'pago_movil',
        banco: 'Mercantil',
        titular: 'Rafael Pérez',
        identificador: '04141234567',
      },
      rep.token,
    );
    await m.llamar('PATCH', `/datos/admin/cuentas-cobro/${cu.datos.cuenta.id}`, {}, admin.token);
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'aceptado', aceptado_en = datetime('now'), repartidor_id = ? WHERE id = ?",
    )
      .bind(rep.id, id)
      .run();
    const seg = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, cliente.token);
    expect(seg.datos.pedido.cuentaCobro).toMatchObject({
      tipo: 'pago_movil',
      banco: 'Mercantil',
      titular: 'Rafael Pérez',
      identificador: '04141234567',
      verificacion: 'confirmada',
    });
    expect(seg.datos.pedido.metodoPago).toBe('transferencia_repartidor');
    const ajeno = await m.llamar('GET', `/datos/pedidos/${id}/seguimiento`, undefined, otro.token);
    expect(ajeno.datos?.pedido?.cuentaCobro ?? null).toBeNull();
    // Disputa del cliente: abre un ticket de queja ligado al pedido.
    const d = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/disputa-cobro`,
      { motivo: 'Transferí y el repartidor dice que no le llegó' },
      cliente.token,
    );
    expect(d.estado).toBe(201);
    const t = await m.DB.prepare('SELECT tipo, pedido_id FROM tickets WHERE id = ?')
      .bind(d.datos.ticket.id)
      .first<{ tipo: string; pedido_id: string }>();
    expect(t).toMatchObject({ tipo: 'queja', pedido_id: id });
  });
});
