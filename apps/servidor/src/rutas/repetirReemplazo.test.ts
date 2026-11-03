import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * LAN-5 · C-TIENDAS-REEMPLAZO-ELEGIDO: «Pedir otra vez» después de un reemplazo devuelve al carrito
 * el producto que el cliente pidió COMO lo pidió (con sus opciones), y si no está ni el original ni
 * el reemplazo, «faltan» nombra lo que pidió (el original). Sin cambios en el cobro ni el reparto.
 */
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  vi.stubGlobal('fetch', async () =>
    Response.json({ id: 'pi_1', client_secret: 'x', status: 'requires_capture' }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = async (nombreEs: string, nombreEn: string, precioCentavos: number) =>
    (
      await m.llamar(
        'POST',
        '/datos/mi-restaurante/platos',
        { nombreEs, nombreEn, precioCentavos },
        dueno.token,
      )
    ).datos.plato.id as string;
  const pizza = await plato('Pizza', 'Pizza', 1400);
  const calzone = await plato('Calzone', 'Calzone', 1600);
  const g = await m.llamar(
    'PUT',
    `/datos/mi-restaurante/platos/${pizza}/opciones`,
    {
      grupos: [
        {
          nombreEs: 'Extras',
          nombreEn: 'Extras',
          minimo: 0,
          maximo: 2,
          opciones: [{ nombreEs: 'Extra queso', nombreEn: 'Extra cheese', precioCentavos: 150 }],
        },
      ],
    },
    dueno.token,
  );
  const queso = g.datos.plato.grupos[0].opciones[0].id as string;
  await m.abrir(dueno.token);
  const p = await m.llamar(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: rid,
      lineas: [{ platoId: pizza, cantidad: 1, opciones: [queso], nota: 'bien cocida' }],
      propinaCentavos: 0,
      direccion: '300 Calle Prueba',
      lat: 25.78,
      lng: -80.2,
    },
    cliente.token,
  );
  expect(p.estado, JSON.stringify(p.datos)).toBe(201);
  const id = p.datos.pedidoId as string;
  await m.DB.prepare(
    "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
  )
    .bind(id)
    .run();
  return { m, dueno, cliente, id, pizza, calzone, queso };
}

describe('LAN-5 · «Pedir otra vez» tras un reemplazo', () => {
  it('guarda las opciones del original, lo devuelve al carrito con ellas y «faltan» nombra el original', async () => {
    const e = await escenario();
    const antes = await e.m.DB.prepare('SELECT total, pago_restaurante FROM pedidos WHERE id = ?')
      .bind(e.id)
      .first<{ total: number; pago_restaurante: number }>();
    const falta = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${e.id}/falta`,
      { platoId: e.pizza, propuestas: [e.calzone] },
      e.dueno.token,
    );
    expect(falta.estado, JSON.stringify(falta.datos)).toBe(200);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/pedidos/${e.id}/ajuste`,
          { decision: 'reemplazar', platoId: e.calzone },
          e.cliente.token,
        )
      ).estado,
    ).toBe(200);
    const fila = await e.m.DB.prepare(
      'SELECT lineas_json, total, pago_restaurante FROM pedidos WHERE id = ?',
    )
      .bind(e.id)
      .first<{ lineas_json: string; total: number; pago_restaurante: number }>();
    const linea = (JSON.parse(fila!.lineas_json) as Record<string, unknown>[])[0]!;
    expect(linea.platoId).toBe(e.calzone);
    expect(linea.original).toMatchObject({
      platoId: e.pizza,
      nombreEs: 'Pizza',
      opciones: [expect.objectContaining({ id: e.queso })],
    });
    // El reemplazo cuesta más: se cobra lo mismo que el original; el cobro y el reparto no cambian.
    expect(fila!.total).toBe(antes!.total);
    expect(fila!.pago_restaurante).toBe(antes!.pago_restaurante);

    const repetir = async () =>
      (await e.m.llamar('GET', `/datos/pedidos/${e.id}/repetir`, undefined, e.cliente.token))
        .datos as {
        lineas: { platoId: string; opciones: { id: string }[]; nota?: string }[];
        faltan: { nombreEs: string; nombreEn: string }[];
      };
    let r = await repetir();
    expect(r.faltan).toEqual([]);
    expect(r.lineas[0]!.platoId).toBe(e.pizza);
    expect(r.lineas[0]!.opciones.map((o) => o.id)).toEqual([e.queso]);
    expect(r.lineas[0]!.nota).toBe('bien cocida');

    // Ni la pizza ni el calzone: «faltan» dice lo que el cliente pidió.
    await e.m.DB.prepare('UPDATE platos SET disponible = 0 WHERE id IN (?, ?)')
      .bind(e.pizza, e.calzone)
      .run();
    r = await repetir();
    expect(r.lineas).toEqual([]);
    expect(r.faltan).toEqual([{ nombreEs: 'Pizza', nombreEn: 'Pizza' }]);
  });
});
