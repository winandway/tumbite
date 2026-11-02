import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-PLANILLA-PEDIDOS (2 nov 2026), como el reporte de pedidos de Uber Eats Manager: el dueño o un
 * manager descarga sus pedidos de un rango de fechas en una planilla (CSV), con lo que vendió y lo
 * que cobra. Sin datos del cliente. Celdas seguras para la hoja de cálculo. Todos los países.
 */
describe('planilla de pedidos del restaurante', () => {
  async function escena() {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const otro = await m.cuenta('restaurante');
    const cliente = await m.cuenta('cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Otro local' },
      otro.token,
    );
    const pedido = (id: string, estado: string, cuando: string, lineas: unknown) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, creado_en, pagado_en)
         VALUES (?, ?, ?, ?, ?, 2550, 200, 100, 0, 100, 2950, 383, 2167, 400, 0, 0, 'basico', '200 Calle Prueba', 25.78, -80.2, ?, ?)`,
      )
        .bind(id, cliente.id, rid, estado, JSON.stringify(lineas), cuando, cuando)
        .run();
    await pedido('abcdef01', 'entregado', '2026-10-10 15:00:00', [
      { platoId: 'x', cantidad: 2 },
      { platoId: 'y', cantidad: 1 },
    ]);
    await pedido('abcdef02', 'cancelado', '2026-10-11 15:00:00', [{ platoId: 'x', cantidad: 1 }]);
    await pedido('abcdef03', 'entregado', '2026-09-01 15:00:00', [{ platoId: 'x', cantidad: 1 }]);
    return { m, dueno, otro };
  }

  it('descarga los pedidos del rango con montos legibles y sin datos del cliente', async () => {
    const { m, dueno } = await escena();
    const r = await m.crudo(
      '/datos/mi-restaurante/pedidos/planilla?desde=2026-10-01&hasta=2026-10-31',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${dueno.token}` },
      },
    );
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/csv/);
    const texto = await r.text();
    const filas = texto.trim().split('\n');
    expect(filas[0]).toBe(
      'fecha,pedido,estado,articulos,moneda,subtotal,comision,tu_pago,propina_repartidor',
    );
    expect(filas).toHaveLength(3);
    expect(filas[1]).toBe('2026-10-11 15:00:00,ABCDEF,cancelado,1,USD,25.50,3.83,21.67,1.00');
    expect(filas[2]).toBe('2026-10-10 15:00:00,ABCDEF,entregado,3,USD,25.50,3.83,21.67,1.00');
    expect(texto).not.toContain('Calle Prueba');
  });

  it('pide un rango válido y no muestra pedidos de otro restaurante', async () => {
    const { m, otro } = await escena();
    const mal = await m.llamar(
      'GET',
      '/datos/mi-restaurante/pedidos/planilla?desde=2026-10-31&hasta=2026-10-01',
      undefined,
      otro.token,
    );
    expect(mal.estado).toBe(400);
    const r = await m.crudo(
      '/datos/mi-restaurante/pedidos/planilla?desde=2026-10-01&hasta=2026-10-31',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${otro.token}` },
      },
    );
    expect((await r.text()).trim().split('\n')).toHaveLength(1);
  });
});
