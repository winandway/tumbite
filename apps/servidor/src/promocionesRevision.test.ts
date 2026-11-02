import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * BRE-R2 (2 nov 2026), arreglos de dinero que pidió el revisor de calidad para BRE-5:
 * 1. La promoción «envío gratis» del restaurante no paga otra vez el envío que ya cubren Divoox
 *    Plus o un cupón de envío gratis (antes Divoox quedaba en negativo).
 * 2. Un recálculo por plato agotado nunca sube el total cobrado: la promoción ya aplicada se
 *    mantiene aunque el subtotal baje de su mínimo, y el cargo por pedido pequeño que aparezca lo
 *    absorbe Divoox (si no, la captura de Stripe por más de lo autorizado falla).
 * EE. UU. (Plus, cupones y promociones con tarjeta solo existen en dólares hoy).
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
  const admin = await m.cuenta('admin', 'Soporte Revisión');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = async (nombreEs: string, precioCentavos: number) => {
    const id = (
      await m.llamar(
        'POST',
        '/datos/mi-restaurante/platos',
        { nombreEs, precioCentavos },
        dueno.token,
      )
    ).datos.plato.id as string;
    await m.abrir(dueno.token);
    return id;
  };
  await m.llamar('PUT', '/datos/admin/promociones', { encendidas: true }, admin.token);
  const promo = (cuerpo: Record<string, unknown>) =>
    m.llamar(
      'POST',
      '/datos/mi-restaurante/promociones',
      { iniciaEn: '2020-01-01', venceEn: '2099-01-01', ...cuerpo },
      dueno.token,
    );
  const pedir = (lineas: { platoId: string; cantidad: number }[], extra = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas,
        propinaCentavos: 0,
        direccion: '900 Calle Lejos',
        lat: 25.84,
        lng: -80.19,
        ...extra,
      },
      cliente.token,
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
  const pagar = (id: string) =>
    m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
  const quitar = async (id: string, platoId: string) => {
    const falta = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/falta`,
      { platoId },
      dueno.token,
    );
    expect(falta.estado).toBe(200);
    const r = await m.llamar(
      'POST',
      `/datos/pedidos/${id}/ajuste`,
      { decision: 'quitar' },
      cliente.token,
    );
    expect(r.estado).toBe(200);
    return falta.datos.devolucion as number;
  };
  const fila = (id: string) =>
    m.DB.prepare(
      'SELECT total, descuento, impuesto, pago_restaurante, pago_repartidor, ganancia, (SELECT descuento FROM pedidos_promocion WHERE pedido_id = pedidos.id) AS promo FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<{
        total: number;
        descuento: number;
        impuesto: number;
        pago_restaurante: number;
        pago_repartidor: number;
        ganancia: number;
        promo: number | null;
      }>();
  return { m, admin, dueno, cliente, plato, promo, pedir, darPlus, pagar, quitar, fila };
}

describe('BRE-R2: dinero de las promociones del restaurante', () => {
  it('con Divoox Plus, la promoción «envío gratis» no paga el envío otra vez', async () => {
    const e = await escena();
    const comida = await e.plato('Paella', 1500);
    await e.darPlus();
    const sin = (await e.pedir([{ platoId: comida, cantidad: 2 }])).datos.desglose;
    expect(sin.envio).toBeGreaterThan(0);
    await e.promo({ tipo: 'envio_gratis' });
    const con = await e.pedir([{ platoId: comida, cantidad: 2 }]);
    expect(con.estado).toBe(201);
    const d = con.datos.desglose;
    expect(d.descuentoRestaurante).toBe(0);
    expect(d.totalCliente).toBe(sin.totalCliente);
    expect(d.gananciaPlataforma).toBe(sin.gananciaPlataforma);
    expect(d.pagoRestaurante).toBe(sin.pagoRestaurante);
  });

  it('con un cupón de envío gratis, tampoco; y un porcentaje del restaurante sí se suma', async () => {
    const e = await escena();
    const comida = await e.plato('Paella', 1500);
    await e.m.llamar(
      'POST',
      '/datos/admin/cupones',
      { codigo: 'ENVIO', tipo: 'envio_gratis', usosPorCliente: 9 },
      e.admin.token,
    );
    await e.promo({ tipo: 'envio_gratis' });
    const con = (await e.pedir([{ platoId: comida, cantidad: 2 }], { cupon: 'ENVIO' })).datos
      .desglose;
    expect(con.descuento).toBe(con.envio);
    expect(con.descuentoRestaurante).toBe(0);
    // Con una de porcentaje además, gana la que de verdad ahorra algo.
    await e.promo({ tipo: 'porcentaje', valor: 1000 });
    const pct = (await e.pedir([{ platoId: comida, cantidad: 2 }], { cupon: 'ENVIO' })).datos
      .desglose;
    expect(pct.descuentoRestaurante).toBe(300);
  });

  it('plato agotado bajo el mínimo de «gasta 25 y ahorra 5»: el total nunca sube', async () => {
    const e = await escena();
    const grande = await e.plato('Bandeja', 2400);
    const chico = await e.plato('Refresco', 300);
    await e.promo({ tipo: 'gasta_ahorra', valor: 500, minimoSubtotal: 2500 });
    const p = await e.pedir([
      { platoId: grande, cantidad: 1 },
      { platoId: chico, cantidad: 1 },
    ]);
    const id = p.datos.pedidoId as string;
    expect(p.datos.desglose.descuentoRestaurante).toBe(500);
    const antes = (await e.fila(id))!;
    await e.pagar(id);
    const devolucion = await e.quitar(id, chico);
    const despues = (await e.fila(id))!;
    expect(despues.total).toBeLessThan(antes.total);
    expect(devolucion).toBe(antes.total - despues.total);
    expect(despues.promo).toBe(500);
    expect(
      despues.pago_restaurante + despues.pago_repartidor + despues.ganancia + despues.impuesto,
    ).toBe(despues.total);
  });

  it('plato agotado que deja el pedido bajo el mínimo: el cargo por pedido pequeño lo absorbe Divoox', async () => {
    const e = await escena();
    const nueve = await e.plato('Sopa', 900);
    const uno = await e.plato('Pan', 100);
    const p = await e.pedir([
      { platoId: nueve, cantidad: 1 },
      { platoId: uno, cantidad: 1 },
    ]);
    const id = p.datos.pedidoId as string;
    expect(p.datos.desglose.cargoPedidoPequeno).toBe(0);
    const antes = (await e.fila(id))!;
    await e.pagar(id);
    await e.quitar(id, uno);
    const despues = (await e.fila(id))!;
    expect(despues.total).toBeLessThanOrEqual(antes.total);
    expect(
      despues.pago_restaurante + despues.pago_repartidor + despues.ganancia + despues.impuesto,
    ).toBe(despues.total);
  });
});
