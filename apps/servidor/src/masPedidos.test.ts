import { describe, expect, it } from 'vitest';
import { contarMasPedidos } from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-MAS-PEDIDOS (2 nov 2026), como «Most Ordered» de DoorDash: el menú público trae los platos más
 * pedidos de los últimos 30 días, solo de pedidos entregados, solo los que hoy se pueden pedir y con
 * un mínimo de tres unidades. Todos los países.
 */
describe('lo más pedido en el menú', () => {
  it('cuenta unidades, ignora lo roto, lo no disponible y lo que no llega al mínimo', () => {
    const l = (x: unknown) => JSON.stringify(x);
    expect(
      contarMasPedidos(
        [
          l([
            { platoId: 'a', cantidad: 2 },
            { platoId: 'b', cantidad: 3 },
          ]),
          l([
            { platoId: 'a', cantidad: 2 },
            { platoId: 'c', cantidad: 2 },
          ]),
          l([{ platoId: 'viejo', cantidad: 9 }]),
          '{roto',
          l({ no: 'lista' }),
        ],
        new Set(['a', 'b', 'c']),
      ),
    ).toEqual(['a', 'b']);
  });

  it('el menú público devuelve masPedidos con los pedidos entregados del mes', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.abrir(dueno.token);
    const crear = async (nombreEs: string) =>
      (
        await m.llamar(
          'POST',
          '/datos/mi-restaurante/platos',
          { nombreEs, precioCentavos: 1000 },
          dueno.token,
        )
      ).datos.plato.id as string;
    const pizza = await crear('Pizza');
    const ensalada = await crear('Ensalada');
    const pedido = (id: string, estado: string, lineas: unknown, dias: number) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en, entregado_en)
         VALUES (?, ?, ?, ?, ?, 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', '200 Calle Prueba', 25.78, -80.2, datetime('now'), datetime('now', ?), datetime('now'))`,
      )
        .bind(id, cliente.id, rid, estado, JSON.stringify(lineas), `-${dias} days`)
        .run();
    await pedido('p1', 'entregado', [{ platoId: pizza, cantidad: 2 }], 1);
    await pedido(
      'p2',
      'entregado',
      [
        { platoId: pizza, cantidad: 1 },
        { platoId: ensalada, cantidad: 1 },
      ],
      3,
    );
    // No cuentan: cancelado, ni de hace más de 30 días.
    await pedido('p3', 'cancelado', [{ platoId: ensalada, cantidad: 5 }], 1);
    await pedido('p4', 'entregado', [{ platoId: ensalada, cantidad: 5 }], 40);
    const menu = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(menu.estado).toBe(200);
    expect(menu.datos.masPedidos).toEqual([pizza]);
  });
});
