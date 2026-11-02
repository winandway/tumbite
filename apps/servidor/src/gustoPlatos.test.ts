import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-GUSTO-PLATOS (2 nov 2026), como DoorDash: al calificar el pedido, el cliente marca pulgar arriba
 * o abajo en cada plato que pidió; el menú público muestra «Le gustó al N %» con cinco votos o más y
 * el restaurante lo ve en Reseñas. Solo se votan platos que estaban en ese pedido. Todos los países.
 */
describe('gusto por plato', () => {
  async function escena() {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
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
    const entregado = async (id: string, clienteId: string, lineas: unknown) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en, entregado_en)
         VALUES (?, ?, ?, 'entregado', ?, 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', '200 Calle Prueba', 25.78, -80.2, datetime('now'), datetime('now'), datetime('now'))`,
      )
        .bind(id, clienteId, rid, JSON.stringify(lineas))
        .run();
    return { m, dueno, rid, pizza, ensalada, entregado };
  }

  it('guarda los votos, ignora platos ajenos al pedido y el menú muestra el porcentaje con 5 votos', async () => {
    const { m, dueno, rid, pizza, ensalada, entregado } = await escena();
    for (let i = 0; i < 5; i++) {
      const cli = await m.cuenta('cliente');
      await entregado(`p${i}`, cli.id, [{ platoId: pizza, cantidad: 1 }]);
      const r = await m.llamar(
        'POST',
        `/datos/pedidos/p${i}/calificar`,
        {
          estrellasRestaurante: 5,
          // La ensalada no estaba en el pedido: no cuenta.
          platos: [
            { platoId: pizza, gusta: i < 4 },
            { platoId: ensalada, gusta: true },
          ],
        },
        cli.token,
      );
      expect(r.estado).toBe(200);
    }
    const menu = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(menu.datos.gustoPlatos).toEqual({ [pizza]: { porcentaje: 80, votos: 5 } });

    const resenas = await m.llamar('GET', '/datos/mi-restaurante/resenas', undefined, dueno.token);
    expect(resenas.datos.platos).toEqual([
      { platoId: pizza, nombreEs: 'Pizza', nombreEn: 'Pizza', porcentaje: 80, votos: 5 },
    ]);
  });

  it('calificar otra vez reemplaza los votos de ese pedido, no los suma', async () => {
    const { m, rid, pizza, entregado } = await escena();
    const cli = await m.cuenta('cliente');
    await entregado('px', cli.id, [{ platoId: pizza, cantidad: 1 }]);
    for (const gusta of [true, false])
      await m.llamar(
        'POST',
        '/datos/pedidos/px/calificar',
        { estrellasRestaurante: 4, platos: [{ platoId: pizza, gusta }] },
        cli.token,
      );
    const fila = await m.DB.prepare(
      'SELECT COUNT(*) AS n, MIN(gusta) AS g FROM calificaciones_platos WHERE pedido_id = ?',
    )
      .bind('px')
      .first<{ n: number; g: number }>();
    expect(fila).toEqual({ n: 1, g: 0 });
    const menu = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    expect(menu.datos.gustoPlatos).toEqual({});
  });

  it('sin platos en el cuerpo, la calificación funciona como siempre', async () => {
    const { m, pizza, entregado } = await escena();
    const cli = await m.cuenta('cliente');
    await entregado('py', cli.id, [{ platoId: pizza, cantidad: 1 }]);
    const r = await m.llamar(
      'POST',
      '/datos/pedidos/py/calificar',
      { estrellasRestaurante: 5 },
      cli.token,
    );
    expect(r.estado).toBe(200);
  });
});
