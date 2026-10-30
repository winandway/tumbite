import { describe, expect, it } from 'vitest';
import { mundo, RESTAURANTE_BASE } from '../pruebas/ayuda';
import { celdaCsv } from './informes';

// C-INFORMES: por rango de fechas, por ciudad y moneda, en pantalla y en CSV.
describe('C-INFORMES', () => {
  it('suma entregados y cancelados del rango, y solo el equipo lo ve', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    const meter = (id: string, estado: string, subtotal: number, ganancia: number) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
           pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda, creado_en)
         VALUES (?, ?, ?, ?, '[]', ?, 399, 199, 0, 200, ?, 0, 0, 0, 0, ?, 'inicial', '', '', 'US-FL-MIAMI', 'USD', '2026-10-20 15:00:00')`,
      )
        .bind(id, cliente.id, rid, estado, subtotal, subtotal + 798, ganancia)
        .run();
    await meter('p1', 'entregado', 2000, 300);
    await meter('p2', 'cancelado', 1000, 0);
    const r = await m.llamar(
      'GET',
      '/datos/admin/informes?desde=2026-10-01&hasta=2026-10-31',
      undefined,
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.filas).toEqual([
      expect.objectContaining({
        zona: 'US-FL-MIAMI',
        moneda: 'USD',
        pedidos: 2,
        entregados: 1,
        cancelados: 1,
        ventas: 2000,
        plataforma: 300,
      }),
    ]);
    const fuera = await m.llamar(
      'GET',
      '/datos/admin/informes?desde=2026-11-01&hasta=2026-11-30',
      undefined,
      admin.token,
    );
    expect(fuera.datos.filas).toEqual([]);
    const csv = await m.crudo(
      '/datos/admin/informes?desde=2026-10-01&hasta=2026-10-31&formato=csv',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${admin.token}` },
      },
    );
    expect(csv.headers.get('content-type')).toMatch(/text\/csv/);
    const texto = await csv.text();
    expect(texto.split('\n')[0]).toBe(
      'zona,ciudad,moneda,pedidos,entregados,cancelados,ventas,cobrado,propinas,plataforma',
    );
    expect(texto.split('\n')).toHaveLength(2);
    expect(
      (
        await m.llamar(
          'GET',
          '/datos/admin/informes?desde=2026-10-01&hasta=2026-10-31',
          undefined,
          cliente.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await m.llamar(
          'GET',
          '/datos/admin/informes?desde=2026-10-31&hasta=2026-10-01',
          undefined,
          admin.token,
        )
      ).estado,
    ).toBe(400);
  });

  // C-EMBUDO: iniciados → pagados → aceptados → entregados, con sus porcentajes.
  it('el embudo cuenta cada paso del pedido y su porcentaje', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const dueno = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    const meter = (id: string, estado: string, pagado: boolean, aceptado: boolean) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
           pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda, creado_en, pagado_en, aceptado_en)
         VALUES (?, ?, ?, ?, '[]', 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 'inicial', '', '', 'US-FL-MIAMI', 'USD', '2026-10-20 15:00:00', ?, ?)`,
      )
        .bind(
          id,
          cliente.id,
          rid,
          estado,
          pagado ? '2026-10-20 15:01:00' : null,
          aceptado ? '2026-10-20 15:02:00' : null,
        )
        .run();
    await meter('e1', 'pago_pendiente', false, false);
    await meter('e2', 'cancelado', true, false);
    await meter('e3', 'cancelado', true, true);
    await meter('e4', 'entregado', true, true);
    const r = await m.llamar(
      'GET',
      '/datos/admin/informes?desde=2026-10-01&hasta=2026-10-31',
      undefined,
      admin.token,
    );
    expect(r.datos.embudo).toEqual({
      iniciados: 4,
      pagados: 3,
      aceptados: 2,
      entregados: 1,
      pagoPct: 75,
      aceptacionPct: 66.7,
      entregaPct: 50,
    });
  });

  it('una celda nunca se vuelve fórmula ni rompe la fila', () => {
    expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celdaCsv('Miami, FL')).toBe('"Miami, FL"');
    expect(celdaCsv(-300)).toBe('-300');
  });
});
