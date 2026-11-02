import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-AUDITIVA-REPARTIDOR (2 nov 2026), como Uber y DoorDash: el repartidor sordo o con dificultad
 * auditiva lo marca en su app; el cliente y el restaurante del pedido lo ven para escribirle en vez
 * de llamarlo. Nace apagado y solo lo cambia el propio repartidor. Todos los países.
 */
describe('repartidor con dificultad auditiva', () => {
  async function escena() {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    const rep = await m.cuenta('repartidor');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en)
       VALUES ('pa', ?, ?, ?, 'aceptado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', '200 Calle Prueba', 25.78, -80.2, datetime('now'), datetime('now'))`,
    )
      .bind(cliente.id, rid, rep.id)
      .run();
    return { m, dueno, cliente, rep };
  }

  it('nace apagado, el repartidor lo enciende y lo ven el cliente y el restaurante', async () => {
    const { m, dueno, cliente, rep } = await escena();
    expect(
      (await m.llamar('GET', '/datos/repartidor/accesibilidad', undefined, rep.token)).datos,
    ).toEqual({ dificultadAuditiva: false });
    let seg = await m.llamar('GET', '/datos/pedidos/pa/seguimiento', undefined, cliente.token);
    expect(seg.datos.pedido.repartidor.dificultadAuditiva).toBe(false);

    const put = await m.llamar(
      'PUT',
      '/datos/repartidor/accesibilidad',
      { dificultadAuditiva: true },
      rep.token,
    );
    expect(put.estado).toBe(200);
    seg = await m.llamar('GET', '/datos/pedidos/pa/seguimiento', undefined, cliente.token);
    expect(seg.datos.pedido.repartidor.dificultadAuditiva).toBe(true);
    const lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect(lista.datos.pedidos[0].repartidor.dificultadAuditiva).toBe(true);
  });

  it('solo el repartidor puede cambiarlo', async () => {
    const { m, cliente } = await escena();
    const r = await m.llamar(
      'PUT',
      '/datos/repartidor/accesibilidad',
      { dificultadAuditiva: true },
      cliente.token,
    );
    expect(r.estado).toBe(403);
  });
});
