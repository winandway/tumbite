import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { conciliar } from './conciliacion';

/**
 * C-DESCUENTOS-RECALCULO (BRE-5c, 2 nov 2026): cuando un pedido ya creado se vuelve a calcular
 * (cambio de dirección o plato agotado), conserva el cupón, Divoox Plus y el saldo de regalo con
 * que se cobró. La cuenta del pedido recalculado es la misma que la de un pedido nuevo hecho así
 * desde el principio, el reparto cuadra (total = restaurante + repartidor + Divoox + impuesto) y la
 * conciliación sigue en «sí». EE. UU. (cupones, Plus y saldo de regalo solo existen en dólares).
 */
afterEach(() => vi.unstubAllGlobals());

const LEJOS = { direccion: '900 Calle Lejos', lat: 25.86, lng: -80.19 };

async function escena() {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ id: 'pi_x', client_secret: 'pi_x_s' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin', 'Soporte Cupones');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = async (nombreEs: string, precioCentavos: number) =>
    (
      await m.llamar(
        'POST',
        '/datos/mi-restaurante/platos',
        { nombreEs, precioCentavos },
        dueno.token,
      )
    ).datos.plato.id as string;
  const arroz = await plato('Arroz', 1500);
  const jugo = await plato('Jugo', 500);
  await m.abrir(dueno.token);
  const cupon = (datos: Record<string, unknown>) =>
    m.llamar('POST', '/datos/admin/cupones', { usosPorCliente: 9, ...datos }, admin.token);
  const pedir = (extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [
          { platoId: arroz, cantidad: 2 },
          { platoId: jugo, cantidad: 1 },
        ],
        propinaCentavos: 300,
        direccion: '300 Calle Prueba',
        lat: 25.775,
        lng: -80.195,
        ...extra,
      },
      cliente.token,
    );
  const fila = (id: string) =>
    m.DB.prepare(
      'SELECT total, descuento, envio, impuesto, pago_restaurante, pago_repartidor, ganancia FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first<{
        total: number;
        descuento: number;
        envio: number;
        impuesto: number;
        pago_restaurante: number;
        pago_repartidor: number;
        ganancia: number;
      }>();
  const cuadra = (f: NonNullable<Awaited<ReturnType<typeof fila>>>) =>
    expect(f.pago_restaurante + f.pago_repartidor + f.ganancia + f.impuesto).toBe(f.total);
  const mudar = (id: string) =>
    m.llamar(
      'PATCH',
      `/datos/pedidos/${id}/direccion`,
      { ...LEJOS, aceptarTotal: true },
      cliente.token,
    );
  return { m, dueno, admin, cliente, rid, arroz, jugo, cupon, pedir, fila, cuadra, mudar };
}

