import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_DINERO_INICIAL, calcularPedido } from '@tumbite/compartido';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { conciliar } from './conciliacion';
import { recalcularConDescuentos } from './descuentosPedido';

/**
 * C-ENVIO-UNA-VEZ (BRE-R3, 2 nov 2026): el envío se descuenta una sola vez. Con Divoox Plus el
 * envío ya va en cero, así que un cupón de «envío gratis» no tiene nada que descontar: se rechaza al
 * aplicarlo en el carrito y al crear el pedido (como DoorDash con DashPass), y un pedido viejo que
 * los tenga a los dos se recalcula con el cupón en cero. Antes los dos descontaban el envío: un
 * pedido de 30,00 + envío + servicio + propina 3,00 cobraba 30,00 y Divoox quedaba en negativo.
 * EE. UU. (Plus y cupones solo existen en dólares).
 */
afterEach(() => vi.unstubAllGlobals());

async function escena() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_s' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin', 'Soporte Envío');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = (
    await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Paella', precioCentavos: 1500 },
      dueno.token,
    )
  ).datos.plato.id as string;
  await m.abrir(dueno.token);
  await m.llamar(
    'POST',
    '/datos/admin/cupones',
    { codigo: 'ENVIO', tipo: 'envio_gratis', usosPorCliente: 9 },
    admin.token,
  );
  const darPlus = async () => {
    await m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('plus', ?)")
      .bind(JSON.stringify({ centavosMes: 999, minimoSubtotal: 1200, servicioDescuentoPct: 50 }))
      .run();
    await m.DB.prepare(
      "INSERT INTO suscripciones_plus (usuario_id, stripe_suscripcion, estado, vence_en) VALUES (?, 'sub_x', 'activa', datetime('now', '+30 days'))",
    )
      .bind(cliente.id)
      .run();
  };
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato, cantidad: 2 }],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      cliente.token,
    );
  const validar = (envio: number) =>
    m.llamar(
      'POST',
      '/datos/cupones/validar',
      { codigo: 'ENVIO', restauranteId: rid, subtotal: 3000, envio },
      cliente.token,
    );
  return { m, dueno, cliente, rid, darPlus, pedir, validar };
}

describe('el envío se descuenta una sola vez (C-ENVIO-UNA-VEZ)', () => {
  it('Plus + cupón de envío gratis: el cupón se rechaza y el reparto cuadra', async () => {
    const e = await escena();
    // Sin Plus el cupón de envío gratis vale lo que vale el envío.
    const soloCupon = await e.pedir({ cupon: 'ENVIO' });
    expect(soloCupon.estado).toBe(201);
    const envio = soloCupon.datos.desglose.envio as number;
    expect(envio).toBeGreaterThan(0);
    expect(soloCupon.datos.desglose.descuento).toBe(envio);

    await e.darPlus();
    // En el carrito: el cupón ya no tiene envío que descontar.
    const v = await e.validar(envio);
    expect(v.estado).toBe(409);
    expect(v.datos.campo).toBe('cupon');
    // En una recogida (sin envío) Plus no cubre nada y el cupón se puede validar (vale 0).
    expect((await e.validar(0)).estado).toBe(200);

    // Al crear: el servidor tampoco lo acepta, aunque la app lo mande.
    const doble = await e.pedir({ cupon: 'ENVIO' });
    expect(doble.estado).toBe(409);
    expect(doble.datos.campo).toBe('cupon');
    const usos = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM usos_cupon WHERE codigo = 'ENVIO'",
    ).first<{ n: number }>();
    expect(usos?.n).toBe(1);

    // Solo Plus: envío una vez + la mitad del servicio, y el total es el del pedido menos eso.
    const p = await e.pedir();
    expect(p.estado).toBe(201);
    const d = p.datos.desglose;
    expect(d.descuento).toBe(d.envio + Math.round(d.servicio / 2));
    expect(d.totalCliente).toBe(
      d.subtotal +
        d.envio +
        d.servicio +
        d.cargoPedidoPequeno +
        d.impuesto +
        d.propina -
        d.descuento,
    );
    expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma + d.impuesto).toBe(
      d.totalCliente,
    );

    // Se entrega y la conciliación del día cuadra.
    const id = p.datos.pedidoId as string;
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    const rep = await e.m.cuenta('repartidor', 'Rita Envío');
    await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 5 },
      e.dueno.token,
    );
    await e.m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    await e.m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
    await e.m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, e.dueno.token);
    await e.m.recoger(id, rep.token, e.dueno.token);
    expect((await e.m.entregar(id, rep.token)).estado).toBe(200);
    const c = await conciliar(e.m.DB, new Date().toISOString().slice(0, 10));
    expect(c.detalle.cuadraRestaurantes).toBe('sí');
    expect(c.detalle.cuadraRepartidores).toBe('sí');
  });

  it('un pedido viejo con Plus y cupón de envío gratis se recalcula con el envío una sola vez', async () => {
    // La pieza de recálculo lee de la base solo los descuentos guardados (y los ajustes de Plus).
    const guardados = { plus: 499, regalo: null, tipo: 'envio_gratis', valor: 0 };
    const db = {
      prepare(sql: string) {
        const st = {
          bind: () => st,
          first: async () => (sql.includes("clave = 'plus'") ? null : guardados),
        };
        return st;
      },
    } as unknown as D1Database;
    const p = {
      lineas: [{ precioCentavos: 1500, cantidad: 2 }],
      plan: 'inicial' as const,
      propina: 300,
      distanciaKm: 6,
      config: CONFIG_DINERO_INICIAL,
    };
    const sinNada = calcularPedido(p);
    expect(sinNada.envio).toBeGreaterThan(0);
    const r = await recalcularConDescuentos(
      db,
      { id: 'p1', cupon: 'ENVIO', descuento: 898 },
      p,
      null,
    );
    expect(r.cupon).toBe(0);
    expect(r.plus).toBe(sinNada.envio + Math.round(sinNada.servicio / 2));
    expect(r.desglose.descuento).toBe(r.plus);
    expect(r.desglose.totalCliente).toBe(sinNada.totalCliente - r.plus);
    const d = r.desglose;
    expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma + d.impuesto).toBe(
      d.totalCliente,
    );
  });
});