describe('los recálculos conservan los descuentos (C-DESCUENTOS-RECALCULO)', () => {
  it('cupón de 5 y cambio de dirección: el total sube solo por el envío y el reparto cuadra', async () => {
    const e = await escena();
    expect((await e.cupon({ codigo: 'CINCO', tipo: 'monto', valor: 500 })).estado).toBe(201);
    const p = await e.pedir({ cupon: 'CINCO' });
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    const antes = (await e.fila(id))!;
    expect(antes.descuento).toBe(500);
    expect((await e.mudar(id)).estado).toBe(200);
    const despues = (await e.fila(id))!;
    // El mismo pedido hecho desde el principio en la dirección nueva, con el mismo cupón.
    const nuevo = (await e.pedir({ cupon: 'CINCO', ...LEJOS })).datos.desglose;
    expect(despues.descuento).toBe(500);
    expect(despues.total).toBe(nuevo.totalCliente);
    expect(despues.ganancia).toBe(nuevo.gananciaPlataforma);
    expect(despues.total - antes.total).toBe(nuevo.envio - antes.envio);
    e.cuadra(despues);
    const uso = await e.m.DB.prepare('SELECT descuento FROM usos_cupon WHERE pedido_id = ?')
      .bind(id)
      .first<{ descuento: number }>();
    expect(uso?.descuento).toBe(500);

    // Se entrega y la conciliación del día cuadra.
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    const rep = await e.m.cuenta('repartidor', 'Rita Cupón');
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

  it('cupón de 5 y plato agotado: la devolución es solo la del plato, el cupón se queda', async () => {
    const e = await escena();
    await e.cupon({ codigo: 'CINCO', tipo: 'monto', valor: 500 });
    const p = await e.pedir({ cupon: 'CINCO' });
    const id = p.datos.pedidoId as string;
    const antes = (await e.fila(id))!;
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    const falta = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/falta`,
      { platoId: e.jugo },
      e.dueno.token,
    );
    expect(falta.estado).toBe(200);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/pedidos/${id}/ajuste`,
          { decision: 'quitar' },
          e.cliente.token,
        )
      ).estado,
    ).toBe(200);
    const despues = (await e.fila(id))!;
    const nuevo = (await e.pedir({ cupon: 'CINCO', lineas: [{ platoId: e.arroz, cantidad: 2 }] }))
      .datos.desglose;
    expect(despues.descuento).toBe(500);
    expect(despues.total).toBe(nuevo.totalCliente);
    expect(despues.ganancia).toBe(nuevo.gananciaPlataforma);
    expect(falta.datos.devolucion).toBe(antes.total - nuevo.totalCliente);
    e.cuadra(despues);
  });

  it('cupón de envío gratis y de porcentaje siguen a su regla al recalcular', async () => {
    const e = await escena();
    await e.cupon({ codigo: 'ENVIO', tipo: 'envio_gratis' });
    await e.cupon({ codigo: 'DIEZ', tipo: 'porcentaje', valor: 1000 });
    const envio = (await e.pedir({ cupon: 'ENVIO' })).datos.pedidoId as string;
    const antesEnvio = (await e.fila(envio))!;
    expect((await e.mudar(envio)).estado).toBe(200);
    const despuesEnvio = (await e.fila(envio))!;
    // El envío nuevo es más caro y lo sigue absorbiendo el cupón: el cliente paga igual.
    expect(despuesEnvio.envio).toBeGreaterThan(antesEnvio.envio);
    expect(despuesEnvio.total).toBe(antesEnvio.total);
    expect(despuesEnvio.descuento).toBe(despuesEnvio.envio);
    e.cuadra(despuesEnvio);

    const pct = (await e.pedir({ cupon: 'DIEZ' })).datos.pedidoId as string;
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(pct)
      .run();
    await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${pct}/falta`,
      { platoId: e.jugo },
      e.dueno.token,
    );
    await e.m.llamar(
      'POST',
      `/datos/pedidos/${pct}/ajuste`,
      { decision: 'quitar' },
      e.cliente.token,
    );
    // 10 % de los 30 dólares que quedan.
    expect((await e.fila(pct))!.descuento).toBe(300);
    e.cuadra((await e.fila(pct))!);
  });

  it('ETP-2 · Divoox Plus y plato agotado: la devolución es solo la del plato, Plus se recalcula (cierra el pendiente de C-PLUS)', async () => {
    const e = await escena();
    await e.m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('plus', ?)")
      .bind(JSON.stringify({ centavosMes: 999, minimoSubtotal: 1200, servicioDescuentoPct: 50 }))
      .run();
    await e.m.DB.prepare(
      "INSERT INTO suscripciones_plus (usuario_id, stripe_suscripcion, estado, vence_en) VALUES (?, 'sub_x', 'activa', datetime('now', '+30 days'))",
    )
      .bind(e.cliente.id)
      .run();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    const antes = (await e.fila(id))!;
    expect(antes.descuento).toBeGreaterThan(0);
    await e.m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    const falta = await e.m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/falta`,
      { platoId: e.jugo },
      e.dueno.token,
    );
    expect(falta.estado).toBe(200);
    expect(
      (
        await e.m.llamar(
          'POST',
          `/datos/pedidos/${id}/ajuste`,
          { decision: 'quitar' },
          e.cliente.token,
        )
      ).estado,
    ).toBe(200);
    const despues = (await e.fila(id))!;
    const nuevo = (await e.pedir({ lineas: [{ platoId: e.arroz, cantidad: 2 }] })).datos.desglose;
    expect(despues.descuento).toBe(nuevo.descuento);
    expect(despues.total).toBe(nuevo.totalCliente);
    expect(falta.datos.devolucion).toBe(antes.total - nuevo.totalCliente);
    const plus = await e.m.DB.prepare('SELECT descuento FROM pedidos_plus WHERE pedido_id = ?')
      .bind(id)
      .first<{ descuento: number }>();
    expect(plus?.descuento).toBe(despues.descuento);
    e.cuadra(despues);
  });

  it('Divoox Plus sigue quitando el envío nuevo y el saldo de regalo se conserva', async () => {
    const e = await escena();
    await e.m.DB.prepare("INSERT INTO config (clave, valor) VALUES ('plus', ?)")
      .bind(JSON.stringify({ centavosMes: 999, minimoSubtotal: 1200, servicioDescuentoPct: 50 }))
      .run();
    await e.m.DB.prepare(
      "INSERT INTO suscripciones_plus (usuario_id, stripe_suscripcion, estado, vence_en) VALUES (?, 'sub_x', 'activa', datetime('now', '+30 days'))",
    )
      .bind(e.cliente.id)
      .run();
    const p = await e.pedir();
    const id = p.datos.pedidoId as string;
    const antes = (await e.fila(id))!;
    expect(antes.descuento).toBeGreaterThan(antes.envio);
    expect((await e.mudar(id)).estado).toBe(200);
    const despues = (await e.fila(id))!;
    const nuevo = (await e.pedir(LEJOS)).datos.desglose;
    expect(despues.total).toBe(nuevo.totalCliente);
    expect(despues.descuento).toBe(nuevo.descuento);
    const plus = await e.m.DB.prepare('SELECT descuento FROM pedidos_plus WHERE pedido_id = ?')
      .bind(id)
      .first<{ descuento: number }>();
    expect(plus?.descuento).toBe(despues.descuento);
    e.cuadra(despues);

    // Saldo de regalo: el apartado se queda igual tras el cambio de dirección.
    await e.m.DB.prepare('DELETE FROM suscripciones_plus WHERE usuario_id = ?')
      .bind(e.cliente.id)
      .run();
    await e.m.DB.prepare(
      "INSERT INTO creditos_regalo (id, usuario_id, centavos, motivo, referencia) VALUES ('cr1', ?, 1000, 'prueba', 'bre-5c')",
    )
      .bind(e.cliente.id)
      .run();
    const g = await e.pedir({ usarSaldoRegalo: true });
    expect(g.estado).toBe(201);
    const gid = g.datos.pedidoId as string;
    expect((await e.fila(gid))!.descuento).toBe(1000);
    expect((await e.mudar(gid)).estado).toBe(200);
    expect((await e.fila(gid))!.descuento).toBe(1000);
    const apartado = await e.m.DB.prepare(
      'SELECT centavos FROM pedidos_saldo_regalo WHERE pedido_id = ?',
    )
      .bind(gid)
      .first<{ centavos: number }>();
    expect(apartado?.centavos).toBe(1000);
    e.cuadra((await e.fila(gid))!);
  });
});
